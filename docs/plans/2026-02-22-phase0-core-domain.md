# Phase 0: Core Domain Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the pure domain layer (models, decision engine, policies, events), persistence (SQLAlchemy + SQLite), JSONL event log, and a CLI smoke test — everything needed to run Scale/Hold/Kill decisions from manually-entered data.

**Architecture:** Hexagonal architecture with frozen dataclasses as domain models, Python Protocol-based ports, SQLAlchemy adapters for persistence, and TOML-driven policy configuration. The domain layer has zero IO dependencies — all logic is pure functions on domain objects.

**Tech Stack:** Python 3.14, pip + pyproject.toml, pytest, SQLAlchemy 2.x, Pydantic 2.x (for validation at boundaries), tomli (TOML parsing)

---

### Task 1: Project Scaffolding

**Files:**
- Create: `pyproject.toml`
- Create: `src/growth/__init__.py`
- Create: `src/growth/domain/__init__.py`
- Create: `src/growth/ports/__init__.py`
- Create: `src/growth/adapters/__init__.py`
- Create: `src/growth/app/__init__.py`
- Create: `tests/__init__.py`
- Create: `tests/domain/__init__.py`
- Create: `config/policy.toml`
- Remove: `.venv/` (stale Python 3.9)

**Step 1: Create pyproject.toml**

```toml
[project]
name = "bring-the-people"
version = "0.1.0"
description = "Agentic growth system for live show ticket sales"
requires-python = ">=3.12"
dependencies = [
    "sqlalchemy>=2.0,<3.0",
    "pydantic>=2.0,<3.0",
    "tomli>=2.0,<3.0;python_version<'3.11'",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-cov>=5.0",
]

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["src"]

[build-system]
requires = ["setuptools>=68.0"]
build-backend = "setuptools.backends._legacy:_Backend"

[tool.setuptools.packages.find]
where = ["src"]
```

**Step 2: Recreate venv and install**

```bash
rm -rf .venv
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
```

Expected: installs successfully, `sqlalchemy`, `pydantic`, `pytest` all importable.

**Step 3: Create package skeleton**

Create all `__init__.py` files listed above (empty files) plus `config/policy.toml` with the default policy configuration:

```toml
[evidence_minimums]
min_windows = 2
min_clicks = 150
min_purchases = 5

[scale_thresholds]
min_incremental_tickets_per_100usd = 0.0
max_cac_vs_baseline_ratio = 0.85

[kill_thresholds]
min_conversion_rate_vs_baseline_ratio = 0.50

[guardrails]
max_refund_rate = 0.10
max_complaint_rate = 0.05
max_negative_comment_rate = 0.15

[confidence_weights]
sample_sufficiency = 0.4
lift_strength = 0.4
window_consistency = 0.2

[budget_caps]
discovery_max_pct = 0.10
validation_max_pct = 0.20
scale_max_pct = 0.40
```

**Step 4: Verify pytest runs (no tests yet)**

Run: `.venv/bin/pytest -v`
Expected: "no tests ran" with exit code 5 (no tests collected)

**Step 5: Commit**

```bash
git add pyproject.toml src/ tests/ config/
git commit -m "feat: project scaffolding with hexagonal package layout and policy config"
```

---

### Task 2: Domain Models — Show and Experiment Enums

**Files:**
- Create: `src/growth/domain/models.py`
- Create: `tests/domain/test_models.py`

**Step 1: Write the failing tests**

```python
# tests/domain/test_models.py
"""Tests for domain models."""
from datetime import datetime, timezone
from uuid import uuid4

import pytest

from growth.domain.models import (
    DecisionAction,
    ExperimentStatus,
    Show,
    ShowPhase,
    get_show_phase,
)


class TestShowPhase:
    def test_far_out_is_early(self):
        show_time = datetime(2026, 5, 1, 20, 0, tzinfo=timezone.utc)
        now = datetime(2026, 3, 1, 12, 0, tzinfo=timezone.utc)  # T-61
        assert get_show_phase(show_time, now) == ShowPhase.EARLY

    def test_t_minus_30_is_mid(self):
        show_time = datetime(2026, 5, 1, 20, 0, tzinfo=timezone.utc)
        now = datetime(2026, 4, 10, 12, 0, tzinfo=timezone.utc)  # T-21
        assert get_show_phase(show_time, now) == ShowPhase.MID

    def test_t_minus_5_is_late(self):
        show_time = datetime(2026, 5, 1, 20, 0, tzinfo=timezone.utc)
        now = datetime(2026, 4, 26, 12, 0, tzinfo=timezone.utc)  # T-5
        assert get_show_phase(show_time, now) == ShowPhase.LATE

    def test_past_show_is_late(self):
        show_time = datetime(2026, 3, 1, 20, 0, tzinfo=timezone.utc)
        now = datetime(2026, 3, 2, 12, 0, tzinfo=timezone.utc)
        assert get_show_phase(show_time, now) == ShowPhase.LATE


class TestShow:
    def test_create_show(self):
        show = Show(
            show_id=uuid4(),
            artist_name="Test Artist",
            city="Austin",
            venue="The Parish",
            show_time=datetime(2026, 5, 1, 20, 0, tzinfo=timezone.utc),
            timezone="America/Chicago",
            capacity=200,
            tickets_total=200,
            tickets_sold=0,
            currency="USD",
        )
        assert show.artist_name == "Test Artist"
        assert show.capacity == 200

    def test_show_is_frozen(self):
        show = Show(
            show_id=uuid4(),
            artist_name="Test",
            city="Austin",
            venue="The Parish",
            show_time=datetime(2026, 5, 1, 20, 0, tzinfo=timezone.utc),
            timezone="America/Chicago",
            capacity=200,
            tickets_total=200,
            tickets_sold=0,
            currency="USD",
        )
        with pytest.raises(AttributeError):
            show.artist_name = "Changed"


class TestExperimentStatus:
    def test_valid_statuses(self):
        assert ExperimentStatus.DRAFT.value == "draft"
        assert ExperimentStatus.AWAITING_APPROVAL.value == "awaiting_approval"
        assert ExperimentStatus.APPROVED.value == "approved"
        assert ExperimentStatus.RUNNING.value == "running"
        assert ExperimentStatus.COMPLETED.value == "completed"
        assert ExperimentStatus.STOPPED.value == "stopped"
        assert ExperimentStatus.ARCHIVED.value == "archived"


class TestDecisionAction:
    def test_valid_actions(self):
        assert DecisionAction.SCALE.value == "scale"
        assert DecisionAction.HOLD.value == "hold"
        assert DecisionAction.KILL.value == "kill"
```

**Step 2: Run tests to verify they fail**

Run: `.venv/bin/pytest tests/domain/test_models.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'growth.domain.models'`

**Step 3: Write the domain models**

```python
# src/growth/domain/models.py
"""Core domain models. All dataclasses are frozen (immutable)."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import UUID


class ShowPhase(Enum):
    """Time-to-show phase, determines cadence and baseline windows."""
    EARLY = "early"    # T-60..T-22
    MID = "mid"        # T-21..T-8
    LATE = "late"      # T-7..T-0


class ExperimentStatus(Enum):
    DRAFT = "draft"
    AWAITING_APPROVAL = "awaiting_approval"
    APPROVED = "approved"
    RUNNING = "running"
    COMPLETED = "completed"
    STOPPED = "stopped"
    ARCHIVED = "archived"


class DecisionAction(Enum):
    SCALE = "scale"
    HOLD = "hold"
    KILL = "kill"


def get_show_phase(show_time: datetime, now: datetime) -> ShowPhase:
    """Determine the show phase based on days until showtime."""
    days_out = (show_time - now).days
    if days_out >= 22:
        return ShowPhase.EARLY
    elif days_out >= 8:
        return ShowPhase.MID
    else:
        return ShowPhase.LATE


@dataclass(frozen=True)
class Show:
    show_id: UUID
    artist_name: str
    city: str
    venue: str
    show_time: datetime
    timezone: str
    capacity: int
    tickets_total: int
    tickets_sold: int
    currency: str = "USD"
```

**Step 4: Run tests to verify they pass**

Run: `.venv/bin/pytest tests/domain/test_models.py -v`
Expected: all PASS

**Step 5: Commit**

```bash
git add src/growth/domain/models.py tests/domain/test_models.py
git commit -m "feat: core domain models — Show, ShowPhase, ExperimentStatus, DecisionAction"
```

---

### Task 3: Domain Models — Remaining Entities

**Files:**
- Modify: `src/growth/domain/models.py`
- Modify: `tests/domain/test_models.py`

**Step 1: Write the failing tests**

Append to `tests/domain/test_models.py`:

```python
from growth.domain.models import (
    AudienceSegment,
    CreativeFrame,
    CreativeVariant,
    Decision,
    Experiment,
    Observation,
    ProducerMemo,
)


class TestExperiment:
    def test_create_experiment(self):
        exp = Experiment(
            experiment_id=uuid4(),
            show_id=uuid4(),
            segment_id=uuid4(),
            frame_id=uuid4(),
            channel="meta",
            objective="ticket_sales",
            budget_cap_cents=5000,
            status=ExperimentStatus.DRAFT,
            start_time=None,
            end_time=None,
            baseline_snapshot={"daily_velocity": 2.5, "cac_cents": 800},
        )
        assert exp.status == ExperimentStatus.DRAFT
        assert exp.budget_cap_cents == 5000

    def test_experiment_is_frozen(self):
        exp = Experiment(
            experiment_id=uuid4(),
            show_id=uuid4(),
            segment_id=uuid4(),
            frame_id=uuid4(),
            channel="meta",
            objective="ticket_sales",
            budget_cap_cents=5000,
            status=ExperimentStatus.DRAFT,
            start_time=None,
            end_time=None,
            baseline_snapshot={},
        )
        with pytest.raises(AttributeError):
            exp.status = ExperimentStatus.RUNNING


class TestObservation:
    def test_create_observation(self):
        obs = Observation(
            observation_id=uuid4(),
            experiment_id=uuid4(),
            window_start=datetime(2026, 4, 1, 0, 0, tzinfo=timezone.utc),
            window_end=datetime(2026, 4, 2, 0, 0, tzinfo=timezone.utc),
            spend_cents=2500,
            impressions=10000,
            clicks=200,
            sessions=180,
            checkouts=20,
            purchases=8,
            revenue_cents=32000,
            refunds=0,
            refund_cents=0,
            complaints=0,
            negative_comment_rate=0.01,
            attribution_model="last_click_utm",
            raw_json={"source": "manual"},
        )
        assert obs.purchases == 8
        assert obs.spend_cents == 2500


class TestDecision:
    def test_create_decision(self):
        d = Decision(
            decision_id=uuid4(),
            experiment_id=uuid4(),
            action=DecisionAction.SCALE,
            confidence=0.82,
            rationale="Strong CAC improvement with sufficient evidence.",
            policy_version="v1",
            metrics_snapshot={"cac_cents": 312, "purchases": 8},
        )
        assert d.action == DecisionAction.SCALE
        assert d.confidence == 0.82
```

**Step 2: Run tests to verify they fail**

Run: `.venv/bin/pytest tests/domain/test_models.py -v`
Expected: FAIL with `ImportError` for the new model classes

**Step 3: Add remaining domain models**

Append to `src/growth/domain/models.py`:

