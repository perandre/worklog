import { google } from "googleapis"

function getAuthClient(accessToken: string) {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  return auth
}

function getTimezoneOffsetMinutes(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
  const parts = formatter.formatToParts(date)
  const value = (type: string) => parts.find((p) => p.type === type)?.value || "00"
  const asUTC = Date.UTC(
    Number(value("year")),
    Number(value("month")) - 1,
    Number(value("day")),
    Number(value("hour")),
    Number(value("minute")),
    Number(value("second"))
  )
  return (asUTC - date.getTime()) / 60000
}

function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  ms: number,
  timeZone: string
) {
  let guess = Date.UTC(year, month - 1, day, hour, minute, second, ms)
  for (let i = 0; i < 2; i += 1) {
    const offsetMinutes = getTimezoneOffsetMinutes(new Date(guess), timeZone)
    const next = Date.UTC(year, month - 1, day, hour, minute, second, ms) - offsetMinutes * 60000
    if (Math.abs(next - guess) < 1000) {
      guess = next
      break
    }
    guess = next
  }
  return new Date(guess)
}

function getZonedDayRange(date: string, timeZone: string) {
  const [year, month, day] = date.split("-").map((part) => Number(part))
  const start = zonedTimeToUtc(year, month, day, 0, 0, 0, 0, timeZone)
  const end = zonedTimeToUtc(year, month, day, 23, 59, 59, 999, timeZone)
  return { start, end }
}

function getActionType(detail: any) {
  if (!detail) return "activity"
  if (detail.edit) return "edit"
  if (detail.create) return "create"
  if (detail.comment) return "comment"
  if (detail.delete) return "delete"
  if (detail.rename) return "rename"
  if (detail.move) return "move"
  if (detail.restore) return "restore"
  if (detail.permissionChange) return "permissionChange"
  if (detail.reference) return "reference"
  const keys = Object.keys(detail)
  return keys[0] || "activity"
}

function extractActivityActors(activity: any) {
  const actors: any[] = []
  if (Array.isArray(activity.actors)) {
    actors.push(...activity.actors)
  }
  return actors
}

function extractActionActors(action: any, fallbackActors: any[]) {
  const actors: any[] = []
  if (action?.actor) actors.push(action.actor)
  if (Array.isArray(action?.actors)) actors.push(...action.actors)
  return actors.length > 0 ? actors : fallbackActors
}

function extractTargets(activity: any, action?: any) {
  if (action?.target) return [action.target]
  if (Array.isArray(action?.targets) && action.targets.length > 0) return action.targets
  return activity.targets || []
}

function extractTimestamp(activity: any, action?: any) {
  return (
    action?.timestamp ||
    action?.timeRange?.endTime ||
    action?.timeRange?.startTime ||
    activity.timestamp ||
    activity.timeRange?.endTime ||
    activity.timeRange?.startTime
  )
}

function getKnownUser(actor: any) {
  return actor?.user?.knownUser || actor?.impersonation?.impersonatedUser?.knownUser
}

function isActorCurrentUser(actor: any, myPeopleId?: string) {
  const knownUser = getKnownUser(actor)
  if (!knownUser) return false
  if (knownUser.isCurrentUser === true) return true
  return !!(myPeopleId && knownUser.personName === myPeopleId)
}

export async function getCalendarEvents(accessToken: string, date: string) {
  console.log(`[Calendar] Fetching events for ${date}`)
  const auth = getAuthClient(accessToken)
  const calendar = google.calendar({ version: "v3", auth })

  const startOfDay = new Date(date + "T00:00:00")
  const endOfDay = new Date(date + "T23:59:59.999")

  const response = await calendar.events.list({
    calendarId: "primary",
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
  })

  const events = (response.data.items || []).map((event) => ({
    source: "calendar" as const,
    type: "meeting" as const,
    title: event.summary || "(No title)",
    description: event.description || "",
    timestamp: new Date(event.start?.dateTime || event.start?.date || ""),
    endTime: new Date(event.end?.dateTime || event.end?.date || ""),
    attendees: (event.attendees || []).map((a) => a.email || ""),
  }))
  console.log(`[Calendar] Found ${events.length} events`)
  return events
}

export async function getEmails(accessToken: string, date: string) {
  console.log(`[Gmail] Fetching emails for ${date}`)
  const auth = getAuthClient(accessToken)
  const gmail = google.gmail({ version: "v1", auth })

  const dateObj = new Date(date + "T12:00:00")
  const year = dateObj.getFullYear()
  const month = String(dateObj.getMonth() + 1).padStart(2, "0")
  const day = String(dateObj.getDate()).padStart(2, "0")

  const afterDate = `${year}/${month}/${day}`
  const nextDay = new Date(dateObj)
  nextDay.setDate(nextDay.getDate() + 1)
  const beforeDate = `${nextDay.getFullYear()}/${String(nextDay.getMonth() + 1).padStart(2, "0")}/${String(nextDay.getDate()).padStart(2, "0")}`

  const query = `after:${afterDate} before:${beforeDate} is:read`

  const response = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults: 50,
  })

  if (!response.data.messages) return []

  const emails = await Promise.all(
    response.data.messages.map(async (msg) => {
      try {
        const detail = await gmail.users.messages.get({
          userId: "me",
          id: msg.id!,
          format: "metadata",
          metadataHeaders: ["Subject", "From", "To", "Date"],
        })

        const headers = detail.data.payload?.headers || []
        const getHeader = (name: string) =>
          headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || ""

        return {
          source: "gmail" as const,
          type: "email" as const,
          subject: getHeader("Subject") || "(No subject)",
          from: getHeader("From"),
          to: getHeader("To"),
          timestamp: new Date(getHeader("Date")),
          snippet: detail.data.snippet || "",
        }
      } catch (error) {
        console.error(`Error fetching email ${msg.id}:`, error)
        return null
      }
    })
  )

  const result = emails.filter((e): e is NonNullable<typeof e> => e !== null)
  console.log(`[Gmail] Found ${result.length} emails`)
  return result
}

