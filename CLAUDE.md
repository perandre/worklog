# Worklog

A summary of your day - shows hour-by-hour activity from Google (Calendar, Gmail, Docs) and Slack.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Auth**: NextAuth.js v5 (JWT mode, no database)
- **UI**: shadcn/ui + Tailwind CSS v4
- **Icons**: Lucide React
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
│   └── Activity.tsx                # Activity item with source icons
├── lib/
│   ├── auth.ts                     # NextAuth config + Google OAuth
│   ├── google.ts                   # Calendar, Gmail, Drive Activity APIs
│   ├── slack.ts                    # Slack search API + user resolution
│   └── aggregator.ts               # Hour bucketing logic
├── globals.css                     # Tailwind + shadcn CSS variables
├── layout.tsx                      # Root layout with dark mode
└── page.tsx                        # Main page (client component)

components/ui/                      # shadcn components
├── alert.tsx                       # Error messages
├── badge.tsx                       # Labels and status indicators
├── button.tsx                      # All buttons
├── card.tsx                        # Content containers
├── separator.tsx                   # Visual dividers
├── skeleton.tsx                    # Loading states
└── theme-toggle.tsx                # Dark/light mode switch

lib/
└── utils.ts                        # cn() class merge utility
```

## UI Components

### shadcn/ui
- `Button` - Navigation, actions, toggle buttons (ghost, secondary, outline variants)
- `Card` - Hour blocks, auth prompt, content containers
- `Badge` - "Today" indicator, service status (Google/Slack)
- `Alert` - Error messages (destructive variant)
- `Skeleton` - Loading placeholders
- `Separator` - Vertical divider in header

### Custom
- `Activity` - Renders items with colored source icons, supports compact mode
- `ThemeToggle` - Sun/moon icon button for dark/light mode

## Theming

Dark mode via CSS variables in `globals.css`:
1. Checks `localStorage` for saved preference
2. Falls back to system preference (`prefers-color-scheme`)
3. Toggle persists choice to `localStorage`

Brand colors (both themes):
- Slack: `#4A154B` (purple)
- Gmail: `#EA4335` (red)
- Calendar: `#4285F4` (blue)
- Docs: `#34A853` (green)

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
- Communications: Max 6/hour (day view), 3/hour (week view)
- Slack DMs: No `#` prefix, channels get `#` prefix
- Docs: Shows edit/create/delete/rename/move actions
- Duration: Click to copy (shows checkmark feedback)

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
