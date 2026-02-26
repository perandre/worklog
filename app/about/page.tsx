import Link from "next/link"

export const metadata = {
  title: "About — Worklog",
  description: "How Worklog turns your chaotic workday into a neat timelog.",
}

const sources = [
  {
    name: "Google Calendar",
    color: "#4285F4",
    what: "Meetings, events, and blocks. These are your primaries — everything else is organised around them.",
  },
  {
    name: "Gmail",
    color: "#EA4335",
    what: "Emails you sent and received, deduplicated by thread so a 12-email chain shows up once.",
  },
  {
    name: "Google Docs",
    color: "#34A853",
    what: "Creates, edits, renames, and deletions — so \"worked on Q2 proposal\" actually shows up.",
  },
  {
    name: "Slack",
    color: "#4A154B",
    what: "Messages from public channels and DMs, prefixed with the channel name so you know where you were.",
  },
  {
    name: "Trello",
    color: "#026AA7",
    what: "Board and card activity. Moved a card to Done? That counts as work.",
  },
  {
    name: "GitHub",
    color: "#333",
    what: "Commits, pull request reviews, and issues. The receipts for your coding hours.",
  },
  {
    name: "Jira Cloud",
    color: "#0052CC",
    what: "Issue transitions and comments. PROJ-123: moved to In Review shows up with the issue summary.",
  },
]

const stack = [
  { label: "Framework", value: "Next.js 14 (App Router)" },
  { label: "Auth", value: "NextAuth.js v5, JWT-only — zero database" },
  { label: "AI", value: "Google Gemini 2.5 Flash Lite" },
  { label: "Styling", value: "Tailwind CSS v4 + shadcn/ui" },
  { label: "Language", value: "TypeScript 5" },
  { label: "Hosting", value: "Vercel" },
  { label: "Fonts", value: "DM Serif Display + DM Sans" },
]

