# Improvement Suggestions

## 1. Extract reusable ConnectBanner component

**Why:** `app/page.tsx` contains five nearly identical connection banner blocks (Slack, Trello, GitHub, Jira, HubSpot), each ~25 lines of duplicated JSX. Adding a new service means copying the block again. A single `<ConnectBanner service="slack" icon={...} />` component would eliminate ~100 lines of duplication and make adding future integrations trivial.

**Effort:** S

**Files involved:**
- `app/page.tsx` (lines 419–562 — the five banner blocks)
- New: `app/components/ConnectBanner.tsx`

---

## 2. Add HubSpot to getDaySummary counts

**Why:** `getDaySummary()` in `app/lib/aggregator.ts` counts activities from every source (calendar, slack, gmail, docs, trello, github, jira) except HubSpot. This means the summary object returned to the client is missing HubSpot activity counts, even though HubSpot activities are present in the hourly data. The inconsistency could confuse anyone building on top of the summary data.

**Effort:** S

**Files involved:**
- `app/lib/aggregator.ts` — `getDaySummary()` function (add `totalHubSpotActivities` counter)

---

## 3. Surface source-level fetch errors to the user

**Why:** When an individual source API fails (e.g., Slack token expired, Jira rate-limited), the error is caught silently in `app/api/activities/route.ts` and an empty array is returned. The user sees no activities from that source but has no indication that anything went wrong — it looks like a quiet day. Returning a `warnings` array alongside the data (e.g., `{ hours, summary, sources, warnings: ["Slack: token expired"] }`) would let the UI display a subtle indicator per source, helping users understand when data is missing vs. when they genuinely had no activity.

**Effort:** M

**Files involved:**
- `app/api/activities/route.ts` — capture error messages per source instead of silently swallowing
- `app/page.tsx` — display warnings in the UI (e.g., a small alert or per-source icon indicator)
