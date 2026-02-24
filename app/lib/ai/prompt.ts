import { PmContext } from "../types/pm"
import { PreprocessedData } from "./preprocess"

export function assemblePrompt(data: PreprocessedData, pmContext: PmContext, date: string): string {
  const projectList = pmContext.projects
    .map((p) => `- ${p.name} (ID: ${p.id}${p.code ? `, code: ${p.code}` : ""})`)
    .join("\n")

  const activityTypeList = pmContext.activityTypes
    .map((t) => `- ${t.name} (ID: ${t.id})`)
    .join("\n")

  const allocationList = pmContext.allocations.length > 0
    ? pmContext.allocations.map((a) => `- ${a.projectName}: ${a.allocatedHours}t`).join("\n")
    : "No allocations registered."

  const activityList = data.activities
    .map((a) => {
      const time = new Date(a.timestamp).toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })
      const dur = a.durationMinutes ? ` (${a.durationMinutes} min)` : ""
      return `- [${time}] [${a.source}] ${a.title}${dur}`
    })
    .join("\n")

  return `You are a time-logging assistant for a Norwegian consulting company.

YOUR PRIMARY JOB: Map the day's activities to the correct projects and activity types.
Focus on accurate project/activity mapping. Description text is secondary — only add a brief description when it adds useful context. Often the activity titles are sufficient and no extra description is needed.

RULES:
- Norwegian workday is 7.5 hours
- Round to nearest 0.5 hour per project (minimum 0.5h)
- Write descriptions in English, keep them brief or empty if activity titles are self-explanatory
- Do NOT generate internalNote (leave as empty string)
- Respond ONLY with valid JSON matching the schema below
- Total hours should be ~7.5h
- If rounding exceeds 7.5h, trim the lowest-confidence entry

DATE: ${date}

AVAILABLE PROJECTS:
${projectList}

ACTIVITY TYPES:
${activityTypeList}

ALLOCATIONS (hints for distribution):
${allocationList}

TODAY'S ACTIVITIES:
${activityList}

ANALYSIS:
- Calendar time: ${data.calendarMinutes} minutes
- Time between meetings: ${data.gapMinutes} minutes
- Lunch detected: ${data.lunchDetected ? "yes (−30 min)" : "no"}
- Estimated active time: ${data.totalActiveMinutes} minutes

SCHEMA (return JSON array):
[
  {
    "projectId": "string",
    "projectName": "string",
    "activityTypeId": "string",
    "activityTypeName": "string",
    "hours": number,
    "description": "Brief English description, or empty string if not needed",
    "internalNote": "",
    "reasoning": "Why this mapping was chosen",
    "confidence": "high" | "medium" | "low",
    "sourceActivities": [
      { "source": "string", "title": "string", "timestamp": "ISO string", "estimatedMinutes": number }
    ]
  }
]

Generate suggestions now.`
}
