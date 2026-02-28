# AGENTS.md — Ask Mode (Bring The People)

Use this guidance when answering architecture/product/codebase questions.

## Project Overview

Bring The People is an agentic growth system for live show marketing.

Main flow:
1. Shows
2. Strategy (segments + frames)
3. Creative (variants)
4. Run (experiments)
5. Results (observations + decisions)
6. Memo

## Stack

- Backend: FastAPI + SQLAlchemy under `src/growth`
- Frontend: Next.js (App Router) under `frontend`

## Key docs

- `docs/designs/dashboard.md`
- `docs/designs/frontend-architecture.md`
- `docs/contracts/frontend-contract.md`
- `docs/UX_REVIEW.md`

## Architecture map

- Domain: `src/growth/domain/*`
- Ports: `src/growth/ports/*`
- Adapters: `src/growth/adapters/*`
- API/services/container: `src/growth/app/*`

When answering questions:
- Prefer concrete file references.
- State contract assumptions explicitly.
- Call out backend/frontend mismatches before proposing fixes.
