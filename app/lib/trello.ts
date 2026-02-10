type TrelloActionType =
  | "createCard"
  | "updateCard"
  | "commentCard"
  | "addChecklistToCard"
  | "addAttachmentToCard"
  | "updateCheckItemStateOnCard"
  | "updateCard:idList"
  | "updateCard:closed"

type TrelloAction = {
  id: string
  type: TrelloActionType | string
  date: string
  data: {
    card?: {
      id: string
      name: string
      shortLink?: string
    }
    board?: {
      id: string
      name: string
    }
    list?: {
      id: string
      name: string
    }
    text?: string
    [key: string]: any
  }
}

export type TrelloActivity = {
  source: "trello"
  type: string
  timestamp: Date
  cardName: string
  boardName?: string
  listName?: string
  commentText?: string
  url?: string
}

type TrelloClientOptions = {
  apiKey?: string
  token?: string
}

function getBaseParams(options?: TrelloClientOptions) {
  const key = options?.apiKey || process.env.TRELLO_API_KEY
  const token = options?.token || process.env.TRELLO_TOKEN

  if (!key || !token) {
    console.log("[Trello] Not configured, skipping")
    return null
  }

  return { key, token }
}

export function isConfigured(options?: TrelloClientOptions) {
  const params = getBaseParams(options)
  return !!params
}

function buildCardUrl(card: TrelloAction["data"]["card"] | undefined) {
  if (!card?.shortLink) return undefined
  return `https://trello.com/c/${card.shortLink}`
}

function normalizeActionToActivity(action: TrelloAction): TrelloActivity | null {
  const { data, type, date } = action
  if (!data.card) return null

  const cardName = data.card.name
  const boardName = data.board?.name
  const listName = data.list?.name
  const url = buildCardUrl(data.card)

  let activityType = "card"
  let commentText: string | undefined

  switch (type) {
    case "createCard":
      activityType = "card_created"
      break
    case "commentCard":
      activityType = "card_commented"
      commentText = data.text
      break
    case "updateCard":
    case "updateCard:idList":
      activityType = "card_moved"
      break
    case "updateCard:closed":
      activityType = "card_archived"
      break
    default:
      activityType = type
  }

  return {
    source: "trello",
    type: activityType,
    timestamp: new Date(date),
    cardName,
    boardName,
    listName,
    commentText,
    url,
  }
}

export async function getTrelloActivitiesForDate(
  date: string,
  options?: TrelloClientOptions & { member?: "me" | string }
): Promise<TrelloActivity[]> {
  const params = getBaseParams(options)
  if (!params) return []

  const member = options?.member || "me"

  const dateObj = new Date(date)
  if (isNaN(dateObj.getTime())) {
    console.warn("[Trello] Invalid date passed to getTrelloActivitiesForDate, expected YYYY-MM-DD")
    return []
  }

  // Trello does not support strict date filtering in all endpoints.
  // We fetch a reasonable page of recent actions and then filter locally.
  const since = new Date(dateObj)
  since.setHours(0, 0, 0, 0)
  const until = new Date(dateObj)
  until.setHours(23, 59, 59, 999)

  const query = new URLSearchParams({
    key: params.key,
    token: params.token,
    limit: "200",
    // Using `since` to reduce data volume; we will also filter client-side.
    since: since.toISOString(),
  })

  const url = `https://api.trello.com/1/members/${member}/actions?${query.toString()}`

  try {
    console.log(`[Trello] Fetching activities for ${date}`)
    const res = await fetch(url, {
      // Next.js RequestInit; this is a simple GET
      cache: "no-store",
    })

    if (!res.ok) {
      console.error("[Trello] Failed to fetch actions", res.status, res.statusText)
      return []
    }

    const actions = (await res.json()) as TrelloAction[]

    const filtered = actions.filter((action) => {
      const actionDate = new Date(action.date)
      return actionDate >= since && actionDate <= until
    })

    const activities = filtered
      .map(normalizeActionToActivity)
      .filter((a): a is TrelloActivity => a !== null)

    console.log(`[Trello] Found ${activities.length} activities`)
    return activities
  } catch (error) {
    console.error("[Trello] Error fetching actions", error)
    return []
  }
}

