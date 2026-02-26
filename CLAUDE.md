# Agent Rules

See also: [ARCHITECTURE.md](./ARCHITECTURE.md) | [PATTERNS.md](./PATTERNS.md) | [DOMAIN-LOGIC.md](./DOMAIN-LOGIC.md)

## What Is This App?

Worklog — a Next.js app that shows your day's work activity hour-by-hour from Google (Calendar, Gmail, Docs), Slack, Trello, GitHub, and Jira Cloud. An AI panel uses Gemini to generate time log suggestions and submits them to Milient/Moment (a Norwegian PM/time-tracking system).

## Tech Stack

- **Framework**: Next.js 14 (App Router, `app/` directory)
- **Language**: TypeScript (strict mode)
- **Auth**: NextAuth.js v5 beta (JWT mode, no database)
- **UI**: shadcn/ui + Tailwind CSS v4 + Lucide React icons
- **AI**: Google Gemini 2.5 Flash Lite (`@google/generative-ai`)
- **PM**: Milient/Moment API (Basic Auth)
- **Hosting**: Vercel

## Project Structure

```
app/
├── page.tsx                        # Main client component (day/week views, AI panel toggle)
├── layout.tsx                      # Root layout (dark mode, DM Sans font)
├── globals.css                     # Tailwind + CSS variables (light/dark themes)
├── components/
│   ├── Activity.tsx                # Activity item with source icons, duration, copy-to-clipboard
│   ├── WelcomePage.tsx             # Landing page with animated icons + Google sign-in
│   └── ai/
│       ├── AiPanel.tsx             # AI sidebar: generate/approve/edit/submit suggestions
│       ├── SuggestionCard.tsx      # Expandable card for one suggestion
│       └── SuggestionProgress.tsx  # Progress bar (approved hours vs 7.5h target)
├── lib/
│   ├── auth.ts                     # NextAuth config, Google OAuth, token refresh
│   ├── google.ts                   # Calendar, Gmail, Drive Activity v2, Drive v3 APIs
│   ├── slack.ts                    # Slack search + user/channel resolution
│   ├── trello.ts                   # Trello board/card activity
│   ├── github.ts                   # GitHub commits (search API) + events (PRs, issues)
│   ├── jira.ts                     # Jira Cloud issue transitions + comments (OAuth 2.0)
│   ├── aggregator.ts              # Buckets activities by hour (6–23)
│   ├── milient.ts                  # Milient API client + in-memory TTL/LRU cache
│   ├── i18n.tsx                    # Translations (NO/EN), includes version string
│   ├── ai/
│   │   ├── adapter.ts             # AiAdapter interface
│   │   ├── index.ts               # Factory → GeminiAdapter
│   │   ├── gemini.ts              # Gemini adapter (JSON response mode)
│   │   ├── preprocess.ts          # Activity preprocessing (lunch detection, gaps, calendar time)
│   │   ├── prompt.ts              # System prompt assembly with project/activity context
│   │   └── parse.ts              # Parse AI JSON → TimeLogSuggestion[]
│   ├── pm/
│   │   ├── adapter.ts             # PmAdapter interface
│   │   ├── index.ts               # Factory → MilientPmAdapter
│   │   └── milient.ts             # PM adapter (top 20 projects, top 3 activity types each)
│   └── types/
│       ├── pm.ts                   # PmProject, PmActivityType, PmAllocation, PmContext
│       └── timelog.ts              # TimeLogSuggestion, TimeLogSubmission
├── api/
│   ├── activities/route.ts         # GET ?date=YYYY-MM-DD — aggregated activities
│   ├── status/route.ts             # GET — connection status for all services
│   ├── auth/
│   │   ├── [...nextauth]/route.ts  # NextAuth handler
│   │   ├── slack/                  # connect / callback / disconnect
│   │   ├── trello/                 # connect / callback / disconnect
│   │   ├── github/                 # connect / callback / disconnect
│   │   └── jira/                   # connect / callback / disconnect
│   └── ai/
│       ├── pm-context/route.ts     # GET — projects, activity types, allocations, time lock
│       ├── suggest/route.ts        # POST — generate AI suggestions via Gemini
│       └── submit/route.ts         # POST — submit time logs to Milient
└── trello-auth-complete/page.tsx   # Trello OAuth callback (reads URL fragment)

components/ui/                      # shadcn components (button, card, badge, alert, skeleton, etc.)
lib/utils.ts                        # cn() class merge utility
prompts/timelog-system.md           # Editable AI system prompt (no code change needed)
```

