import { PmAdapter } from "./adapter"
import { MockPmAdapter } from "./mock"
import { MilientPmAdapter } from "./milient"

export function getPmAdapter(userEmail?: string): PmAdapter {
  const system = process.env.PM_SYSTEM || "mock"
  switch (system) {
    case "milient":
      if (!userEmail) throw new Error("getPmAdapter: userEmail required for milient")
      return new MilientPmAdapter(userEmail)
    case "mock":
    default:
      return new MockPmAdapter()
  }
}
