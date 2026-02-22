# Agentic Growth System for Live Shows - Design

## Overview

A web application for a solo live-show producer to run disciplined marketing experiments that increase ticket sales. The system uses LLM agents with tool use to propose audience strategies and generate ad creative, a deterministic rules engine to evaluate results, and a Next.js dashboard to manage the full cycle.

### Core Loop

1. Producer creates a show with venue, date, and capacity details.
2. Strategy Agent (Claude, tool-use) analyzes the show and proposes audience segments and framing hypotheses.
3. Creative Agent (Claude, tool-use) generates ad copy variants for each hypothesis, constrained by evidence.
4. Producer reviews and approves experiments via the dashboard.
5. Producer manually runs ads on platforms using the system's output (copy, UTMs, targeting specs).
6. Producer inputs observation data (spend, clicks, purchases) back into the system.
7. Decision Engine applies deterministic Scale/Hold/Kill rules.
8. Memo Writer Agent (Claude, tool-use) produces a one-page summary.
9. Knowledge base captures what worked and failed, feeding the next cycle.

### Tech Stack

- **Backend**: Python, FastAPI, hexagonal architecture, SQLite (SQLAlchemy ORM)
- **Frontend**: Next.js, React, shadcn/ui, Tailwind CSS
- **LLM**: Claude API with native tool use for Strategy, Creative, and Memo agents
- **Artifacts**: JSONL event log, per-run JSON/Markdown files on disk

---

## Backend Architecture

### Package Layout

```
src/
  growth/
    domain/
      models.py          # Frozen dataclasses: Show, Experiment, Observation, Decision, etc.
      events.py          # Domain event types
      policies.py        # Scale/Hold/Kill rules, confidence scoring, budget caps
    ports/
      strategy.py        # StrategyPlannerPort
      creative.py        # CreativeGeneratorPort
      execution.py       # CampaignExecutorPort
      observation.py     # ObservationCollectorPort
      decision.py        # DecisionPolicyPort
      memo.py            # MemoWriterPort
      persistence.py     # Repository ports for all entities
      events.py          # EventLogPort
    adapters/
      llm/               # Claude-powered strategy, creative, memo adapters
      persistence/       # SQLAlchemy repos, JSONL event log
      ingest/            # Manual CSV/JSON observation parser
      execution/         # Manual execution adapter (outputs bundles)
    app/
      container.py       # Dependency wiring
      api/               # FastAPI routes
        shows.py
        experiments.py
        observations.py
        decisions.py
        memos.py
        approvals.py
      services/          # Application-layer orchestration
        cycle_runner.py   # Orchestrates a full experiment cycle
        decision_service.py
```

### Design Decisions

- **Domain is pure.** `policies.py` contains all Scale/Hold/Kill logic as plain functions operating on domain models. No LLM, no DB, no IO.
- **Ports are Python Protocols.** Each port defines a contract. Adapters implement it. The container wires them together.
- **LLM adapters are constrained.** Agent outputs are parsed into Pydantic models with validation. Invalid outputs are rejected and logged.
- **The API layer is thin.** FastAPI routes call application services. Routes handle HTTP concerns only.

---

## LLM Agent Design

Each agent runs as a Claude tool-use loop: the agent receives a goal, has access to a set of tools, and iterates until it produces structured output. Direct Claude API with tool use, no framework.

### Strategy Agent

**Goal**: Propose 3-5 experiment frames for the current cycle.

**Tools**:

| Tool | Purpose |
|------|---------|
| `query_knowledge_base` | Search past experiments by show, city, genre, segment. Returns outcomes and decisions |
| `get_show_details` | Current ticket velocity, capacity, sales by phase |
| `get_budget_status` | Remaining budget, current phase caps, active experiment spend |
| `get_active_experiments` | What's already running, to avoid duplicating segments or angles |

**Output**: List of `FramePlan` objects containing: target audience segment definition, framing hypothesis, evidence references, suggested channels and budget range, risk notes.

**Constraints**: Every hypothesis must cite evidence. Number of plans capped at 3-5 per cycle. Max 10 tool-use turns.

### Creative Agent

**Goal**: Generate ad variants for a frame plan on specified platforms.

**Tools**:

| Tool | Purpose |
|------|---------|
| `get_frame_details` | The hypothesis, promise, evidence refs, target segment |
| `get_past_creative` | Successful creative from past experiments for similar segments or frames |
| `get_platform_constraints` | Character limits, format requirements, prohibited content per platform |
| `validate_variant` | Check a draft variant against constraints before final submission |

