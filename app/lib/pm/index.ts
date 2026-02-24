import { PmAdapter } from "./adapter"
import { MilientPmAdapter } from "./milient"

export function getPmAdapter(userEmail?: string): PmAdapter {
  if (!userEmail) throw new Error("getPmAdapter: userEmail is required")
  return new MilientPmAdapter(userEmail)
}
