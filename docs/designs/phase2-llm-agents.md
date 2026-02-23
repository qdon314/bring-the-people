# Phase 2: LLM Agents — Design

## Overview

Phase 2 adds Claude-powered LLM agents to the growth system. Three agents share a common infrastructure (tool-use loop runner, conversation logging, output parsing) that enables deterministic, auditable automation:

| Agent | Purpose | Max Turns |
|-------|---------|-----------|
| **Strategy Agent** | Analyzes show context and proposes audience segments with framing hypotheses | 10 |
| **Creative Agent** | Generates 2-3 ad copy variants for a given frame | 8 |
| **Memo Agent** | Summarizes completed experiment cycles into producer-friendly reports | 6 |

The Strategy Agent analyzes a show's context — ticket data, budget status, past experiments, active experiments — and proposes 3-5 audience segments with framing hypotheses. Its output is auto-persisted as draft `AudienceSegment` and `CreativeFrame` records. The existing approval workflow on experiments gates any downstream spend.

### Decisions

- **Direct `anthropic` Python SDK, no framework.** The tool-use loop is a plain function, not a class hierarchy. Matches the design doc's "no framework" principle.
- **Sonnet as default model.** Fast, cheap, strong at structured tool use. Configurable — upgrade to Opus is a config change.
- **Auto-persist agent output as draft entities.** Segments and frames are raw material. The producer still must create and approve experiments before spend happens.
- **Per-agent turn caps with override.** Strategy: 10, Creative: 8, Memo: 6. The runner accepts `max_turns` so callers can override.
- **1 retry on parse failure, no token budget enforcement.** Token usage is logged to run artifacts for future analysis. Turn caps bound cost in practice.

---

## Shared Agent Infrastructure

### Claude Client

`src/growth/adapters/llm/client.py` — thin wrapper around `anthropic.Anthropic()`:

- Reads API key from `ANTHROPIC_API_KEY` env var
- Configurable model name (default `claude-sonnet-4-20250514`)
- Single `chat(messages, system, tools) -> Message` method that calls `messages.create()`
- Returns the raw Anthropic `Message` object (caller accesses `content`, `usage`, `stop_reason`)

### Agent Runner

`src/growth/adapters/llm/agent_runner.py` — a generic tool-use loop as a function:

```
run(
    client: ClaudeClient,
    system_prompt: str,
    user_message: str,
    tools: list[dict],           # Claude API tool schemas
    tool_dispatcher: Callable,   # maps (tool_name, tool_input) -> result dict
    output_model: type[BaseModel],
    max_turns: int = 10,
    conversation_log_path: Path | None = None,
) -> AgentResult
```

**Loop logic:**

1. Build initial messages: `[{"role": "user", "content": user_message}]`
2. Call `client.chat(messages, system_prompt, tools)`
3. If response contains `tool_use` content blocks:
   - For each tool_use block: call `tool_dispatcher(name, input)`, append tool result
   - Append assistant message + tool results to conversation
   - Increment turn counter; if `turn >= max_turns`, raise `AgentTurnLimitError`
   - Loop back to step 2
4. If response is a text block with no tool_use:
   - Parse text as JSON into `output_model`
   - On `ValidationError`: append error feedback message, retry once
   - On second failure: raise `AgentParseError`
5. Return `AgentResult(output=parsed_model, turns_used=N, input_tokens=X, output_tokens=Y)`

**Conversation logging:**

If `conversation_log_path` is provided, every message (user, assistant, tool_use, tool_result) is appended as a JSONL line with timestamps. On failure, the partial conversation is still logged for debugging.

### Result Model

```python
@dataclass(frozen=True)
class AgentResult:
    output: BaseModel          # the parsed output model
    turns_used: int
    total_input_tokens: int
    total_output_tokens: int
```

### Errors

```python
class AgentTurnLimitError(Exception): ...
class AgentParseError(Exception): ...
class AgentAPIError(Exception): ...
```

---

## Strategy Agent

### Output Schema

`src/growth/adapters/llm/schemas.py`:

```python
class EvidenceRef(BaseModel):
    source: str       # "past_experiment", "show_data", "budget_data"
    id: str | None    # experiment_id, show_id, etc.
    summary: str      # one-line description of what this evidence shows

class FramePlan(BaseModel):
    segment_name: str
    segment_definition: dict[str, Any]   # targeting criteria
    estimated_size: int | None
    hypothesis: str                       # the framing angle
    promise: str                          # the core value prop
    evidence_refs: list[EvidenceRef]      # must be non-empty
    channels: list[str]                   # e.g. ["meta", "instagram"]
    budget_range_cents: tuple[int, int]   # (min, max)
    risk_notes: str | None

class StrategyOutput(BaseModel):
    frame_plans: list[FramePlan] = Field(min_length=3, max_length=5)
    reasoning_summary: str
```

