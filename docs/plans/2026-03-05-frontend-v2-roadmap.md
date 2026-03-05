# Frontend V2 Roadmap (Updated)

Date: 2026-03-05
Supersedes: `docs/plans/2026-02-27-frontend-v2-concrete-work-items.md`

## What changed

The entity refactor (2026-03-05) split `Experiment` into two entities:

- `Experiment` — show-scoped reusable definition (segment + frame + channel + objective + budget)
- `ExperimentRun` — cycle-scoped execution instance (status, times, observations, decisions)

This invalidates several old plan items that assumed experiments were cycle-gated. The old plan also predates significant implementation progress — Stages 0 and 1 are now complete.

References:
- `docs/designs/entity-refactor.md`
- `docs/contracts/frontend-contract.md`
- `docs/contracts/frontend-manifest.md`

---

## Completed (Stages 0 and 1)

### Stage 0: Platform + Contract Hardening

All complete: scaffold, design tokens, API codegen, `shared/api/client.ts`, validators, ESLint rule, `mapApiError`, `shared/queryKeys.ts`, `useJobPolling`, `getCycleProgress`, Playwright + MSW baseline.

### Stage 1: Routing + Shell + Data Layers

All complete: cycle-scoped route tree (`/shows/[show_id]/cycles/[cycle_id]/[tab]`), AppShell, Sidebar, TopBar, ShowHeader, CycleStepper, `useOverviewSnapshot`, and all feature `api.ts` + `queries.ts` files (shows, cycles, segments, frames, variants, experiments, runs, observations, decisions, memos, events, jobs).

---

## Conventions

- Size: `S` (0.5–1.5 days), `M` (1.5–3 days)
- All tasks must include tests or explicit verification steps.
- Routes are cycle-scoped: `/shows/[show_id]/cycles/[cycle_id]/...`
- Experiment *definitions* are created in the Plan tab. Experiment *runs* are created in the Run tab via the Experiment Library modal.

---

## Stage 2: Overview UI

Data layers exist (`useOverviewSnapshot`, `getCycleProgress`). This stage is UI only.

| ID | Size | Work item | Deliverables | Depends on |
|---|---|---|---|---|
| V2-020 | M | Build NextActionPanel | `features/overview/ui/NextActionPanel.tsx` using `getCycleProgress` output | - |
| V2-021 | M | Build KPI grid | `features/overview/ui/KPIGrid.tsx` using `useOverviewSnapshot` | - |
| V2-022 | S | Build activity feed | `features/events/ui/ActivityFeed.tsx` | - |
| V2-023 | S | Overview loading/empty/error states | skeleton + error banner + empty state on overview page | V2-020..022 |
| V2-024 | S | Overview accessibility pass | labels, focus flow, aria | V2-023 |

---

## Stage 3: Plan Tab UI

Includes experiment definition creation — the point where a user composes a reusable `Experiment` from approved segments and frames before moving to the Run tab to execute it.

| ID | Size | Work item | Deliverables | Depends on |
|---|---|---|---|---|
| V2-030 | M | Strategy run action | plan page action using `useJobPolling` | - |
| V2-031 | M | Segments list + review actions | `features/segments/ui/SegmentCard.tsx` with approve/reject | - |
| V2-032 | M | Frames list + review actions | `features/frames/ui/FrameCard.tsx` with approve/reject | - |
| V2-033 | M | Segment edit modal | `features/segments/ui/SegmentEditModal.tsx` (PATCH route) | V2-031 |
| V2-034 | M | Frame edit modal | `features/frames/ui/FrameEditModal.tsx` (PATCH route) | V2-032 |
| V2-035 | S | Review undo (back to draft) | mutation + UX copy for segments + frames | V2-031, V2-032 |
| V2-036 | M | Experiment definition creation form | `features/experiments/ui/ExperimentForm.tsx` — select approved segment + frame, set channel/objective/budget; creates `Experiment` with `origin_cycle_id` | V2-031, V2-032 |
| V2-037 | S | Plan tab test coverage | review state transitions, experiment creation | V2-031..036 |

*Assumption: PATCH routes for segments/frames exist on the backend. Verify before V2-033/034.*

---

## Stage 4: Create Tab UI

