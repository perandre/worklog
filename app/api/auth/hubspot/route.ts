import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  const clientId = process.env.HUBSPOT_CLIENT_ID

  if (!clientId) {
    return NextResponse.json({ error: "HubSpot not configured" }, { status: 500 })
  }

  const redirectUri = `${request.nextUrl.origin}/api/auth/hubspot/callback`
  const state = crypto.randomUUID()

  const cookieStore = await cookies()
  cookieStore.set("hubspot_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  })

  const authUrl = new URL("https://app.hubspot.com/oauth/authorize")
  authUrl.searchParams.set("client_id", clientId)
  authUrl.searchParams.set("scope", "crm.objects.deals.read")
  authUrl.searchParams.set("redirect_uri", redirectUri)
  authUrl.searchParams.set("state", state)
  authUrl.searchParams.set("response_type", "code")

  return NextResponse.redirect(authUrl.toString())
}