### Tools

`src/growth/adapters/llm/strategy_tools.py` — four plain functions:

**`query_knowledge_base(show_id, filters) -> dict`**

Queries past experiments and their decisions for the same city, venue, or similar shows. Returns a list of experiment summaries with segment names, hypotheses, channels, decision outcomes (scale/hold/kill), and key metrics (CAC, conversion rate). Filters can narrow by city, channel, or decision action.

Reads from: `ExperimentRepository`, `SegmentRepository`, `FrameRepository`

**`get_show_details(show_id) -> dict`**

Returns the show's core info (artist, city, venue, date, capacity), current ticket sales, computed show phase (early/mid/late), and days until showtime.

Reads from: `ShowRepository`

**`get_budget_status(show_id) -> dict`**

Computes: total budget (from show config or a budget field — see open item below), cumulative spend across all experiments for the show, remaining budget, current phase budget cap percentages from policy config, and the max budget available for the next experiment.

Reads from: `ExperimentRepository`, `ObservationRepository` (via experiment repo), `PolicyConfig`

**`get_active_experiments(show_id) -> dict`**

Returns all experiments in `running` or `approved` status for the show, including their segment names, frame hypotheses, channels, and budget caps. Lets the agent avoid proposing duplicate segments or angles.

Reads from: `ExperimentRepository`, `SegmentRepository`, `FrameRepository`

Each function takes repository instances as arguments (injected by the strategy service). Each returns a plain dict that gets JSON-serialized as the tool result in the Claude conversation.

### System Prompt

`src/growth/adapters/llm/prompts/strategy.py` — string constant.

Contents:
- Role: "You are a growth strategy agent for live show ticket sales."
- Goal: "Analyze the show and propose 3-5 experiment frames for the current cycle."
- Constraints:
  - Every hypothesis must cite at least one evidence reference
  - Do not duplicate segments or angles that are already in active experiments
  - Stay within the available budget for the current phase
  - Cap plans at 3-5 per cycle
- Tool usage guidance: "Start by getting show details and active experiments. Then check budget status. Query the knowledge base for relevant past experiments. Use this context to form your proposals."
- Output format: "When ready, respond with a JSON object matching the StrategyOutput schema."

---

## Strategy Service

`src/growth/app/services/strategy_service.py`:

1. Receives `show_id`
2. Fetches the show, validates it exists
3. Creates run directory: `data/runs/<uuid>/`
4. Builds the tool dispatcher by partially applying repos into each tool function
5. Calls `agent_runner.run()` with:
   - Strategy system prompt
   - User message describing the show context (name, city, date, current sales)
   - Four tool schemas
   - Tool dispatcher
   - `StrategyOutput` as output model
   - `max_turns=10`
   - `conversation_log_path=data/runs/<run_id>/strategy_conversation.jsonl`
6. On success:
   - Iterates `FramePlan` list
   - Creates `AudienceSegment` + `CreativeFrame` domain objects per plan
   - Persists via repos
   - Writes `plan.json` to run directory (full StrategyOutput + token usage metadata)
   - Emits `strategy.completed` domain event
   - Returns created segment/frame IDs + raw `StrategyOutput`
7. On failure:
   - Logs conversation (already handled by runner)
   - Emits `strategy.failed` domain event
   - Raises `StrategyRunError` with run ID

### API Endpoint

`POST /api/strategy/{show_id}/run` in `src/growth/app/api/strategy.py`:

- Calls `strategy_service.run(show_id)`
- 200: returns created segments/frames and reasoning summary
- 404: show not found
- 502: agent failure (LLM error, turn limit, parse failure)

### Container Wiring

`container.strategy_service()` provides the service with:
- Show, experiment, segment, frame repos
- Event log
- Claude client (constructed from env config)
- Run artifacts base path

---

## Testing

### Unit Tests (no LLM calls)

**`tests/adapters/llm/test_agent_runner.py`** — mock Claude client:

- Tool calls get dispatched and results appended correctly
- Final text response gets parsed into output model
- Parse failure triggers retry with error feedback
- Second parse failure raises `AgentParseError`
- Turn limit raises `AgentTurnLimitError`
- Conversation is logged to JSONL
- Token usage is accumulated across turns

**`tests/adapters/llm/test_strategy_tools.py`** — each tool with real SQLite DB:

