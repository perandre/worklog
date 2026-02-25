"use client"

import { cn } from "@/lib/utils"
import { useTranslation } from "@/app/lib/i18n"

interface SuggestionProgressProps {
  approvedHours: number
  totalHours: number
  existingHours?: number
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
  existingHours = 0,
  targetHours = 7.5,
}: SuggestionProgressProps) {
  const { t } = useTranslation()
  const combinedHours = existingHours + approvedHours
  const percentage = Math.min(100, Math.round((combinedHours / targetHours) * 100))
  const existingPct = Math.min(100, (existingHours / targetHours) * 100)
  const approvedPct = Math.min(100 - existingPct, (approvedHours / targetHours) * 100)

  return (
    <div className="space-y-2">
      <div className="text-center">
        <span className="text-3xl font-bold tabular-nums">{formatHM(combinedHours)}</span>
        <span className="text-lg text-muted-foreground"> / {formatHM(targetHours)}{t("progress.hoursUnit")}</span>
      </div>
      <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
        {existingPct > 0 && (
          <div
            className="absolute left-0 top-0 h-full bg-muted-foreground/30 transition-all duration-300"
            style={{ width: `${existingPct}%` }}
          />
        )}
        <div
          className={cn(
            "absolute top-0 h-full rounded-r-full transition-all duration-300",
            existingPct === 0 && "rounded-l-full",
            percentage >= 95 ? "bg-green-500" : percentage >= 50 ? "bg-blue-500" : "bg-orange-500"
          )}
          style={{ left: `${existingPct}%`, width: `${approvedPct}%` }}
        />
      </div>
      {existingHours > 0 ? (
        <p className="text-xs text-center text-muted-foreground">
          {formatHM(existingHours)} {t("progress.logged")} · {formatHM(approvedHours)} {t("progress.new")}
        </p>
      ) : (
        <p className="text-xs text-center text-muted-foreground">{percentage}%</p>
      )}
    </div>
  )
}
