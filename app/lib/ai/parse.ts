import { TimeLogSuggestion } from "../types/timelog"

function tryParseArray(s: string): any[] | null {
  try {
    const result = JSON.parse(s)
    return Array.isArray(result) ? result : null
  } catch {
    return null
  }
}

export function parseSuggestions(jsonString: string): TimeLogSuggestion[] {
  let raw: any[] | null = null

  // 1. Direct parse
  raw = tryParseArray(jsonString)

  // 2. Extract array from markdown/extra text
  if (!raw) {
    const match = jsonString.match(/\[[\s\S]*\]/)
    if (match) raw = tryParseArray(match[0])
  }

  // 3. Truncated response — salvage up to last complete object
  if (!raw) {
    const start = jsonString.indexOf("[")
    if (start !== -1) {
      const lastClose = jsonString.lastIndexOf("}")
      if (lastClose !== -1) {
        raw = tryParseArray(jsonString.slice(start, lastClose + 1) + "]")
      }
    }
  }

  if (!raw) throw new Error("Kunne ikke finne JSON i AI-svaret")

  return raw.map((item, i) => ({
    id: crypto.randomUUID(),
    projectId: String(item.projectId || ""),
    projectName: String(item.projectName || "Ukjent prosjekt"),
    activityTypeId: String(item.activityTypeId || ""),
    activityTypeName: String(item.activityTypeName || "Ukjent type"),
    hours: roundToHalf(Number(item.hours) || 0.5),
    description: String(item.description || ""),
    internalNote: String(item.internalNote || ""),
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
