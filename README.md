# Worklog

AI-powered time logging for consultants. Aggregates your day hour-by-hour from Google, Slack, Trello, GitHub, and Jira — then uses AI to generate ready-to-submit time entries mapped to your projects in Milient/Moment.

Built with Next.js 14, shadcn/ui, Tailwind CSS, and Google Gemini. No database. Supports dark mode.

## What it does

1. **Aggregates your day** — fetches activity from up to 7 sources (Calendar, Gmail, Docs, Slack, Trello, GitHub, Jira) and lays it out hour by hour.
2. **Generates time entries** — sends your activities + project context from Milient to Gemini, which returns structured time log suggestions with hours and descriptions.
3. **Submits to Milient** — you review, edit, and submit. Time lock enforcement is handled server-side.

## Setup

```bash
npm install
cp .env.example .env.local  # Fill in your credentials
npm run dev                  # Open http://localhost:3000
```

## Environment Variables

```
# NextAuth
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=generate-a-random-secret

# Google OAuth (Calendar, Gmail, Drive Activity)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Slack OAuth
SLACK_CLIENT_ID=...
SLACK_CLIENT_SECRET=...

# Trello
TRELLO_API_KEY=...
TRELLO_APP_NAME=Worklog

# GitHub OAuth
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# Jira Cloud OAuth
JIRA_CLIENT_ID=...
JIRA_CLIENT_SECRET=...

# Milient/Moment (time tracking)
MILIENT_API_KEY=...
MILIENT_COMPANY_CODE=...

# Gemini (AI suggestions)
GEMINI_API_KEY=...
```

## Google Cloud Setup

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable: **Gmail API**, **Google Calendar API**, **Drive Activity API**, **Google Drive API**
3. Configure OAuth consent screen (add test users if in testing mode)
4. Create OAuth credentials (Web application)
   - Redirect URI: `https://your-app.vercel.app/api/auth/callback/google`

## Slack Setup

1. Create an app at [api.slack.com/apps](https://api.slack.com/apps)
2. Under **OAuth & Permissions**, add User Token Scopes: `search:read`, `users:read`, `im:read`
3. Add redirect URL: `https://your-app.vercel.app/api/auth/slack/callback`

## Trello Setup

1. Get your API key at [trello.com/power-ups/admin](https://trello.com/power-ups/admin)
2. Add redirect URL: `https://your-app.vercel.app/api/auth/trello/callback`

## GitHub Setup

1. Create an OAuth App at [github.com/settings/developers](https://github.com/settings/developers)
2. Set callback URL: `https://your-app.vercel.app/api/auth/github/callback`
3. Request scopes: `repo`, `read:user`

## Jira Cloud Setup

1. Create an OAuth 2.0 app at [developer.atlassian.com](https://developer.atlassian.com/console/myapps/)
2. Add callback URL: `https://your-app.vercel.app/api/auth/jira/callback`
3. Add scopes: `read:jira-user`, `read:jira-work`

## Milient / Moment Setup

Milient is a time management platform used by Norwegian consulting firms. The app resolves your Milient user from your Google sign-in email — no separate login needed.

1. Get your API key and company code from your Milient administrator.
2. Add them as `MILIENT_API_KEY` and `MILIENT_COMPANY_CODE`.

## Deploy to Vercel

1. Push to GitHub
2. Import the project at [vercel.com](https://vercel.com)
3. Add all environment variables (set `NEXTAUTH_URL` to your Vercel domain)
4. Deploy
5. Update all OAuth redirect URIs to your Vercel domain

## Tech Stack

| | |
|---|---|
| Framework | Next.js 14 (App Router) |
| Auth | NextAuth.js v5 (JWT, no database) |
| UI | shadcn/ui + Tailwind CSS v4 |
| AI | Google Gemini 2.5 Flash Lite |
| Time tracking | Milient / Moment |
| Icons | Lucide React |
| Hosting | Vercel |
