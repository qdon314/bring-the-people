# Frontend Contract — Bring The People

This is the authoritative frontend contract. All agents (Claude Code, Kilocode,
Codex, etc.) must read this file before writing frontend code.

Companion file: `docs/contracts/frontend-manifest.md` (component/utility inventory).

---

## §1 Canonical Values

All status values below are authoritative. Do not use synonyms, aliases, or
invented values. If a value is not in these tables, it does not exist.

### Review status (segments, frames, variants)

| Value    | Meaning                |
|----------|------------------------|
| pending  | Awaiting human review  |
| approved | Approved by reviewer   |
| rejected | Rejected by reviewer   |

WRONG: `"draft"`, `"in_review"`, `"accepted"`, `"declined"`

### Action-to-status mapping

Frontend review actions map to backend status values. Do not confuse action
verbs with status values. `"approve"` is an action. `"approved"` is a status.

| UI action button | API field: `action` | Stored as `review_status` |
|------------------|---------------------|---------------------------|
| "Approve"        | `"approve"`         | `"approved"`              |
| "Reject"         | `"reject"`          | `"rejected"`              |

### Job status

| Value     | Terminal? |
|-----------|-----------|
| queued    | no        |
| running   | no        |
| completed | yes       |
| failed    | yes       |

### Experiment status

| Value             | Meaning                                |
|-------------------|----------------------------------------|
| draft             | Created, not yet launched              |
| active            | Ads running externally                 |
| awaiting_approval | Carried from prior cycle, needs review |
| decided           | Scale/hold/kill decision recorded      |

### Decision action

| Value | Meaning          |
|-------|------------------|
| scale | Increase spend   |
| hold  | Maintain current |
| kill  | Stop experiment  |

### Show phase

| Value | Window         |
|-------|----------------|
| early | T-60 to T-22   |
| mid   | T-21 to T-8    |
| late  | T-7 to T-0     |

---

## §2 File Ownership

### Feature modules: `features/{domain}/`

Each domain (shows, cycles, segments, frames, variants, experiments,
observations, decisions, memos, jobs) owns a feature module:

