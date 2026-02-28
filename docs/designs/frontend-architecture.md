# Frontend Architecture Plan (Rebuild)

## Purpose

This document defines the implementation architecture for rebuilding the dashboard frontend with fewer regressions and tighter backend alignment.

Source UX intent:
- `docs/designs/dashboard.md`
- `docs/designs/dashboard-prototype.html`

Known failure patterns to avoid:
- UX debt identified during rebuild (tracked in backlog FE-030).

## Decision Summary

1. Rebuild in `frontend-v2/` (parallel directory) while keeping current `frontend/` stable except critical fixes, then cut over after acceptance gates pass.
2. Keep the existing visual language from `dashboard-prototype.html` (colors, typography, stepper).
3. Make backend contract alignment a hard prerequisite before feature delivery.
4. Ship by vertical slices (Plan, Create, Run, Results, Memo), each with explicit acceptance tests.

## Framework and Tooling Choices

## Core Stack

- Next.js App Router (existing project baseline)
- React + TypeScript (`strict: true`)
- TanStack Query for server state
- React Hook Form + Zod for form state and validation
- Tailwind CSS + Radix primitives for UI

## Additions Required for Stability

- OpenAPI-driven types/client generation (`openapi-typescript` or `orval`) to remove request/response drift.
- Playwright for end-to-end workflow tests.
- MSW for deterministic API mocks in component tests.
- Storybook for shared component contracts (cards, badges, forms, steppers), optional until Stage 1 is complete.

## Architecture Principles

1. Contract-first: frontend types are generated from backend schema, never hand-duplicated.
2. Explicit state machines: approval and experiment transitions are modeled, not implied by button visibility.
3. One source of truth for server state: TanStack Query owns network state; avoid duplicate local mirrors.
4. No timing hacks: no `setTimeout` for consistency; use job status + query invalidation/polling rules.
5. Progressive workflow gates: Create depends on approved Plan artifacts; Run depends on approved Variants.
6. Auditability by default: keep agent output vs human-edited output visibly separate.

## Target Frontend Structure

Use route-level composition with feature modules:

```text
frontend-v2/
  app/
    shows/
      [show_id]/
        cycles/
          [cycle_id]/
            overview/
            plan/
            create/
            run/
            results/
            memo/
  features/
    shows/
    cycles/
    segments/
    frames/
    variants/
    experiments/
    observations/
    decisions/
    memos/
    jobs/
  shared/
    api/
    ui/
    lib/
    config/
```

Module ownership rules:
- `features/*/api.ts`: endpoint calls and serializers only.
- `features/*/queries.ts`: query keys + hooks.
- `features/*/mutations.ts`: mutation hooks + invalidation strategy.
- `features/*/types.ts`: generated or derived types only.
- `features/*/ui/*`: presentational and container components.

## Route Scoping Rule

- Cycle is part of the URL for all workflow tabs:
  - `/shows/[show_id]/cycles/[cycle_id]/overview`
  - `/shows/[show_id]/cycles/[cycle_id]/plan`
  - `/shows/[show_id]/cycles/[cycle_id]/create`
  - `/shows/[show_id]/cycles/[cycle_id]/run`
  - `/shows/[show_id]/cycles/[cycle_id]/results`
  - `/shows/[show_id]/cycles/[cycle_id]/memo`
- `/shows/[show_id]` must server-redirect to the active cycle route.

## Workflow State Model

Canonical statuses and orthogonal state:

| Entity | Canonical fields |
| --- | --- |
| Segment / Frame / Variant | `review_status: pending|approved|rejected`, `source: agent|human|system`, `edited_by_human: boolean` |
| Variant copy history | Keep immutable `agent_output`; keep editable `approved_copy` for producer-approved text |
| Experiment | `status: draft|approved|launched|completed` |
| Job | `status: queued|running|completed|failed` |

Step completion (derived from persisted data, scoped to current cycle):

- `Plan`: at least 1 approved segment and 1 approved frame.
- `Create`: at least 1 approved variant linked to an approved frame.
- `Run`: at least 1 experiment in `launched|completed`.
- `Results`: at least 1 observation window for a `launched|completed` experiment.
- `Memo`: at least 1 memo for current cycle.

## Single Progress Derivation Function

- Create one shared function:
  - `getCycleProgress(snapshot) -> { planComplete, createComplete, runComplete, resultsComplete, memoComplete, nextAction }`
- `CycleStepper` and Overview `NextAction` must both use this function.
- No page/component may implement alternate step-completion logic.

## API Contract Freeze (Pre-Rebuild Gate)

Before frontend rewrite, align these mismatches:

1. `decisions.evaluate` route is canonicalized  
Canonical route: `POST /api/decisions/evaluate/{experiment_id}`.

