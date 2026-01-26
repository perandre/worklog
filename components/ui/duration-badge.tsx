"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

interface DurationBadgeProps {
  duration: string
  className?: string
}

export function DurationBadge({ duration, className }: DurationBadgeProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(duration)
    setCopied(true)
    setTimeout(() => setCopied(false), 600)
  }

  return (
    <span
      onClick={handleCopy}
      title="Click to copy"
      className={cn(
        "float-right cursor-pointer rounded px-1.5 py-0.5 font-mono text-xs transition-colors",
        copied
          ? "bg-green-500 text-white"
          : "bg-blue-100 text-calendar hover:bg-blue-200",
        className
      )}
    >
      {duration}
    </span>
  )
}
