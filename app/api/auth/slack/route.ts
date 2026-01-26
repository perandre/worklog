import { NextResponse } from "next/server"

export async function GET() {
  const clientId = process.env.SLACK_CLIENT_ID

  if (!clientId) {
    return NextResponse.json({ error: "Slack not configured" }, { status: 500 })
  }

  const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/slack/callback`
  const scopes = ["search:read", "users:read", "im:read"].join(",")

  const slackAuthUrl = new URL("https://slack.com/oauth/v2/authorize")
  slackAuthUrl.searchParams.set("client_id", clientId)
  slackAuthUrl.searchParams.set("user_scope", scopes)
  slackAuthUrl.searchParams.set("redirect_uri", redirectUri)

  return NextResponse.redirect(slackAuthUrl.toString())
}
