import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/app/lib/auth"
import { getPmAdapter } from "@/app/lib/pm"
import { TimeLogSubmission } from "@/app/lib/types/timelog"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { entries } = body as { entries: (TimeLogSubmission & { id: string })[] }

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: "No entries to submit" }, { status: 400 })
    }

    // Validate each entry
    const dateRe = /^\d{4}-\d{2}-\d{2}$/
    for (const e of entries) {
      if (!e.projectId || !e.activityTypeId || !e.date || !e.hours) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
      }
      if (!dateRe.test(e.date)) {
        return NextResponse.json({ error: "Invalid date format" }, { status: 400 })
      }
      if (typeof e.hours !== "number" || e.hours <= 0 || e.hours > 24) {
        return NextResponse.json({ error: "Invalid hours" }, { status: 400 })
      }
    }

    const adapter = getPmAdapter(session.user?.email ?? undefined)

    // Server-side guard: reject entries for locked dates
    const timeLockDate = await adapter.getTimeLockDate()
    if (timeLockDate) {
      const lockedEntries = entries.filter((e) => e.date <= timeLockDate)
      if (lockedEntries.length > 0) {
        return NextResponse.json(
          { error: `Hours are locked through ${timeLockDate}` },
          { status: 403 }
        )
      }
    }

    const results = await Promise.all(
      entries.map(async (entry) => {
        try {
          const result = await adapter.submitTimeLog({
            projectId: entry.projectId,
            activityTypeId: entry.activityTypeId,
            date: entry.date,
            hours: entry.hours,
            description: entry.description,
            internalNote: entry.internalNote,
          })
          return { entryId: entry.id, ...result }
        } catch (error: any) {
          return { entryId: entry.id, success: false, error: error.message }
        }
      })
    )

    return NextResponse.json({ results })
  } catch (error: any) {
    console.error("Error submitting time logs:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
