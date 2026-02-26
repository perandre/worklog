# Agent Rules

See also: [ARCHITECTURE.md](./ARCHITECTURE.md) | [PATTERNS.md](./PATTERNS.md) | [DOMAIN-LOGIC.md](./DOMAIN-LOGIC.md)

## Workflow

After each code change:
1. Commit with a short descriptive message.
2. Push it

**Before pushing** (every `git push`), bump the version in `package.json` → `"version"`. That is the single source of truth — all other places (`i18n.tsx`, about page) read from it automatically via `app/lib/version.ts`.

Use semver: patch for bug fixes, minor for features, major for breaking changes. This is mandatory — never push without checking the version.

## Scope Discipline

- Only make changes that are directly requested or clearly necessary.
- Don't add features, refactor, or "improve" beyond what was asked.
- Don't add comments, docstrings, or type annotations to code you didn't change.
- Don't create new files unless absolutely required — prefer editing existing ones.
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
