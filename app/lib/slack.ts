import { WebClient } from "@slack/web-api"

const userCache = new Map<string, string>()

function isUserId(str: string) {
  return /^U[A-Z0-9]+$/i.test(str)
}

function isDmChannelId(str: string) {
  return /^D[A-Z0-9]+$/i.test(str)
}

async function getUserName(client: WebClient, userId: string) {
  if (userCache.has(userId)) {
    return userCache.get(userId)!
  }

  try {
    const response = await client.users.info({ user: userId })
    const name = response.user?.real_name || response.user?.name || userId
    userCache.set(userId, name)
    return name
  } catch {
    userCache.set(userId, userId)
    return userId
  }
}

async function getDmUserName(client: WebClient, channelId: string) {
  const cacheKey = `dm:${channelId}`
  if (userCache.has(cacheKey)) {
    return userCache.get(cacheKey)!
  }

  try {
    const response = await client.conversations.info({ channel: channelId })
    const userId = (response.channel as any)?.user
    if (userId) {
      const name = await getUserName(client, userId)
      userCache.set(cacheKey, name)
      return name
    }
  } catch {
    // Ignore errors
  }

  userCache.set(cacheKey, "DM")
  return "DM"
}

export async function getMessages(date: string, token?: string) {
  const slackToken = token || process.env.SLACK_USER_TOKEN
  if (!slackToken) {
    console.log(`[Slack] Not configured, skipping`)
    return []
  }

  console.log(`[Slack] Fetching messages for ${date}`)
  const client = new WebClient(slackToken)
  const dateObj = new Date(date)
  const dateStr = dateObj.toISOString().split("T")[0]

  try {
    const searchResponse = await client.search.messages({
      query: `from:me on:${dateStr}`,
      sort: "timestamp",
      sort_dir: "asc",
      count: 100,
    })

    const matches = (searchResponse.messages?.matches as any[]) || []

    // Collect IDs to resolve
    const userIdsToResolve = new Set<string>()
    const dmChannelsToResolve = new Set<string>()

    for (const match of matches) {
      const channelName = match.channel?.name
      const channelId = match.channel?.id

      if (channelName && isUserId(channelName)) {
        userIdsToResolve.add(channelName)
      } else if (channelId && isDmChannelId(channelId)) {
        dmChannelsToResolve.add(channelId)
      }
    }

    // Resolve in parallel
    await Promise.all([
      ...Array.from(userIdsToResolve).map((id) => getUserName(client, id)),
      ...Array.from(dmChannelsToResolve).map((id) => getDmUserName(client, id)),
    ])

    // Build results grouped by channel+hour
    const groupedByChannelHour = new Map<string, any>()

    for (const match of matches) {
      let channel = match.channel?.name || "DM"
      const channelId = match.channel?.id
      let isDm = false

      if (isUserId(channel)) {
        channel = userCache.get(channel) || channel
        isDm = true
      } else if (isDmChannelId(channelId)) {
        channel = userCache.get(`dm:${channelId}`) || "DM"
        isDm = true
      }

      const timestamp = new Date(parseFloat(match.ts) * 1000)
      const hour = timestamp.getHours()
      const key = `${channel}-${hour}`

      if (!groupedByChannelHour.has(key)) {
        groupedByChannelHour.set(key, {
          source: "slack" as const,
          type: "message" as const,
          channel,
          channelId,
          isDm,
          text: match.text || "",
          timestamp,
        })
      }
    }

    const result = Array.from(groupedByChannelHour.values())
    console.log(`[Slack] Found ${result.length} conversations`)
    return result
  } catch (error) {
    console.error("Error fetching Slack messages:", error)
    return []
  }
}

export function isConfigured(token?: string) {
  return !!(token || process.env.SLACK_USER_TOKEN)
}
