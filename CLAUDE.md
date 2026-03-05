# CLAUDE.md — Bring The People

Read `AGENTS.md` for project rules, commands, and architecture pointers.
This file contains only Claude Code-specific additions.

## Hard constraints (beyond AGENTS.md)

- Canonical statuses: `pending|approved|rejected` (review), `queued|running|completed|failed` (job), `draft|active|awaiting_approval|decided` (experiment).
- Jobs are asynchronous — use the job model and polling path, never `setTimeout`.
- Keep business logic in domain/utils, not in UI components.

## Frontend-v2 workflow

For `frontend-v2` tasks, use the `frontend-v2-task` skill.
The skill handles context loading — do not read contract files in full upfront.

## Delivery checklist

Before: brief plan + files to modify + API assumptions.
After: changed files + behavior change + verification results + open risks.
