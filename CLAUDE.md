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
- Review status: `pending|approved|rejected`
- Job status: `queued|running|completed|failed` (terminal: `completed|failed`)
- Experiment status must match domain enum values.

4. Jobs are asynchronous.
- Strategy, Creative, and Memo runs must use the job model and polling path.
- Do not use timing hacks (`setTimeout`) to fake consistency.

5. Keep agent output traceable.
- Do not overwrite generated output when applying human edits.

6. Keep business logic out of UI components.
- Put metrics, UTM derivation, and status derivation in reusable utilities/domain logic.

## Frontend contract

For all `frontend-v2` tasks, use the `frontend-v2-task` skill. It enforces the spec → patch → test → merge loop and loads codebase context without full exploration.

The skill will direct you to the relevant sections of these files when needed — do not read them in full upfront:
- `docs/contracts/frontend-contract.md` — canonical rules, patterns, and forbidden anti-patterns.
- `docs/contracts/frontend-manifest.md` — component/utility inventory. Check before creating anything new.

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
- Update `docs/contracts/frontend-manifest.md` if you added shared components, utilities, or hooks.

## Testing expectations

Backend:
- `pytest`

Frontend (v1):
- `cd frontend && npm run lint`
- `cd frontend && npm run build` (when relevant)

Frontend (v2):
- `cd frontend-v2 && npm run lint`
- `cd frontend-v2 && npm run test`
- `cd frontend-v2 && npm run build` (when relevant)

Every frontend code change must include or update tests in the same task.
No deferred "test later" unless explicitly approved. See `docs/contracts/frontend-contract.md` §7 for full testing rules.

## Source docs

- `docs/designs/frontend-architecture.md`
- `docs/designs/dashboard.md`
