# Changelog

All notable user-facing changes to Worklog are documented here.

## 2.0.17 — 2026-03-20

### Improved
- AI suggestions now exclude activities already logged in Milient, preventing duplicate entries
- Renamed "Type" to "Activity" in suggestion card UI for clarity
- AI prompt refined: out-of-office rule, bundle warning, and source activities capped at 10
- Suggestions now include an internal technical note separate from the client-facing description
- Increased top activity types and tasks shown per project from 3 to 5
- Connection banner is now responsive on mobile

### Fixed
- Activity type validation: submission now rejects types that don't belong to the selected project
- Multi-role project submission and internal note not being sent
- HubSpot deal filtering now uses the API-level `hs_updated_by_user_id` filter
- HubSpot owner ID lookup uses the CRM Owners API instead of OAuth user_id
- HubSpot token refresh now preserves portal/owner/user IDs
- Slack OAuth edit link now points directly to app settings URL

## 2.0.0 — 2026-03-09

### Added
- **HubSpot integration**: connect your HubSpot account to see deal activity in your daily timeline
- HubSpot OAuth flow with automatic token refresh
- HubSpot deals filtered to show only deals you modified on the selected date
- Auth success/error notifications shown after OAuth redirects

### Fixed
- OAuth routes now use request origin instead of hardcoded NEXTAUTH_URL
- Destructive alert styling: solid red background with white text

## 1.4.57 — 2026-03-07

### Added
- Milient task support: tasks are derived from time records and shown in a dropdown
- Calendar view now shows attendee emails instead of just a count
- Week view shows all 7 days (Mon–Sun) instead of only Mon–Fri
- Click day header in week view to navigate to day view

### Improved
- AI prompt: use Jira issue titles verbatim, never invent description content, avoid repeating project name in description
- Recent project window expanded from 14 to 30 days
- Internal project activity types limited to curated set (Meetings, Admin, HR, Travel, Learning, Head of service area)
- Existing records section now expands by default on date change
- Activity metadata wraps to new line instead of truncating
- Calendar attendees: resource emails filtered, local part truncated, capped at 5

### Fixed
- Map iteration fix for TypeScript downlevelIteration
- Day view card width consistency
- Title overflow in flex containers
- Slack message text stripped from AI prompt (channel name kept)
