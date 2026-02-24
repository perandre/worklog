import { AiAdapter } from "./adapter"
import { MockAiAdapter } from "./mock"
import { GeminiAdapter } from "./gemini"

export function getAiAdapter(): AiAdapter {
  const provider = process.env.AI_PROVIDER || "gemini"
  switch (provider) {
    case "gemini":
      return new GeminiAdapter()
    case "mock":
    default:
      return new MockAiAdapter()
  }
}