- `get_show_details` returns correct show info and computed phase
- `get_budget_status` computes remaining budget correctly from experiment observations
- `get_active_experiments` returns only running/approved experiments
- `query_knowledge_base` filters by city/channel/decision and returns summaries

**`tests/adapters/llm/test_strategy_schemas.py`** — Pydantic validation:

- `FramePlan` rejects empty `evidence_refs`
- `StrategyOutput` rejects fewer than 3 or more than 5 plans
- Valid data passes
- `budget_range_cents` validates min < max

### Integration Tests (recorded fixtures)

**`tests/app/test_strategy_service.py`**:

- Record a real Claude conversation as `tests/fixtures/strategy_conversation.json`
- Replay through strategy service with real SQLite DB
- Assert: segments and frames persisted, `plan.json` written, domain event emitted, returned IDs match DB

### Live Smoke Test (not in CI)

- `@pytest.mark.live_llm` marker, skipped by default
- Create show, run strategy service against real Claude API
- Assert: output parses, 3-5 frames created, evidence refs non-empty

---

## File Inventory

### New files:

| File | Purpose |
|------|---------|
| `src/growth/adapters/llm/__init__.py` | LLM adapters package |
| `src/growth/adapters/llm/client.py` | Thin wrapper around `anthropic.Anthropic()` |
| `src/growth/adapters/llm/agent_runner.py` | Generic tool-use loop runner |
| `src/growth/adapters/llm/schemas.py` | `FramePlan`, `EvidenceRef`, `StrategyOutput` Pydantic models |
| `src/growth/adapters/llm/strategy_tools.py` | Four tool functions |
| `src/growth/adapters/llm/prompts/__init__.py` | Prompts package |
| `src/growth/adapters/llm/prompts/strategy.py` | Strategy agent system prompt |
| `src/growth/app/services/strategy_service.py` | Strategy run orchestration |
| `src/growth/app/api/strategy.py` | Strategy API endpoint |
| `tests/adapters/llm/__init__.py` | LLM test package |
| `tests/adapters/llm/test_agent_runner.py` | Runner unit tests |
| `tests/adapters/llm/test_strategy_tools.py` | Tool function tests |
| `tests/adapters/llm/test_strategy_schemas.py` | Schema validation tests |
| `tests/app/test_strategy_service.py` | Integration test with fixtures |
| `tests/fixtures/strategy_conversation.json` | Recorded Claude conversation |

### Modified files:

| File | Changes |
|------|---------|
| `pyproject.toml` | Add `anthropic` SDK dependency |
| `src/growth/app/container.py` | Add `strategy_service()` provider |
| `src/growth/app/api/app.py` | Register strategy router |
| `src/growth/domain/events.py` | Add `StrategyCompleted`, `StrategyFailed` events |

---

## Open Items

- **Show budget field**: the `Show` model doesn't have a `total_paid_budget` field yet. The `get_budget_status` tool needs this. Options: add it to `Show`, or create a separate `ShowBudget` entity. Decide during implementation.
- **Knowledge base query depth**: for a show with zero past experiments, `query_knowledge_base` returns empty. The agent should handle this gracefully (propose exploratory frames without evidence from past runs, citing show data instead).

## Creative Agent

The Creative Agent generates ad copy variants for a given [`CreativeFrame`](src/growth/domain/models.py:70).

### Output Schema

[`CreativeOutput`](src/growth/adapters/llm/schemas.py:104) and [`CreativeVariantDraft`](src/growth/adapters/llm/schemas.py:95):

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

### Tools

[`creative_tools.py`](src/growth/adapters/llm/creative_tools.py):

- **`get_frame_context(frame_id)`** — Returns frame + segment + show details as a single context dict
- **`get_platform_constraints(channel)`** — Returns character limits and platform-specific guidance

### Turn Cap

8 turns (configurable per-call)

### Service

[`CreativeService`](src/growth/app/services/creative_service.py:61) orchestrates the run:

1. Fetch frame by ID
2. Create run directory: `data/runs/<uuid>/`
3. Build tool dispatcher with repos
4. Call `agent_runner.run()` with `max_turns=8`, `CreativeOutput` model
5. Validate variants against platform constraints deterministically
6. On success: persist `CreativeVariant` objects, write `creative_output.json`, emit `CreativeCompleted`
7. On failure: emit `CreativeFailed`, raise `CreativeRunError`

### API Endpoint

`POST /api/creative/{frame_id}/run` in [`src/growth/app/api/creative.py`](src/growth/app/api/creative.py:13):

- 200: returns variant IDs and reasoning summary
- 404: frame not found
- 422: constraint violation error with details
- 502: agent failure

---