| File         | Contains                           | Must NOT contain               |
|--------------|------------------------------------|--------------------------------|
| api.ts       | Endpoint calls via shared client   | Query hooks, UI logic, cache   |
| queries.ts   | Query key factory + useQuery hooks | Mutations, fetch calls         |
| mutations.ts | useMutation hooks + invalidation   | Direct API calls, UI logic     |
| types.ts     | Generated types for this domain    | Hand-written interfaces        |
| ui/*.tsx      | React components for this domain   | Direct fetch, business logic   |

### Shared: `shared/`

| Directory    | Contains                                      | Must NOT contain         |
|--------------|-----------------------------------------------|--------------------------|
| shared/api/  | Base client, error types, interceptors        | Domain-specific endpoints|
| shared/ui/   | StatusBadge, FormField, ErrorBanner, etc.     | Domain knowledge         |
| shared/lib/  | getCycleProgress(), buildUTM(), cn()          | Component code, API calls|
| shared/config/ | Design tokens, polling intervals, env vars  | Runtime logic            |

### Rules

- All API calls go through `shared/api/client.ts`. No raw `fetch()`.
- Query keys come from factory functions, never inline strings.

```ts
// WRONG
useQuery({ queryKey: ['segments', showId] })

// RIGHT
useQuery({ queryKey: segmentKeys.list(showId) })
```

- Mutations own their invalidation — the component that triggers a mutation
  does NOT call `queryClient.invalidateQueries` directly.
- `getCycleProgress()` in `shared/lib/` is the ONLY source of step-completion
  logic. `CycleStepper` and `NextActionPanel` both consume its output. No
  alternate derivation.

---

## §3 Component Patterns

### Required structure (in order)

1. `'use client'` directive (if interactive)
2. Imports: React, hooks, shared UI, feature types
3. Props interface (named `{ComponentName}Props`, always explicit)
4. Named export function (not default export)
5. Hooks at top of function body
6. Derived state as `const` (not inline ternaries in JSX)
7. Early returns for loading/empty/error
8. Main render

```tsx
'use client'

import { useSegments } from '@/features/segments/queries'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { ErrorBanner } from '@/shared/ui/ErrorBanner'
import type { Segment } from '@/features/segments/types'

interface SegmentListProps {
  showId: string
  cycleId: string
}

export function SegmentList({ showId, cycleId }: SegmentListProps) {
  const { data, isLoading, error } = useSegments(showId, cycleId)

  const hasSegments = data && data.length > 0

  if (error) return <ErrorBanner error={error} />
  if (isLoading) return <SegmentListSkeleton />
  if (!hasSegments) return <EmptyState message="No segments yet." />

  return ( /* success state */ )
}
```

### Four required states

Every component that fetches or depends on async data MUST handle all four:

| State   | Implementation                          |
|---------|-----------------------------------------|
| Loading | Dedicated `*Skeleton` component         |
| Empty   | Descriptive message, optional CTA       |
| Error   | `ErrorBanner` with message, retry action|
| Success | The actual content                      |

```tsx
// WRONG — missing empty and error states
{isLoading ? <Spinner /> : <Content />}
```

### Naming conventions

| Thing           | Convention       | Example                |
|-----------------|------------------|------------------------|
| Components      | PascalCase       | SegmentCard            |
| Props interface | {Name}Props      | SegmentCardProps       |
| Hooks           | use{Name}        | useSegments            |
| Skeletons       | {Name}Skeleton   | SegmentCardSkeleton    |
| Modals          | {Name}Modal      | SegmentEditorModal     |
| API modules     | {domain}Api      | segmentsApi            |
| Query factories | {domain}Keys     | segmentKeys            |
| Event handlers  | on{Event}        | onApprove, onDismiss   |
| Boolean state   | is/has/should    | isApproved, hasSegments|

### Exports

- Named exports for all components and hooks.
- Default exports ONLY for Next.js `page.tsx` files.

### Styling

- Tailwind utility classes via `cn()` helper.
- Use design tokens from `tailwind.config.ts`, not raw hex values.

```tsx
// WRONG
className="text-[#c05621]"

// RIGHT
className="text-primary"
```

- Interactive elements must have `focus-visible` ring.
- Respect `prefers-reduced-motion` (handled globally, but do not add new
  animations without the media query).

---

## §4 API Integration

### Query key factories

Every feature module defines a key factory. All query hooks in that module
use it. No inline key arrays anywhere.

```ts
// features/segments/queries.ts
export const segmentKeys = {
  all:    (showId: string) => ['segments', showId] as const,
  list:   (showId: string, cycleId: string) =>
            [...segmentKeys.all(showId), 'list', cycleId] as const,
  detail: (showId: string, id: string) =>
            [...segmentKeys.all(showId), id] as const,
}
```

### Mutations own invalidation

The mutation hook declares which queries to invalidate on success. The calling
component does NOT touch `queryClient`.

```ts
// features/segments/mutations.ts
export function useApproveSegment(showId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      segmentsApi.review(id, { action: 'approve' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: segmentKeys.all(showId) })
    },
  })
}
```

```ts
// WRONG — invalidation in a component
const qc = useQueryClient()
onClick={() => {
  await approve(id)
  qc.invalidateQueries({ queryKey: ['segments'] })
}}
```

### Optimistic updates

Use for review actions (approve/reject) where the outcome is predictable.
Cancel outgoing queries, snapshot previous data, update cache, rollback on error.

### Error handling

- API errors surface via `ErrorBanner` or toast, never silent.
- Network errors: toast with retry suggestion.
- Validation errors (422): display field-level messages.
- 404: show empty state or redirect, not a crash.
- Do not catch errors just to `console.log` them.

### Async job polling

Strategy, creative, and memo runs return a job ID. Poll using the shared
`useJobPoller` hook.

| Elapsed | Interval |
|---------|----------|
| 0–5s    | 1s       |
| 5–30s   | 2s       |
| >30s    | 5s       |

Terminal states: `completed`, `failed`. On terminal:

- Stop polling.
- Invalidate queries by job type (e.g., strategy job completion invalidates
  segment + frame queries).
- Show success toast or error with readable message + retry.

```ts
// WRONG
setTimeout(() => refetch(), 500)
await new Promise(r => setTimeout(r, 1000))

