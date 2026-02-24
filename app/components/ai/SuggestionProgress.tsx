"use client"

import { cn } from "@/lib/utils"
import { useTranslation } from "@/app/lib/i18n"

interface SuggestionProgressProps {
  approvedHours: number
  totalHours: number
  targetHours?: number
}

function formatHM(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return `${h}:${m.toString().padStart(2, "0")}`
}

export default function SuggestionProgress({
  approvedHours,
  totalHours,
  targetHours = 7.5,
}: SuggestionProgressProps) {
  const { t } = useTranslation()
  const percentage = Math.min(100, Math.round((approvedHours / targetHours) * 100))

  return (
    <div className="space-y-2">
      <div className="text-center">
        <span className="text-3xl font-bold tabular-nums">{formatHM(approvedHours)}</span>
        <span className="text-lg text-muted-foreground"> / {formatHM(targetHours)}{t("progress.hoursUnit")}</span>
      </div>
      <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            percentage >= 95 ? "bg-green-500" : percentage >= 50 ? "bg-blue-500" : "bg-orange-500"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-xs text-center text-muted-foreground">{percentage}%</p>
    </div>
  )
}
