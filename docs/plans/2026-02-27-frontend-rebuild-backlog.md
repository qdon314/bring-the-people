# Frontend Rebuild Backlog

Date: 2026-02-27  
Owner: Product + Frontend  
Primary references:
- `docs/designs/frontend-architecture.md`
- `docs/designs/frontend-ai-build-rules.md`
- `docs/designs/dashboard.md`
- `docs/designs/dashboard-prototype.html`
- `docs/plans/2026-02-27-frontend-v2-concrete-work-items.md`

## Document Hierarchy

This backlog tracks work at the **epic level** (FE-xxx). For granular ticket-level breakdown (V2-xxx), see `docs/plans/2026-02-27-frontend-v2-concrete-work-items.md`. Each FE epic maps to a set of V2 implementation tickets.

## Goal

Deliver a stable, auditable, step-driven dashboard rebuild with low regression risk, using a contract-first workflow and staged rollout.

## Prioritization

- `P0`: blocks core workflow or causes data/contract breakage.
- `P1`: significant friction or inconsistent behavior.
- `P2`: polish, performance, and non-blocking improvements.

## Epic 0: Contract Freeze and Safety Rails

### FE-001 (P0) Align decisions evaluate endpoint contract

Scope:
- Resolve frontend/backend mismatch:
  - backend: `POST /api/decisions/evaluate/{experiment_id}`
  - frontend call currently posts to `/api/decisions/evaluate` with body

Acceptance criteria:
1. One canonical route documented and implemented on both sides.
2. Frontend client call and tests pass against that route.
3. No route-shape ambiguity remains in docs.

Dependencies:
- None.

### FE-002 (P0) Implement backend PATCH endpoints for content editing

Scope:
- Add content-editing endpoints (name, description, copy text):
  - `PATCH /api/segments/{segment_id}`
  - `PATCH /api/frames/{frame_id}`
  - `PATCH /api/variants/{variant_id}`
- These are distinct from existing `POST /review` routes which handle review status changes only.

Acceptance criteria:
1. Endpoints exist and persist content field updates.
2. Frontend edit modals save successfully.
3. API errors are surfaced with usable messages.

Dependencies:
- None.

### FE-003 (P0) Implement or remove show delete behavior

Scope:
- Either add `DELETE /api/shows/{show_id}` or remove delete affordance from UI.

Acceptance criteria:
1. UI behavior matches supported API behavior.
2. No dead API calls remain.

Dependencies:
- Product decision on delete support.

### FE-004 (P0) Persist experiment `cycle_id` at creation

Scope:
- Three-layer fix:
  1. Add `cycle_id: UUID` to the `ExperimentCreate` Pydantic schema.
  2. Pass `cycle_id` through in the experiment creation route handler (currently hardcoded to `None`).
  3. Verify the domain model stores the value.

Acceptance criteria:
1. New experiments appear in current cycle views.
2. No disappearing experiment behavior in Run tab.

Dependencies:
- None.

### FE-005 (P0) Persist `ticket_base_url` on show creation

Scope:
- Ensure `ticket_base_url` is stored in create flow.
- Note: trivial one-line fix — add `ticket_base_url=body.ticket_base_url` to the show creation route handler. Schema and domain model already support the field.

Acceptance criteria:
1. Value persists and is returned in `ShowResponse`.
2. Frontend form round-trips this field correctly.

Dependencies:
- None.

### FE-006 (P0) Enforce canonical review status mapping

Scope:
- Verify review statuses are enum-constrained to: `pending` | `approved` | `rejected`.
- Ensure review actions (`approve`/`reject`) map to persisted enum values `approved`/`rejected`.
- Recreate `growth.db` from scratch before V2 usage to avoid any stale status data.

Acceptance criteria:
1. Segment/frame/variant review status fields are enum-constrained to `approved` | `pending` | `rejected`.
2. New artifacts default to `pending`.
3. Status badges update correctly after review actions.
4. Step gating relying on approval status works.
5. Local V2 startup instructions include recreating `growth.db` from scratch.

Dependencies:
- None.

### FE-007 (P0) Generate API client/types from OpenAPI

Scope:
- Introduce generated API client and shared response/request types.
- Replace hand-written route strings incrementally.

Acceptance criteria:
1. Typed API client generation in toolchain.
2. At least one vertical slice migrated end-to-end.
3. CI fails on stale generated artifacts.

