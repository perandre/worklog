import { NextResponse } from "next/server"
import { auth } from "@/app/lib/auth"
import { getPmAdapter } from "@/app/lib/pm"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  try {
    const t0 = Date.now()
    const adapter = getPmAdapter(session.user?.email ?? undefined, session.milientUserId)
    const { searchParams } = new URL(request.url)
    const date = searchParams.get("date") || new Date().toISOString().split("T")[0]

    const [projects, activityTypes, allocations, existingRecords, timeLockDate] = await Promise.all([
      adapter.getProjects(),
      adapter.getActivityTypes(),
      adapter.getAllocations(date),
      adapter.getExistingRecords(date),
      adapter.getTimeLockDate(),
    ])

    console.log(`[PM] pm-context ready in ${Date.now() - t0}ms — ${projects.length} projects, ${activityTypes.length} activity types, ${allocations.length} allocations, ${existingRecords.length} existing records`)
    return NextResponse.json({ projects, activityTypes, allocations, existingRecords, timeLockDate })
  } catch (error: any) {
    console.error("Error fetching PM context:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
