import { PmAdapter } from "./adapter"
import { PmProject, PmActivityType, PmAllocation, PmTimeRecord } from "../types/pm"
import { TimeLogSubmission } from "../types/timelog"
import { milientFetch, milientList, milientListAll, cachedFetch, resolveUserAccountId } from "../milient"

export class MilientPmAdapter implements PmAdapter {
  name = "milient"
  private userEmail: string
  private preResolvedId: string | undefined
  private userAccountIdPromise: Promise<string> | null = null
  private timeRecordsCache = new Map<string, Promise<any[]>>()

  constructor(userEmail: string, userAccountId?: string) {
    this.userEmail = userEmail
    this.preResolvedId = userAccountId
  }

  private getUserAccountId(): Promise<string> {
    if (this.preResolvedId) return Promise.resolve(this.preResolvedId)
    if (!this.userAccountIdPromise) {
      this.userAccountIdPromise = resolveUserAccountId(this.userEmail)
    }
    return this.userAccountIdPromise
  }

  // Get the user's active project memberships (cached per user)
  private async getUserMemberships(): Promise<{
    projectIds: Set<number>
    rolesByProject: Map<number, { membershipId: number; roleName: string }[]>
  }> {
    const userId = await this.getUserAccountId()
    return cachedFetch(`memberships:${userId}`, async () => {
      const memberships = await milientListAll<any>("projectMemberships", {
        includes: "base",
        params: {
          userAccountId: userId,
          projectMembershipState: "active",
        },
      })
      const projectIds = new Set<number>()
      const rolesByProject = new Map<number, { membershipId: number; roleName: string }[]>()
      for (const m of memberships) {
        projectIds.add(m.projectId)
        if (!rolesByProject.has(m.projectId)) rolesByProject.set(m.projectId, [])
        rolesByProject.get(m.projectId)!.push({
          membershipId: m.id,
          roleName: m.projectMembershipRoleName || "Default",
        })
      }
      return { projectIds, rolesByProject }
    })
  }

  // Analyse the last N days of time records to produce ranked project + activity type lists
  private async getRecentUsage(days = 30): Promise<{
    topProjectIds: string[]                            // sorted by usage, max 50
    topActivityTypeIdsByProject: Map<string, string[]> // top 3 per project
  }> {
    const userId = await this.getUserAccountId()
    return cachedFetch(`recentUsage:${userId}:${days}`, async () => {
      const toDate = new Date().toISOString().split("T")[0]
      const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
      const rawRecords = await milientListAll<any>("timeRecords", {
        params: { userAccountId: userId, fromDate, toDate },
      })
      // Milient API may return records outside the requested range — filter client-side
      const records = rawRecords.filter((r: any) => r.timeRecordDate >= fromDate && r.timeRecordDate <= toDate)

      // Count records per project, then take top 50
      const projectCount = new Map<string, number>()
      for (const r of records) {
        const pid = String(r.projectId)
        projectCount.set(pid, (projectCount.get(pid) || 0) + 1)
      }
      const topProjectIds = Array.from(projectCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50)
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
      const topProjectIdSet = new Set(topProjectIds)
      const topActivityTypeIdsByProject = new Map<string, string[]>()
      Array.from(typeCountByProject.entries()).forEach(([pid, typeCount]) => {
        if (!topProjectIdSet.has(pid)) return // only top 20 projects
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
      const [allProjects, { projectIds: userProjectIds, rolesByProject }, { topProjectIds }] = await Promise.all([
        cachedFetch("projects:all", () => milientListAll<any>("projects", { includes: "base" })),
        this.getUserMemberships(),
        this.getRecentUsage(),
      ])

      const recentSet = new Set(topProjectIds)
      const filtered = allProjects.filter((p: any) =>
        userProjectIds.has(p.id) &&
        p.projectState === "inProgress" &&
        recentSet.has(String(p.id))
      )
      // Sort by recency rank
      const rank = new Map(topProjectIds.map((id, i) => [id, i]))
      filtered.sort((a: any, b: any) => (rank.get(String(a.id)) ?? 99) - (rank.get(String(b.id)) ?? 99))

      console.log(`[Milient] Projects: ${allProjects.length} total → ${filtered.length} selected (active + member + logged last 30d)`)
      return filtered.map((p: any) => {
        const roles = rolesByProject.get(p.id) || []
        return {
          id: String(p.id),
          name: p.name,
          code: p.projectNumber || undefined,
          roles: roles.map((r) => ({ membershipId: String(r.membershipId), roleName: r.roleName })),
        }
      })
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

    const [{ projectIds: userProjectIds }, { topActivityTypeIdsByProject }] = await Promise.all([
      this.getUserMemberships(),
      this.getRecentUsage(),
    ])

    return cachedFetch(`activities:user:${this.userEmail}`, async () => {
      const allExtensions = await cachedFetch("activities:all", () =>
        milientListAll<any>("projectExtensions", { includes: "base" })
      )

      // Build flat set of allowed type IDs (top 3 per project)
      const allowedTypeIds = new Set<string>()
      Array.from(topActivityTypeIdsByProject.values()).forEach((ids: string[]) => ids.forEach((id) => allowedTypeIds.add(id)))

      const filtered = allExtensions.filter((a: any) =>
        userProjectIds.has(a.projectId) &&
        allowedTypeIds.has(String(a.id)) &&
        a.projectExtensionState !== "closed"
      )
      console.log(`[Milient] Activity types: ${allExtensions.length} total → ${filtered.length} selected (top 3/project across ${topActivityTypeIdsByProject.size} top-20 projects, last 14d)`)
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
          ...(entry.projectMembershipId ? { projectMembershipId: Number(entry.projectMembershipId) } : {}),
        },
      })

      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
}
