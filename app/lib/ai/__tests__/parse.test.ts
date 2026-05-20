import { describe, it, expect } from "vitest"
import { parseSuggestions } from "../parse"

describe("parseSuggestions", () => {
  it("parses a valid JSON array", () => {
    const input = JSON.stringify([
      {
        projectId: "123",
        activityTypeId: "456",
        hours: 2,
        description: "Worked on feature X",
        confidence: "high",
        sourceActivities: [
          { source: "calendar", title: "Planning meeting", timestamp: "2026-03-15T09:00:00Z" },
        ],
      },
    ])
    const result = parseSuggestions(input)
    expect(result).toHaveLength(1)
    expect(result[0].projectId).toBe("123")
    expect(result[0].activityTypeId).toBe("456")
    expect(result[0].hours).toBe(2)
    expect(result[0].description).toBe("Worked on feature X")
    expect(result[0].confidence).toBe("high")
    expect(result[0].status).toBe("pending")
    expect(result[0].sourceActivities).toHaveLength(1)
  })

  it("extracts JSON array from markdown-wrapped response", () => {
    const input = "Here are the suggestions:\n```json\n" + JSON.stringify([
      { projectId: "1", activityTypeId: "2", hours: 1, description: "Test" },
    ]) + "\n```"
    const result = parseSuggestions(input)
    expect(result).toHaveLength(1)
    expect(result[0].projectId).toBe("1")
  })

  it("rounds hours to nearest 0.5, minimum 0.5", () => {
    const input = JSON.stringify([
      { projectId: "1", activityTypeId: "2", hours: 0.3, description: "Short task" },
      { projectId: "1", activityTypeId: "2", hours: 1.7, description: "Medium task" },
      { projectId: "1", activityTypeId: "2", hours: 0.1, description: "Tiny task" },
    ])
    const result = parseSuggestions(input)
    expect(result[0].hours).toBe(0.5) // 0.3 rounds to 0.5 (minimum)
    expect(result[1].hours).toBe(1.5) // 1.7 rounds to 1.5
    expect(result[2].hours).toBe(0.5) // 0.1 rounds to 0.5 (minimum)
  })

  it("defaults confidence to medium for invalid values", () => {
    const input = JSON.stringify([
      { projectId: "1", activityTypeId: "2", hours: 1, description: "Test", confidence: "invalid" },
      { projectId: "1", activityTypeId: "2", hours: 1, description: "Test" },
    ])
    const result = parseSuggestions(input)
    expect(result[0].confidence).toBe("medium")
    expect(result[1].confidence).toBe("medium")
  })

  it("handles truncated JSON response by salvaging complete objects", () => {
    const complete = { projectId: "1", activityTypeId: "2", hours: 1, description: "First" }
    const input = "[" + JSON.stringify(complete) + ",{\"projectId\":\"2\",\"activ"
    const result = parseSuggestions(input)
    expect(result).toHaveLength(1)
    expect(result[0].projectId).toBe("1")
  })

  it("throws on completely unparseable input", () => {
    expect(() => parseSuggestions("not json at all")).toThrow()
  })

  it("assigns unique IDs to each suggestion", () => {
    const input = JSON.stringify([
      { projectId: "1", activityTypeId: "2", hours: 1, description: "A" },
      { projectId: "1", activityTypeId: "2", hours: 1, description: "B" },
    ])
    const result = parseSuggestions(input)
    expect(result[0].id).toBeTruthy()
    expect(result[1].id).toBeTruthy()
    expect(result[0].id).not.toBe(result[1].id)
  })

  it("parses internalNote when present", () => {
    const input = JSON.stringify([
      {
        projectId: "1",
        activityTypeId: "2",
        hours: 1,
        description: "Client-facing text",
        internalNote: "Technical context here",
      },
    ])
    const result = parseSuggestions(input)
    expect(result[0].internalNote).toBe("Technical context here")
  })

  it("handles empty sourceActivities gracefully", () => {
    const input = JSON.stringify([
      { projectId: "1", activityTypeId: "2", hours: 1, description: "Test", sourceActivities: null },
    ])
    const result = parseSuggestions(input)
    expect(result[0].sourceActivities).toEqual([])
  })
})
