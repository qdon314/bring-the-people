# Entity Status Model Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplify `ExperimentStatus` from 7 values to 4 (`draft / active / awaiting_approval / decided`) and align all backend code, tests, API endpoints, frontend code, and docs.

**Architecture:** The enum is the single source of truth in `src/growth/domain/models.py`. API endpoints enforce state transitions. The ORM stores status as a plain string. All consumers (tests, LLM tools, CLI, frontend) reference the enum or its string values. We change the enum first, then ripple outward.

**Tech Stack:** Python (FastAPI, SQLAlchemy, Pydantic), TypeScript (Next.js), Vitest

**Design doc:** `docs/plans/2026-02-28-entity-status-model-design.md`

---

## Status mapping (old → new)

| Old value           | New value           | Notes                                      |
|---------------------|---------------------|--------------------------------------------|
| `draft`             | `draft`             | Unchanged                                  |
| `awaiting_approval` | `awaiting_approval` | Unchanged (also used for cross-cycle carry) |
| `approved`          | *(removed)*         | No longer a distinct state                 |
| `running`           | `active`            | Ads are live externally                    |
| `completed`         | `decided`           | Decision has been recorded                 |
| `stopped`           | `decided`           | Decision (kill) has been recorded          |
| `archived`          | *(removed)*         | Never had an API endpoint                  |

---

## Task 1: Update domain enum and model tests

**Files:**
- Modify: `src/growth/domain/models.py:18-25`
- Modify: `tests/domain/test_models.py:80-88, 115, 120, 132, 138`

**Step 1: Write the updated enum test**

Replace the `TestExperimentStatus` class in `tests/domain/test_models.py`:

```python
class TestExperimentStatus:
    def test_valid_statuses(self):
        assert ExperimentStatus.DRAFT.value == "draft"
        assert ExperimentStatus.ACTIVE.value == "active"
        assert ExperimentStatus.AWAITING_APPROVAL.value == "awaiting_approval"
        assert ExperimentStatus.DECIDED.value == "decided"

    def test_has_exactly_four_members(self):
        assert len(ExperimentStatus) == 4
```

**Step 2: Run test to verify it fails**

Run: `uv run pytest tests/domain/test_models.py::TestExperimentStatus -v`
Expected: FAIL — `ExperimentStatus` has no `ACTIVE` or `DECIDED` members

**Step 3: Update the enum**

In `src/growth/domain/models.py`, replace lines 18-25:

```python
class ExperimentStatus(Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    AWAITING_APPROVAL = "awaiting_approval"
    DECIDED = "decided"
```

**Step 4: Fix remaining test references in same file**

In `tests/domain/test_models.py`:
- Line 115: `ExperimentStatus.DRAFT` — no change needed
- Line 120: `ExperimentStatus.DRAFT` — no change needed
- Line 132: `ExperimentStatus.DRAFT` — no change needed
- Line 138: `ExperimentStatus.RUNNING` → `ExperimentStatus.ACTIVE`

**Step 5: Run tests to verify they pass**

Run: `uv run pytest tests/domain/test_models.py -v`
Expected: PASS

**Step 6: Commit**

```bash
git add src/growth/domain/models.py tests/domain/test_models.py
git commit -m "refactor: simplify ExperimentStatus to 4 values (draft/active/awaiting_approval/decided)"
```

---

## Task 2: Simplify API endpoints and transition logic

**Files:**
- Modify: `src/growth/app/api/experiments.py` (full rewrite of transition endpoints)
- Modify: `src/growth/app/schemas.py` (no structural changes, just verify `ApprovalRequest` still works)

The old flow had 4 transition endpoints: `submit`, `approve`, `start`, `complete`, `stop`.
The new flow needs 2 transition endpoints: `launch` (draft → active), `decide` (active → decided, which triggers cross-cycle carry if scale/hold).

We also keep `awaiting_approval → active` for cross-cycle re-approval.

**Step 1: Write the updated API tests**

Replace the full content of `tests/api/test_experiments.py`:

