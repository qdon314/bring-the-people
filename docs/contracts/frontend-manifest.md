# Frontend Manifest — Bring The People

Living inventory of components, utilities, hooks, and feature modules for
`frontend-v2/`. Agents must check this file before creating new components
or utilities to avoid duplication.

**Status column**: `exists` = file is implemented and importable.
`planned` = confirmed by design docs — use this name and path when building.
Do not try to import planned items.

**Update this file whenever you add a shared component, utility, or hook.**
Flip `planned` → `exists` when you create the file. Add new rows for items
not yet listed. This is part of the definition of done.

Last updated: 2026-03-05 (stage-2-overview-ui)

---

## Shared UI Components (`shared/ui/`)

These are called for in `docs/designs/dashboard.md`:

| Component     | Path                       | Status  | Purpose                              |
|---------------|----------------------------|---------|--------------------------------------|
| StatusBadge   | shared/ui/StatusBadge.tsx   | planned | Render review/job/experiment status  |
| ErrorBanner   | shared/ui/ErrorBanner.tsx   | exists  | Query error display with retry       |
| ErrorBoundary | shared/ui/ErrorBoundary.tsx | planned | Catch React render errors            |
| EmptyState    | shared/ui/EmptyState.tsx    | exists  | Descriptive empty state with CTA     |
| SpinnerIcon   | shared/ui/SpinnerIcon.tsx   | planned | Inline loading indicator             |
| Dialog        | shared/ui/dialog.tsx        | planned | Radix Dialog wrapper                 |

## Shared Utilities (`shared/lib/`)

These are called for in `docs/designs/frontend-architecture.md`:

| Function           | Path                    | Status  | Purpose                         |
|--------------------|-------------------------|---------|---------------------------------|
| cn()               | shared/lib/utils.ts     | exists  | Tailwind class merging          |
| getCycleProgress() | features/cycles/getCycleProgress.ts | exists  | Derive workflow step completion |
| getActiveCycle()   | shared/lib/cycles.ts    | exists  | Return most recently started cycle from list |
| query key factories | shared/queryKeys.ts     | exists  | Canonical query key builders by domain |

## Shared Error Utilities (`shared/errors/`)

| Function      | Path                           | Status | Purpose                                    |
|---------------|--------------------------------|--------|--------------------------------------------|
| mapApiError() | shared/errors/mapApiError.ts   | exists | Map API and transport failures to UI copy  |

## Shared Hooks (`shared/hooks/`)

| Hook          | Path                          | Status  | Purpose                    |
|---------------|-------------------------------|---------|----------------------------|
| useJobPoller  | shared/hooks/useJobPoller.ts  | planned | Adaptive async job polling |

## Feature Hooks (`features/*`)

| Hook                  | Path                                           | Status  | Purpose                              |
|-----------------------|------------------------------------------------|---------|--------------------------------------|
| useJobPolling         | features/jobs/useJobPolling.ts                 | exists  | Adaptive job polling for async runs  |
| useOverviewSnapshot   | features/overview/useOverviewSnapshot.ts       | exists  | Aggregate multi-domain queries into CycleProgressSnapshot + events |

## Shared Config (`shared/config/`)

| File          | Path                      | Status  | Purpose                    |
|---------------|---------------------------|---------|----------------------------|
| polling.ts    | shared/config/polling.ts  | planned | Polling interval constants |

## Layout Components (`features/layout/`)

App shell and navigation components for cycle-scoped routes:

| Component       | Path                          | Status | Purpose                              |
|-----------------|-------------------------------|--------|--------------------------------------|
| AppShell        | features/layout/AppShell.tsx  | exists | Sidebar + main content layout        |
| AppShellSkeleton| features/layout/AppShell.tsx  | exists | Loading skeleton for AppShell        |
| Sidebar         | features/layout/Sidebar.tsx   | exists | Left navigation rail with tabs       |
| TopBar          | features/layout/TopBar.tsx    | exists | Show name, phase badge, sales       |
| TopBarSkeleton  | features/layout/TopBar.tsx    | exists | Loading skeleton for TopBar        |

