import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  if (error) {
    console.error("[Jira] OAuth error:", error)
    return NextResponse.redirect(new URL("/?jira_error=" + error, process.env.NEXTAUTH_URL))
  }

  const cookieStore = await cookies()
  const savedState = cookieStore.get("jira_oauth_state")?.value

  if (!state || state !== savedState) {
    console.error("[Jira] State mismatch")
    return NextResponse.redirect(new URL("/?jira_error=state_mismatch", process.env.NEXTAUTH_URL))
  }

  cookieStore.delete("jira_oauth_state")

  if (!code) {
    return NextResponse.redirect(new URL("/?jira_error=no_code", process.env.NEXTAUTH_URL))
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://auth.atlassian.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: process.env.JIRA_CLIENT_ID!,
        client_secret: process.env.JIRA_CLIENT_SECRET!,
        code,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/jira/callback`,
      }),
    })

    if (!tokenRes.ok) {
      const body = await tokenRes.text()
      console.error("[Jira] Token exchange failed", tokenRes.status, body)
      return NextResponse.redirect(new URL("/?jira_error=exchange_failed", process.env.NEXTAUTH_URL))
    }

    const tokenData = await tokenRes.json()

    // Fetch accessible resources to get cloudId + siteUrl
    const resourcesRes = await fetch("https://api.atlassian.com/oauth/token/accessible-resources", {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: "application/json" },
    })

    if (!resourcesRes.ok) {
      console.error("[Jira] Failed to fetch accessible resources", resourcesRes.status)
      return NextResponse.redirect(new URL("/?jira_error=no_resources", process.env.NEXTAUTH_URL))
    }

    const resources = await resourcesRes.json()
    if (!resources.length) {
      console.error("[Jira] No accessible Jira sites")
      return NextResponse.redirect(new URL("/?jira_error=no_sites", process.env.NEXTAUTH_URL))
    }

    const site = resources[0]
    const jiraToken = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      cloudId: site.id,
      siteUrl: site.url,
      expiresAt: Date.now() + tokenData.expires_in * 1000,
    }

    const encodedToken = Buffer.from(JSON.stringify(jiraToken)).toString("base64")

    console.log(`[Jira] OAuth successful, connected to ${site.name} (${site.url}), cookie length: ${encodedToken.length}`)

    const response = NextResponse.redirect(new URL("/?jira_connected=true", process.env.NEXTAUTH_URL))
    response.cookies.set("jira_token", encodedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    })
    return response
  } catch (error) {
    console.error("[Jira] OAuth error:", error)
    return NextResponse.redirect(new URL("/?jira_error=exchange_failed", process.env.NEXTAUTH_URL))
  }
}