// RIGHT
useJobPoller(jobId, { onComplete, onFailed })
```

---

## §5 UX Rules

### Toast / notification behavior

- Success: brief confirmation, auto-dismiss 3s.
  `"Segment approved"` — not `"Successfully approved segment"`.
- Error: persistent until dismissed, includes what failed and what the user
  can do. `"Failed to approve segment. Try again or refresh the page."`
- In-progress: show only for operations >1s (job polling). Dismiss
  automatically when the operation completes.
- Never stack more than 3 toasts. Newest replaces oldest.

```ts
// WRONG
toast.success("Operation completed successfully!")

// RIGHT
toast.success("Segment approved")
```

### Form behavior

- Validate on blur for individual fields, on submit for the full form.
- Disable submit button while submitting. Change label to gerund:
  `"Save"` → `"Saving…"`
- Show field-level errors below the field, not in a banner at the top.
- Preserve user input on failed submission. Never clear the form on error.
- Use React Hook Form + Zod schemas. Do not use uncontrolled inputs with
  manual validation.

### Review actions (approve/reject)

- Approve: single click, optimistic update, no confirmation dialog.
- Reject: requires confirmation dialog with optional reason.
- Both: disable the clicked button and show `"Approving…"` / `"Rejecting…"`
  until settled.
- After review: update the card inline. Do not navigate away or refresh the page.

### Modals / dialogs

- Use Radix Dialog via `shared/ui/dialog.tsx`.
- Close on Escape and overlay click.
- Trap focus inside the modal.
- Reset form state on close (use `key` prop to force remount).
- Destructive actions in modals require explicit confirm button with danger styling.

### Empty states

- Every list view has a descriptive empty state.
- Include what the user should do next.

```tsx
// WRONG
<p>No data</p>

// RIGHT
<EmptyState message="No segments yet. Run the strategy agent to generate audience segments." />
```

- If the empty state depends on a prior workflow step, say so:
  `"Approve segments in the Plan tab before generating creative variants."`

### Loading states

- Use dedicated `*Skeleton` components, not spinners, for initial page loads.
- Spinners (`SpinnerIcon`) only for inline actions (button loading, polling indicator).
- Never show a blank screen while loading.

### Responsive behavior

- Minimum supported width: tablet (768px).
- Sidebar collapses to icon-only below 1024px.
- Cards reflow from grid to stack below 768px.
- Do not hide functionality at smaller widths — reflow layout, do not
  remove controls.

### Agent-generated content display

- Always show agent output in a visually distinct container (card with muted
  background).
- Include `"Generated by [agent type]"` attribution.
- If content has been human-edited, show both the original (collapsed) and
  edited version.
- Never silently overwrite agent output with human edits — preserve the
  original for auditability.

---

## §6 Forbidden Patterns

### FP-1: Ghost endpoints

Inventing API routes that don't exist in `src/growth/app/api/`. If you need
an endpoint that doesn't exist, STOP and ask. Do not create a frontend call
to a URL you haven't verified.

### FP-2: Status synonym invention

Using any status value not in §1 Canonical Values.

```ts
// WRONG
status === 'draft'       // for review status — use 'pending'
status === 'accepted'    // use 'approved'
status === 'in_progress' // use 'running'
```

### FP-3: Inline query keys

```ts
// WRONG
useQuery({ queryKey: ['segments', showId, cycleId] })

// RIGHT
useQuery({ queryKey: segmentKeys.list(showId, cycleId) })
```

### FP-4: Component-level invalidation

```ts
// WRONG — invalidation inside a component
const qc = useQueryClient()
onClick={() => {
  await approve(id)
  qc.invalidateQueries({ queryKey: ['segments'] })
}}

// RIGHT — invalidation inside the mutation hook in mutations.ts
```

### FP-5: setTimeout for data consistency

```ts
// WRONG
setTimeout(() => refetch(), 500)
await sleep(1000); queryClient.invalidateQueries(...)

