import { describe, it, expect } from "vitest"
import { processActivities, getDaySummary } from "../aggregator"

// All fixtures use explicit UTC timestamps and pass timezone "UTC" so the
// bucketing is deterministic regardless of the machine timezone.
function cal(start: string, end?: string, title = "Event") {
  return {
    source: "calendar" as const,
    type: "event",
    title,
    timestamp: new Date(start),
    ...(end ? { endTime: new Date(end) } : {}),
  }
}

describe("processActivities", () => {
  it("buckets a single calendar event into its start hour", () => {
    const processed = processActivities([cal("2026-05-28T14:00:00Z", "2026-05-28T14:30:00Z")], 0, 24, "UTC")
    expect(processed[14].primaries).toHaveLength(1)
    expect(processed[14].primaries[0].spanStart).toBe(true)
    expect(processed[14].primaries[0].isSpanning).toBe(false)
    expect(processed[13].primaries).toHaveLength(0)
  })

  it("spans a multi-hour event across buckets, flagging continuation hours", () => {
    const processed = processActivities([cal("2026-05-28T09:00:00Z", "2026-05-28T11:00:00Z")], 0, 24, "UTC")
    expect(processed[9].primaries[0].isSpanning).toBe(false)
    expect(processed[9].primaries[0].spanStart).toBe(true)
    expect(processed[10].primaries[0].isSpanning).toBe(true)
    expect(processed[11].primaries[0].isSpanning).toBe(true)
  })

  it("ignores events outside the configured hour window", () => {
    const processed = processActivities([cal("2026-05-28T03:00:00Z", "2026-05-28T03:30:00Z")], 6, 23, "UTC")
    const total = Object.values(processed).reduce((n, h) => n + h.primaries.length, 0)
    expect(total).toBe(0)
  })

  it("dedupes emails by normalized thread subject and drops calendar notifications", () => {
    const acts = [
      { source: "gmail" as const, type: "email", subject: "Re: Status", from: "a@x.com", timestamp: new Date("2026-05-28T10:00:00Z") },
      { source: "gmail" as const, type: "email", subject: "Status", from: "b@x.com", timestamp: new Date("2026-05-28T10:05:00Z") },
      { source: "gmail" as const, type: "email", subject: "Invite", from: "calendar-notification@google.com", timestamp: new Date("2026-05-28T10:10:00Z") },
    ]
    const processed = processActivities(acts, 0, 24, "UTC")
    expect(processed[10].communications).toHaveLength(1)
  })

  it("sorts communications chronologically within an hour", () => {
    const acts = [
      { source: "slack" as const, type: "message", channel: "general", timestamp: new Date("2026-05-28T10:40:00Z") },
      { source: "github" as const, type: "commit", repoName: "acme/web", title: "fix", timestamp: new Date("2026-05-28T10:10:00Z") },
    ]
    const processed = processActivities(acts, 0, 24, "UTC")
    const sources = processed[10].communications.map((c) => c.source)
    expect(sources).toEqual(["github", "slack"])
  })
})

describe("getDaySummary", () => {
  it("counts meetings once for spanning events and tallies communications by source", () => {
    const acts = [
      cal("2026-05-28T09:00:00Z", "2026-05-28T11:00:00Z", "Workshop"),
      { source: "slack" as const, type: "message", channel: "general", timestamp: new Date("2026-05-28T09:15:00Z") },
      { source: "slack" as const, type: "message", channel: "random", timestamp: new Date("2026-05-28T09:20:00Z") },
      { source: "jira" as const, type: "transition", issueKey: "P-1", timestamp: new Date("2026-05-28T10:00:00Z") },
    ]
    const processed = processActivities(acts, 0, 24, "UTC")
    const summary = getDaySummary(processed)
    expect(summary.totalMeetings).toBe(1)
    expect(summary.totalSlackMessages).toBe(2)
    expect(summary.totalJiraActivities).toBe(1)
    expect(summary.totalEmails).toBe(0)
  })
})
