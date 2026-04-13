# ADR 0001: Stateless Architecture with No Database

## Context

Worklog aggregates activity data from multiple external services (Google, Slack, Trello, GitHub, Jira, HubSpot) and generates AI-powered time log suggestions. A traditional approach would store user data, tokens, and session state in a database.

The app is an internal tool for a single company (Frontkom) with a small user base. Deployment simplicity and low operational overhead were priorities.

## Decision

Worklog uses no database. All state is managed through:

- **JWT cookies** (via NextAuth.js v5) for Google OAuth tokens and session data
- **HTTP-only cookies** for third-party service tokens (Slack, Trello, GitHub, Jira, HubSpot), each base64-encoded
- **External APIs** as the source of truth (Milient for projects/time records, Google for calendar/email, etc.)
- **localStorage** for client-side caching of AI suggestions (per-date, versioned)
- **In-memory server cache** (TTL 10 min, LRU max 200 entries) for Milient API responses within a single server instance

User identity is resolved on each request by matching the Google session email against Milient's `userAccounts` endpoint.

## Consequences

- **Simpler deployment**: no database provisioning, migrations, or backup concerns. Deploys to Vercel with zero infrastructure.
- **No user management**: users authenticate via Google; their Milient identity is resolved automatically.
- **Cookie size limits**: HubSpot and Jira tokens fit in cookies, but Jira access tokens (large JWTs) are too big — only the refresh token is stored, and a fresh access token is obtained on each request.
- **No cross-device state**: AI suggestion cache is per-browser (localStorage). Switching browsers loses cached suggestions.
- **Server restart clears cache**: the in-memory Milient cache is lost on server restart or new Vercel deployment, causing a brief latency spike.
- **No audit trail**: the app has no record of its own usage; all time records live in Milient.