**Output**: List of `CreativeVariantDraft` objects per platform, each with hook, body, CTA, and a constraints_passed flag.

**Constraints**: Copy must align with the frame's hypothesis. No claims unsupported by evidence. Max 10 tool-use turns.

### Memo Writer Agent

**Goal**: Write the producer memo for a completed cycle.

**Tools**:

| Tool | Purpose |
|------|---------|
| `get_cycle_experiments` | All experiments in this cycle with their status |
| `get_observations` | Observation data for any experiment |
| `get_decisions` | Decision outcomes with rationale and metrics |
| `compute_aggregate_metrics` | CAC, total spend, total attributed purchases, budget efficiency |

**Output**: Markdown memo with required sections (What worked, What failed, Cost per seat, Next 3 tests, Policy exceptions) plus `memo.json` sidecar.

### Agent Guardrails

- Each agent call has: 1 retry on parse failure, a timeout, token budget tracking, and full conversation logging to the run artifact directory.
- If an agent fails after retry, the cycle halts and the producer is notified via the dashboard.

---

## Decision Engine

Entirely deterministic, no LLM. Lives in `domain/policies.py` as pure functions.

### Evaluation Flow

```
1. Check guardrails (refund_rate, complaint_rate, negative_comment_rate)
   → Any violation → KILL

2. Check evidence minimums (≥2 windows, ≥150 clicks, ≥5 purchases)
   → Not met → can only HOLD or KILL

3. Check kill conditions:
   - Budget exhausted with 0 purchases → KILL
   - Conversion rate < 50% of baseline after min clicks → KILL

4. Check scale conditions (all must be true):
   - Evidence minimums met
   - incremental_tickets_per_100usd > 0
   - CAC ≤ baseline_CAC × 0.85
   - Guardrails within limits
   → All true → SCALE

5. Otherwise → HOLD
```

### Confidence Score

`confidence = 0.4 × sample_sufficiency + 0.4 × lift_strength + 0.2 × window_consistency`

Each component normalized to [0, 1]. Accompanies the decision but does not change it. The decision is rule-based; confidence is informational for the producer.

### Baseline Computation

Phase-aware snapshots at experiment creation:
- `T-60..T-22`: Full-window average daily ticket velocity
- `T-21..T-8`: Last-7-day velocity
- `T-7..T-0`: Last-3-day velocity

### Budget Policy

Cycle runner enforces caps before experiments are created:
- **Discovery**: 5-10% of remaining paid budget
- **Validation**: 15-20%
- **Scale**: Up to 40%, only for experiments with a prior SCALE decision

The producer sets total paid budget per show. The system tracks cumulative spend.

### Cadence

- `T-60..T-22`: Weekly cycle
- `T-21..T-8`: Every 48 hours
- `T-7..T-0`: Daily cycle with stricter kill thresholds

### Thresholds Config

All thresholds loaded from `config/policy.toml`:
- Evidence minimums (windows, clicks, purchases)
- Scale/Kill metric thresholds
- Guardrail hard limits (refund rate, complaint rate, negative comment rate)
- Confidence scoring weights
- Budget allocation percentages per stage

---

## Frontend Dashboard

Next.js app with shadcn/ui components and Tailwind CSS. API client auto-generated from FastAPI's OpenAPI spec.

### Shows View

- List of all shows with key stats: date, venue, tickets sold/total, active experiments
- Create new show form
- Click into a show for its experiment history and current cycle

### Experiment Cycle View (per show)

- Current cycle status: phase (Discovery/Validation/Scale), time-to-show, budget remaining
- Strategy proposals from the LLM with audience segments and hypotheses
- Creative variants grouped by frame, with platform-specific previews
- **Approval panel**: review each experiment bundle (segment, creative, channel, budget) and approve/reject with notes
- Active experiments with status indicators

### Observation Ingest View

- Per-experiment form for metrics: spend, impressions, clicks, sessions, checkouts, purchases, revenue, refunds
- CSV upload for bulk ingest
- Validation feedback for missing or out-of-range values
- UTM builder generating correct tracking URLs per experiment/variant

### Results and Memos View

- Decision outcomes per experiment: Scale/Hold/Kill with confidence, rationale, metrics snapshot
- Producer memo rendered as formatted Markdown
- Trend charts: CAC over time, ticket velocity, experiment success rate
- Knowledge base: searchable history of past experiments and outcomes

