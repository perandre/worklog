# Worklog ⏱️

A summary of your day - shows hour-by-hour activity from Google (Calendar, Gmail, Docs) and Slack.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Auth**: NextAuth.js v5 (JWT mode, no database)
- **APIs**: Google (gmail, calendar, driveactivity v2), Slack (search, users, conversations)
- **Hosting**: Vercel

## Project Structure

```
app/
├── api/
│   ├── auth/[...nextauth]/route.ts  # NextAuth handler
│   ├── activities/route.ts          # GET /api/activities?date=YYYY-MM-DD
│   └── status/route.ts              # GET /api/status
├── components/
│   └── Activity.tsx                 # Activity item component
├── lib/
│   ├── auth.ts                      # NextAuth config + Google OAuth
│   ├── google.ts                    # Calendar, Gmail, Drive Activity APIs
│   ├── slack.ts                     # Slack search API + user resolution
│   └── aggregator.ts                # Hour bucketing logic
├── globals.css                      # All styles
├── layout.tsx                       # Root layout
└── page.tsx                         # Main page (client component)
```

## Key Implementation Details

### Google Scopes (requested via NextAuth)
- `gmail.readonly` - Fetch emails
- `calendar.readonly` - Fetch calendar events
- `drive.activity.readonly` - Fetch doc/sheet edits, creates, deletes

### Slack Scopes (User Token)
- `search:read` - Search user's messages
- `users:read` - Resolve user IDs to names
- `im:read` - Get DM channel info

### Auth Flow
- NextAuth handles Google OAuth with JWT strategy
- Access/refresh tokens stored in encrypted JWT cookie
- Auto-refresh when token expires

### Data Flow
1. `page.tsx` fetches `/api/activities?date=YYYY-MM-DD`
2. API route gets session, extracts access token
3. Calls Google/Slack APIs in parallel
4. `aggregator.ts` buckets by hour (7-18)
5. Returns `{ hours, summary, sources }`

### Display Rules
- Work hours: 7 AM - 6 PM
- Calendar events: All shown per hour (primaries array)
- Communications: Max 6/hour (day view), 4/hour (week view)
- Slack DMs: No `#` prefix, channels get `#` prefix
- Docs: Shows edit/create/delete/rename/move actions

## Running Locally

```bash
npm install
npm run dev  # http://localhost:3000
```

## Deploy to Vercel

1. Push to GitHub
2. Import in Vercel
3. Add environment variables (NEXTAUTH_SECRET, GOOGLE_*, SLACK_*)
4. Update Google OAuth redirect URI to production URL
