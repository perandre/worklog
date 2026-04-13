import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  const origin = request.nextUrl.origin

  if (error) {
    console.error("GitHub OAuth error:", error)
    return NextResponse.redirect(new URL("/?github_error=" + error, origin))
  }

  const cookieStore = await cookies()
  const savedState = cookieStore.get("github_oauth_state")?.value

  if (!state || state !== savedState) {
    console.error("[GitHub] State mismatch")
    return NextResponse.redirect(new URL("/?github_error=state_mismatch", origin))
  }

  cookieStore.delete("github_oauth_state")

  if (!code) {
    return NextResponse.redirect(new URL("/?github_error=no_code", origin))
  }

  try {
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID!,
        client_secret: process.env.GITHUB_CLIENT_SECRET!,
        code,
        redirect_uri: `${origin}/api/auth/github/callback`,
      }),
    })

    const data = await response.json()

    if (data.error) {
      console.error("GitHub token exchange error:", data.error)
      return NextResponse.redirect(new URL("/?github_error=" + data.error, origin))
    }

    const accessToken = data.access_token

    if (!accessToken) {
      console.error("No access token in GitHub response")
      return NextResponse.redirect(new URL("/?github_error=no_access_token", origin))
    }

    cookieStore.set("github_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    })

    console.log("[GitHub] OAuth successful, token stored")

    return NextResponse.redirect(new URL("/?github_connected=true", origin))
  } catch (error) {
    console.error("GitHub OAuth error:", error)
    return NextResponse.redirect(new URL("/?github_error=exchange_failed", origin))
  }
}
