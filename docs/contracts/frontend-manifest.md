# Frontend Manifest — Bring The People

Living inventory of components, utilities, hooks, and feature modules in
`frontend-v2/`. Agents must check this file before creating new components
or utilities to avoid duplication.

**Update this file whenever you add a shared component, utility, or hook.**
This is part of the definition of done.

Last updated: 2026-02-27

---

## Shared UI Components (`shared/ui/`)

| Component     | Path                       | Purpose                              |
|---------------|----------------------------|--------------------------------------|
| StatusBadge   | shared/ui/StatusBadge.tsx   | Render review/job/experiment status  |
| ErrorBanner   | shared/ui/ErrorBanner.tsx   | Query error display with retry       |
| ErrorBoundary | shared/ui/ErrorBoundary.tsx | Catch React render errors            |
| FormField     | shared/ui/FormField.tsx     | Label + input + error message wrapper|
| SpinnerIcon   | shared/ui/SpinnerIcon.tsx   | Inline loading indicator             |
| ChannelBadge  | shared/ui/ChannelBadge.tsx  | Display channel type                 |
| CopyButton    | shared/ui/CopyButton.tsx    | Copy-to-clipboard with feedback      |
| EmptyState    | shared/ui/EmptyState.tsx    | Descriptive empty state with CTA     |
| Dialog        | shared/ui/dialog.tsx        | Radix Dialog wrapper                 |

## Shared Utilities (`shared/lib/`)

| Function           | Path                      | Purpose                            |
|--------------------|---------------------------|------------------------------------|
| cn()               | shared/lib/utils.ts       | Tailwind class merging (clsx + tw-merge) |
| getCycleProgress() | shared/lib/progress.ts    | Derive workflow step completion    |
| buildUTM()         | shared/lib/utm.ts         | Construct UTM query strings        |
| buildAdSetName()   | shared/lib/utm.ts         | Derive ad set name from UTM params |
| computeMetrics()   | shared/lib/metrics.ts     | Aggregate experiment metrics       |
| computePreviewMetrics() | shared/lib/metrics.ts | Preview metrics before save        |
| formatDate()       | shared/lib/dates.ts       | Consistent date formatting         |

## Shared Hooks (`shared/hooks/`)

| Hook          | Path                          | Purpose                        |
|---------------|-------------------------------|--------------------------------|
| useJobPoller  | shared/hooks/useJobPoller.ts  | Adaptive async job polling     |

## Shared Config (`shared/config/`)

| File            | Path                        | Purpose                         |
|-----------------|-----------------------------|---------------------------------|
| polling.ts      | shared/config/polling.ts    | Polling interval constants      |
| env.ts          | shared/config/env.ts        | Environment variable access     |

## Layout Components (`app/` or `shared/ui/`)

| Component     | Path                          | Purpose                         |
|---------------|-------------------------------|---------------------------------|
| AppShell      | shared/ui/AppShell.tsx        | Sidebar + main content layout   |
| Sidebar       | shared/ui/Sidebar.tsx         | Global navigation rail          |
| ShowHeader    | shared/ui/ShowHeader.tsx      | Show name, phase, dates         |
| CycleStepper  | shared/ui/CycleStepper.tsx    | Workflow progress indicator     |

## Feature Modules (`features/`)

Update this table as feature modules are built.

| Feature       | Status      | api | queries | mutations | ui  |
|---------------|-------------|-----|---------|-----------|-----|
| shows         | not started | -   | -       | -         | -   |
| cycles        | not started | -   | -       | -         | -   |
| segments      | not started | -   | -       | -         | -   |
| frames        | not started | -   | -       | -         | -   |
| variants      | not started | -   | -       | -         | -   |
| experiments   | not started | -   | -       | -         | -   |
| observations  | not started | -   | -       | -         | -   |
| decisions     | not started | -   | -       | -         | -   |
| memos         | not started | -   | -       | -         | -   |
| jobs          | not started | -   | -       | -         | -   |

## API Client (`shared/api/`)

| File        | Path                      | Purpose                          |
|-------------|---------------------------|----------------------------------|
| client.ts   | shared/api/client.ts      | Base fetch wrapper, ApiError class |
| types.ts    | shared/api/types.ts       | Shared API error/response types  |
