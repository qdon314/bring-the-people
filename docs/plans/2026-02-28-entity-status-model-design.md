# Entity Status Model Design

Date: 2026-02-28

## Problem

The experiment status model has 7 values (`draft / awaiting_approval / approved / running / completed / stopped / archived`) designed for a future where agents create and launch experiments autonomously. The actual flow today is fully human-driven, and the term "run" is overloaded across three different concepts: the cycle step, agent execution, and experiment state. The term "launched" appears in UI code and design docs but is not a backend status value.

## Entity Status Model (revised)

Three status systems exist in the domain, each serving a distinct purpose:

### 1. Review status — `pending / approved / rejected`

Applied to Segments, Frames, and Variants. Represents human approval of agent-generated artifacts. Unchanged.

### 2. Experiment status — `draft / active / awaiting_approval / decided`

Tracks the lifecycle of a single experiment within and across cycles.

- `draft`: created from approved creative, not yet live
- `active`: ads are running externally, collecting results
- `awaiting_approval`: carried from a prior cycle after a scale/hold decision, needs re-approval
- `decided`: a scale/hold/kill decision has been recorded

**Transitions:**

```
draft → active → decided
                    ├── kill: experiment is done
                    ├── hold: carries to next cycle as awaiting_approval
                    └── scale: carries to next cycle as awaiting_approval

awaiting_approval → active (re-approved for new cycle)
awaiting_approval → decided (killed without running again)
```

The `Decision.action` (scale/hold/kill) replaces the need for terminal experiment statuses.

**Removed:** `approved`, `running`, `launched`, `completed`, `stopped`, `archived` from experiment status.

### 3. Job status — `queued / running / completed / failed`

Tracks async agent execution. Unchanged.

## Cycle Progress Derivation

A cycle has no stored status. Its progress is derived from its child artifacts. The stepper is navigational — the producer can move between steps freely, but forward actions are gated by preconditions.

### Derivation rules

| Step | Precondition to unlock | Complete when |
|---|---|---|
| Plan | *(always available)* | >= 1 approved segment AND >= 1 approved frame |
| Create | Plan complete | >= 1 approved variant on an approved frame |
| Run | Create complete | >= 1 experiment exists (any status) |
| Results | >= 1 active experiment; producer clicks "Go to Results" | >= 1 observation exists for an active/decided experiment |
| Memo | Results complete | >= 1 memo exists |

**Key distinction:** "unlock" means the step is reachable in the stepper. "Complete" means the precondition for the *next* step is satisfied. The producer can always navigate back.

**The "Go to Results" button** appears in the Run step when at least one experiment is `active`. It is purely navigational — clicking it focuses the stepper on Results. It does not write any status.

**Cross-cycle carry-forward:** When a cycle ends, experiments with `Decision.action` of `scale` or `hold` transition to `awaiting_approval`. They appear in the next cycle's Run step as needing re-approval before becoming `active` again.

## Terminology Glossary

These terms have precise meanings in this system. Frontend code, docs, and conversation should use them consistently.

| Term | Meaning | Not to be confused with |
|---|---|---|
| **Cycle** | A time-bounded iteration of the full workflow for a show. Contains segments, frames, variants, experiments, and a memo. Has no stored status. | "Run" |
| **Experiment** | A launchable unit: segment + frame + variant + channel + budget. Has its own lifecycle (`draft / active / awaiting_approval / decided`). | "Job", "Run" |
| **Job** | An async agent execution (strategy, creative, or memo). Has status `queued / running / completed / failed`. Produces artifacts; does not represent an experiment. | "Experiment", "Run" |
| **Run** (cycle step) | The step in the cycle stepper where the producer assembles experiments from approved creative. | Agent execution, job running |
| **Launch** | The human action of putting ads live externally. Transitions an experiment from `draft` to `active`. | "Run", "Start" |
| **Decision** | A scale/hold/kill judgment on an experiment after observing results. Not a status — it's a separate record. | Experiment status |
| **Review** | Human approval of agent-generated artifacts (segments, frames, variants). Uses `review_status`. | Experiment approval, Decision |

### Retired terms

- `running` (experiment status) → replaced by `active`
- `launched` → use "Launch" as a verb/action only, not a status value
- `completed` / `stopped` / `archived` (experiment status) → replaced by `decided`
- `approved` (experiment status) → removed; review approval is on the creative assets, not the experiment
