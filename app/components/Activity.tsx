"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Calendar, Mail, MessageSquare, FileText, Copy, Check } from "lucide-react"
import { cn } from "@/lib/utils"

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
  calendar: { icon: Calendar, color: "bg-calendar text-white" },
  gmail: { icon: Mail, color: "bg-gmail text-white" },
  slack: { icon: MessageSquare, color: "bg-slack text-white" },
  docs: { icon: FileText, color: "bg-docs text-white" },
} as const

type Source = keyof typeof sourceConfig

interface ActivityProps {
  activity: any
  compact?: boolean
}

export default function Activity({ activity, compact = false }: ActivityProps) {
  const [copied, setCopied] = useState(false)

  let title = ""
  let meta = ""
  let duration: string | null = null

  if (activity.source === "calendar") {
    if (activity.isSpanning) {
      return (
        <div className={cn("flex items-center gap-2", compact ? "text-xs" : "")}>
          <SourceIcon source="calendar" compact={compact} />
          <span className="text-muted-foreground truncate">
            {truncateText(activity.title, compact ? 20 : 35)} (cont.)
          </span>
        </div>
      )
    }
    title = truncateText(activity.title, compact ? 25 : 40)
    duration = formatDuration(activity.timestamp, activity.endTime)
    if (activity.attendees?.length > 0) {
      meta = `${activity.attendees.length} attendee${activity.attendees.length > 1 ? "s" : ""}`
    }
  } else if (activity.source === "slack") {
    title = activity.isDm ? activity.channel : `#${activity.channel}`
    meta = truncateText(activity.text, compact ? 30 : 60)
  } else if (activity.source === "gmail") {
    title = truncateText(activity.subject, compact ? 25 : 40)
    meta = activity.from ? `From: ${activity.from.split("<")[0].trim()}` : ""
  } else if (activity.source === "docs") {
    title = truncateText(activity.title, compact ? 25 : 40)
    meta = activity.type === "edit" ? "Edited" :
           activity.type === "comment" ? "Commented" :
           activity.type === "delete" ? "Deleted" :
           activity.type === "rename" ? "Renamed" :
           activity.type === "move" ? "Moved" : "Created"
  }

  const copyDuration = () => {
    if (duration) {
      navigator.clipboard.writeText(duration)
      setCopied(true)
      setTimeout(() => setCopied(false), 1000)
    }
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <SourceIcon source={activity.source} compact />
        <span className="truncate font-medium">{title}</span>
        {duration && (
          <Badge variant="outline" className="ml-auto text-[10px] px-1 py-0">
            {duration}
          </Badge>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3">
      <SourceIcon source={activity.source} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{title}</span>
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
