# AGENTS.md — Bring The People

Agentic growth system for live show marketing experiments.
Backend: FastAPI + SQLAlchemy (`src/growth`). Frontend: Next.js 14 (`frontend`, `frontend-v2`). Data: SQLite (`growth.db`).

## Commands

Backend:
- `python -m uvicorn growth.app.main:app --reload`
- `pytest`
- `pytest tests/<path> -k <pattern>`

Frontend (v1):
- `cd frontend && npm run lint`
- `cd frontend && npm run build`

Frontend (v2):
- `cd frontend-v2 && npm run lint`
- `cd frontend-v2 && npm run test`
- `cd frontend-v2 && npm run build`

## Hard constraints

- Contract-first: do not invent API routes or payloads. Verify in `src/growth/app/api/*.py` and `src/growth/app/schemas.py`.
- Workflow gating: Plan → Create → Run → Results → Memo. Approval status: `pending|approved|rejected`.
- Keep agent-generated content distinct from human edits.
- Small, vertical slices. Include loading/empty/error states in UI changes.
- Every code change must include or update tests. No deferred "test later" unless approved.
- Never auto-commit. Never revert unrelated changes. Provide suggested commits.
- For any new plan or feature branch, create a worktree under `.worktrees/` (e.g. `.worktrees/my-feature`). Do not work directly on `main`.
- After implementation, produce a suggested pull request description. When the user approves, use `gh pr create` to push the branch and open the PR.

## Key architectural decisions

These decisions are final. Do not re-derive them or work around them without explicit approval.

1. **Jobs are async/polling, never setTimeout.** Background jobs use the job model with a `queued→running→completed|failed` lifecycle. Clients poll. This is a deliberate choice for reliability — don't use timers as a shortcut.

2. **Canonical status enums are fixed.** Review: `pending|approved|rejected`. Job: `queued|running|completed|failed`. Experiment: `draft|active|awaiting_approval|decided`. Adding new statuses requires design review.

3. **React Query owns server state in frontend-v2.** Don't use `useState` + `useEffect` to fetch data. All server interactions go through React Query queries/mutations. This keeps cache invalidation consistent.

4. **Feature-sliced structure in frontend-v2.** Each feature lives under `frontend-v2/features/<name>/` with its own `api.ts`, `queries.ts`, `ui/`. Don't put feature logic in `app/` or shared components. Check `frontend-manifest.md` before creating shared utilities.

## Acceptance criteria format

Every task spec must include acceptance criteria, not just a description. Use this format:

```
Task: [what to build]

Acceptance criteria:
- [ ] Happy path: [specific behavior]
- [ ] Loading state: spinner shown while [action] is pending
- [ ] Empty state: [what user sees when no data]
- [ ] Error state: [error message + recovery action]
- [ ] Edge cases: [list any non-obvious cases]
- [ ] Tests: [what tests prove this works]
```

"Implement StartCycleView" is not a spec. "StartCycleView: shows Start button when no active cycle, spinner while POST /cycles is pending, updates show status on success, shows error + retry on failure" is a spec.

## Frontend

Read the relevant sections of `docs/contracts/frontend-contract.md` (it's an index — load only the section files you need).
Check `docs/contracts/frontend-manifest.md` before creating shared components/hooks/utilities.
Update the manifest after adding any.

## Where to look

- Design: `docs/designs/dashboard.md`, `docs/designs/frontend-architecture.md`
- Backend domain: `src/growth/domain/*`, ports: `src/growth/ports/*`, adapters: `src/growth/adapters/*`
- Backend API: `src/growth/app/api/*`, schemas: `src/growth/app/schemas.py`
- Frontend v2 features: `frontend-v2/features/*/`
