import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  const origin = request.nextUrl.origin

  if (error) {
    console.error("Slack OAuth error:", error)
    return NextResponse.redirect(new URL("/?slack_error=" + error, origin))
  }

  const cookieStore = await cookies()
  const savedState = cookieStore.get("slack_oauth_state")?.value

  if (!state || state !== savedState) {
    console.error("[Slack] State mismatch")
    return NextResponse.redirect(new URL("/?slack_error=state_mismatch", origin))
  }

  cookieStore.delete("slack_oauth_state")

  if (!code) {
    return NextResponse.redirect(new URL("/?slack_error=no_code", origin))
  }

  try {
    // Exchange code for token
    const response = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID!,
        client_secret: process.env.SLACK_CLIENT_SECRET!,
        code,
        redirect_uri: `${origin}/api/auth/slack/callback`,
      }),
    })

    const data = await response.json()

    if (!data.ok) {
      console.error("Slack token exchange error:", data.error)
      return NextResponse.redirect(new URL("/?slack_error=" + data.error, origin))
    }

    // Get the user token (not bot token)
    const userToken = data.authed_user?.access_token

    if (!userToken) {
      console.error("No user token in Slack response")
      return NextResponse.redirect(new URL("/?slack_error=no_user_token", origin))
    }

    // Store token in HTTP-only cookie
    cookieStore.set("slack_token", userToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year (Slack user tokens don't expire)
      path: "/",
    })

    console.log("[Slack] OAuth successful, token stored")

    return NextResponse.redirect(new URL("/?slack_connected=true", origin))
  } catch (error) {
    console.error("Slack OAuth error:", error)
    return NextResponse.redirect(new URL("/?slack_error=exchange_failed", origin))
  }
}
