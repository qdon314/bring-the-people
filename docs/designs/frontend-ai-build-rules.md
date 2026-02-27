# Frontend AI Build Rules (Claude/Codex/KiloCode)

Use this file as an execution contract when asking an AI assistant to implement frontend work.

## Scope

- Applies to all work under `frontend/`.
- Architecture source of truth: `docs/designs/frontend-architecture.md`.
- UX source of truth: `docs/designs/dashboard.md` and `docs/designs/dashboard-prototype.html`.

## Hard Rules

1. Do not invent endpoints. Use only documented API contracts.
2. Do not hardcode status literals outside shared enums/constants.
3. Do not add timing hacks (`setTimeout`) for data consistency.
4. Do not duplicate server state in local component state when TanStack Query already owns it.
5. Do not ship UI-only assumptions that bypass approval gates.
6. Do not change design tokens without explicit request.

## Required Output Format for AI Tasks

Every implementation response must include:

1. Files changed.
2. Exact behavior change.
3. API contract assumptions.
4. Tests added/updated.
5. Risks or follow-ups.

If any contract is missing/unclear, the assistant must stop and request clarification before coding.

## Task Decomposition Rules

1. One vertical slice at a time (Plan, Create, Run, Results, Memo).
2. Start from API/client/types and query keys before UI wiring.
3. Add loading, empty, error, and success states in the same task as main behavior.
4. Add or update tests in the same task; no deferred “test later” unless explicitly approved.

## Quality Gates

Assistant must run and pass:

1. Typecheck.
2. Lint.
3. Relevant unit/integration tests.

If any gate is skipped, assistant must state exactly why.

## PR Checklist Prompt

Paste this to the assistant before each coding task:

```text
Implement this frontend task using docs/designs/frontend-architecture.md.

Constraints:
- Contract-first: do not invent or rename API routes.
- Preserve dashboard-prototype visual tokens.
- Enforce workflow gating and explicit async job states.
- Include loading/empty/error states.
- Add or update tests in the same change.

Deliver:
1) concise plan
2) code changes
3) tests
4) verification commands run + results
5) assumptions and risks
```

## Debug Prompt (Regression Triage)

```text
Perform a regression triage on this frontend issue.

Output format:
1) Repro steps
2) Root cause with file/line references
3) Minimal fix
4) Broader architectural fix (if different)
5) Tests to prevent recurrence

Do not implement until root cause is explicit.
```

