import { AiAdapter } from "./adapter"
import { MockAiAdapter } from "./mock"

export function getAiAdapter(): AiAdapter {
  const provider = process.env.AI_PROVIDER || "mock"
  switch (provider) {
    case "mock":
    default:
      return new MockAiAdapter()
  }
}
