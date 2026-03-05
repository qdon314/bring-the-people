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

## Frontend

Read the relevant sections of `docs/contracts/frontend-contract.md` (it's an index — load only the section files you need).
Check `docs/contracts/frontend-manifest.md` before creating shared components/hooks/utilities.
Update the manifest after adding any.

## Where to look

- Design: `docs/designs/dashboard.md`, `docs/designs/frontend-architecture.md`
- Backend domain: `src/growth/domain/*`, ports: `src/growth/ports/*`, adapters: `src/growth/adapters/*`
- Backend API: `src/growth/app/api/*`, schemas: `src/growth/app/schemas.py`
- Frontend v2 features: `frontend-v2/features/*/`