Dependencies:
- FE-001, FE-002, FE-004, FE-005, FE-006 complete or route contracts frozen. (FE-003 resolved independently.)

## Epic 1: Frontend Foundation Refactor

### FE-010 (P1) Introduce feature boundaries and query key factories

Scope:
- Add `features/*` structure and move query keys/hooks/mutations into feature ownership.

Acceptance criteria:
1. No inline query keys in route pages for migrated features.
2. Mutation invalidation logic centralized per feature.

Dependencies:
- FE-007.

### FE-011 (P1) Standardize async job handling primitive

Scope:
- Single polling hook/pattern for strategy/creative/memo jobs.
- Remove timeout-based refresh hacks.

Acceptance criteria:
1. No `setTimeout`-based consistency hacks in workflow pages.
2. Job completion always triggers deterministic cache refresh.

Dependencies:
- FE-010.

### FE-012 (P1) Add error mapping utility + consistent user copy

Scope:
- Central `mapApiError` utility for known backend errors.

Acceptance criteria:
1. User-facing errors are actionable and consistent.
2. Raw transport errors are not shown directly except fallback cases.

Dependencies:
- FE-010.

### FE-013 (P1) Add frontend test harness baseline

Scope:
- Configure Playwright + MSW-backed component/integration test setup.

Acceptance criteria:
1. CI runs at least one e2e smoke journey.
2. At least one module integration test runs with mocked API.

Dependencies:
- FE-010.

## Epic 2: Stage Rebuild by Vertical Slice

### FE-020 (P1) Shell and Overview rebuild

Scope:
- Sidebar, show header, cycle stepper, next action panel, activity feed, KPI cards.

Acceptance criteria:
1. Overview always shows a clear next action.
2. Stepper completion reflects persisted cycle data only.
3. Accessibility baseline for navigation/focus states is met.

Dependencies:
- FE-010, FE-011.

### FE-021 (P1) Plan tab rebuild

Scope:
- Strategy run panel, segment/frame review and edit, partial approvals.

Acceptance criteria:
1. Producer can approve subset of segments/frames.
2. Review states update instantly and persist after reload.

Dependencies:
- FE-020, FE-006.

### FE-022 (P1) Create tab rebuild

Scope:
- Frame picker, creative generation queue, variant review/edit with history.

Acceptance criteria:
1. Unapproved frames cannot proceed to creative generation if gate enabled.
2. Agent output and human-edited copy are both visible.

Dependencies:
- FE-021.

### FE-023 (P1) Run tab rebuild

Scope:
- Experiment builder, UTM pack, launch state controls.

Acceptance criteria:
1. Builder only allows approved artifact chain (segment -> frame -> variant).
2. Created experiments appear in correct cycle immediately.

Dependencies:
- FE-022, FE-004.

### FE-024 (P1) Results tab rebuild

Scope:
- Observation entry, computed metrics display, ranking/sufficiency flags, decision triggers.

Acceptance criteria:
1. Metrics and sufficiency indicators are deterministic.
2. Decision action can be triggered per experiment with visible result.

Dependencies:
- FE-023, FE-001.

### FE-025 (P1) Memo tab rebuild

Scope:
- Memo generation, job handling, memo history and rendering.

Acceptance criteria:
1. Producer can generate and view cycle memo reliably.
2. Memo history is navigable and stable across refresh.

Dependencies:
- FE-024.

## Epic 3: UX Debt

### FE-030 (P2) Resolve high-value UX issues identified during rebuild

Scope:
- Batch-fix UX debt items identified during the rebuild after core slices are stable.

Acceptance criteria:
1. Every carried-over UX issue has ticket status (`done`, `won’t do`, or deferred with reason).
2. No unresolved P0 issues remain.

Dependencies:
- FE-025.

## Sprint Sequencing (Recommended)

Sprint A:
- FE-001..FE-007

Sprint B:
- FE-010..FE-013
- FE-020

Sprint C:
- FE-021
- FE-022

Sprint D:
- FE-023
- FE-024
- FE-025

Sprint E:
- FE-030

## Cutover and Folder Strategy

Chosen approach: parallel rebuild in `frontend-v2/`, keeping `frontend/` as fallback until FE-023 is accepted.

Deletion gate — only delete legacy `frontend/` after:
1. Full e2e cycle test passes.
2. Product sign-off on all stage acceptance criteria.
3. One release cycle with no P0/P1 regressions.
