---
name: frontend-v2-context
description: Fast-load codebase context for frontend-v2 tasks
---

# Frontend V2 — Codebase Context

last-verified: 2026-03-04 V2-025

This is a fast-load reference. Do not use code-explorer for frontend-v2 tasks.
Load this skill, then go directly to the files you need to modify.

---

## Directory Structure

```
frontend-v2/
  app/                          # Next.js App Router pages
    layout.tsx                  # Root layout
    page.tsx                    # Root redirect
    shows/[show_id]/
      page.tsx                  # Active-cycle redirect (Server Component)
      cycles/[cycle_id]/
        layout.tsx              # Cycle shell (AppShell/ShowHeader/CycleStepper go here)
        page.tsx                # Redirects to /overview
        overview/page.tsx
        plan/page.tsx
        create/page.tsx
        run/page.tsx
        results/page.tsx
        memo/page.tsx
  features/                     # Feature modules — one folder per domain
    cycles/    shows/    segments/    frames/    variants/
    experiments/    observations/    decisions/    memos/
    jobs/    events/    overview/
  shared/
    api/
      client.ts                 # Base fetch wrapper + ApiError class
      generated/
        openapi.json            # Generated OpenAPI schema snapshot
        schema.ts               # Generated TypeScript definitions
      validators/               # Runtime response validation (zod-like)
    errors/
      mapApiError.ts            # Map API/transport failures to UI copy
    hooks/                      # Shared React hooks (useJobPoller — planned)
    lib/
      cycles.ts                 # getActiveCycle()
      progress.ts               # getCycleProgress() — planned
      utils.ts                  # cn() — planned
    config/
      polling.ts                # Polling interval constants — planned
    queryKeys.ts                # Canonical query key factories for all domains
  test/
    msw/
      server.ts                 # Shared MSW server for integration tests
      handlers.ts               # Baseline mocked API handlers
  tests/
    e2e/
      smoke.spec.ts             # Playwright smoke test
  vitest.config.ts
  vitest.setup.ts
  playwright.config.ts
```

---

## Routing Convention

All cycle-scoped routes follow:
```
/shows/[show_id]/cycles/[cycle_id]/<tab>
```
Tabs: `overview` | `plan` | `create` | `run` | `results` | `memo`

`/shows/[show_id]` → server redirect → active cycle → `/overview`
`/shows/[show_id]/cycles/[cycle_id]` → redirect → `/overview`

Params are always strings: `show_id`, `cycle_id`. Use these names exactly.

---

## Key Patterns

**Server Components** (`app/` pages): use `async function`, direct API calls, `redirect()` / `notFound()` from `next/navigation`.

**Feature module layout** — each feature has:
- `api.ts` — typed fetch functions (no React, no hooks)
- `queries.ts` — React Query hooks (`useQuery`, `useMutation`)
- `ui/` — components (when built)
- `*.test.ts` / `*.integration.test.ts` — collocated tests

**Query keys**: always use factories from `shared/queryKeys.ts`.
```ts
import { queryKeys } from '@/shared/queryKeys'
queryKeys.cycles.list(showId)
```

**API errors**: use `ApiError` from `shared/api/client.ts`. Check `error instanceof ApiError`.

**Job polling**: use `features/jobs/useJobPolling.ts` — not a hand-rolled setTimeout.

**Path alias**: `@/` maps to `frontend-v2/` root.

---

## Existing Shared Primitives (importable now)

| Name | Path | Purpose |
|---|---|---|
| `queryKeys` | `shared/queryKeys.ts` | All query key factories |
| `getActiveCycle()` | `shared/lib/cycles.ts` | Active cycle from list |
| `mapApiError()` | `shared/errors/mapApiError.ts` | API error → UI copy |
| `ApiError` | `shared/api/client.ts` | Typed API error class |
| `useJobPolling` | `features/jobs/useJobPolling.ts` | Async job polling hook (uses useState/useEffect — not React Query) |
| `useOverviewSnapshot` | `features/overview/useOverviewSnapshot.ts` | Multi-domain query aggregation → `CycleProgressSnapshot` + events (uses React Query) |
| validators | `shared/api/validators/` | Runtime response validation |
| MSW server | `test/msw/server.ts` | Integration test server |
| MSW handlers | `test/msw/handlers.ts` | Baseline API mocks |
| `getCycleProgress()` | `features/cycles/getCycleProgress.ts` | Derive workflow step completion from snapshot |
| `CycleStepper` | `features/cycles/ui/CycleStepper.tsx` | Horizontal step progress indicator (props: showId, cycleId, progress) |
| `CycleStepperSkeleton` | `features/cycles/ui/CycleStepper.tsx` | Loading skeleton for CycleStepper |
| `AppShell` | `features/layout/AppShell.tsx` | Cycle layout shell (TopBar + CycleStepper + Sidebar + content) |
| `AppShellSkeleton` | `features/layout/AppShell.tsx` | Loading skeleton for AppShell |
| `ShowHeader` | `features/shows/ui/ShowHeader.tsx` | Show name, phase badge, dates |
| Feature api.ts stubs | `features/{segments,frames,variants,experiments,observations,memos,events}/api.ts` | List functions for each domain (no validators — raw typed returns) |

**React Query**: `@tanstack/react-query` IS installed. `QueryClientProvider` is in `app/providers.tsx` (wrapped in root layout). Use `useQuery`/`useQueries` for new data-fetching hooks.

**Planned (do not import yet):** `cn()`, `StatusBadge`, `ErrorBanner`, `EmptyState`, `SpinnerIcon`, `Dialog`, `useJobPoller`.
See `docs/contracts/frontend-manifest.md` for full inventory.

---

## Test Commands

```bash
cd frontend-v2 && npm run lint
cd frontend-v2 && npm run test
cd frontend-v2 && npm run build   # when relevant
```

Unit/integration tests: Vitest (`*.test.ts`, `*.integration.test.ts` collocated with source).
E2E: Playwright (`tests/e2e/`).

---

## Contract Pointers

- **Rules and forbidden patterns** → `docs/contracts/frontend-contract.md`
- **Component/utility inventory** → `docs/contracts/frontend-manifest.md`
- **Architecture decisions** → `docs/designs/frontend-architecture.md`
- **Dashboard design** → `docs/designs/dashboard.md`
- **Work items / ticket backlog** → `docs/plans/2026-02-27-frontend-v2-concrete-work-items.md`

Read only the relevant section of `frontend-contract.md`, not the full 588 lines.