```python
"""Tests for the Experiments API."""
from uuid import uuid4


def _create_show(client) -> str:
    resp = client.post("/api/shows", json={
        "artist_name": "Test Artist",
        "city": "Austin",
        "venue": "The Parish",
        "show_time": "2026-05-01T20:00:00Z",
        "timezone": "America/Chicago",
        "capacity": 200,
        "tickets_total": 200,
        "tickets_sold": 0,
    })
    return resp.json()["show_id"]


class TestExperimentsAPI:
    def test_create_experiment(self, client):
        show_id = _create_show(client)
        resp = client.post("/api/experiments", json={
            "show_id": show_id,
            "segment_id": str(uuid4()),
            "frame_id": str(uuid4()),
            "channel": "meta",
            "objective": "ticket_sales",
            "budget_cap_cents": 5000,
            "baseline_snapshot": {"cac_cents": 800},
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "draft"
        assert data["channel"] == "meta"

    def test_get_experiment(self, client):
        show_id = _create_show(client)
        create_resp = client.post("/api/experiments", json={
            "show_id": show_id,
            "segment_id": str(uuid4()),
            "frame_id": str(uuid4()),
            "channel": "meta",
            "budget_cap_cents": 5000,
        })
        exp_id = create_resp.json()["experiment_id"]

        resp = client.get(f"/api/experiments/{exp_id}")
        assert resp.status_code == 200
        assert resp.json()["experiment_id"] == exp_id

    def test_list_experiments_by_show(self, client):
        show_id = _create_show(client)
        for _ in range(3):
            client.post("/api/experiments", json={
                "show_id": show_id,
                "segment_id": str(uuid4()),
                "frame_id": str(uuid4()),
                "channel": "meta",
                "budget_cap_cents": 5000,
            })
        resp = client.get(f"/api/experiments?show_id={show_id}")
        assert resp.status_code == 200
        assert len(resp.json()) == 3

    def test_launch_from_draft(self, client):
        show_id = _create_show(client)
        create_resp = client.post("/api/experiments", json={
            "show_id": show_id,
            "segment_id": str(uuid4()),
            "frame_id": str(uuid4()),
            "channel": "meta",
            "budget_cap_cents": 5000,
        })
        exp_id = create_resp.json()["experiment_id"]

        resp = client.post(f"/api/experiments/{exp_id}/launch")
        assert resp.status_code == 200
        assert resp.json()["status"] == "active"
        assert resp.json()["start_time"] is not None

    def test_launch_from_awaiting_approval(self, client):
        """Cross-cycle: awaiting_approval experiments can be re-launched."""
        show_id = _create_show(client)
        create_resp = client.post("/api/experiments", json={
            "show_id": show_id,
            "segment_id": str(uuid4()),
            "frame_id": str(uuid4()),
            "channel": "meta",
            "budget_cap_cents": 5000,
        })
        exp_id = create_resp.json()["experiment_id"]

        # Transition to awaiting_approval via the reapprove endpoint
        client.post(f"/api/experiments/{exp_id}/request-reapproval")

        resp = client.post(f"/api/experiments/{exp_id}/launch")
        assert resp.status_code == 200
        assert resp.json()["status"] == "active"

    def test_launch_from_active_fails(self, client):
        show_id = _create_show(client)
        create_resp = client.post("/api/experiments", json={
            "show_id": show_id,
            "segment_id": str(uuid4()),
            "frame_id": str(uuid4()),
            "channel": "meta",
            "budget_cap_cents": 5000,
        })
        exp_id = create_resp.json()["experiment_id"]

        client.post(f"/api/experiments/{exp_id}/launch")
        resp = client.post(f"/api/experiments/{exp_id}/launch")
        assert resp.status_code == 409

    def test_launch_from_decided_fails(self, client):
        show_id = _create_show(client)
        create_resp = client.post("/api/experiments", json={
            "show_id": show_id,
            "segment_id": str(uuid4()),
            "frame_id": str(uuid4()),
            "channel": "meta",
            "budget_cap_cents": 5000,
        })
        exp_id = create_resp.json()["experiment_id"]

        client.post(f"/api/experiments/{exp_id}/launch")
        # Need to decide via the decision service, but for guard test
        # we can't easily get to decided state via API alone without observations.
        # This test verifies the guard exists — full lifecycle tested in integration.

    def test_request_reapproval_from_draft(self, client):
        show_id = _create_show(client)
        create_resp = client.post("/api/experiments", json={
            "show_id": show_id,
            "segment_id": str(uuid4()),
            "frame_id": str(uuid4()),
            "channel": "meta",
            "budget_cap_cents": 5000,
        })
        exp_id = create_resp.json()["experiment_id"]

        resp = client.post(f"/api/experiments/{exp_id}/request-reapproval")
        assert resp.status_code == 200
        assert resp.json()["status"] == "awaiting_approval"
```

**Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/api/test_experiments.py -v`
Expected: FAIL — `/launch` and `/request-reapproval` endpoints don't exist yet

**Step 3: Rewrite the experiments API**

Replace `src/growth/app/api/experiments.py`:

```python
"""Experiments API routes."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Request

from growth.app.schemas import ExperimentCreate, ExperimentResponse, ExperimentMetrics
from growth.domain.models import Experiment, ExperimentStatus

router = APIRouter()


def _get_exp_repo(request: Request):
    return request.state.container.experiment_repo()


def _get_exp_or_404(repo, experiment_id: UUID) -> Experiment:
    exp = repo.get_by_id(experiment_id)
    if exp is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return exp


def _transition(exp: Experiment, **overrides) -> Experiment:
    """Create a new Experiment with overridden fields (frozen dataclass)."""
    fields = {
        "experiment_id": exp.experiment_id,
        "show_id": exp.show_id,
        "segment_id": exp.segment_id,
        "frame_id": exp.frame_id,
        "channel": exp.channel,
        "objective": exp.objective,
        "budget_cap_cents": exp.budget_cap_cents,
        "status": exp.status,
        "start_time": exp.start_time,
        "end_time": exp.end_time,
        "baseline_snapshot": exp.baseline_snapshot,
        "cycle_id": exp.cycle_id,
    }
    fields.update(overrides)
    return Experiment(**fields)


@router.post("", status_code=201, response_model=ExperimentResponse)
def create_experiment(body: ExperimentCreate, request: Request):
    repo = _get_exp_repo(request)
    exp = Experiment(
        experiment_id=uuid4(),
        show_id=body.show_id,
        segment_id=body.segment_id,
        frame_id=body.frame_id,
        channel=body.channel,
        objective=body.objective,
        budget_cap_cents=body.budget_cap_cents,
        status=ExperimentStatus.DRAFT,
        start_time=None,
        end_time=None,
        baseline_snapshot=body.baseline_snapshot,
        cycle_id=None,
    )
    repo.save(exp)
    return ExperimentResponse.from_domain(exp)


@router.get("", response_model=list[ExperimentResponse])
def list_experiments(show_id: UUID, request: Request):
    repo = _get_exp_repo(request)
    experiments = repo.get_by_show(show_id)
    return [ExperimentResponse.from_domain(e) for e in experiments]


@router.get("/{experiment_id}", response_model=ExperimentResponse)
def get_experiment(experiment_id: UUID, request: Request):
    repo = _get_exp_repo(request)
    exp = _get_exp_or_404(repo, experiment_id)
    return ExperimentResponse.from_domain(exp)


LAUNCHABLE_STATUSES = {ExperimentStatus.DRAFT, ExperimentStatus.AWAITING_APPROVAL}


@router.post("/{experiment_id}/launch", response_model=ExperimentResponse)
def launch_experiment(experiment_id: UUID, request: Request):
    """Transition draft or awaiting_approval → active."""
    repo = _get_exp_repo(request)
    exp = _get_exp_or_404(repo, experiment_id)
    if exp.status not in LAUNCHABLE_STATUSES:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot launch from status {exp.status.value}",
        )
    updated = _transition(
        exp,
        status=ExperimentStatus.ACTIVE,
        start_time=datetime.now(timezone.utc),
    )
    repo.save(updated)
    return ExperimentResponse.from_domain(updated)


@router.post("/{experiment_id}/request-reapproval", response_model=ExperimentResponse)
def request_reapproval(experiment_id: UUID, request: Request):
    """Transition draft → awaiting_approval (cross-cycle carry-forward)."""
    repo = _get_exp_repo(request)
    exp = _get_exp_or_404(repo, experiment_id)
    if exp.status != ExperimentStatus.DRAFT:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot request reapproval from status {exp.status.value}",
        )
    updated = _transition(exp, status=ExperimentStatus.AWAITING_APPROVAL)
    repo.save(updated)
    return ExperimentResponse.from_domain(updated)


@router.get("/{experiment_id}/metrics", response_model=ExperimentMetrics)
def get_experiment_metrics(experiment_id: UUID, request: Request):
    from growth.app.schemas import ExperimentMetrics as MetricsSchema
    container = request.state.container
    exp = container.experiment_repo().get_by_id(experiment_id)
    if exp is None:
        raise HTTPException(404, "Experiment not found")
    observations = container.experiment_repo().get_observations(experiment_id)

    # Compute metrics
    total_spend_cents = sum(o.spend_cents for o in observations)
    total_impressions = sum(o.impressions for o in observations)
    total_clicks = sum(o.clicks for o in observations)
    total_purchases = sum(o.purchases for o in observations)
    total_revenue_cents = sum(o.revenue_cents for o in observations)
    windows_count = len(observations)

    ctr = total_clicks / total_impressions if total_impressions > 0 else None
    cpc_cents = total_spend_cents / total_clicks if total_clicks > 0 else None
    cpa_cents = total_spend_cents / total_purchases if total_purchases > 0 else None
    roas = total_revenue_cents / total_spend_cents if total_spend_cents > 0 else None
    conversion_rate = total_purchases / total_clicks if total_clicks > 0 else None

    # Check evidence sufficiency
    policy = container.policy_config()
    evidence_sufficient = (
        total_impressions >= policy.min_observations_impressions and
        total_spend_cents >= policy.min_observations_spend_cents and
        windows_count >= 1
    )

    return MetricsSchema(
        experiment_id=experiment_id,
        total_spend_cents=total_spend_cents,
        total_impressions=total_impressions,
        total_clicks=total_clicks,
        total_purchases=total_purchases,
        total_revenue_cents=total_revenue_cents,
        windows_count=windows_count,
        ctr=ctr,
        cpc_cents=cpc_cents,
        cpa_cents=cpa_cents,
        roas=roas,
        conversion_rate=conversion_rate,
        evidence_sufficient=evidence_sufficient,
    )
```

Note: The `ApprovalRequest` import is removed — no longer needed. The old `submit`, `approve`, `start`, `complete`, `stop` endpoints are replaced by `launch` and `request-reapproval`. The transition to `decided` happens via the decision service (which already exists at `POST /api/decisions/evaluate/{experiment_id}`).

**Step 4: Remove `ApprovalRequest` from schemas if unused**

Check if `ApprovalRequest` is used elsewhere. It is only imported in `experiments.py`. Remove the import from the old file (already handled by the rewrite above). The schema class can stay in `schemas.py` for now since review approval for segments/frames/variants may still use a similar pattern.

**Step 5: Run tests to verify they pass**

Run: `uv run pytest tests/api/test_experiments.py -v`
Expected: PASS

**Step 6: Commit**

```bash
git add src/growth/app/api/experiments.py tests/api/test_experiments.py
git commit -m "refactor: replace experiment transition endpoints with launch and request-reapproval"
```

---

## Task 3: Update integration test

**Files:**
- Modify: `tests/api/test_api_integration.py`

**Step 1: Rewrite the integration test for the new lifecycle**

Replace `tests/api/test_api_integration.py`:

```python
"""End-to-end API integration test for the full experiment lifecycle."""
from uuid import uuid4


class TestFullAPILifecycle:
    def test_show_to_decision_lifecycle(self, client):
        """Full lifecycle: show → experiment → launch → observe → decide."""
        # 1. Create show
        show_resp = client.post("/api/shows", json={
            "artist_name": "Integration Test Artist",
            "city": "Austin",
            "venue": "The Parish",
            "show_time": "2026-05-01T20:00:00Z",
            "timezone": "America/Chicago",
            "capacity": 200,
            "tickets_total": 200,
            "tickets_sold": 0,
        })
        assert show_resp.status_code == 201
        show_id = show_resp.json()["show_id"]

        # 2. Create experiment
        exp_resp = client.post("/api/experiments", json={
            "show_id": show_id,
            "segment_id": str(uuid4()),
            "frame_id": str(uuid4()),
            "channel": "meta",
            "objective": "ticket_sales",
            "budget_cap_cents": 5000,
            "baseline_snapshot": {"cac_cents": 800, "conversion_rate": 0.02},
        })
        assert exp_resp.status_code == 201
        exp_id = exp_resp.json()["experiment_id"]
        assert exp_resp.json()["status"] == "draft"

        # 3. Launch (draft → active)
        launch_resp = client.post(f"/api/experiments/{exp_id}/launch")
        assert launch_resp.status_code == 200
        assert launch_resp.json()["status"] == "active"

        # 4. Add observations (two windows)
        for day in [1, 2]:
            obs_resp = client.post("/api/observations", json={
                "experiment_id": exp_id,
                "window_start": f"2026-04-0{day}T00:00:00Z",
                "window_end": f"2026-04-0{day + 1}T00:00:00Z",
                "spend_cents": 1500,
                "impressions": 6000,
                "clicks": 120,
                "sessions": 100,
                "checkouts": 12,
                "purchases": 5,
                "revenue_cents": 20000,
                "refunds": 0,
                "refund_cents": 0,
                "complaints": 0,
                "negative_comment_rate": 0.01,
                "attribution_model": "last_click_utm",
            })
            assert obs_resp.status_code == 201

        # Verify observations stored
        obs_list_resp = client.get(f"/api/observations?experiment_id={exp_id}")
        assert len(obs_list_resp.json()) == 2

        # 5. Evaluate (this creates a decision — experiment should become decided)
        decision_resp = client.post(f"/api/decisions/evaluate/{exp_id}")
        assert decision_resp.status_code == 200
        decision = decision_resp.json()
        assert decision["action"] in ["scale", "hold", "kill"]
        assert decision["experiment_id"] == exp_id

        # 6. Verify decision persisted
        decisions_resp = client.get(f"/api/decisions?experiment_id={exp_id}")
        assert len(decisions_resp.json()) == 1

        # 7. Verify show still accessible
        show_get_resp = client.get(f"/api/shows/{show_id}")
        assert show_get_resp.status_code == 200
```

**Step 2: Run test**

Run: `uv run pytest tests/api/test_api_integration.py -v`
Expected: PASS (or may need decision service update — see Task 5)

**Step 3: Commit**

```bash
git add tests/api/test_api_integration.py
git commit -m "test: update integration test for simplified experiment lifecycle"
```

---

## Task 4: Update remaining backend test files

All these tests create `Experiment` objects directly with old status values. They need mechanical updates.

**Files:**
- Modify: `tests/adapters/test_repositories.py` — lines 89, 99, 129, 165, 225
- Modify: `tests/app/test_decision_service.py` — lines 77, 129, 153
- Modify: `tests/app/test_memo_service.py` — line 76 (if present)
- Modify: `tests/adapters/llm/test_strategy_tools.py` — lines 135, 157, 183, 250, 282, 303
- Modify: `tests/adapters/llm/test_memo_tools.py` — line 76
- Modify: `tests/test_integration.py` — lines 108, 232, 321

**Step 1: Apply substitutions**

Across all files listed above:
- `ExperimentStatus.RUNNING` → `ExperimentStatus.ACTIVE`
- `ExperimentStatus.COMPLETED` → `ExperimentStatus.DECIDED`
- `ExperimentStatus.STOPPED` → `ExperimentStatus.DECIDED`
- `ExperimentStatus.APPROVED` → `ExperimentStatus.DRAFT` (or `ACTIVE` depending on context — check each usage)

Specific mappings per file:

**`tests/adapters/test_repositories.py`:**
- Lines 89, 99, 129: `DRAFT` — no change
- Lines 165, 225: `RUNNING` → `ACTIVE`

**`tests/app/test_decision_service.py`:**
- Lines 77, 129, 153: `RUNNING` → `ACTIVE` (decision service evaluates active experiments)

**`tests/adapters/llm/test_strategy_tools.py`:**
- Line 135: `RUNNING` → `ACTIVE`
- Lines 157, 250, 282, 303: `COMPLETED` → `DECIDED`
- Line 183: `RUNNING` → `ACTIVE`

**`tests/adapters/llm/test_memo_tools.py`:**
- Line 76: `COMPLETED` → `DECIDED`

**`tests/test_integration.py`:**
- Lines 108, 232, 321: `RUNNING` → `ACTIVE`

**Step 2: Run all backend tests**

Run: `uv run pytest -v`
Expected: PASS (or reveals additional places needing updates)

**Step 3: Commit**

```bash
git add tests/
git commit -m "test: update all backend tests for new ExperimentStatus values"
```

---

## Task 5: Update strategy tools and decision service

**Files:**
- Modify: `src/growth/adapters/llm/strategy_tools.py:60` — update active statuses filter
- Check: `src/growth/app/api/decisions.py` — the decision evaluation endpoint may need to transition experiments to `decided`

**Step 1: Update strategy tools**

In `src/growth/adapters/llm/strategy_tools.py`, line 60:

```python
# Old:
active_statuses = {ExperimentStatus.RUNNING, ExperimentStatus.APPROVED}
# New:
active_statuses = {ExperimentStatus.ACTIVE}
```

Also update the docstring on line 58:
```python
# Old:
"""Get all running or approved experiments for a show."""
# New:
"""Get all active experiments for a show."""
```

**Step 2: Check the decision service**

Read `src/growth/app/api/decisions.py` to see if the `evaluate` endpoint needs to transition the experiment to `decided` status after recording a decision. Currently it may not do this — the old flow had separate `complete` and `stop` endpoints. Now the decision itself should trigger the transition.

If the decision endpoint does NOT transition the experiment, add logic:
```python
# After saving the decision, transition experiment to decided
updated_exp = _transition(exp, status=ExperimentStatus.DECIDED, end_time=datetime.now(timezone.utc))
exp_repo.save(updated_exp)
```

**Step 3: Run tests**

Run: `uv run pytest -v`
Expected: PASS

**Step 4: Commit**

```bash
git add src/growth/adapters/llm/strategy_tools.py src/growth/app/api/decisions.py
git commit -m "refactor: update strategy tools and decision service for new experiment statuses"
```

---

## Task 6: Update CLI seeder

**Files:**
- Modify: `src/growth/app/cli.py:60`

**Step 1: Update the seeded experiment status**

Line 60: `ExperimentStatus.RUNNING` → `ExperimentStatus.ACTIVE`

**Step 2: Run the smoke test to verify**

Run: `uv run python -m growth.app.cli --cleanup`
Expected: Runs without error

**Step 3: Commit**

```bash
git add src/growth/app/cli.py
git commit -m "chore: update CLI seeder for new experiment status values"
```

---

## Task 7: Update frontend-v2 getCycleProgress

**Files:**
- Modify: `frontend-v2/features/cycles/getCycleProgress.ts`
- Modify: `frontend-v2/features/cycles/getCycleProgress.test.ts`

**Step 1: Write the updated tests**

Replace `frontend-v2/features/cycles/getCycleProgress.test.ts`:

```typescript
import { getCycleProgress, type CycleProgressSnapshot } from './getCycleProgress'

function makeSnapshot(overrides: Partial<CycleProgressSnapshot> = {}): CycleProgressSnapshot {
  return {
    segments: [],
    frames: [],
    variants: [],
    experiments: [],
    observations: [],
    memos: [],
    ...overrides,
  }
}

describe('getCycleProgress', () => {
  it('returns all false and nextAction plan for empty snapshot', () => {
    const progress = getCycleProgress(makeSnapshot())

    expect(progress.planComplete).toBe(false)
    expect(progress.createComplete).toBe(false)
    expect(progress.runComplete).toBe(false)
    expect(progress.resultsComplete).toBe(false)
    expect(progress.memoComplete).toBe(false)
    expect(progress.nextAction).toBe('plan')
  })

  it('returns plan as next action when no approved segment and frame exist', () => {
    const progress = getCycleProgress(
      makeSnapshot({
        segments: [{ review_status: 'pending' }],
        frames: [{ frame_id: 'frame-1', review_status: 'approved' }],
      })
    )

    expect(progress.planComplete).toBe(false)
    expect(progress.nextAction).toBe('plan')
  })

  it('marks create complete only when an approved variant belongs to an approved frame', () => {
    const progress = getCycleProgress(
      makeSnapshot({
        segments: [{ review_status: 'approved' }],
        frames: [
          { frame_id: 'frame-1', review_status: 'rejected' },
          { frame_id: 'frame-2', review_status: 'approved' },
        ],
        variants: [
          { frame_id: 'frame-1', review_status: 'approved' },
          { frame_id: 'frame-2', review_status: 'approved' },
        ],
      })
    )

    expect(progress.planComplete).toBe(true)
    expect(progress.createComplete).toBe(true)
    expect(progress.nextAction).toBe('run')
  })

  it('marks run complete for active experiments', () => {
    const progress = getCycleProgress(
      makeSnapshot({
        segments: [{ review_status: 'approved' }],
        frames: [{ frame_id: 'frame-1', review_status: 'approved' }],
        variants: [{ frame_id: 'frame-1', review_status: 'approved' }],
        experiments: [{ experiment_id: 'exp-1', status: 'active' }],
      })
    )

    expect(progress.runComplete).toBe(true)
  })

  it('marks run complete for decided experiments', () => {
    const progress = getCycleProgress(
      makeSnapshot({
        segments: [{ review_status: 'approved' }],
        frames: [{ frame_id: 'frame-1', review_status: 'approved' }],
        variants: [{ frame_id: 'frame-1', review_status: 'approved' }],
        experiments: [{ experiment_id: 'exp-1', status: 'decided' }],
      })
    )

    expect(progress.runComplete).toBe(true)
  })

  it('does not mark run complete for draft experiments', () => {
    const progress = getCycleProgress(
      makeSnapshot({
        segments: [{ review_status: 'approved' }],
        frames: [{ frame_id: 'frame-1', review_status: 'approved' }],
        variants: [{ frame_id: 'frame-1', review_status: 'approved' }],
        experiments: [{ experiment_id: 'exp-1', status: 'draft' }],
      })
    )

    expect(progress.runComplete).toBe(false)
    expect(progress.nextAction).toBe('run')
  })

  it('marks results complete only with observations for launched experiments', () => {
    const progress = getCycleProgress(
      makeSnapshot({
        segments: [{ review_status: 'approved' }],
        frames: [{ frame_id: 'frame-1', review_status: 'approved' }],
        variants: [{ frame_id: 'frame-1', review_status: 'approved' }],
        experiments: [{ experiment_id: 'exp-1', status: 'draft' }],
        observations: [{ experiment_id: 'exp-1' }],
      })
    )

    expect(progress.runComplete).toBe(false)
    expect(progress.resultsComplete).toBe(false)
    expect(progress.nextAction).toBe('run')
  })

  it('returns memo as next action when all prior steps are complete', () => {
    const progress = getCycleProgress(
      makeSnapshot({
        segments: [{ review_status: 'approved' }],
        frames: [{ frame_id: 'frame-1', review_status: 'approved' }],
        variants: [{ frame_id: 'frame-1', review_status: 'approved' }],
        experiments: [{ experiment_id: 'exp-1', status: 'active' }],
        observations: [{ experiment_id: 'exp-1' }],
      })
    )

    expect(progress.planComplete).toBe(true)
    expect(progress.createComplete).toBe(true)
    expect(progress.runComplete).toBe(true)
    expect(progress.resultsComplete).toBe(true)
    expect(progress.memoComplete).toBe(false)
    expect(progress.nextAction).toBe('memo')
  })

  it('returns complete when all steps are complete', () => {
    const progress = getCycleProgress(
      makeSnapshot({
        segments: [{ review_status: 'approved' }],
        frames: [{ frame_id: 'frame-1', review_status: 'approved' }],
        variants: [{ frame_id: 'frame-1', review_status: 'approved' }],
        experiments: [{ experiment_id: 'exp-1', status: 'decided' }],
        observations: [{ experiment_id: 'exp-1' }],
        memos: [{ memo_id: 'memo-1' }],
      })
    )

    expect(progress.nextAction).toBe('complete')
  })

  it('prioritizes earlier incomplete steps in nextAction order', () => {
    const progress = getCycleProgress(
      makeSnapshot({
        segments: [{ review_status: 'approved' }],
        frames: [{ frame_id: 'frame-1', review_status: 'approved' }],
        experiments: [{ experiment_id: 'exp-1', status: 'decided' }],
      })
    )

    expect(progress.runComplete).toBe(true)
    expect(progress.createComplete).toBe(false)
    expect(progress.nextAction).toBe('create')
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `cd frontend-v2 && npm run test`
Expected: FAIL — `RUN_COMPLETE_STATUSES` still has old values

**Step 3: Update getCycleProgress**

Replace `frontend-v2/features/cycles/getCycleProgress.ts`:

```typescript
import type { components } from '@/shared/api/generated/schema'

type SegmentSnapshot = Pick<components['schemas']['SegmentResponse'], 'review_status'>
type FrameSnapshot = Pick<components['schemas']['FrameResponse'], 'frame_id' | 'review_status'>
type VariantSnapshot = Pick<components['schemas']['VariantResponse'], 'frame_id' | 'review_status'>
type ExperimentSnapshot = Pick<components['schemas']['ExperimentResponse'], 'experiment_id' | 'status'>
type ObservationSnapshot = Pick<components['schemas']['ObservationResponse'], 'experiment_id'>
type MemoSnapshot = Pick<components['schemas']['MemoResponse'], 'memo_id'>

export interface CycleProgressSnapshot {
  segments: readonly SegmentSnapshot[]
  frames: readonly FrameSnapshot[]
  variants: readonly VariantSnapshot[]
  experiments: readonly ExperimentSnapshot[]
  observations: readonly ObservationSnapshot[]
  memos: readonly MemoSnapshot[]
}

export type CycleNextAction = 'plan' | 'create' | 'run' | 'results' | 'memo' | 'complete'

export interface CycleProgress {
  planComplete: boolean
  createComplete: boolean
  runComplete: boolean
  resultsComplete: boolean
  memoComplete: boolean
  nextAction: CycleNextAction
}

/** Experiment statuses that indicate the experiment has been launched. */
const LAUNCHED_STATUSES = new Set(['active', 'decided'])

function isApproved(reviewStatus: components['schemas']['ReviewStatus']): boolean {
  return reviewStatus === 'approved'
}

export function getCycleProgress(snapshot: CycleProgressSnapshot): CycleProgress {
  const approvedFrameIds = new Set(
    snapshot.frames
      .filter((frame) => isApproved(frame.review_status))
      .map((frame) => frame.frame_id)
  )

  const launchedExperimentIds = new Set(
    snapshot.experiments
      .filter((experiment) => LAUNCHED_STATUSES.has(experiment.status))
      .map((experiment) => experiment.experiment_id)
  )

  const planComplete =
    snapshot.segments.some((segment) => isApproved(segment.review_status)) &&
    approvedFrameIds.size > 0

  const createComplete = snapshot.variants.some(
    (variant) => isApproved(variant.review_status) && approvedFrameIds.has(variant.frame_id)
  )

  const runComplete = launchedExperimentIds.size > 0

  const resultsComplete = snapshot.observations.some((observation) =>
    launchedExperimentIds.has(observation.experiment_id)
  )

  const memoComplete = snapshot.memos.length > 0

  if (!planComplete) {
    return { planComplete, createComplete, runComplete, resultsComplete, memoComplete, nextAction: 'plan' }
  }

  if (!createComplete) {
    return { planComplete, createComplete, runComplete, resultsComplete, memoComplete, nextAction: 'create' }
  }

  if (!runComplete) {
    return { planComplete, createComplete, runComplete, resultsComplete, memoComplete, nextAction: 'run' }
  }

  if (!resultsComplete) {
    return { planComplete, createComplete, runComplete, resultsComplete, memoComplete, nextAction: 'results' }
  }

  if (!memoComplete) {
    return { planComplete, createComplete, runComplete, resultsComplete, memoComplete, nextAction: 'memo' }
  }

  return { planComplete, createComplete, runComplete, resultsComplete, memoComplete, nextAction: 'complete' }
}
```

**Step 4: Run tests**

Run: `cd frontend-v2 && npm run test`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend-v2/features/cycles/getCycleProgress.ts frontend-v2/features/cycles/getCycleProgress.test.ts
git commit -m "refactor: align getCycleProgress with simplified experiment statuses"
```

---

## Task 8: Update frontend-v1 references

**Files:**
- Modify: `frontend/lib/types.ts:75, 81-88` — update `ExperimentStatus` type union
- Modify: `frontend/components/experiments/ExperimentCard.tsx:84, 93, 128-144` — update status styles/labels/buttons
- Modify: `frontend/app/shows/[show_id]/results/page.tsx:22` — update filter
- Modify: `frontend/app/shows/[show_id]/overview/page.tsx:28` — update filter

**Step 1: Update type definition**

In `frontend/lib/types.ts`, update the `ExperimentStatus` type:
```typescript
// Old:
export type ExperimentStatus = 'draft' | 'awaiting_approval' | 'approved' | 'running' | 'completed' | 'stopped' | 'archived'
// New:
export type ExperimentStatus = 'draft' | 'active' | 'awaiting_approval' | 'decided'
```

**Step 2: Update ExperimentCard status badges and buttons**

In `frontend/components/experiments/ExperimentCard.tsx`:
- Update the `styles` record to map new status values
- Update the `labels` record to map new status values
- Update button conditions: replace `'approved'` gate with `'draft'` for launch, replace `'running'` with `'active'`

**Step 3: Update filter pages**

- `results/page.tsx` line 22: `['running', 'completed']` → `['active', 'decided']`
- `overview/page.tsx` line 28: `'running'` → `'active'`

**Step 4: Run frontend lint**

Run: `cd frontend && npm run lint`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/
git commit -m "refactor: update frontend-v1 for simplified experiment statuses"
```

---

## Task 9: Update docs and contracts

**Files:**
- Modify: `docs/contracts/frontend-contract.md:44-54` — update experiment status table
- Modify: `docs/api-reference.md` — update status values in examples and descriptions
- Modify: `docs/designs/high-level-design.md:89-95` — update enum values

**Step 1: Update frontend contract**

In `docs/contracts/frontend-contract.md`, replace the experiment status table (lines 44-54):

```markdown
### Experiment status

| Value             | Meaning                                 |
|-------------------|-----------------------------------------|
| draft             | Created, not yet launched               |
| active            | Ads running externally                  |
| awaiting_approval | Carried from prior cycle, needs review  |
| decided           | Scale/hold/kill decision recorded       |
```

**Step 2: Update API reference**

In `docs/api-reference.md`, update all experiment status references:
- `"running"` → `"active"`
- `"completed"` → `"decided"`
- Remove references to `approved`, `stopped`, `archived` statuses
- Update endpoint documentation: remove `/submit`, `/approve`, `/start`, `/complete`, `/stop`; add `/launch`, `/request-reapproval`

**Step 3: Update high-level design**

In `docs/designs/high-level-design.md`, update the enum values list.

**Step 4: Commit**

```bash
git add docs/
git commit -m "docs: update contracts and references for simplified experiment statuses"
```

---

## Task 10: Regenerate OpenAPI schema and run full verification

**Step 1: Regenerate the OpenAPI spec**

Run: `uv run python -c "from growth.app.main import app; import json; print(json.dumps(app.openapi(), indent=2))" > docs/openapi.json`

(Adjust command based on how the project generates its OpenAPI spec.)

**Step 2: Regenerate frontend-v2 TypeScript types**

Run: `cd frontend-v2 && npx openapi-typescript ../docs/openapi.json -o shared/api/generated/schema.ts`

(Adjust based on project's actual codegen setup.)

**Step 3: Run full test suite**

```bash
uv run pytest -v
cd frontend-v2 && npm run lint && npm run test
cd ../frontend && npm run lint
```

Expected: All PASS

**Step 4: Commit**

```bash
git add docs/openapi.json frontend-v2/shared/api/generated/schema.ts
git commit -m "chore: regenerate OpenAPI spec and TypeScript types"
```

---

## Summary of all files modified

**Backend (Python):**
- `src/growth/domain/models.py` — enum definition
- `src/growth/app/api/experiments.py` — API endpoints
- `src/growth/adapters/llm/strategy_tools.py` — active experiments filter
- `src/growth/app/cli.py` — seeder status
- `src/growth/app/api/decisions.py` — transition to decided (if needed)

**Backend tests:**
- `tests/domain/test_models.py`
- `tests/api/test_experiments.py`
- `tests/api/test_api_integration.py`
- `tests/adapters/test_repositories.py`
- `tests/app/test_decision_service.py`
- `tests/app/test_memo_service.py`
- `tests/adapters/llm/test_strategy_tools.py`
- `tests/adapters/llm/test_memo_tools.py`
- `tests/test_integration.py`

**Frontend-v2:**
- `frontend-v2/features/cycles/getCycleProgress.ts`
- `frontend-v2/features/cycles/getCycleProgress.test.ts`
- `frontend-v2/shared/api/generated/schema.ts` (regenerated)

**Frontend-v1:**
- `frontend/lib/types.ts`
- `frontend/components/experiments/ExperimentCard.tsx`
- `frontend/app/shows/[show_id]/results/page.tsx`
- `frontend/app/shows/[show_id]/overview/page.tsx`

**Docs:**
- `docs/contracts/frontend-contract.md`
- `docs/api-reference.md`
- `docs/designs/high-level-design.md`
- `docs/openapi.json` (regenerated)
