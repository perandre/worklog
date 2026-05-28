import { describe, it, expect } from "vitest"
import { parseSuggestions } from "../parse"

const base = {
  projectId: "p1",
  activityTypeId: "a1",
  hours: 2,
  description: "Did the thing",
}

describe("parseSuggestions", () => {
  it("parses a clean JSON array and maps fields with generated ids", () => {
    const out = parseSuggestions(JSON.stringify([base]))
    expect(out).toHaveLength(1)
    expect(out[0].projectId).toBe("p1")
    expect(out[0].activityTypeId).toBe("a1")
    expect(out[0].hours).toBe(2)
    expect(out[0].description).toBe("Did the thing")
    expect(out[0].status).toBe("pending")
    expect(out[0].id).toMatch(/[0-9a-f-]{36}/)
  })

  it("extracts the array when wrapped in markdown / prose", () => {
    const text = "Here are your entries:\n```json\n" + JSON.stringify([base]) + "\n```\nDone!"
    const out = parseSuggestions(text)
    expect(out).toHaveLength(1)
    expect(out[0].projectId).toBe("p1")
  })

  it("salvages a truncated response up to the last complete object", () => {
    const truncated = '[{"projectId":"p1","hours":1,"description":"a"},{"projectId":"p2","hours":2,"description":"b"}'
    const out = parseSuggestions(truncated)
    expect(out).toHaveLength(2)
    expect(out[1].projectId).toBe("p2")
  })

  it("throws when no JSON array can be found", () => {
    expect(() => parseSuggestions("no json here")).toThrow(/Kunne ikke finne JSON/)
  })

  it("rounds hours to the nearest half and enforces a 0.5 minimum", () => {
    const out = parseSuggestions(JSON.stringify([
      { ...base, hours: 2.3 },
      { ...base, hours: 0 },
      { ...base, hours: 0.1 },
    ]))
    expect(out[0].hours).toBe(2.5)
    expect(out[1].hours).toBe(0.5)
    expect(out[2].hours).toBe(0.5)
  })

  it("normalizes confidence to medium when invalid", () => {
    const out = parseSuggestions(JSON.stringify([
      { ...base, confidence: "high" },
      { ...base, confidence: "bogus" },
      { ...base },
    ]))
    expect(out[0].confidence).toBe("high")
    expect(out[1].confidence).toBe("medium")
    expect(out[2].confidence).toBe("medium")
  })

  it("coerces missing optional fields to safe defaults", () => {
    const out = parseSuggestions(JSON.stringify([{ description: "only desc" }]))
    expect(out[0].projectId).toBe("")
    expect(out[0].activityTypeId).toBe("")
    expect(out[0].hours).toBe(0.5)
    expect(out[0].internalNote).toBeUndefined()
    expect(out[0].sourceActivities).toEqual([])
  })

  it("maps source activities when present", () => {
    const out = parseSuggestions(JSON.stringify([
      { ...base, sourceActivities: [{ source: "slack", title: "#general", timestamp: "t", estimatedMinutes: 15 }] },
    ]))
    expect(out[0].sourceActivities).toHaveLength(1)
    expect(out[0].sourceActivities[0].estimatedMinutes).toBe(15)
  })
})
