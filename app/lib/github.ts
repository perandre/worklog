export type GitHubActivity = {
  source: "github"
  type: string
  timestamp: Date
  title: string
  repoName: string
  url?: string
}

type GitHubEvent = {
  id: string
  type: string
  created_at: string
  repo: { name: string }
  payload: any
}

export function isConfigured(token?: string) {
  return !!token
}

function shortRepoName(fullName: string) {
  // "owner/repo" → "repo"
  return fullName.split("/").pop() || fullName
}

function normalizeEvent(event: GitHubEvent): GitHubActivity[] {
  const timestamp = new Date(event.created_at)
  const repoName = shortRepoName(event.repo.name)
  const activities: GitHubActivity[] = []

  switch (event.type) {
    case "PushEvent": {
      const commits = event.payload.commits || []
      for (const commit of commits) {
        const firstLine = (commit.message || "").split("\n")[0]
        activities.push({
          source: "github",
          type: "commit",
          timestamp,
          title: firstLine,
          repoName,
          url: `https://github.com/${event.repo.name}/commit/${commit.sha}`,
        })
      }
      break
    }
    case "PullRequestEvent": {
      const pr = event.payload.pull_request
      const action = event.payload.action
      if (action === "opened") {
        activities.push({
          source: "github",
          type: "pr_opened",
          timestamp,
          title: `Opened PR: ${pr.title}`,
          repoName,
          url: pr.html_url,
        })
      } else if (action === "closed" && pr.merged) {
        activities.push({
          source: "github",
          type: "pr_merged",
          timestamp,
          title: `Merged PR: ${pr.title}`,
          repoName,
          url: pr.html_url,
        })
      }
      break
    }
    case "PullRequestReviewEvent": {
      const pr = event.payload.pull_request
      activities.push({
        source: "github",
        type: "pr_reviewed",
        timestamp,
        title: `Reviewed PR: ${pr.title}`,
        repoName,
        url: pr.html_url,
      })
      break
    }
    case "PullRequestReviewCommentEvent": {
      const pr = event.payload.pull_request
      activities.push({
        source: "github",
        type: "review_comment",
        timestamp,
        title: `Review comment on: ${pr.title}`,
        repoName,
        url: event.payload.comment?.html_url || pr.html_url,
      })
      break
    }
    case "IssuesEvent": {
      const issue = event.payload.issue
      if (event.payload.action === "opened") {
        activities.push({
          source: "github",
          type: "issue_opened",
          timestamp,
          title: `Opened issue: ${issue.title}`,
          repoName,
          url: issue.html_url,
        })
      }
      break
    }
    case "IssueCommentEvent": {
      const issue = event.payload.issue
      activities.push({
        source: "github",
        type: "issue_commented",
        timestamp,
        title: `Commented on: ${issue.title}`,
        repoName,
        url: event.payload.comment?.html_url || issue.html_url,
      })
      break
    }
  }

  return activities
}

export async function getGitHubActivitiesForDate(
  date: string,
  token?: string
): Promise<GitHubActivity[]> {
  if (!token) {
    console.log("[GitHub] No token, skipping")
    return []
  }

  const dateObj = new Date(date)
  if (isNaN(dateObj.getTime())) {
    console.warn("[GitHub] Invalid date passed, expected YYYY-MM-DD")
    return []
  }

  const dayStart = new Date(dateObj)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dateObj)
  dayEnd.setHours(23, 59, 59, 999)

  console.log(`[GitHub] Fetching activities for ${date}, dayStart=${dayStart.toISOString()}, dayEnd=${dayEnd.toISOString()}`)

  try {
    // Get username
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    })

    if (!userRes.ok) {
      const body = await userRes.text()
      console.error("[GitHub] Failed to fetch user", userRes.status, body)
      return []
    }

    const user = await userRes.json()
    const username = user.login
    console.log(`[GitHub] Authenticated as ${username}`)

    // Paginate events
    const allActivities: GitHubActivity[] = []
    let page = 1
    const maxPages = 10

    while (page <= maxPages) {
      console.log(`[GitHub] Fetching events page ${page} for ${username}`)
      const eventsRes = await fetch(
        `https://api.github.com/users/${username}/events?per_page=100&page=${page}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
          },
        }
      )

      if (!eventsRes.ok) {
        const body = await eventsRes.text()
        console.error("[GitHub] Failed to fetch events", eventsRes.status, body)
        break
      }

      const events = (await eventsRes.json()) as GitHubEvent[]
      console.log(`[GitHub] Page ${page}: ${events.length} events`)
      if (events.length === 0) break

      // Log first and last event timestamps on this page
      if (events.length > 0) {
        console.log(`[GitHub] Page ${page} range: ${events[0].created_at} → ${events[events.length - 1].created_at}`)
      }

      let foundOlder = false
      for (const event of events) {
        const eventDate = new Date(event.created_at)

        if (eventDate < dayStart) {
          console.log(`[GitHub] Hit older event (${event.created_at}), stopping pagination`)
          foundOlder = true
          break
        }

        if (eventDate <= dayEnd) {
          const normalized = normalizeEvent(event)
          if (normalized.length > 0) {
            console.log(`[GitHub] Matched: ${event.type} at ${event.created_at} → ${normalized.length} activities`)
          } else {
            console.log(`[GitHub] Skipped: ${event.type} at ${event.created_at} (unhandled type or filtered)`)
          }
          allActivities.push(...normalized)
        } else {
          console.log(`[GitHub] Skipped: ${event.type} at ${event.created_at} (future of target day)`)
        }
      }

      if (foundOlder) break
      page++
    }

    // Deduplicate by type-title-hour
    const seen = new Set<string>()
    const deduped = allActivities.filter((a) => {
      const hour = a.timestamp.getHours()
      const key = `${a.type}-${a.title}-${hour}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    console.log(`[GitHub] Total before dedup: ${allActivities.length}, after dedup: ${deduped.length}`)
    return deduped
  } catch (error) {
    console.error("[GitHub] Error fetching activities", error)
    return []
  }
}
