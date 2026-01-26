# Worklog ⏱️

A summary of your day. Shows hour-by-hour activity from Google Calendar, Gmail, Google Docs, and Slack.

## Setup

```bash
npm install
cp .env.example .env.local  # Add your credentials
npm run dev                  # Open http://localhost:3000
```

## Environment Variables

```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate-a-random-secret
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SLACK_USER_TOKEN=xoxp-...  # Optional
```

## Google Cloud Setup

1. Create project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable APIs: **Gmail API**, **Google Calendar API**, **Drive Activity API**
3. Configure OAuth consent screen
4. Create OAuth credentials (Web application)
   - Redirect URI: `http://localhost:3000/api/auth/callback/google`
   - For production: `https://your-app.vercel.app/api/auth/callback/google`

## Deploy to Vercel

1. Push to GitHub
2. Import in Vercel
3. Add environment variables
4. Deploy
