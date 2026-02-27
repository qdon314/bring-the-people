# Frontend V2 Sprint 1 Board

Date: 2026-02-27  
Sprint length: 2 weeks  
Source backlog: `docs/plans/2026-02-27-frontend-v2-concrete-work-items.md`

## Sprint Goal

Ship the V2 foundation and contract hardening so feature-slice work can begin without API/client drift.

## Capacity Assumption

- `S` ticket = 2 points
- `M` ticket = 5 points
- Target sprint load: 35-45 points

## Committed Scope (Must Ship)

| ID | Size | Points | Owner (Suggested) | Why in Sprint 1 |
| --- | --- | --- | --- | --- |
| V2-001 | S | 2 | FE Platform | Baseline v2 app scaffold |
| V2-002 | S | 2 | FE Platform | Token/theme parity with prototype |
| V2-004 | M | 5 | FE Platform | OpenAPI generation foundation |
| V2-005 | M | 5 | FE Platform | Shared generated client wrapper |
| V2-006 | S | 2 | FE Platform | Enforce no direct `fetch()` |
| V2-008 | S | 2 | FE App | Query key factory baseline |
| V2-009 | M | 5 | FE App | Shared job polling primitive |
| V2-010 | M | 5 | FE App | Single progress derivation function |
| V2-012 | M | 5 | Backend API | Decisions route contract alignment |
| V2-013 | M | 5 | Backend API | PATCH endpoints for segment/frame/variant |
| V2-014 | S | 2 | Backend API | Persist `cycle_id` on experiment create |
| V2-016 | S | 2 | Backend API | Canonical review status verification/tests |

Committed total: **42 points**

## Stretch Scope (If Capacity Allows)

| ID | Size | Points | Owner (Suggested) | Notes |
| --- | --- | --- | --- | --- |
| V2-015 | S | 2 | Backend API | Persist `ticket_base_url` create path |
| V2-018 | M | 5 | FE Platform + QA | Playwright + MSW baseline |
| V2-020 | M | 5 | FE App | Cycle-scoped route tree scaffold |
| V2-021 | S | 2 | FE App | Active cycle redirect |

## Execution Order (Strict)

1. V2-001  
2. V2-002  
3. V2-004  
4. V2-005  
5. V2-006  
6. V2-008  
7. V2-009  
8. V2-010  
9. V2-012  
10. V2-013  
11. V2-014  
12. V2-016

Parallelization rule:
- FE Platform/App and Backend API tracks can run in parallel after V2-001.
- Do not start Stage 1 UI slices until V2-005 + V2-008 + V2-013 are done.

## Board Columns

## Ready

- [ ] V2-001
- [ ] V2-002
- [ ] V2-004
- [ ] V2-005
- [ ] V2-006
- [ ] V2-008
- [ ] V2-009
- [ ] V2-010
- [ ] V2-012
- [ ] V2-013
- [ ] V2-014
- [ ] V2-016

## In Progress

- [ ] (move ticket IDs here during sprint)

## Blocked

- [ ] (ticket ID + blocker)

## Done

- [ ] (completed ticket IDs)

## Sprint Exit Criteria

1. Generated API client path is active in v2 (`V2-004`, `V2-005`).
2. No direct `fetch()` in v2 components/features (`V2-006`).
3. Query key factories and shared job polling primitive are in place (`V2-008`, `V2-009`).
4. Shared cycle progress function exists and is tested (`V2-010`).
5. Backend contract blockers for plan/create/run flows are resolved (`V2-012`, `V2-013`, `V2-014`, `V2-016`).

## Daily Standup Template

- Yesterday: completed ticket IDs
- Today: ticket IDs in progress
- Blockers: contract gaps, failing checks, dependency waits
- Risk: any committed ticket at risk of missing sprint

