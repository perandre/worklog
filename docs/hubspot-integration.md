# HubSpot Integration Plan

## Goal

Show HubSpot deal activity in the daily feed — any deal that was modified today indicates
that work happened in HubSpot. One activity per deal, no classification of what changed.
Same pattern as Jira/GitHub/Docs.

---

## Env vars required

```
HUBSPOT_CLIENT_ID=
HUBSPOT_CLIENT_SECRET=
```

Add both to `.env.local` and Vercel project settings.

---

## Auth flow

HubSpot uses short-lived access tokens (30 min) + long-lived refresh tokens — identical
pattern to Jira.

### Cookie: `hubspot_token`

Stores base64-encoded JSON:

```ts
type HubSpotCookieData = {
  accessToken: string
  refreshToken: string
  expiresAt: number  // Unix ms
  portalId: number   // needed for deal URLs
}
```

Unlike Jira's JWT (too large for cookies), HubSpot access tokens are short strings, so we
store the full set including `accessToken`. On each request check `expiresAt`; refresh
only when within 60s of expiry.

### OAuth endpoints

| Step | URL |
|---|---|
| Authorize | `https://app.hubspot.com/oauth/authorize` |
| Token exchange | `POST https://api.hubapi.com/oauth/v1/token` |
| Token refresh | `POST https://api.hubapi.com/oauth/v1/token` (same, different grant_type) |
| Get portal ID | `GET https://api.hubapi.com/oauth/v1/access-tokens/{token}` → `.hub_id` |

### Scopes

```
crm.objects.deals.read
```

### State / CSRF

Same pattern as Jira: generate `crypto.randomUUID()`, store in `hubspot_oauth_state`
cookie (maxAge 300s), verify on callback.

---

## Fetch strategy

Use the **CRM Search API** to find deals modified on the target date:

```
POST https://api.hubapi.com/crm/v3/objects/deals/search
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "filterGroups": [{
    "filters": [{
      "propertyName": "hs_lastmodifieddate",
      "operator": "BETWEEN",
      "value": "<start-of-day UTC ms>",
      "highValue": "<end-of-day UTC ms>"
    }]
  }],
  "properties": ["dealname", "dealstage", "hs_lastmodifieddate"],
  "limit": 100
}
```

Date math:
```ts
const start = new Date(date + "T00:00:00.000Z").getTime()   // ms
const end   = new Date(date + "T23:59:59.999Z").getTime()   // ms
```

**Known limitation**: `hs_lastmodifieddate` includes system/automated changes, not just
manual work by the user. No per-user filter is available without the Audit Log API
(Enterprise only). For a personal time tracker this is acceptable — treat it as a signal.

---

## `HubSpotActivity` shape

```ts
export type HubSpotActivity = {
  source: "hubspot"
  type: "deal"
  timestamp: Date       // hs_lastmodifieddate
  title: string         // dealname
  detail?: string       // dealstage (human-readable if possible)
  url?: string          // https://app.hubspot.com/contacts/{portalId}/deal/{dealId}
}
```

Deal URL pattern: `https://app.hubspot.com/contacts/{portalId}/deal/{dealId}`
The `id` field on each search result is the deal ID.

---

## Files to create

### 1. `app/lib/hubspot.ts`

Structure (mirrors `app/lib/jira.ts`):

```
- HubSpotCookieData type
- HubSpotActivity type
- decodeCookie / encodeCookie  (same base64 helpers as Jira)
- isConfigured(tokenCookie?)   → checks refreshToken present
- getAccessToken(cookieData)   → refresh if expiresAt within 60s, return { accessToken, updatedCookieData | null }
- getHubSpotActivitiesForDate(date, tokenCookie?)
    → returns { activities: HubSpotActivity[], updatedTokenCookie: string | null }
```

Token refresh call:
```ts
fetch("https://api.hubapi.com/oauth/v1/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "refresh_token",
    client_id: process.env.HUBSPOT_CLIENT_ID!,
    client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
    refresh_token: cookieData.refreshToken,
  }),
})
// Response: { access_token, refresh_token, expires_in (seconds) }
// expiresAt = Date.now() + expires_in * 1000
```

