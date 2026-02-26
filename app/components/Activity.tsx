"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Copy, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/app/lib/i18n"

function truncateText(text: string, maxLen = 40) {
  if (!text) return ""
  return text.length > maxLen ? text.substring(0, maxLen) + "..." : text
}

function formatDuration(startStr: string, endStr: string) {
  if (!startStr || !endStr) return null
  const start = new Date(startStr)
  const end = new Date(endStr)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null
  const diffMs = end.getTime() - start.getTime()
  const diffMins = Math.round(diffMs / 60000)
  const hours = Math.floor(diffMins / 60)
  const mins = diffMins % 60
  return `${hours}:${mins.toString().padStart(2, "0")}`
}

const sourceConfig = {
  calendar: { svg: "/google-calendar.svg" },
  gmail:    { svg: "/gmail.svg" },
  slack:    { svg: "/slack.svg" },
  docs:     { svg: "/google-drive.svg" },
  trello:   { svg: "/trello.svg" },
  github:   { svg: "/github.svg" },
  jira:     { svg: "/jira.svg" },
} as const

type Source = keyof typeof sourceConfig

interface ActivityProps {
  activity: any
  compact?: boolean
  isHighlighted?: boolean
}

export default function Activity({ activity, compact = false, isHighlighted = false }: ActivityProps) {
  const [copied, setCopied] = useState(false)
  const { t } = useTranslation()

  let title = ""
  let meta = ""
  let duration: string | null = null

  if (activity.source === "calendar") {
    if (activity.isSpanning) {
      return (
        <div className={cn("flex items-center gap-2", compact ? "text-xs" : "")}>
          <SourceIcon source="calendar" compact={compact} />
          <span className="text-muted-foreground truncate">
            {truncateText(activity.title, compact ? 20 : 35)} {t("activity.cont")}
          </span>
        </div>
      )
    }
    title = truncateText(activity.title, compact ? 25 : 40)
    duration = formatDuration(activity.timestamp, activity.endTime)
    if (activity.attendees?.length > 0) {
      const count = activity.attendees.length
      meta = `${count} ${count > 1 ? t("activity.attendees") : t("activity.attendee")}`
    }
  } else if (activity.source === "slack") {
    title = activity.isDm ? activity.channel : `#${activity.channel}`
    meta = truncateText(activity.text, compact ? 30 : 60)
  } else if (activity.source === "gmail") {
    title = truncateText(activity.subject, compact ? 25 : 40)
    meta = activity.from ? `From: ${activity.from.split("<")[0].trim()}` : ""
  } else if (activity.source === "docs") {
    title = truncateText(activity.title, compact ? 25 : 40)
    meta = activity.type === "edit" ? t("activity.edited") :
           activity.type === "comment" ? t("activity.commented") :
           activity.type === "delete" ? t("activity.deleted") :
           activity.type === "rename" ? t("activity.renamed") :
           activity.type === "move" ? t("activity.moved") : t("activity.created")
  } else if (activity.source === "trello") {
    const board = activity.boardName ? ` · ${activity.boardName}` : ""
    const list = activity.listName ? ` · ${activity.listName}` : ""
    title = truncateText(activity.cardName || t("activity.trelloCard"), compact ? 25 : 40)
    if (activity.type === "card_created") {
      meta = `${t("activity.created")}${board}${list}`
    } else if (activity.type === "card_commented") {
      meta = truncateText(activity.commentText ? `${t("activity.commented")}: ${activity.commentText}` : `${t("activity.commented")}${board}${list}`, compact ? 30 : 60)
    } else if (activity.type === "card_moved") {
      meta = `${t("activity.moved")}${board}${list}`
    } else if (activity.type === "card_archived") {
      meta = `${t("activity.archived")}${board}${list}`
    } else {
      meta = `Trello · ${activity.type}${board}${list}`
    }
  } else if (activity.source === "github") {
    title = activity.repoName || "GitHub"
    meta = truncateText(activity.title, compact ? 30 : 60)
  } else if (activity.source === "jira") {
    title = truncateText(`${activity.issueKey}: ${activity.issueSummary}`, compact ? 25 : 40)
    if (activity.type === "issue_transitioned") {
      meta = activity.detail || t("activity.moved")
    } else if (activity.type === "issue_commented") {
      meta = truncateText(activity.detail ? `${t("activity.commented")}: ${activity.detail}` : t("activity.commented"), compact ? 30 : 60)
    }
  }

  const copyDuration = () => {
    if (duration) {
      navigator.clipboard.writeText(duration)
      setCopied(true)
      setTimeout(() => setCopied(false), 1000)
    }
  }

  const titleContent = activity.url ? (
    <a
      href={activity.url}
      target="_blank"
      rel="noreferrer"
      className="hover:text-primary transition-colors"
    >
      {title}
    </a>
  ) : (
    title
  )

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2 text-xs min-w-0", isHighlighted && "ai-highlight rounded px-1 -mx-1")}>
        <SourceIcon source={activity.source} compact />
        <span className="truncate font-medium min-w-0">{titleContent}</span>
        {duration && (
          <Badge variant="outline" className="shrink-0 ml-auto text-[10px] px-1 py-0">
            {duration}
          </Badge>
        )}
      </div>
    )
  }

  return (
    <div className={cn("flex items-start gap-3", isHighlighted && "ai-highlight rounded-md p-2 -m-1")}>
      <SourceIcon source={activity.source} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{titleContent}</span>
          {duration && (
            <button
              onClick={copyDuration}
              className={cn(
                "ml-auto flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono transition-colors",
                copied
                  ? "bg-green-500 text-white"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              )}
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {duration}
            </button>
          )}
        </div>
        {meta && <p className="text-xs text-muted-foreground mt-0.5 truncate">{meta}</p>}
      </div>
    </div>
  )
}

function SourceIcon({ source, compact = false }: { source: Source; compact?: boolean }) {
  const config = sourceConfig[source]
  if (!config) return null

  if ("svg" in config) {
    return (
      <img
        src={config.svg}
        alt={source}
        className={cn("shrink-0", compact ? "h-5 w-5" : "h-7 w-7")}
      />
    )
  }

  const Icon = config.icon
  return (
    <div
      className={cn(
        "shrink-0 rounded flex items-center justify-center",
        config.color,
        compact ? "h-5 w-5" : "h-7 w-7"
      )}
    >
      <Icon className={compact ? "h-3 w-3" : "h-4 w-4"} />
    </div>
  )
}
