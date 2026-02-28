"""Tests for domain models."""
from datetime import datetime, timezone
from uuid import uuid4

import pytest

from growth.domain.models import (
    AudienceSegment,
    CreativeFrame,
    CreativeVariant,
    Decision,
    DecisionAction,
    Experiment,
    ExperimentStatus,
    Observation,
    ProducerMemo,
    ReviewStatus,
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
        assert ExperimentStatus.ACTIVE.value == "active"
        assert ExperimentStatus.AWAITING_APPROVAL.value == "awaiting_approval"
        assert ExperimentStatus.DECIDED.value == "decided"

    def test_has_exactly_four_members(self):
        assert len(ExperimentStatus) == 4


class TestDecisionAction:
    def test_valid_actions(self):
        assert DecisionAction.SCALE.value == "scale"
        assert DecisionAction.HOLD.value == "hold"
        assert DecisionAction.KILL.value == "kill"


class TestReviewStatus:
    def test_valid_statuses(self):
        assert ReviewStatus.PENDING.value == "pending"
        assert ReviewStatus.APPROVED.value == "approved"
        assert ReviewStatus.REJECTED.value == "rejected"


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
            exp.status = ExperimentStatus.ACTIVE


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
