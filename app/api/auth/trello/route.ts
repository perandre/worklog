import { NextResponse } from "next/server"

export async function GET() {
  const apiKey = process.env.TRELLO_API_KEY
  const appName = process.env.TRELLO_APP_NAME || "Worklog"

  if (!apiKey) {
    return NextResponse.json({ error: "Trello not configured" }, { status: 500 })
  }

  // This URL must be on your domain and is where Trello will redirect
  // after the user approves the app. It can read the URL fragment client-side.
  const returnUrl = `${process.env.NEXTAUTH_URL}/trello-auth-complete`

  // Personal-token style authorization flow
  // Docs: https://developer.atlassian.com/cloud/trello/guides/rest-api/authorization/
  const trelloAuthUrl = new URL("https://trello.com/1/authorize")
  trelloAuthUrl.searchParams.set("key", apiKey)
  trelloAuthUrl.searchParams.set("name", appName)
  trelloAuthUrl.searchParams.set("expiration", "never")
  trelloAuthUrl.searchParams.set("response_type", "token")
  trelloAuthUrl.searchParams.set("scope", "read")
  trelloAuthUrl.searchParams.set("callback_method", "fragment")
  trelloAuthUrl.searchParams.set("return_url", returnUrl)

  return NextResponse.redirect(trelloAuthUrl.toString())
}

