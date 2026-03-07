# Milient Task Support — Implementation Plan

## API findings (probed 2026-03-02)

### `/tasks` endpoint ✅
- **Filter by activity**: `GET /tasks?projectExtensionId={id}` ✅
- **Filter by project**: `GET /tasks?projectId={id}` ✅
- **Total tasks in company**: 4,073
- **Key fields**: `id`, `name`, `taskNumber`, `taskState` ("open"|"closed"), `projectExtensionId`

### Time records already carry task data ✅
`GET /timeRecords` response includes:
- `taskId` (number | null)
- `taskName` (string | null)
- `taskNumber` (string | null)
- `taskState` (string | null)

**This is the critical insight**: we already fetch 30 days of time records in `getRecentUsage()`.
Tasks can be derived from that same data at zero extra API cost.

---

## Fetch strategy

**Extend `getRecentUsage()` in `app/lib/pm/milient.ts`** to also group task usage by
activity type, exactly like it groups activity type usage by project today.

```ts
// Inside getRecentUsage(), after the existing projectCount / typeCount loops:
const tasksByActivityType = new Map<string, Map<string, { id: string; name: string }>>()
for (const r of records) {
  if (!r.taskId || !r.taskName) continue
  const tid = String(r.projectExtensionId)
  if (!tasksByActivityType.has(tid)) tasksByActivityType.set(tid, new Map())
  tasksByActivityType.get(tid)!.set(String(r.taskId), { id: String(r.taskId), name: r.taskName })
}

// Take top 3 tasks per activity type (Map preserves insertion order = most recently seen first)
const topTasksByActivityType = new Map<string, { id: string; name: string }[]>()
for (const [tid, tasks] of tasksByActivityType) {
  topTasksByActivityType.set(tid, Array.from(tasks.values()).slice(0, 3))
}
```

Return `topTasksByActivityType` alongside the existing `topProjectIds` and
`topActivityTypeIdsByProject`.

**In `getActivityTypes()`**, attach tasks to each activity type when building the result:

```ts
return filtered.map((a: any) => ({
  id: String(a.id),
  name: a.name,
  projectId: String(a.projectId),
  tasks: topTasksByActivityType.get(String(a.id)) ?? [],
}))
```

No extra API calls. Tasks are derived entirely from the existing 30-day time records scan.

---

## Data model changes

### `app/lib/types/pm.ts`

```ts
// Add:
export type PmTask = { id: string; name: string }

// Update PmActivityType:
export type PmActivityType = { id: string; name: string; projectId?: string; tasks?: PmTask[] }
```

### `app/lib/types/timelog.ts`

```ts
// Add to TimeLogSuggestion:
taskId?: string
taskName?: string

// Add to TimeLogSubmission:
taskId?: string
```

---

## Adapter changes

### `app/lib/pm/milient.ts`

1. **`getRecentUsage()`**: extend to build + return `topTasksByActivityType` (see above)
2. **`getActivityTypes()`**: attach `tasks` array to each returned activity type
3. **`submitTimeLog()`**: pass `taskId` in the POST body when present:
   ```ts
   ...(entry.taskId ? { taskId: Number(entry.taskId) } : {})
   ```

### `app/lib/pm/adapter.ts`

No changes — `getActivityTypes()` already returns `PmActivityType[]`, just with a new
optional field.

---

## API route changes

### `app/api/ai/pm-context/route.ts`

No changes — tasks flow through as part of `activityTypes`.

### `app/api/ai/submit/route.ts`

Pass `taskId` through to `submitTimeLog()`:
```ts
taskId: entry.taskId,
```

---

## UI changes

### `app/components/ai/SuggestionCard.tsx`

Add an optional **Task** dropdown, rendered only when the selected activity type has tasks:

```tsx
{selectedActivityType?.tasks && selectedActivityType.tasks.length > 0 && (
  <div>
    <label>Task</label>
    <Select value={suggestion.taskId ?? ""} onValueChange={(v) => onUpdate({ taskId: v || undefined })}>
      <SelectItem value="">— No task —</SelectItem>
      {selectedActivityType.tasks.map((task) => (
        <SelectItem key={task.id} value={task.id}>{task.name}</SelectItem>
      ))}
    </Select>
  </div>
)}
```

Placement: below the activity type dropdown, above hours/description. Same visual pattern
as the existing role and activity type dropdowns.

Task selection is **optional** — `taskId` defaults to undefined, which is valid for
`POST /timeRecords` (it accepts `taskId: null`).

---

## AI prompt

**No changes.** The AI does not need to suggest tasks — that's too granular and tasks
are user-specific. The task dropdown is a manual UI choice only.

---

## What this does NOT do

- Does not fetch all tasks upfront — only surfaces tasks the user has actually used in
  the last 30 days (derived from time records)
- Does not show tasks for activities with no recent task usage (dropdown hidden)
- Does not add tasks to the AI prompt or AI output schema

---

## Files to change (summary)

| File | Change |
|---|---|
| `app/lib/types/pm.ts` | Add `PmTask`, add `tasks?` to `PmActivityType` |
| `app/lib/types/timelog.ts` | Add `taskId?`, `taskName?` to suggestion + submission |
| `app/lib/pm/milient.ts` | Extend `getRecentUsage()` + `getActivityTypes()` + `submitTimeLog()` |
| `app/api/ai/submit/route.ts` | Pass `taskId` through |
| `app/components/ai/SuggestionCard.tsx` | Add optional task dropdown |

---

## Open question

Tasks in the `/tasks` API have a `taskState` field. Consider filtering to only
`taskState === "open"` tasks in the dropdown (skip closed ones). This would require
a separate `/tasks?projectExtensionId={id}` call when the usage-derived list contains
tasks — a small enhancement for a future iteration.
