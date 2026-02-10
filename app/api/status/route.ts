import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { auth } from "@/app/lib/auth"
import { isConfigured as isSlackConfigured } from "@/app/lib/slack"
import { isConfigured as isTrelloConfigured } from "@/app/lib/trello"

export async function GET() {
  const session = await auth()
  const cookieStore = await cookies()
  const slackToken = cookieStore.get("slack_token")?.value
  const trelloToken = cookieStore.get("trello_token")?.value

  return NextResponse.json({
    google: !!session?.accessToken,
    slack: isSlackConfigured(slackToken),
    trello: isTrelloConfigured({ token: trelloToken }),
  })
}
