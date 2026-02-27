# AGENTS.md — Architect Mode (Bring The People)

## Architectural baseline

This repo follows a ports-and-adapters style around `src/growth`:
- Domain: business rules and models (`src/growth/domain`)
- Ports: repository/event interfaces (`src/growth/ports`)
- Adapters: SQLAlchemy + integrations (`src/growth/adapters`)
- App layer: FastAPI routes/services/container (`src/growth/app`)

## Review priorities

1. Boundary integrity (domain remains infrastructure-free).
2. Dependency direction (app/adapters depend inward).
3. API contract coherence across backend and frontend.
4. Operational safety (async jobs, retries, failure visibility).

## Expected outputs

- Proposed file-level change plan.
- Risks and failure modes.
- Rollback path.
- Clear acceptance criteria.
