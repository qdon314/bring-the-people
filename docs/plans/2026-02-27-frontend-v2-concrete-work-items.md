# Frontend V2 Concrete Work Items (Small/Medium)

Date: 2026-02-27  
Scope: Implement the new frontend architecture in small/medium tickets.

References:
- `docs/designs/frontend-architecture.md`
- `docs/contracts/frontend-contract.md`
- `docs/plans/2026-02-27-frontend-rebuild-backlog.md`
- `docs/plans/2026-02-27-frontend-v2-sprint-1-board.md`

## Conventions

- Size: `S` (0.5-1.5 days), `M` (1.5-3 days)
- All tasks must include tests or explicit verification steps.
- All route work is cycle-scoped: `/shows/[show_id]/cycles/[cycle_id]/...`

## Stage 0: Platform + Contract Hardening

| ID | Size | Work item | Concrete deliverables | Depends on |
| --- | --- | --- | --- | --- |
| V2-001 | S | Scaffold `frontend-v2` app | `frontend-v2/package.json`, `frontend-v2/app/layout.tsx`, `frontend-v2/tsconfig.json`, `frontend-v2/tailwind.config.ts` | - |
| V2-002 | S | Port design tokens/theme to v2 | `frontend-v2/app/globals.css`, `frontend-v2/tailwind.config.ts` | V2-001 |
| V2-003 | S | Add `frontend-v2` npm scripts at repo level docs | Update root/README run instructions for v2 | V2-001 |
| V2-004 | M | Add OpenAPI codegen pipeline (Orval/openapi-typescript) | `frontend-v2/orval.config.*` (or equivalent), generated client output dir | V2-001 |
| V2-005 | M | Wrap generated client in `shared/api/client.ts` | `frontend-v2/shared/api/client.ts`, `frontend-v2/shared/api/generated/*` | V2-004 |
| V2-006 | S | Enforce “no direct fetch in components/features” | ESLint rule/config + CI check in `frontend-v2` | V2-005 |
| V2-007 | M | Add runtime response validation pattern | `frontend-v2/shared/api/validators/*` + usage examples | V2-005 |
| V2-008 | S | Implement global query key factories | `frontend-v2/shared/queryKeys.ts`, `frontend-v2/features/*/queries.ts` scaffolds | V2-001 |
| V2-009 | M | Implement shared job polling primitive | `frontend-v2/features/jobs/useJobPolling.ts` with required intervals + terminal states | V2-008 |
| V2-010 | M | Implement `getCycleProgress(snapshot)` | `frontend-v2/features/cycles/getCycleProgress.ts` + unit tests | V2-008 |
| V2-011 | S | Add `mapApiError()` and shared error UI copy | `frontend-v2/shared/errors/mapApiError.ts` | V2-001 |
| V2-012 | M | Backend contract: decisions evaluate route alignment | `src/growth/app/api/decisions.py`, frontend client call update | - |
| V2-013 | M | Backend contract: add PATCH routes for segment/frame/variant | `src/growth/app/api/segments.py`, `frames.py`, `variants.py`, schemas as needed | - |
| V2-014 | S | Backend contract: persist `cycle_id` on experiment create | `src/growth/app/schemas.py`, `src/growth/app/api/experiments.py` | - |
| V2-015 | S | Backend contract: persist `ticket_base_url` on show create | `src/growth/app/api/shows.py` | - |
| V2-016 | S | Backend contract: confirm review status mapping canonical | `segments.py`, `frames.py`, `variants.py` tests | - |
| V2-017 | S | Backend contract: show delete decision implementation | `src/growth/app/api/shows.py` or hide control in v2 UI | - |
| V2-018 | M | Add Playwright + MSW baseline in v2 | `frontend-v2/playwright.config.*`, test setup, first smoke test | V2-001 |

## Stage 1: Routing + Shell + Overview

| ID | Size | Work item | Concrete deliverables | Depends on |
| --- | --- | --- | --- | --- |
| V2-020 | M | Add cycle-scoped route tree + redirects | `frontend-v2/app/shows/[show_id]/page.tsx`, cycle route layout/pages scaffold | V2-001 |
| V2-021 | S | Implement active-cycle server redirect | `/shows/[show_id]` -> active cycle route logic | V2-020 |
| V2-022 | M | Build app shell (sidebar/top layout) | `frontend-v2/features/layout/AppShell.tsx`, route layout integration | V2-020 |
| V2-023 | S | Build show header component for v2 | `frontend-v2/features/shows/ui/ShowHeader.tsx` | V2-022 |
| V2-024 | M | Build cycle stepper using shared progress function | `frontend-v2/features/cycles/ui/CycleStepper.tsx` | V2-010, V2-022 |
| V2-025 | M | Build overview query aggregation hook | `frontend-v2/features/overview/useOverviewSnapshot.ts` | V2-008, V2-005 |
| V2-026 | M | Build Next Action panel using `getCycleProgress` | `frontend-v2/features/overview/ui/NextActionPanel.tsx` | V2-010, V2-025 |
| V2-027 | M | Build overview KPI cards | `frontend-v2/features/overview/ui/KPIGrid.tsx` | V2-025 |
| V2-028 | S | Build activity feed panel | `frontend-v2/features/events/ui/ActivityFeed.tsx` | V2-025 |
| V2-029 | S | Add overview loading/empty/error states | overview page + shared state components | V2-025 |
| V2-030 | S | Add overview accessibility pass | labels, focus flow, aria checks | V2-026..V2-029 |

## Stage 2: Plan Tab

