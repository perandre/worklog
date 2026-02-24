import { PmAdapter } from "./adapter"
import { MockPmAdapter } from "./mock"
import { MilientPmAdapter } from "./milient"

export function getPmAdapter(): PmAdapter {
  const system = process.env.PM_SYSTEM || "mock"
  switch (system) {
    case "milient":
      return new MilientPmAdapter()
    case "mock":
    default:
      return new MockPmAdapter()
  }
}
