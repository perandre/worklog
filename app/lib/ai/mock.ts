import { AiAdapter } from "./adapter"
import { PmContext } from "../types/pm"
import { FlatActivity, PreprocessedData } from "./preprocess"

type ProjectMatch = {
  projectId: string
  projectName: string
  activityTypeId: string
  activityTypeName: string
  activities: FlatActivity[]
  totalMinutes: number
}

const KEYWORDS: Record<string, string[]> = {
  "Prosjekt Alfa": ["alfa", "sprint", "planlegging", "planning", "standup", "retro"],
  "DevApp": ["dev", "frontend", "backend", "react", "component", "layout", "code", "PR", "pull request", "commit", "github"],
  "Kundeportal": ["kunde", "portal", "customer", "client", "demo"],
  "Intern/Admin": ["admin", "intern", "lunsj", "lunch", "1:1", "one-on-one", "all-hands", "weekly", "status"],
  "Salg og marked": ["salg", "sale", "marked", "marketing", "pitch", "proposal"],
  "Opplæring": ["opplæring", "training", "kurs", "course", "onboarding"],
}

function matchProject(activity: FlatActivity, projects: PmContext["projects"]): string | null {
  const text = activity.title.toLowerCase()
  for (const [projectName, keywords] of Object.entries(KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw.toLowerCase())) {
        const project = projects.find((p) => p.name === projectName)
        if (project) return project.id
      }
    }
  }
  return null
}

function guessActivityType(activities: FlatActivity[], activityTypes: PmContext["activityTypes"]): { id: string; name: string } {
  const hasCalendar = activities.some((a) => a.source === "calendar")
  const hasDocs = activities.some((a) => a.source === "docs")
  const hasCode = activities.some((a) => a.source === "github")
  const hasSlack = activities.some((a) => a.source === "slack")

  if (hasCode) {
    const dev = activityTypes.find((t) => t.name === "Utvikling")
    if (dev) return { id: dev.id, name: dev.name }
  }
  if (hasDocs && !hasCalendar) {
    const doc = activityTypes.find((t) => t.name === "Dokumentasjon")
    if (doc) return { id: doc.id, name: doc.name }
  }
  if (hasCalendar) {
    const meeting = activityTypes.find((t) => t.name === "Møter")
    if (meeting) return { id: meeting.id, name: meeting.name }
  }

  const fallback = activityTypes[0]
  return { id: fallback.id, name: fallback.name }
}

function roundToHalf(n: number): number {
  return Math.max(0.5, Math.round(n * 2) / 2)
}

function generateDescription(activities: FlatActivity[]): { no: string; en: string } {
  const partsNo: string[] = []
  const partsEn: string[] = []
  const calEvents = activities.filter((a) => a.source === "calendar")
  const docs = activities.filter((a) => a.source === "docs")
  const code = activities.filter((a) => a.source === "github")
  const slack = activities.filter((a) => a.source === "slack")

  if (calEvents.length > 0) {
    const titles = calEvents.map((e) => e.title).slice(0, 2).join(", ")
    partsNo.push(titles)
    partsEn.push(titles)
  }
  if (code.length > 0) {
    partsNo.push("utvikling")
    partsEn.push("development")
  }
  if (docs.length > 0) {
    partsNo.push("dokumentarbeid")
    partsEn.push("documentation work")
  }
  if (slack.length > 0 && partsNo.length === 0) {
    partsNo.push("kommunikasjon og oppfølging")
    partsEn.push("communication and follow-up")
  }

  return {
    no: partsNo.join(", ").replace(/^./, (s) => s.toUpperCase()) || "Diverse arbeid",
    en: partsEn.join(", ").replace(/^./, (s) => s.toUpperCase()) || "Miscellaneous work",
  }
}

