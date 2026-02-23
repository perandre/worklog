export type TimeLogSuggestion = {
  id: string
  projectId: string
  projectName: string
  activityTypeId: string
  activityTypeName: string
  hours: number
  description: string
  descriptionEn: string
  internalNote: string
  reasoning: string
  confidence: "high" | "medium" | "low"
  sourceActivities: {
    source: string
    title: string
    timestamp: string
    estimatedMinutes?: number
  }[]
  status: "pending" | "approved" | "skipped" | "edited"
}

export type TimeLogSubmission = {
  projectId: string
  activityTypeId: string
  date: string
  hours: number
  description: string
  internalNote?: string
}

export type AiSuggestionResponse = {
  suggestions: TimeLogSuggestion[]
  totalHours: number
  unaccountedMinutes: number
}
