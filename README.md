# Work Activity Tracker

A local web app to help with timesheet logging by showing hour-by-hour activity from Google Calendar, Gmail, Google Docs, and Slack.

## Features

- **Hour-by-hour timeline** (8:00 AM - 4:00 PM) showing your activities
- **Multi-source aggregation**:
  - Google Calendar (meetings with duration)
  - Gmail (emails sent/received)
  - Google Docs (documents edited)
  - Slack (messages by channel/person)
- **Day and week views** for reviewing activity
- **Local only** - runs on your machine, no cloud hosting

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up API Credentials

Copy the example environment file:

```bash
cp .env.example .env
```

Then fill in your credentials (see setup guides below).

### 3. Run the App

```bash
npm start
```

Open http://localhost:3000 in your browser.

---

## Setting Up Google (Gmail, Calendar, Docs)

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (e.g., "Work Activity Tracker")

### Step 2: Enable APIs

1. Go to **APIs & Services** > **Library**
2. Search and enable:
   - **Gmail API**
   - **Google Calendar API**
   - **Google Drive API**

### Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** > **OAuth consent screen**
2. Choose **External** (or Internal if using Google Workspace)
3. Fill in:
   - App name: "Work Activity Tracker"
   - User support email: your email
   - Developer contact: your email
4. Add scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/calendar.readonly`
   - `https://www.googleapis.com/auth/drive.metadata.readonly`
5. Add yourself as a test user

### Step 4: Create OAuth Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Application type: **Web application**
4. Name: "Work Activity Tracker"
5. Authorized redirect URIs: `http://localhost:3000/auth/google/callback`
6. Click **Create**
7. Copy the **Client ID** and **Client Secret** to your `.env` file

---

## Setting Up Slack

### Step 1: Create a Slack App

1. Go to [Slack API](https://api.slack.com/apps)
2. Click **Create New App** > **From scratch**
3. Name: "Activity Tracker"
4. Select your workspace

### Step 2: Configure Permissions

1. Go to **OAuth & Permissions**
2. Under **User Token Scopes** (not Bot Token), add:
   - `search:read` - Search messages
   - `users:read` - Get user info for DM names
   - `im:read` - Read DM channel info

### Step 3: Install to Workspace

1. Go to **Install App**
2. Click **Install to Workspace**
3. Copy the **User OAuth Token** (starts with `xoxp-`)
4. Add it to your `.env` file as `SLACK_USER_TOKEN`

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3000) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL |
| `SLACK_USER_TOKEN` | Slack user token (`xoxp-...`) |

---

## Project Structure

```
activity/
├── src/
│   ├── index.js           # Express server entry point
│   ├── config.js          # Configuration loader
│   ├── routes/
│   │   ├── auth.js        # Google OAuth flow
│   │   └── api.js         # API endpoints
│   ├── services/
│   │   ├── google.js      # Gmail, Calendar, Drive API
│   │   ├── slack.js       # Slack API
│   │   └── tokens.js      # Token storage
│   ├── lib/
│   │   ├── aggregator.js  # Hourly bucketing
│   │   └── keywords.js    # Keyword extraction
│   └── public/
│       └── index.html     # Frontend UI
├── .env.example           # Environment template
├── .gitignore
├── package.json
└── README.md
```

---

## Troubleshooting

### "Google authentication required"

Click "Connect Google Account" and complete the OAuth flow.

### "Insufficient Permission" for Docs

You need to re-authenticate after scope changes:
1. Click **Disconnect** next to Google
2. Click **Connect Google Account**
3. Grant the new permissions

### "Slack not configured"

Make sure `SLACK_USER_TOKEN` is set in `.env`.

### DM names showing as IDs

Add the `im:read` scope to your Slack app and reinstall it.

### Token expired

If you see "Token has been expired", click Disconnect then reconnect your Google account.

---

## License

MIT - Use freely for personal purposes.