## Memo Agent

The Memo Agent summarizes a completed experiment cycle into a producer-friendly report.

### Output Schema

[`MemoOutput`](src/growth/adapters/llm/schemas.py:113):

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

### Tools

[`memo_tools.py`](src/growth/adapters/llm/memo_tools.py):

- **`get_show_details(show_id)`** — Reused from Strategy Agent
- **`get_cycle_experiments(show_id, cycle_start, cycle_end)`** — New tool returning experiments + observations + decisions in the cycle window
- **`get_budget_status(show_id)`** — Reused from Strategy Agent

### Turn Cap

6 turns (configurable per-call)

### Service

[`MemoService`](src/growth/app/services/memo_service.py:53) orchestrates the run:

1. Fetch show by ID, validate cycle dates
2. Create run directory: `data/runs/<uuid>/`
3. Build tool dispatcher with repos
4. Call `agent_runner.run()` with `max_turns=6`, `MemoOutput` model
5. On success: persist `ProducerMemo`, write `memo.json` + `memo.md`, emit `MemoCompleted`
6. On failure: emit `MemoFailed`, raise `MemoRunError`

### API Endpoint

`POST /api/memo/{show_id}/run` in [`src/growth/app/api/memo.py`](src/growth/app/api/memo.py:14):

- Query params: `cycle_start`, `cycle_end` (required ISO timestamps)
- 200: returns memo with structured fields and markdown
- 404: show not found
- 422: invalid dates or validation error
- 502: agent failure

---

## Domain Events

All three agents emit domain events for audit logging:

| Event | Source | Fields |
|-------|--------|--------|
| `StrategyCompleted` | [`events.py`](src/growth/domain/events.py) | show_id, run_id, segment_ids, frame_ids, token usage |
| `StrategyFailed` | [`events.py`](src/growth/domain/events.py) | show_id, run_id, error_type, error_message |
| `CreativeCompleted` | [`events.py`](src/growth/domain/events.py) | frame_id, run_id, variant_ids, token usage |
| `CreativeFailed` | [`events.py`](src/growth/domain/events.py) | frame_id, run_id, error_type, error_message |
| `MemoCompleted` | [`events.py`](src/growth/domain/events.py) | show_id, memo_id, run_id, cycle dates, token usage |
| `MemoFailed` | [`events.py`](src/growth/domain/events.py) | show_id, run_id, error_type, error_message |

---

## File Inventory (All Agents)

### New files (Phase 2 complete)

| File | Purpose |
|------|---------|
| `src/growth/adapters/llm/__init__.py` | LLM adapters package |
| `src/growth/adapters/llm/client.py` | Thin wrapper around `anthropic.Anthropic()` |
| `src/growth/adapters/llm/agent_runner.py` | Generic tool-use loop runner |
| `src/growth/adapters/llm/schemas.py` | Pydantic models for all agent outputs |
| `src/growth/adapters/llm/strategy_tools.py` | Strategy Agent tools |
| `src/growth/adapters/llm/creative_tools.py` | Creative Agent tools |
| `src/growth/adapters/llm/memo_tools.py` | Memo Agent tools |
| `src/growth/adapters/llm/prompts/__init__.py` | Prompts package |
| `src/growth/adapters/llm/prompts/strategy.py` | Strategy Agent system prompt |
| `src/growth/adapters/llm/prompts/creative.py` | Creative Agent system prompt |
| `src/growth/adapters/llm/prompts/memo.py` | Memo Agent system prompt |
| `src/growth/app/services/strategy_service.py` | Strategy run orchestration |
| `src/growth/app/services/creative_service.py` | Creative run orchestration |
| `src/growth/app/services/memo_service.py` | Memo run orchestration |
| `src/growth/app/api/strategy.py` | Strategy API endpoint |
| `src/growth/app/api/creative.py` | Creative API endpoint |
| `src/growth/app/api/memo.py` | Memo API endpoint |

### All Three Agents Implemented

Phase 2 is complete with three Claude-powered agents:

| Agent | Purpose | Turn Cap | Output |
|-------|---------|----------|--------|
| **Strategy** | Propose segments and frames for a show | 10 | 3-5 FramePlans with evidence |
| **Creative** | Generate ad copy variants for a frame | 8 | 2-3 CreativeVariants with hooks, body, CTA |
| **Memo** | Summarize experiment cycle for producer | 6 | Structured memo with what worked/failed, next tests |

---

## Deferred

- `cycle_runner.py` orchestrating the full strategy -> creative -> approve flow
- Token budget enforcement
- Dashboard surfacing of agent runs
- Prompt versioning or A/B testing