```python
@dataclass(frozen=True)
class AudienceSegment:
    segment_id: UUID
    show_id: UUID
    name: str
    definition_json: dict[str, Any]
    estimated_size: int | None
    created_by: str


@dataclass(frozen=True)
class CreativeFrame:
    frame_id: UUID
    show_id: UUID
    segment_id: UUID
    hypothesis: str
    promise: str
    evidence_refs: list[dict[str, Any]]
    risk_notes: str | None = None


@dataclass(frozen=True)
class CreativeVariant:
    variant_id: UUID
    frame_id: UUID
    platform: str
    hook: str
    body: str
    cta: str
    constraints_passed: bool = False


@dataclass(frozen=True)
class Experiment:
    experiment_id: UUID
    show_id: UUID
    segment_id: UUID
    frame_id: UUID
    channel: str
    objective: str
    budget_cap_cents: int
    status: ExperimentStatus
    start_time: datetime | None
    end_time: datetime | None
    baseline_snapshot: dict[str, Any]


@dataclass(frozen=True)
class Observation:
    observation_id: UUID
    experiment_id: UUID
    window_start: datetime
    window_end: datetime
    spend_cents: int
    impressions: int
    clicks: int
    sessions: int
    checkouts: int
    purchases: int
    revenue_cents: int
    refunds: int
    refund_cents: int
    complaints: int
    negative_comment_rate: float | None
    attribution_model: str
    raw_json: dict[str, Any]


@dataclass(frozen=True)
class Decision:
    decision_id: UUID
    experiment_id: UUID
    action: DecisionAction
    confidence: float
    rationale: str
    policy_version: str
    metrics_snapshot: dict[str, Any]


@dataclass(frozen=True)
class ProducerMemo:
    memo_id: UUID
    show_id: UUID
    cycle_start: datetime
    cycle_end: datetime
    markdown: str
```

**Step 4: Run tests to verify they pass**

Run: `.venv/bin/pytest tests/domain/test_models.py -v`
Expected: all PASS

**Step 5: Commit**

```bash
git add src/growth/domain/models.py tests/domain/test_models.py
git commit -m "feat: remaining domain models — Experiment, Observation, Decision, and supporting entities"
```

---

### Task 4: Policy Config Loading

**Files:**
- Create: `src/growth/domain/policy_config.py`
- Create: `tests/domain/test_policy_config.py`

**Step 1: Write the failing tests**

```python
# tests/domain/test_policy_config.py
"""Tests for policy configuration loading."""
from pathlib import Path

from growth.domain.policy_config import PolicyConfig, load_policy_config


class TestPolicyConfig:
    def test_load_from_project_toml(self):
        config_path = Path(__file__).parents[2] / "config" / "policy.toml"
        config = load_policy_config(config_path)
        assert config.min_windows == 2
        assert config.min_clicks == 150
        assert config.min_purchases == 5
        assert config.max_cac_vs_baseline_ratio == 0.85
        assert config.max_refund_rate == 0.10
        assert config.confidence_weight_sample == 0.4
        assert config.confidence_weight_lift == 0.4
        assert config.confidence_weight_consistency == 0.2
        assert config.discovery_max_pct == 0.10
        assert config.scale_max_pct == 0.40

    def test_load_from_dict(self):
        data = {
            "evidence_minimums": {"min_windows": 3, "min_clicks": 200, "min_purchases": 10},
            "scale_thresholds": {"min_incremental_tickets_per_100usd": 0.5, "max_cac_vs_baseline_ratio": 0.90},
            "kill_thresholds": {"min_conversion_rate_vs_baseline_ratio": 0.40},
            "guardrails": {"max_refund_rate": 0.05, "max_complaint_rate": 0.03, "max_negative_comment_rate": 0.10},
            "confidence_weights": {"sample_sufficiency": 0.5, "lift_strength": 0.3, "window_consistency": 0.2},
            "budget_caps": {"discovery_max_pct": 0.08, "validation_max_pct": 0.15, "scale_max_pct": 0.35},
        }
        config = PolicyConfig.from_dict(data)
        assert config.min_windows == 3
        assert config.min_clicks == 200
        assert config.max_refund_rate == 0.05
        assert config.discovery_max_pct == 0.08
```

**Step 2: Run tests to verify they fail**

Run: `.venv/bin/pytest tests/domain/test_policy_config.py -v`
Expected: FAIL with `ModuleNotFoundError`

**Step 3: Implement policy config**

```python
# src/growth/domain/policy_config.py
"""Policy configuration loaded from TOML."""
from __future__ import annotations

import tomllib
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class PolicyConfig:
    # Evidence minimums
    min_windows: int
    min_clicks: int
    min_purchases: int

    # Scale thresholds
    min_incremental_tickets_per_100usd: float
    max_cac_vs_baseline_ratio: float

    # Kill thresholds
    min_conversion_rate_vs_baseline_ratio: float

    # Guardrails
    max_refund_rate: float
    max_complaint_rate: float
    max_negative_comment_rate: float

    # Confidence weights
    confidence_weight_sample: float
    confidence_weight_lift: float
    confidence_weight_consistency: float

    # Budget caps
    discovery_max_pct: float
    validation_max_pct: float
    scale_max_pct: float

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> PolicyConfig:
        return cls(
            min_windows=data["evidence_minimums"]["min_windows"],
            min_clicks=data["evidence_minimums"]["min_clicks"],
            min_purchases=data["evidence_minimums"]["min_purchases"],
            min_incremental_tickets_per_100usd=data["scale_thresholds"]["min_incremental_tickets_per_100usd"],
            max_cac_vs_baseline_ratio=data["scale_thresholds"]["max_cac_vs_baseline_ratio"],
            min_conversion_rate_vs_baseline_ratio=data["kill_thresholds"]["min_conversion_rate_vs_baseline_ratio"],
            max_refund_rate=data["guardrails"]["max_refund_rate"],
            max_complaint_rate=data["guardrails"]["max_complaint_rate"],
            max_negative_comment_rate=data["guardrails"]["max_negative_comment_rate"],
            confidence_weight_sample=data["confidence_weights"]["sample_sufficiency"],
            confidence_weight_lift=data["confidence_weights"]["lift_strength"],
            confidence_weight_consistency=data["confidence_weights"]["window_consistency"],
            discovery_max_pct=data["budget_caps"]["discovery_max_pct"],
            validation_max_pct=data["budget_caps"]["validation_max_pct"],
            scale_max_pct=data["budget_caps"]["scale_max_pct"],
        )


def load_policy_config(path: Path) -> PolicyConfig:
    """Load policy config from a TOML file."""
    with open(path, "rb") as f:
        data = tomllib.load(f)
    return PolicyConfig.from_dict(data)
```

Note: Python 3.11+ includes `tomllib` in stdlib, so the `tomli` dependency in `pyproject.toml` is only needed for 3.10 and below (already conditional in the dep spec). Since we're on 3.14, `tomllib` is built in.

**Step 4: Run tests to verify they pass**

Run: `.venv/bin/pytest tests/domain/test_policy_config.py -v`
Expected: all PASS

**Step 5: Commit**

```bash
git add src/growth/domain/policy_config.py tests/domain/test_policy_config.py
git commit -m "feat: policy config loading from TOML"
```

---

### Task 5: Decision Engine — Guardrail Checks

**Files:**
- Create: `src/growth/domain/policies.py`
- Create: `tests/domain/test_policies.py`

This is the first piece of the decision engine. We build it incrementally: guardrails first, then kill conditions, then scale conditions, then the full evaluate function.

**Step 1: Write the failing tests**

```python
# tests/domain/test_policies.py
"""Tests for the deterministic decision engine."""
from growth.domain.models import DecisionAction
from growth.domain.policies import check_guardrails


class TestGuardrails:
    def test_refund_rate_over_limit_kills(self):
        result = check_guardrails(
            refund_rate=0.12,
            complaint_rate=0.01,
            negative_comment_rate=0.05,
            max_refund_rate=0.10,
            max_complaint_rate=0.05,
            max_negative_comment_rate=0.15,
        )
        assert result == DecisionAction.KILL

    def test_complaint_rate_over_limit_kills(self):
        result = check_guardrails(
            refund_rate=0.02,
            complaint_rate=0.08,
            negative_comment_rate=0.05,
            max_refund_rate=0.10,
            max_complaint_rate=0.05,
            max_negative_comment_rate=0.15,
        )
        assert result == DecisionAction.KILL

    def test_negative_comment_rate_over_limit_kills(self):
        result = check_guardrails(
            refund_rate=0.02,
            complaint_rate=0.01,
            negative_comment_rate=0.20,
            max_refund_rate=0.10,
            max_complaint_rate=0.05,
            max_negative_comment_rate=0.15,
        )
        assert result == DecisionAction.KILL

    def test_all_within_limits_passes(self):
        result = check_guardrails(
            refund_rate=0.02,
            complaint_rate=0.01,
            negative_comment_rate=0.05,
            max_refund_rate=0.10,
            max_complaint_rate=0.05,
            max_negative_comment_rate=0.15,
        )
        assert result is None

    def test_exactly_at_limit_passes(self):
        result = check_guardrails(
            refund_rate=0.10,
            complaint_rate=0.05,
            negative_comment_rate=0.15,
            max_refund_rate=0.10,
            max_complaint_rate=0.05,
            max_negative_comment_rate=0.15,
        )
        assert result is None
```

**Step 2: Run tests to verify they fail**

Run: `.venv/bin/pytest tests/domain/test_policies.py -v`
Expected: FAIL with `ModuleNotFoundError`

**Step 3: Implement guardrail check**

```python
# src/growth/domain/policies.py
"""Deterministic decision engine. Pure functions, no IO."""
from __future__ import annotations

from growth.domain.models import DecisionAction


def check_guardrails(
    refund_rate: float,
    complaint_rate: float,
    negative_comment_rate: float,
    max_refund_rate: float,
    max_complaint_rate: float,
    max_negative_comment_rate: float,
) -> DecisionAction | None:
    """Check guardrail metrics. Returns KILL if any exceeded, None if all OK."""
    if refund_rate > max_refund_rate:
        return DecisionAction.KILL
    if complaint_rate > max_complaint_rate:
        return DecisionAction.KILL
    if negative_comment_rate > max_negative_comment_rate:
        return DecisionAction.KILL
    return None
```

**Step 4: Run tests to verify they pass**

Run: `.venv/bin/pytest tests/domain/test_policies.py -v`
Expected: all PASS

**Step 5: Commit**

```bash
git add src/growth/domain/policies.py tests/domain/test_policies.py
git commit -m "feat: decision engine — guardrail checks"
```

---

### Task 6: Decision Engine — Evidence Minimums and Kill Conditions

**Files:**
- Modify: `src/growth/domain/policies.py`
- Modify: `tests/domain/test_policies.py`

**Step 1: Write the failing tests**

Append to `tests/domain/test_policies.py`:

```python
from growth.domain.policies import check_evidence_minimums, check_kill_conditions


class TestEvidenceMinimums:
    def test_all_met(self):
        assert check_evidence_minimums(
            num_windows=3, total_clicks=200, total_purchases=8,
            min_windows=2, min_clicks=150, min_purchases=5,
        ) is True

    def test_windows_not_met(self):
        assert check_evidence_minimums(
            num_windows=1, total_clicks=200, total_purchases=8,
            min_windows=2, min_clicks=150, min_purchases=5,
        ) is False

    def test_clicks_not_met(self):
        assert check_evidence_minimums(
            num_windows=3, total_clicks=100, total_purchases=8,
            min_windows=2, min_clicks=150, min_purchases=5,
        ) is False

    def test_purchases_not_met(self):
        assert check_evidence_minimums(
            num_windows=3, total_clicks=200, total_purchases=3,
            min_windows=2, min_clicks=150, min_purchases=5,
        ) is False

    def test_exactly_at_minimums(self):
        assert check_evidence_minimums(
            num_windows=2, total_clicks=150, total_purchases=5,
            min_windows=2, min_clicks=150, min_purchases=5,
        ) is True


class TestKillConditions:
    def test_budget_exhausted_no_purchases_kills(self):
        result = check_kill_conditions(
            spend_cents=5000,
            budget_cap_cents=5000,
            total_purchases=0,
            conversion_rate=0.0,
            baseline_conversion_rate=0.02,
            total_clicks=200,
            min_clicks=150,
            min_conversion_rate_vs_baseline_ratio=0.50,
        )
        assert result == DecisionAction.KILL

    def test_conversion_below_threshold_kills(self):
        result = check_kill_conditions(
            spend_cents=3000,
            budget_cap_cents=5000,
            total_purchases=1,
            conversion_rate=0.005,
            baseline_conversion_rate=0.02,
            total_clicks=200,
            min_clicks=150,
            min_conversion_rate_vs_baseline_ratio=0.50,
        )
        # 0.005 < 0.02 * 0.50 = 0.01 → KILL
        assert result == DecisionAction.KILL

    def test_conversion_ok_no_kill(self):
        result = check_kill_conditions(
            spend_cents=3000,
            budget_cap_cents=5000,
            total_purchases=5,
            conversion_rate=0.025,
            baseline_conversion_rate=0.02,
            total_clicks=200,
            min_clicks=150,
            min_conversion_rate_vs_baseline_ratio=0.50,
        )
        assert result is None

    def test_low_clicks_skips_conversion_check(self):
        # Below min_clicks, conversion check should not trigger kill
        result = check_kill_conditions(
            spend_cents=1000,
            budget_cap_cents=5000,
            total_purchases=0,
            conversion_rate=0.0,
            baseline_conversion_rate=0.02,
            total_clicks=50,
            min_clicks=150,
            min_conversion_rate_vs_baseline_ratio=0.50,
        )
        assert result is None
```

