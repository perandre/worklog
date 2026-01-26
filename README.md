# Worklog

A summary of your day. Shows hour-by-hour activity from Google Calendar, Gmail, Google Docs, and Slack.

Built with Next.js 14, shadcn/ui, and Tailwind CSS. Supports dark mode.

## Setup

```bash
npm install
cp .env.example .env.local  # Add your credentials
npm run dev                  # Open http://localhost:3000
```

## Environment Variables

```
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=generate-a-random-secret
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SLACK_CLIENT_ID=...
SLACK_CLIENT_SECRET=...
```

## Google Cloud Setup

1. Create project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable APIs: **Gmail API**, **Google Calendar API**, **Drive Activity API**
3. Configure OAuth consent screen (add test users if in testing mode)
4. Create OAuth credentials (Web application)
   - Redirect URI: `https://your-app.vercel.app/api/auth/callback/google`

## Slack Setup

1. Create app at [api.slack.com/apps](https://api.slack.com/apps)
2. Under **OAuth & Permissions**, add User Token Scopes: `search:read`, `users:read`, `im:read`
3. Add redirect URL: `https://your-app.vercel.app/api/auth/slack/callback`
4. Copy Client ID and Client Secret to environment variables

## Deploy to Vercel

1. Push to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add all environment variables (set NEXTAUTH_URL to your Vercel domain)
4. Deploy
5. Update Google and Slack redirect URIs to match your Vercel URL

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **UI**: shadcn/ui + Tailwind CSS v4
- **Auth**: NextAuth.js v5
- **Icons**: Lucide React
- **APIs**: Google APIs, Slack Web API
