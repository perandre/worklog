# ADR 0002: Cookie-based OAuth token storage

## Status

Accepted

## Context

Worklog integrates with 6 external OAuth providers (Google, Slack, Trello, GitHub, Jira, HubSpot). Each requires storing user-specific access and/or refresh tokens. Without a database (see ADR 0001), tokens need an alternative home.

Options considered:
1. **Database** — ruled out by the no-database decision.
2. **Server-side session store (Redis/Upstash)** — adds infrastructure and cost for a small-team tool.
3. **HTTP-only cookies** — zero infrastructure, tokens travel with each request automatically.

## Decision

All OAuth tokens are stored in HTTP-only cookies, one per provider. Each provider follows a variant of the same pattern:

| Provider | Cookie | Contents | Encoding |
|----------|--------|----------|----------|
| Google | NextAuth session | Access + refresh tokens, expiry | Encrypted JWT (NextAuth) |
| Slack | `slack_token` | User access token | Plain |
| Trello | `trello_token` | User access token | Plain |
| GitHub | `github_token` | User access token | Plain |
| Jira | `jira_token` | Refresh token, cloudId, siteUrl | Base64 JSON |
| HubSpot | `hubspot_token` | Access + refresh tokens, expiresAt, portalId, ownerId, userId | Base64 JSON |

All cookies are set with `httpOnly`, `secure`, and `sameSite=lax`.

## Consequences

- **No server-side state**: any serverless instance can handle any request. Horizontal scaling is trivial.
- **Automatic transmission**: cookies are sent with every request, so API routes have immediate access to tokens without extra lookups.
- **Size limits**: browser cookies are capped at ~4 KB each. Jira's access token JWT exceeds this, so only the refresh token is stored and a fresh access token is fetched on each API call. HubSpot's shorter tokens fit comfortably.
- **Security surface**: tokens in cookies are vulnerable to CSRF if `sameSite` is misconfigured. The `httpOnly` flag prevents JavaScript access, and `sameSite=lax` mitigates CSRF for state-changing requests.
- **Multi-device**: since tokens live in the browser, connecting a service on one device does not carry over to another. Each browser must complete its own OAuth flow.
- **Token refresh race conditions**: if two concurrent requests both detect an expired token and attempt refresh simultaneously, one may fail. In practice this is rare with a single-user-per-browser model.
