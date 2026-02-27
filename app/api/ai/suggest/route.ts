import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/app/lib/auth"
import { getAiAdapter } from "@/app/lib/ai"
import { PreprocessedData } from "@/app/lib/ai/preprocess"
import { assemblePrompt } from "@/app/lib/ai/prompt"
import { parseSuggestions } from "@/app/lib/ai/parse"
import { PmContext } from "@/app/lib/types/pm"
import { writeFileSync } from "fs"
import { join } from "path"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  try {
    const t0 = Date.now()
    const body = await request.json()
    const { date, preprocessed, pmContext } = body as {
      date: string
      preprocessed: PreprocessedData
      pmContext: PmContext
    }

    if (!date || !preprocessed || !pmContext) {
      return NextResponse.json({ error: "Missing required fields: date, preprocessed, pmContext" }, { status: 400 })
    }

    const adapter = getAiAdapter()
    const prompt = assemblePrompt(preprocessed, pmContext, date)
    const wordCount = prompt.split(/\s+/).filter(Boolean).length
    const estTokens = Math.round(wordCount * 1.33)
    console.log(`[AI] LLM input: ${preprocessed.activities.length} timeline events | ${pmContext.projects.length} Moment projects | ${pmContext.activityTypes.length} activity types → ~${estTokens} tokens (~${wordCount} words)`)

    const debugDir = join(process.cwd(), "tmp")
    writeFileSync(join(debugDir, "ai-input.txt"), prompt, "utf-8")

    const t1 = Date.now()
    const schema = { type: "array", items: { type: "object" } }
    const jsonString = await adapter.generateSuggestions(prompt, schema)
    console.log(`[AI] Response: ${jsonString.length} chars (${Date.now() - t1}ms)`)

    writeFileSync(join(debugDir, "ai-output.txt"), jsonString, "utf-8")

    const projectMap = new Map(pmContext.projects.map((p) => [p.id, p.name]))
    const activityMap = new Map(pmContext.activityTypes.map((t) => [t.id, t.name]))

    const suggestions = parseSuggestions(jsonString).map((s) => ({
      ...s,
      projectName: projectMap.get(s.projectId) ?? s.projectId,
      activityTypeName: activityMap.get(s.activityTypeId) ?? s.activityTypeId,
    }))
    const totalHours = suggestions.reduce((sum, s) => sum + s.hours, 0)
    console.log(`[AI] ${suggestions.length} suggestions, ${totalHours}h total (${Date.now() - t0}ms)`)

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
