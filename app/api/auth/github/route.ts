import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID

  if (!clientId) {
    return NextResponse.json({ error: "GitHub not configured" }, { status: 500 })
  }

  const redirectUri = `${request.nextUrl.origin}/api/auth/github/callback`
  const scope = "repo read:user"
  const state = crypto.randomUUID()

  const cookieStore = await cookies()
  cookieStore.set("github_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  })

  const githubAuthUrl = new URL("https://github.com/login/oauth/authorize")
  githubAuthUrl.searchParams.set("client_id", clientId)
  githubAuthUrl.searchParams.set("scope", scope)
  githubAuthUrl.searchParams.set("redirect_uri", redirectUri)
  githubAuthUrl.searchParams.set("state", state)

  return NextResponse.redirect(githubAuthUrl.toString())
}
