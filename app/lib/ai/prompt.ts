import { readFileSync } from "fs"
import { join } from "path"
import { PmContext } from "../types/pm"
import { PreprocessedData } from "./preprocess"

const systemPrompt = readFileSync(
  join(process.cwd(), "prompts", "timelog-system.md"),
  "utf-8"
)

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

  const context = `
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
- Estimated active time: ${data.totalActiveMinutes} minutes`

  return systemPrompt.replace("Generate suggestions now.", context + "\n\nGenerate suggestions now.")
}
