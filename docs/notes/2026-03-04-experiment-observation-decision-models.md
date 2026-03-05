# Domain Models: Experiment, Observation, Decision

*Generated 2026-03-04 from source at commit `1118c43`*

---

## 1. Enums

```python
# src/growth/domain/models.py

class ExperimentStatus(Enum):
    DRAFT            = "draft"
    ACTIVE           = "active"
    AWAITING_APPROVAL = "awaiting_approval"
    DECIDED          = "decided"

class DecisionAction(Enum):
    SCALE = "scale"
    HOLD  = "hold"
    KILL  = "kill"
```

Status is stored as a plain `String(50)` in the DB (no native DB enum). The ORM layer does **not** validate values at write time — only the Pydantic schema and domain code enforce the enum.

---

## 2. Domain Dataclasses

```python
# src/growth/domain/models.py  (all frozen=True)

@dataclass(frozen=True)
class Experiment:
    experiment_id:      UUID
    show_id:            UUID
    segment_id:         UUID
    frame_id:           UUID
    channel:            str
    objective:          str
    budget_cap_cents:   int
    status:             ExperimentStatus
    start_time:         datetime | None
    end_time:           datetime | None
    baseline_snapshot:  dict[str, Any]   # JSON blob
    cycle_id:           UUID | None = None   # creation cycle; does NOT gate active use

@dataclass(frozen=True)
class Observation:
    observation_id:         UUID
    experiment_id:          UUID
    window_start:           datetime
    window_end:             datetime
    spend_cents:            int
    impressions:            int
    clicks:                 int
    sessions:               int
    checkouts:              int
    purchases:              int
    revenue_cents:          int
    refunds:                int
    refund_cents:           int
    complaints:             int
    negative_comment_rate:  float | None   # [0.0, 1.0]
    attribution_model:      str
    raw_json:               dict[str, Any]   # NOT exposed in API response

@dataclass(frozen=True)
class Decision:
    decision_id:       UUID
    experiment_id:     UUID
    action:            DecisionAction
    confidence:        float
    rationale:         str
    policy_version:    str
    metrics_snapshot:  dict[str, Any]   # point-in-time metrics used for eval
```

---

## 3. DB Tables (SQLAlchemy ORM)

### `experiments`

| Column | Type | Notes |
|---|---|---|
| `experiment_id` | `String(36)` PK | UUID as string |
| `show_id` | `String(36)` FK → `shows` | |
| `segment_id` | `String(36)` | Not FK-constrained |
| `frame_id` | `String(36)` | Not FK-constrained |
| `channel` | `String(50)` | |
| `objective` | `String(100)` | |
| `budget_cap_cents` | `Integer` | |
| `status` | `String(50)` | Raw string; no DB enum |
| `start_time` | `DateTime` nullable | Set on launch |
| `end_time` | `DateTime` nullable | Set on decide |
| `baseline_snapshot` | `JSON` | |
| `cycle_id` | `String(36)` FK → `cycles` nullable | Origin cycle only |

Relationships: `→ show` (many-to-one), `→ observations` (one-to-many, cascade delete), `→ decisions` (one-to-many, cascade delete)

### `observations`

| Column | Type | Notes |
|---|---|---|
| `observation_id` | `String(36)` PK | |
| `experiment_id` | `String(36)` FK → `experiments` | |
| `window_start` | `DateTime` | |
| `window_end` | `DateTime` | |
| `spend_cents` | `Integer` | |
| `impressions` | `Integer` | |
| `clicks` | `Integer` | |
| `sessions` | `Integer` | |
| `checkouts` | `Integer` | |
| `purchases` | `Integer` | |
| `revenue_cents` | `Integer` | |
| `refunds` | `Integer` | |
| `refund_cents` | `Integer` | |
| `complaints` | `Integer` | |
| `negative_comment_rate` | `Float` nullable | |
| `attribution_model` | `String(50)` | |
| `raw_json` | `JSON` | Stored but never returned via API |

### `decisions`

| Column | Type | Notes |
|---|---|---|
| `decision_id` | `String(36)` PK | |
| `experiment_id` | `String(36)` FK → `experiments` | |
| `action` | `String(20)` | `scale\|hold\|kill` |
| `confidence` | `Float` | |
| `rationale` | `String(500)` | |
| `policy_version` | `String(20)` | |
| `metrics_snapshot` | `JSON` | Point-in-time copy of metrics used |

---

## 4. Pydantic Schemas (API contract)

### Request

