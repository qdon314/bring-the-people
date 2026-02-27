# Frontend Manifest — Bring The People

Living inventory of components, utilities, hooks, and feature modules for
`frontend-v2/`. Agents must check this file before creating new components
or utilities to avoid duplication.

**Status column**: `exists` = file is implemented and importable.
`planned` = target name and path for when this is built. Do not try to
import planned items — they do not exist yet.

**Update this file whenever you add a shared component, utility, or hook.**
Flip `planned` → `exists` when you create the file. This is part of the
definition of done.

Last updated: 2026-02-27

---

## Shared UI Components (`shared/ui/`)

| Component     | Path                       | Status  | Purpose                              |
|---------------|----------------------------|---------|--------------------------------------|
| StatusBadge   | shared/ui/StatusBadge.tsx   | planned | Render review/job/experiment status  |
| ErrorBanner   | shared/ui/ErrorBanner.tsx   | planned | Query error display with retry       |
| ErrorBoundary | shared/ui/ErrorBoundary.tsx | planned | Catch React render errors            |
| FormField     | shared/ui/FormField.tsx     | planned | Label + input + error message wrapper|
| SpinnerIcon   | shared/ui/SpinnerIcon.tsx   | planned | Inline loading indicator             |
| ChannelBadge  | shared/ui/ChannelBadge.tsx  | planned | Display channel type                 |
| CopyButton    | shared/ui/CopyButton.tsx    | planned | Copy-to-clipboard with feedback      |
| EmptyState    | shared/ui/EmptyState.tsx    | planned | Descriptive empty state with CTA     |
| Dialog        | shared/ui/dialog.tsx        | planned | Radix Dialog wrapper                 |

## Shared Utilities (`shared/lib/`)

| Function              | Path                    | Status  | Purpose                              |
|-----------------------|-------------------------|---------|--------------------------------------|
| cn()                  | shared/lib/utils.ts     | planned | Tailwind class merging (clsx + tw-merge) |
| getCycleProgress()    | shared/lib/progress.ts  | planned | Derive workflow step completion      |
| buildUTM()            | shared/lib/utm.ts       | planned | Construct UTM query strings          |
| buildAdSetName()      | shared/lib/utm.ts       | planned | Derive ad set name from UTM params   |
| computeMetrics()      | shared/lib/metrics.ts   | planned | Aggregate experiment metrics         |
| computePreviewMetrics() | shared/lib/metrics.ts | planned | Preview metrics before save          |
| formatDate()          | shared/lib/dates.ts     | planned | Consistent date formatting           |

## Shared Hooks (`shared/hooks/`)

| Hook          | Path                          | Status  | Purpose                        |
|---------------|-------------------------------|---------|--------------------------------|
| useJobPoller  | shared/hooks/useJobPoller.ts  | planned | Adaptive async job polling     |

## Shared Config (`shared/config/`)

| File          | Path                      | Status  | Purpose                          |
|---------------|---------------------------|---------|----------------------------------|
| polling.ts    | shared/config/polling.ts  | planned | Polling interval constants       |
| env.ts        | shared/config/env.ts      | planned | Environment variable access      |

## Layout Components (`shared/ui/`)

| Component     | Path                        | Status  | Purpose                          |
|---------------|-----------------------------|---------|----------------------------------|
| AppShell      | shared/ui/AppShell.tsx      | planned | Sidebar + main content layout    |
| Sidebar       | shared/ui/Sidebar.tsx       | planned | Global navigation rail           |
| ShowHeader    | shared/ui/ShowHeader.tsx    | planned | Show name, phase, dates          |
| CycleStepper  | shared/ui/CycleStepper.tsx  | planned | Workflow progress indicator      |

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

| File        | Path                    | Status  | Purpose                            |
|-------------|-------------------------|---------|------------------------------------|
| client.ts   | shared/api/client.ts    | planned | Base fetch wrapper, ApiError class |
| types.ts    | shared/api/types.ts     | planned | Shared API error/response types    |
