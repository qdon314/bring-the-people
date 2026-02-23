# API Reference

Complete reference for the Bring The People Growth API.

Base URL: `http://localhost:8000/api`

---

## Authentication

Currently, the API does not require authentication. This is suitable for local development and trusted internal networks.

---

## Shows

### `POST /shows`

Create a new show.

**Request Body**:
```json
{
  "artist_name": "string (1-255 chars)",
  "city": "string (1-100 chars)",
  "venue": "string (1-255 chars)",
  "show_time": "datetime (ISO 8601)",
  "timezone": "string (1-50 chars)",
  "capacity": "integer > 0",
  "tickets_total": "integer >= 0",
  "tickets_sold": "integer >= 0",
  "currency": "string, 3 chars, default: USD"
}
```

**Response (201)**:
```json
{
  "show_id": "uuid",
  "artist_name": "string",
  "city": "string",
  "venue": "string",
  "show_time": "datetime",
  "timezone": "string",
  "capacity": 200,
  "tickets_total": 200,
  "tickets_sold": 0,
  "currency": "USD"
}
```

**Example**:
```bash
curl -X POST http://localhost:8000/api/shows \
  -H "Content-Type: application/json" \
  -d '{
    "artist_name": "The Midnight",
    "city": "Austin",
    "venue": "The Parish",
    "show_time": "2026-05-01T20:00:00Z",
    "timezone": "America/Chicago",
    "capacity": 200,
    "tickets_total": 200,
    "tickets_sold": 0
  }'
```

---

### `GET /shows`

List all shows.

**Response (200)**:
```json
[
  {
    "show_id": "uuid",
    "artist_name": "string",
    ...
  }
]
```

---

### `GET /shows/{show_id}`

Get a specific show.

**Response (200)**: Show object

**Response (404)**: `{"detail": "Show not found"}`

---

### `PATCH /shows/{show_id}`

Update a show (partial update).

**Request Body**: Any subset of show fields

**Response (200)**: Updated show object

---

## Experiments

### `POST /experiments`

Create a new experiment.

**Request Body**:
```json
{
  "show_id": "uuid",
  "segment_id": "uuid",
  "frame_id": "uuid",
  "channel": "string (1-50 chars)",
  "objective": "string (default: ticket_sales)",
  "budget_cap_cents": "integer > 0",
  "baseline_snapshot": "object (optional)"
}
```

**Response (201)**:
```json
{
  "experiment_id": "uuid",
  "show_id": "uuid",
  "segment_id": "uuid",
  "frame_id": "uuid",
  "channel": "meta",
  "objective": "ticket_sales",
  "budget_cap_cents": 5000,
  "status": "draft",
  "start_time": null,
  "end_time": null,
  "baseline_snapshot": {}
}
```

---

### `GET /experiments?show_id={show_id}`

List experiments for a show.

**Query Parameters**:
- `show_id` (required): UUID of the show

**Response (200)**: Array of experiment objects

---

### `GET /experiments/{experiment_id}`

Get a specific experiment.

**Response (200)**: Experiment object

**Response (404)**: `{"detail": "Experiment not found"}`

---

### `POST /experiments/{experiment_id}/submit`

Submit a draft experiment for approval.

**Transitions**: `draft` → `awaiting_approval`

**Response (200)**: Updated experiment

**Response (409)**: Cannot submit from current status

---

### `POST /experiments/{experiment_id}/approve`

Approve or reject an experiment awaiting approval.

**Request Body**:
```json
{
  "approved": true  // or false
}
```

**Transitions**:
- `approved: true` → `approved`
- `approved: false` → `draft`

**Response (200)**: Updated experiment

---

### `POST /experiments/{experiment_id}/start`

Start an approved experiment.

**Transitions**: `approved` → `running`

Sets `start_time` to current timestamp.

**Response (200)**: Updated experiment

---

## Observations

### `POST /observations`

Add a single observation window to an experiment.

