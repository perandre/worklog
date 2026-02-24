export type PmProject = { id: string; name: string; code?: string }
export type PmActivityType = { id: string; name: string; projectId?: string }
export type PmAllocation = { projectId: string; projectName: string; allocatedHours: number }
export type PmContext = {
  projects: PmProject[]
  activityTypes: PmActivityType[]
  allocations: PmAllocation[]
  timeLockDate: string | null
}
