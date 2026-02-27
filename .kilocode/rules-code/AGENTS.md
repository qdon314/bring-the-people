# AGENTS.md — Code Mode (Bring The People)

## Commands

Backend:
- `uv run python -m uvicorn growth.app.main:app --reload`
- `uv run pytest`

Frontend:
- `cd frontend && npm run dev`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`

## Frontend contract

Before any frontend task, read:
- `docs/contracts/frontend-contract.md` — canonical rules, patterns, forbidden anti-patterns.
- `docs/contracts/frontend-manifest.md` — component/utility inventory. Check before creating anything new.

## Code priorities

1. Contract-first: verify API routes/schemas before UI or client changes.
2. Keep workflow gates explicit (Plan -> Create -> Run -> Results -> Memo).
3. Keep status enums canonical and consistent (`pending|approved|rejected`, not `draft`).
4. Keep business logic in domain/utils, not ad hoc in UI components.

## Architecture pointers

- Backend domain/policies: `src/growth/domain/*`
- Backend API/contracts: `src/growth/app/api/*`, `src/growth/app/schemas.py`
- Frontend routes/components: `frontend/app/*`, `frontend/components/*`
- Frontend API/hooks/types: `frontend/lib/api/*`, `frontend/lib/hooks/*`, `frontend/lib/types.ts`

## After coding

- Update `docs/contracts/frontend-manifest.md` if you added shared components, utilities, or hooks.
- Provide suggested commit(s) at end.

## Git

- No auto-commit.
- No unrelated reverts.