### 2. `app/api/auth/hubspot/route.ts`

```ts
// GET — redirect to HubSpot OAuth
const authUrl = new URL("https://app.hubspot.com/oauth/authorize")
authUrl.searchParams.set("client_id", process.env.HUBSPOT_CLIENT_ID!)
authUrl.searchParams.set("scope", "crm.objects.deals.read")
authUrl.searchParams.set("redirect_uri", `${process.env.NEXTAUTH_URL}/api/auth/hubspot/callback`)
authUrl.searchParams.set("state", state)
return NextResponse.redirect(authUrl.toString())
```

### 3. `app/api/auth/hubspot/callback/route.ts`

Steps:
1. Verify state cookie
2. `POST https://api.hubapi.com/oauth/v1/token` with `grant_type=authorization_code`
3. `GET https://api.hubapi.com/oauth/v1/access-tokens/{access_token}` → extract `hub_id`
4. Build cookie: `{ accessToken, refreshToken, expiresAt: Date.now() + expires_in * 1000, portalId: hub_id }`
5. Store as base64 in `hubspot_token` cookie (httpOnly, secure, sameSite=lax, maxAge=1yr)
6. Redirect to `/?hubspot_connected=true`

Token exchange body (note: `application/x-www-form-urlencoded`, not JSON):
```
grant_type=authorization_code
client_id=...
client_secret=...
code=...
redirect_uri=...
```

### 4. `app/api/auth/hubspot/disconnect/route.ts`

```ts
// POST — delete cookie
cookieStore.delete("hubspot_token")
return NextResponse.json({ success: true })
```

---

## Files to modify

### `app/api/activities/route.ts`

1. Import: `import { getHubSpotActivitiesForDate } from "@/app/lib/hubspot"`
2. Read cookie: `const hubspotTokenCookie = cookieStore.get("hubspot_token")?.value`
3. Add to `Promise.all`:
   ```ts
   getHubSpotActivitiesForDate(date, hubspotTokenCookie).catch(...return { activities: [], updatedTokenCookie: null })
   ```
4. Extract: `const hubspotActivities = hubspotResult.activities || []`
5. Spread into `allActivities`
6. Add `hubspot: hubspotActivities.length` to `sources`
7. Set updated token cookie on response (same pattern as Jira)

### `app/api/status/route.ts`

```ts
import { isConfigured as isHubSpotConfigured } from "@/app/lib/hubspot"
// ...
const hubspotToken = cookieStore.get("hubspot_token")?.value
// in return:
hubspot: isHubSpotConfigured(hubspotToken),
```

### `app/page.tsx`

1. Add `hubspot: false` to initial `serviceStatus`
2. Add connect banner (same structure as Jira/GitHub banners):
   - Icon: orange circle with "H" (no dedicated lucide icon — use initials or Briefcase)
   - Connect href: `/api/auth/hubspot`
   - Dismiss key: `hubspot-banner-dismissed`
3. Add footer badge (connected → shows disconnect button; disconnected → link to connect)

### `app/components/Activity.tsx`

Add HubSpot to source config:

```ts
hubspot: {
  label: "HubSpot",
  color: "bg-[#FF7A59]",     // HubSpot brand orange
  textColor: "text-[#FF7A59]",
  // SVG: HubSpot sprocket logo, or a simple "HS" text badge
}
```

Activity display: `title` = deal name, `detail` = stage name shown as muted subtitle.

---

## Aggregator (`app/lib/aggregator.ts`)

Check if `"hubspot"` needs to be added to the `source` union type in the aggregator.
If activities are typed by a union, add `"hubspot"` to it.

---

## Testing checklist

- [ ] OAuth flow completes and `hubspot_token` cookie is set
- [ ] `/api/status` returns `hubspot: true` after connecting
- [ ] Deals modified today appear in day view
- [ ] Token auto-refreshes after 30 min (check logs for `[HubSpot] Refreshing token...`)
- [ ] Disconnect clears cookie and banner reappears
- [ ] No HubSpot calls made when cookie absent (returns `[]` immediately)
- [ ] Deal URL opens correct HubSpot record
