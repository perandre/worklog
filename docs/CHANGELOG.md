# Changelog

## 2.0.17 (2026-03-20)

- Exclude already-logged Milient records from AI suggestions so duplicates are avoided
- Fix connection banner responsiveness on mobile
- Add activity sources summary log for server-side debugging

## 2.0.1 – 2.0.16 (2026-03-09 – 2026-03-13)

- Split time log descriptions into client-facing and internal technical note fields
- Add task dropdown for Milient activity types (derived from recent time records)
- Validate that selected activity type belongs to the chosen project before submission
- Rename "Type" label to "Activity" in suggestion cards
- Map HubSpot activities to Sales project in AI prompt
- Filter HubSpot deals by the current user's owner ID
- Fix multi-role project submission and internalNote not being sent
- Increase top activity types and tasks shown per project from 3 to 5
- Refine AI prompt: out-of-office rule, bundle warning, sourceActivities cap at 10

## 2.0.0 (2026-03-09)

- Add HubSpot integration: OAuth flow, deal activity feed, and connect banner
- Show auth success/error notifications after OAuth redirects
- Use request origin instead of NEXTAUTH_URL in all OAuth routes
- Fix destructive alert styling (solid red background with white text)

## 1.4.57 and earlier (through 2026-03-07)

- Week view: show all 7 days (Mon–Sun) and click day header to navigate to day view
- Calendar: show attendee emails instead of count, filter resource emails
- Add Milient task support: derive tasks from time records, add task dropdown
- Tighten AI prompt: deduplicate by project+type, cap at 7.5h, restrict HR/Recruitment
- Strip Slack message text from AI prompt, keep channel name only
- Fix card width and title overflow in day view
- Expand recent project window from 14 to 30 days
- AI prompt improvements: use Jira titles verbatim, evidence-only descriptions