2. Missing PATCH routes for content editing
Frontend needs content-editing endpoints (name, description, copy text):
- `PATCH /api/segments/{id}`
- `PATCH /api/frames/{id}`
- `PATCH /api/variants/{id}`
These are distinct from the existing `POST /review` routes which handle review status changes only.

3. Show deletion route is implemented  
Canonical route: `DELETE /api/shows/{show_id}`.

4. Experiment `cycle_id` is persisted on create  
Canonical create payload includes `cycle_id`, and backend persists it.

5. Show `ticket_base_url` is persisted on create  
`ShowCreate` includes `ticket_base_url`, and create route persists and returns it.

6. Keep review status mapping canonical  
`approve|reject` actions must map to persisted `approved|rejected` values.

No frontend feature work should proceed until these six items are addressed or intentionally removed from UI scope.

## Query and Mutation Conventions

1. Query keys must come from feature key factories (no inline literals in pages).
2. Mutations must define invalidation at feature level (not ad hoc per page).
3. Prefer optimistic updates for review actions with rollback on error.
4. Do not chain `invalidateQueries` + `refetchQueries` unless there is a documented reason.
5. All network calls must go through `shared/api/client.ts` (or generated wrapper). No direct `fetch()` in components/features.
6. Responses must be runtime-validated (`zod` schemas or generated validators).
7. Prefer Orval/OpenAPI for generated types and client functions, while keeping query keys/hooks in `features/*/queries.ts`.

## Async Job Polling Contract

Use one shared polling primitive for Strategy, Creative, and Memo jobs.

Polling schedule:
- 0s to 5s elapsed: poll every 1s
- >5s to 30s elapsed: poll every 2s
- >30s elapsed: poll every 5s

Terminal statuses:
- `completed`
- `failed`

On terminal success, invalidate query keys by job type:

| Job type | Invalidate keys |
| --- | --- |
| `strategy` | `cycles`, `segments`, `frames`, `events` |
| `creative` | `variants`, `frames`, `events` |
| `memo` | `memos`, `events` |

## UX and Design System Rules

1. Preserve prototype visual tokens from `dashboard-prototype.html`.
2. Keep stepper visible at show scope and use it as workflow backbone.
3. Provide explicit “Next step” CTA at bottom of each stage page.
4. Use consistent status badge semantics across all entities.
5. Maintain accessibility baseline: label associations, dialog descriptions, keyboard navigation, focus-visible behavior.

## Testing Strategy

## Unit / Component

- Validate all status badge mappings.
- Validate form schemas and edge cases (budget, date windows, required selections).
- Validate UTM generation and metrics utilities.

## Integration (Mocked API)

- Strategy run -> job polling -> segments/frames visible.
- Creative run -> variants appear -> approval state updates.
- Experiment build -> submit/approve/start transitions.
- Results entry -> metrics recompute -> decision badge updates.

## End-to-End (Playwright)

Required critical paths:
1. Create show -> complete full cycle to memo.
2. Reject/re-approve flows for segment, frame, variant.
3. Failure handling for each async agent job.
4. Refresh/browser reopen without losing workflow state.

## Delivery Plan

## Stage 0: Contract and Platform Hardening

- Finalize endpoint contract fixes listed above.
- Introduce generated API types/client.
- Introduce query key factories and mutation conventions.
- Add Playwright baseline and CI checks.
- Keep v1 (`frontend/`) isolated during rebuild in `frontend-v2/`.

Exit criteria:
- No handwritten endpoint URLs in UI components.
- No direct `fetch()` in components/features.
- No inline query keys in route pages/components.
- Typecheck/lint/test run green.

## Stage 1: Shell and Overview

- App shell, sidebar, show header, cycle stepper, overview metrics/events/next action.

Exit criteria:
- Overview reflects persisted cycle state without manual refresh hacks.

## Stage 2: Plan + Create

- Strategy run panel, segment/frame review/edit, creative generation queue, variant review/edit.

Exit criteria:
- Approval gating is enforced and reflected immediately.

## Stage 3: Run + Results

- Experiment builder, launch/status controls, observation entry, results ranking, decision execution.

Exit criteria:
- No disappearing experiments or cycle filter mismatch.

## Stage 4: Memo + Cross-Cycle Polish

- Memo generation/view/history, cycle history visibility, empty states and error copy polish.

Exit criteria:
- End-to-end cycle can be completed by a non-technical user without ambiguity.

## Definition of Done for Each PR

1. API contract references included.
2. Acceptance criteria listed and manually validated.
3. At least one automated test added/updated.
4. No new TODO placeholders without linked issue.
5. Query invalidation strategy documented in code comments where non-obvious.
6. No inline query keys; use key factories.

## Default Decisions (Locked)

1. Cycle scoping is strict per tab; Run builder operates within the current cycle only.
2. “Undo approval” returns entity to `pending` (not `rejected`).
3. Show deletion remains supported in MVP if backend route exists; otherwise hide control until route is delivered.
