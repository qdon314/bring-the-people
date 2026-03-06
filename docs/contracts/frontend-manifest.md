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

Last updated: 2026-03-06 (stage7-memo — V2-070..073)

---

## Shared UI Components (`shared/ui/`)

These are called for in `docs/designs/dashboard.md`:

| Component     | Path                       | Status  | Purpose                              |
|---------------|----------------------------|---------|--------------------------------------|
| StatusBadge   | shared/ui/StatusBadge.tsx   | exists  | Render review/job/experiment status  |
| ErrorBanner   | shared/ui/ErrorBanner.tsx   | exists  | Query error display with retry       |
| ErrorBoundary | shared/ui/ErrorBoundary.tsx | planned | Catch React render errors            |
| EmptyState    | shared/ui/EmptyState.tsx    | exists  | Descriptive empty state with CTA     |
| SpinnerIcon   | shared/ui/SpinnerIcon.tsx   | exists  | Inline loading indicator             |
| Dialog        | shared/ui/dialog.tsx        | exists  | Accessible modal (focus trap, Escape/overlay close) |
| ToastContainer | shared/ui/ToastContainer.tsx | exists | Listens for app:toast events and renders dismissible toasts |

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
| segments      | in progress | exists | exists  | useApproveSegment, useRejectSegment, useUpdateSegment, useUndoSegmentReview | SegmentCard, SegmentList (with skeletons), SegmentEditModal |
| frames        | in progress | exists | exists  | useApproveFrame, useRejectFrame, useUpdateFrame, useUndoFrameReview | FrameCard, FrameList (with skeletons), FrameEditModal |
| variants      | complete    | exists | exists  | useApproveVariant, useRejectVariant, useUndoVariantReview, useUpdateVariant | VariantCard, VariantGroup, VariantEditModal (with skeletons, human edit badge) |
| creative      | complete    | exists | -       | useRunCreative | FramePicker, CreativeQueue |
| experiments   | in progress | exists | exists  | useCreateExperiment | ExperimentForm, ExperimentLibraryModal |
| strategy      | in progress | exists | -       | useRunStrategy | StrategyRunPanel |
| runs          | in progress | exists | exists  | useCreateRun, useLaunchRun, useRequestRunReapproval, useRunsByCycle | RunCard, RunCardSkeleton, RunList, RunActions, CreateRunForm |
| observations  | in progress | exists | exists (`useObservations(runId)`) | -  | -   |
| decisions     | in progress | -   | exists (`useDecisions(runId)`)  | -         | -   |
| memos         | complete    | exists | exists (useMemos, useMemo) | useRunMemo | MemoTriggerPanel, MemoHistoryList, MemoView, MemoViewer |
| jobs          | in progress | exists | exists  | -         | -   |
| events        | in progress | exists | exists  | -         | exists (ActivityFeed) |



### Stage 4: Create Tab (2026-03-06)

**Backend:**
- Added `edited_by_human: bool` field to `CreativeVariant` domain model
- Added `edited_by_human: bool` to `VariantResponse` schema
- PATCH `/api/variants/{variant_id}` automatically sets `edited_by_human = True` on any edit

**Frontend:**
- `features/variants/ui/VariantCard.tsx` — added "Human edited" badge when `edited_by_human` is true
- `app/shows/[show_id]/cycles/[cycle_id]/create/page.tsx` — wired page with FramePicker, CreativeQueue, VariantGroup, and frame selector tabs
- `app/shows/[show_id]/cycles/[cycle_id]/create/page.test.tsx` — comprehensive integration tests

**Components completed:**
- FramePicker (with filters, multi-select, job triggering)
- CreativeQueue (job polling panel)
- VariantGroup (grouped by platform)
- VariantCard (approve/reject/edit actions, human edit badge)
- VariantEditModal (edit hook/body/cta)

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

### stage7-memo (2026-03-06) — V2-070..073

**`features/memos/`**

- `api.ts` — added `getMemo(memoId)`, `runMemo(showId, cycleStart, cycleEnd)`
- `mutations.ts` — new file, exports `useRunMemo(showId)`
- `queries.ts` — added `useMemo(memoId)` alongside existing `useMemos(showId)`
- `ui/MemoTriggerPanel` — Generate Memo button with `useJobPolling` integration
- `ui/MemoHistoryList` — memo list with URL query param selection sync (`?memo=<id>`)
- `ui/MemoView` — renders memo markdown as pre-formatted text with date range header
- `ui/MemoViewer` — container: placeholder / skeleton / error / renders MemoView

**`app/shows/[show_id]/cycles/[cycle_id]/memo/page.tsx`**

- Fully wired: `MemoTriggerPanel`, `MemoHistoryList`, `MemoViewer` in 4/8 grid layout
- Derives `cycleStart` from `cycle.started_at`, uses `new Date().toISOString()` for `cycleEnd`
- Reads `?memo` param from URL to restore selected memo on load
