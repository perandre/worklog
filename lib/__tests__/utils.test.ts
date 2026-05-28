import { describe, it, expect } from "vitest"
import { cn } from "../utils"

describe("cn", () => {
  it("merges conditional class names", () => {
    expect(cn("a", false && "b", "c")).toBe("a c")
  })

  it("resolves conflicting tailwind utilities to the last one", () => {
    expect(cn("px-2", "px-4")).toBe("px-4")
  })

  it("flattens arrays and ignores falsy values", () => {
    expect(cn(["x", null, undefined, "y"])).toBe("x y")
  })
})
