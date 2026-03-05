# Frontend Contract — Bring The People

Authoritative frontend contract for all agents. Load only the section(s) relevant to your current task.

Companion file: `docs/contracts/frontend-manifest.md` (component/utility inventory).

---

## Sections

| § | Topic | When to load | File |
|---|-------|-------------|------|
| 1 | Canonical Values | Status enums, action mappings | [canonical-values.md](frontend-contract/canonical-values.md) |
| 2 | File Ownership | Feature module structure, shared/ rules | [file-ownership.md](frontend-contract/file-ownership.md) |
| 3 | Component Patterns | Component structure, states, naming, styling | [component-patterns.md](frontend-contract/component-patterns.md) |
| 4 | API Integration | Query keys, mutations, polling, error handling | [api-integration.md](frontend-contract/api-integration.md) |
| 5 | UX Rules | Toasts, forms, modals, empty/loading states | [ux-rules.md](frontend-contract/ux-rules.md) |
| 6 | Forbidden Patterns | FP-1 through FP-13: what NOT to do | [forbidden-patterns.md](frontend-contract/forbidden-patterns.md) |
| 7 | Testing | Test requirements, conventions, quality gates | [testing.md](frontend-contract/testing.md) |

## Quick reference

- Status values: see §1
- "Where does this code go?": see §2
- "How should I structure this component?": see §3
- "How do I fetch/mutate data?": see §4
- "What UX patterns should I follow?": see §5
- "What should I NOT do?": see §6
- "What tests do I need?": see §7
