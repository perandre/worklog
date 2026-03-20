# Domain Logic & Business Rules

## Display Rules

- Work hours: 6 AM – 11 PM (empty hours hidden)
- Calendar events: All shown per hour (`primaries` array)
- Communications: Max 6/hour (day view), 3/hour (week view)
- Slack DMs: No `#` prefix; channels get `#` prefix
- Docs: Shows edit/create/delete/rename/move actions
- Jira: Shows issue transitions (status changes) and comments; displays `issueKey: summary`
- Duration: Click to copy (shows checkmark feedback)

## AI Time Logging

### Suggestion Flow
1. User clicks "Generate" → fetches `/api/ai/pm-context` (projects, activity types, allocations, time lock)
2. Then POST `/api/ai/suggest` with date, hours, pmContext
3. Activities preprocessed → prompt assembled → Gemini generates suggestions
4. User approves/edits individual suggestions → clicks "Submit" → POST `/api/ai/submit` → creates time records in Milient

### Suggestion Caching
- Cached per date in localStorage: `ai-suggestions:YYYY-MM-DD`
- Cache entries are versioned (`CACHE_VERSION` in AiPanel.tsx) and include date field for validation
- Auto-loaded on mount; saved on every mutation (approve/reject/edit/submit)
- "Regenerate" bypasses cache with `forceRefresh = true`
- If two AiPanel instances ever exist simultaneously, they corrupt each other's cache — always render exactly one via JS `matchMedia`, never CSS hiding

### Time Lock
- Milient user accounts have a `timeLockDate` field — hours on or before this date are locked
- Checked server-side in `/api/ai/submit` (returns 403 for locked dates)
- Checked client-side to disable approve/submit/edit buttons and show a lock banner
- Lock date is fetched as part of `PmContext`

## Milient/Moment Integration

### API Basics
- Base client: `app/lib/milient.ts` with `milientFetch()`, `milientList()`, `milientListAll()`
- Auth: Basic Auth with API key
- Pagination: `size=500`, parallel fetching of remaining pages

### Key Endpoints
- `userAccounts` — resolve email → `userAccountId`; also has `timeLockDate`
- `projects` — all company projects
- `projectExtensions` — activity types, tied to `projectId`
- `projectMemberships` — user's project allocations (NOT `/allocations`, which doesn't exist)
- `timeRecords` — create/read time entries

### Field Mapping (Suggestion → TimeRecord)
- `projectId` → from matched project
- `projectExtensionId` → from matched activity type
- `userAccountId` → resolved from Google session email
- `date` → YYYY-MM-DD
- `hours` → decimal hours
- `description` → invoice-ready text (Norwegian + English)
- `internalNote` → internal context

## Drive Activity Notes

- Drive Activity v2 is queried with a time filter plus `detail.action_detail_case` (edit/create/comment)
- Actor matching happens at the action level; activities can contain multiple actions/actors
- Shared drives: queried by `ancestorName` for each shared drive, in addition to `items/root`
- If shared drive listing is blocked, update the hardcoded shared drive IDs in `app/lib/google.ts`
- Debug: set `DEBUG_DRIVE_ACTIVITY=1` to log raw activity payloads

## Launch Checklist

- [ ] Restrict Google sign-in to company domain in NextAuth callbacks
- [ ] Disable debug logging in production; never log raw Drive Activity payloads
- [ ] Move shared drive IDs out of code (config/DB/env) and lock access
- [ ] Review OAuth scopes and remove any not required
- [ ] Add privacy note (no server-side storage; data fetched on demand)
- [ ] Provide token revocation/disconnect flow for Google (in addition to Slack)