```python
# ExperimentCreate — POST /api/experiments
show_id:            UUID
cycle_id:           UUID          # required at creation
segment_id:         UUID
frame_id:           UUID
channel:            str  (1–50 chars)
objective:          str  (default "ticket_sales", max 100)
budget_cap_cents:   int  (> 0)
baseline_snapshot:  dict  (default {})

# ObservationCreate — POST /api/observations
experiment_id:          UUID
window_start:           datetime
window_end:             datetime   # must be > window_start
spend_cents:            int  (≥ 0)
impressions:            int  (≥ 0)
clicks:                 int  (≥ 0)
sessions:               int  (≥ 0)
checkouts:              int  (≥ 0)
purchases:              int  (≥ 0)
revenue_cents:          int  (≥ 0)
refunds:                int  (≥ 0)
refund_cents:           int  (≥ 0)
complaints:             int  (≥ 0)
negative_comment_rate:  float | None  ([0.0, 1.0])
attribution_model:      str  (default "last_click_utm", max 50)

# ObservationBulkCreate — POST /api/observations/bulk
observations: list[ObservationCreate]  (min 1)

# Decision has no Create schema — created only via evaluate endpoint
```

### Response

```python
# ExperimentResponse
experiment_id, show_id, cycle_id, segment_id, frame_id,
channel, objective, budget_cap_cents,
status: str,        # enum .value (not the Enum itself)
start_time, end_time, baseline_snapshot

# ObservationResponse  (raw_json is EXCLUDED)
observation_id, experiment_id, window_start, window_end,
spend_cents, impressions, clicks, sessions, checkouts,
purchases, revenue_cents, refunds, refund_cents,
complaints, negative_comment_rate, attribution_model

# DecisionResponse
decision_id, experiment_id,
action: str,        # "scale"|"hold"|"kill"
confidence, rationale, policy_version, metrics_snapshot

# ExperimentMetrics (derived — not a DB row)
experiment_id,
total_spend_cents, total_impressions, total_clicks,
total_purchases, total_revenue_cents, windows_count,
ctr, cpc_cents, cpa_cents, roas, conversion_rate: float | None,
evidence_sufficient: bool
```

---

## 5. API Endpoints

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/experiments` | Create; status starts `draft` |
| `GET` | `/api/experiments?show_id=` | List all for a show |
| `GET` | `/api/experiments/{id}` | Single |
| `POST` | `/api/experiments/{id}/launch` | `draft\|awaiting_approval` → `active`; sets `start_time` |
| `POST` | `/api/experiments/{id}/request-reapproval` | `draft` → `awaiting_approval` |
| `GET` | `/api/experiments/{id}/metrics` | Computed aggregation over observations |
| `POST` | `/api/observations` | Create single |
| `POST` | `/api/observations/bulk` | Bulk ingest |
| `GET` | `/api/observations?experiment_id=` | List for an experiment |
| `POST` | `/api/decisions/evaluate/{experiment_id}` | Run decision engine; sets exp status → `decided` + `end_time` |
| `GET` | `/api/decisions?experiment_id=` | List for an experiment |

---

## 6. Frontend Query Layer

All types are pulled from the generated OpenAPI schema (`shared/api/generated/schema.ts`).

### Query keys (`shared/queryKeys.ts`)

```ts
experimentKeys.list(showId, cycleId?)  // ['experiments','list', showId] or [..., cycleId]
experimentKeys.detail(experimentId)

observationKeys.list(experimentId)     // ['observations','list', experimentId]

decisionKeys.list(experimentId)        // ['decisions','list', experimentId]
```

Note: `experimentKeys` supports an optional `cycleId` param in the key factory, but the actual API only accepts `show_id` — there is **no server-side cycle filter**. Cycle filtering would need to happen client-side.

### Hooks

```ts
// features/experiments/queries.ts
useExperiments(showId: string)
// → GET /api/experiments?show_id={showId}
// enabled when showId is truthy; no cycle-level filter

// features/observations/queries.ts
useObservations(experimentId: string)
// → GET /api/observations?experiment_id={experimentId}
// enabled when experimentId is truthy

// features/decisions/queries.ts
useDecisions(experimentId: string)
// → GET /api/decisions?experiment_id={experimentId}
// enabled when experimentId is truthy
```

No mutations are currently implemented in the frontend for any of these three domains — `create`, `launch`, `evaluate` have no corresponding `useMutation` hooks yet.

---

## 7. Notable Gaps / Risks

| Item | Detail |
|---|---|
| No cycle filter on `GET /api/experiments` | Server returns **all** experiments for a show; cycle scoping is client responsibility |
| `raw_json` silently dropped | Stored in DB, never surfaced in `ObservationResponse` |
| `status` stored as raw string | No DB-level constraint; enum enforcement is Pydantic/domain only |
| `segment_id` / `frame_id` on Experiment | Not foreign-key constrained at DB level |
| No mutation hooks | `launch`, `request-reapproval`, `evaluate`, `create` have no frontend hook implementations |
| `ExperimentMetrics` is ephemeral | Computed on every request; not persisted |
