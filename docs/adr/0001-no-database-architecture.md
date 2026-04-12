# ADR 0001: No-database architecture

## Status

Accepted

## Context

Worklog aggregates daily activity from up to 8 external sources (Google Calendar, Gmail, Drive, Slack, Trello, GitHub, Jira, HubSpot) and generates AI time log suggestions for submission to Milient. A traditional approach would store user data, tokens, and activity caches in a database.

The app is designed for a small team of consultants at a single company. All data originates from external APIs and is consumed on demand. There is no user-generated content that lives solely in Worklog.

## Decision

Worklog operates without any database. All data is fetched on demand from external APIs on each request.

- **Auth tokens**: stored in HTTP-only cookies (JWT for Google via NextAuth, base64-encoded JSON for Slack/Trello/GitHub/Jira/HubSpot)
- **User identity**: resolved from the Google session email on each Milient API call
- **Activity data**: fetched fresh from each source API per request, bucketed in memory by `aggregator.ts`
- **AI suggestions**: cached client-side in `localStorage` per date, never persisted server-side
- **Milient metadata**: cached in-memory with a 10-minute TTL and LRU eviction (projects, activity types)

## Consequences

- **Simpler deployment**: no database provisioning, migrations, or connection pooling. Deploys to Vercel as a pure serverless app.
- **No data retention liability**: user activity data passes through the server but is never stored. Privacy is straightforward.
- **Cold-start latency**: every page load triggers parallel API calls to all connected sources. For most sources this takes 1-3 seconds.
- **No offline support**: the app is useless without network access to the external APIs.
- **In-memory cache is per-instance**: on Vercel, each serverless invocation may get a cold function. The Milient TTL cache only helps within a warm instance. This is acceptable given the small user base.
- **Token size constraints**: all OAuth tokens must fit in cookies. Jira's access token JWT is too large, so only the refresh token is stored and a fresh access token is obtained on each request.
