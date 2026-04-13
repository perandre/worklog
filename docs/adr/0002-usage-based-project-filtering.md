# ADR 0002: Usage-Based Project and Activity Type Filtering

## Context

Milient contains thousands of projects and activity types across the entire company. Showing all of them in the AI prompt or in dropdown selectors would overwhelm both the AI model (token budget) and the user (choice overload).

The app needed a way to narrow the project and activity type list to what is relevant for each user on a given day.

## Decision

Instead of maintaining a separate configuration of "my projects" or relying on Milient's project membership alone, the app derives the relevant set from the user's **recent time records** (last 30 days):

1. Fetch all time records for the user from the past 30 days via `milientListAll("timeRecords", ...)`.
2. Count records per project; keep the **top 50 projects** by usage frequency.
3. For each top project, count activity type usage; keep the **top 5 activity types** per project.
4. Intersect with the user's active project memberships (from `projectMemberships` endpoint) and filter to `projectState: "inProgress"`.
5. Tasks are also derived from the same time records — the top 5 recently-used tasks per activity type are surfaced in a dropdown.

The "Internal" project's core activity types (Meetings, Admin, Travel, etc.) are always included regardless of recency, ensuring common entries are always available.

## Consequences

- **Zero configuration**: users never need to manually select "my projects." The system learns from their behavior.
- **No extra API calls**: tasks and activity type rankings are derived from the same 30-day time records scan, adding no API overhead.
- **Cold start gap**: a new user with no time records in the last 30 days will see no projects until they log their first entry manually in Milient.
- **Recency bias**: projects worked on 31+ days ago disappear from suggestions. This is intentional — stale projects add noise — but could surprise users returning to an old project.
- **Cached 10 minutes**: the usage analysis is cached server-side, so changes to time records take up to 10 minutes to reflect in the project list.
