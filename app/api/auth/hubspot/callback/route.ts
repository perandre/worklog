import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { encodeCookie } from "@/app/lib/hubspot"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  if (error) {
    console.error("[HubSpot] OAuth error:", error)
    return NextResponse.redirect(new URL("/?hubspot_error=" + error, process.env.NEXTAUTH_URL))
  }

  const cookieStore = await cookies()
  const savedState = cookieStore.get("hubspot_oauth_state")?.value

  if (!state || state !== savedState) {
    console.error("[HubSpot] State mismatch")
    return NextResponse.redirect(new URL("/?hubspot_error=state_mismatch", process.env.NEXTAUTH_URL))
  }

  cookieStore.delete("hubspot_oauth_state")

  if (!code) {
    return NextResponse.redirect(new URL("/?hubspot_error=no_code", process.env.NEXTAUTH_URL))
  }

  try {
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/hubspot/callback`

    // Exchange code for tokens
    const tokenRes = await fetch("https://api.hubapi.com/oauth/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.HUBSPOT_CLIENT_ID!,
        client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
        code,
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenRes.ok) {
      const body = await tokenRes.text()
      console.error("[HubSpot] Token exchange failed", tokenRes.status, body)
      return NextResponse.redirect(new URL("/?hubspot_error=exchange_failed", process.env.NEXTAUTH_URL))
    }

    const tokenData = await tokenRes.json()

    // Get portal ID from token info endpoint
    const infoRes = await fetch(`https://api.hubapi.com/oauth/v1/access-tokens/${tokenData.access_token}`)
    if (!infoRes.ok) {
      console.error("[HubSpot] Failed to fetch token info", infoRes.status)
      return NextResponse.redirect(new URL("/?hubspot_error=no_portal", process.env.NEXTAUTH_URL))
    }

    const info = await infoRes.json()
    const portalId = info.hub_id

    const cookiePayload = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: Date.now() + tokenData.expires_in * 1000,
      portalId,
    }

    const encoded = encodeCookie(JSON.stringify(cookiePayload))
    console.log(`[HubSpot] OAuth successful, portal ${portalId}, cookie length: ${encoded.length}`)

    const response = NextResponse.redirect(new URL("/?hubspot_connected=true", process.env.NEXTAUTH_URL))
    response.cookies.set("hubspot_token", encoded, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    })
    return response
  } catch (err) {
    console.error("[HubSpot] OAuth error:", err)
    return NextResponse.redirect(new URL("/?hubspot_error=exchange_failed", process.env.NEXTAUTH_URL))
  }
}
