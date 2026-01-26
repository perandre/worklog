"use client"

import { useEffect, useState } from "react"
import { signIn, signOut, useSession } from "next-auth/react"
import { SessionProvider } from "next-auth/react"
import Activity from "./components/Activity"

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

  const today = new Date().toISOString().split("T")[0]

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
      fetch(`/api/activities?date=${currentDate}`)
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
      Promise.all(days.map((date) => fetch(`/api/activities?date=${date}`).then((r) => r.json())))
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
    return <div className="loading">Loading...</div>
  }

  if (status === "unauthenticated") {
    return (
      <>
        <div className="header">
          <div className="title-block">
            <h1>Worklog ⏱️</h1>
            <p className="subtitle">A summary of your day</p>
          </div>
        </div>
        <div className="auth-prompt">
          <h2>Connect Your Google Account</h2>
          <p>To view your calendar events, emails, and document activity.</p>
          <button className="auth-btn" onClick={() => signIn("google")}>
            Connect Google Account
          </button>
        </div>
      </>
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
    <>
      <div className="header">
        <div className="title-block">
          <h1>Worklog ⏱️</h1>
          <p className="subtitle">A summary of your day</p>
        </div>
        <div className="date-nav">
          <button onClick={() => navigate(-1)}>◀</button>
          <span style={{ fontWeight: 500, padding: "0 8px" }}>{dateLabel}</span>
          <button onClick={() => navigate(1)}>▶</button>
          <button className="view-toggle" onClick={() => setViewMode(viewMode === "day" ? "week" : "day")}>
            {viewMode === "day" ? "Show Week" : "Show Day"}
          </button>
        </div>
      </div>

      {error && <div className="error">Error: {error}</div>}

      {loading ? (
        <div className="loading">Loading activities...</div>
      ) : viewMode === "day" && data ? (
        <DayView data={data} date={currentDate} isToday={currentDate === today} />
      ) : viewMode === "week" && weekData.length > 0 ? (
        <WeekView weekData={weekData} today={today} />
      ) : null}

      <div className="status-bar">
        <div className="status-item">
          <span className={`status-dot ${serviceStatus.google ? "connected" : "disconnected"}`} />
          Google (Gmail, Calendar, Docs)
          {serviceStatus.google && (
            <a href="#" onClick={() => signOut()} style={{ marginLeft: 8, fontSize: 12 }}>
              Disconnect
            </a>
          )}
        </div>
        <div className="status-item">
          <span className={`status-dot ${serviceStatus.slack ? "connected" : "disconnected"}`} />
          Slack
        </div>
      </div>
    </>
  )
}

function DayView({ data, date, isToday }: { data: any; date: string; isToday: boolean }) {
  return (
    <div className="week-container" style={{ justifyContent: "center" }}>
      <div className="day-column" style={{ flex: "0 0 500px", maxWidth: 500 }}>
        <div className={`day-header ${isToday ? "today" : ""}`}>{formatDate(date)}</div>
        <div className="timeline">
          {Array.from({ length: 11 }, (_, i) => i + 7).map((hour) => {
            const hourData = data.hours[hour] || { primaries: [], communications: [] }
            const isEmpty = (!hourData.primaries?.length) && !hourData.communications?.length
            return (
              <div className="hour-block" key={hour}>
                <div className="hour-label">{hour.toString().padStart(2, "0")}:00</div>
                <div className={`hour-content ${isEmpty ? "empty" : ""}`}>
                  {isEmpty ? (
                    <div className="empty-text">No activity</div>
                  ) : (
                    <>
                      {(hourData.primaries || []).map((event: any, i: number) => (
                        <Activity key={`cal-${i}`} activity={event} />
                      ))}
                      {hourData.communications.slice(0, 6).map((comm: any, i: number) => (
                        <Activity key={`comm-${i}`} activity={comm} />
                      ))}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function WeekView({ weekData, today }: { weekData: any[]; today: string }) {
  return (
    <div className="week-container">
      {weekData.map(({ date, data }) => (
        <div className="day-column" key={date}>
          <div className={`day-header ${date === today ? "today" : ""}`}>{formatDate(date)}</div>
          <div className="timeline">
            {Array.from({ length: 11 }, (_, i) => i + 7).map((hour) => {
              const hourData = data.hours?.[hour] || { primaries: [], communications: [] }
              const isEmpty = (!hourData.primaries?.length) && !hourData.communications?.length
              return (
                <div className="hour-block" key={hour}>
                  <div className="hour-label">{hour.toString().padStart(2, "0")}:00</div>
                  <div className={`hour-content ${isEmpty ? "empty" : ""}`}>
                    {isEmpty ? (
                      <div className="empty-text">No activity</div>
                    ) : (
                      <>
                        {(hourData.primaries || []).map((event: any, i: number) => (
                          <Activity key={`cal-${i}`} activity={event} />
                        ))}
                        {hourData.communications.slice(0, 4).map((comm: any, i: number) => (
                          <Activity key={`comm-${i}`} activity={comm} />
                        ))}
                      </>
                    )}
                  </div>
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
