# Code Patterns & Conventions

## Adapter Pattern

Both AI and PM integrations use an adapter interface + factory:

```
lib/ai/adapter.ts   → AiAdapter interface
lib/ai/index.ts     → getAiAdapter() factory
lib/ai/gemini.ts    → GeminiAdapter implementation

lib/pm/adapter.ts   → PmAdapter interface
lib/pm/index.ts     → getPmAdapter(userEmail) factory
lib/pm/milient.ts   → MilientPmAdapter implementation
```

To add a new provider, create an implementation file and update the factory.

## Internationalization

All UI strings live in `app/lib/i18n.tsx` as a flat dictionary keyed by dotted paths:

```ts
"ai.generate": { en: "Generate suggestions", no: "Generer forslag" },
```

Use `const { t, lang } = useTranslation()` in components. The version string is also here (`footer.version`).

## Component Conventions

- **shadcn/ui** for all base components (Button, Card, Badge, Alert, Skeleton, Separator)
- **Lucide React** for all icons
- **Tailwind CSS** for styling — no CSS modules or styled-components
- **Dark mode** via CSS variables in `globals.css`, toggled via `localStorage`

### Brand Colors (both themes)
- Slack: `#4A154B` (purple)
- Gmail: `#EA4335` (red)
- Calendar: `#4285F4` (blue)
- Docs: `#34A853` (green)

## Responsive Layout

Mobile vs desktop is handled via `matchMedia("(min-width: 1024px)")` in JS (not CSS media queries) when conditional rendering is needed — avoids mounting duplicate components.

CSS-only responsive is fine for styling (hiding text, adjusting gaps), but never mount two instances of a stateful component and hide one with CSS.

## API Route Pattern

All API routes follow the same structure:

```ts
export async function GET() {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  // ... handler logic
}
```

## Milient API

- Base client in `app/lib/milient.ts`: `milientFetch()`, `milientList()`, `milientListAll()`
- Pagination: `size=500`, parallel fetching of remaining pages
- Auth: Basic Auth with API key
- User resolved from Google session email → `userAccountId`

## AI Prompt

The system prompt lives in `prompts/timelog-system.md` (editable without code changes). It's assembled with project/activity context at runtime in `app/lib/ai/prompt.ts`.
