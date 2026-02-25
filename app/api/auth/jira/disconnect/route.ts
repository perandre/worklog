import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { auth } from "@/app/lib/auth"

export async function POST() {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  const cookieStore = await cookies()
  cookieStore.delete("jira_token")

  return NextResponse.json({ success: true })
}
