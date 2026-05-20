import { describe, it, expect } from "vitest"
import { preprocessActivities } from "../preprocess"

function makeHourData(primaries: any[] = [], communications: any[] = []) {
  return { primaries, communications }
}

function makeCalendarEvent(hour: number, durationMinutes: number, title = "Meeting") {
  const timestamp = `2026-03-15T${String(hour).padStart(2, "0")}:00:00Z`
  const endTime = new Date(new Date(timestamp).getTime() + durationMinutes * 60000).toISOString()
  return { source: "calendar", type: "event", title, timestamp, endTime }
}

function makeSlackMessage(hour: number, channel: string, isDm = false) {
  return {
    source: "slack",
    type: "message",
    channel,
    isDm,
    timestamp: `2026-03-15T${String(hour).padStart(2, "0")}:15:00Z`,
  }
}

function makeGmailActivity(hour: number, subject: string, from = "user@example.com") {
  return {
    source: "gmail",
    type: "email",
    subject,
    from,
    timestamp: `2026-03-15T${String(hour).padStart(2, "0")}:20:00Z`,
  }
}

describe("preprocessActivities", () => {
  it("flattens activities from hour buckets into a sorted list", () => {
    const hours = {
      "9": makeHourData([makeCalendarEvent(9, 60)], [makeSlackMessage(9, "general")]),
      "10": makeHourData([], [makeSlackMessage(10, "dev")]),
    }
    const result = preprocessActivities(hours)
    expect(result.activities).toHaveLength(3)
    // Should be sorted by timestamp
    expect(result.activities[0].source).toBe("calendar")
    expect(result.activities[1].source).toBe("slack")
    expect(result.activities[2].source).toBe("slack")
  })

  it("calculates calendar minutes from events with duration", () => {
    const hours = {
      "9": makeHourData([makeCalendarEvent(9, 60)]),
      "10": makeHourData([makeCalendarEvent(10, 30)]),
    }
    const result = preprocessActivities(hours)
    expect(result.calendarMinutes).toBe(90)
  })

  it("skips spanning entries to avoid double-counting", () => {
    const event = makeCalendarEvent(9, 120)
    const hours = {
      "9": makeHourData([{ ...event, isSpanning: false, spanStart: true }]),
      "10": makeHourData([{ ...event, isSpanning: true }]),
    }
    const result = preprocessActivities(hours)
    // Only the non-spanning entry should be counted
    expect(result.activities).toHaveLength(1)
  })

  it("filters out calendar invite emails", () => {
    const hours = {
      "9": makeHourData([], [
        makeGmailActivity(9, "Meeting invite from John"),
        makeGmailActivity(9, "Real email about project"),
      ]),
    }
    const result = preprocessActivities(hours)
    expect(result.activities).toHaveLength(1)
    expect(result.activities[0].title).toContain("Real email")
  })

  it("generates correct titles for different sources", () => {
    const hours = {
      "9": makeHourData(
        [makeCalendarEvent(9, 30, "Sprint Planning")],
        [
          makeSlackMessage(9, "general"),
          makeSlackMessage(9, "Alice", true),
          { source: "docs", type: "Edited", title: "Design Doc", timestamp: "2026-03-15T09:30:00Z" },
          { source: "github", repoName: "my-repo", title: "Fix bug #123", timestamp: "2026-03-15T09:35:00Z" },
          { source: "jira", issueKey: "PROJ-42", issueSummary: "Implement login", timestamp: "2026-03-15T09:40:00Z" },
        ]
      ),
    }
    const result = preprocessActivities(hours)
    const titles = result.activities.map((a) => a.title)
    expect(titles).toContain("Sprint Planning")
    expect(titles).toContain("#general")
    expect(titles).toContain("DM: Alice")
    expect(titles).toContain("Edited: Design Doc")
    expect(titles.find((t) => t.includes("my-repo"))).toBeTruthy()
    expect(titles.find((t) => t.includes("PROJ-42"))).toBeTruthy()
  })

  it("deduplicates activities by source+timestamp+title key", () => {
    const slack = makeSlackMessage(9, "general")
    const hours = {
      "9": makeHourData([], [slack, slack]),
    }
    const result = preprocessActivities(hours)
    expect(result.activities).toHaveLength(1)
  })

  it("returns zero values for empty input", () => {
    const result = preprocessActivities({})
    expect(result.activities).toHaveLength(0)
    expect(result.calendarMinutes).toBe(0)
    expect(result.gapMinutes).toBe(0)
    expect(result.totalActiveMinutes).toBe(0)
  })
})
