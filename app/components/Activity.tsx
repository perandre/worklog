"use client"

import { useState } from "react"

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

const iconMap: Record<string, string> = {
  calendar: "📅",
  slack: "💬",
  gmail: "✉",
  docs: "📄",
}

export default function Activity({ activity }: { activity: any }) {
  const [copied, setCopied] = useState(false)

  let title = ""
  let meta = ""
  let duration: string | null = null

  if (activity.source === "calendar") {
    if (activity.isSpanning) {
      return (
        <div className="activity">
          <span className="source-icon calendar">{iconMap.calendar}</span>
          <div className="activity-content">
            <div className="activity-title" style={{ color: "var(--text-secondary)" }}>
              {truncateText(activity.title, 35)} (cont.)
            </div>
          </div>
        </div>
      )
    }
    title = truncateText(activity.title)
    duration = formatDuration(activity.timestamp, activity.endTime)
    if (activity.attendees?.length > 0) {
      meta = `${activity.attendees.length} attendee${activity.attendees.length > 1 ? "s" : ""}`
    }
  } else if (activity.source === "slack") {
    title = activity.isDm ? activity.channel : `#${activity.channel}`
    meta = truncateText(activity.text, 60)
  } else if (activity.source === "gmail") {
    title = truncateText(activity.subject)
    meta = activity.from ? `From: ${activity.from.split("<")[0].trim()}` : ""
  } else if (activity.source === "docs") {
    title = truncateText(activity.title)
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
      setTimeout(() => setCopied(false), 600)
    }
  }

  return (
    <div className="activity">
      <span className={`source-icon ${activity.source}`}>{iconMap[activity.source]}</span>
      <div className="activity-content">
        {duration && (
          <span
            className={`meeting-duration ${copied ? "copied" : ""}`}
            onClick={copyDuration}
            title="Click to copy"
          >
            {duration}
          </span>
        )}
        <div className="activity-title">{title}</div>
        {meta && <div className="activity-meta">{meta}</div>}
      </div>
    </div>
  )
}
