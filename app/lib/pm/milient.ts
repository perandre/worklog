import { PmAdapter } from "./adapter"
import { PmProject, PmActivityType, PmAllocation } from "../types/pm"
import { TimeLogSubmission } from "../types/timelog"
import { milientFetch, cachedFetch, MILIENT_USER_ID } from "../milient"

export class MilientPmAdapter implements PmAdapter {
  name = "milient"

  async getProjects(): Promise<PmProject[]> {
    return cachedFetch("projects", async () => {
      const data = await milientFetch<any[]>("projects", {
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
      const entity = projectId
        ? `projects/${projectId}/activities`
        : "activities"

      const data = await milientFetch<any[]>(entity, {
        includes: "base",
      })

      return data.map((a) => ({
        id: String(a.id),
        name: a.name,
      }))
    })
  }

  async getAllocations(date: string): Promise<PmAllocation[]> {
    const data = await milientFetch<any[]>("allocations", {
      includes: "base+project.name",
      params: {
        userId: MILIENT_USER_ID,
        fromDate: date,
        toDate: date,
      },
    })

    return data.map((a) => ({
      projectId: String(a.projectId),
      projectName: a.projectName,
      allocatedHours: a.hours || a.allocatedHours || 0,
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
          activityId: Number(entry.activityTypeId),
          date: entry.date,
          hours: entry.hours,
          description: entry.description,
          internalNote: entry.internalNote || undefined,
          userId: Number(MILIENT_USER_ID),
        },
      })

      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
}