| ID | Size | Work item | Deliverables | Depends on |
|---|---|---|---|---|
| V2-040 | M | Frame picker | `features/creative/ui/FramePicker.tsx` with filters + multi-select | - |
| V2-041 | M | Creative job queue panel | `features/creative/ui/CreativeQueue.tsx` using `useJobPolling` | V2-040 |
| V2-042 | M | Variants review list | `features/variants/ui/VariantGroup.tsx` grouped by frame/platform | - |
| V2-043 | M | Variant approve/reject actions | mutations + card actions | V2-042 |
| V2-044 | M | Variant edit modal | `features/variants/ui/VariantEditModal.tsx` — `agent_output` + `approved_copy` fields | V2-043 |
| V2-045 | S | Human edit badge | `edited_by_human` metadata display in variant UI | V2-044 |
| V2-046 | S | Create tab test coverage | queue flow, variant review + edit | V2-040..045 |

---

## Stage 5: Run Tab UI

Manages `ExperimentRun` (not `Experiment`). Experiment definitions are selected from the library modal and instantiated as runs in the current cycle.

| ID | Size | Work item | Deliverables | Depends on |
|---|---|---|---|---|
| V2-050 | M | Runs list for cycle | `features/runs/ui/RunCard.tsx` — list of runs with status badge, experiment name, dates | - |
| V2-051 | M | Experiment library modal | `features/experiments/ui/ExperimentLibraryModal.tsx` — browse show-level experiments, filter by segment/frame/channel | V2-050 |
| V2-052 | M | Create run form | `features/runs/ui/CreateRunForm.tsx` — select experiment from library, optionally override budget/channel config, creates `ExperimentRun` in current cycle | V2-051 |
| V2-053 | M | Run state controls | `features/runs/ui/RunActions.tsx` — request reapproval, launch, with status-gated visibility | V2-050 |
| V2-054 | S | Launch confirmation UX | confirmation dialog + guardrails before `active` transition | V2-053 |
| V2-055 | S | Run tab test coverage | run creation, state transitions, library modal | V2-050..054 |

---

## Stage 6: Results Tab UI

Run-centric throughout — no `experiment_id` used in this tab.

| ID | Size | Work item | Deliverables | Depends on |
|---|---|---|---|---|
| V2-060 | S | Run selector | UI to pick an active/decided run in the cycle to view results for | - |
| V2-061 | M | Observation entry form | `features/observations/ui/ObservationForm.tsx` — takes `run_id` | V2-060 |
| V2-062 | M | Metrics display | `features/runs/ui/RunMetrics.tsx` — aggregated metrics from `GET /api/runs/{run_id}/metrics` | V2-060 |
| V2-063 | M | Sufficiency/flimsy flags panel | threshold warnings based on `evidence_sufficient` + window count | V2-062 |
| V2-064 | M | Decision trigger + badge | `features/decisions/ui/DecisionPanel.tsx` — evaluate run action, display action/confidence/rationale | V2-062 |
| V2-065 | S | Results tab test coverage | observation submit, decision trigger path | V2-061..064 |

---

## Stage 7: Memo Tab UI

| ID | Size | Work item | Deliverables | Depends on |
|---|---|---|---|---|
| V2-070 | M | Memo run form + job polling | memo trigger panel with `useJobPolling` | - |
| V2-071 | M | Memo history list | memo list + selection state + URL behavior | - |
| V2-072 | S | Memo markdown viewer | `features/memos/ui/MemoView.tsx` | V2-071 |
| V2-073 | S | Memo tab test coverage | generation, history display | V2-070..072 |

---

## Stage 8: Cutover

| ID | Size | Work item | Deliverables | Depends on |
|---|---|---|---|---|
| V2-080 | M | `/v2` app switch flag | route config + docs | V2-020..073 |
| V2-081 | M | Full-cycle Playwright e2e | `show → plan → create → run → results → memo` journey | V2-080 |
| V2-082 | S | Swap default routes to v2 | redirect with rollback note | V2-081 |
| V2-083 | S | Freeze v1 | branch guardrails + docs | V2-082 |

---

## Immediate Next 10 Tickets

Recommended start order:
1. V2-020 (NextActionPanel)
2. V2-021 (KPI grid)
3. V2-022 (Activity feed)
4. V2-023 (Overview states)
5. V2-030 (Strategy run action)
6. V2-031 (Segments list)
7. V2-032 (Frames list)
8. V2-036 (Experiment definition form)
9. V2-050 (Runs list)
10. V2-051 (Experiment library modal)
