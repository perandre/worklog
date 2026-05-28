import { describe, it, expect } from "vitest"
import { preprocessActivities } from "../preprocess"

// Timestamps are intentionally written WITHOUT a timezone suffix so they parse
// in local time and `getHours()` reads back the literal hour — keeping the
// lunch/gap math deterministic regardless of the machine timezone.
function hour(primaries: any[] = [], communications: any[] = []) {
  return { primaries, communications }
}

describe("preprocessActivities", () => {
  it("flattens activities, skips spanning copies and calendar invites, and derives titles", () => {
    const data = preprocessActivities({
      "9": hour(
        [
          { source: "calendar", title: "Standup", timestamp: "2026-05-28T09:00:00", endTime: "2026-05-28T09:30:00" },
          { source: "calendar", title: "Workshop", timestamp: "2026-05-28T09:00:00", isSpanning: true },
        ],
        [
          { source: "slack", channel: "general", isDm: false, timestamp: "2026-05-28T09:05:00" },
          { source: "gmail", subject: "Project update", timestamp: "2026-05-28T09:10:00" },
          { source: "gmail", subject: "Invitasjon: lunsj", timestamp: "2026-05-28T09:15:00" },
        ],
      ),
    })
    const titles = data.activities.map((a) => a.title)
    expect(data.activities).toHaveLength(3)
    expect(titles).toContain("Standup")
    expect(titles).toContain("#general")
    expect(titles).toContain("Project update")
    expect(titles).not.toContain("Workshop")
    expect(data.calendarMinutes).toBe(30)
  })

  it("builds source-specific titles", () => {
    const data = preprocessActivities({
      "10": hour([], [
        { source: "github", repoName: "acme/web", title: "Fix bug", timestamp: "2026-05-28T10:00:00" },
        { source: "jira", issueKey: "PROJ-1", issueSummary: "Login broken", timestamp: "2026-05-28T10:05:00" },
        { source: "docs", type: "Edited", title: "Q2 plan", timestamp: "2026-05-28T10:10:00" },
        { source: "trello", cardName: "Card A", timestamp: "2026-05-28T10:15:00" },
        { source: "slack", isDm: true, channel: "Bob", timestamp: "2026-05-28T10:20:00" },
      ]),
    })
    const titles = data.activities.map((a) => a.title)
    expect(titles).toEqual(["acme/web: Fix bug", "PROJ-1: Login broken", "Edited: Q2 plan", "Card A", "DM: Bob"])
  })

  it("detects a lunch gap and deducts 30 minutes", () => {
    const data = preprocessActivities({
      "9": hour([
        { source: "calendar", title: "Focus", timestamp: "2026-05-28T09:00:00", endTime: "2026-05-28T10:00:00" },
      ]),
    })
    expect(data.calendarMinutes).toBe(60)
    expect(data.lunchDetected).toBe(true)
    expect(data.totalActiveMinutes).toBe(30)
  })

  it("does not deduct lunch when a meeting covers the lunch window, and sums gaps", () => {
    const data = preprocessActivities({
      "9": hour([
        { source: "calendar", title: "Morning", timestamp: "2026-05-28T09:00:00", endTime: "2026-05-28T09:30:00" },
      ]),
      "11": hour([
        { source: "calendar", title: "Lunch meeting", timestamp: "2026-05-28T11:00:00", endTime: "2026-05-28T13:00:00" },
      ]),
    })
    expect(data.calendarMinutes).toBe(150)
    expect(data.lunchDetected).toBe(false)
    expect(data.gapMinutes).toBe(90)
    expect(data.totalActiveMinutes).toBe(240)
  })

  it("dedupes identical activities", () => {
    const dup = { source: "slack", channel: "general", timestamp: "2026-05-28T09:00:00" }
    const data = preprocessActivities({ "9": hour([], [dup, { ...dup }]) })
    expect(data.activities).toHaveLength(1)
  })
})
