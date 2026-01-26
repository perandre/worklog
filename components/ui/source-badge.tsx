"use client"

import { cn } from "@/lib/utils"
import { Calendar, Mail, MessageSquare, FileText } from "lucide-react"

type Source = "calendar" | "gmail" | "slack" | "docs"

const sourceConfig: Record<Source, { icon: React.ElementType; className: string }> = {
  calendar: { icon: Calendar, className: "bg-calendar" },
  gmail: { icon: Mail, className: "bg-gmail" },
  slack: { icon: MessageSquare, className: "bg-slack" },
  docs: { icon: FileText, className: "bg-docs" },
}

interface SourceBadgeProps {
  source: Source
  className?: string
}

export function SourceBadge({ source, className }: SourceBadgeProps) {
  const config = sourceConfig[source]
  if (!config) return null

  const Icon = config.icon

  return (
    <div
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white",
        config.className,
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </div>
  )
}
