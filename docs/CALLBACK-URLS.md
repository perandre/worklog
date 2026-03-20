# OAuth Callback URLs — Edit Links per Service

Quick reference for where to update callback/redirect URLs when the domain changes.

**Production callback pattern:** `https://<YOUR_DOMAIN>/api/auth/<service>/callback`

---

## Google OAuth

- **Callback URL:** `/api/auth/callback/google` (NextAuth managed)
- **Edit here:** https://console.cloud.google.com/apis/credentials
  1. Open the OAuth 2.0 Client ID used by this app
  2. Under **Authorized redirect URIs**, update the URL
  3. Also update **Authorized JavaScript origins** if the domain changed

## Slack

- **Callback URL:** `/api/auth/slack/callback`
- **Edit here:** https://app.slack.com/app-settings/T02NCLXV2/A0AA2K14ZNK/oauth
  1. Update **Redirect URLs**
  3. Note: Slack requires **HTTPS** even for localhost

## GitHub

- **Callback URL:** `/api/auth/github/callback`
- **Edit here:** https://github.com/settings/developers
  1. Select your OAuth App
  2. Update **Authorization callback URL**

## Jira Cloud (Atlassian)

- **Callback URL:** `/api/auth/jira/callback`
- **Edit here:** https://developer.atlassian.com/console/myapps/
  1. Select your app → **Authorization** → **OAuth 2.0 (3LO)**
  2. Update **Callback URL**

## HubSpot

- **Callback URL:** `/api/auth/hubspot/callback`
- **Edit here:** https://app.hubspot.com/developer/apps
  1. Select your app → **Auth**
  2. Update **Redirect URLs**
  3. Note: HubSpot requires **HTTPS** for redirect URLs

## Trello

- **Return URL:** `/trello-auth-complete` (fragment-based token flow, not standard OAuth)
- **Edit here:** https://trello.com/power-ups/admin
  1. Select your Power-Up / app
  2. Update **Allowed Origins** to include your domain
  3. The return URL is set dynamically in code (`app/api/auth/trello/route.ts`), not in Trello's dashboard

---

## Vercel Environment Variables

When the domain changes, also update `NEXTAUTH_URL` in Vercel:
- **Edit here:** https://vercel.com/team_vAtwKgv4aFHvK6CRhDhMSAjH/worklog-xeqe/settings/environment-variables
