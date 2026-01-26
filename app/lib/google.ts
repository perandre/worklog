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
  try {
    console.log(`[Drive] Fetching for ${date}`)
    const auth = getAuthClient(accessToken)
    const driveActivity = google.driveactivity({ version: "v2", auth })

    // Wide date range to cover all timezones
    const startOfDay = new Date(`${date}T00:00:00.000Z`)
    startOfDay.setUTCHours(startOfDay.getUTCHours() - 14)
    const endOfDay = new Date(`${date}T23:59:59.999Z`)
    endOfDay.setUTCHours(endOfDay.getUTCHours() + 14)

    const response = await driveActivity.activity.query({
      requestBody: {
        filter: `time >= "${startOfDay.toISOString()}" AND time <= "${endOfDay.toISOString()}"`,
        consolidationStrategy: { none: {} },
        pageSize: 50,
      },
    })

    const activities = response.data.activities || []
    console.log(`[Drive] API returned ${activities.length} activities`)

    const docEdits: any[] = []

    for (const activity of activities) {
      // Only include activities by the current user
      const isCurrentUser = activity.actors?.some(
        (actor: any) => actor.user?.knownUser?.isCurrentUser === true
      )
      if (!isCurrentUser) continue

      // Get action type
      const action = activity.primaryActionDetail
      if (!action) continue
      const actionType = action.edit ? "edit" : action.comment ? "comment" : action.create ? "create" : null
      if (!actionType) continue

      // Get target
      const target = activity.targets?.[0]?.driveItem
      if (!target || target.mimeType?.includes("folder")) continue

      const timestamp = activity.timestamp
      if (!timestamp) continue

      docEdits.push({
        source: "docs" as const,
        type: actionType,
        title: target.title || "Untitled",
        docId: target.name?.replace("items/", ""),
        timestamp: new Date(timestamp),
      })
    }

    console.log(`[Drive] Found ${docEdits.length} edits by current user`)
    return docEdits
  } catch (error: any) {
    console.error("[Drive] Error:", error?.message || error)
    return []
  }
}
