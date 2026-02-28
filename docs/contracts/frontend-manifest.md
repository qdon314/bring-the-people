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

Last updated: 2026-02-28

---

## Shared UI Components (`shared/ui/`)

These are called for in `docs/designs/dashboard.md`:

| Component     | Path                       | Status  | Purpose                              |
|---------------|----------------------------|---------|--------------------------------------|
| StatusBadge   | shared/ui/StatusBadge.tsx   | planned | Render review/job/experiment status  |
| ErrorBanner   | shared/ui/ErrorBanner.tsx   | planned | Query error display with retry       |
| ErrorBoundary | shared/ui/ErrorBoundary.tsx | planned | Catch React render errors            |
| EmptyState    | shared/ui/EmptyState.tsx    | planned | Descriptive empty state with CTA     |
| SpinnerIcon   | shared/ui/SpinnerIcon.tsx   | planned | Inline loading indicator             |
| Dialog        | shared/ui/dialog.tsx        | planned | Radix Dialog wrapper                 |

## Shared Utilities (`shared/lib/`)

These are called for in `docs/designs/frontend-architecture.md`:

| Function           | Path                    | Status  | Purpose                         |
|--------------------|-------------------------|---------|---------------------------------|
| cn()               | shared/lib/utils.ts     | planned | Tailwind class merging          |
| getCycleProgress() | shared/lib/progress.ts  | planned | Derive workflow step completion |

## Shared Hooks (`shared/hooks/`)

| Hook          | Path                          | Status  | Purpose                    |
|---------------|-------------------------------|---------|----------------------------|
| useJobPoller  | shared/hooks/useJobPoller.ts  | planned | Adaptive async job polling |

## Shared Config (`shared/config/`)

| File          | Path                      | Status  | Purpose                    |
|---------------|---------------------------|---------|----------------------------|
| polling.ts    | shared/config/polling.ts  | planned | Polling interval constants |

## Layout Components (`shared/ui/`)

These are called for in `docs/designs/dashboard.md`:

| Component     | Path                        | Status  | Purpose                       |
|---------------|-----------------------------|---------|-------------------------------|
| AppShell      | shared/ui/AppShell.tsx      | planned | Sidebar + main content layout |
| Sidebar       | shared/ui/Sidebar.tsx       | planned | Global navigation rail        |
| ShowHeader    | shared/ui/ShowHeader.tsx    | planned | Show name, phase, dates       |
| CycleStepper  | shared/ui/CycleStepper.tsx  | planned | Workflow progress indicator   |

## API Client (`shared/api/`)

| File               | Path                              | Status  | Purpose                                  |
|--------------------|-----------------------------------|---------|------------------------------------------|
| client.ts          | shared/api/client.ts              | exists  | Base fetch wrapper, ApiError class       |
| openapi.json       | shared/api/generated/openapi.json | exists  | Generated OpenAPI schema snapshot         |
| schema.ts          | shared/api/generated/schema.ts    | exists  | Generated OpenAPI TypeScript definitions |
| validators/*       | shared/api/validators/*           | exists  | Runtime response validation functions     |

## Feature Modules (`features/`)

Update this table as feature modules are built.

| Feature       | Status      | api | queries | mutations | ui  |
|---------------|-------------|-----|---------|-----------|-----|
| shows         | in progress | exists | -       | -         | -   |
| cycles        | not started | -   | -       | -         | -   |
| segments      | not started | -   | -       | -         | -   |
| frames        | not started | -   | -       | -         | -   |
| variants      | not started | -   | -       | -         | -   |
| experiments   | not started | -   | -       | -         | -   |
| observations  | not started | -   | -       | -         | -   |
| decisions     | not started | -   | -       | -         | -   |
| memos         | not started | -   | -       | -         | -   |
| jobs          | not started | -   | -       | -         | -   |
