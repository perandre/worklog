import { NextResponse } from "next/server"

export async function GET() {
  const clientId = process.env.GITHUB_CLIENT_ID

  if (!clientId) {
    return NextResponse.json({ error: "GitHub not configured" }, { status: 500 })
  }

  const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/github/callback`
  const scope = "repo read:user"

  const githubAuthUrl = new URL("https://github.com/login/oauth/authorize")
  githubAuthUrl.searchParams.set("client_id", clientId)
  githubAuthUrl.searchParams.set("scope", scope)
  githubAuthUrl.searchParams.set("redirect_uri", redirectUri)

  return NextResponse.redirect(githubAuthUrl.toString())
}
