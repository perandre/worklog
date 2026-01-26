import { google } from "googleapis"

function getAuthClient(accessToken: string) {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  return auth
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
  console.log(`[Drive Activity] START - ${date} (${timezone}) user: ${userEmail}`)

  if (!accessToken) {
    console.error("[Drive Activity] No access token!")
    return []
  }
  const auth = getAuthClient(accessToken)
  const driveActivity = google.driveactivity({ version: "v2", auth })

  // Create date in user's timezone, then convert to UTC for API filter
  const localMidnight = new Date(`${date}T00:00:00`)
  const localEndOfDay = new Date(`${date}T23:59:59.999`)

  // Get timezone offset and adjust
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "shortOffset" })
  const tzParts = formatter.formatToParts(localMidnight)
  const offsetStr = tzParts.find(p => p.type === "timeZoneName")?.value || "+00:00"
  const offsetMatch = offsetStr.match(/GMT([+-]\d+)?/)
  const offsetHours = offsetMatch?.[1] ? parseInt(offsetMatch[1]) : 0

  const startOfDay = new Date(localMidnight.getTime() - offsetHours * 60 * 60 * 1000)
  const endOfDay = new Date(localEndOfDay.getTime() - offsetHours * 60 * 60 * 1000)

  try {
    let allActivities: any[] = []
    let pageToken: string | undefined

    do {
      console.log(`[Drive Activity] Querying API: ${startOfDay.toISOString()} to ${endOfDay.toISOString()}`)
      const response = await driveActivity.activity.query({
        requestBody: {
          filter: `time >= "${startOfDay.toISOString()}" AND time <= "${endOfDay.toISOString()}"`,
          consolidationStrategy: { none: {} },
          pageSize: 100,
          pageToken,
        },
      })

      allActivities = allActivities.concat(response.data.activities || [])
      pageToken = response.data.nextPageToken || undefined
    } while (pageToken)

    console.log(`[Drive Activity] Fetched ${allActivities.length} activities`)

    // Log activities with actors for debugging
    if (allActivities.length > 0) {
      const summary = allActivities.slice(0, 3).map((a: any) => ({
        action: Object.keys(a.primaryActionDetail || {})[0],
        target: a.targets?.[0]?.driveItem?.title,
        actors: a.actors?.map((actor: any) => actor.user?.knownUser || actor.user?.deletedUser || "unknown"),
        isCurrentUser: a.actors?.some((actor: any) => actor.user?.knownUser?.isCurrentUser),
      }))
      console.log(`[Drive Activity] Sample:`, JSON.stringify(summary, null, 2))
    }

    const docEdits: any[] = []

    for (const activity of allActivities) {
      // Filter to only activities by the current user
      if (userEmail) {
        const isUserActivity = activity.actors?.some((actor: any) =>
          actor.user?.knownUser?.personName?.includes(userEmail) ||
          actor.user?.knownUser?.isCurrentUser === true
        )
        if (!isUserActivity) {
          continue
        }
      }

      const action = activity.primaryActionDetail
      if (!action) continue

      const actionType = action.edit
        ? "edit"
        : action.comment
          ? "comment"
          : action.create
            ? "create"
            : action.delete
              ? "delete"
              : action.rename
                ? "rename"
                : action.move
                  ? "move"
                  : null
      if (!actionType) continue

      for (const target of activity.targets || []) {
        if (!target?.driveItem) continue

        const driveItem = target.driveItem
        if (driveItem.mimeType?.includes("folder")) continue

        const timestamp = activity.timestamp
        if (!timestamp) continue

        docEdits.push({
          source: "docs" as const,
          type: actionType,
          title: driveItem.title || "Untitled",
          docId: driveItem.name?.replace("items/", ""),
          timestamp: new Date(timestamp),
        })
      }
    }

    // Dedupe by title + hour (in user's timezone)
    const seen = new Set<string>()
    const result = docEdits.filter((edit) => {
      const hour = parseInt(edit.timestamp.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: timezone }))
      const key = `${edit.title}-${hour}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    console.log(`[Drive Activity] Found ${result.length} doc edits after dedupe`)
    return result
  } catch (error: any) {
    console.error("[Drive Activity] ERROR:", error?.message || error)
    console.error("[Drive Activity] Full error:", JSON.stringify(error, Object.getOwnPropertyNames(error)))
    return []
  }
}