## Key Data Flows

**Activity feed**: `page.tsx` → `GET /api/activities?date=` → parallel calls to Google/Slack/Trello/GitHub/Jira → `aggregator.ts` buckets by hour → response to client.

**AI time logging**: User clicks Generate → `GET /api/ai/pm-context` → `POST /api/ai/suggest` (preprocess → prompt → Gemini → parse) → user approves/edits → `POST /api/ai/submit` → Milient time records.

## Auth Model

- **Google**: NextAuth JWT with auto-refresh. Scopes: `gmail.readonly`, `calendar.readonly`, `drive.activity.readonly`, `drive.metadata.readonly`.
- **Slack / Trello / GitHub / Jira**: Custom OAuth flows, tokens stored in HTTP-only cookies.
- **Jira specifics**: Access token JWT is too large for cookies. Cookie stores `{ refreshToken, cloudId, siteUrl }` only; fresh access token obtained via refresh on each API call.

## Patterns to Follow

- **Adapter pattern** for AI (`lib/ai/`) and PM (`lib/pm/`): interface → factory → implementation. Add providers by creating an implementation and updating the factory.
- **API routes** all start with `auth()` check → 401 if no session.
- **i18n**: All UI strings in `app/lib/i18n.tsx` as `"dotted.key": { en: "...", no: "..." }`. Use `useTranslation()` hook in components.
- **shadcn/ui** for all base components, **Lucide React** for all icons, **Tailwind** for styling.
- **Responsive**: Use JS `matchMedia("(min-width: 1024px)")` for conditional rendering of stateful components — never CSS-hide duplicate stateful components.
- **Milient cache**: Server-side in-memory TTL (10 min) + LRU (max 200). Request deduplication for concurrent fetches.
- **AI suggestion cache**: Client-side localStorage per date (`ai-suggestions:YYYY-MM-DD`), versioned entries.

## Environment Variables

See `.env.example`. Required: `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MILIENT_API_KEY`, `MILIENT_COMPANY_CODE`, `GEMINI_API_KEY`. Optional per integration: `SLACK_CLIENT_ID/SECRET`, `TRELLO_API_KEY`, `GITHUB_CLIENT_ID/SECRET`, `JIRA_CLIENT_ID/SECRET`.

## Workflow

After each code change:
1. Commit with a short descriptive message.
2. Restart the Next.js dev server: `npm run dev`

**Before pushing** (every `git push`), bump the version in **both** places:
- `package.json` → `"version"` (currently `1.3.3`)
- `app/lib/i18n.tsx` → `"footer.version"` translation strings (both `en` and `no`)

Use semver: patch for bug fixes, minor for features, major for breaking changes. This is mandatory — never push without checking the version.

## Scope Discipline

- Only make changes that are directly requested or clearly necessary.
- Don't add features, refactor, or "improve" beyond what was asked.
- Don't add comments, docstrings, or type annotations to code you didn't change.
- Don't create new files unless absolutely required — prefer editing existing ones.
- Don't create documentation files unless explicitly requested.

## Git Protocol

- Commit after each logical change, not in large batches.
- Never force-push, amend published commits, or skip hooks.
- Never push without explicit user request.
- Never commit `.env.local` or files containing secrets.

## Human Approval Gates

Always ask before:
- Destructive operations (deleting files/branches, dropping data)
- Actions visible to others (pushing, creating PRs/issues, sending messages)
- Architectural decisions with multiple valid approaches

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server (localhost:3000) |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |

Slack OAuth requires HTTPS — use ngrok or deploy to Vercel for local Slack testing.
