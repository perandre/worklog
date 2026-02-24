import { NextResponse } from "next/server"
import { auth } from "@/app/lib/auth"
import { getPmAdapter } from "@/app/lib/pm"

export async function GET() {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  try {
    const t0 = Date.now()
    const adapter = getPmAdapter(session.user?.email ?? undefined)
    const today = new Date().toISOString().split("T")[0]

    const [projects, activityTypes, allocations, timeLockDate] = await Promise.all([
      adapter.getProjects().then((r) => { console.log(`[PM] getProjects: ${r.length} items (${Date.now() - t0}ms)`); return r }),
      adapter.getActivityTypes().then((r) => { console.log(`[PM] getActivityTypes: ${r.length} items (${Date.now() - t0}ms)`); return r }),
      adapter.getAllocations(today).then((r) => { console.log(`[PM] getAllocations: ${r.length} items (${Date.now() - t0}ms)`); return r }),
      adapter.getTimeLockDate().then((r) => { console.log(`[PM] getTimeLockDate: ${r} (${Date.now() - t0}ms)`); return r }),
    ])

    console.log(`[PM] Total pm-context: ${Date.now() - t0}ms`)
    return NextResponse.json({ projects, activityTypes, allocations, timeLockDate })
  } catch (error: any) {
    console.error("Error fetching PM context:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
