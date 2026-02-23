"""Tests for domain events."""
from datetime import datetime, timezone
from uuid import uuid4

from growth.domain.events import (
    DecisionRecorded,
    ExperimentApproved,
    ExperimentCompleted,
    ExperimentStarted,
    ObservationAdded,
)
from growth.domain.models import DecisionAction


class TestExperimentStarted:
    def test_event_structure(self):
        event = ExperimentStarted(
            event_id=uuid4(),
            experiment_id=uuid4(),
            show_id=uuid4(),
            channel="meta",
            objective="ticket_sales",
            budget_cap_cents=5000,
            baseline_snapshot={"cac_cents": 800},
            occurred_at=datetime(2026, 4, 1, 10, 0, tzinfo=timezone.utc),
        )
        assert event.event_type == "experiment_started"
        assert event.channel == "meta"
        assert event.budget_cap_cents == 5000


class TestObservationAdded:
    def test_event_structure(self):
        event = ObservationAdded(
            event_id=uuid4(),
            observation_id=uuid4(),
            experiment_id=uuid4(),
            window_start=datetime(2026, 4, 1, 0, 0, tzinfo=timezone.utc),
            window_end=datetime(2026, 4, 2, 0, 0, tzinfo=timezone.utc),
            spend_cents=2500,
            purchases=8,
            revenue_cents=32000,
            occurred_at=datetime(2026, 4, 2, 10, 0, tzinfo=timezone.utc),
        )
        assert event.event_type == "observation_added"
        assert event.purchases == 8


class TestDecisionRecorded:
    def test_event_structure(self):
        event = DecisionRecorded(
            event_id=uuid4(),
            decision_id=uuid4(),
            experiment_id=uuid4(),
            action=DecisionAction.SCALE,
            confidence=0.82,
            rationale="Strong CAC improvement",
            policy_version="v1",
            occurred_at=datetime(2026, 4, 3, 10, 0, tzinfo=timezone.utc),
        )
        assert event.event_type == "decision_recorded"
        assert event.action == DecisionAction.SCALE
        assert event.confidence == 0.82


class TestExperimentApproved:
    def test_event_structure(self):
        event = ExperimentApproved(
            event_id=uuid4(),
            experiment_id=uuid4(),
            show_id=uuid4(),
            approved_by="producer@example.com",
            approved_at=datetime(2026, 4, 1, 9, 0, tzinfo=timezone.utc),
            occurred_at=datetime(2026, 4, 1, 9, 0, tzinfo=timezone.utc),
        )
        assert event.event_type == "experiment_approved"
        assert event.approved_by == "producer@example.com"


class TestExperimentCompleted:
    def test_event_structure(self):
        event = ExperimentCompleted(
            event_id=uuid4(),
            experiment_id=uuid4(),
            show_id=uuid4(),
            final_action=DecisionAction.KILL,
            total_spend_cents=5000,
            total_purchases=2,
            total_revenue_cents=8000,
            occurred_at=datetime(2026, 4, 10, 10, 0, tzinfo=timezone.utc),
        )
        assert event.event_type == "experiment_completed"
        assert event.final_action == DecisionAction.KILL
        assert event.total_spend_cents == 5000


def test_strategy_completed_event():
    from growth.domain.events import StrategyCompleted
    event = StrategyCompleted(
        event_id=uuid4(),
        occurred_at=datetime.now(timezone.utc),
        show_id=uuid4(),
        run_id=uuid4(),
        num_frame_plans=4,
        segment_ids=tuple(uuid4() for _ in range(4)),
        frame_ids=tuple(uuid4() for _ in range(4)),
        turns_used=7,
        total_input_tokens=3500,
        total_output_tokens=1200,
    )
    assert event.event_type == "strategy_completed"
    assert event.num_frame_plans == 4


def test_strategy_failed_event():
    from growth.domain.events import StrategyFailed
    event = StrategyFailed(
        event_id=uuid4(),
        occurred_at=datetime.now(timezone.utc),
        show_id=uuid4(),
        run_id=uuid4(),
        error_type="AgentTurnLimitError",
        error_message="Agent exceeded maximum turns (10)",
    )
    assert event.event_type == "strategy_failed"
    assert event.error_type == "AgentTurnLimitError"
