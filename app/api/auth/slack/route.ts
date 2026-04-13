import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  const clientId = process.env.SLACK_CLIENT_ID

  if (!clientId) {
    return NextResponse.json({ error: "Slack not configured" }, { status: 500 })
  }

  const redirectUri = `${request.nextUrl.origin}/api/auth/slack/callback`
  const scopes = ["search:read", "users:read", "im:read"].join(",")
  const state = crypto.randomUUID()

  const cookieStore = await cookies()
  cookieStore.set("slack_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  })

  const slackAuthUrl = new URL("https://slack.com/oauth/v2/authorize")
  slackAuthUrl.searchParams.set("client_id", clientId)
  slackAuthUrl.searchParams.set("user_scope", scopes)
  slackAuthUrl.searchParams.set("redirect_uri", redirectUri)
  slackAuthUrl.searchParams.set("state", state)

  return NextResponse.redirect(slackAuthUrl.toString())
}
