type RawActivity = {
  source: string
  type?: string
  title?: string
  subject?: string
  channel?: string
  text?: string
  cardName?: string
  repoName?: string
  timestamp: string
  endTime?: string
  isDm?: boolean
  [key: string]: any
}

export type FlatActivity = {
  source: string
  title: string
  timestamp: string
  endTime?: string
  durationMinutes?: number
  type?: string
}

export type PreprocessedData = {
  activities: FlatActivity[]
  calendarMinutes: number
  gapMinutes: number
  lunchDetected: boolean
  totalActiveMinutes: number
}

function getActivityTitle(a: RawActivity): string {
  if (a.source === "calendar") return a.title || "Untitled event"
  if (a.source === "gmail") return a.subject || "Untitled email"
  if (a.source === "slack") return `${a.isDm ? "DM" : "#" + a.channel}: ${a.text || ""}`.slice(0, 100)
  if (a.source === "docs") return `${a.type || "Edited"}: ${a.title || "Untitled doc"}`
  if (a.source === "trello") return a.cardName || "Trello activity"
  if (a.source === "github") return `${a.repoName || "GitHub"}: ${a.title || ""}`
  if (a.source === "jira") return `${a.issueKey || "Jira"}: ${a.issueSummary || a.detail || ""}`
  return a.title || "Unknown activity"
}

function minutesBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)
}

export function preprocessActivities(hours: Record<string, any>): PreprocessedData {
  const activities: FlatActivity[] = []
  const seen = new Set<string>()

  for (const [_hour, hourData] of Object.entries(hours)) {
    const all = [...(hourData.primaries || []), ...(hourData.communications || [])]
    for (const a of all) {
      if (a.isSpanning) continue
      const key = `${a.source}-${a.timestamp}-${a.title || a.subject || a.channel || a.cardName || ""}`
      if (seen.has(key)) continue
      seen.add(key)

      const flat: FlatActivity = {
        source: a.source,
        title: getActivityTitle(a),
        timestamp: a.timestamp,
        type: a.type,
      }
      if (a.endTime) {
        flat.endTime = a.endTime
        flat.durationMinutes = minutesBetween(a.timestamp, a.endTime)
      }
      activities.push(flat)
    }
  }

  activities.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  // Cap low-signal sources to keep prompt size manageable
  const SOURCE_CAPS: Record<string, number> = { slack: 5, gmail: 5 }
  const DEFAULT_CAP = 10
  const sourceCounts = new Map<string, number>()
  const capped: FlatActivity[] = []
  for (const a of activities) {
    const cap = SOURCE_CAPS[a.source] ?? DEFAULT_CAP
    const count = sourceCounts.get(a.source) || 0
    if (count < cap) { capped.push(a); sourceCounts.set(a.source, count + 1) }
  }
  activities.length = 0
  capped.forEach((a) => activities.push(a))

  // Compute calendar minutes
  let calendarMinutes = 0
  const calendarEvents = activities.filter((a) => a.source === "calendar" && a.durationMinutes)
  for (const e of calendarEvents) {
    calendarMinutes += e.durationMinutes!
  }

  // Detect lunch: gap around 11-13 with no calendar event
  let lunchDetected = false
  const lunchStart = 11 * 60
  const lunchEnd = 13 * 60
  const dayStart = activities.length > 0 ? new Date(activities[0].timestamp) : null
  if (dayStart) {
    const dayStartMinutes = dayStart.getHours() * 60 + dayStart.getMinutes()
    for (const e of calendarEvents) {
      const eStart = new Date(e.timestamp)
      const eStartMin = eStart.getHours() * 60 + eStart.getMinutes()
      const eEndMin = eStartMin + (e.durationMinutes || 0)
      // If a calendar event covers the entire lunch period, no lunch gap
      if (eStartMin <= lunchStart && eEndMin >= lunchEnd) {
        lunchDetected = false
        break
      }
    }
    // Check for gap in the lunch window
    const lunchActivities = activities.filter((a) => {
      const h = new Date(a.timestamp).getHours()
      return h >= 11 && h < 13
    })
    if (lunchActivities.length === 0 && dayStartMinutes < lunchStart) {
      lunchDetected = true
    }
  }

  // Compute gaps between calendar events
  let gapMinutes = 0
  for (let i = 0; i < calendarEvents.length - 1; i++) {
    const endCurrent = new Date(calendarEvents[i].endTime!).getTime()
    const startNext = new Date(calendarEvents[i + 1].timestamp).getTime()
    const gap = (startNext - endCurrent) / 60000
    if (gap > 0) gapMinutes += gap
  }

  const lunchDeduction = lunchDetected ? 30 : 0
  const totalActiveMinutes = Math.max(0, calendarMinutes + gapMinutes - lunchDeduction)

  return {
    activities,
    calendarMinutes,
    gapMinutes,
    lunchDetected,
    totalActiveMinutes,
  }
}
