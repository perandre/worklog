# Worklog ⏱️

A summary of your day. Shows hour-by-hour activity from Google Calendar, Gmail, Google Docs, and Slack.

## Quick Start

```bash
cp .env.example .env  # Add your credentials
npm install
npm start             # Open http://localhost:3000
```

## Setup

### Google

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable APIs: **Gmail API**, **Google Calendar API**, **Drive Activity API**
3. Configure OAuth consent screen, add yourself as test user
4. Create OAuth credentials (Web application)
   - Redirect URI: `http://localhost:3000/auth/google/callback`
5. Copy Client ID and Secret to `.env`

### Slack

1. Create an app at [api.slack.com/apps](https://api.slack.com/apps)
2. Add **User Token Scopes**: `search:read`, `users:read`, `im:read`
3. Install to workspace
4. Copy User OAuth Token (`xoxp-...`) to `.env`

## Environment Variables

```
PORT=3000
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
SLACK_USER_TOKEN=xoxp-...
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Insufficient Permission" | Delete `tokens.json` and re-authenticate |
| Missing doc activity | Enable "Drive Activity API" in Google Cloud Console |
| DM names showing as IDs | Add `im:read` scope to Slack app and reinstall |