**Step 2: Run tests to verify they fail**

Run: `.venv/bin/pytest tests/domain/test_policies.py -v`
Expected: FAIL with `ImportError`

**Step 3: Implement evidence minimums and kill conditions**

Append to `src/growth/domain/policies.py`:

```python
def check_evidence_minimums(
    num_windows: int,
    total_clicks: int,
    total_purchases: int,
    min_windows: int,
    min_clicks: int,
    min_purchases: int,
) -> bool:
    """Return True if all evidence minimums are met."""
    return (
        num_windows >= min_windows
        and total_clicks >= min_clicks
        and total_purchases >= min_purchases
    )


def check_kill_conditions(
    spend_cents: int,
    budget_cap_cents: int,
    total_purchases: int,
    conversion_rate: float,
    baseline_conversion_rate: float,
    total_clicks: int,
    min_clicks: int,
    min_conversion_rate_vs_baseline_ratio: float,
) -> DecisionAction | None:
    """Check kill conditions. Returns KILL if triggered, None otherwise."""
    # Budget exhausted with zero purchases
    if spend_cents >= budget_cap_cents and total_purchases == 0:
        return DecisionAction.KILL

    # Conversion rate below threshold (only if enough clicks to judge)
    if total_clicks >= min_clicks and baseline_conversion_rate > 0:
        threshold = baseline_conversion_rate * min_conversion_rate_vs_baseline_ratio
        if conversion_rate < threshold:
            return DecisionAction.KILL

    return None
```

**Step 4: Run tests to verify they pass**

Run: `.venv/bin/pytest tests/domain/test_policies.py -v`
Expected: all PASS

**Step 5: Commit**

```bash
git add src/growth/domain/policies.py tests/domain/test_policies.py
git commit -m "feat: decision engine — evidence minimums and kill conditions"
```

---

### Task 7: Decision Engine — Scale Check and Full Evaluate

**Files:**
- Modify: `src/growth/domain/policies.py`
- Modify: `tests/domain/test_policies.py`

**Step 1: Write the failing tests**

Append to `tests/domain/test_policies.py`:

```python
from growth.domain.policies import check_scale_conditions, evaluate
from growth.domain.policy_config import PolicyConfig


class TestScaleConditions:
    def test_all_conditions_met_scales(self):
        result = check_scale_conditions(
            incremental_tickets_per_100usd=1.5,
            cac_cents=600,
            baseline_cac_cents=800,
            min_incremental_tickets_per_100usd=0.0,
            max_cac_vs_baseline_ratio=0.85,
        )
        assert result is True

    def test_no_incremental_tickets_does_not_scale(self):
        result = check_scale_conditions(
            incremental_tickets_per_100usd=0.0,
            cac_cents=600,
            baseline_cac_cents=800,
            min_incremental_tickets_per_100usd=0.0,
            max_cac_vs_baseline_ratio=0.85,
        )
        # > 0 required, 0.0 is not > 0
        assert result is False

    def test_cac_too_high_does_not_scale(self):
        result = check_scale_conditions(
            incremental_tickets_per_100usd=1.5,
            cac_cents=750,
            baseline_cac_cents=800,
            min_incremental_tickets_per_100usd=0.0,
            max_cac_vs_baseline_ratio=0.85,
        )
        # 750 > 800 * 0.85 = 680 → does not scale
        assert result is False

    def test_zero_baseline_cac_does_not_scale(self):
        result = check_scale_conditions(
            incremental_tickets_per_100usd=1.5,
            cac_cents=100,
            baseline_cac_cents=0,
            min_incremental_tickets_per_100usd=0.0,
            max_cac_vs_baseline_ratio=0.85,
        )
        # No baseline to compare against
        assert result is False


def _default_config() -> PolicyConfig:
    return PolicyConfig(
        min_windows=2,
        min_clicks=150,
        min_purchases=5,
        min_incremental_tickets_per_100usd=0.0,
        max_cac_vs_baseline_ratio=0.85,
        min_conversion_rate_vs_baseline_ratio=0.50,
        max_refund_rate=0.10,
        max_complaint_rate=0.05,
        max_negative_comment_rate=0.15,
        confidence_weight_sample=0.4,
        confidence_weight_lift=0.4,
        confidence_weight_consistency=0.2,
        discovery_max_pct=0.10,
        validation_max_pct=0.20,
        scale_max_pct=0.40,
    )


class TestEvaluate:
    def test_guardrail_violation_kills(self):
        """Guardrail kill takes priority over everything."""
        result = evaluate(
            num_windows=3,
            total_clicks=300,
            total_purchases=10,
            spend_cents=3000,
            budget_cap_cents=5000,
            revenue_cents=40000,
            refund_rate=0.15,  # Over limit
            complaint_rate=0.01,
            negative_comment_rate=0.05,
            conversion_rate=0.03,
            baseline_conversion_rate=0.02,
            baseline_cac_cents=800,
            config=_default_config(),
        )
        assert result.action == DecisionAction.KILL
        assert "guardrail" in result.rationale.lower()

    def test_insufficient_evidence_holds(self):
        result = evaluate(
            num_windows=1,
            total_clicks=80,
            total_purchases=2,
            spend_cents=1000,
            budget_cap_cents=5000,
            revenue_cents=8000,
            refund_rate=0.0,
            complaint_rate=0.0,
            negative_comment_rate=0.0,
            conversion_rate=0.025,
            baseline_conversion_rate=0.02,
            baseline_cac_cents=800,
            config=_default_config(),
        )
        assert result.action == DecisionAction.HOLD
        assert "evidence" in result.rationale.lower()

    def test_budget_exhausted_no_purchases_kills(self):
        result = evaluate(
            num_windows=2,
            total_clicks=200,
            total_purchases=0,
            spend_cents=5000,
            budget_cap_cents=5000,
            revenue_cents=0,
            refund_rate=0.0,
            complaint_rate=0.0,
            negative_comment_rate=0.0,
            conversion_rate=0.0,
            baseline_conversion_rate=0.02,
            baseline_cac_cents=800,
            config=_default_config(),
        )
        assert result.action == DecisionAction.KILL

    def test_strong_performance_scales(self):
        result = evaluate(
            num_windows=3,
            total_clicks=300,
            total_purchases=10,
            spend_cents=3000,
            budget_cap_cents=5000,
            revenue_cents=40000,
            refund_rate=0.0,
            complaint_rate=0.0,
            negative_comment_rate=0.0,
            conversion_rate=0.033,
            baseline_conversion_rate=0.02,
            baseline_cac_cents=800,
            config=_default_config(),
        )
        # CAC = 3000/10 = 300 cents. 300 <= 800 * 0.85 = 680 ✓
        # incremental_tickets_per_100usd = 10 / (3000/10000) = 33.3 > 0 ✓
        assert result.action == DecisionAction.SCALE

    def test_mediocre_performance_holds(self):
        result = evaluate(
            num_windows=2,
            total_clicks=200,
            total_purchases=5,
            spend_cents=4000,
            budget_cap_cents=5000,
            revenue_cents=20000,
            refund_rate=0.0,
            complaint_rate=0.0,
            negative_comment_rate=0.0,
            conversion_rate=0.025,
            baseline_conversion_rate=0.02,
            baseline_cac_cents=800,
            config=_default_config(),
        )
        # CAC = 4000/5 = 800 cents. 800 > 800 * 0.85 = 680 → no scale
        assert result.action == DecisionAction.HOLD


class TestEvaluateReturnShape:
    def test_returns_action_confidence_rationale(self):
        result = evaluate(
            num_windows=3,
            total_clicks=300,
            total_purchases=10,
            spend_cents=3000,
            budget_cap_cents=5000,
            revenue_cents=40000,
            refund_rate=0.0,
            complaint_rate=0.0,
            negative_comment_rate=0.0,
            conversion_rate=0.033,
            baseline_conversion_rate=0.02,
            baseline_cac_cents=800,
            config=_default_config(),
        )
        assert hasattr(result, "action")
        assert hasattr(result, "confidence")
        assert hasattr(result, "rationale")
        assert 0.0 <= result.confidence <= 1.0
        assert isinstance(result.rationale, str)
        assert len(result.rationale) > 0
```

**Step 2: Run tests to verify they fail**

Run: `.venv/bin/pytest tests/domain/test_policies.py -v`
Expected: FAIL with `ImportError` for `check_scale_conditions` and `evaluate`

**Step 3: Implement scale check and evaluate**

Append to `src/growth/domain/policies.py`:

