import { NextResponse } from "next/server"
import { auth } from "@/app/lib/auth"
import { getPmAdapter } from "@/app/lib/pm"

export async function GET() {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  try {
    const adapter = getPmAdapter(session.user?.email ?? undefined)
    const today = new Date().toISOString().split("T")[0]

    const [projects, activityTypes, allocations] = await Promise.all([
      adapter.getProjects(),
      adapter.getActivityTypes(),
      adapter.getAllocations(today),
    ])

    return NextResponse.json({ projects, activityTypes, allocations })
  } catch (error: any) {
    console.error("Error fetching PM context:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
