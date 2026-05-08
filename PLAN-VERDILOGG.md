# VERDILOGG-style value-aware logging in Worklog

## Context

The prototype (Claude artifact `0e44ca02-d050-42f1-b250-65bd76264a06`, "VERDILOGG v2") proposes a three-tab redesign of consultant time logging:

1. **Konsulent** — for each task, log *both* `faktiske timer` (cost) and `verdi-timer` (value); flag whether AI/reuse boosted efficiency; leave a note to PM. Tasks are typed **Estimat** (estimate is reference; PM decides invoiced amount) or **Budsjett** (fixed-price; invoiced amount locked at the budget).
2. **PM-oversikt** — PM reviews each task with faktisk / estimat-or-budsjett / fakturerbart side by side, sees a multiplier (verdi/faktisk), gets margin-risk and >20% deviation alerts, sets the invoiced amount, approves to Moment/Milient.
3. **Kunderapport** — a value-language report (deliverables, status, KPIs, next period) sent to the customer instead of an hours breakdown.

The underlying goal: shift from "log hours" to "log value" — make the AI/reuse leverage visible to PM, separate cost from billing, and replace customer-facing hour reports with deliverable reports.

The question: how to build this in Worklog "in the simplest possible way, as part of worklog, or outside".

## Recommendation — at a glance

**Build only the Konsulent tab inside Worklog. Keep PM-oversikt and Kunderapport out.**

| Tab | Where | Why |
|---|---|---|
| Konsulent | Add to Worklog | Three new fields per existing AI-suggestion card + per-project type marker. No persistence change. |
| PM-oversikt | **Don't build** | Multi-user shared queue; needs DB + roles + auth. Milient itself already has a PM godkjenning flow — replicating duplicates Milient. |
| Kunderapport | Separate project (if at all) | Customer-facing reporting product, different audience and lifecycle (deliverables, milestones, PDF distribution). Doesn't share data or model with logging. |

The whole prototype works because the three roles share state. Worklog has no shared state — it's a single-user JWT app with no DB. Adding a PM surface means adding the missing half of the system. The consultant additions, by contrast, are a tight extension of what's already there.

## Scope of the consultant additions

### Per AI-suggestion card (`app/components/ai/AiPanel.tsx` and the card sub-component)

1. **Verdi-timer** — number input next to the existing `Faktiske timer` (`hours`) field.
2. **AI/gjenbruk-checkbox** — "AI eller gjenbruk bidro vesentlig til effektiviteten".
3. **Note til PM** — small textarea separate from the existing AI-generated `internalNote`.

### Per project (one-time, persisted in `localStorage` keyed by `projectId`)

4. **Project type**: `estimat` (default) or `budsjett`. Set once via a small picker on the card header. Drives the visual treatment:
   - `estimat` → green "Estimat" tag; estimate (when available from Milient `projectExtensions` allocation) shown as reference.
   - `budsjett` → blue "Budsjett" tag; budsjett-banner explaining "Dette er det vi fakturerer — logg faktiske timer for internkostnad".
5. **Budget hours** for budsjett-projects: also user-set in localStorage, since Milient doesn't expose a fixed-price budget.

### Submission (`app/api/ai/submit/route.ts`)

6. `hours = faktiske` (existing). The new fields ride along in the Milient time record's existing comment field — concatenated as a structured suffix so PM sees them in their normal Milient review:

   ```
   <description>

   ---
   Verdi-timer: 8.0  ·  Multiplier: 2.0x
   Effektivitet: AI/gjenbruk
   Note til PM: <pmNote>
   ```

   This is the cheap channel: no DB, no extra API. The PM signal lands inside Milient where review already happens.

### Day summary (existing day view; likely `app/page.tsx`)

7. Show a small KPI strip mirroring the prototype: `Faktiske / Estimert (ref.) / Budsjettert / Snitt multiplier / Logget X/Y`. Estimert = sum of allocations for estimat-typed projects; Budsjettert = sum from localStorage for budsjett-typed projects; multiplier = avg `verdi/faktisk` across logged entries today.

## Critical files

- `app/lib/types/timelog.ts` — extend `TimeLogSuggestion` and `TimeLogSubmission` with `valueHours?: number`, `aiOrReuse?: boolean`, `pmNote?: string`.
- `app/components/ai/AiPanel.tsx` (and its card subcomponent) — render the 3 new inputs, project-type tag, budsjett-banner.
- `app/api/ai/submit/route.ts:48-66` — fold the new fields into the Milient comment before calling `adapter.submitTimeLog`.
- `app/lib/projectClassification.ts` *(new, ~50 lines)* — small localStorage helper: `getType(projectId)`, `setType(projectId, "estimat" | "budsjett")`, `getBudget(projectId)`, `setBudget(projectId, hours)`.
- `app/page.tsx` (or wherever the day-summary lives) — render the KPI strip.
- `app/lib/i18n.tsx` — add Norwegian + English keys for the new labels (Faktiske timer, Verdi-timer, AI/gjenbruk, Note til PM, Budsjett, Estimat, Multiplier, etc.).

Reuse:
- The existing AI suggestion card layout, accept/skip/reject buttons, and localStorage caching pattern (`ai-suggestions:YYYY-MM-DD`).
- The Milient submit path; no new endpoints.
- The bilingual `i18n.tsx` infrastructure.

## What stays out

- No new pages, no new tabs.
- No PM-oversikt UI, review queue, or role auth.
- No customer report.
- No DB.
- No write to Milient project metadata; project type and budget live in localStorage.

## Verification

1. `npm run dev`, sign in.
2. Pick a project; mark it Budsjett with budget = 8t. Confirm the budsjett-banner appears on every suggestion card for that project.
3. Generate AI suggestions for today. On one card, set `Faktiske = 4`, `Verdi-timer = 8`, check the AI/gjenbruk box, write a PM note. Approve and submit.
4. Open the resulting time record in Milient: confirm `hours = 4` and the structured suffix (verdi-timer / multiplier / AI flag / PM note) is visible in the comment.
5. Switch the project back to Estimat (default). Refresh — banner should be gone; tag colour switches.
6. Day strip: confirm `Snitt multiplier` and `Logget X/Y` update as you approve cards.
7. Check the EN language toggle — new labels are translated.

## If you later decide you do want PM-oversikt and Kunderapport

PM-oversikt is the bigger architectural change — it needs:
- A real database (entries shared across users, with status transitions).
- Role-aware auth (PM vs consultant, derived from Milient `projectMemberships` role).
- A separate review queue UI.

That's effectively a second product. The right decision point is whether Milient's existing godkjenning flow is good enough; if it isn't, build it as its own app rather than fold it into Worklog.

Kunderapport is independent: a separate Next.js app that reads PM-approved time records from Milient (and possibly deliverable status from Jira/Trello) and renders the customer-facing layout. No shared model with Worklog beyond the Milient client (which is already extracted into `app/lib/pm/`).
