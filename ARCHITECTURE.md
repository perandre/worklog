# Architecture

## Overview

Worklog — a summary of your day. Shows hour-by-hour activity from Google (Calendar, Gmail, Docs), Slack, Trello, GitHub, and Jira Cloud. AI-powered time logging via Gemini + Milient/Moment integration.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Auth**: NextAuth.js v5 (JWT mode, no database)
- **UI**: shadcn/ui + Tailwind CSS v4
- **Icons**: Lucide React
- **AI**: Google Gemini 2.5 Flash
- **PM**: Milient/Moment (time management)
- **APIs**: Google (Gmail, Calendar, Drive Activity v2, Drive v3), Slack, Trello, GitHub, Jira Cloud
- **Hosting**: Vercel

## Project Structure

```
app/
├── api/
│   ├── auth/
│   │   ├── [...nextauth]/route.ts    # NextAuth handler
│   │   ├── slack/                     # Slack OAuth (connect/callback/disconnect)
│   │   ├── trello/                    # Trello OAuth
│   │   ├── github/                    # GitHub OAuth
│   │   └── jira/                      # Jira Cloud OAuth 2.0 (3LO)
│   ├── activities/route.ts            # GET /api/activities?date=YYYY-MM-DD
│   ├── status/route.ts                # GET /api/status (auth required)
│   └── ai/
│       ├── pm-context/route.ts        # GET - projects, activity types, allocations, time lock
│       ├── suggest/route.ts           # POST - generate AI suggestions via Gemini
│       └── submit/route.ts            # POST - submit time logs to Milient
├── components/
│   ├── Activity.tsx                   # Activity item with source icons
│   └── ai/
│       ├── AiPanel.tsx                # AI time logging sidebar
│       ├── SuggestionCard.tsx         # Individual suggestion card
│       └── SuggestionProgress.tsx     # Hours progress bar
├── lib/
│   ├── auth.ts                        # NextAuth config + Google OAuth
│   ├── google.ts                      # Calendar, Gmail, Drive + Drive Activity APIs
│   ├── slack.ts                       # Slack search API + user resolution
│   ├── trello.ts                      # Trello board/card activity
│   ├── github.ts                      # GitHub commits + events
│   ├── jira.ts                        # Jira Cloud issue transitions + comments
│   ├── aggregator.ts                  # Hour bucketing logic
│   ├── milient.ts                     # Milient API client + cache
│   ├── i18n.tsx                       # Translations (NO/EN)
│   ├── ai/
│   │   ├── adapter.ts                 # AiAdapter interface
│   │   ├── index.ts                   # Factory → GeminiAdapter
│   │   ├── gemini.ts                  # Gemini 2.5 Flash adapter
│   │   ├── preprocess.ts              # Activity preprocessing for AI
│   │   ├── prompt.ts                  # System prompt assembly
│   │   └── parse.ts                   # Parse AI response → suggestions
│   ├── pm/
│   │   ├── adapter.ts                 # PmAdapter interface
│   │   ├── index.ts                   # Factory → MilientPmAdapter
│   │   └── milient.ts                 # Milient PM adapter
│   └── types/
│       ├── pm.ts                      # PmProject, PmActivityType, PmContext
│       └── timelog.ts                 # TimeLogSuggestion, TimeLogSubmission
├── globals.css                        # Tailwind + shadcn CSS variables
├── layout.tsx                         # Root layout with dark mode
├── icon.svg                           # Favicon (Frontkom logo)
└── page.tsx                           # Main page (client component)

components/ui/                         # shadcn components (Button, Card, Badge, etc.)
lib/utils.ts                           # cn() class merge utility
prompts/timelog-system.md              # Editable AI system prompt
```

## Data Flow

### Activity Feed
1. `page.tsx` fetches `/api/activities?date=YYYY-MM-DD`
2. API route gets Google token from session, Slack/Trello/GitHub/Jira tokens from cookies
3. Calls all source APIs in parallel
4. `aggregator.ts` buckets activities by hour (6-23)
5. Returns `{ hours, summary, sources }`

### AI Time Logging
1. User clicks "Generate" → fetches `/api/ai/pm-context` (projects, activity types, allocations, time lock)
2. Then POST `/api/ai/suggest` with date, hours, pmContext
3. Activities preprocessed → prompt assembled → Gemini generates suggestions
4. User approves/edits → POST `/api/ai/submit` → creates time records in Milient

## Auth

### Google (via NextAuth)
- Scopes: `gmail.readonly`, `calendar.readonly`, `drive.activity.readonly`, `drive.metadata.readonly`
- Tokens stored in encrypted JWT cookie, auto-refreshed on expiry

### Slack / Trello / GitHub (custom OAuth)
- Each stores user token in HTTP-only cookie
- Auth required on all API routes and disconnect endpoints

### Jira Cloud (OAuth 2.0 3LO)
- Scopes: `read:jira-work`, `read:jira-user`, `offline_access`
- Access tokens expire after 1 hour; refresh token stored in base64-encoded HTTP-only cookie
- Fresh access token obtained via refresh on each API call (access token JWT too large for cookies)
- Cookie stores: `{ refreshToken, cloudId, siteUrl }` only

## Caching

### Server-side (Milient)
- In-memory TTL cache (10 min) with LRU eviction (max 200 entries)
- Request deduplication for concurrent fetches of same key
- Global cache for projects/extensions, per-user cache for memberships

### Client-side (AI Suggestions)
- localStorage per date (`ai-suggestions:YYYY-MM-DD`)
- Versioned cache entries to prevent stale data
- Mutations (approve/edit/reject) persist immediately

## Environment Variables

See `.env.example` for the full list.

## Running Locally

```bash
npm install
npm run dev  # http://localhost:3000
```

Note: Slack OAuth requires HTTPS. For local Slack testing, use ngrok or deploy to Vercel first.
