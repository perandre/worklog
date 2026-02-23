import { PmProject, PmActivityType, PmAllocation } from "../types/pm"
import { TimeLogSubmission } from "../types/timelog"

export interface PmAdapter {
  name: string
  getProjects(): Promise<PmProject[]>
  getActivityTypes(projectId?: string): Promise<PmActivityType[]>
  getAllocations(date: string): Promise<PmAllocation[]>
  submitTimeLog(entry: TimeLogSubmission): Promise<{ success: boolean; error?: string }>
}
