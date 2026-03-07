type HubSpotCookieData = {
  accessToken: string
  refreshToken: string
  expiresAt: number  // Unix ms
  portalId: number
}

export type HubSpotActivity = {
  source: "hubspot"
  type: "deal"
  timestamp: Date
  title: string
  detail?: string
  url?: string
}

function decodeCookie(encoded: string): string {
  return Buffer.from(encoded, "base64").toString("utf-8")
}

function encodeCookie(json: string): string {
  return Buffer.from(json).toString("base64")
}

export function isConfigured(tokenCookie?: string): boolean {
  if (!tokenCookie) return false
  try {
    const data = JSON.parse(decodeCookie(tokenCookie)) as Partial<HubSpotCookieData>
    return !!(data.refreshToken && data.portalId)
  } catch {
    return false
  }
}

async function getAccessToken(
  cookieData: HubSpotCookieData
): Promise<{ accessToken: string; updatedCookieData: HubSpotCookieData | null }> {
  // Refresh only if within 60s of expiry
  if (cookieData.expiresAt - Date.now() > 60_000) {
    return { accessToken: cookieData.accessToken, updatedCookieData: null }
  }

  console.log("[HubSpot] Refreshing token...")

  const res = await fetch("https://api.hubapi.com/oauth/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.HUBSPOT_CLIENT_ID!,
      client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
      refresh_token: cookieData.refreshToken,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error("[HubSpot] Token refresh failed", res.status, body)
    throw new Error("HubSpot token refresh failed")
  }

  const data = await res.json()
  const updatedCookieData: HubSpotCookieData = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || cookieData.refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
    portalId: cookieData.portalId,
  }

  console.log("[HubSpot] Token refreshed")
  return { accessToken: data.access_token, updatedCookieData }
}

export async function getHubSpotActivitiesForDate(
  date: string,
  tokenCookie?: string
): Promise<{ activities: HubSpotActivity[]; updatedTokenCookie: string | null }> {
  if (!tokenCookie || !isConfigured(tokenCookie)) {
    return { activities: [], updatedTokenCookie: null }
  }

  const cookieData = JSON.parse(decodeCookie(tokenCookie)) as HubSpotCookieData
  const { accessToken, updatedCookieData } = await getAccessToken(cookieData)
  const updatedTokenCookie = updatedCookieData ? encodeCookie(JSON.stringify(updatedCookieData)) : null
  const portalId = updatedCookieData?.portalId ?? cookieData.portalId

  try {
    const start = new Date(date + "T00:00:00.000Z").getTime()
    const end = new Date(date + "T23:59:59.999Z").getTime()

    const searchRes = await fetch("https://api.hubapi.com/crm/v3/objects/deals/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filterGroups: [{
          filters: [{
            propertyName: "hs_lastmodifieddate",
            operator: "BETWEEN",
            value: String(start),
            highValue: String(end),
          }],
        }],
        properties: ["dealname", "dealstage", "hs_lastmodifieddate"],
        limit: 100,
      }),
    })

    if (!searchRes.ok) {
      const body = await searchRes.text()
      console.error("[HubSpot] Deal search failed", searchRes.status, body)
      return { activities: [], updatedTokenCookie }
    }

    const searchData = await searchRes.json()
    const results = searchData.results || []
    console.log(`[HubSpot] ${results.length} deals modified on ${date}`)

    const activities: HubSpotActivity[] = results.map((deal: any) => ({
      source: "hubspot" as const,
      type: "deal" as const,
      timestamp: new Date(deal.properties.hs_lastmodifieddate),
      title: deal.properties.dealname || "Untitled deal",
      detail: deal.properties.dealstage || undefined,
      url: `https://app.hubspot.com/contacts/${portalId}/deal/${deal.id}`,
    }))

    return { activities, updatedTokenCookie }
  } catch (error) {
    console.error("[HubSpot] Error fetching activities", error)
    return { activities: [], updatedTokenCookie }
  }
}

export { encodeCookie }
