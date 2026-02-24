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
    const t0 = Date.now()
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
    console.log(`[AI] Preprocess: ${preprocessed.activities.length} activities (${Date.now() - t0}ms)`)

    const adapter = getAiAdapter()

    let jsonString: string
    if (adapter instanceof MockAiAdapter) {
      jsonString = adapter.generateFromData(preprocessed, pmContext)
    } else {
      const prompt = assemblePrompt(preprocessed, pmContext, date)
      console.log(`[AI] Prompt: ${prompt.length} chars, ${pmContext.projects.length} projects, ${pmContext.activityTypes.length} activity types`)

      const t1 = Date.now()
      const schema = { type: "array", items: { type: "object" } }
      jsonString = await adapter.generateSuggestions(prompt, schema)
      console.log(`[AI] Gemini response: ${jsonString.length} chars (${Date.now() - t1}ms)`)
    }

    const suggestions = parseSuggestions(jsonString)
    const totalHours = suggestions.reduce((sum, s) => sum + s.hours, 0)

    console.log(`[AI] Total suggest: ${suggestions.length} suggestions, ${totalHours}h (${Date.now() - t0}ms)`)

    return NextResponse.json({
      suggestions,
      totalHours,
      unaccountedMinutes: Math.max(0, (7.5 * 60) - (totalHours * 60)),
    })
  } catch (error: any) {
    console.error("Error generating suggestions:", error?.message || error)
    return NextResponse.json({ error: error.message || "Unknown error" }, { status: 500 })
  }
}