**Request Body**:
```json
{
  "experiment_id": "uuid",
  "window_start": "datetime (ISO 8601)",
  "window_end": "datetime (ISO 8601)",
  "spend_cents": "integer >= 0",
  "impressions": "integer >= 0",
  "clicks": "integer >= 0",
  "sessions": "integer >= 0",
  "checkouts": "integer >= 0",
  "purchases": "integer >= 0",
  "revenue_cents": "integer >= 0",
  "refunds": "integer >= 0",
  "refund_cents": "integer >= 0",
  "complaints": "integer >= 0",
  "negative_comment_rate": "float 0-1 (optional)",
  "attribution_model": "string (default: last_click_utm)"
}
```

**Validation**: `window_end` must be after `window_start`

**Response (201)**: Observation object

**Example**:
```bash
curl -X POST http://localhost:8000/api/observations \
  -H "Content-Type: application/json" \
  -d '{
    "experiment_id": "...",
    "window_start": "2026-04-01T00:00:00Z",
    "window_end": "2026-04-02T00:00:00Z",
    "spend_cents": 2500,
    "impressions": 10000,
    "clicks": 200,
    "sessions": 180,
    "checkouts": 20,
    "purchases": 8,
    "revenue_cents": 32000,
    "refunds": 0,
    "refund_cents": 0,
    "complaints": 0
  }'
```

---

### `POST /observations/bulk`

Add multiple observations at once.

**Request Body**:
```json
{
  "observations": [
    { /* ObservationCreate */ },
    { /* ObservationCreate */ }
  ]
}
```

**Response (201)**: Array of observation objects

---

### `GET /observations?experiment_id={experiment_id}`

List observations for an experiment.

**Query Parameters**:
- `experiment_id` (required): UUID of the experiment

**Response (200)**: Array of observation objects

---

## Decisions

### `POST /decisions/evaluate/{experiment_id}`

Evaluate an experiment and make a decision.

**Process**:
1. Aggregate all observations for the experiment
2. Calculate derived metrics (conversion rate, CAC, refund rate)
3. Apply decision hierarchy (guardrails → kill → evidence → scale)
4. Persist decision and emit event

**Response (200)**:
```json
{
  "decision_id": "uuid",
  "experiment_id": "uuid",
  "action": "scale",  // or "hold", "kill"
  "confidence": 0.85,
  "rationale": "Scale conditions met: CAC $12.50 vs baseline $15.00",
  "policy_version": "v1",
  "metrics_snapshot": {
    "cac_cents": 1250,
    "baseline_cac_cents": 1500,
    ...
  }
}
```

---

### `GET /decisions?experiment_id={experiment_id}`

List decisions for an experiment.

**Query Parameters**:
- `experiment_id` (required): UUID of the experiment

**Response (200)**: Array of decision objects

---

## Strategy Agent

### `POST /strategy/{show_id}/run`

Run the Strategy Agent to propose segments and frames for a show.

**Process**:
1. Validate show exists
2. Initialize Claude agent with tools
3. Agent queries show details, budget, active experiments, knowledge base
4. Agent produces 3-5 FramePlans with hypotheses and evidence
5. Persist segments and frames to database
6. Write artifacts and emit event

**Response (200)**:
```json
{
  "run_id": "uuid",
  "segment_ids": ["uuid", "uuid", "uuid"],
  "frame_ids": ["uuid", "uuid", "uuid"],
  "reasoning_summary": "Focused on young professionals interested in synthwave...",
  "turns_used": 7,
  "total_input_tokens": 4500,
  "total_output_tokens": 1200
}
```

**Response (404)**: `{"detail": "Show not found"}`

**Response (502)**: Agent failure (turn limit, parse error, API error)

**Example**:
```bash
curl -X POST http://localhost:8000/api/strategy/{show_id}/run
```

---

## Error Responses

### Standard Error Format

```json
{
  "detail": "Error message"
}
```

### Status Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| 400 | Bad Request | Invalid JSON, validation error |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Invalid state transition |
| 422 | Unprocessable Entity | Pydantic validation error |
| 502 | Bad Gateway | LLM agent failure |

### Conflict Examples

```json
// Trying to submit non-draft experiment
{
  "detail": "Cannot submit from status running"
}

// Trying to start non-approved experiment
{
  "detail": "Cannot start from status draft"
}
```

---

## Data Types

### Show

```json
{
  "show_id": "uuid",
  "artist_name": "string",
  "city": "string",
  "venue": "string",
  "show_time": "datetime",
  "timezone": "string",
  "capacity": "integer",
  "tickets_total": "integer",
  "tickets_sold": "integer",
  "currency": "string"
}
```

