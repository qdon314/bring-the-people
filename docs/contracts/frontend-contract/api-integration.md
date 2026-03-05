# §4 API Integration

← [Frontend Contract index](../frontend-contract.md)

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
