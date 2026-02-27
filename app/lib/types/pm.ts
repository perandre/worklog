export type PmProjectRole = { membershipId: string; roleName: string }
export type PmProject = { id: string; name: string; code?: string; roles?: PmProjectRole[] }
export type PmActivityType = { id: string; name: string; projectId?: string }
export type PmAllocation = { projectId: string; projectName: string; allocatedHours: number }
export type PmTimeRecord = {
  projectId: string
  projectName: string
  activityTypeName: string
  hours: number
  description: string
}
export type PmContext = {
  projects: PmProject[]
  activityTypes: PmActivityType[]
  allocations: PmAllocation[]
  existingRecords: PmTimeRecord[]
  timeLockDate: string | null
}
