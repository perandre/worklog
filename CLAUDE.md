# Worklog

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
│   ├── auth/
│   │   ├── [...nextauth]/route.ts  # NextAuth handler
│   │   └── slack/
│   │       ├── route.ts            # GET - Initiates Slack OAuth
│   │       ├── callback/route.ts   # GET - Handles OAuth callback
│   │       └── disconnect/route.ts # POST - Clears Slack token
│   ├── activities/route.ts         # GET /api/activities?date=YYYY-MM-DD
│   └── status/route.ts             # GET /api/status
├── components/
│   └── Activity.tsx                # Activity item component
├── lib/
│   ├── auth.ts                     # NextAuth config + Google OAuth
│   ├── google.ts                   # Calendar, Gmail, Drive Activity APIs
│   ├── slack.ts                    # Slack search API + user resolution
│   └── aggregator.ts               # Hour bucketing logic
├── globals.css                     # All styles
├── layout.tsx                      # Root layout
└── page.tsx                        # Main page (client component)
```

## Auth

### Google (via NextAuth)
- Scopes: `gmail.readonly`, `calendar.readonly`, `drive.activity.readonly`
- Tokens stored in encrypted JWT cookie
- Auto-refresh on expiry

### Slack (custom OAuth)
- Scopes: `search:read`, `users:read`, `im:read`
- User token stored in HTTP-only cookie (`slack_token`)
- Each user authenticates with their own Slack account

## Data Flow

1. `page.tsx` fetches `/api/activities?date=YYYY-MM-DD`
2. API route gets Google token from session, Slack token from cookie
3. Calls Google/Slack APIs in parallel
4. `aggregator.ts` buckets activities by hour (7-18)
5. Returns `{ hours, summary, sources }`

## Display Rules

- Work hours: 7 AM - 6 PM
- Calendar events: All shown per hour (`primaries` array)
- Communications: Max 6/hour (day view), 4/hour (week view)
- Slack DMs: No `#` prefix, channels get `#` prefix
- Docs: Shows edit/create/delete/rename/move actions

## Running Locally

```bash
npm install
npm run dev  # http://localhost:3000
```

Note: Slack OAuth requires HTTPS. For local Slack testing, use ngrok or deploy to Vercel first.

## Environment Variables

```
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=random-secret
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SLACK_CLIENT_ID=...
SLACK_CLIENT_SECRET=...
```
