type Activity = {
  source: "calendar" | "gmail" | "slack" | "docs" | "trello"
  type: string
  timestamp: Date
  endTime?: Date
  [key: string]: any
}

type HourData = {
  primaries: Activity[]
  communications: Activity[]
}

function getHourInTimezone(date: Date, timezone: string): number {
  return parseInt(date.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: timezone }))
}

function bucketByHour(activities: Activity[], startHour = 6, endHour = 23, timezone = "UTC") {
  const buckets: Record<number, Activity[]> = {}

  for (let hour = startHour; hour < endHour; hour++) {
    buckets[hour] = []
  }

  for (const activity of activities) {
    if (!activity.timestamp) continue

    const timestamp = new Date(activity.timestamp)
    const hour = getHourInTimezone(timestamp, timezone)

    if (hour < startHour || hour >= endHour) continue

    if (activity.endTime) {
      const endTime = new Date(activity.endTime)
      const endHourCapped = Math.min(getHourInTimezone(endTime, timezone), endHour - 1)

      for (let h = hour; h <= endHourCapped; h++) {
        if (h >= startHour && h < endHour) {
          buckets[h].push({
            ...activity,
            isSpanning: h !== hour,
            spanStart: h === hour,
          })
        }
      }
    } else {
      buckets[hour].push(activity)
    }
  }

  return buckets
}

function normalizeSubject(subject: string) {
  if (!subject) return ""
  return subject
    .replace(/^(re|sv|fwd|fw|aw|antw):\s*/gi, "")
    .replace(/^(re|sv|fwd|fw|aw|antw):\s*/gi, "")
    .trim()
    .toLowerCase()
}

function isCalendarEmail(email: Activity) {
  const from = (email.from || "").toLowerCase()
  return (
    from.includes("calendar-notification@google.com") ||
    from.includes("google calendar") ||
    from.includes("calendar.google.com")
  )
}

function dedupeEmailsByThread(emails: Activity[]) {
  const seen = new Set<string>()
  return emails.filter((email) => {
    const threadKey = normalizeSubject(email.subject)
    if (seen.has(threadKey)) return false
    seen.add(threadKey)
    return true
  })
}

function mergeHourActivities(hourActivities: Activity[]): HourData {
  if (!hourActivities || hourActivities.length === 0) {
    return { primaries: [], communications: [] }
  }

  const calendar = hourActivities.filter((a) => a.source === "calendar")
  const slack = hourActivities.filter((a) => a.source === "slack")
  const gmail = hourActivities.filter((a) => a.source === "gmail")
  const docs = hourActivities.filter((a) => a.source === "docs")
  const trello = hourActivities.filter((a) => a.source === "trello")

  const primaries = calendar

  const filteredEmails = dedupeEmailsByThread(
    gmail.filter((email) => !isCalendarEmail(email))
  )

  const communications = [...slack, ...filteredEmails, ...docs, ...trello].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  return { primaries, communications }
}

export function processActivities(activities: Activity[], startHour = 6, endHour = 23, timezone = "UTC") {
  const buckets = bucketByHour(activities, startHour, endHour, timezone)
  const processed: Record<number, HourData> = {}

  for (const [hour, hourActivities] of Object.entries(buckets)) {
    processed[Number(hour)] = mergeHourActivities(hourActivities)
  }

  return processed
}

export function getDaySummary(hourlyData: Record<number, HourData>) {
  let totalMeetings = 0
  let totalSlackMessages = 0
  let totalEmails = 0
  let totalDocEdits = 0
  let totalTrelloActivities = 0

  for (const hourData of Object.values(hourlyData)) {
    totalMeetings += (hourData.primaries || []).filter((p: any) => !p.isSpanning).length
    totalSlackMessages += hourData.communications.filter((c) => c.source === "slack").length
    totalEmails += hourData.communications.filter((c) => c.source === "gmail").length
    totalDocEdits += hourData.communications.filter((c) => c.source === "docs").length
    totalTrelloActivities += hourData.communications.filter((c) => c.source === "trello").length
  }

  return {
    totalMeetings,
    totalSlackMessages,
    totalEmails,
    totalDocEdits,
    totalTrelloActivities,
  }
}