```python
from dataclasses import dataclass

from growth.domain.policy_config import PolicyConfig


def check_scale_conditions(
    incremental_tickets_per_100usd: float,
    cac_cents: int,
    baseline_cac_cents: int,
    min_incremental_tickets_per_100usd: float,
    max_cac_vs_baseline_ratio: float,
) -> bool:
    """Return True if all scale conditions are met."""
    if baseline_cac_cents <= 0:
        return False
    if incremental_tickets_per_100usd <= min_incremental_tickets_per_100usd:
        return False
    if cac_cents > baseline_cac_cents * max_cac_vs_baseline_ratio:
        return False
    return True


@dataclass(frozen=True)
class EvaluationResult:
    action: DecisionAction
    confidence: float
    rationale: str


def _compute_confidence(
    num_windows: int,
    total_clicks: int,
    total_purchases: int,
    conversion_rate: float,
    baseline_conversion_rate: float,
    min_windows: int,
    min_clicks: int,
    min_purchases: int,
    weight_sample: float,
    weight_lift: float,
    weight_consistency: float,
) -> float:
    """Compute confidence score normalized to [0, 1]."""
    # Sample sufficiency: how far above minimums we are (capped at 1.0)
    if min_clicks > 0 and min_purchases > 0 and min_windows > 0:
        click_ratio = min(total_clicks / (min_clicks * 2), 1.0)
        purchase_ratio = min(total_purchases / (min_purchases * 2), 1.0)
        window_ratio = min(num_windows / (min_windows * 2), 1.0)
        sample_sufficiency = (click_ratio + purchase_ratio + window_ratio) / 3
    else:
        sample_sufficiency = 0.0

    # Lift strength: how much better than baseline (capped at 1.0)
    if baseline_conversion_rate > 0:
        lift = (conversion_rate - baseline_conversion_rate) / baseline_conversion_rate
        lift_strength = min(max(lift, 0.0), 1.0)
    else:
        lift_strength = 0.0

    # Window consistency: using windows as a proxy (more windows = more consistent signal)
    window_consistency = min(num_windows / 5, 1.0)

    return (
        weight_sample * sample_sufficiency
        + weight_lift * lift_strength
        + weight_consistency * window_consistency
    )


def evaluate(
    num_windows: int,
    total_clicks: int,
    total_purchases: int,
    spend_cents: int,
    budget_cap_cents: int,
    revenue_cents: int,
    refund_rate: float,
    complaint_rate: float,
    negative_comment_rate: float,
    conversion_rate: float,
    baseline_conversion_rate: float,
    baseline_cac_cents: int,
    config: PolicyConfig,
) -> EvaluationResult:
    """Run the full deterministic Scale/Hold/Kill evaluation."""
    # 1. Guardrails
    guardrail_result = check_guardrails(
        refund_rate=refund_rate,
        complaint_rate=complaint_rate,
        negative_comment_rate=negative_comment_rate,
        max_refund_rate=config.max_refund_rate,
        max_complaint_rate=config.max_complaint_rate,
        max_negative_comment_rate=config.max_negative_comment_rate,
    )
    if guardrail_result is not None:
        return EvaluationResult(
            action=DecisionAction.KILL,
            confidence=1.0,
            rationale="Guardrail violation detected. Automatic kill.",
        )

    # 2. Kill conditions
    kill_result = check_kill_conditions(
        spend_cents=spend_cents,
        budget_cap_cents=budget_cap_cents,
        total_purchases=total_purchases,
        conversion_rate=conversion_rate,
        baseline_conversion_rate=baseline_conversion_rate,
        total_clicks=total_clicks,
        min_clicks=config.min_clicks,
        min_conversion_rate_vs_baseline_ratio=config.min_conversion_rate_vs_baseline_ratio,
    )
    if kill_result is not None:
        return EvaluationResult(
            action=DecisionAction.KILL,
            confidence=0.9,
            rationale="Kill condition triggered: budget exhausted with no conversions or conversion rate too low.",
        )

    # 3. Evidence minimums
    evidence_met = check_evidence_minimums(
        num_windows=num_windows,
        total_clicks=total_clicks,
        total_purchases=total_purchases,
        min_windows=config.min_windows,
        min_clicks=config.min_clicks,
        min_purchases=config.min_purchases,
    )

    confidence = _compute_confidence(
        num_windows=num_windows,
        total_clicks=total_clicks,
        total_purchases=total_purchases,
        conversion_rate=conversion_rate,
        baseline_conversion_rate=baseline_conversion_rate,
        min_windows=config.min_windows,
        min_clicks=config.min_clicks,
        min_purchases=config.min_purchases,
        weight_sample=config.confidence_weight_sample,
        weight_lift=config.confidence_weight_lift,
        weight_consistency=config.confidence_weight_consistency,
    )

    if not evidence_met:
        return EvaluationResult(
            action=DecisionAction.HOLD,
            confidence=confidence,
            rationale="Insufficient evidence to make a scaling decision. Holding for more data.",
        )

    # 4. Scale conditions
    cac_cents = spend_cents // total_purchases if total_purchases > 0 else 0
    incremental_tickets_per_100usd = (
        total_purchases / (spend_cents / 10000) if spend_cents > 0 else 0.0
    )

    can_scale = check_scale_conditions(
        incremental_tickets_per_100usd=incremental_tickets_per_100usd,
        cac_cents=cac_cents,
        baseline_cac_cents=baseline_cac_cents,
        min_incremental_tickets_per_100usd=config.min_incremental_tickets_per_100usd,
        max_cac_vs_baseline_ratio=config.max_cac_vs_baseline_ratio,
    )

    if can_scale:
        return EvaluationResult(
            action=DecisionAction.SCALE,
            confidence=confidence,
            rationale=(
                f"Scale conditions met. CAC: {cac_cents} cents "
                f"(baseline: {baseline_cac_cents}). "
                f"Incremental tickets per $100: {incremental_tickets_per_100usd:.1f}."
            ),
        )

    # 5. Default: Hold
    return EvaluationResult(
        action=DecisionAction.HOLD,
        confidence=confidence,
        rationale="Evidence sufficient but scale conditions not met. Holding.",
    )
```

**Step 4: Run tests to verify they pass**

Run: `.venv/bin/pytest tests/domain/test_policies.py -v`
Expected: all PASS

**Step 5: Commit**

```bash
git add src/growth/domain/policies.py tests/domain/test_policies.py
git commit -m "feat: decision engine — scale conditions and full evaluate function"
```

---

### Task 8: Domain Events

**Files:**
- Create: `src/growth/domain/events.py`
- Create: `tests/domain/test_events.py`

**Step 1: Write the failing tests**

```python
# tests/domain/test_events.py
"""Tests for domain event creation."""
from datetime import datetime, timezone
from uuid import uuid4

from growth.domain.events import DomainEvent, EventType, make_event


class TestDomainEvent:
    def test_create_experiment_event(self):
        show_id = uuid4()
        experiment_id = uuid4()
        event = make_event(
            event_type=EventType.EXPERIMENT_CREATED,
            show_id=show_id,
            experiment_id=experiment_id,
            actor="system",
            payload={"channel": "meta", "budget_cap_cents": 5000},
        )
        assert event.event_type == EventType.EXPERIMENT_CREATED
        assert event.show_id == show_id
        assert event.experiment_id == experiment_id
        assert event.actor == "system"
        assert event.payload["channel"] == "meta"
        assert isinstance(event.event_id, type(uuid4()))
        assert isinstance(event.occurred_at, datetime)

    def test_event_without_experiment_id(self):
        event = make_event(
            event_type=EventType.MEMO_PUBLISHED,
            show_id=uuid4(),
            experiment_id=None,
            actor="agent",
            payload={"memo_id": str(uuid4())},
        )
        assert event.experiment_id is None

    def test_all_event_types_exist(self):
        expected = [
            "experiment.created",
            "experiment.approval_requested",
            "experiment.approved",
            "experiment.launched",
            "observation.window_closed",
            "decision.issued",
            "memo.published",
        ]
        actual = [e.value for e in EventType]
        assert actual == expected

    def test_event_is_frozen(self):
        import pytest
        event = make_event(
            event_type=EventType.EXPERIMENT_CREATED,
            show_id=uuid4(),
            experiment_id=uuid4(),
            actor="system",
            payload={},
        )
        with pytest.raises(AttributeError):
            event.actor = "human"

    def test_event_to_dict_is_serializable(self):
        import json
        event = make_event(
            event_type=EventType.EXPERIMENT_CREATED,
            show_id=uuid4(),
            experiment_id=uuid4(),
            actor="system",
            payload={"key": "value"},
        )
        d = event.to_dict()
        serialized = json.dumps(d)
        assert isinstance(serialized, str)
        parsed = json.loads(serialized)
        assert parsed["event_type"] == "experiment.created"
        assert parsed["actor"] == "system"
```

**Step 2: Run tests to verify they fail**

Run: `.venv/bin/pytest tests/domain/test_events.py -v`
Expected: FAIL with `ModuleNotFoundError`

**Step 3: Implement domain events**

```python
# src/growth/domain/events.py
"""Domain events following the event envelope contract."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import UUID, uuid4


class EventType(Enum):
    EXPERIMENT_CREATED = "experiment.created"
    EXPERIMENT_APPROVAL_REQUESTED = "experiment.approval_requested"
    EXPERIMENT_APPROVED = "experiment.approved"
    EXPERIMENT_LAUNCHED = "experiment.launched"
    OBSERVATION_WINDOW_CLOSED = "observation.window_closed"
    DECISION_ISSUED = "decision.issued"
    MEMO_PUBLISHED = "memo.published"


@dataclass(frozen=True)
class DomainEvent:
    event_id: UUID
    event_type: EventType
    occurred_at: datetime
    show_id: UUID
    experiment_id: UUID | None
    actor: str
    payload: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "event_id": str(self.event_id),
            "event_type": self.event_type.value,
            "occurred_at": self.occurred_at.isoformat(),
            "show_id": str(self.show_id),
            "experiment_id": str(self.experiment_id) if self.experiment_id else None,
            "actor": self.actor,
            "payload": self.payload,
        }


def make_event(
    event_type: EventType,
    show_id: UUID,
    experiment_id: UUID | None,
    actor: str,
    payload: dict[str, Any],
) -> DomainEvent:
    """Create a new domain event with auto-generated ID and timestamp."""
    return DomainEvent(
        event_id=uuid4(),
        event_type=event_type,
        occurred_at=datetime.now(timezone.utc),
        show_id=show_id,
        experiment_id=experiment_id,
        actor=actor,
        payload=payload,
    )
```

**Step 4: Run tests to verify they pass**

Run: `.venv/bin/pytest tests/domain/test_events.py -v`
Expected: all PASS

**Step 5: Commit**

```bash
git add src/growth/domain/events.py tests/domain/test_events.py
git commit -m "feat: domain events with envelope contract and serialization"
```

---

### Task 9: UTM Generation and Parsing

**Files:**
- Create: `src/growth/domain/utm.py`
- Create: `tests/domain/test_utm.py`

**Step 1: Write the failing tests**

```python
# tests/domain/test_utm.py
"""Tests for UTM generation and parsing."""
from uuid import UUID, uuid4

from growth.domain.utm import build_utm_params, parse_utm_content, build_utm_url


class TestBuildUtmParams:
    def test_generates_all_params(self):
        exp_id = uuid4()
        var_id = uuid4()
        seg_id = uuid4()
        params = build_utm_params(
            platform="meta",
            medium="paid_social",
            city="austin",
            show_date="20260501",
            experiment_id=exp_id,
            variant_id=var_id,
            segment_id=seg_id,
        )
        assert params["utm_source"] == "meta"
        assert params["utm_medium"] == "paid_social"
        assert params["utm_campaign"] == "show_austin_20260501"
        assert params["utm_content"] == f"exp_{exp_id}_var_{var_id}"
        assert params["utm_term"] == f"segment_{seg_id}"


class TestParseUtmContent:
    def test_parses_experiment_and_variant_ids(self):
        exp_id = uuid4()
        var_id = uuid4()
        content = f"exp_{exp_id}_var_{var_id}"
        parsed_exp, parsed_var = parse_utm_content(content)
        assert parsed_exp == exp_id
        assert parsed_var == var_id

    def test_raises_on_invalid_format(self):
        import pytest
        with pytest.raises(ValueError):
            parse_utm_content("invalid_content_string")


class TestBuildUtmUrl:
    def test_appends_params_to_base_url(self):
        exp_id = uuid4()
        var_id = uuid4()
        seg_id = uuid4()
        url = build_utm_url(
            base_url="https://tickets.example.com/show/123",
            platform="meta",
            medium="paid_social",
            city="austin",
            show_date="20260501",
            experiment_id=exp_id,
            variant_id=var_id,
            segment_id=seg_id,
        )
        assert url.startswith("https://tickets.example.com/show/123?")
        assert "utm_source=meta" in url
        assert "utm_medium=paid_social" in url
        assert "utm_campaign=show_austin_20260501" in url
        assert f"utm_content=exp_{exp_id}_var_{var_id}" in url
        assert f"utm_term=segment_{seg_id}" in url
```

**Step 2: Run tests to verify they fail**

Run: `.venv/bin/pytest tests/domain/test_utm.py -v`
Expected: FAIL with `ModuleNotFoundError`

**Step 3: Implement UTM module**

```python
# src/growth/domain/utm.py
"""UTM parameter generation and parsing."""
from __future__ import annotations

import re
from urllib.parse import urlencode, urlparse, urlunparse, parse_qs
from uuid import UUID


def build_utm_params(
    platform: str,
    medium: str,
    city: str,
    show_date: str,
    experiment_id: UUID,
    variant_id: UUID,
    segment_id: UUID,
) -> dict[str, str]:
    """Build UTM parameters following the project taxonomy."""
    return {
        "utm_source": platform,
        "utm_medium": medium,
        "utm_campaign": f"show_{city}_{show_date}",
        "utm_content": f"exp_{experiment_id}_var_{variant_id}",
        "utm_term": f"segment_{segment_id}",
    }


_UTM_CONTENT_PATTERN = re.compile(
    r"^exp_([0-9a-f\-]{36})_var_([0-9a-f\-]{36})$"
)


def parse_utm_content(content: str) -> tuple[UUID, UUID]:
    """Parse experiment_id and variant_id from a utm_content string."""
    match = _UTM_CONTENT_PATTERN.match(content)
    if not match:
        raise ValueError(f"Invalid utm_content format: {content}")
    return UUID(match.group(1)), UUID(match.group(2))


def build_utm_url(
    base_url: str,
    platform: str,
    medium: str,
    city: str,
    show_date: str,
    experiment_id: UUID,
    variant_id: UUID,
    segment_id: UUID,
) -> str:
    """Build a full URL with UTM parameters appended."""
    params = build_utm_params(
        platform=platform,
        medium=medium,
        city=city,
        show_date=show_date,
        experiment_id=experiment_id,
        variant_id=variant_id,
        segment_id=segment_id,
    )
    parsed = urlparse(base_url)
    query = urlencode(params)
    return urlunparse(parsed._replace(query=query))
```

