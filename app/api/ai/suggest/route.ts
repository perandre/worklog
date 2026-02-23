import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/app/lib/auth"
import { getAiAdapter } from "@/app/lib/ai"
import { MockAiAdapter } from "@/app/lib/ai/mock"
import { preprocessActivities } from "@/app/lib/ai/preprocess"
import { assemblePrompt } from "@/app/lib/ai/prompt"
import { parseSuggestions } from "@/app/lib/ai/parse"
import { PmContext } from "@/app/lib/types/pm"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { date, hours, pmContext } = body as {
      date: string
      hours: Record<string, any>
      pmContext: PmContext
    }

    if (!date || !hours || !pmContext) {
      return NextResponse.json({ error: "Missing required fields: date, hours, pmContext" }, { status: 400 })
    }

    const preprocessed = preprocessActivities(hours)
    const adapter = getAiAdapter()

    let jsonString: string
    if (adapter instanceof MockAiAdapter) {
      jsonString = adapter.generateFromData(preprocessed, pmContext)
    } else {
      const prompt = assemblePrompt(preprocessed, pmContext, date)
      const schema = { type: "array", items: { type: "object" } }
      jsonString = await adapter.generateSuggestions(prompt, schema)
    }

    const suggestions = parseSuggestions(jsonString)
    const totalHours = suggestions.reduce((sum, s) => sum + s.hours, 0)

    return NextResponse.json({
      suggestions,
      totalHours,
      unaccountedMinutes: Math.max(0, (7.5 * 60) - (totalHours * 60)),
    })
  } catch (error: any) {
    console.error("Error generating suggestions:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
