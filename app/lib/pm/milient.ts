import { PmAdapter } from "./adapter"
import { PmProject, PmActivityType, PmAllocation } from "../types/pm"
import { TimeLogSubmission } from "../types/timelog"
import { milientFetch, milientList, cachedFetch, resolveUserAccountId } from "../milient"

export class MilientPmAdapter implements PmAdapter {
  name = "milient"
  private userAccountId: Promise<string>

  constructor(userEmail: string) {
    this.userAccountId = resolveUserAccountId(userEmail)
  }

  async getProjects(): Promise<PmProject[]> {
    return cachedFetch("projects", async () => {
      const data = await milientList<any>("projects", {
        includes: "base",
      })

      return data.map((p: any) => ({
        id: String(p.id),
        name: p.name,
        code: p.projectNumber || undefined,
      }))
    })
  }

  async getActivityTypes(projectId?: string): Promise<PmActivityType[]> {
    const cacheKey = `activities:${projectId || "all"}`
    return cachedFetch(cacheKey, async () => {
      const entity = projectId
        ? `projects/${projectId}/projectExtensions`
        : "projectExtensions"

      const data = await milientList<any>(entity, {
        includes: "base",
      })

      return data.map((a: any) => ({
        id: String(a.id),
        name: a.name,
      }))
    })
  }

  async getAllocations(date: string): Promise<PmAllocation[]> {
    const userId = await this.userAccountId
    const data = await milientList<any>("allocations", {
      includes: "base+projectName",
      params: {
        userAccountId: userId,
        fromDate: date,
        toDate: date,
      },
    })

    return data.map((a: any) => ({
      projectId: String(a.projectId),
      projectName: a.projectName,
      allocatedHours: (a.minutes || 0) / 60,
    }))
  }

  async submitTimeLog(
    entry: TimeLogSubmission
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const userId = await this.userAccountId
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
