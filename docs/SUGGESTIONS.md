# Improvement Suggestions

Ideas for improving Worklog, discovered during codebase analysis.

---

## 1. HubSpot activities missing from day summary counts

**Why:** `getDaySummary()` in `aggregator.ts` counts meetings, Slack messages, emails, doc edits, Trello, GitHub, and Jira activities — but not HubSpot. This means the summary line at the top of the day view silently omits HubSpot deal activity. Users who rely on the summary to confirm "did my HubSpot data load?" have no signal.

**Effort:** S

**Files involved:**
- `app/lib/aggregator.ts` — add `totalHubSpotActivities` counter in `getDaySummary()`, mirror the pattern used for the other sources

---

## 2. Error recovery for failed AI suggestions

**Why:** If the Gemini API call fails (rate limit, timeout, blocked prompt), the user sees an error but has no way to retry without regenerating from scratch. A simple "Retry" button that re-sends the same prompt would save time on transient failures, especially since the activity data and PM context are already fetched. This is a common pain point when working with external AI APIs.

**Effort:** S

**Files involved:**
- `app/components/ai/AiPanel.tsx` — store the last prompt/context on failure, add a retry button that re-calls `/api/ai/suggest` with the same payload
- `app/api/ai/suggest/route.ts` — no changes needed (already idempotent)

---

## 3. Split `page.tsx` into smaller components

**Why:** `app/page.tsx` is over 800 lines and contains the entire app UI: date navigation, week view, day view, connection banners, service status, activity fetching, and AI panel orchestration. This makes it hard to reason about state flow and slows down development. Extracting the week view, day view, and connection banners into separate components would make each piece testable in isolation and reduce cognitive load when making changes.

**Effort:** M

**Files involved:**
- `app/page.tsx` — extract `WeekView`, `DayView`, `ConnectionBanners`, `ServiceStatusFooter` into `app/components/`
- New files: `app/components/WeekView.tsx`, `app/components/DayView.tsx`, `app/components/ConnectionBanners.tsx`
