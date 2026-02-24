import { GoogleGenerativeAI } from "@google/generative-ai"
import { AiAdapter } from "./adapter"

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
    const result = await this.model.generateContent(prompt)

    const response = result.response
    if (response.promptFeedback?.blockReason) {
      throw new Error(`Gemini blocked: ${response.promptFeedback.blockReason}`)
    }

    const text = response.text()
    if (!text) throw new Error("Gemini returned empty response")
    return text
  }
}
