# §3 Component Patterns

← [Frontend Contract index](../frontend-contract.md)

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
