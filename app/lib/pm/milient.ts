import { PmAdapter } from "./adapter"
import { PmProject, PmActivityType, PmAllocation, PmTimeRecord } from "../types/pm"
import { TimeLogSubmission } from "../types/timelog"
import { milientFetch, milientList, milientListAll, cachedFetch, resolveUserAccountId } from "../milient"

export class MilientPmAdapter implements PmAdapter {
  name = "milient"
  private userEmail: string
  private userAccountIdPromise: Promise<string> | null = null
  private timeRecordsCache = new Map<string, Promise<any[]>>()

  constructor(userEmail: string) {
    this.userEmail = userEmail
  }

  private getUserAccountId(): Promise<string> {
    if (!this.userAccountIdPromise) {
      this.userAccountIdPromise = resolveUserAccountId(this.userEmail)
    }
    return this.userAccountIdPromise
  }

  // Get the user's active project memberships (cached per user)
  private async getUserProjectIds(): Promise<Set<number>> {
    const userId = await this.getUserAccountId()
    return cachedFetch(`memberships:${userId}`, async () => {
      const memberships = await milientListAll<any>("projectMemberships", {
        includes: "base",
        params: {
          userAccountId: userId,
          projectMembershipState: "active",
        },
      })
      return new Set(memberships.map((m: any) => m.projectId as number))
    })
  }

  // Analyse the last N days of time records to produce ranked project + activity type lists
  private async getRecentUsage(days = 14): Promise<{
    topProjectIds: string[]                            // sorted by usage, max 20
    topActivityTypeIdsByProject: Map<string, string[]> // top 3 per project
  }> {
    const userId = await this.getUserAccountId()
    return cachedFetch(`recentUsage:${userId}:${days}`, async () => {
      const toDate = new Date().toISOString().split("T")[0]
      const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
      const records = await milientListAll<any>("timeRecords", {
        params: { userAccountId: userId, fromDate, toDate },
      })

      // Count records per project, then take top 20
      const projectCount = new Map<string, number>()
      for (const r of records) {
        const pid = String(r.projectId)
        projectCount.set(pid, (projectCount.get(pid) || 0) + 1)
      }
      const topProjectIds = Array.from(projectCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([id]) => id)

      // Count activity type usage per project, take top 3
      const typeCountByProject = new Map<string, Map<string, number>>()
      for (const r of records) {
        const pid = String(r.projectId)
        const tid = String(r.projectExtensionId)
        if (!tid || tid === "undefined" || tid === "null") continue
        if (!typeCountByProject.has(pid)) typeCountByProject.set(pid, new Map())
        const m = typeCountByProject.get(pid)!
        m.set(tid, (m.get(tid) || 0) + 1)
      }
      const topActivityTypeIdsByProject = new Map<string, string[]>()
      Array.from(typeCountByProject.entries()).forEach(([pid, typeCount]) => {
        const top3 = Array.from(typeCount.entries())
          .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
          .slice(0, 3)
          .map((entry: [string, number]) => entry[0])
        topActivityTypeIdsByProject.set(pid, top3)
      })

      return { topProjectIds, topActivityTypeIdsByProject }
    })
  }

  async getProjects(): Promise<PmProject[]> {
    return cachedFetch(`projects:${this.userEmail}`, async () => {
      const [allProjects, userProjectIds, { topProjectIds }] = await Promise.all([
        cachedFetch("projects:all", () => milientListAll<any>("projects", { includes: "base" })),
        this.getUserProjectIds(),
        this.getRecentUsage(),
      ])

      const filtered = allProjects.filter((p: any) =>
        userProjectIds.has(p.id) &&
        p.projectState === "inProgress"
      )
      // Recently-used projects first (ranked by usage), then the rest alphabetically
      const rank = new Map(topProjectIds.map((id, i) => [id, i]))
      filtered.sort((a: any, b: any) => {
        const ra = rank.get(String(a.id))
        const rb = rank.get(String(b.id))
        if (ra !== undefined && rb !== undefined) return ra - rb
        if (ra !== undefined) return -1
        if (rb !== undefined) return 1
        return (a.name || "").localeCompare(b.name || "")
      })

      console.log(`[PM] getProjects: ${allProjects.length} total → ${filtered.length} (all active member projects, ${topProjectIds.length} recently used)`)
      return filtered.map((p: any) => ({
        id: String(p.id),
        name: p.name,
        code: p.projectNumber || undefined,
      }))
    })
  }

