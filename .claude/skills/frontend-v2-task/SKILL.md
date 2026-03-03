--- 
name: frontend-v2-task
description: Workflow and guardrails for frontend-v2 development tasks
---

# Frontend V2 Task Workflow

Use this skill for all frontend-v2 development tasks. It enforces a 4-phase loop with explicit checkpoints.

```
spec → patch → test → merge
```

---

## Phase 1 — Spec

**Before writing any code:**

1. Invoke the `frontend-v2-context` skill.
2. Read the ticket description and any linked docs.
3. Apply the exploration budget (see below).
4. Produce a spec in the exact format below.
5. **Stop and present the spec to the user. Wait for approval.**

**Spec format (required):**

```
**Ticket goal:** (1 sentence)
**Assumptions:** (bullet list, or "none")
**Files to change:** (exact paths, one per line)
**Patch outline:** (per-file bullet list of changes)
**Edge cases / UX:** (or "none")
**Test plan:** (commands + what passing means)
**Open questions:** (only if blocked — see Stop Conditions)
```

If any field cannot be filled confidently, halt and ask rather than guess.

**Exploration budget:**
Files opened during Spec must be files you intend to modify, or files that directly answer a specific named question. If you find yourself opening files to understand general patterns, stop — use the context skill instead. If you cannot complete the spec within the context skill + files to modify, output a numbered list of additional files you want to open and why, and wait for approval.

---

## Phase 2 — Patch

After spec is approved:

- Implement only what the approved spec describes.
- No opportunistic refactoring, extra error handling, or scope creep.
- Navigate directly to files using the context skill map — no re-exploration.
- If a surprise stop condition is triggered mid-implementation, halt immediately (see Stop Conditions).

---

## Phase 3 — Test

Always run before declaring done:

```bash
cd frontend-v2 && npm run lint
cd frontend-v2 && npm run test
```

Run build when the change touches routing, layout, or page files:
```bash
cd frontend-v2 && npm run build
```

Fix all failures before proceeding. Do not self-declare done without passing output in the conversation.

---

## Phase 4 — Merge / Handoff

- Commit with a conventional message (`feat:`, `fix:`, `refactor:` etc.).
- Update `docs/contracts/frontend-manifest.md` if any new shared components, utilities, or hooks were created (flip `planned` → `exists` or add new row).
- Update `.claude/skills/frontend-v2-context.md` if any new shared primitives, directories, or routing conventions were introduced. Set `last-verified` to today's date and current commit SHA.
- Surface a summary of changed files and behavior change.

---

## Stop Conditions

Halt and ask rather than continue when:

- A required API field is missing or ambiguous in the contract
- A route pattern doesn't match the convention in the context skill
- A test failure implies upstream breakage outside the ticket scope
- A new shared primitive is discovered as necessary mid-implementation that wasn't called for by the ticket (must be approved before continuing — it impacts `frontend-manifest.md`)
- Contract sections are in conflict
- The spec has an open question that blocks a required field

When halting, state clearly: what you know, what you don't know, and the specific question that unblocks you.
