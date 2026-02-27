"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, X, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/app/lib/i18n"
import { TimeLogSuggestion } from "@/app/lib/types/timelog"
import { PmProject, PmActivityType } from "@/app/lib/types/pm"

interface SuggestionCardProps {
  suggestion: TimeLogSuggestion
  isExpanded: boolean
  onToggleExpand: () => void
  onApprove: () => void
  onReject: () => void
  onUpdate: (updates: Partial<TimeLogSuggestion>) => void
  projects: PmProject[]
  activityTypes: PmActivityType[]
}

function formatHM(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return `${h}:${m.toString().padStart(2, "0")}`
}

function parseHM(value: string): number | null {
  const match = value.match(/^(\d+):(\d{0,2})$/)
  if (match) {
    const h = parseInt(match[1])
    const m = parseInt(match[2] || "0")
    return h + m / 60
  }
  const num = parseFloat(value)
  if (!isNaN(num) && num >= 0) return num
  return null
}

export default function SuggestionCard({
  suggestion,
  isExpanded,
  onToggleExpand,
  onApprove,
  onReject,
  onUpdate,
  projects,
  activityTypes,
}: SuggestionCardProps) {
  const [hoursInput, setHoursInput] = useState(formatHM(suggestion.hours))
  const { t } = useTranslation()

  const isApproved = suggestion.status === "approved"
  const isSkipped = suggestion.status === "skipped"

  // Filter activity types to the selected project (fall back to all if no match)
  const projectTypes = activityTypes.filter((t) => t.projectId === suggestion.projectId)
  const filteredActivityTypes = projectTypes.length > 0 ? projectTypes : activityTypes

  if (isSkipped) return null

  // Compact view
  if (!isExpanded) {
    return (
      <Card
        className={cn(
          "cursor-pointer transition-colors hover:bg-accent/50",
          isApproved && "border-green-500/30 bg-green-500/5"
        )}
        onClick={onToggleExpand}
      >
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {isApproved ? (
                <Check className="h-4 w-4 text-green-500 shrink-0" />
              ) : (
                <div className="h-4 w-4 rounded-full border border-muted-foreground/30 shrink-0" />
              )}
              <span className="font-medium truncate">{suggestion.projectName}</span>
              <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                {suggestion.activityTypeName}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="tabular-nums text-xs">
                {formatHM(suggestion.hours)}
              </Badge>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Expanded view
  return (
    <Card className="border-primary/50 shadow-sm">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="font-semibold">{suggestion.projectName}</span>
          <button onClick={onToggleExpand} className="text-muted-foreground hover:text-foreground">
            <ChevronUp className="h-4 w-4" />
          </button>
        </div>

        {/* Project dropdown */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">{t("card.project")}</label>
          <select
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            value={suggestion.projectId}
            onChange={(e) => {
              const project = projects.find((p) => p.id === e.target.value)
              if (project) {
                const newProjectTypes = activityTypes.filter((t) => t.projectId === project.id)
                const firstType = newProjectTypes[0]
                onUpdate({
                  projectId: project.id,
                  projectName: project.name,
                  activityTypeId: firstType?.id ?? "",
                  activityTypeName: firstType?.name ?? "",
                })
              }
            }}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Hours + Activity Type row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t("card.hours")}</label>
            <input
              type="text"
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm tabular-nums"
              value={hoursInput}
              onChange={(e) => {
                setHoursInput(e.target.value)
                const parsed = parseHM(e.target.value)
                if (parsed !== null) {
                  onUpdate({ hours: Math.round(parsed * 2) / 2 })
                }
              }}
              onBlur={() => {
                setHoursInput(formatHM(suggestion.hours))
              }}
              placeholder="H:MM"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t("card.type")}</label>
            <select
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              value={suggestion.activityTypeId}
              onChange={(e) => {
                const at = filteredActivityTypes.find((t) => t.id === e.target.value)
                if (at) {
                  onUpdate({ activityTypeId: at.id, activityTypeName: at.name })
                }
              }}
            >
              {filteredActivityTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">{t("card.description")}</label>
          <textarea
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            rows={Math.max(3, (suggestion.description || "").split("\n").length + 1)}
            value={suggestion.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
          />
        </div>

        {/* Reasoning */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">{t("card.basedOn")}</label>
          <div className="text-xs text-muted-foreground space-y-0.5">
            {suggestion.sourceActivities.slice(0, 5).map((sa, i) => (
              <div key={i} className="flex items-center gap-1">
                <span>·</span>
                <span className="capitalize">{sa.source}</span>
                <span className="truncate">{sa.title}</span>
              </div>
            ))}
            {suggestion.sourceActivities.length > 5 && (
              <div className="text-muted-foreground/70">
                + {suggestion.sourceActivities.length - 5} {t("card.more")}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" onClick={onApprove} className="gap-1">
            <Check className="h-3 w-3" />
            {t("card.approve")}
          </Button>
          <Button size="sm" variant="outline" onClick={onReject} className="gap-1">
            <X className="h-3 w-3" />
            {t("card.reject")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