### Experiment

```json
{
  "experiment_id": "uuid",
  "show_id": "uuid",
  "segment_id": "uuid",
  "frame_id": "uuid",
  "channel": "string",
  "objective": "string",
  "budget_cap_cents": "integer",
  "status": "draft | awaiting_approval | approved | running | completed | stopped | archived",
  "start_time": "datetime | null",
  "end_time": "datetime | null",
  "baseline_snapshot": "object"
}
```

### Observation

```json
{
  "observation_id": "uuid",
  "experiment_id": "uuid",
  "window_start": "datetime",
  "window_end": "datetime",
  "spend_cents": "integer",
  "impressions": "integer",
  "clicks": "integer",
  "sessions": "integer",
  "checkouts": "integer",
  "purchases": "integer",
  "revenue_cents": "integer",
  "refunds": "integer",
  "refund_cents": "integer",
  "complaints": "integer",
  "negative_comment_rate": "float | null",
  "attribution_model": "string"
}
```

### Decision

```json
{
  "decision_id": "uuid",
  "experiment_id": "uuid",
  "action": "scale | hold | kill",
  "confidence": "float (0-1)",
  "rationale": "string",
  "policy_version": "string",
  "metrics_snapshot": "object"
}
```

---

## Complete Workflow Example

```bash
#!/bin/bash

BASE="http://localhost:8000/api"

# 1. Create show
SHOW=$(curl -s -X POST "$BASE/shows" \
  -H "Content-Type: application/json" \
  -d '{
    "artist_name": "The Midnight",
    "city": "Austin",
    "venue": "The Parish",
    "show_time": "2026-05-01T20:00:00Z",
    "timezone": "America/Chicago",
    "capacity": 200,
    "tickets_total": 200,
    "tickets_sold": 0
  }')
SHOW_ID=$(echo $SHOW | jq -r '.show_id')
echo "Created show: $SHOW_ID"

# 2. Run strategy agent to get segments and frames
STRATEGY=$(curl -s -X POST "$BASE/strategy/$SHOW_ID/run")
echo "Strategy complete: $(echo $STRATEGY | jq -r '.reasoning_summary')"
SEGMENT_ID=$(echo $STRATEGY | jq -r '.segment_ids[0]')
FRAME_ID=$(echo $STRATEGY | jq -r '.frame_ids[0]')

# 3. Create experiment
EXPERIMENT=$(curl -s -X POST "$BASE/experiments" \
  -H "Content-Type: application/json" \
  -d "{
    \"show_id\": \"$SHOW_ID\",
    \"segment_id\": \"$SEGMENT_ID\",
    \"frame_id\": \"$FRAME_ID\",
    \"channel\": \"meta\",
    \"budget_cap_cents\": 5000,
    \"baseline_snapshot\": {\"cac_cents\": 800, \"conversion_rate\": 0.02}
  }")
EXP_ID=$(echo $EXPERIMENT | jq -r '.experiment_id')
echo "Created experiment: $EXP_ID"

# 4. Submit, approve, start
curl -s -X POST "$BASE/experiments/$EXP_ID/submit" > /dev/null
curl -s -X POST "$BASE/experiments/$EXP_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{"approved": true}' > /dev/null
curl -s -X POST "$BASE/experiments/$EXP_ID/start" > /dev/null
echo "Experiment started"

# 5. Add observations (daily)
curl -s -X POST "$BASE/observations" \
  -H "Content-Type: application/json" \
  -d "{
    \"experiment_id\": \"$EXP_ID\",
    \"window_start\": \"2026-04-01T00:00:00Z\",
    \"window_end\": \"2026-04-02T00:00:00Z\",
    \"spend_cents\": 2500,
    \"impressions\": 10000,
    \"clicks\": 200,
    \"sessions\": 180,
    \"checkouts\": 20,
    \"purchases\": 8,
    \"revenue_cents\": 32000,
    \"refunds\": 0,
    \"refund_cents\": 0,
    \"complaints\": 0
  }" > /dev/null

# 6. Evaluate
curl -s -X POST "$BASE/decisions/evaluate/$EXP_ID" | jq .
```

---

## OpenAPI/Swagger

When the server is running, interactive documentation is available at:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
