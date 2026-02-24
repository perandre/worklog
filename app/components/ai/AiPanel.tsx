"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { X, Sparkles, Loader2, Send, RefreshCw, Undo2, CheckCheck, Lock } from "lucide-react"
import { TimeLogSuggestion, AiSuggestionResponse } from "@/app/lib/types/timelog"
import { PmContext, PmProject, PmActivityType } from "@/app/lib/types/pm"
import { useTranslation } from "@/app/lib/i18n"
import SuggestionCard from "./SuggestionCard"
import SuggestionProgress from "./SuggestionProgress"

type PanelState = "ready" | "loading" | "suggestions" | "submitting" | "submitted"

const CACHE_VERSION = 2

type CachedSuggestions = {
  v: number
  date: string
  suggestions: TimeLogSuggestion[]
  pmContext: PmContext
  submitResults: Record<string, { success: boolean; error?: string }>
  state: "suggestions" | "submitted"
}

function getCacheKey(date: string) {
  return `ai-suggestions:${date}`
}

function loadCache(date: string): CachedSuggestions | null {
  try {
    const raw = localStorage.getItem(getCacheKey(date))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Invalidate old or mismatched cache
    if (parsed.v !== CACHE_VERSION || parsed.date !== date) {
      localStorage.removeItem(getCacheKey(date))
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function saveCache(date: string, data: Omit<CachedSuggestions, "v" | "date">) {
  try {
    localStorage.setItem(getCacheKey(date), JSON.stringify({ ...data, v: CACHE_VERSION, date }))
  } catch {
    // localStorage full or unavailable — ignore
  }
}

interface AiPanelProps {
  date: string
  hours: Record<string, any> | null
  onClose: () => void
  onHighlight: (activityKeys: Set<string>) => void
}

export default function AiPanel({ date, hours, onClose, onHighlight }: AiPanelProps) {
  const { lang, t } = useTranslation()
  const [state, setState] = useState<PanelState>("ready")
  const [loadingStep, setLoadingStep] = useState("")
  const [suggestions, setSuggestions] = useState<TimeLogSuggestion[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [pmContext, setPmContext] = useState<PmContext | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitResults, setSubmitResults] = useState<Record<string, { success: boolean; error?: string }>>({})
  const [recentlyRejected, setRecentlyRejected] = useState<{ suggestion: TimeLogSuggestion; index: number } | null>(null)

  const approvedSuggestions = suggestions.filter((s) => s.status === "approved" || s.status === "edited")
  const pendingSuggestions = suggestions.filter((s) => s.status === "pending")
  const visibleSuggestions = suggestions.filter((s) => s.status !== "skipped")
  const approvedHours = approvedSuggestions.reduce((sum, s) => sum + s.hours, 0)
  const totalHours = visibleSuggestions.reduce((sum, s) => sum + s.hours, 0)
  const isLocked = pmContext?.timeLockDate ? date <= pmContext.timeLockDate : false

  // Auto-load from cache on mount / date change
  const cacheLoadedRef = useRef<string | null>(null)
  useEffect(() => {
    if (cacheLoadedRef.current === date) return
    cacheLoadedRef.current = date
    const cached = loadCache(date)
    if (cached) {
      setSuggestions(cached.suggestions)
      setPmContext(cached.pmContext)
      setSubmitResults(cached.submitResults)
      setState(cached.state)
      setError(null)
      setExpandedId(null)
    } else {
      // Reset when switching to an uncached date
      setSuggestions([])
      setPmContext(null)
      setSubmitResults({})
      setState("ready")
      setError(null)
      setExpandedId(null)
    }
  }, [date])

  // Persist to cache on every suggestion / submitResults / state mutation
  // Note: date is read but not in deps — we only save when suggestions actually change,
  // not when navigating to a new date (which would write stale data to the new key)
  useEffect(() => {
    if (state !== "suggestions" && state !== "submitted") return
    if (suggestions.length === 0) return
    if (!pmContext) return
    saveCache(date, { suggestions, pmContext, submitResults, state })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestions, pmContext, submitResults, state])

  const highlightSources = useCallback((suggestion: TimeLogSuggestion) => {
    const keys = new Set(
      suggestion.sourceActivities.map((sa) => `${sa.source}-${sa.timestamp}`)
    )
    onHighlight(keys)
  }, [onHighlight])

  const generate = useCallback(async (forceRefresh = false) => {
    // Load from cache unless forced
    if (!forceRefresh) {
      const cached = loadCache(date)
      if (cached) {
        setSuggestions(cached.suggestions)
        setPmContext(cached.pmContext)
        setSubmitResults(cached.submitResults)
        setState(cached.state)
        setError(null)
        setExpandedId(null)
        return
      }
    }

    setState("loading")
    setError(null)
    setSuggestions([])
    setExpandedId(null)
    setSubmitResults({})

    try {
      setLoadingStep(t("ai.loading.projects"))
      const ctxRes = await fetch("/api/ai/pm-context")
      if (!ctxRes.ok) throw new Error(t("ai.error.projects"))
      const ctx: PmContext = await ctxRes.json()
      setPmContext(ctx)

      setLoadingStep(t("ai.loading.analyzing"))
      await new Promise((r) => setTimeout(r, 400))

      setLoadingStep(t("ai.loading.generating"))
      const sugRes = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, hours, pmContext: ctx }),
      })
      if (!sugRes.ok) {
        const errData = await sugRes.json().catch(() => null)
        throw new Error(errData?.error || t("ai.error.generate"))
      }
      const data: AiSuggestionResponse = await sugRes.json()

      setSuggestions(data.suggestions)
      setState("suggestions")

      // Auto-expand first suggestion
      if (data.suggestions.length > 0) {
        setExpandedId(data.suggestions[0].id)
        highlightSources(data.suggestions[0])
      }
    } catch (err: any) {
      setError(err.message)
      setState("ready")
    }
  }, [date, hours, t, highlightSources])

  const handleExpand = useCallback((id: string) => {
    setExpandedId((prev) => {
      const newId = prev === id ? null : id
      if (newId) {
        const suggestion = suggestions.find((s) => s.id === newId)
        if (suggestion) highlightSources(suggestion)
      } else {
        onHighlight(new Set())
      }
      return newId
    })
  }, [suggestions, highlightSources, onHighlight])

  const handleApprove = useCallback((id: string) => {
    setSuggestions((prev) => {
      const updated = prev.map((s) =>
        s.id === id ? { ...s, status: "approved" as const } : s
      )
      const currentIdx = updated.findIndex((s) => s.id === id)
      const nextPending = updated.find((s, i) => i > currentIdx && s.status === "pending")
      if (nextPending) {
        setExpandedId(nextPending.id)
        highlightSources(nextPending)
      } else {
        setExpandedId(null)
        onHighlight(new Set())
      }
      return updated
    })
  }, [highlightSources, onHighlight])

  const handleReject = useCallback((id: string) => {
    const idx = suggestions.findIndex((s) => s.id === id)
    const suggestion = suggestions[idx]
    if (!suggestion) return

    setRecentlyRejected({ suggestion, index: idx })
    setSuggestions((prev) => prev.map((s) =>
      s.id === id ? { ...s, status: "skipped" as const } : s
    ))

    const nextPending = suggestions.find((s, i) => i > idx && s.status === "pending" && s.id !== id)
    if (nextPending) {
      setExpandedId(nextPending.id)
      highlightSources(nextPending)
    } else {
      setExpandedId(null)
      onHighlight(new Set())
    }

    setTimeout(() => setRecentlyRejected(null), 5000)
  }, [suggestions, highlightSources, onHighlight])

  const handleUndo = useCallback(() => {
    if (!recentlyRejected) return
    const { suggestion } = recentlyRejected
    setSuggestions((prev) => prev.map((s) =>
      s.id === suggestion.id ? { ...s, status: "pending" as const } : s
    ))
    setExpandedId(suggestion.id)
    highlightSources(suggestion)
    setRecentlyRejected(null)
  }, [recentlyRejected, highlightSources])

  const handleApproveAll = useCallback(() => {
    setSuggestions((prev) => prev.map((s) =>
      s.status === "pending" ? { ...s, status: "approved" as const } : s
    ))
    setExpandedId(null)
    onHighlight(new Set())
  }, [onHighlight])

  const handleUpdate = useCallback((id: string, updates: Partial<TimeLogSuggestion>) => {
    setSuggestions((prev) => prev.map((s) =>
      s.id === id ? { ...s, ...updates, status: s.status === "approved" ? "edited" as const : s.status } : s
    ))
  }, [])

  const handleSubmit = useCallback(async () => {
    setState("submitting")
    try {
      const entries = approvedSuggestions.map((s) => ({
        id: s.id,
        projectId: s.projectId,
        activityTypeId: s.activityTypeId,
        date,
        hours: s.hours,
        description: lang === "en" ? s.descriptionEn : s.description,
        internalNote: s.internalNote,
      }))

      const res = await fetch("/api/ai/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      })
      if (!res.ok) throw new Error(t("ai.error.submit"))
      const data = await res.json()

      const results: Record<string, { success: boolean; error?: string }> = {}
      for (const r of data.results) {
        results[r.entryId] = { success: r.success, error: r.error }
      }
      setSubmitResults(results)
      setState("submitted")
    } catch (err: any) {
      setError(err.message)
      setState("suggestions")
    }
  }, [approvedSuggestions, date, t])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (state !== "suggestions") return

    if (e.key === "Enter" && expandedId) {
      e.preventDefault()
      handleApprove(expandedId)
    }
    if (e.key === "Tab") {
      e.preventDefault()
      const visibleIds = visibleSuggestions.map((s) => s.id)
      const currentIdx = visibleIds.indexOf(expandedId || "")
      const nextIdx = e.shiftKey
        ? Math.max(0, currentIdx - 1)
        : Math.min(visibleIds.length - 1, currentIdx + 1)
      const nextId = visibleIds[nextIdx]
      if (nextId) {
        setExpandedId(nextId)
        const suggestion = suggestions.find((s) => s.id === nextId)
        if (suggestion) highlightSources(suggestion)
      }
    }
  }, [state, expandedId, visibleSuggestions, suggestions, handleApprove, highlightSources])

  return (
    <div
      className="flex flex-col h-full border bg-background rounded-lg"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          <span className="font-semibold text-sm">{t("ai.title")}</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Ready state */}
        {state === "ready" && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Sparkles className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              {t("ai.emptyDesc")}
            </p>
            <Button onClick={() => generate()} disabled={!hours}>
              <Sparkles className="h-4 w-4 mr-2" />
              {t("ai.generate")}
            </Button>
          </div>
        )}

        {/* Loading state */}
        {state === "loading" && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{loadingStep}</p>
          </div>
        )}

        {/* Suggestions state */}
        {(state === "suggestions" || state === "submitting" || state === "submitted") && (
          <>
            <SuggestionProgress
              approvedHours={approvedHours}
              totalHours={totalHours}
            />

            <div className="space-y-2">
              {visibleSuggestions.map((suggestion) => (
                <SuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  isExpanded={expandedId === suggestion.id && state !== "submitted" && state !== "submitting"}
                  onToggleExpand={() => state === "suggestions" && handleExpand(suggestion.id)}
                  onApprove={() => state === "suggestions" && !isLocked && handleApprove(suggestion.id)}
                  onReject={() => state === "suggestions" && !isLocked && handleReject(suggestion.id)}
                  onUpdate={(updates) => state === "suggestions" && !isLocked && handleUpdate(suggestion.id, updates)}
                  projects={pmContext?.projects || []}
                  activityTypes={pmContext?.activityTypes || []}
                />
              ))}
            </div>

            {/* Undo bar */}
            {recentlyRejected && (
              <div className="flex items-center justify-between rounded-md bg-muted p-2 text-sm">
                <span className="text-muted-foreground">
                  {recentlyRejected.suggestion.projectName} {t("ai.rejected")}
                </span>
                <Button size="sm" variant="ghost" onClick={handleUndo} className="gap-1">
                  <Undo2 className="h-3 w-3" />
                  {t("ai.undo")}
                </Button>
              </div>
            )}

            {/* Submit results */}
            {state === "submitted" && Object.keys(submitResults).length > 0 && (
              <Card>
                <CardContent className="p-3 space-y-1">
                  {approvedSuggestions.map((s) => {
                    const result = submitResults[s.id]
                    return (
                      <div key={s.id} className="flex items-center justify-between text-sm">
                        <span>{s.projectName} — {s.hours}{t("progress.hoursUnit")}</span>
                        {result?.success ? (
                          <span className="text-green-500 text-xs">{t("ai.sent")}</span>
                        ) : (
                          <span className="text-destructive text-xs">{result?.error || t("ai.error")}</span>
                        )}
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )}

            {/* Locked banner */}
            {isLocked && (
              <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground">
                <Lock className="h-4 w-4 shrink-0" />
                {t("ai.locked")}
              </div>
            )}

            {/* Action buttons */}
            <div className="space-y-2 pt-2">
              {pendingSuggestions.length > 0 && state === "suggestions" && !isLocked && (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleApproveAll}
                >
                  <CheckCheck className="h-4 w-4" />
                  {t("ai.approveAll")}
                </Button>
              )}
              {approvedSuggestions.length > 0 && state === "suggestions" && !isLocked && (
                <Button
                  className="w-full gap-2"
                  onClick={handleSubmit}
                >
                  <Send className="h-4 w-4" />
                  {t("ai.submit")}
                </Button>
              )}
              {state === "submitting" && (
                <Button className="w-full gap-2" disabled>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("ai.submitting")}
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => generate(true)}
                disabled={state === "submitting"}
              >
                <RefreshCw className="h-4 w-4" />
                {t("ai.regenerate")}
              </Button>
            </div>

            {/* Empty state */}
            {visibleSuggestions.length === 0 && suggestions.length > 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t("ai.allRejected")}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
