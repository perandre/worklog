const BASE_URL = process.env.MILIENT_BASE_URL || "https://app.moment.team"
const API_KEY = process.env.MILIENT_API_KEY || ""
const COMPANY = process.env.MILIENT_COMPANY_CODE || ""

type MilientPage<T> = {
  content: T[]
  page: { number: number; size: number; totalElements: number; totalPages: number }
}

type MilientOptions = {
  includes?: string
  params?: Record<string, string>
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  body?: unknown
}

export async function milientFetch<T>(entity: string, opts: MilientOptions = {}): Promise<T> {
  if (!API_KEY || !COMPANY) {
    throw new Error("Milient not configured: set MILIENT_API_KEY and MILIENT_COMPANY_CODE")
  }

  const { includes, params, method = "GET", body } = opts

  let url = `${BASE_URL}/api/1.0/companies/${COMPANY}/${entity}`
  if (includes) url += `/include/${includes}`

  if (params) {
    const searchParams = new URLSearchParams(params)
    const qs = searchParams.toString()
    if (qs) url += `?${qs}`
  }

  const credentials = Buffer.from(`apikey:${API_KEY}`).toString("base64")

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (process.env.MILIENT_DEBUG) {
    const clone = res.clone()
    const text = await clone.text()
    console.log(`[Milient] ${method} ${entity}:`, text.slice(0, 500))
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Milient ${res.status}: ${text}`)
  }

  return res.json()
}

// Simple TTL cache for data that rarely changes (projects, activity types)
const cache = new Map<string, { data: unknown; expires: number }>()
const TTL = 10 * 60 * 1000 // 10 minutes

// Fetch a paginated collection, returning just the content array (first page)
export async function milientList<T>(entity: string, opts: Omit<MilientOptions, "method"> = {}): Promise<T[]> {
  const data = await milientFetch<MilientPage<T>>(entity, { ...opts, method: "GET" })
  return data.content
}

// Fetch all items from a paginated collection using noLimit=true
export async function milientListAll<T>(entity: string, opts: Omit<MilientOptions, "method"> = {}): Promise<T[]> {
  return milientList<T>(entity, {
    ...opts,
    params: { ...opts.params, noLimit: "true" },
  })
}

export async function cachedFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const entry = cache.get(key)
  if (entry && Date.now() < entry.expires) return entry.data as T
  const data = await fetcher()
  cache.set(key, { data, expires: Date.now() + TTL })
  return data
}

export async function resolveUserAccountId(email: string): Promise<string> {
  return cachedFetch(`uid:${email}`, async () => {
    // Use include/base+email so the email field is returned
    const users = await milientListAll<any>("userAccounts", {
      includes: "base+email",
    })
    const match = users.find(
      (u: any) => u.email?.toLowerCase() === email.toLowerCase()
    )
    if (!match) throw new Error(`Milient: no user found for email ${email}`)
    return String(match.id)
  })
}
