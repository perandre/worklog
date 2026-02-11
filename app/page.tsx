"use client"

import { useEffect, useState } from "react"
import { signIn, signOut, useSession } from "next-auth/react"
import { SessionProvider } from "next-auth/react"
import Activity from "./components/Activity"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { AlertCircle, ChevronLeft, ChevronRight, Calendar, LogOut, Link2, MessageSquare, X } from "lucide-react"

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00")
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  return `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`
}

function formatDateLong(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00")
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
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

function WorklogApp() {
  const { data: session, status } = useSession()
  const [currentDate, setCurrentDate] = useState(() => new Date().toISOString().split("T")[0])
  const [viewMode, setViewMode] = useState<"day" | "week">("day")
  const [data, setData] = useState<any>(null)
  const [weekData, setWeekData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serviceStatus, setServiceStatus] = useState({ google: false, slack: false })
  const [slackBannerDismissed, setSlackBannerDismissed] = useState(true) // Start true to avoid flash

  const today = new Date().toISOString().split("T")[0]

  useEffect(() => {
    setSlackBannerDismissed(localStorage.getItem("slack-banner-dismissed") === "true")
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
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              <h1 className="text-xl font-semibold">Worklog</h1>
            </div>
            <ThemeToggle />
          </div>
        </header>
        <main className="container mx-auto px-4 py-16 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle>Welcome to Worklog</CardTitle>
              <CardDescription>
                Connect your Google account to view your calendar events, emails, and document activity.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button onClick={() => signIn("google")} size="lg">
                <Link2 className="mr-2 h-4 w-4" />
                Connect Google Account
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  const dateLabel =
    viewMode === "day"
      ? formatDateLong(currentDate)
      : (() => {
          const monday = getMonday(currentDate)
          const days = getWeekDays(monday)
          const start = new Date(days[0] + "T12:00:00")
          const end = new Date(days[4] + "T12:00:00")
          const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
          return `${months[start.getMonth()]} ${start.getDate()} - ${months[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`
        })()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              <span className="font-semibold">Worklog</span>
            </div>

            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[200px] text-center text-sm font-medium">
                {dateLabel}
              </span>
              <Button variant="ghost" size="icon" onClick={() => navigate(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "day" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("day")}
              >
                Day
              </Button>
              <Button
                variant={viewMode === "week" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("week")}
              >
                Week
              </Button>
              <Separator orientation="vertical" className="h-6" />
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
                <p className="font-medium">Connect Slack</p>
                <p className="text-sm text-muted-foreground">See your messages alongside calendar events</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild>
                <a href="/api/auth/slack">Connect</a>
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

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : viewMode === "day" && data ? (
          <DayView data={data} />
        ) : viewMode === "week" && weekData.length > 0 ? (
          <WeekView weekData={weekData} today={today} />
        ) : null}
      </main>

      {/* Footer / Status */}
      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Badge variant={serviceStatus.google ? "default" : "secondary"}>
                  Google
                </Badge>
                {serviceStatus.google && (
                  <Button variant="ghost" size="sm" onClick={() => signOut()}>
                    <LogOut className="h-3 w-3 mr-1" />
                    Disconnect
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={serviceStatus.slack ? "default" : "secondary"}>
                  Slack
                </Badge>
                {serviceStatus.slack ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      fetch("/api/auth/slack/disconnect", { method: "POST" }).then(() => {
                        setServiceStatus((s) => ({ ...s, slack: false }))
                      })
                    }}
                  >
                    <LogOut className="h-3 w-3 mr-1" />
                    Disconnect
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" asChild>
                    <a href="/api/auth/slack">
                      <Link2 className="h-3 w-3 mr-1" />
                      Connect
                    </a>
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Hours 6:00 - 23:00
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function DayView({ data }: { data: any }) {
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
                      <Activity key={`cal-${i}`} activity={event} />
                    ))}
                    {hourData.communications.slice(0, 6).map((comm: any, i: number) => (
                      <Activity key={`comm-${i}`} activity={comm} />
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

function WeekView({ weekData, today }: { weekData: any[]; today: string }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {weekData.map(({ date, data }) => (
        <div key={date} className="flex-1 min-w-[260px]">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="font-medium">{formatDate(date)}</h3>
            {date === today && <Badge variant="secondary">Today</Badge>}
          </div>
          <div className="space-y-2">
            {Array.from({ length: 17 }, (_, i) => i + 6).map((hour) => {
              const hourData = data.hours?.[hour] || { primaries: [], communications: [] }
              const isEmpty = (!hourData.primaries?.length) && !hourData.communications?.length
              if (isEmpty) return null
              return (
                <div key={hour} className="flex gap-2">
                  <div className="w-10 shrink-0 text-right text-xs text-muted-foreground pt-2">
                    {hour.toString().padStart(2, "0")}:00
                  </div>
                  <Card className="flex-1">
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
  )
}

export default function Home() {
  return (
    <SessionProvider>
      <WorklogApp />
    </SessionProvider>
  )
}
