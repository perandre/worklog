import { describe, it, expect } from "vitest"
import { processActivities, getDaySummary } from "../aggregator"

function makeActivity(source: string, hour: number, type = "event", extra: Record<string, any> = {}) {
  const timestamp = new Date(`2026-03-15T${String(hour).padStart(2, "0")}:30:00Z`)
  return { source, type, timestamp, ...extra }
}

function makeSpanningActivity(source: string, startHour: number, endHour: number) {
  const timestamp = new Date(`2026-03-15T${String(startHour).padStart(2, "0")}:00:00Z`)
  const endTime = new Date(`2026-03-15T${String(endHour).padStart(2, "0")}:00:00Z`)
  return { source, type: "event", timestamp, endTime }
}

describe("processActivities", () => {
  it("buckets a single activity into the correct hour", () => {
    const activities = [makeActivity("calendar", 9)]
    const result = processActivities(activities, 6, 23, "UTC")
    expect(result[9].primaries).toHaveLength(1)
    expect(result[9].primaries[0].source).toBe("calendar")
  })

  it("drops activities outside work hours", () => {
    const activities = [makeActivity("calendar", 5), makeActivity("calendar", 23)]
    const result = processActivities(activities, 6, 23, "UTC")
    // Neither hour 5 nor hour 23 should have activities
    expect(result[6]?.primaries).toHaveLength(0)
    expect(result[22]?.primaries).toHaveLength(0)
  })

  it("separates calendar (primaries) from other sources (communications)", () => {
    const activities = [
      makeActivity("calendar", 10),
      makeActivity("slack", 10),
      makeActivity("gmail", 10),
    ]
    const result = processActivities(activities, 6, 23, "UTC")
    expect(result[10].primaries).toHaveLength(1)
    expect(result[10].communications).toHaveLength(2)
  })

  it("spans calendar events across multiple hours", () => {
    const activities = [makeSpanningActivity("calendar", 9, 11)]
    const result = processActivities(activities, 6, 23, "UTC")
    expect(result[9].primaries).toHaveLength(1)
    expect(result[10].primaries).toHaveLength(1)
    // The original event starts at 9, so hour 10 should be a spanning entry
    expect(result[10].primaries[0].isSpanning).toBe(true)
  })

  it("creates empty buckets for all work hours", () => {
    const result = processActivities([], 6, 23, "UTC")
    for (let h = 6; h < 23; h++) {
      expect(result[h]).toBeDefined()
      expect(result[h].primaries).toHaveLength(0)
      expect(result[h].communications).toHaveLength(0)
    }
  })

  it("deduplicates emails by normalized subject", () => {
    const activities = [
      makeActivity("gmail", 10, "email", { subject: "Re: Project update", from: "alice@example.com" }),
      makeActivity("gmail", 10, "email", { subject: "Sv: Project update", from: "bob@example.com" }),
    ]
    const result = processActivities(activities, 6, 23, "UTC")
    // Both emails normalize to "project update", so only one should remain
    expect(result[10].communications).toHaveLength(1)
  })

  it("filters calendar notification emails", () => {
    const activities = [
      makeActivity("gmail", 10, "email", { subject: "Meeting invite", from: "calendar-notification@google.com" }),
      makeActivity("gmail", 10, "email", { subject: "Real email", from: "colleague@example.com" }),
    ]
    const result = processActivities(activities, 6, 23, "UTC")
    expect(result[10].communications).toHaveLength(1)
    expect(result[10].communications[0].subject).toBe("Real email")
  })
})

describe("getDaySummary", () => {
  it("counts activities by source", () => {
    const activities = [
      makeActivity("calendar", 9),
      makeActivity("calendar", 10),
      makeActivity("slack", 9),
      makeActivity("gmail", 9, "email", { subject: "Hello", from: "user@example.com" }),
      makeActivity("docs", 11),
      makeActivity("trello", 11),
      makeActivity("github", 12),
      makeActivity("jira", 12),
    ]
    const hourly = processActivities(activities, 6, 23, "UTC")
    const summary = getDaySummary(hourly)
    expect(summary.totalMeetings).toBe(2)
    expect(summary.totalSlackMessages).toBe(1)
    expect(summary.totalEmails).toBe(1)
    expect(summary.totalDocEdits).toBe(1)
    expect(summary.totalTrelloActivities).toBe(1)
    expect(summary.totalGitHubActivities).toBe(1)
    expect(summary.totalJiraActivities).toBe(1)
  })

  it("returns zero counts for an empty day", () => {
    const hourly = processActivities([], 6, 23, "UTC")
    const summary = getDaySummary(hourly)
    expect(summary.totalMeetings).toBe(0)
    expect(summary.totalSlackMessages).toBe(0)
    expect(summary.totalEmails).toBe(0)
  })
})
