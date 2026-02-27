# AGENTS.md — Bring The People

This file is the primary repository guide for coding agents (including Codex).

## GitHub
 - Provide suggested commits after making changes.

## Project Context

Bring The People is an agentic growth system for live show marketing experiments.

Core stack:
- Backend: FastAPI + SQLAlchemy (`src/growth`)
- Frontend: Next.js 14 + TypeScript (`frontend`)
- Data: SQLite in local dev (`growth.db`)

Primary workflows:
- Show setup
- Strategy generation (segments/frames)
- Creative generation (variants)
- Experiment run + observations
- Decisioning (scale/hold/kill)
- Memo generation

## Canonical Docs

- Product/UX: `docs/designs/dashboard.md`
- Visual baseline: `docs/designs/dashboard-prototype.html`
- Frontend architecture: `docs/designs/frontend-architecture.md`
- AI implementation rules: `docs/designs/frontend-ai-build-rules.md`
- Current UX gap analysis: `docs/UX_REVIEW.md`

## Working Rules

1. Contract-first changes.
- Do not invent API routes or payloads.
- Verify route shapes in `src/growth/app/api/*.py` and `src/growth/app/schemas.py`.

2. Keep workflow gates explicit.
- Plan -> Create -> Run -> Results -> Memo gating must be data-driven.
- Approval status must remain canonical: `draft|approved|rejected`.

3. Preserve auditability.
- Keep agent-generated content distinct from human-edited content where applicable.

4. Keep changes reviewable.
- Prefer small, vertical slices.
- Include loading/empty/error states in UI changes.

## Commands

Backend:
- Run API: `uv run python -m uvicorn growth.app.main:app --reload`
- Run tests: `uv run pytest`
- Run a specific test: `uv run pytest tests/path/to/test_file.py -k <pattern>`

Frontend:
- Install deps: `cd frontend && npm install`
- Dev server: `cd frontend && npm run dev`
- Build: `cd frontend && npm run build`
- Lint: `cd frontend && npm run lint`

## Architecture Pointers

- Domain models and policy logic: `src/growth/domain/*`
- Ports/interfaces: `src/growth/ports/*`
- Adapters/repositories: `src/growth/adapters/*`
- API and orchestration: `src/growth/app/*`
- Frontend routes: `frontend/app/*`
- Frontend API clients/hooks: `frontend/lib/api/*`, `frontend/lib/hooks/*`

## Agent Expectations

Before coding:
- State assumptions and identify touched files.

After coding:
- Report behavior changes, contract assumptions, tests run, and any remaining risks.

Git:
- Never auto-commit.
- Never revert unrelated user changes.