| ID | Size | Work item | Concrete deliverables | Depends on |
| --- | --- | --- | --- | --- |
| V2-040 | M | Plan page scaffold with cycle scope | `frontend-v2/app/shows/[show_id]/cycles/[cycle_id]/plan/page.tsx` | V2-020 |
| V2-041 | M | Strategy run action + job hook integration | plan action component using `useJobPolling` | V2-009, V2-040 |
| V2-042 | M | Segments list + review actions | `features/segments/ui/SegmentCard.tsx`, queries/mutations | V2-013, V2-040 |
| V2-043 | M | Frames list + review actions | `features/frames/ui/FrameCard.tsx`, queries/mutations | V2-013, V2-040 |
| V2-044 | M | Segment edit modal (PATCH route) | `features/segments/ui/SegmentEditModal.tsx` | V2-013, V2-042 |
| V2-045 | M | Frame edit modal (PATCH route) | `features/frames/ui/FrameEditModal.tsx` | V2-013, V2-043 |
| V2-046 | S | Review “undo” semantics to draft | review mutation + UX copy | V2-042, V2-043 |
| V2-047 | S | Plan tab test coverage | unit + integration for review state transitions | V2-042..V2-046 |

## Stage 3: Create Tab

| ID | Size | Work item | Concrete deliverables | Depends on |
| --- | --- | --- | --- | --- |
| V2-050 | M | Create page scaffold with cycle scope | create page + data wiring | V2-020 |
| V2-051 | M | Frame picker with filters and multi-select | `features/creative/ui/FramePicker.tsx` | V2-050 |
| V2-052 | M | Creative job queue panel | `features/creative/ui/CreativeQueue.tsx` | V2-009, V2-050 |
| V2-053 | M | Variants review list grouped by frame/platform | `features/variants/ui/VariantGroup.tsx` | V2-050 |
| V2-054 | M | Variant approve/reject actions | `features/variants/mutations.ts` + cards | V2-053 |
| V2-055 | M | Variant edit modal with `agent_output` + `approved_copy` | `features/variants/ui/VariantEditModal.tsx` | V2-054 |
| V2-056 | S | Human edit metadata (`edited_by_human`) display | badge/metadata render in variant UI | V2-055 |
| V2-057 | S | Create tab test coverage | queue, completion, review flows | V2-051..V2-056 |

## Stage 4: Run Tab

| ID | Size | Work item | Concrete deliverables | Depends on |
| --- | --- | --- | --- | --- |
| V2-060 | M | Run page scaffold with cycle scope | run page + data wiring | V2-020 |
| V2-061 | M | Experiment builder form with strict cycle gating | `features/experiments/ui/ExperimentBuilderForm.tsx` | V2-060, V2-014 |
| V2-062 | M | UTM generation + preview panel | `features/experiments/ui/UTMPreview.tsx`, utility wiring | V2-061 |
| V2-063 | M | Copy pack component | `features/experiments/ui/CopyPack.tsx` | V2-061 |
| V2-064 | M | Experiment state controls (`draft|approved|launched|completed`) | experiment card/actions + status badge map | V2-061 |
| V2-065 | S | Launch action semantics + confirmation UX | launch button flow, guardrails | V2-064 |
| V2-066 | S | Run tab test coverage | builder gating, launch flow, status transitions | V2-061..V2-065 |

## Stage 5: Results Tab

| ID | Size | Work item | Concrete deliverables | Depends on |
| --- | --- | --- | --- | --- |
| V2-070 | M | Results page scaffold with cycle scope | results page + data wiring | V2-020 |
| V2-071 | M | Observation entry form | `features/observations/ui/ObservationForm.tsx` | V2-070 |
| V2-072 | M | Metrics ranking and sort controls | results ranking logic + UI | V2-070 |
| V2-073 | M | Sufficiency/flimsy flags panel | thresholds UI + warnings | V2-072 |
| V2-074 | M | Decision trigger action + badge render | decisions integration + UI | V2-012, V2-070 |
| V2-075 | S | Results tab test coverage | observation submit + decision path | V2-071..V2-074 |

## Stage 6: Memo Tab

| ID | Size | Work item | Concrete deliverables | Depends on |
| --- | --- | --- | --- | --- |
| V2-080 | M | Memo page scaffold with cycle scope | memo page + data wiring | V2-020 |
| V2-081 | M | Memo run form + job polling | memo run panel integrated with shared polling | V2-009, V2-080 |
| V2-082 | M | Memo history list + selection state | memo list component + URL/selection behavior | V2-080 |
| V2-083 | S | Memo markdown viewer | `features/memos/ui/MemoView.tsx` | V2-080 |
| V2-084 | S | Memo tab test coverage | generation + history display | V2-081..V2-083 |

## Stage 7: Cutover + Regression Lock

| ID | Size | Work item | Concrete deliverables | Depends on |
| --- | --- | --- | --- | --- |
| V2-090 | M | Add `/v2` routing or app switch flag | route switch + config docs | V2-020..V2-084 |
| V2-091 | M | Playwright full-cycle e2e (`show -> memo`) | e2e spec for full journey | V2-018, V2-084 |
| V2-092 | S | Replace default show routes to v2 | redirect/swap with rollback note | V2-091 |
| V2-093 | S | Freeze v1 except critical fixes | docs + branch/review guardrails | V2-092 |
| V2-094 | M | Post-cutover regression sweep from `UX_REVIEW.md` | close/annotate issues with outcomes | V2-092 |

## Immediate Next 10 Tickets

Recommended start order:
1. `V2-001`
2. `V2-002`
3. `V2-004`
4. `V2-005`
5. `V2-008`
6. `V2-009`
7. `V2-010`
8. `V2-012`
9. `V2-013`
10. `V2-014`