export async function getDocActivity(accessToken: string, date: string, timezone = "UTC", userEmail?: string) {
  try {
    console.log(`[Drive] Fetching activity for ${date} (${timezone})`)
    const auth = getAuthClient(accessToken)
    const driveActivity = google.driveactivity({ version: "v2", auth })
    const { start, end } = getZonedDayRange(date, timezone)
    const filter = `detail.action_detail_case:(EDIT CREATE COMMENT) time >= "${start.toISOString()}" AND time <= "${end.toISOString()}"`
    const debugEnabled = process.env.DEBUG_DRIVE_ACTIVITY === "1"

    let myPeopleId: string | undefined
    try {
      const people = google.people({ version: "v1", auth })
      const meResponse = await people.people.get({
        resourceName: "people/me",
        personFields: "metadata",
      })
      myPeopleId = meResponse.data.resourceName || undefined
    } catch (error: any) {
      console.warn("[Drive] Unable to resolve people/me:", error?.message || error)
    }

    const drive = google.drive({ version: "v3", auth })
    let sharedDrives: { id?: string | null; name?: string | null }[] = []
    try {
      let drivePageToken: string | undefined
      do {
        const driveResponse = await drive.drives.list({
          pageSize: 100,
          pageToken: drivePageToken,
          fields: "nextPageToken, drives(id, name)",
        })
        sharedDrives = sharedDrives.concat(driveResponse.data.drives || [])
        drivePageToken = driveResponse.data.nextPageToken || undefined
      } while (drivePageToken)
    } catch (error: any) {
      console.warn("[Drive] Unable to list shared drives:", error?.message || error)
    }

    const ancestorNames = [
      "items/root",
      ...sharedDrives
        .map((driveItem) => driveItem.id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
        .map((id) => `items/${id}`),
    ]

    let activities: any[] = []
    for (const ancestorName of ancestorNames) {
      let pageToken: string | undefined
      do {
        const response = await driveActivity.activity.query({
          requestBody: {
            ancestorName,
            filter,
            pageSize: 200,
            pageToken,
            consolidationStrategy: { none: {} },
          },
        })
        activities = activities.concat(response.data.activities || [])
        pageToken = response.data.nextPageToken || undefined
      } while (pageToken)

      if (debugEnabled) {
        console.log(`[Drive] Ancestor ${ancestorName} returned ${(activities || []).length} total activities so far`)
      }
    }

    console.log(`[Drive] API returned ${activities.length} activities for ${date}`)
    if (debugEnabled) {
      const sample = activities.slice(0, 5).map((activity) => ({
        primaryAction: Object.keys(activity.primaryActionDetail || {})[0],
        timestamp: activity.timestamp,
        timeRange: activity.timeRange,
        actors: extractActivityActors(activity).map((actor: any) => ({
          type: Object.keys(actor || {})[0],
          isCurrentUser: getKnownUser(actor)?.isCurrentUser,
          personName: getKnownUser(actor)?.personName,
          deletedUser: !!actor.user?.deletedUser,
          anonymized: !!actor.user?.unknownUser,
        })),
        targets: (activity.targets || []).map((target: any) => ({
          title: target?.driveItem?.title,
          mimeType: target?.driveItem?.mimeType,
        })),
      }))
      console.log("[Drive] Debug sample:", JSON.stringify(sample, null, 2))
      console.log(`[Drive] Debug filter: ${filter}`)
    }
    const results: any[] = []

    for (const activity of activities) {
      const actions = Array.isArray(activity.actions) && activity.actions.length > 0
        ? activity.actions
        : [undefined]

      const activityActors = extractActivityActors(activity)

      for (const action of actions) {
        const actionActors = extractActionActors(action, activityActors)
        if (actionActors.length === 0) continue
        const isCurrentUser = actionActors.some((actor: any) => isActorCurrentUser(actor, myPeopleId))
        if (!isCurrentUser) continue

        const timestampRaw = extractTimestamp(activity, action)
        if (!timestampRaw) continue
        const timestamp = new Date(timestampRaw)

        const actionDetail = action?.detail || activity.primaryActionDetail
        const actionType = getActionType(actionDetail)

        const targets = extractTargets(activity, action)
        for (const target of targets) {
          const driveItem = target?.driveItem
          if (!driveItem) continue
          if (driveItem.mimeType?.includes("folder")) continue

          const entry = {
            source: "docs" as const,
            type: actionType,
            title: driveItem.title || "Untitled",
            docId: driveItem.name?.replace("items/", "") || "",
            timestamp,
          }
          results.push(entry)
        }
      }
    }

    if (!myPeopleId) {
      console.warn("[Drive] No people/me id available; cannot match actors reliably.")
    }
    if (results.length === 0) {
      console.warn("[Drive] No matching activities for current user. Enable DEBUG_DRIVE_ACTIVITY=1 to inspect.")
    }

    // Dedupe by doc + action + hour
    const seen = new Set<string>()
    const deduped = results.filter((edit) => {
      const hour = parseInt(edit.timestamp.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: timezone }))
      const key = `${edit.docId}-${edit.type}-${hour}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    console.log(`[Drive] Found ${deduped.length} activities for ${date}`)
    return deduped
  } catch (error: any) {
    console.error("[Drive] Error:", error?.message)
    return []
  }
}
