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
    const text = result.response.text()
    return text
  }
}
