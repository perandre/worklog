"use client"

import { useEffect, useState, useCallback } from "react"
import { signIn, signOut, useSession } from "next-auth/react"
import { SessionProvider } from "next-auth/react"
import Activity from "./components/Activity"
import AiPanel from "./components/ai/AiPanel"
import WelcomePage from "./components/WelcomePage"
import { I18nProvider, useTranslation } from "./lib/i18n"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { AlertCircle, ChevronLeft, ChevronRight, Calendar, Link2, LogOut, MessageSquare, Github, X, Globe, Sparkles } from "lucide-react"

function formatDate(dateStr: string, locale: string) {
  const d = new Date(dateStr + "T12:00:00")
  return d.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" })
}

function formatDateLong(dateStr: string, locale: string) {
  const d = new Date(dateStr + "T12:00:00")
  return d.toLocaleDateString(locale, { weekday: "long", month: "short", day: "numeric", year: "numeric" })
}

function getMonday(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00")
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split("T")[0]
}

function getWeekDays(mondayDateStr: string) {
  const days = []
  for (let i = 0; i < 5; i++) {
    const d = new Date(mondayDateStr + "T12:00:00")
    d.setDate(d.getDate() + i)
    days.push(d.toISOString().split("T")[0])
  }
  return days
}

function formatWeekRange(mondayDateStr: string, locale: string) {
  const days = getWeekDays(mondayDateStr)
  const start = new Date(days[0] + "T12:00:00")
  const end = new Date(days[4] + "T12:00:00")
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
  return `${start.toLocaleDateString(locale, opts)} – ${end.toLocaleDateString(locale, { ...opts, year: "numeric" })}`
}

function LangToggle() {
  const { lang, setLang } = useTranslation()
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setLang(lang === "en" ? "no" : "en")}
      title={lang === "en" ? "Bytt til norsk" : "Switch to English"}
    >
      <span className="text-xs font-semibold">{lang === "en" ? "EN" : "NO"}</span>
    </Button>
  )
}

