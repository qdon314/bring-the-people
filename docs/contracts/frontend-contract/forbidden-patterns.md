# §6 Forbidden Patterns

← [Frontend Contract index](../frontend-contract.md)

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
