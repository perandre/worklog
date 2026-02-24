import { AiAdapter } from "./adapter"
import { GeminiAdapter } from "./gemini"

export function getAiAdapter(): AiAdapter {
  return new GeminiAdapter()
}
