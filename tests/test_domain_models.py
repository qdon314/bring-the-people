"""Tests for updated domain models after entity refactor."""
from uuid import uuid4
from datetime import datetime, timezone
from growth.domain.models import Experiment, ExperimentRun, RunStatus, Observation, Decision, DecisionAction


def test_experiment_has_no_status():
    exp = Experiment(
        experiment_id=uuid4(),
        show_id=uuid4(),
        origin_cycle_id=uuid4(),
        segment_id=uuid4(),
        frame_id=uuid4(),
        channel="meta",
        objective="ticket_sales",
        budget_cap_cents=5000,
        baseline_snapshot={},
    )
    assert not hasattr(exp, "status")
    assert not hasattr(exp, "start_time")
    assert not hasattr(exp, "end_time")
    assert exp.origin_cycle_id is not None


def test_experiment_run_has_status():
    run = ExperimentRun(
        run_id=uuid4(),
        experiment_id=uuid4(),
        cycle_id=uuid4(),
        status=RunStatus.DRAFT,
        start_time=None,
        end_time=None,
    )
    assert run.status == RunStatus.DRAFT


def test_observation_has_run_id():
    obs = Observation(
        observation_id=uuid4(),
        run_id=uuid4(),
        window_start=datetime(2026, 4, 1, tzinfo=timezone.utc),
        window_end=datetime(2026, 4, 2, tzinfo=timezone.utc),
        spend_cents=1000,
        impressions=5000,
        clicks=100,
        sessions=90,
        checkouts=10,
        purchases=3,
        revenue_cents=12000,
        refunds=0,
        refund_cents=0,
        complaints=0,
        negative_comment_rate=None,
        attribution_model="last_click_utm",
        raw_json={},
    )
    assert hasattr(obs, "run_id")
    assert not hasattr(obs, "experiment_id")


def test_decision_has_run_id():
    d = Decision(
        decision_id=uuid4(),
        run_id=uuid4(),
        action=DecisionAction.SCALE,
        confidence=0.8,
        rationale="good",
        policy_version="v1",
        metrics_snapshot={},
    )
    assert hasattr(d, "run_id")
    assert not hasattr(d, "experiment_id")


def test_run_status_values():
    assert RunStatus.DRAFT.value == "draft"
    assert RunStatus.AWAITING_APPROVAL.value == "awaiting_approval"
    assert RunStatus.ACTIVE.value == "active"
    assert RunStatus.DECIDED.value == "decided"
