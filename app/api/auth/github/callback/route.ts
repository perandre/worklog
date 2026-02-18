import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  if (error) {
    console.error("GitHub OAuth error:", error)
    return NextResponse.redirect(new URL("/?github_error=" + error, process.env.NEXTAUTH_URL))
  }

  if (!code) {
    return NextResponse.redirect(new URL("/?github_error=no_code", process.env.NEXTAUTH_URL))
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
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/github/callback`,
      }),
    })

    const data = await response.json()

    if (data.error) {
      console.error("GitHub token exchange error:", data.error)
      return NextResponse.redirect(new URL("/?github_error=" + data.error, process.env.NEXTAUTH_URL))
    }

    const accessToken = data.access_token

    if (!accessToken) {
      console.error("No access token in GitHub response")
      return NextResponse.redirect(new URL("/?github_error=no_access_token", process.env.NEXTAUTH_URL))
    }

    const cookieStore = await cookies()
    cookieStore.set("github_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    })

    console.log("[GitHub] OAuth successful, token stored")

    return NextResponse.redirect(new URL("/?github_connected=true", process.env.NEXTAUTH_URL))
  } catch (error) {
    console.error("GitHub OAuth error:", error)
    return NextResponse.redirect(new URL("/?github_error=exchange_failed", process.env.NEXTAUTH_URL))
  }
}