  async getActivityTypes(projectId?: string): Promise<PmActivityType[]> {
    if (projectId) {
      return cachedFetch(`activities:${projectId}`, async () => {
        const data = await milientListAll<any>("projectExtensions", {
          includes: "base",
          params: { projectId },
        })
        return data
          .filter((a: any) => a.projectExtensionState !== "closed")
          .map((a: any) => ({
            id: String(a.id),
            name: a.name,
            projectId: String(a.projectId),
          }))
      })
    }

    const [userProjectIds, { topActivityTypeIdsByProject }] = await Promise.all([
      this.getUserProjectIds(),
      this.getRecentUsage(),
    ])

    return cachedFetch(`activities:user:${this.userEmail}`, async () => {
      const allExtensions = await cachedFetch("activities:all", () =>
        milientListAll<any>("projectExtensions", { includes: "base" })
      )

      const allowedTypeIds = new Set<string>()
      Array.from(topActivityTypeIdsByProject.values()).forEach((ids: string[]) => ids.forEach((id) => allowedTypeIds.add(id)))

      const projectsWithUsage = new Set(topActivityTypeIdsByProject.keys())

      const filtered = allExtensions.filter((a: any) => {
        if (!userProjectIds.has(a.projectId)) return false
        if (a.projectExtensionState === "closed") return false
        const pid = String(a.projectId)
        // Recently-used projects: top 3 activity types only
        if (projectsWithUsage.has(pid)) return allowedTypeIds.has(String(a.id))
        // Projects without recent usage: include all open activity types
        return true
      })
      console.log(`[PM] getActivityTypes: ${allExtensions.length} total → ${filtered.length} (top 3/project for recent, all for new)`)
      return filtered.map((a: any) => ({
        id: String(a.id),
        name: a.name,
        projectId: String(a.projectId),
      }))
    })
  }

  private fetchTimeRecords(date: string): Promise<any[]> {
    const cached = this.timeRecordsCache.get(date)
    if (cached) return cached
    const promise = this.getUserAccountId().then((userId) =>
      milientList<any>("timeRecords", {
        params: {
          userAccountId: userId,
          fromDate: date,
          toDate: date,
        },
      }).then((records) => {
        // API may return records outside the requested range — filter client-side
        return records.filter((r: any) => r.timeRecordDate === date)
      })
    )
    this.timeRecordsCache.set(date, promise)
    return promise
  }

  async getAllocations(date: string): Promise<PmAllocation[]> {
    const data = await this.fetchTimeRecords(date)

    // Group by project and sum minutes
    const byProject = new Map<string, { projectName: string; minutes: number }>()
    for (const r of data) {
      const pid = String(r.projectId)
      const existing = byProject.get(pid)
      if (existing) {
        existing.minutes += r.minutes || 0
      } else {
        byProject.set(pid, {
          projectName: r.projectName || `Project ${pid}`,
          minutes: r.minutes || 0,
        })
      }
    }

    return Array.from(byProject.entries()).map(([projectId, { projectName, minutes }]) => ({
      projectId,
      projectName,
      allocatedHours: minutes / 60,
    }))
  }

  async getExistingRecords(date: string): Promise<PmTimeRecord[]> {
    const data = await this.fetchTimeRecords(date)

    return data.map((r: any) => ({
      projectId: String(r.projectId),
      projectName: r.projectName || `Project ${r.projectId}`,
      activityTypeName: r.projectExtensionName || "",
      hours: (r.minutes || 0) / 60,
      description: r.description || "",
    }))
  }

  async getTimeLockDate(): Promise<string | null> {
    try {
      const userId = await this.getUserAccountId()
      const user = await cachedFetch(`userAccount:${userId}`, () =>
        milientFetch<any>(`userAccounts/${userId}`)
      )
      return user.timeLockDate || null
    } catch {
      return null
    }
  }

  async submitTimeLog(
    entry: TimeLogSubmission
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const userId = await this.getUserAccountId()
      await milientFetch("timeRecords", {
        method: "POST",
        body: {
          projectId: Number(entry.projectId),
          projectExtensionId: Number(entry.activityTypeId),
          timeRecordDate: entry.date,
          minutes: Math.round(entry.hours * 60),
          description: entry.description,
          internalNote: entry.internalNote || undefined,
          userAccountId: Number(userId),
        },
      })

      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
}
