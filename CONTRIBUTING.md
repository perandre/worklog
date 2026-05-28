# Contributing to Worklog

Thanks for contributing. This is an internal Frontkom project; the conventions
below keep it pleasant to work in.

## Prerequisites

- Node.js 22 (matches CI)
- npm

## Setup

```bash
npm install                 # also installs git hooks (husky)
cp .env.example .env.local  # fill in credentials — see README.md
npm run dev                 # http://localhost:3000
```

## Workflow

1. Branch off `main`: `feat/…`, `fix/…`, or `chore/…`.
2. Make focused commits with short, descriptive messages.
3. Run the checks before pushing (the git hooks run these too):
   ```bash
   npm run lint
   npm run typecheck
   npm test
   ```
4. **Bump `version` in `package.json`** (semver) before pushing — it is the
   single source of truth for the version shown in the app.
5. Open a PR. CI (lint + typecheck + test) must be green to merge.

## Quality gates

- **pre-commit** runs ESLint (with autofix) on staged files.
- **pre-push** runs the typecheck and the test suite.
- **CI** re-runs all three on every PR, plus advisory Semgrep and `fallow`
  audits.

Lint blocks on errors only; warnings are tracked tech-debt (see `AGENTS.md`).

## Tests

Unit tests use Vitest and live in `__tests__/` folders next to the code under
test. Prioritise the pure logic in `app/lib/`. The suite pins
`TZ=Europe/Oslo`; keep timezone-sensitive fixtures deterministic.

## Conventions

See [`AGENTS.md`](./AGENTS.md) for the full development guide and
[`docs/`](./docs) for architecture, patterns, and domain rules.
