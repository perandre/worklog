import { readFileSync } from "fs"
import { join } from "path"
import { PmContext } from "../types/pm"
import { PreprocessedData } from "./preprocess"

const systemPrompt = readFileSync(
  join(process.cwd(), "prompts", "timelog-system.md"),
  "utf-8"
)

export function assemblePrompt(data: PreprocessedData, pmContext: PmContext, date: string): string {
  // Group activity types by project for clarity
  const typesByProject = new Map<string, typeof pmContext.activityTypes>()
  for (const t of pmContext.activityTypes) {
    const pid = t.projectId || "unknown"
    if (!typesByProject.has(pid)) typesByProject.set(pid, [])
    typesByProject.get(pid)!.push(t)
  }

  const projectList = pmContext.projects
    .map((p) => {
      const types = typesByProject.get(p.id) || []
      const typeLines = types.map((t) => `    - ${t.name} (ID: ${t.id})`).join("\n")
      return `- ${p.name} (ID: ${p.id}${p.code ? `, code: ${p.code}` : ""})\n${typeLines}`
    })
    .join("\n")

  const existingLogsList = pmContext.allocations.length > 0
    ? pmContext.allocations.map((a) => `- ${a.projectName}: ${a.allocatedHours}h already logged`).join("\n")
    : "No time logged yet today."

  const activityList = data.activities
    .map((a) => {
      const time = new Date(a.timestamp).toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })
      const dur = a.durationMinutes ? ` (${a.durationMinutes} min)` : ""
      return `- [${time}] [${a.source}] ${a.title}${dur}`
    })
    .join("\n")

  const context = `
DATE: ${date}

PROJECTS AND ACTIVITY TYPES:
${projectList}

ALREADY LOGGED TODAY (avoid double-logging):
${existingLogsList}

TODAY'S ACTIVITIES:
${activityList}

ANALYSIS:
- Calendar time: ${data.calendarMinutes} minutes
- Time between meetings: ${data.gapMinutes} minutes
- Lunch detected: ${data.lunchDetected ? "yes (−30 min)" : "no"}
- Estimated active time: ${data.totalActiveMinutes} minutes`

  return systemPrompt.replace("Generate suggestions now.", context + "\n\nGenerate suggestions now.")
}
