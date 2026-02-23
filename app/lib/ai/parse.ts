import { TimeLogSuggestion } from "../types/timelog"

export function parseSuggestions(jsonString: string): TimeLogSuggestion[] {
  // Try to extract JSON array from the response
  let raw: any[]
  try {
    raw = JSON.parse(jsonString)
  } catch {
    // Try to find JSON array in the string
    const match = jsonString.match(/\[[\s\S]*\]/)
    if (!match) throw new Error("Kunne ikke finne JSON i AI-svaret")
    raw = JSON.parse(match[0])
  }

  if (!Array.isArray(raw)) {
    throw new Error("AI-svaret er ikke en liste")
  }

  return raw.map((item, i) => ({
    id: crypto.randomUUID(),
    projectId: String(item.projectId || ""),
    projectName: String(item.projectName || "Ukjent prosjekt"),
    activityTypeId: String(item.activityTypeId || ""),
    activityTypeName: String(item.activityTypeName || "Ukjent type"),
    hours: roundToHalf(Number(item.hours) || 0.5),
    description: String(item.description || ""),
    descriptionEn: String(item.descriptionEn || item.description || ""),
    internalNote: String(item.internalNote || ""),
    reasoning: String(item.reasoning || ""),
    confidence: validateConfidence(item.confidence),
    sourceActivities: Array.isArray(item.sourceActivities)
      ? item.sourceActivities.map((sa: any) => ({
          source: String(sa.source || ""),
          title: String(sa.title || ""),
          timestamp: String(sa.timestamp || ""),
          estimatedMinutes: sa.estimatedMinutes ? Number(sa.estimatedMinutes) : undefined,
        }))
      : [],
    status: "pending" as const,
  }))
}

function roundToHalf(n: number): number {
  return Math.max(0.5, Math.round(n * 2) / 2)
}

function validateConfidence(c: any): "high" | "medium" | "low" {
  if (c === "high" || c === "medium" || c === "low") return c
  return "medium"
}