---

## Data Model

SQLite via SQLAlchemy ORM. Schema mirrors the spec's Postgres model with these tables:
- `shows`
- `audience_segments`
- `creative_frames`
- `creative_variants`
- `experiments`
- `experiment_variants`
- `observations`
- `decisions`
- `producer_memos`

Full schema in [spec-first-draft.md](../designs/spec-first-draft.md). SQLAlchemy models map 1:1, making future Postgres migration a config change.

---

## Events and Artifacts

### Event Log

All domain events follow the envelope contract:
- `event_id`, `event_type`, `occurred_at`, `show_id`, `experiment_id` (nullable), `actor`, `payload`

Canonical events: `experiment.created`, `experiment.approval_requested`, `experiment.approved`, `experiment.launched`, `observation.window_closed`, `decision.issued`, `memo.published`

Stored as append-only JSONL at `data/events.jsonl`.

### Per-Run Artifacts

```
data/runs/<run_id>/
  plan.json          # Strategy agent output
  approvals.jsonl    # Approval/rejection records
  observations.jsonl # Raw observation data per window
  decision.json      # Decision engine output with metrics snapshot
  memo.md            # Producer memo
  memo.json          # Machine-readable sidecar
```

### Observability

- FastAPI middleware logs request timing
- Each pipeline stage emits timing metadata to the run artifact
- LLM calls log prompt tokens, completion tokens, latency, and full conversation
- Failed LLM parses logged with raw response

---

## UTM and Attribution

### UTM Taxonomy

- `utm_source`: platform (`meta`, `instagram`, `tiktok`, `email`, `youtube`)
- `utm_medium`: format (`paid_social`, `organic_social`, `creator`, `email`)
- `utm_campaign`: `show_{city}_{yyyymmdd}`
- `utm_content`: `exp_{experiment_id}_var_{variant_id}`
- `utm_term`: `segment_{segment_id}`

### Attribution v1

- **Operational metric**: Last-click UTM purchase attribution
- **Sanity check**: Blended total ticket trend for the same window
- Decision policy uses operational metric. Blended metric can only downgrade confidence.

---

## Human Approval Workflow

Approval is mandatory before:
- Any public creative posting
- Any paid spend allocation or cap increase
- Any policy override on Scale/Hold/Kill

Approval request payload includes: segment definition, frame hypothesis, exact creative copy, channel and budget cap, success and kill criteria.

The dashboard presents pending approvals with full context. Producer approves or rejects with optional notes. All approvals are recorded as artifacts with timestamps.

---

## Testing Strategy

### Unit Tests (pytest, no external dependencies)

- Decision policy: parameterized tests covering every Scale/Hold/Kill path and edge case
- Confidence scoring normalization
- Budget cap enforcement
- Baseline computation per phase
- Domain model validation and state transitions
- UTM generation and parsing

### Integration Tests (with SQLite test DB)

- Full cycle: create show → strategy → creative → approve → add observations → decision → memo
- Replay determinism: load stored artifacts, re-run decision engine, assert same output
- API endpoint tests via FastAPI test client

### LLM Adapter Tests (with recorded fixtures)

- Strategy agent produces valid `FramePlan` objects from fixture inputs
- Creative agent produces valid `CreativeVariantDraft` objects
- Memo writer produces valid Markdown with required sections
- Constraint violation handling

### Simulation Tests

- Synthetic outcomes to validate scale/kill behavior under noise
- Edge case: low-traffic shows with sparse conversions

---

## Rollout Phases

### Phase 0: Core Domain

Domain models, decision engine, SQLite persistence, JSONL event log. CLI scripts to test the core logic with manual data.

### Phase 1: API Layer

FastAPI API, observation ingest endpoints, decision service. The decision loop works via API calls.

### Phase 2: LLM Agents

Claude tool-use adapters for Strategy, Creative, and Memo agents. Full cycle works end-to-end via API.

### Phase 3: Dashboard

Next.js dashboard. Producer manages everything through the web UI.

### Phase 4: Integrations

API adapters for ad platforms (Meta first), ticketing integrations, trend charts.

---

## Open Questions

- Which channels are in MVP scope (Meta, Instagram, TikTok, Email)?
- What is the authoritative ticketing source for purchase events?
- What is the acceptable conversion lag window (same-day, 7-day click, 24-hour view)?
- Which guardrail thresholds are business-approved for refunds and complaints?
