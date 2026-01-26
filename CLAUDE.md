# Work Activity Tracker

Local web app for timesheet logging - shows hour-by-hour activity from Google (Calendar, Gmail, Docs) and Slack.

## Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: Vanilla HTML/JS (single file: `src/public/index.html`)
- **APIs**: Google (gmail, calendar, driveactivity v2), Slack (search, users, conversations)
- **Storage**: File-based token storage (`tokens.json`)

## Project Structure

```
src/
├── index.js           # Express server
├── config.js          # Env config loader
├── routes/
│   ├── auth.js        # Google OAuth flow
│   └── api.js         # /api/activities, /api/status
├── services/
│   ├── google.js      # Calendar, Gmail, Drive Activity APIs
│   ├── slack.js       # Slack search API + user resolution
│   └── tokens.js      # Token persistence
├── lib/
│   ├── aggregator.js  # Groups activities into hourly buckets (7-18)
│   └── keywords.js    # Keyword extraction
└── public/
    └── index.html     # Full frontend (styles + JS)
```

## Key Implementation Details

### Google Scopes
- `gmail.readonly` - Fetch emails
- `calendar.readonly` - Fetch calendar events
- `drive.activity.readonly` - Fetch doc/sheet edits, creates, deletes

### Slack Scopes (User Token)
- `search:read` - Search user's messages
- `users:read` - Resolve user IDs to names
- `im:read` - Get DM channel info

### Data Flow
1. `/api/activities?date=YYYY-MM-DD` fetches from all sources in parallel
2. `aggregator.js` buckets by hour, separates calendar (primaries) from communications
3. Frontend renders hour blocks with all calendar events + communications

### Display Rules
- Work hours: 7 AM - 6 PM
- Calendar events: All shown per hour (primaries array)
- Communications: Max 6/hour (day view), 4/hour (week view)
- Slack DMs: No `#` prefix, channels get `#` prefix
- Docs: Shows edit/create/delete/rename/move actions

## Running

```bash
cp .env.example .env  # Add credentials
npm install
npm start             # http://localhost:3000
```

## Common Issues

- **"Insufficient Permission"**: Delete `tokens.json`, re-authenticate
- **Missing doc activity**: Ensure "Drive Activity API" is enabled in Google Cloud Console
- **Slack rate limits**: Uses search API (1 call) instead of per-channel history