**Step 4: Run tests to verify they pass**

Run: `.venv/bin/pytest tests/domain/test_utm.py -v`
Expected: all PASS

**Step 5: Commit**

```bash
git add src/growth/domain/utm.py tests/domain/test_utm.py
git commit -m "feat: UTM parameter generation, parsing, and URL building"
```

---

### Task 10: Persistence Ports

**Files:**
- Create: `src/growth/ports/persistence.py`
- Create: `src/growth/ports/events.py`

No tests for this task — ports are Protocol definitions (interfaces). They'll be tested through the adapter implementations.

**Step 1: Create persistence port protocols**

```python
# src/growth/ports/persistence.py
"""Repository port definitions. All ports are Protocol classes."""
from __future__ import annotations

from typing import Protocol
from uuid import UUID

from growth.domain.models import (
    AudienceSegment,
    CreativeFrame,
    CreativeVariant,
    Decision,
    Experiment,
    ExperimentStatus,
    Observation,
    ProducerMemo,
    Show,
)


class ShowRepository(Protocol):
    def save(self, show: Show) -> None: ...
    def get(self, show_id: UUID) -> Show | None: ...
    def list_all(self) -> list[Show]: ...


class AudienceSegmentRepository(Protocol):
    def save(self, segment: AudienceSegment) -> None: ...
    def get(self, segment_id: UUID) -> AudienceSegment | None: ...
    def list_by_show(self, show_id: UUID) -> list[AudienceSegment]: ...


class CreativeFrameRepository(Protocol):
    def save(self, frame: CreativeFrame) -> None: ...
    def get(self, frame_id: UUID) -> CreativeFrame | None: ...
    def list_by_show(self, show_id: UUID) -> list[CreativeFrame]: ...


class CreativeVariantRepository(Protocol):
    def save(self, variant: CreativeVariant) -> None: ...
    def get(self, variant_id: UUID) -> CreativeVariant | None: ...
    def list_by_frame(self, frame_id: UUID) -> list[CreativeVariant]: ...


class ExperimentRepository(Protocol):
    def save(self, experiment: Experiment) -> None: ...
    def get(self, experiment_id: UUID) -> Experiment | None: ...
    def list_by_show(self, show_id: UUID) -> list[Experiment]: ...
    def update_status(self, experiment_id: UUID, status: ExperimentStatus) -> None: ...


class ObservationRepository(Protocol):
    def save(self, observation: Observation) -> None: ...
    def list_by_experiment(self, experiment_id: UUID) -> list[Observation]: ...


class DecisionRepository(Protocol):
    def save(self, decision: Decision) -> None: ...
    def get_latest(self, experiment_id: UUID) -> Decision | None: ...
    def list_by_experiment(self, experiment_id: UUID) -> list[Decision]: ...


class ProducerMemoRepository(Protocol):
    def save(self, memo: ProducerMemo) -> None: ...
    def get(self, memo_id: UUID) -> ProducerMemo | None: ...
    def list_by_show(self, show_id: UUID) -> list[ProducerMemo]: ...
```

**Step 2: Create event log port**

```python
# src/growth/ports/events.py
"""Event log port definition."""
from __future__ import annotations

from typing import Protocol
from uuid import UUID

from growth.domain.events import DomainEvent, EventType


class EventLogPort(Protocol):
    def append(self, event: DomainEvent) -> None: ...
    def list_by_show(self, show_id: UUID) -> list[DomainEvent]: ...
    def list_by_experiment(self, experiment_id: UUID) -> list[DomainEvent]: ...
    def list_by_type(self, event_type: EventType) -> list[DomainEvent]: ...
```

**Step 3: Verify all imports resolve**

Run: `.venv/bin/pytest tests/ -v`
Expected: all existing tests still PASS

**Step 4: Commit**

```bash
git add src/growth/ports/persistence.py src/growth/ports/events.py
git commit -m "feat: persistence and event log port definitions (Protocol interfaces)"
```

---

### Task 11: SQLAlchemy Models and Database Setup

**Files:**
- Create: `src/growth/adapters/__init__.py` (if not already)
- Create: `src/growth/adapters/persistence/__init__.py`
- Create: `src/growth/adapters/persistence/database.py`
- Create: `src/growth/adapters/persistence/tables.py`
- Create: `tests/adapters/__init__.py`
- Create: `tests/adapters/test_database.py`

**Step 1: Write the failing tests**

```python
# tests/adapters/test_database.py
"""Tests for database setup and table creation."""
from sqlalchemy import inspect

from growth.adapters.persistence.database import create_engine_and_tables


class TestDatabaseSetup:
    def test_creates_all_tables(self):
        engine = create_engine_and_tables("sqlite:///:memory:")
        inspector = inspect(engine)
        table_names = set(inspector.get_table_names())
        expected = {
            "shows",
            "audience_segments",
            "creative_frames",
            "creative_variants",
            "experiments",
            "experiment_variants",
            "observations",
            "decisions",
            "producer_memos",
        }
        assert expected.issubset(table_names)
```

**Step 2: Run tests to verify they fail**

Run: `.venv/bin/pytest tests/adapters/test_database.py -v`
Expected: FAIL with `ModuleNotFoundError`

**Step 3: Implement database module and SQLAlchemy table definitions**

```python
# src/growth/adapters/persistence/database.py
"""Database engine and session setup."""
from __future__ import annotations

from sqlalchemy import create_engine as sa_create_engine, Engine

from growth.adapters.persistence.tables import metadata


def create_engine_and_tables(url: str = "sqlite:///data/growth.db") -> Engine:
    """Create a SQLAlchemy engine and ensure all tables exist."""
    engine = sa_create_engine(url)
    metadata.create_all(engine)
    return engine
```

```python
# src/growth/adapters/persistence/tables.py
"""SQLAlchemy table definitions mirroring the domain data model."""
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    MetaData,
    Numeric,
    String,
    Table,
    Text,
)
from sqlalchemy.dialects.sqlite import JSON

metadata = MetaData()

shows = Table(
    "shows",
    metadata,
    Column("show_id", String(36), primary_key=True),
    Column("artist_name", Text, nullable=False),
    Column("city", Text, nullable=False),
    Column("venue", Text, nullable=False),
    Column("show_time", DateTime(timezone=True), nullable=False),
    Column("timezone", Text, nullable=False),
    Column("capacity", Integer, nullable=False),
    Column("tickets_total", Integer, nullable=False),
    Column("tickets_sold", Integer, nullable=False),
    Column("currency", Text, nullable=False, default="USD"),
    Column("created_at", DateTime(timezone=True), nullable=False),
)

audience_segments = Table(
    "audience_segments",
    metadata,
    Column("segment_id", String(36), primary_key=True),
    Column("show_id", String(36), ForeignKey("shows.show_id"), nullable=False),
    Column("name", Text, nullable=False),
    Column("definition_json", JSON, nullable=False),
    Column("estimated_size", Integer),
    Column("created_by", Text, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
)

creative_frames = Table(
    "creative_frames",
    metadata,
    Column("frame_id", String(36), primary_key=True),
    Column("show_id", String(36), ForeignKey("shows.show_id"), nullable=False),
    Column("segment_id", String(36), ForeignKey("audience_segments.segment_id"), nullable=False),
    Column("hypothesis", Text, nullable=False),
    Column("promise", Text, nullable=False),
    Column("evidence_refs", JSON, nullable=False),
    Column("risk_notes", Text),
    Column("created_at", DateTime(timezone=True), nullable=False),
)

creative_variants = Table(
    "creative_variants",
    metadata,
    Column("variant_id", String(36), primary_key=True),
    Column("frame_id", String(36), ForeignKey("creative_frames.frame_id"), nullable=False),
    Column("platform", Text, nullable=False),
    Column("hook", Text, nullable=False),
    Column("body", Text, nullable=False),
    Column("cta", Text, nullable=False),
    Column("constraints_passed", Boolean, nullable=False, default=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
)

experiments = Table(
    "experiments",
    metadata,
    Column("experiment_id", String(36), primary_key=True),
    Column("show_id", String(36), ForeignKey("shows.show_id"), nullable=False),
    Column("segment_id", String(36), ForeignKey("audience_segments.segment_id"), nullable=False),
    Column("frame_id", String(36), ForeignKey("creative_frames.frame_id"), nullable=False),
    Column("channel", Text, nullable=False),
    Column("objective", Text, nullable=False),
    Column("budget_cap_cents", Integer, nullable=False),
    Column("status", Text, nullable=False),
    Column("start_time", DateTime(timezone=True)),
    Column("end_time", DateTime(timezone=True)),
    Column("baseline_snapshot", JSON, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
)

experiment_variants = Table(
    "experiment_variants",
    metadata,
    Column("experiment_id", String(36), ForeignKey("experiments.experiment_id"), nullable=False, primary_key=True),
    Column("variant_id", String(36), ForeignKey("creative_variants.variant_id"), nullable=False, primary_key=True),
    Column("is_control", Boolean, nullable=False, default=False),
)

observations = Table(
    "observations",
    metadata,
    Column("observation_id", String(36), primary_key=True),
    Column("experiment_id", String(36), ForeignKey("experiments.experiment_id"), nullable=False),
    Column("window_start", DateTime(timezone=True), nullable=False),
    Column("window_end", DateTime(timezone=True), nullable=False),
    Column("spend_cents", Integer, nullable=False, default=0),
    Column("impressions", Integer, nullable=False, default=0),
    Column("clicks", Integer, nullable=False, default=0),
    Column("sessions", Integer, nullable=False, default=0),
    Column("checkouts", Integer, nullable=False, default=0),
    Column("purchases", Integer, nullable=False, default=0),
    Column("revenue_cents", Integer, nullable=False, default=0),
    Column("refunds", Integer, nullable=False, default=0),
    Column("refund_cents", Integer, nullable=False, default=0),
    Column("complaints", Integer, nullable=False, default=0),
    Column("negative_comment_rate", Numeric(6, 4)),
    Column("attribution_model", Text, nullable=False, default="last_click_utm"),
    Column("raw_json", JSON, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
)

decisions = Table(
    "decisions",
    metadata,
    Column("decision_id", String(36), primary_key=True),
    Column("experiment_id", String(36), ForeignKey("experiments.experiment_id"), nullable=False),
    Column("action", Text, nullable=False),
    Column("confidence", Numeric(4, 3), nullable=False),
    Column("rationale", Text, nullable=False),
    Column("policy_version", Text, nullable=False),
    Column("metrics_snapshot", JSON, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
)

producer_memos = Table(
    "producer_memos",
    metadata,
    Column("memo_id", String(36), primary_key=True),
    Column("show_id", String(36), ForeignKey("shows.show_id"), nullable=False),
    Column("cycle_start", DateTime(timezone=True), nullable=False),
    Column("cycle_end", DateTime(timezone=True), nullable=False),
    Column("markdown", Text, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
)
```

**Step 4: Run tests to verify they pass**

Run: `.venv/bin/pytest tests/adapters/test_database.py -v`
Expected: all PASS

**Step 5: Commit**

```bash
git add src/growth/adapters/ tests/adapters/
git commit -m "feat: SQLAlchemy table definitions and database setup"
```

---

### Task 12: Show Repository Adapter

**Files:**
- Create: `src/growth/adapters/persistence/show_repo.py`
- Create: `tests/adapters/test_show_repo.py`

**Step 1: Write the failing tests**

