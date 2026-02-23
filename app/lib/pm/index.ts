import { PmAdapter } from "./adapter"
import { MockPmAdapter } from "./mock"

export function getPmAdapter(): PmAdapter {
  const system = process.env.PM_SYSTEM || "mock"
  switch (system) {
    case "mock":
    default:
      return new MockPmAdapter()
  }
}
