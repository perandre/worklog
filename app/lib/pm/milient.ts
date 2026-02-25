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

  async getProjects(): Promise<PmProject[]> {
    return cachedFetch(`projects:${this.userEmail}`, async () => {
      const [allProjects, userProjectIds] = await Promise.all([
        cachedFetch("projects:all", () => milientListAll<any>("projects", { includes: "base" })),
        this.getUserProjectIds(),
      ])

      const filtered = allProjects.filter((p: any) =>
        userProjectIds.has(p.id) &&
        p.projectState === "inProgress"
      )
      console.log(`[PM] getProjects: ${allProjects.length} total → ${filtered.length} after filtering (inProgress + member)`)
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

    const userProjectIds = await this.getUserProjectIds()

    return cachedFetch(`activities:user:${this.userEmail}`, async () => {
      const allExtensions = await cachedFetch("activities:all", () =>
        milientListAll<any>("projectExtensions", { includes: "base" })
      )

      const filtered = allExtensions.filter((a: any) =>
        userProjectIds.has(a.projectId) &&
        a.projectExtensionState !== "closed"
      )
      console.log(`[PM] getActivityTypes: ${allExtensions.length} total → ${filtered.length} after filtering (member + not closed)`)
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