```python
# tests/adapters/test_show_repo.py
"""Tests for the SQLAlchemy Show repository."""
from datetime import datetime, timezone
from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from growth.adapters.persistence.database import create_engine_and_tables
from growth.adapters.persistence.show_repo import SqlShowRepository
from growth.domain.models import Show


@pytest.fixture
def engine():
    return create_engine_and_tables("sqlite:///:memory:")


@pytest.fixture
def repo(engine):
    return SqlShowRepository(engine)


def _make_show(**overrides) -> Show:
    defaults = dict(
        show_id=uuid4(),
        artist_name="Test Artist",
        city="Austin",
        venue="The Parish",
        show_time=datetime(2026, 5, 1, 20, 0, tzinfo=timezone.utc),
        timezone="America/Chicago",
        capacity=200,
        tickets_total=200,
        tickets_sold=0,
        currency="USD",
    )
    defaults.update(overrides)
    return Show(**defaults)


class TestSqlShowRepository:
    def test_save_and_get(self, repo):
        show = _make_show()
        repo.save(show)
        retrieved = repo.get(show.show_id)
        assert retrieved is not None
        assert retrieved.show_id == show.show_id
        assert retrieved.artist_name == show.artist_name
        assert retrieved.city == show.city
        assert retrieved.capacity == show.capacity

    def test_get_nonexistent_returns_none(self, repo):
        assert repo.get(uuid4()) is None

    def test_list_all(self, repo):
        s1 = _make_show(artist_name="Artist A")
        s2 = _make_show(artist_name="Artist B")
        repo.save(s1)
        repo.save(s2)
        shows = repo.list_all()
        assert len(shows) == 2
        names = {s.artist_name for s in shows}
        assert names == {"Artist A", "Artist B"}
```

**Step 2: Run tests to verify they fail**

Run: `.venv/bin/pytest tests/adapters/test_show_repo.py -v`
Expected: FAIL with `ModuleNotFoundError`

**Step 3: Implement the Show repository**

```python
# src/growth/adapters/persistence/show_repo.py
"""SQLAlchemy implementation of the Show repository."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import Engine, select
from sqlalchemy.orm import Session

from growth.adapters.persistence.tables import shows
from growth.domain.models import Show


class SqlShowRepository:
    def __init__(self, engine: Engine) -> None:
        self._engine = engine

    def save(self, show: Show) -> None:
        with Session(self._engine) as session:
            session.execute(
                shows.insert().values(
                    show_id=str(show.show_id),
                    artist_name=show.artist_name,
                    city=show.city,
                    venue=show.venue,
                    show_time=show.show_time,
                    timezone=show.timezone,
                    capacity=show.capacity,
                    tickets_total=show.tickets_total,
                    tickets_sold=show.tickets_sold,
                    currency=show.currency,
                    created_at=datetime.now(timezone.utc),
                )
            )
            session.commit()

    def get(self, show_id: UUID) -> Show | None:
        with Session(self._engine) as session:
            row = session.execute(
                select(shows).where(shows.c.show_id == str(show_id))
            ).first()
            if row is None:
                return None
            return self._row_to_show(row)

    def list_all(self) -> list[Show]:
        with Session(self._engine) as session:
            rows = session.execute(select(shows)).all()
            return [self._row_to_show(row) for row in rows]

    @staticmethod
    def _row_to_show(row) -> Show:
        return Show(
            show_id=UUID(row.show_id),
            artist_name=row.artist_name,
            city=row.city,
            venue=row.venue,
            show_time=row.show_time,
            timezone=row.timezone,
            capacity=row.capacity,
            tickets_total=row.tickets_total,
            tickets_sold=row.tickets_sold,
            currency=row.currency,
        )
```

**Step 4: Run tests to verify they pass**

Run: `.venv/bin/pytest tests/adapters/test_show_repo.py -v`
Expected: all PASS

**Step 5: Commit**

```bash
git add src/growth/adapters/persistence/show_repo.py tests/adapters/test_show_repo.py
git commit -m "feat: SQLAlchemy Show repository adapter"
```

---

### Task 13: Experiment and Observation Repository Adapters

**Files:**
- Create: `src/growth/adapters/persistence/experiment_repo.py`
- Create: `src/growth/adapters/persistence/observation_repo.py`
- Create: `tests/adapters/test_experiment_repo.py`
- Create: `tests/adapters/test_observation_repo.py`

**Step 1: Write the failing tests for experiment repo**

```python
# tests/adapters/test_experiment_repo.py
"""Tests for the SQLAlchemy Experiment repository."""
from datetime import datetime, timezone
from uuid import uuid4

import pytest

from growth.adapters.persistence.database import create_engine_and_tables
from growth.adapters.persistence.experiment_repo import SqlExperimentRepository
from growth.adapters.persistence.show_repo import SqlShowRepository
from growth.domain.models import Experiment, ExperimentStatus, Show


@pytest.fixture
def engine():
    return create_engine_and_tables("sqlite:///:memory:")


@pytest.fixture
def show_id(engine):
    """Create a show and return its ID (experiments need a FK)."""
    repo = SqlShowRepository(engine)
    show = Show(
        show_id=uuid4(),
        artist_name="Test",
        city="Austin",
        venue="The Parish",
        show_time=datetime(2026, 5, 1, 20, 0, tzinfo=timezone.utc),
        timezone="America/Chicago",
        capacity=200,
        tickets_total=200,
        tickets_sold=0,
        currency="USD",
    )
    repo.save(show)
    return show.show_id


@pytest.fixture
def repo(engine):
    return SqlExperimentRepository(engine)


def _make_experiment(show_id, **overrides) -> Experiment:
    defaults = dict(
        experiment_id=uuid4(),
        show_id=show_id,
        segment_id=uuid4(),
        frame_id=uuid4(),
        channel="meta",
        objective="ticket_sales",
        budget_cap_cents=5000,
        status=ExperimentStatus.DRAFT,
        start_time=None,
        end_time=None,
        baseline_snapshot={"daily_velocity": 2.5},
    )
    defaults.update(overrides)
    return Experiment(**defaults)


class TestSqlExperimentRepository:
    def test_save_and_get(self, repo, show_id):
        exp = _make_experiment(show_id)
        repo.save(exp)
        retrieved = repo.get(exp.experiment_id)
        assert retrieved is not None
        assert retrieved.experiment_id == exp.experiment_id
        assert retrieved.status == ExperimentStatus.DRAFT
        assert retrieved.channel == "meta"

    def test_get_nonexistent_returns_none(self, repo):
        assert repo.get(uuid4()) is None

    def test_list_by_show(self, repo, show_id):
        e1 = _make_experiment(show_id, channel="meta")
        e2 = _make_experiment(show_id, channel="tiktok")
        repo.save(e1)
        repo.save(e2)
        exps = repo.list_by_show(show_id)
        assert len(exps) == 2

    def test_update_status(self, repo, show_id):
        exp = _make_experiment(show_id)
        repo.save(exp)
        repo.update_status(exp.experiment_id, ExperimentStatus.RUNNING)
        retrieved = repo.get(exp.experiment_id)
        assert retrieved.status == ExperimentStatus.RUNNING
```

**Step 2: Write the failing tests for observation repo**

```python
# tests/adapters/test_observation_repo.py
"""Tests for the SQLAlchemy Observation repository."""
from datetime import datetime, timezone
from uuid import uuid4

import pytest

from growth.adapters.persistence.database import create_engine_and_tables
from growth.adapters.persistence.observation_repo import SqlObservationRepository
from growth.adapters.persistence.show_repo import SqlShowRepository
from growth.adapters.persistence.experiment_repo import SqlExperimentRepository
from growth.domain.models import Experiment, ExperimentStatus, Observation, Show


@pytest.fixture
def engine():
    return create_engine_and_tables("sqlite:///:memory:")


@pytest.fixture
def experiment_id(engine):
    """Create show + experiment, return experiment ID."""
    show_repo = SqlShowRepository(engine)
    show = Show(
        show_id=uuid4(), artist_name="Test", city="Austin", venue="V",
        show_time=datetime(2026, 5, 1, 20, 0, tzinfo=timezone.utc),
        timezone="America/Chicago", capacity=200, tickets_total=200,
        tickets_sold=0, currency="USD",
    )
    show_repo.save(show)

    exp_repo = SqlExperimentRepository(engine)
    exp = Experiment(
        experiment_id=uuid4(), show_id=show.show_id, segment_id=uuid4(),
        frame_id=uuid4(), channel="meta", objective="ticket_sales",
        budget_cap_cents=5000, status=ExperimentStatus.RUNNING,
        start_time=None, end_time=None, baseline_snapshot={},
    )
    exp_repo.save(exp)
    return exp.experiment_id


@pytest.fixture
def repo(engine):
    return SqlObservationRepository(engine)


def _make_observation(experiment_id, **overrides) -> Observation:
    defaults = dict(
        observation_id=uuid4(),
        experiment_id=experiment_id,
        window_start=datetime(2026, 4, 1, 0, 0, tzinfo=timezone.utc),
        window_end=datetime(2026, 4, 2, 0, 0, tzinfo=timezone.utc),
        spend_cents=2500, impressions=10000, clicks=200, sessions=180,
        checkouts=20, purchases=8, revenue_cents=32000, refunds=0,
        refund_cents=0, complaints=0, negative_comment_rate=0.01,
        attribution_model="last_click_utm", raw_json={"source": "manual"},
    )
    defaults.update(overrides)
    return Observation(**defaults)


class TestSqlObservationRepository:
    def test_save_and_list(self, repo, experiment_id):
        o1 = _make_observation(experiment_id)
        o2 = _make_observation(
            experiment_id,
            window_start=datetime(2026, 4, 2, 0, 0, tzinfo=timezone.utc),
            window_end=datetime(2026, 4, 3, 0, 0, tzinfo=timezone.utc),
        )
        repo.save(o1)
        repo.save(o2)
        obs = repo.list_by_experiment(experiment_id)
        assert len(obs) == 2

    def test_list_empty(self, repo):
        assert repo.list_by_experiment(uuid4()) == []
```

**Step 3: Run tests to verify they fail**

Run: `.venv/bin/pytest tests/adapters/test_experiment_repo.py tests/adapters/test_observation_repo.py -v`
Expected: FAIL with `ModuleNotFoundError`

**Step 4: Implement experiment repository**

```python
# src/growth/adapters/persistence/experiment_repo.py
"""SQLAlchemy implementation of the Experiment repository."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import Engine, select, update
from sqlalchemy.orm import Session

from growth.adapters.persistence.tables import experiments
from growth.domain.models import Experiment, ExperimentStatus


class SqlExperimentRepository:
    def __init__(self, engine: Engine) -> None:
        self._engine = engine

    def save(self, experiment: Experiment) -> None:
        with Session(self._engine) as session:
            session.execute(
                experiments.insert().values(
                    experiment_id=str(experiment.experiment_id),
                    show_id=str(experiment.show_id),
                    segment_id=str(experiment.segment_id),
                    frame_id=str(experiment.frame_id),
                    channel=experiment.channel,
                    objective=experiment.objective,
                    budget_cap_cents=experiment.budget_cap_cents,
                    status=experiment.status.value,
                    start_time=experiment.start_time,
                    end_time=experiment.end_time,
                    baseline_snapshot=experiment.baseline_snapshot,
                    created_at=datetime.now(timezone.utc),
                )
            )
            session.commit()

    def get(self, experiment_id: UUID) -> Experiment | None:
        with Session(self._engine) as session:
            row = session.execute(
                select(experiments).where(
                    experiments.c.experiment_id == str(experiment_id)
                )
            ).first()
            if row is None:
                return None
            return self._row_to_experiment(row)

    def list_by_show(self, show_id: UUID) -> list[Experiment]:
        with Session(self._engine) as session:
            rows = session.execute(
                select(experiments).where(experiments.c.show_id == str(show_id))
            ).all()
            return [self._row_to_experiment(row) for row in rows]

    def update_status(self, experiment_id: UUID, status: ExperimentStatus) -> None:
        with Session(self._engine) as session:
            session.execute(
                update(experiments)
                .where(experiments.c.experiment_id == str(experiment_id))
                .values(status=status.value)
            )
            session.commit()

    @staticmethod
    def _row_to_experiment(row) -> Experiment:
        return Experiment(
            experiment_id=UUID(row.experiment_id),
            show_id=UUID(row.show_id),
            segment_id=UUID(row.segment_id),
            frame_id=UUID(row.frame_id),
            channel=row.channel,
            objective=row.objective,
            budget_cap_cents=row.budget_cap_cents,
            status=ExperimentStatus(row.status),
            start_time=row.start_time,
            end_time=row.end_time,
            baseline_snapshot=row.baseline_snapshot,
        )
```

