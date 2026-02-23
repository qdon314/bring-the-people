# Creative & Memo Agents — Design

## Overview

Two new agents building on the shared agent infrastructure established by the Strategy Agent. The Creative Agent turns frames into ad copy variants. The Memo Agent summarizes completed cycles for the producer.

Both reuse `agent_runner.run()`, `AgentResult`, the error types, and the service/event/artifact patterns from the strategy agent.

---

## Creative Agent

### Purpose

Takes a single `CreativeFrame` (hypothesis + promise + segment + channel) and produces 2-3 platform-specific ad copy variants (hook, body, CTA).

### Endpoint

`POST /api/creative/{frame_id}/run`

- 200: variant IDs, reasoning summary, token usage
- 404: frame not found
- 422: validation error (invalid output, constraint violations)
- 502: agent failure

### Turn Cap

8

### Tools

Two tools. The agent gets its brief, gets platform rules, then writes copy.

**`get_frame_context(frame_id)`**

Returns a single dict joining:
- `frame`: hypothesis, promise, evidence_refs, risk_notes
- `segment`: name, definition (geo, interests, behaviors, demographics), estimated_size
- `show`: artist_name, city, venue, show_time, capacity, tickets_sold, tickets_total, phase, days_until_show

Reads from: `FrameRepository`, `SegmentRepository`, `ShowRepository`

**`get_platform_constraints(channel)`**

Returns:
- `channel`: the channel name
- `constraints`: dict of field name to max character count (e.g., `{"hook": 80, "body": 500, "cta": 60}`)
- `notes`: platform-specific guidance (e.g., "Meta: front-load value prop, emoji OK but not required")

Hardcoded dict constant for MVP. No external API call.

### Output Schema

```python
class CreativeVariantDraft(BaseModel):
    hook: str                      # 5-80 chars
    body: str                      # 10-500 chars
    cta: str                       # 5-60 chars
    reasoning: str                 # 10-280 chars, why this angle

class CreativeOutput(BaseModel):
    variants: list[CreativeVariantDraft] = Field(min_length=2, max_length=3)
    reasoning_summary: str = Field(min_length=20, max_length=800)
```

`platform` is omitted from the agent output — it's always the frame's channel. The service sets it when creating `CreativeVariant` domain objects.

`constraints_passed` is omitted from the agent output — the service validates constraints deterministically (character length checks against platform rules). If any variant fails, the service raises a validation error (422).

### Service (`creative_service.py`)

1. Fetch frame by ID (raise `ValueError` if not found)
2. Create `data/runs/<run_id>/` directory
3. Build tool dispatcher — partial-apply repos into tool functions
4. Call `run_agent()` with `max_turns=8`, `CreativeOutput` as output model
5. **Validate constraints deterministically:** check each variant's hook/body/cta lengths against platform constraints from `get_platform_constraints`. If any fail, raise validation error (422).
6. On success: set `platform` from frame's channel, compute `constraints_passed=True`, create `CreativeVariant` domain objects, persist via repo, write `creative_output.json` (including run metadata: `model_name`, `prompt_version`), emit `CreativeCompleted`
7. On failure: emit `CreativeFailed`, raise `CreativeRunError`

### Domain Events

```python
@dataclass(frozen=True)
class CreativeCompleted(DomainEvent):
    frame_id: UUID
    run_id: UUID
    num_variants: int
    variant_ids: tuple[UUID, ...]
    turns_used: int
    total_input_tokens: int
    total_output_tokens: int
    event_type: str = field(default="creative_completed", init=False)

@dataclass(frozen=True)
class CreativeFailed(DomainEvent):
    frame_id: UUID
    run_id: UUID
    error_type: str
    error_message: str
    event_type: str = field(default="creative_failed", init=False)
```

---

## Memo Agent

### Purpose

Summarizes a completed experiment cycle into a one-page producer memo with structured fields and formatted markdown.

### Endpoint

`POST /api/memo/{show_id}/run?cycle_start=...&cycle_end=...`

- `cycle_start` and `cycle_end` are required query params (ISO timestamps)
- 200: memo ID, structured fields, token usage
- 404: show not found
- 422: validation error (invalid/missing params, start >= end, invalid output)
- 502: agent failure

### Turn Cap

6

### Tools

Three tools. Two reused from strategy, one new.

**`get_show_details(show_id)`** — Reused from strategy. Artist, city, venue, tickets, phase, days until show.

**`get_cycle_experiments(show_id, cycle_start, cycle_end)`** — New. All experiments running or completed during the window. Returns normalized, memo-friendly fields per experiment:

- `experiment_id`, `segment_name`, `frame_hypothesis`, `channel`, `budget_cap_cents`
- `observations`: numeric fields kept numeric — `spend_cents`, `impressions`, `clicks`, `purchases`, `revenue_cents`
- `decision`: `action` (scale/hold/kill), `confidence`, `rationale`

Clean numeric fields reduce hallucinated arithmetic in the memo.

Reads from: `ExperimentRepository`, `SegmentRepository`, `FrameRepository`, `ObservationRepository` (via experiment), `DecisionRepository`

**`get_budget_status(show_id)`** — Reused from strategy. Total spend, remaining budget, current phase cap.

### Output Schema

```python
class MemoOutput(BaseModel):
    what_worked: str = Field(min_length=20, max_length=800)
    what_failed: str = Field(min_length=20, max_length=800)
    cost_per_seat_cents: int = Field(ge=0)
    cost_per_seat_explanation: str = Field(min_length=10, max_length=400)
    next_three_tests: list[str] = Field(min_length=1, max_length=3)
    policy_exceptions: Optional[str] = Field(default=None, max_length=400)
    markdown: str = Field(min_length=50)
    reasoning_summary: str = Field(min_length=20, max_length=800)
```

