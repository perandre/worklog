import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  if (error) {
    console.error("Slack OAuth error:", error)
    return NextResponse.redirect(new URL("/?slack_error=" + error, process.env.NEXTAUTH_URL))
  }

  if (!code) {
    return NextResponse.redirect(new URL("/?slack_error=no_code", process.env.NEXTAUTH_URL))
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
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/slack/callback`,
      }),
    })

    const data = await response.json()

    if (!data.ok) {
      console.error("Slack token exchange error:", data.error)
      return NextResponse.redirect(new URL("/?slack_error=" + data.error, process.env.NEXTAUTH_URL))
    }

    // Get the user token (not bot token)
    const userToken = data.authed_user?.access_token

    if (!userToken) {
      console.error("No user token in Slack response")
      return NextResponse.redirect(new URL("/?slack_error=no_user_token", process.env.NEXTAUTH_URL))
    }

    // Store token in HTTP-only cookie
    const cookieStore = await cookies()
    cookieStore.set("slack_token", userToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year (Slack user tokens don't expire)
      path: "/",
    })

    console.log("[Slack] OAuth successful, token stored")

    return NextResponse.redirect(new URL("/?slack_connected=true", process.env.NEXTAUTH_URL))
  } catch (error) {
    console.error("Slack OAuth error:", error)
    return NextResponse.redirect(new URL("/?slack_error=exchange_failed", process.env.NEXTAUTH_URL))
  }
}
