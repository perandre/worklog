import { NextResponse } from "next/server"
import { auth } from "@/app/lib/auth"
import { isConfigured as isSlackConfigured } from "@/app/lib/slack"

export async function GET() {
  const session = await auth()

  return NextResponse.json({
    google: !!session?.accessToken,
    slack: isSlackConfigured(),
  })
}