`cost_per_seat_cents` is typed as an integer for aggregation and charting across cycles. `cost_per_seat_explanation` carries the prose (how computed, caveats).

### Service (`memo_service.py`)

1. Fetch show by ID (raise `ValueError` if not found)
2. Create `data/runs/<run_id>/` directory
3. Build tool dispatcher — partial-apply repos into tool functions
4. Call `run_agent()` with `max_turns=6`, `MemoOutput` as output model
5. On success: create `ProducerMemo` domain object (persisting `markdown` field), write `memo.json` (structured fields + run metadata: `model_name`, `prompt_version`) + `memo.md` (markdown) artifacts, emit `MemoCompleted`
6. On failure: emit `MemoFailed`, raise `MemoRunError`

### Domain Events

```python
@dataclass(frozen=True)
class MemoCompleted(DomainEvent):
    show_id: UUID
    memo_id: UUID
    run_id: UUID
    cycle_start: str
    cycle_end: str
    turns_used: int
    total_input_tokens: int
    total_output_tokens: int
    event_type: str = field(default="memo_completed", init=False)

@dataclass(frozen=True)
class MemoFailed(DomainEvent):
    show_id: UUID
    run_id: UUID
    error_type: str
    error_message: str
    event_type: str = field(default="memo_failed", init=False)
```

---

## File Inventory

### New files

| File | Purpose |
|------|---------|
| `src/growth/adapters/llm/creative_tools.py` | `get_frame_context`, `get_platform_constraints` |
| `src/growth/adapters/llm/memo_tools.py` | `get_cycle_experiments` |
| `src/growth/adapters/llm/prompts/creative.py` | `CREATIVE_SYSTEM_PROMPT` + `CREATIVE_TOOL_SCHEMAS` |
| `src/growth/adapters/llm/prompts/memo.py` | `MEMO_SYSTEM_PROMPT` + `MEMO_TOOL_SCHEMAS` |
| `src/growth/app/services/creative_service.py` | Creative run orchestration |
| `src/growth/app/services/memo_service.py` | Memo run orchestration |
| `src/growth/app/api/creative.py` | Creative API endpoint |
| `src/growth/app/api/memo.py` | Memo API endpoint |
| `tests/adapters/llm/test_creative_tools.py` | Tool function tests with real SQLite |
| `tests/adapters/llm/test_creative_schemas.py` | Schema validation tests |
| `tests/adapters/llm/test_memo_tools.py` | Tool function tests with real SQLite |
| `tests/adapters/llm/test_memo_schemas.py` | Schema validation tests |
| `tests/app/test_creative_service.py` | Integration test with mock Claude |
| `tests/app/test_memo_service.py` | Integration test with mock Claude |
| `tests/api/test_creative.py` | API endpoint tests |
| `tests/api/test_memo.py` | API endpoint tests |

### Modified files

| File | Changes |
|------|---------|
| `src/growth/adapters/llm/schemas.py` | Add `CreativeVariantDraft`, `CreativeOutput`, `MemoOutput` |
| `src/growth/domain/events.py` | Add `CreativeCompleted`, `CreativeFailed`, `MemoCompleted`, `MemoFailed` |
| `src/growth/app/container.py` | Add `creative_service()`, `memo_service()` providers |
| `src/growth/app/api/app.py` | Register creative and memo routers |
| `src/growth/app/schemas.py` | Add API request/response schemas for both endpoints |

---

## Run Metadata

Both services write run metadata to their artifact JSON files:
- `model_name`: which Claude model was used
- `prompt_version`: version string for the system prompt
- `turns_used`, `total_input_tokens`, `total_output_tokens`

This makes agent behavior debuggable and reproducible.

---

## Decisions

- **One frame per creative run.** Simple, isolated, retryable. The orchestrator loops over frames.
- **2-3 variants per frame.** Enough for A/B testing, not wasteful with small budgets.
- **Two creative tools only.** No past variant lookup — strategy already handles differentiation.
- **Deterministic constraint validation.** The service checks character lengths, not the agent. Agent self-check fields removed from output schema.
- **Platform field set by service.** Always equals the frame's channel — no need for the agent to output it.
- **Typed metrics in memo.** `cost_per_seat_cents: int` instead of a string. Aggregatable across cycles.
- **Normalized tool payloads.** `get_cycle_experiments` returns clean numeric fields to reduce hallucinated arithmetic.
- **422 for validation errors.** Distinct from 502 agent failures. Covers bad params, constraint violations, invalid output.
- **Explicit cycle window for memo.** Required `cycle_start`/`cycle_end` params, no auto-detection.
- **Three memo tools, two reused.** Only `get_cycle_experiments` is new.
- **Structured memo output + markdown.** Structured fields for `memo.json` sidecar, markdown for producer and `ProducerMemo` persistence.
- **Next three tests as plain strings.** Human-readable, not machine-structured. The strategy agent does its own research.
- **Platform constraints hardcoded.** Dict constant in the tool function for MVP.

### Deferred

- **Variant distinctness check** (3-gram Jaccard dedup). Add if near-duplicates become a problem.
- **Past hooks in user prompt.** No history exists yet.
- **Idempotency keys.** Add when building `cycle_runner` orchestrator.
- **Constraints versioning.** One version exists. Version when it changes.
- **Variant labels** (A/B/C). Add when building the dashboard UI.
- **Markdown-from-fields consistency validation.** Structured fields are source of truth.
