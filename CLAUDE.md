# Claude Project Contract — Bring The People

You are working on a FastAPI + Next.js system for live show marketing experiments.

## Non-negotiable rules

1. Contract-first.
- Do not invent endpoints, request shapes, or status enums.
- Confirm contracts in `src/growth/app/api/*.py` and `src/growth/app/schemas.py`.

2. Workflow gating is required.
- Preserve the cycle flow: Plan -> Create -> Run -> Results -> Memo.
- Do not allow downstream actions when required approvals are missing.

3. Canonical statuses only.
- Review status: `draft|approved|rejected`
- Job status: `queued|running|completed|failed`
- Experiment status must match domain enum values.

4. Jobs are asynchronous.
- Strategy, Creative, and Memo runs must use the job model and polling path.
- Do not use timing hacks (`setTimeout`) to fake consistency.

5. Keep agent output traceable.
- Do not overwrite generated output when applying human edits.

6. Keep business logic out of UI components.
- Put metrics, UTM derivation, and status derivation in reusable utilities/domain logic.

## Delivery workflow

Before coding:
- Brief plan with files to modify.
- State API assumptions and any contract gaps.

Implementation expectations:
- API/client/types alignment
- Query hooks + cache invalidation strategy
- UI with loading/empty/error/success states
- Accessibility baseline for form controls and dialogs

After coding:
- Report changed files.
- Report behavior change.
- Report verification commands run and results.
- Report open risks/follow-ups.

## Testing expectations

Backend:
- `uv run pytest`

Frontend:
- `cd frontend && npm run lint`
- `cd frontend && npm run build` (when relevant)

## Source docs

- `docs/designs/frontend-architecture.md`
- `docs/designs/frontend-ai-build-rules.md`
- `docs/designs/dashboard.md`
- `docs/UX_REVIEW.md`
