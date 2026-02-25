import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { auth } from "@/app/lib/auth"
import { getCalendarEvents, getEmails, getDocActivity } from "@/app/lib/google"
import { getMessages } from "@/app/lib/slack"
import { getTrelloActivitiesForDate } from "@/app/lib/trello"
import { getGitHubActivitiesForDate } from "@/app/lib/github"
import { getJiraActivitiesForDate } from "@/app/lib/jira"
import { processActivities, getDaySummary } from "@/app/lib/aggregator"

export async function GET(request: NextRequest) {
  const session = await auth()
  const cookieStore = await cookies()
  const slackToken = cookieStore.get("slack_token")?.value
  const trelloToken = cookieStore.get("trello_token")?.value
  const githubToken = cookieStore.get("github_token")?.value
  const jiraTokenJson = cookieStore.get("jira_token")?.value

  if (!session?.accessToken) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    )
  }

  if (session.error === "RefreshTokenError") {
    return NextResponse.json(
      { error: "Token expired, please sign in again" },
      { status: 401 }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const date = searchParams.get("date")
  const timezone = searchParams.get("tz") || "UTC"

  if (!date) {
    return NextResponse.json(
      { error: "Date parameter required (YYYY-MM-DD)" },
      { status: 400 }
    )
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "Invalid date format. Use YYYY-MM-DD" },
      { status: 400 }
    )
  }

  try {
    const [calendarEvents, emails, docActivity, slackMessages, trelloActivities, githubActivities, jiraResult] = await Promise.all([
      getCalendarEvents(session.accessToken, date).catch((err) => {
        console.error("Calendar fetch error:", err.message)
        return []
      }),
      getEmails(session.accessToken, date).catch((err) => {
        console.error("Email fetch error:", err.message)
        return []
      }),
      getDocActivity(session.accessToken, date, timezone, session.user?.email || undefined).catch((err) => {
        console.error("Docs fetch error:", err)
        console.error("Docs fetch stack:", err?.stack)
        return []
      }),
      getMessages(date, slackToken).catch((err) => {
        console.error("Slack fetch error:", err.message)
        return []
      }),
      getTrelloActivitiesForDate(date, { token: trelloToken }).catch((err) => {
        console.error("Trello fetch error:", err?.message || err)
        return []
      }),
      getGitHubActivitiesForDate(date, githubToken).catch((err) => {
        console.error("GitHub fetch error:", err?.message || err)
        return []
      }),
      getJiraActivitiesForDate(date, jiraTokenJson).catch((err) => {
        console.error("Jira fetch error:", err?.message || err)
        return { activities: [], updatedTokenJson: null }
      }),
    ])

    const jiraActivities = jiraResult.activities || []
    const allActivities = [...calendarEvents, ...emails, ...docActivity, ...slackMessages, ...trelloActivities, ...githubActivities, ...jiraActivities]
    const hours = processActivities(allActivities, 6, 23, timezone)
    const summary = getDaySummary(hours)

    const response = NextResponse.json({
      date,
      hours,
      summary,
      sources: {
        calendar: calendarEvents.length,
        gmail: emails.length,
        docs: docActivity.length,
        slack: slackMessages.length,
        trello: trelloActivities.length,
        github: githubActivities.length,
        jira: jiraActivities.length,
      },
    })

    // If Jira token was refreshed, update the cookie on the response
    if (jiraResult.updatedTokenJson) {
      response.cookies.set("jira_token", jiraResult.updatedTokenJson, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
      })
    }

    return response
  } catch (error: any) {
    console.error("Error fetching activities:", error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
