export type JiraTokenData = {
  accessToken: string
  refreshToken: string
  cloudId: string
  siteUrl: string
  expiresAt: number
}

export type JiraActivity = {
  source: "jira"
  type: "issue_transitioned" | "issue_commented"
  timestamp: Date
  issueKey: string
  issueSummary: string
  projectName: string
  detail?: string
  url?: string
}

export function isConfigured(tokenJson?: string): boolean {
  if (!tokenJson) return false
  try {
    const data = JSON.parse(tokenJson) as Partial<JiraTokenData>
    return !!(data.accessToken && data.refreshToken && data.cloudId)
  } catch {
    return false
  }
}

export async function ensureFreshToken(
  tokenJson: string
): Promise<{ token: JiraTokenData; updatedJson: string | null }> {
  const token = JSON.parse(tokenJson) as JiraTokenData

  // If token doesn't expire within 60s, return as-is
  if (token.expiresAt && Date.now() < token.expiresAt - 60_000) {
    return { token, updatedJson: null }
  }

  console.log("[Jira] Token expired or expiring soon, refreshing...")

  const res = await fetch("https://auth.atlassian.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: process.env.JIRA_CLIENT_ID!,
      client_secret: process.env.JIRA_CLIENT_SECRET!,
      refresh_token: token.refreshToken,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error("[Jira] Token refresh failed", res.status, body)
    throw new Error("Jira token refresh failed")
  }

  const data = await res.json()
  const updatedToken: JiraTokenData = {
    ...token,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || token.refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  }

  const updatedJson = JSON.stringify(updatedToken)
  console.log("[Jira] Token refreshed successfully")
  return { token: updatedToken, updatedJson }
}

function extractTextFromAdf(node: any): string {
  if (!node) return ""
  if (typeof node === "string") return node
  if (node.type === "text") return node.text || ""
  if (Array.isArray(node.content)) {
    return node.content.map(extractTextFromAdf).join("")
  }
  return ""
}

export async function getJiraActivitiesForDate(
  date: string,
  tokenJson?: string
): Promise<{ activities: JiraActivity[]; updatedTokenJson: string | null }> {
  if (!tokenJson || !isConfigured(tokenJson)) {
    return { activities: [], updatedTokenJson: null }
  }

  const { token, updatedJson } = await ensureFreshToken(tokenJson)

  try {
    // Get current user's accountId
    const meRes = await fetch("https://api.atlassian.com/me", {
      headers: { Authorization: `Bearer ${token.accessToken}`, Accept: "application/json" },
    })
    if (!meRes.ok) {
      console.error("[Jira] Failed to fetch /me", meRes.status)
      return { activities: [], updatedTokenJson: updatedJson }
    }
    const me = await meRes.json()
    const accountId = me.account_id
    console.log(`[Jira] Authenticated as ${me.name || accountId}`)

    // JQL search for issues updated on the target date
    const nextDate = new Date(date + "T00:00:00Z")
    nextDate.setUTCDate(nextDate.getUTCDate() + 1)
    const nextDateStr = nextDate.toISOString().split("T")[0]

    const jql = `updated >= "${date}" AND updated < "${nextDateStr}" ORDER BY updated DESC`
    const searchUrl = new URL(`https://api.atlassian.com/ex/jira/${token.cloudId}/rest/api/3/search`)
    searchUrl.searchParams.set("jql", jql)
    searchUrl.searchParams.set("expand", "changelog")
    searchUrl.searchParams.set("fields", "summary,project,comment")
    searchUrl.searchParams.set("maxResults", "100")

    const searchRes = await fetch(searchUrl.toString(), {
      headers: { Authorization: `Bearer ${token.accessToken}`, Accept: "application/json" },
    })
    if (!searchRes.ok) {
      const body = await searchRes.text()
      console.error("[Jira] Search failed", searchRes.status, body)
      return { activities: [], updatedTokenJson: updatedJson }
    }

    const searchData = await searchRes.json()
    const issues = searchData.issues || []
    console.log(`[Jira] Found ${issues.length} issues updated on ${date}`)

    const activities: JiraActivity[] = []
    const dayStart = new Date(date + "T00:00:00")
    const dayEnd = new Date(date + "T23:59:59.999")

    for (const issue of issues) {
      const issueKey = issue.key
      const issueSummary = issue.fields?.summary || ""
      const projectName = issue.fields?.project?.name || ""
      const issueUrl = token.siteUrl
        ? `${token.siteUrl}/browse/${issueKey}`
        : undefined

      // Status transitions from changelog
      const histories = issue.changelog?.histories || []
      for (const history of histories) {
        const historyDate = new Date(history.created)
        if (historyDate < dayStart || historyDate > dayEnd) continue
        if (history.author?.accountId !== accountId) continue

        for (const item of history.items || []) {
          if (item.field === "status") {
            activities.push({
              source: "jira",
              type: "issue_transitioned",
              timestamp: historyDate,
              issueKey,
              issueSummary,
              projectName,
              detail: `${item.fromString} → ${item.toString}`,
              url: issueUrl,
            })
          }
        }
      }

      // Comments by user on this date
      const comments = issue.fields?.comment?.comments || []
      for (const comment of comments) {
        const commentDate = new Date(comment.created)
        if (commentDate < dayStart || commentDate > dayEnd) continue
        if (comment.author?.accountId !== accountId) continue

        const text = extractTextFromAdf(comment.body)
        activities.push({
          source: "jira",
          type: "issue_commented",
          timestamp: commentDate,
          issueKey,
          issueSummary,
          projectName,
          detail: text.slice(0, 120),
          url: issueUrl,
        })
      }
    }

    console.log(`[Jira] ${activities.length} activities for ${date}`)
    return { activities, updatedTokenJson: updatedJson }
  } catch (error) {
    console.error("[Jira] Error fetching activities", error)
    return { activities: [], updatedTokenJson: updatedJson }
  }
}