function generateInternalNote(activities: FlatActivity[]): string {
  const items = activities.slice(0, 4).map((a) => {
    const source = a.source === "calendar" ? "Møte" :
      a.source === "slack" ? "Slack" :
      a.source === "docs" ? "Dok" :
      a.source === "github" ? "GitHub" :
      a.source === "gmail" ? "E-post" : a.source
    return `${source}: ${a.title.slice(0, 50)}`
  })
  return items.join(". ")
}

export class MockAiAdapter implements AiAdapter {
  name = "mock"

  async generateSuggestions(prompt: string, _schema: object): Promise<string> {
    // We don't use the prompt directly in mock mode — instead, we receive the data via generateFromData
    return "[]"
  }

  generateFromData(data: PreprocessedData, pmContext: PmContext): string {
    const { activities } = data
    const { projects, activityTypes, allocations } = pmContext

    // Group activities by matched project
    const groups = new Map<string, FlatActivity[]>()
    const unmatched: FlatActivity[] = []

    for (const activity of activities) {
      const projectId = matchProject(activity, projects)
      if (projectId) {
        const existing = groups.get(projectId) || []
        existing.push(activity)
        groups.set(projectId, existing)
      } else {
        unmatched.push(activity)
      }
    }

    // Assign unmatched to "Intern/Admin" if it exists, otherwise first project
    const adminProject = projects.find((p) => p.name === "Intern/Admin") || projects[0]
    if (unmatched.length > 0) {
      const existing = groups.get(adminProject.id) || []
      existing.push(...unmatched)
      groups.set(adminProject.id, existing)
    }

    // Build suggestions
    const suggestions: any[] = []
    let totalHours = 0

    for (const [projectId, projectActivities] of groups) {
      const project = projects.find((p) => p.id === projectId)
      if (!project) continue

      // Calculate minutes for this project
      let minutes = 0
      for (const a of projectActivities) {
        if (a.durationMinutes) {
          minutes += a.durationMinutes
        } else {
          minutes += 15 // Default estimate for non-calendar activities
        }
      }

      const hours = roundToHalf(minutes / 60)
      totalHours += hours

      const actType = guessActivityType(projectActivities, activityTypes)
      const confidence = projectActivities.some((a) => a.source === "calendar") ? "high" : "medium"

      const desc = generateDescription(projectActivities)
      suggestions.push({
        projectId: project.id,
        projectName: project.name,
        activityTypeId: actType.id,
        activityTypeName: actType.name,
        hours,
        description: desc.no,
        descriptionEn: desc.en,
        internalNote: generateInternalNote(projectActivities),
        reasoning: `${projectActivities.length} aktiviteter matchet til dette prosjektet basert på nøkkelord og tidsbruk.`,
        confidence,
        sourceActivities: projectActivities.map((a) => ({
          source: a.source,
          title: a.title,
          timestamp: a.timestamp,
          estimatedMinutes: a.durationMinutes || 15,
        })),
      })
    }

    // Adjust total to ~7.5h
    const target = 7.5
    if (totalHours > target && suggestions.length > 0) {
      // Trim lowest confidence entries
      suggestions.sort((a, b) => {
        const order = { low: 0, medium: 1, high: 2 }
        return (order[a.confidence as keyof typeof order] || 1) - (order[b.confidence as keyof typeof order] || 1)
      })
      let excess = totalHours - target
      for (const s of suggestions) {
        if (excess <= 0) break
        const reduction = Math.min(excess, s.hours - 0.5)
        if (reduction > 0) {
          s.hours = roundToHalf(s.hours - reduction)
          excess -= reduction
        }
      }
    } else if (totalHours < target && suggestions.length > 0) {
      // Add remaining to highest-confidence entry with allocations
      const remaining = target - totalHours
      const allocated = suggestions.find((s) =>
        allocations.some((a) => a.projectId === s.projectId)
      ) || suggestions[0]
      allocated.hours = roundToHalf(allocated.hours + remaining)
    }

    return JSON.stringify(suggestions)
  }
}