**Step 5: Implement observation repository**

```python
# src/growth/adapters/persistence/observation_repo.py
"""SQLAlchemy implementation of the Observation repository."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import Engine, select
from sqlalchemy.orm import Session

from growth.adapters.persistence.tables import observations
from growth.domain.models import Observation


class SqlObservationRepository:
    def __init__(self, engine: Engine) -> None:
        self._engine = engine

    def save(self, observation: Observation) -> None:
        with Session(self._engine) as session:
            session.execute(
                observations.insert().values(
                    observation_id=str(observation.observation_id),
                    experiment_id=str(observation.experiment_id),
                    window_start=observation.window_start,
                    window_end=observation.window_end,
                    spend_cents=observation.spend_cents,
                    impressions=observation.impressions,
                    clicks=observation.clicks,
                    sessions=observation.sessions,
                    checkouts=observation.checkouts,
                    purchases=observation.purchases,
                    revenue_cents=observation.revenue_cents,
                    refunds=observation.refunds,
                    refund_cents=observation.refund_cents,
                    complaints=observation.complaints,
                    negative_comment_rate=observation.negative_comment_rate,
                    attribution_model=observation.attribution_model,
                    raw_json=observation.raw_json,
                    created_at=datetime.now(timezone.utc),
                )
            )
            session.commit()

    def list_by_experiment(self, experiment_id: UUID) -> list[Observation]:
        with Session(self._engine) as session:
            rows = session.execute(
                select(observations).where(
                    observations.c.experiment_id == str(experiment_id)
                )
            ).all()
            return [self._row_to_observation(row) for row in rows]

    @staticmethod
    def _row_to_observation(row) -> Observation:
        return Observation(
            observation_id=UUID(row.observation_id),
            experiment_id=UUID(row.experiment_id),
            window_start=row.window_start,
            window_end=row.window_end,
            spend_cents=row.spend_cents,
            impressions=row.impressions,
            clicks=row.clicks,
            sessions=row.sessions,
            checkouts=row.checkouts,
            purchases=row.purchases,
            revenue_cents=row.revenue_cents,
            refunds=row.refunds,
            refund_cents=row.refund_cents,
            complaints=row.complaints,
            negative_comment_rate=float(row.negative_comment_rate) if row.negative_comment_rate is not None else None,
            attribution_model=row.attribution_model,
            raw_json=row.raw_json,
        )
```

**Step 6: Run tests to verify they pass**

Run: `.venv/bin/pytest tests/adapters/ -v`
Expected: all PASS

**Step 7: Commit**

```bash
git add src/growth/adapters/persistence/ tests/adapters/
git commit -m "feat: Experiment and Observation repository adapters"
```

---

### Task 14: Decision Repository Adapter

**Files:**
- Create: `src/growth/adapters/persistence/decision_repo.py`
- Create: `tests/adapters/test_decision_repo.py`

**Step 1: Write the failing tests**

```python
# tests/adapters/test_decision_repo.py
"""Tests for the SQLAlchemy Decision repository."""
from datetime import datetime, timezone
from uuid import uuid4

import pytest

from growth.adapters.persistence.database import create_engine_and_tables
from growth.adapters.persistence.decision_repo import SqlDecisionRepository
from growth.adapters.persistence.show_repo import SqlShowRepository
from growth.adapters.persistence.experiment_repo import SqlExperimentRepository
from growth.domain.models import (
    Decision,
    DecisionAction,
    Experiment,
    ExperimentStatus,
    Show,
)


@pytest.fixture
def engine():
    return create_engine_and_tables("sqlite:///:memory:")


@pytest.fixture
def experiment_id(engine):
    show_repo = SqlShowRepository(engine)
    show = Show(
        show_id=uuid4(), artist_name="Test", city="Austin", venue="V",
        show_time=datetime(2026, 5, 1, 20, 0, tzinfo=timezone.utc),
        timezone="America/Chicago", capacity=200, tickets_total=200,
        tickets_sold=0, currency="USD",
    )
    show_repo.save(show)

    exp_repo = SqlExperimentRepository(engine)
    exp = Experiment(
        experiment_id=uuid4(), show_id=show.show_id, segment_id=uuid4(),
        frame_id=uuid4(), channel="meta", objective="ticket_sales",
        budget_cap_cents=5000, status=ExperimentStatus.RUNNING,
        start_time=None, end_time=None, baseline_snapshot={},
    )
    exp_repo.save(exp)
    return exp.experiment_id


@pytest.fixture
def repo(engine):
    return SqlDecisionRepository(engine)


class TestSqlDecisionRepository:
    def test_save_and_get_latest(self, repo, experiment_id):
        d1 = Decision(
            decision_id=uuid4(), experiment_id=experiment_id,
            action=DecisionAction.HOLD, confidence=0.4,
            rationale="Waiting for more data.",
            policy_version="v1", metrics_snapshot={"cac": 500},
        )
        d2 = Decision(
            decision_id=uuid4(), experiment_id=experiment_id,
            action=DecisionAction.SCALE, confidence=0.85,
            rationale="Strong performance.",
            policy_version="v1", metrics_snapshot={"cac": 300},
        )
        repo.save(d1)
        repo.save(d2)
        latest = repo.get_latest(experiment_id)
        assert latest is not None
        assert latest.action == DecisionAction.SCALE

    def test_get_latest_nonexistent(self, repo):
        assert repo.get_latest(uuid4()) is None

    def test_list_by_experiment(self, repo, experiment_id):
        d1 = Decision(
            decision_id=uuid4(), experiment_id=experiment_id,
            action=DecisionAction.HOLD, confidence=0.3,
            rationale="R1", policy_version="v1", metrics_snapshot={},
        )
        d2 = Decision(
            decision_id=uuid4(), experiment_id=experiment_id,
            action=DecisionAction.KILL, confidence=0.9,
            rationale="R2", policy_version="v1", metrics_snapshot={},
        )
        repo.save(d1)
        repo.save(d2)
        decisions = repo.list_by_experiment(experiment_id)
        assert len(decisions) == 2
```

**Step 2: Run tests to verify they fail**

Run: `.venv/bin/pytest tests/adapters/test_decision_repo.py -v`
Expected: FAIL with `ModuleNotFoundError`

**Step 3: Implement decision repository**

```python
# src/growth/adapters/persistence/decision_repo.py
"""SQLAlchemy implementation of the Decision repository."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import Engine, select
from sqlalchemy.orm import Session

from growth.adapters.persistence.tables import decisions
from growth.domain.models import Decision, DecisionAction


class SqlDecisionRepository:
    def __init__(self, engine: Engine) -> None:
        self._engine = engine

    def save(self, decision: Decision) -> None:
        with Session(self._engine) as session:
            session.execute(
                decisions.insert().values(
                    decision_id=str(decision.decision_id),
                    experiment_id=str(decision.experiment_id),
                    action=decision.action.value,
                    confidence=decision.confidence,
                    rationale=decision.rationale,
                    policy_version=decision.policy_version,
                    metrics_snapshot=decision.metrics_snapshot,
                    created_at=datetime.now(timezone.utc),
                )
            )
            session.commit()

    def get_latest(self, experiment_id: UUID) -> Decision | None:
        with Session(self._engine) as session:
            row = session.execute(
                select(decisions)
                .where(decisions.c.experiment_id == str(experiment_id))
                .order_by(decisions.c.created_at.desc())
                .limit(1)
            ).first()
            if row is None:
                return None
            return self._row_to_decision(row)

    def list_by_experiment(self, experiment_id: UUID) -> list[Decision]:
        with Session(self._engine) as session:
            rows = session.execute(
                select(decisions)
                .where(decisions.c.experiment_id == str(experiment_id))
                .order_by(decisions.c.created_at)
            ).all()
            return [self._row_to_decision(row) for row in rows]

    @staticmethod
    def _row_to_decision(row) -> Decision:
        return Decision(
            decision_id=UUID(row.decision_id),
            experiment_id=UUID(row.experiment_id),
            action=DecisionAction(row.action),
            confidence=float(row.confidence),
            rationale=row.rationale,
            policy_version=row.policy_version,
            metrics_snapshot=row.metrics_snapshot,
        )
```

**Step 4: Run tests to verify they pass**

Run: `.venv/bin/pytest tests/adapters/test_decision_repo.py -v`
Expected: all PASS

**Step 5: Commit**

```bash
git add src/growth/adapters/persistence/decision_repo.py tests/adapters/test_decision_repo.py
git commit -m "feat: Decision repository adapter"
```

---

### Task 15: JSONL Event Log Adapter

**Files:**
- Create: `src/growth/adapters/persistence/jsonl_event_log.py`
- Create: `tests/adapters/test_jsonl_event_log.py`

**Step 1: Write the failing tests**

```python
# tests/adapters/test_jsonl_event_log.py
"""Tests for the JSONL event log adapter."""
import json
from pathlib import Path
from uuid import uuid4

import pytest

from growth.adapters.persistence.jsonl_event_log import JsonlEventLog
from growth.domain.events import EventType, make_event


@pytest.fixture
def tmp_log(tmp_path) -> Path:
    return tmp_path / "events.jsonl"


@pytest.fixture
def log(tmp_log):
    return JsonlEventLog(tmp_log)


class TestJsonlEventLog:
    def test_append_creates_file(self, log, tmp_log):
        event = make_event(
            event_type=EventType.EXPERIMENT_CREATED,
            show_id=uuid4(),
            experiment_id=uuid4(),
            actor="system",
            payload={"channel": "meta"},
        )
        log.append(event)
        assert tmp_log.exists()
        lines = tmp_log.read_text().strip().split("\n")
        assert len(lines) == 1
        parsed = json.loads(lines[0])
        assert parsed["event_type"] == "experiment.created"

    def test_append_multiple_events(self, log, tmp_log):
        for _ in range(3):
            event = make_event(
                event_type=EventType.DECISION_ISSUED,
                show_id=uuid4(),
                experiment_id=uuid4(),
                actor="system",
                payload={},
            )
            log.append(event)
        lines = tmp_log.read_text().strip().split("\n")
        assert len(lines) == 3

    def test_list_by_show(self, log):
        show_id = uuid4()
        other_show = uuid4()
        log.append(make_event(EventType.EXPERIMENT_CREATED, show_id, uuid4(), "system", {}))
        log.append(make_event(EventType.EXPERIMENT_CREATED, other_show, uuid4(), "system", {}))
        log.append(make_event(EventType.DECISION_ISSUED, show_id, uuid4(), "system", {}))
        events = log.list_by_show(show_id)
        assert len(events) == 2

    def test_list_by_experiment(self, log):
        exp_id = uuid4()
        log.append(make_event(EventType.EXPERIMENT_CREATED, uuid4(), exp_id, "system", {}))
        log.append(make_event(EventType.EXPERIMENT_LAUNCHED, uuid4(), exp_id, "system", {}))
        log.append(make_event(EventType.EXPERIMENT_CREATED, uuid4(), uuid4(), "system", {}))
        events = log.list_by_experiment(exp_id)
        assert len(events) == 2

    def test_list_by_type(self, log):
        log.append(make_event(EventType.EXPERIMENT_CREATED, uuid4(), uuid4(), "system", {}))
        log.append(make_event(EventType.DECISION_ISSUED, uuid4(), uuid4(), "system", {}))
        log.append(make_event(EventType.EXPERIMENT_CREATED, uuid4(), uuid4(), "system", {}))
        events = log.list_by_type(EventType.EXPERIMENT_CREATED)
        assert len(events) == 2

    def test_list_from_empty_file(self, log):
        assert log.list_by_show(uuid4()) == []
```

**Step 2: Run tests to verify they fail**

