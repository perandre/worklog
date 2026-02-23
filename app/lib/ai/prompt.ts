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
    : "Ingen allokeringer registrert."

  const activityList = data.activities
    .map((a) => {
      const time = new Date(a.timestamp).toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })
      const dur = a.durationMinutes ? ` (${a.durationMinutes} min)` : ""
      return `- [${time}] [${a.source}] ${a.title}${dur}`
    })
    .join("\n")

  return `Du er en assistent som hjelper med timeføring for norske konsulentselskaper.

REGLER:
- Norsk arbeidsdag er 7,5 timer
- Rund av til nærmeste 0,5 time per prosjekt (minimum 0,5t)
- Skriv beskrivelser på norsk, kundevennlig språk
- Skriv interne notater på norsk, mer detaljert
- Svar KUN med gyldig JSON som matcher skjemaet nedenfor
- Summen av alle timer bør være ~7,5t
- Hvis avrunding gir mer enn 7,5t, trim posten med lavest konfidanse

DATO: ${date}

TILGJENGELIGE PROSJEKTER:
${projectList}

AKTIVITETSTYPER:
${activityTypeList}

ALLOKERINGER (hint for fordeling):
${allocationList}

DAGENS AKTIVITETER:
${activityList}

ANALYSE:
- Kalendertid: ${data.calendarMinutes} minutter
- Tid mellom møter: ${data.gapMinutes} minutter
- Lunsj detektert: ${data.lunchDetected ? "ja (−30 min)" : "nei"}
- Estimert aktiv tid: ${data.totalActiveMinutes} minutter

SKJEMA (returner JSON array):
[
  {
    "projectId": "string",
    "projectName": "string",
    "activityTypeId": "string",
    "activityTypeName": "string",
    "hours": number,
    "description": "Kort, kundevennlig beskrivelse på norsk",
    "internalNote": "Mer detaljert intern notat på norsk",
    "reasoning": "Begrunnelse for forslaget",
    "confidence": "high" | "medium" | "low",
    "sourceActivities": [
      { "source": "string", "title": "string", "timestamp": "ISO string", "estimatedMinutes": number }
    ]
  }
]

Generer forslag nå.`
}