## Show Entry Components (`features/shows/ui/`)

| Component      | Path                                   | Status | Purpose                                    |
|----------------|----------------------------------------|--------|--------------------------------------------|
| StartCycleView | features/shows/ui/StartCycleView.tsx   | exists | No-cycle state: CTA to create first cycle  |

## Show/Cycle Components (`features/shows/ui/`, `features/cycles/ui/`)

| Component     | Path                        | Status  | Purpose                       |
|---------------|-----------------------------|---------|-------------------------------|
| ShowHeader    | features/shows/ui/ShowHeader.tsx    | exists  | Show name, phase, dates       |
| CycleStepper  | features/cycles/ui/CycleStepper.tsx  | exists  | Workflow progress indicator   |

## API Client (`shared/api/`)

| File               | Path                              | Status | Purpose                                  |
|--------------------|-----------------------------------|--------|------------------------------------------|
| client.ts          | shared/api/client.ts              | exists | Base fetch wrapper, ApiError class       |
| openapi.json       | shared/api/generated/openapi.json | exists | Generated OpenAPI schema snapshot         |
| schema.ts          | shared/api/generated/schema.ts    | exists | Generated OpenAPI TypeScript definitions |
| validators/*       | shared/api/validators/*           | exists | Runtime response validation functions     |

## Test Infrastructure

| File               | Path                       | Status | Purpose                                  |
|--------------------|----------------------------|--------|------------------------------------------|
| vitest.config.ts   | vitest.config.ts           | exists | Vitest config (jsdom, globals, coverage) |
| vitest.setup.ts    | vitest.setup.ts            | exists | Test setup (@testing-library/jest-dom)   |
| playwright.config.ts | playwright.config.ts     | exists | Playwright e2e config and dev server     |
| e2e smoke test     | tests/e2e/smoke.spec.ts    | exists | First end-to-end smoke test               |
| msw server setup   | test/msw/server.ts         | exists | Shared MSW server for integration tests    |
| msw handlers       | test/msw/handlers.ts       | exists | Baseline mocked API handlers               |

## Feature Modules (`features/`)

Update this table as feature modules are built.

| Feature       | Status      | api | queries | mutations | ui  |
|---------------|-------------|-----|---------|-----------|-----|
| shows         | in progress | exists | exists  | -         | exists |
| cycles        | in progress | exists | exists  | useCreateCycle | -   |
| layout        | exists      | -    | -       | -         | exists |
| overview      | in progress | -   | -       | -         | exists (NextActionPanel, KPIGrid, OverviewDashboard) |
| segments      | in progress | exists | exists  | -         | -   |
| frames        | in progress | exists | exists  | -         | -   |
| variants      | in progress | exists | exists  | -         | -   |
| experiments   | in progress | exists | exists  | -         | -   |
| runs          | in progress | exists | exists  | createRun, launchRun, requestRunReapproval | -   |
| observations  | in progress | exists | exists (`useObservations(runId)`) | -  | -   |
| decisions     | in progress | -   | exists (`useDecisions(runId)`)  | -         | -   |
| memos         | in progress | exists | exists  | -         | -   |
| jobs          | in progress | exists | exists  | -         | -   |
| events        | in progress | exists | exists  | -         | exists (ActivityFeed) |

---

## Recent Changes

### entity-refactor (2026-03-05)

**Query key factories (`shared/queryKeys.ts`)**

- `runKeys` added: `listByCycle(cycleId)`, `listByExperiment(experimentId)`, `detail(runId)`, `metrics(runId)`
- `observationKeys.list(runId)` — parameter renamed from `experimentId` to `runId`
- `decisionKeys.list(runId)` — parameter renamed from `experimentId` to `runId`

**`getCycleProgress` / `CycleProgressSnapshot`**

- `runs` replaces `experiments` in the snapshot shape
- `ObservationSnapshot.run_id` replaces `experiment_id`
