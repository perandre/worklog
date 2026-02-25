import { PmProject, PmActivityType, PmAllocation, PmTimeRecord } from "../types/pm"
import { TimeLogSubmission } from "../types/timelog"

export interface PmAdapter {
  name: string
  getProjects(): Promise<PmProject[]>
  getActivityTypes(projectId?: string): Promise<PmActivityType[]>
  getAllocations(date: string): Promise<PmAllocation[]>
  getExistingRecords(date: string): Promise<PmTimeRecord[]>
  getTimeLockDate(): Promise<string | null>
  submitTimeLog(entry: TimeLogSubmission): Promise<{ success: boolean; error?: string }>
}
