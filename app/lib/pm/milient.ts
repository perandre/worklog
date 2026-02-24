import { PmAdapter } from "./adapter"
import { PmProject, PmActivityType, PmAllocation } from "../types/pm"
import { TimeLogSubmission } from "../types/timelog"
import { milientFetch, milientList, cachedFetch, MILIENT_USER_ID } from "../milient"

export class MilientPmAdapter implements PmAdapter {
  name = "milient"

  async getProjects(): Promise<PmProject[]> {
    return cachedFetch("projects", async () => {
      const data = await milientList<any>("projects", {
        includes: "base",
      })

      return data.map((p) => ({
        id: String(p.id),
        name: p.name,
        code: p.projectNumber || undefined,
      }))
    })
  }

  async getActivityTypes(projectId?: string): Promise<PmActivityType[]> {
    const cacheKey = `activities:${projectId || "all"}`
    return cachedFetch(cacheKey, async () => {
      // In Milient, activity types are "project extensions"
      const entity = projectId
        ? `projects/${projectId}/projectExtensions`
        : "projectExtensions"

      const data = await milientList<any>(entity, {
        includes: "base",
      })

      return data.map((a) => ({
        id: String(a.id),
        name: a.name,
      }))
    })
  }

  async getAllocations(date: string): Promise<PmAllocation[]> {
    const data = await milientList<any>("allocations", {
      includes: "base+projectName",
      params: {
        userAccountId: MILIENT_USER_ID,
        fromDate: date,
        toDate: date,
      },
    })

    return data.map((a) => ({
      projectId: String(a.projectId),
      projectName: a.projectName,
      allocatedHours: (a.minutes || 0) / 60,
    }))
  }

  async submitTimeLog(
    entry: TimeLogSubmission
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await milientFetch("timeRecords", {
        method: "POST",
        body: {
          projectId: Number(entry.projectId),
          projectExtensionId: Number(entry.activityTypeId),
          timeRecordDate: entry.date,
          minutes: Math.round(entry.hours * 60),
          description: entry.description,
          internalNote: entry.internalNote || undefined,
          userAccountId: Number(MILIENT_USER_ID),
        },
      })

      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
}