// RIGHT
// useJobPoller for async jobs. Mutation onSuccess for synchronous writes.
```

### FP-6: Duplicating existing utilities

Before creating any helper, check `docs/contracts/frontend-manifest.md`.
If something similar exists, use or extend it. Do not create a parallel version.

Common duplicates agents create:

- A second `cn()` or classnames helper
- A second fetch wrapper alongside `client.ts`
- StatusBadge variants instead of using the existing one
- Custom polling logic instead of `useJobPoller`

### FP-7: Business logic in components

Components render UI. They do not compute metrics, derive workflow state,
build UTM strings, or determine step completion. That logic belongs in
`shared/lib/` or `features/*/lib/`.

```ts
// WRONG — in a component
const isComplete = segments.every(s => s.review_status === 'approved')
  && frames.length > 0
  && frames.every(f => f.review_status === 'approved')

// RIGHT
const progress = getCycleProgress(snapshot)
```

### FP-8: Raw hex/color values

```tsx
// WRONG
className="text-[#c05621]"
style={{ color: '#c05621' }}

// RIGHT
className="text-primary"
```

All colors come from `tailwind.config.ts` tokens.

### FP-9: Swallowing errors

```ts
// WRONG
try { await save() } catch (e) { console.log(e) }
.catch(() => {})

// RIGHT
// Let mutations surface errors via onError → toast.
// Use ErrorBanner for query errors.
```

### FP-10: Uncontrolled form inputs

```ts
// WRONG
useRef() + manual DOM reads
useState per field with manual onChange handlers

// RIGHT
// React Hook Form + Zod schema
```

### FP-11: Hardcoded configuration

```ts
// WRONG
const API_URL = 'http://localhost:8000'
const POLL_INTERVAL = 2000

// RIGHT
// Import from shared/config/ or environment variables.
```

### FP-12: Missing accessibility

Every interactive element must have:

- Visible focus indicator (`focus-visible` ring)
- Keyboard operability (Enter/Space for buttons, Escape for modals)
- Accessible name (`aria-label` if no visible text)

Agents frequently skip `aria-label` on icon-only buttons.

### FP-13: Default exports for non-pages

```ts
// WRONG
export default function SegmentCard() {}

// RIGHT
export function SegmentCard() {}
```

Default exports only for Next.js `page.tsx` files.

---

## §7 Testing

### Requirement

Every code change must include or update tests in the same task. No deferred
"test later" unless explicitly approved by the user.

### Runner

Vitest is the test runner. Tests live next to the code they test using the
`.test.ts` / `.test.tsx` suffix.

```
features/segments/queries.test.ts
shared/lib/progress.test.ts
shared/api/validators/primitives.test.ts
```

### What to test

| Layer                  | Test type         | Example                                    |
|------------------------|-------------------|--------------------------------------------|
| `shared/lib/`          | Unit              | `getCycleProgress()` returns correct steps |
| `shared/api/validators/` | Unit            | Validator accepts valid, rejects malformed |
| `features/*/queries.ts`| Unit (mocked API) | Query key factory produces correct arrays  |
| `features/*/mutations.ts`| Unit (mocked API)| Mutation invalidates expected query keys  |
| `features/*/ui/*.tsx`  | Component         | Renders all four states (loading/empty/error/success) |
| `shared/ui/`           | Component         | Renders with expected props, fires callbacks|

### What NOT to test

- Next.js page routing or layout wiring (covered by build).
- Third-party library internals (Radix, TanStack Query).
- Styling / visual regression (no visual test infrastructure yet).

### Quality gates

Agents must run and pass before reporting completion:

1. `npm run typecheck`
2. `npm run lint`
3. `npm run test` (when test infrastructure is present)

If a gate is skipped, the agent must state exactly why.

### Test conventions

- Use `describe` / `it` blocks. Name tests as behavior: `it('returns approved when all segments approved')`.
- Mock API calls at the `shared/api/client.ts` boundary, not at `fetch`.
- Use `@testing-library/react` for component tests. Query by role or label, not by test ID or CSS class.
- Do not use snapshot tests for components — they break on unrelated changes and provide low signal.
- Keep tests focused: one behavior per `it` block.
