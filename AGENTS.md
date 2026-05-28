# Worklog — Development Guide

AI-powered time logging for consultants. Aggregates your day hour-by-hour from
Google, Slack, Trello, GitHub, Jira, and HubSpot, then uses AI to generate
ready-to-submit time entries mapped to your projects in Milient/Moment.

This file is the canonical guide for both humans and AI agents. `CLAUDE.md`
imports it. For deeper reference, see:

- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — system design, data flow, auth, caching
- [docs/PATTERNS.md](./docs/PATTERNS.md) — code patterns & conventions
- [docs/DOMAIN-LOGIC.md](./docs/DOMAIN-LOGIC.md) — business rules
- [docs/adr/](./docs/adr/) — architecture decision records

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5 (`strict`)
- **Auth**: NextAuth.js v5 (JWT-only, no database)
- **UI**: shadcn/ui + Tailwind CSS v4 + Lucide icons
- **AI**: Google Gemini 2.5 Flash Lite
- **Time tracking**: Milient / Moment
- **Hosting**: Vercel

## Commands

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build
npm run lint         # ESLint (flat config)
npm run lint:fix     # ESLint with autofix
npm run typecheck    # tsc --noEmit
npm test             # Vitest (run once)
npm run test:watch   # Vitest (watch mode)
```

`npm install` sets up git hooks automatically via husky.

## Quality Gates

Three gates protect `main`. They run locally via git hooks and again in CI:

| Gate | Local | CI |
|------|-------|----|
| Lint (`npm run lint`) | pre-commit (lint-staged, changed files) | `ci.yml` |
| Typecheck (`npm run typecheck`) | pre-push | `ci.yml` |
| Tests (`npm test`) | pre-push | `ci.yml` |

Advisory (non-blocking) checks on PRs: Semgrep security scan (`ci.yml`) and a
`fallow` dead-code/reachability audit (`fallow.yml`). Dependencies are kept
fresh by Dependabot.

Lint blocks only on **errors**. Pre-existing `any` at third-party API
boundaries and `react-hooks/exhaustive-deps` are intentionally **warnings** —
see [Known tech-debt](#known-tech-debt).

## Development Workflow

1. Branch off `main` (`feat/…`, `fix/…`, `chore/…`).
2. Commit after each logical change with a short, descriptive message.
3. **Bump the version** in `package.json` → `"version"` before pushing. This is
   the single source of truth; `app/lib/version.ts`, `i18n.tsx`, and the about
   page all read from it. Use semver: patch = bug fix, minor = feature,
   major = breaking change. **Never push without bumping.**
4. Push and open a PR. CI must be green before merge.

## Testing

- Unit tests live next to the code in `__tests__/` folders and use Vitest.
- Focus on the pure, high-value logic: `app/lib/aggregator.ts`,
  `app/lib/ai/parse.ts`, `app/lib/ai/preprocess.ts`.
- The test script pins `TZ=Europe/Oslo`. Anything that reads local time
  (`getHours()`) is timezone-sensitive — write fixtures accordingly (pass an
  explicit `timezone` arg, or use timestamps without a `Z` suffix so they parse
  as local time).

## Coding Conventions

See [docs/PATTERNS.md](./docs/PATTERNS.md) for detail. The essentials:

- **Adapter pattern** for pluggable integrations: `lib/ai/` and `lib/pm/` each
  expose an interface + factory + implementation. New provider = one new file +
  a factory line.
- **i18n**: all UI strings live in `app/lib/i18n.tsx` as a flat dotted-key
  dictionary. Use `const { t, lang } = useTranslation()`.
- **Components**: shadcn/ui base components, Lucide icons, Tailwind only — no
  CSS modules or styled-components.
- **API routes** authenticate first, then handle:
  ```ts
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  ```
- **Responsive**: when conditional rendering is needed, branch on
  `matchMedia("(min-width: 1024px)")` in JS — never mount two instances of a
  stateful component and hide one with CSS.

## Scope Discipline

- Only make changes that are directly requested or clearly necessary.
- Don't add features, refactor, or "improve" beyond what was asked.
- Don't add comments, docstrings, or type annotations to code you didn't change.
- Don't create new files unless necessary — prefer editing existing ones.
- Don't create documentation files unless explicitly requested.

## Git Protocol

- Commit after each logical change, not in large batches.
- Never force-push, amend published commits, or skip hooks.
- Never commit `.env.local` or files containing secrets.

## Human Approval Gates

Always ask before:

- Destructive operations (deleting files/branches, dropping data)
- Actions visible to others (pushing, creating PRs/issues, sending messages)
- Architectural decisions with multiple valid approaches

## Known tech-debt

Tracked as lint warnings to burn down incrementally rather than blocking CI:

- Type the `any` at third-party API boundaries (`google.ts`, `slack.ts`,
  `jira.ts`, `hubspot.ts`, `trello.ts`, `milient.ts`).
- Resolve `react-hooks/exhaustive-deps` warnings in `app/page.tsx`.
- Consider promoting Semgrep from advisory to blocking once the baseline is
  clean, and adding bundle-size budgets (`size-limit`).