Run: `.venv/bin/pytest tests/adapters/test_jsonl_event_log.py -v`
Expected: FAIL with `ModuleNotFoundError`

**Step 3: Implement the JSONL event log**

```python
# src/growth/adapters/persistence/jsonl_event_log.py
"""Append-only JSONL event log."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from growth.domain.events import DomainEvent, EventType


class JsonlEventLog:
    def __init__(self, path: Path) -> None:
        self._path = path

    def append(self, event: DomainEvent) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        with open(self._path, "a") as f:
            f.write(json.dumps(event.to_dict()) + "\n")

    def _read_all(self) -> list[DomainEvent]:
        if not self._path.exists():
            return []
        events = []
        with open(self._path) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                d = json.loads(line)
                events.append(
                    DomainEvent(
                        event_id=UUID(d["event_id"]),
                        event_type=EventType(d["event_type"]),
                        occurred_at=datetime.fromisoformat(d["occurred_at"]),
                        show_id=UUID(d["show_id"]),
                        experiment_id=UUID(d["experiment_id"]) if d["experiment_id"] else None,
                        actor=d["actor"],
                        payload=d["payload"],
                    )
                )
        return events

    def list_by_show(self, show_id: UUID) -> list[DomainEvent]:
        return [e for e in self._read_all() if e.show_id == show_id]

    def list_by_experiment(self, experiment_id: UUID) -> list[DomainEvent]:
        return [e for e in self._read_all() if e.experiment_id == experiment_id]

    def list_by_type(self, event_type: EventType) -> list[DomainEvent]:
        return [e for e in self._read_all() if e.event_type == event_type]
```

**Step 4: Run tests to verify they pass**

Run: `.venv/bin/pytest tests/adapters/test_jsonl_event_log.py -v`
Expected: all PASS

**Step 5: Commit**

```bash
git add src/growth/adapters/persistence/jsonl_event_log.py tests/adapters/test_jsonl_event_log.py
git commit -m "feat: JSONL append-only event log adapter"
```

---

### Task 16: Full Integration Test — End-to-End Decision from Manual Data

**Files:**
- Create: `tests/test_integration.py`

This test exercises the full Phase 0 flow: create a show, create an experiment, add observations, run the decision engine, verify the outcome. It proves the domain + persistence layers work together.

**Step 1: Write the failing test**

```python
# tests/test_integration.py
"""Integration test: full decision flow from manual data."""
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import pytest

from growth.adapters.persistence.database import create_engine_and_tables
from growth.adapters.persistence.decision_repo import SqlDecisionRepository
from growth.adapters.persistence.experiment_repo import SqlExperimentRepository
from growth.adapters.persistence.jsonl_event_log import JsonlEventLog
from growth.adapters.persistence.observation_repo import SqlObservationRepository
from growth.adapters.persistence.show_repo import SqlShowRepository
from growth.domain.events import EventType, make_event
from growth.domain.models import (
    Decision,
    DecisionAction,
    Experiment,
    ExperimentStatus,
    Observation,
    Show,
)
from growth.domain.policies import evaluate
from growth.domain.policy_config import PolicyConfig, load_policy_config


@pytest.fixture
def engine():
    return create_engine_and_tables("sqlite:///:memory:")


@pytest.fixture
def config():
    return load_policy_config(Path(__file__).parents[1] / "config" / "policy.toml")


class TestEndToEndDecision:
    def test_full_flow_scale_decision(self, engine, config, tmp_path):
        # Repos
        show_repo = SqlShowRepository(engine)
        exp_repo = SqlExperimentRepository(engine)
        obs_repo = SqlObservationRepository(engine)
        decision_repo = SqlDecisionRepository(engine)
        event_log = JsonlEventLog(tmp_path / "events.jsonl")

        # 1. Create show
        show = Show(
            show_id=uuid4(), artist_name="Luna Ray", city="Austin",
            venue="The Parish",
            show_time=datetime(2026, 5, 1, 20, 0, tzinfo=timezone.utc),
            timezone="America/Chicago", capacity=200, tickets_total=200,
            tickets_sold=20, currency="USD",
        )
        show_repo.save(show)

        # 2. Create experiment
        experiment = Experiment(
            experiment_id=uuid4(), show_id=show.show_id,
            segment_id=uuid4(), frame_id=uuid4(),
            channel="meta", objective="ticket_sales",
            budget_cap_cents=10000, status=ExperimentStatus.RUNNING,
            start_time=datetime(2026, 4, 1, 0, 0, tzinfo=timezone.utc),
            end_time=None,
            baseline_snapshot={"daily_velocity": 1.0, "cac_cents": 800, "conversion_rate": 0.02},
        )
        exp_repo.save(experiment)
        event_log.append(make_event(
            EventType.EXPERIMENT_CREATED, show.show_id,
            experiment.experiment_id, "system",
            {"channel": "meta"},
        ))

        # 3. Add observations (3 windows, strong performance)
        for i in range(3):
            obs = Observation(
                observation_id=uuid4(),
                experiment_id=experiment.experiment_id,
                window_start=datetime(2026, 4, 1 + i, 0, 0, tzinfo=timezone.utc),
                window_end=datetime(2026, 4, 2 + i, 0, 0, tzinfo=timezone.utc),
                spend_cents=1000, impressions=5000, clicks=100,
                sessions=90, checkouts=10, purchases=4,
                revenue_cents=16000, refunds=0, refund_cents=0,
                complaints=0, negative_comment_rate=0.01,
                attribution_model="last_click_utm",
                raw_json={"source": "manual"},
            )
            obs_repo.save(obs)

        # 4. Aggregate observations
        observations = obs_repo.list_by_experiment(experiment.experiment_id)
        total_clicks = sum(o.clicks for o in observations)
        total_purchases = sum(o.purchases for o in observations)
        total_spend = sum(o.spend_cents for o in observations)
        total_revenue = sum(o.revenue_cents for o in observations)
        total_refunds = sum(o.refunds for o in observations)
        total_complaints = sum(o.complaints for o in observations)
        conversion_rate = total_purchases / total_clicks if total_clicks > 0 else 0.0
        refund_rate = total_refunds / total_purchases if total_purchases > 0 else 0.0
        complaint_rate = total_complaints / total_purchases if total_purchases > 0 else 0.0
        neg_comment_rates = [o.negative_comment_rate for o in observations if o.negative_comment_rate is not None]
        avg_neg_rate = sum(neg_comment_rates) / len(neg_comment_rates) if neg_comment_rates else 0.0

        # 5. Run decision engine
        result = evaluate(
            num_windows=len(observations),
            total_clicks=total_clicks,
            total_purchases=total_purchases,
            spend_cents=total_spend,
            budget_cap_cents=experiment.budget_cap_cents,
            revenue_cents=total_revenue,
            refund_rate=refund_rate,
            complaint_rate=complaint_rate,
            negative_comment_rate=avg_neg_rate,
            conversion_rate=conversion_rate,
            baseline_conversion_rate=experiment.baseline_snapshot["conversion_rate"],
            baseline_cac_cents=experiment.baseline_snapshot["cac_cents"],
            config=config,
        )

        # 6. Save decision
        decision = Decision(
            decision_id=uuid4(),
            experiment_id=experiment.experiment_id,
            action=result.action,
            confidence=result.confidence,
            rationale=result.rationale,
            policy_version="v1",
            metrics_snapshot={
                "total_clicks": total_clicks,
                "total_purchases": total_purchases,
                "total_spend_cents": total_spend,
                "cac_cents": total_spend // total_purchases,
                "conversion_rate": conversion_rate,
            },
        )
        decision_repo.save(decision)
        event_log.append(make_event(
            EventType.DECISION_ISSUED, show.show_id,
            experiment.experiment_id, "system",
            {"action": result.action.value, "confidence": result.confidence},
        ))

        # 7. Verify
        assert result.action == DecisionAction.SCALE
        saved = decision_repo.get_latest(experiment.experiment_id)
        assert saved.action == DecisionAction.SCALE
        events = event_log.list_by_experiment(experiment.experiment_id)
        assert len(events) == 2  # created + decision

    def test_full_flow_kill_decision(self, engine, config, tmp_path):
        show_repo = SqlShowRepository(engine)
        exp_repo = SqlExperimentRepository(engine)
        obs_repo = SqlObservationRepository(engine)
        event_log = JsonlEventLog(tmp_path / "events.jsonl")

        show = Show(
            show_id=uuid4(), artist_name="Ghost Band", city="Portland",
            venue="Doug Fir Lounge",
            show_time=datetime(2026, 5, 15, 21, 0, tzinfo=timezone.utc),
            timezone="America/Los_Angeles", capacity=250, tickets_total=250,
            tickets_sold=10, currency="USD",
        )
        show_repo.save(show)

        experiment = Experiment(
            experiment_id=uuid4(), show_id=show.show_id,
            segment_id=uuid4(), frame_id=uuid4(),
            channel="tiktok", objective="ticket_sales",
            budget_cap_cents=5000, status=ExperimentStatus.RUNNING,
            start_time=None, end_time=None,
            baseline_snapshot={"daily_velocity": 0.5, "cac_cents": 1000, "conversion_rate": 0.015},
        )
        exp_repo.save(experiment)

        # Budget exhausted, zero purchases
        for i in range(2):
            obs = Observation(
                observation_id=uuid4(),
                experiment_id=experiment.experiment_id,
                window_start=datetime(2026, 4, 1 + i, 0, 0, tzinfo=timezone.utc),
                window_end=datetime(2026, 4, 2 + i, 0, 0, tzinfo=timezone.utc),
                spend_cents=2500, impressions=8000, clicks=100,
                sessions=80, checkouts=0, purchases=0,
                revenue_cents=0, refunds=0, refund_cents=0,
                complaints=0, negative_comment_rate=0.02,
                attribution_model="last_click_utm",
                raw_json={"source": "manual"},
            )
            obs_repo.save(obs)

        observations = obs_repo.list_by_experiment(experiment.experiment_id)
        total_clicks = sum(o.clicks for o in observations)
        total_purchases = sum(o.purchases for o in observations)
        total_spend = sum(o.spend_cents for o in observations)

        result = evaluate(
            num_windows=len(observations),
            total_clicks=total_clicks,
            total_purchases=total_purchases,
            spend_cents=total_spend,
            budget_cap_cents=experiment.budget_cap_cents,
            revenue_cents=0,
            refund_rate=0.0,
            complaint_rate=0.0,
            negative_comment_rate=0.02,
            conversion_rate=0.0,
            baseline_conversion_rate=experiment.baseline_snapshot["conversion_rate"],
            baseline_cac_cents=experiment.baseline_snapshot["cac_cents"],
            config=config,
        )

        assert result.action == DecisionAction.KILL
```

**Step 2: Run tests to verify they pass**

Run: `.venv/bin/pytest tests/test_integration.py -v`
Expected: all PASS (this is a new integration test using code from previous tasks)

**Step 3: Run full test suite**

Run: `.venv/bin/pytest -v`
Expected: all tests PASS

**Step 4: Commit**

```bash
git add tests/test_integration.py
git commit -m "feat: end-to-end integration tests — full decision flow from manual data"
```

---

## Summary

After completing all 16 tasks, Phase 0 delivers:

| Layer | What's built |
|-------|-------------|
| **Domain models** | Show, AudienceSegment, CreativeFrame, CreativeVariant, Experiment, Observation, Decision, ProducerMemo — all frozen dataclasses |
| **Decision engine** | Deterministic Scale/Hold/Kill with guardrails, evidence minimums, kill conditions, scale conditions, confidence scoring |
| **Policy config** | TOML-driven thresholds loaded into a frozen PolicyConfig |
| **UTM** | Generation, parsing, URL building following the project taxonomy |
| **Domain events** | Event envelope contract with serialization |
| **Persistence ports** | Protocol interfaces for all repositories + event log |
| **SQLAlchemy adapters** | Show, Experiment, Observation, Decision repos against SQLite |
| **Event log adapter** | Append-only JSONL file |
| **Integration tests** | Full flow: show → experiment → observations → decision → verification |

Next phase (Phase 1) will add the FastAPI API layer on top of this foundation.
