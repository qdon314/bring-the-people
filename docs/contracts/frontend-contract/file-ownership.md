# §2 File Ownership

← [Frontend Contract index](../frontend-contract.md)

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
