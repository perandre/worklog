import { GoogleGenerativeAI } from "@google/generative-ai"
import { AiAdapter } from "./adapter"

const TIMEOUT_MS = 30_000

export class GeminiAdapter implements AiAdapter {
  name = "gemini"
  private model

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error("GEMINI_API_KEY not set")
    const genAI = new GoogleGenerativeAI(apiKey)
    this.model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.3,
      },
    })
  }

  async generateSuggestions(prompt: string, _schema: object): Promise<string> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const result = await this.model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }, { signal: controller.signal } as any)

      const response = result.response
      if (response.promptFeedback?.blockReason) {
        throw new Error(`Gemini blocked: ${response.promptFeedback.blockReason}`)
      }

      const text = response.text()
      if (!text) throw new Error("Gemini returned empty response")
      return text
    } catch (err: any) {
      if (err.name === "AbortError") {
        throw new Error("Gemini timed out after 30s")
      }
      throw err
    } finally {
      clearTimeout(timeout)
    }
  }
}
