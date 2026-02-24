"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"

export type Lang = "en" | "no"

const translations = {
  // Header
  "header.title": { en: "Worklog", no: "Worklog" },
  "header.day": { en: "Day", no: "Dag" },
  "header.week": { en: "Week", no: "Uke" },

  // Connect banners
  "connect.slack.title": { en: "Connect Slack", no: "Koble til Slack" },
  "connect.slack.desc": { en: "See your messages alongside calendar events", no: "Se meldingene dine ved siden av kalenderhendelser" },
  "connect.trello.title": { en: "Connect Trello", no: "Koble til Trello" },
  "connect.trello.desc": { en: "See your Trello card activity alongside your worklog.", no: "Se Trello-kortaktivitet ved siden av arbeidsdagen din." },
  "connect.github.title": { en: "Connect GitHub", no: "Koble til GitHub" },
  "connect.github.desc": { en: "See your commits, PRs, and issues", no: "Se commits, PRs og issues" },
  "connect.button": { en: "Connect", no: "Koble til" },

  // Footer
  "footer.version": { en: "v1.1.6", no: "v1.1.6" },

  // Week view
  "week.today": { en: "Today", no: "I dag" },

  // Activity
  "activity.cont": { en: "(cont.)", no: "(forts.)" },
  "activity.attendee": { en: "attendee", no: "deltaker" },
  "activity.attendees": { en: "attendees", no: "deltakere" },
  "activity.edited": { en: "Edited", no: "Redigert" },
  "activity.commented": { en: "Commented", no: "Kommentert" },
  "activity.deleted": { en: "Deleted", no: "Slettet" },
  "activity.renamed": { en: "Renamed", no: "Omdøpt" },
  "activity.moved": { en: "Moved", no: "Flyttet" },
  "activity.created": { en: "Created", no: "Opprettet" },
  "activity.archived": { en: "Archived", no: "Arkivert" },
  "activity.trelloCard": { en: "Trello card", no: "Trello-kort" },

  // AI Panel
  "ai.title": { en: "Time logging", no: "Timelogging" },
  "ai.emptyDesc": { en: "Analyze today's activities and get time log suggestions.", no: "Analyser dagens aktiviteter og få forslag til timeføring." },
  "ai.generate": { en: "Generate suggestions", no: "Generer forslag" },
  "ai.loading.projects": { en: "Looking up your projects...", no: "Slår opp prosjektene dine..." },
  "ai.loading.analyzing": { en: "Reading through today's activities...", no: "Leser gjennom dagens aktiviteter..." },
  "ai.loading.generating": { en: "Figuring out where the hours went...", no: "Finner ut hvor timene gikk..." },
  "ai.error.projects": { en: "Could not fetch project data", no: "Kunne ikke hente prosjektdata" },
  "ai.error.generate": { en: "Could not generate suggestions", no: "Kunne ikke generere forslag" },
  "ai.error.submit": { en: "Submission failed", no: "Innsending feilet" },
  "ai.rejected": { en: "rejected", no: "forkastet" },
  "ai.undo": { en: "Undo", no: "Angre" },
  "ai.sent": { en: "Sent", no: "Sendt" },
  "ai.error": { en: "Error", no: "Feil" },
  "ai.approveAll": { en: "Approve all", no: "Godkjenn alle" },
  "ai.submit": { en: "Submit", no: "Send til system" },
  "ai.submitting": { en: "Submitting...", no: "Sender..." },
  "ai.regenerate": { en: "Regenerate", no: "Generer på nytt" },
  "ai.allRejected": { en: "All suggestions rejected. Regenerate?", no: "Alle forslag er forkastet. Generer på nytt?" },
  "ai.locked": { en: "Hours are locked for this date. Unlock in Moment to make changes.", no: "Timer er låst for denne datoen. Lås opp i Moment for å gjøre endringer." },

  // Suggestion Card
  "card.project": { en: "Project", no: "Prosjekt" },
  "card.hours": { en: "Hours", no: "Timer" },
  "card.type": { en: "Type", no: "Type" },
  "card.description": { en: "Description", no: "Beskrivelse" },
  "card.internalNote": { en: "Internal note", no: "Intern notat" },
  "card.basedOn": { en: "Based on", no: "Basert på" },
  "card.more": { en: "more", no: "til" },
  "card.approve": { en: "Approve", no: "Godkjenn" },
  "card.reject": { en: "Reject", no: "Forkast" },

  // Progress
  "progress.hoursUnit": { en: "h", no: "t" },
} as const

type TranslationKey = keyof typeof translations

type I18nContextType = {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: TranslationKey) => string
}

const I18nContext = createContext<I18nContextType>({
  lang: "en",
  setLang: () => {},
  t: (key) => translations[key]?.en || key,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en")

  useEffect(() => {
    const saved = localStorage.getItem("ui-lang") as Lang | null
    if (saved === "en" || saved === "no") {
      setLangState(saved)
    }
  }, [])

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang)
    localStorage.setItem("ui-lang", newLang)
  }, [])

  const t = useCallback((key: TranslationKey) => {
    return translations[key]?.[lang] || translations[key]?.en || key
  }, [lang])

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useTranslation() {
  return useContext(I18nContext)
}