function WorklogApp() {
  const { data: session, status } = useSession()
  const { t, lang } = useTranslation()
  const locale = lang === "no" ? "nb-NO" : "en-US"
  const [currentDate, setCurrentDate] = useState(() => new Date().toISOString().split("T")[0])
  const [viewMode, setViewMode] = useState<"day" | "week">("day")
  const [data, setData] = useState<any>(null)
  const [weekData, setWeekData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serviceStatus, setServiceStatus] = useState({ google: false, slack: false, trello: false, github: false })
  const [slackBannerDismissed, setSlackBannerDismissed] = useState(true)
  const [trelloBannerDismissed, setTrelloBannerDismissed] = useState(true)
  const [githubBannerDismissed, setGithubBannerDismissed] = useState(true)
  const [aiPanelEnabled, setAiPanelEnabled] = useState(true)
  const [highlightedActivities, setHighlightedActivities] = useState<Set<string>>(new Set())

  const today = new Date().toISOString().split("T")[0]

  // AI panel: restore preference from localStorage (default: on)
  useEffect(() => {
    if (localStorage.getItem("ai-panel-enabled") === "false") {
      setAiPanelEnabled(false)
    }
  }, [])

  // AI panel: Cmd+Shift+L keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.shiftKey && e.key === "L") {
        e.preventDefault()
        setAiPanelEnabled((prev) => {
          const next = !prev
          localStorage.setItem("ai-panel-enabled", String(next))
          if (!next) setHighlightedActivities(new Set())
          return next
        })
      }
      if (e.key === "Escape" && aiPanelEnabled) {
        setAiPanelEnabled(false)
        localStorage.setItem("ai-panel-enabled", "false")
        setHighlightedActivities(new Set())
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [aiPanelEnabled])

  const closeAiPanel = useCallback(() => {
    setAiPanelEnabled(false)
    localStorage.setItem("ai-panel-enabled", "false")
    setHighlightedActivities(new Set())
  }, [])

  const handleHighlight = useCallback((keys: Set<string>) => {
    setHighlightedActivities(keys)
  }, [])

  useEffect(() => {
    setSlackBannerDismissed(localStorage.getItem("slack-banner-dismissed") === "true")
    setTrelloBannerDismissed(localStorage.getItem("trello-banner-dismissed") === "true")
    setGithubBannerDismissed(localStorage.getItem("github-banner-dismissed") === "true")
  }, [])

  useEffect(() => {
    fetch("/api/status")
      .then((res) => res.json())
      .then(setServiceStatus)
      .catch(console.error)
  }, [session])

  useEffect(() => {
    if (status !== "authenticated") return

    setLoading(true)
    setError(null)

    if (viewMode === "day") {
      fetch(`/api/activities?date=${currentDate}&tz=${Intl.DateTimeFormat().resolvedOptions().timeZone}`)
        .then((res) => res.json())
        .then((d) => {
          if (d.error) throw new Error(d.error)
          setData(d)
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false))
    } else {
      const monday = getMonday(currentDate)
      const days = getWeekDays(monday)
      Promise.all(days.map((date) => fetch(`/api/activities?date=${date}&tz=${Intl.DateTimeFormat().resolvedOptions().timeZone}`).then((r) => r.json())))
        .then((results) => {
          setWeekData(results.map((r, i) => ({ date: days[i], data: r })))
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false))
    }
  }, [currentDate, viewMode, status])

  const navigate = (direction: number) => {
    const d = new Date(currentDate + "T12:00:00")
    d.setDate(d.getDate() + (viewMode === "day" ? direction : direction * 7))
    setCurrentDate(d.toISOString().split("T")[0])
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4">
            <Skeleton className="h-8 w-32" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-6">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </main>
      </div>
    )
  }

  if (status === "unauthenticated") {
    return <WelcomePage />
  }

  const dateLabel =
    viewMode === "day"
      ? formatDateLong(currentDate, locale)
      : formatWeekRange(getMonday(currentDate), locale)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 shrink-0" />
              <span className="font-semibold hidden sm:inline">{t("header.title")}</span>
            </div>

            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-0 sm:min-w-[200px] text-center text-sm font-medium truncate">
                {dateLabel}
              </span>
              <Button variant="ghost" size="icon" onClick={() => navigate(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              <Button
                variant={viewMode === "day" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("day")}
                className="hidden sm:inline-flex"
              >
                {t("header.day")}
              </Button>
              <Button
                variant={viewMode === "week" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("week")}
                className="hidden sm:inline-flex"
              >
                {t("header.week")}
              </Button>
              <Separator orientation="vertical" className="h-6 hidden sm:block" />
              <Button
                variant={aiPanelEnabled ? "secondary" : "ghost"}
                size="icon"
                onClick={() => {
                  setAiPanelEnabled((prev) => {
                    const next = !prev
                    localStorage.setItem("ai-panel-enabled", String(next))
                    if (!next) setHighlightedActivities(new Set())
                    return next
                  })
                }}
                title="AI time log (⌘⇧L)"
              >
                <Sparkles className="h-4 w-4" />
              </Button>
              <LangToggle />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!serviceStatus.slack && !slackBannerDismissed && (
          <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slack text-white">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">{t("connect.slack.title")}</p>
                <p className="text-sm text-muted-foreground">{t("connect.slack.desc")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild>
                <a href="/api/auth/slack">{t("connect.button")}</a>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  localStorage.setItem("slack-banner-dismissed", "true")
                  setSlackBannerDismissed(true)
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {!serviceStatus.trello && !trelloBannerDismissed && (
          <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-trello text-white">
                <span className="text-xs font-semibold">T</span>
              </div>
              <div>
                <p className="font-medium">{t("connect.trello.title")}</p>
                <p className="text-sm text-muted-foreground">{t("connect.trello.desc")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild>
                <a href="/api/auth/trello">{t("connect.button")}</a>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  localStorage.setItem("trello-banner-dismissed", "true")
                  setTrelloBannerDismissed(true)
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {!serviceStatus.github && !githubBannerDismissed && (
          <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-github text-white">
                <Github className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">{t("connect.github.title")}</p>
                <p className="text-sm text-muted-foreground">{t("connect.github.desc")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild>
                <a href="/api/auth/github">{t("connect.button")}</a>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  localStorage.setItem("github-banner-dismissed", "true")
                  setGithubBannerDismissed(true)
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : viewMode === "day" && data ? (
          <div className={aiPanelEnabled ? "lg:flex lg:gap-6" : ""}>
            <div className={aiPanelEnabled ? "hidden lg:block lg:flex-1 lg:min-w-0" : ""}>
              <DayView data={data} highlightedActivities={highlightedActivities} />
            </div>
            {aiPanelEnabled && (
              <>
                {/* Mobile: full-width, replaces day view */}
                <div className="lg:hidden ai-panel-enter">
                  <AiPanel
                    key={currentDate}
                    date={currentDate}
                    hours={data?.hours || null}
                    onClose={closeAiPanel}
                    onHighlight={handleHighlight}
                  />
                </div>
                {/* Desktop: sticky sidebar */}
                <div className="hidden lg:block w-[400px] shrink-0 ai-panel-enter">
                  <div className="sticky top-[73px] h-[calc(100vh-73px-80px)]">
                    <AiPanel
                      key={currentDate}
                      date={currentDate}
                      hours={data?.hours || null}
                      onClose={closeAiPanel}
                      onHighlight={handleHighlight}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        ) : viewMode === "week" && weekData.length > 0 ? (
          <WeekView weekData={weekData} today={today} locale={locale} />
        ) : null}
      </main>

      {/* Footer / Status */}
      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="cursor-pointer gap-1" onClick={() => signOut()}>
                Google <LogOut className="h-3 w-3" />
              </Badge>
              {serviceStatus.slack ? (
                <Badge variant="default" className="cursor-pointer gap-1" onClick={() => {
                  fetch("/api/auth/slack/disconnect", { method: "POST" }).then(() => {
                    setServiceStatus((s) => ({ ...s, slack: false }))
                  })
                }}>
                  Slack <LogOut className="h-3 w-3" />
                </Badge>
              ) : (
                <a href="/api/auth/slack">
                  <Badge variant="outline" className="gap-1"><Link2 className="h-3 w-3" /> Slack</Badge>
                </a>
              )}
              {serviceStatus.trello ? (
                <Badge variant="default" className="cursor-pointer gap-1" onClick={() => {
                  fetch("/api/auth/trello/disconnect", { method: "POST" }).then(() => {
                    setServiceStatus((s) => ({ ...s, trello: false }))
                  })
                }}>
                  Trello <LogOut className="h-3 w-3" />
                </Badge>
              ) : (
                <a href="/api/auth/trello">
                  <Badge variant="outline" className="gap-1"><Link2 className="h-3 w-3" /> Trello</Badge>
                </a>
              )}
              {serviceStatus.github ? (
                <Badge variant="default" className="cursor-pointer gap-1" onClick={() => {
                  fetch("/api/auth/github/disconnect", { method: "POST" }).then(() => {
                    setServiceStatus((s) => ({ ...s, github: false }))
                  })
                }}>
                  GitHub <LogOut className="h-3 w-3" />
                </Badge>
              ) : (
                <a href="/api/auth/github">
                  <Badge variant="outline" className="gap-1"><Link2 className="h-3 w-3" /> GitHub</Badge>
                </a>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("footer.version")}
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function DayView({ data, highlightedActivities }: { data: any; highlightedActivities?: Set<string> }) {
  const isHighlighted = (activity: any) => {
    if (!highlightedActivities || highlightedActivities.size === 0) return false
    return highlightedActivities.has(`${activity.source}-${activity.timestamp}`)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="space-y-2">
        {Array.from({ length: 17 }, (_, i) => i + 6).map((hour) => {
          const hourData = data.hours[hour] || { primaries: [], communications: [] }
          const isEmpty = (!hourData.primaries?.length) && !hourData.communications?.length
          if (isEmpty) return null
          return (
            <div key={hour} className="flex gap-4">
              <div className="w-14 shrink-0 text-right text-sm text-muted-foreground pt-3">
                {hour.toString().padStart(2, "0")}:00
              </div>
              <Card className="flex-1">
                <CardContent className="p-3">
                  <div className="space-y-2">
                    {(hourData.primaries || []).map((event: any, i: number) => (
                      <Activity key={`cal-${i}`} activity={event} isHighlighted={isHighlighted(event)} />
                    ))}
                    {hourData.communications.slice(0, 6).map((comm: any, i: number) => (
                      <Activity key={`comm-${i}`} activity={comm} isHighlighted={isHighlighted(comm)} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WeekView({ weekData, today, locale }: { weekData: any[]; today: string; locale: string }) {
  const { t } = useTranslation()
  return (
    <div className="overflow-x-auto pb-4">
    <div className="grid grid-cols-5 gap-3 min-w-[1200px]">
      {weekData.map(({ date, data }) => (
        <div key={date} className="min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-medium text-sm">{formatDate(date, locale)}</h3>
            {date === today && <Badge variant="secondary">{t("week.today")}</Badge>}
          </div>
          <div className="space-y-1.5">
            {Array.from({ length: 17 }, (_, i) => i + 6).map((hour) => {
              const hourData = data.hours?.[hour] || { primaries: [], communications: [] }
              const isEmpty = (!hourData.primaries?.length) && !hourData.communications?.length
              if (isEmpty) return null
              return (
                <div key={hour} className="flex gap-1.5">
                  <div className="w-10 shrink-0 text-right text-xs text-muted-foreground pt-2">
                    {hour.toString().padStart(2, "0")}:00
                  </div>
                  <Card className="flex-1 min-w-0 overflow-hidden">
                    <CardContent className="p-2">
                      <div className="space-y-1">
                        {(hourData.primaries || []).map((event: any, i: number) => (
                          <Activity key={`cal-${i}`} activity={event} compact />
                        ))}
                        {hourData.communications.slice(0, 3).map((comm: any, i: number) => (
                          <Activity key={`comm-${i}`} activity={comm} compact />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
    </div>
  )
}

export default function Home() {
  return (
    <SessionProvider>
      <I18nProvider>
        <WorklogApp />
      </I18nProvider>
    </SessionProvider>
  )
}
