# Design: Frontend Agent Guidelines — Defense in Depth

Date: 2026-02-27

## Problem

Code agents (Claude Code, Kilocode, Codex) working on the frontend produce recurring failures: contract mismatches (e.g., `draft` vs `pending` status values), pattern deviations (duplicating utilities, wrong file locations), and UX gaps (missing loading/error/empty states). Existing guidelines are recent, split across multiple files, and contain inconsistencies. No automated enforcement exists beyond TypeScript strict mode.

## Approach: Defense in Depth

Four reinforcing layers. Each catches what the previous one missed.

### Layer 0 — Source of Truth Consolidation

One canonical frontend contract file eliminates drift between agent instruction files.

```
docs/contracts/frontend-contract.md    ← THE source of truth
├── Referenced by: CLAUDE.md
├── Referenced by: AGENTS.md
├── Referenced by: .kilocodemodes / .kilocode/rules-*
└── Enforced by: eslint + generated types + CI
```

### Layer 1 — Agent Instruction Files (Thin Wrappers)

Each agent tool gets a short, directive file that: (1) defines the agent's role, (2) points to the contract, (3) adds tool-specific behavioral rules. No frontend business logic in these files.

- **CLAUDE.md**: Delivery workflow + contract pointer. Drop duplicate frontend rules.
- **AGENTS.md**: Same treatment. Fix `draft`→`pending` discrepancy.
- **Kilocode**: New `frontend-build` mode scoped to `frontend-v2/`. Existing modes get contract references.

### Layer 2 — The Frontend Contract (6 sections)

`docs/contracts/frontend-contract.md` contains:

- **§1 Canonical Values**: Status enum tables, action-to-status mapping, explicit WRONG examples.
- **§2 File Ownership**: What goes where, what doesn't. WRONG/RIGHT code pairs.
- **§3 Component Patterns**: Required structure, four-state rule, naming conventions, styling.
- **§4 API Integration**: Query key factories, mutation-owned invalidation, job polling spec.
- **§5 UX Rules**: Toasts, forms, review interactions, empty states, responsive, agent output display.
- **§6 Forbidden Patterns**: 13 numbered anti-patterns (FP-1 through FP-13) with examples.

### Layer 3 — Context Management

- Contract ordered by violation frequency, capped at ~800 lines.
- **`docs/contracts/frontend-manifest.md`**: Living inventory of components, utilities, hooks, feature module status.
- Scoped context loading per task type (component work loads patterns + manifest; bug fix loads core + manifest).
- Manifest update is part of definition of done.

### Layer 4 — Automated Guardrails

| Tier | Mechanism | Catches |
|------|-----------|---------|
| 1 | TypeScript strict + generated types | Wrong status values, type mismatches |
| 2 | ESLint custom rules | Raw `fetch()`, `setTimeout`, default exports, `console.log` |
| 3 | `npm run check` script | Build failures, lint failures, manifest drift |
| 4 | PR checklist | Missing states, business logic in UI, accessibility |

## Files Created or Modified

| Action | File |
|--------|------|
| Create | `docs/contracts/frontend-contract.md` |
| Create | `docs/contracts/frontend-manifest.md` |
| Modify | `CLAUDE.md` |
| Modify | `AGENTS.md` |
| Modify | `.kilocodemodes` |
| Modify | `.kilocode/rules-code/AGENTS.md` |
| Modify | `.kilocode/rules/00-kilo-behavior.md` |
| Modify | `frontend-v2/.eslintrc.json` |

## Known Gaps

- **Generated types don't exist yet** — until Orval is wired up (V2-005), the compiler can't enforce status values.
- **UX rules are hard to automate** — missing empty states, bad toasts, and accessibility gaps still require human review.
- **Manifest requires discipline** — useful only if kept current. The check script helps but is a nudge, not a gate.
