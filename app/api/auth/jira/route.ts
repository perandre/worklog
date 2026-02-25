import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET() {
  const clientId = process.env.JIRA_CLIENT_ID

  if (!clientId) {
    return NextResponse.json({ error: "Jira not configured" }, { status: 500 })
  }

  const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/jira/callback`
  const state = crypto.randomUUID()

  const cookieStore = await cookies()
  cookieStore.set("jira_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  })

  const authUrl = new URL("https://auth.atlassian.com/authorize")
  authUrl.searchParams.set("audience", "api.atlassian.com")
  authUrl.searchParams.set("client_id", clientId)
  authUrl.searchParams.set("scope", "read:jira-work read:jira-user offline_access")
  authUrl.searchParams.set("redirect_uri", redirectUri)
  authUrl.searchParams.set("state", state)
  authUrl.searchParams.set("response_type", "code")
  authUrl.searchParams.set("prompt", "consent")

  return NextResponse.redirect(authUrl.toString())
}