const facts = [
  "Your activities are never stored on a server. Every fetch is fresh, direct from the source API.",
  "The AI system prompt lives in a plain Markdown file, editable without a deploy.",
  "Jira access tokens are too large for a cookie, so only the refresh token is stored and a new access token is fetched on every request.",
  "Multi-hour calendar events are \"spanned\" across hour buckets with a flag so they only render once in the feed.",
  "Activities are flattened to 80-character titles before being sent to the AI — cheaper tokens, same signal.",
  "Both the AI provider and the time-tracking system use an adapter pattern, so swapping either out is one file.",
  "The suggestion cache is versioned in localStorage so a code update never surfaces stale AI results.",
]

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.55s ease both; }
        .fade-up-1 { animation-delay: 0.05s; }
        .fade-up-2 { animation-delay: 0.13s; }
        .fade-up-3 { animation-delay: 0.21s; }
        .fade-up-4 { animation-delay: 0.29s; }
        .source-card:hover { transform: translateY(-2px); }
        .source-card { transition: transform 0.18s ease, box-shadow 0.18s ease; }
        .source-card:hover { box-shadow: 0 8px 24px -4px rgba(0,0,0,0.12); }
        .fact-item { transition: background 0.15s ease; }
        .fact-item:hover { background: hsl(var(--muted)); }
      `}</style>

      {/* Nav */}
      <nav className="border-b sticky top-0 z-10 bg-background/80 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <span className="text-base leading-none">←</span> Worklog
          </Link>
          <span className="text-xs tracking-widest uppercase text-muted-foreground font-medium">How it works</span>
        </div>
      </nav>

      <article className="max-w-2xl mx-auto px-6 pb-24">

        {/* ── Hero ── */}
        <header className="pt-16 pb-14 fade-up fade-up-1">
          <p className="text-xs tracking-widest uppercase text-muted-foreground mb-5 font-medium">
            About Worklog
          </p>
          <h1
            style={{ fontFamily: "'DM Serif Display', serif", lineHeight: 1.15 }}
            className="text-[2.8rem] mb-6 text-foreground"
          >
            The app that turns your chaotic workday into a neat timelog
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            You had a productive day. Back-to-back meetings, a long email thread, three code reviews, half a dozen Slack threads, and two Jira tickets closed. Then 4:55 PM arrives and your time-tracking system is just… waiting. Blinking cursor, empty rows.
          </p>
          <p className="text-lg text-muted-foreground leading-relaxed mt-4">
            Worklog is the missing piece. It collects everything you did, lays it out hour by hour, and uses AI to translate it into billable time entries — mapped to the right projects and activity types, with descriptions you'd actually write yourself.
          </p>
        </header>

        <hr className="border-border mb-14" />

        {/* ── Data Sources ── */}
        <section className="mb-16 fade-up fade-up-2">
          <p className="text-xs tracking-widest uppercase text-muted-foreground font-medium mb-2">Section 01</p>
          <h2 style={{ fontFamily: "'DM Serif Display', serif" }} className="text-3xl mb-3">
            Where your day comes from
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-8">
            Worklog connects to seven data sources. Each one contributes a different slice of your workday. You connect them once; after that they just show up.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sources.map((s) => (
              <div
                key={s.name}
                className="source-card rounded-lg border p-4 flex gap-3"
              >
                <div
                  className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                <div>
                  <p className="font-medium text-sm mb-0.5">{s.name}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{s.what}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-sm text-muted-foreground mt-5 leading-relaxed">
            Google Calendar events are <em>primaries</em> — the anchor points of each hour. Everything else (emails, messages, commits) is a <em>communication</em>, shown alongside but capped at six per hour so the view doesn't turn into a wall of noise. Emails are also deduplicated by thread, so a long back-and-forth shows up as one item.
          </p>
        </section>

        <hr className="border-border mb-14" />

        {/* ── Fetch + Map Logic ── */}
        <section className="mb-16 fade-up fade-up-3">
          <p className="text-xs tracking-widest uppercase text-muted-foreground font-medium mb-2">Section 02</p>
          <h2 style={{ fontFamily: "'DM Serif Display', serif" }} className="text-3xl mb-3">
            From a pile of events to billable hours
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-6">
            This is where the interesting stuff happens. Here's the full journey from "you pick a date" to "here's your timelog."
          </p>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full bg-foreground text-background text-xs font-bold flex items-center justify-center shrink-0">1</div>
                <div className="w-px flex-1 bg-border mt-2" />
              </div>
              <div className="pb-6">
                <h3 className="font-semibold mb-1.5">Parallel fetch</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  All seven sources are queried simultaneously. Each has its own OAuth token stored as a secure HTTP-only cookie. Google uses NextAuth's JWT; Jira stores only the refresh token (access tokens are too big for cookies) and fetches a fresh one per request.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full bg-foreground text-background text-xs font-bold flex items-center justify-center shrink-0">2</div>
                <div className="w-px flex-1 bg-border mt-2" />
              </div>
              <div className="pb-6">
                <h3 className="font-semibold mb-1.5">Hour bucketing</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Activities are dropped into hourly buckets from 6 AM to 11 PM. Multi-hour calendar events span multiple buckets but only render once thanks to an <code className="text-xs bg-muted px-1 py-0.5 rounded">isSpanning</code> flag. Communications are capped per bucket so busy hours stay readable.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full bg-foreground text-background text-xs font-bold flex items-center justify-center shrink-0">3</div>
                <div className="w-px flex-1 bg-border mt-2" />
              </div>
              <div className="pb-6">
                <h3 className="font-semibold mb-1.5">PM context fetch</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  When you click Generate, the app pulls your project context from the time-tracking system: the 20 projects you've used most in the last 14 days, the top 3 activity types per project, your hour allocations for the day, any existing time records, and the time-lock date (logged hours before that date are untouchable).
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full bg-foreground text-background text-xs font-bold flex items-center justify-center shrink-0">4</div>
                <div className="w-px flex-1 bg-border mt-2" />
              </div>
              <div className="pb-6">
                <h3 className="font-semibold mb-1.5">AI suggestion</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Activities are flattened to 80-character titles to save tokens, then assembled into a prompt alongside your project context and a system prompt that explains the rules. Gemini 2.5 Flash Lite returns structured JSON: one entry per project, with hours, a description, and the source activities it drew from.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full bg-foreground text-background text-xs font-bold flex items-center justify-center shrink-0">5</div>
              </div>
              <div>
                <h3 className="font-semibold mb-1.5">Review and submit</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  You see the suggestions, edit anything that looks off, and hit Submit. Each entry is validated server-side against the time-lock before being written to your time-tracking system. The suggestions are cached in localStorage per date so a page refresh doesn't throw away your work.
                </p>
              </div>
            </div>
          </div>
        </section>

        <hr className="border-border mb-14" />

        {/* ── Supported Systems ── */}
        <section className="mb-16 fade-up fade-up-4">
          <p className="text-xs tracking-widest uppercase text-muted-foreground font-medium mb-2">Section 03</p>
          <h2 style={{ fontFamily: "'DM Serif Display', serif" }} className="text-3xl mb-3">
            Supported time tracking systems
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-6">
            Currently one system is supported, with the plumbing already in place to add more.
          </p>

          <div className="rounded-lg border p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-md bg-foreground text-background flex items-center justify-center shrink-0 text-sm font-bold">M</div>
              <div>
                <h3 className="font-semibold mb-1">Milient / Moment</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Milient (also known as Moment) is a time management platform widely used by Norwegian consulting firms. Worklog uses it as the source of truth for projects, activity types, hour allocations, and as the destination for submitted time records. Your user account is resolved dynamically from your Google sign-in email, so there's no separate login.
                </p>
              </div>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mt-4 leading-relaxed">
            Both the time-tracking system and the AI provider are abstracted behind adapter interfaces, so adding support for Harvest, Jira Service Management, or another provider is a matter of implementing one interface in one file.
          </p>
        </section>

        <hr className="border-border mb-14" />

        {/* ── Tech Stack ── */}
        <section className="mb-16">
          <p className="text-xs tracking-widest uppercase text-muted-foreground font-medium mb-2">Section 04</p>
          <h2 style={{ fontFamily: "'DM Serif Display', serif" }} className="text-3xl mb-3">
            Tech stack and other interesting facts
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-8">
            The short version: Next.js, Gemini, no database, and a few architectural choices that made things surprisingly simple.
          </p>

          <div className="rounded-lg border overflow-hidden mb-10">
            {stack.map((item, i) => (
              <div
                key={item.label}
                className={`flex items-baseline gap-4 px-5 py-3.5 ${i < stack.length - 1 ? "border-b" : ""}`}
              >
                <span className="text-xs text-muted-foreground w-28 shrink-0 font-medium">{item.label}</span>
                <span className="text-sm">{item.value}</span>
              </div>
            ))}
          </div>

          <h3 className="font-semibold mb-4 text-sm tracking-wide uppercase text-muted-foreground">Things worth knowing</h3>
          <div className="space-y-1">
            {facts.map((fact, i) => (
              <div
                key={i}
                className="fact-item flex gap-3 px-4 py-3 rounded-md"
              >
                <span className="text-muted-foreground text-sm shrink-0 mt-0.5">→</span>
                <p className="text-sm text-muted-foreground leading-relaxed">{fact}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Footer ── */}
        <div className="border-t pt-8 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Worklog
          </Link>
          <p className="text-xs text-muted-foreground">v1.3.5</p>
        </div>

      </article>
    </div>
  )
}
