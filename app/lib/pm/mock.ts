import { PmAdapter } from "./adapter"
import { PmProject, PmActivityType, PmAllocation } from "../types/pm"
import { TimeLogSubmission } from "../types/timelog"

const MOCK_PROJECTS: PmProject[] = [
  { id: "p1", name: "Prosjekt Alfa", code: "ALFA" },
  { id: "p2", name: "DevApp", code: "DEV" },
  { id: "p3", name: "Kundeportal", code: "KP" },
  { id: "p4", name: "Intern/Admin", code: "INT" },
  { id: "p5", name: "Salg og marked", code: "SAL" },
  { id: "p6", name: "Opplæring", code: "OPL" },
]

const MOCK_ACTIVITY_TYPES: PmActivityType[] = [
  { id: "a1", name: "Utvikling" },
  { id: "a2", name: "FoU-aktivitet" },
  { id: "a3", name: "Møter" },
  { id: "a4", name: "Administrasjon" },
  { id: "a5", name: "Dokumentasjon" },
  { id: "a6", name: "Testing" },
  { id: "a7", name: "Planlegging" },
]

const MOCK_ALLOCATIONS: PmAllocation[] = [
  { projectId: "p1", projectName: "Prosjekt Alfa", allocatedHours: 3 },
  { projectId: "p2", projectName: "DevApp", allocatedHours: 3 },
  { projectId: "p4", projectName: "Intern/Admin", allocatedHours: 1.5 },
]

export class MockPmAdapter implements PmAdapter {
  name = "mock"

  async getProjects(): Promise<PmProject[]> {
    return MOCK_PROJECTS
  }

  async getActivityTypes(_projectId?: string): Promise<PmActivityType[]> {
    return MOCK_ACTIVITY_TYPES
  }

  async getAllocations(_date: string): Promise<PmAllocation[]> {
    return MOCK_ALLOCATIONS
  }

  async getTimeLockDate(): Promise<string | null> {
    return null
  }

  async submitTimeLog(entry: TimeLogSubmission): Promise<{ success: boolean; error?: string }> {
    console.log("[MockPM] Submitting time log:", JSON.stringify(entry, null, 2))
    return { success: true }
  }
}
