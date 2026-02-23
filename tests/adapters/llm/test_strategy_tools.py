"""Tests for Strategy Agent tool functions."""
from datetime import datetime, timezone, timedelta
from uuid import uuid4

import pytest

from growth.adapters.llm.strategy_tools import (
    get_active_experiments,
    get_budget_status,
    get_show_details,
    query_knowledge_base,
)
from growth.adapters.orm import create_tables, get_engine, get_session_maker
from growth.adapters.repositories import (
    SQLAlchemyExperimentRepository,
    SQLAlchemyFrameRepository,
    SQLAlchemySegmentRepository,
    SQLAlchemyShowRepository,
)
from growth.domain.models import (
    AudienceSegment,
    CreativeFrame,
    Decision,
    DecisionAction,
    Experiment,
    ExperimentStatus,
    Observation,
    Show,
)
from growth.domain.policy_config import PolicyConfig


def _test_policy() -> PolicyConfig:
    return PolicyConfig(
        min_windows=2, min_clicks=150, min_purchases=5,
        min_incremental_tickets_per_100usd=0.0,
        max_cac_vs_baseline_ratio=0.85,
        min_conversion_rate_vs_baseline_ratio=0.50,
        max_refund_rate=0.10, max_complaint_rate=0.05,
        max_negative_comment_rate=0.15,
        confidence_weight_sample=0.4, confidence_weight_lift=0.4,
        confidence_weight_consistency=0.2,
        discovery_max_pct=0.10, validation_max_pct=0.20,
        scale_max_pct=0.40,
    )


@pytest.fixture
def repos(tmp_path):
    db_path = tmp_path / "test.db"
    engine = get_engine(f"sqlite:///{db_path}")
    create_tables(engine)
    Session = get_session_maker(engine)
    session = Session()

    yield {
        "show_repo": SQLAlchemyShowRepository(session),
        "exp_repo": SQLAlchemyExperimentRepository(session),
        "seg_repo": SQLAlchemySegmentRepository(session),
        "frame_repo": SQLAlchemyFrameRepository(session),
    }
    session.close()


def _create_show(show_repo, **overrides) -> Show:
    defaults = {
        "show_id": uuid4(),
        "artist_name": "Test Artist",
        "city": "Austin",
        "venue": "The Parish",
        "show_time": datetime.now(timezone.utc) + timedelta(days=30),
        "timezone": "America/Chicago",
        "capacity": 200,
        "tickets_total": 200,
        "tickets_sold": 50,
    }
    defaults.update(overrides)
    show = Show(**defaults)
    show_repo.save(show)
    return show


class TestGetShowDetails:
    def test_returns_show_info(self, repos):
        show = _create_show(repos["show_repo"])
        result = get_show_details(show_id=show.show_id, show_repo=repos["show_repo"])
        assert result["artist_name"] == "Test Artist"
        assert result["city"] == "Austin"
        assert result["capacity"] == 200
        assert result["tickets_sold"] == 50
        assert "phase" in result
        assert "days_until_show" in result

    def test_returns_early_phase(self, repos):
        show = _create_show(
            repos["show_repo"],
            show_time=datetime.now(timezone.utc) + timedelta(days=40),
        )
        result = get_show_details(show.show_id, repos["show_repo"])
        assert result["phase"] == "early"

    def test_returns_late_phase(self, repos):
        show = _create_show(
            repos["show_repo"],
            show_time=datetime.now(timezone.utc) + timedelta(days=3),
        )
        result = get_show_details(show.show_id, repos["show_repo"])
        assert result["phase"] == "late"

    def test_show_not_found(self, repos):
        result = get_show_details(uuid4(), repos["show_repo"])
        assert result["error"] == "show_not_found"


class TestGetActiveExperiments:
    def test_returns_running_experiments(self, repos):
        show = _create_show(repos["show_repo"])
        seg = AudienceSegment(
            segment_id=uuid4(), show_id=show.show_id,
            name="Test Segment", definition_json={},
            estimated_size=1000, created_by="test",
        )
        repos["seg_repo"].save(seg)
        frame = CreativeFrame(
            frame_id=uuid4(), show_id=show.show_id, segment_id=seg.segment_id,
            hypothesis="Test hypothesis", promise="Test promise",
            evidence_refs=[], risk_notes=None,
        )
        repos["frame_repo"].save(frame)

        exp = Experiment(
            experiment_id=uuid4(), show_id=show.show_id,
            segment_id=seg.segment_id, frame_id=frame.frame_id,
            channel="meta", objective="ticket_sales",
            budget_cap_cents=5000, status=ExperimentStatus.RUNNING,
            start_time=datetime.now(timezone.utc), end_time=None,
            baseline_snapshot={},
        )
        repos["exp_repo"].save(exp)

        result = get_active_experiments(
            show_id=show.show_id,
            exp_repo=repos["exp_repo"],
            seg_repo=repos["seg_repo"],
            frame_repo=repos["frame_repo"],
        )
        assert len(result["experiments"]) == 1
        assert result["experiments"][0]["segment_name"] == "Test Segment"
        assert result["experiments"][0]["status"] == "running"

    def test_excludes_completed_experiments(self, repos):
        show = _create_show(repos["show_repo"])
        exp = Experiment(
            experiment_id=uuid4(), show_id=show.show_id,
            segment_id=uuid4(), frame_id=uuid4(),
            channel="meta", objective="ticket_sales",
            budget_cap_cents=5000, status=ExperimentStatus.COMPLETED,
            start_time=datetime.now(timezone.utc), end_time=None,
            baseline_snapshot={},
        )
        repos["exp_repo"].save(exp)

        result = get_active_experiments(
            show.show_id, repos["exp_repo"], repos["seg_repo"], repos["frame_repo"],
        )
        assert len(result["experiments"]) == 0

    def test_no_experiments(self, repos):
        show = _create_show(repos["show_repo"])
        result = get_active_experiments(
            show.show_id, repos["exp_repo"], repos["seg_repo"], repos["frame_repo"],
        )
        assert result["experiments"] == []


class TestGetBudgetStatus:
    def test_computes_remaining_budget(self, repos):
        show = _create_show(repos["show_repo"])
        exp = Experiment(
            experiment_id=uuid4(), show_id=show.show_id,
            segment_id=uuid4(), frame_id=uuid4(),
            channel="meta", objective="ticket_sales",
            budget_cap_cents=5000, status=ExperimentStatus.RUNNING,
            start_time=datetime.now(timezone.utc), end_time=None,
            baseline_snapshot={},
        )
        repos["exp_repo"].save(exp)
        obs = Observation(
            observation_id=uuid4(), experiment_id=exp.experiment_id,
            window_start=datetime.now(timezone.utc) - timedelta(days=1),
            window_end=datetime.now(timezone.utc),
            spend_cents=2000, impressions=5000, clicks=100,
            sessions=90, checkouts=10, purchases=3,
            revenue_cents=12000, refunds=0, refund_cents=0,
            complaints=0, negative_comment_rate=0.01,
            attribution_model="last_click_utm", raw_json={},
        )
        repos["exp_repo"].add_observation(obs)

        result = get_budget_status(
            show_id=show.show_id,
            show_repo=repos["show_repo"],
            exp_repo=repos["exp_repo"],
            policy=_test_policy(),
            total_budget_cents=50000,
        )
        assert result["total_budget_cents"] == 50000
        assert result["spent_cents"] == 2000
        assert result["remaining_cents"] == 48000
        assert "phase" in result
        assert "current_phase_cap_cents" in result

    def test_no_spend(self, repos):
        show = _create_show(repos["show_repo"])
        result = get_budget_status(
            show.show_id, repos["show_repo"], repos["exp_repo"],
            _test_policy(), total_budget_cents=50000,
        )
        assert result["spent_cents"] == 0
        assert result["remaining_cents"] == 50000

    def test_show_not_found(self, repos):
        result = get_budget_status(
            uuid4(), repos["show_repo"], repos["exp_repo"],
            _test_policy(), total_budget_cents=50000,
        )
        assert result["error"] == "show_not_found"


class TestQueryKnowledgeBase:
    def test_returns_past_experiment_summaries(self, repos):
        show = _create_show(repos["show_repo"])
        seg = AudienceSegment(
            segment_id=uuid4(), show_id=show.show_id,
            name="Past Segment", definition_json={},
            estimated_size=2000, created_by="test",
        )
        repos["seg_repo"].save(seg)
        frame = CreativeFrame(
            frame_id=uuid4(), show_id=show.show_id, segment_id=seg.segment_id,
            hypothesis="Past hypothesis", promise="Past promise",
            evidence_refs=[], risk_notes=None,
        )
        repos["frame_repo"].save(frame)

        exp = Experiment(
            experiment_id=uuid4(), show_id=show.show_id,
            segment_id=seg.segment_id, frame_id=frame.frame_id,
            channel="meta", objective="ticket_sales",
            budget_cap_cents=5000, status=ExperimentStatus.COMPLETED,
            start_time=datetime.now(timezone.utc) - timedelta(days=14),
            end_time=datetime.now(timezone.utc) - timedelta(days=7),
            baseline_snapshot={"cac_cents": 800},
        )
        repos["exp_repo"].save(exp)
        decision = Decision(
            decision_id=uuid4(), experiment_id=exp.experiment_id,
            action=DecisionAction.SCALE, confidence=0.85,
            rationale="Good performance", policy_version="v1",
            metrics_snapshot={"cac_cents": 350},
        )
        repos["exp_repo"].save_decision(decision)

        result = query_knowledge_base(
            show_id=show.show_id,
            show_repo=repos["show_repo"],
            exp_repo=repos["exp_repo"],
            seg_repo=repos["seg_repo"],
            frame_repo=repos["frame_repo"],
        )
        assert len(result["experiments"]) == 1
        assert result["experiments"][0]["segment_name"] == "Past Segment"
        assert result["experiments"][0]["decision"] == "scale"
        assert result["experiments"][0]["city"] == "Austin"

    def test_filters_by_matching_city(self, repos):
        show = _create_show(repos["show_repo"], city="Austin")
        exp = Experiment(
            experiment_id=uuid4(), show_id=show.show_id,
            segment_id=uuid4(), frame_id=uuid4(),
            channel="meta", objective="ticket_sales",
            budget_cap_cents=5000, status=ExperimentStatus.COMPLETED,
            start_time=None, end_time=None, baseline_snapshot={},
        )
        repos["exp_repo"].save(exp)

        result = query_knowledge_base(
            show_id=show.show_id,
            show_repo=repos["show_repo"],
            exp_repo=repos["exp_repo"],
            seg_repo=repos["seg_repo"],
            frame_repo=repos["frame_repo"],
            filters={"city": "Austin"},
        )
        assert len(result["experiments"]) == 1

    def test_city_filter_mismatch_returns_empty(self, repos):
        show = _create_show(repos["show_repo"], city="Austin")
        exp = Experiment(
            experiment_id=uuid4(), show_id=show.show_id,
            segment_id=uuid4(), frame_id=uuid4(),
            channel="meta", objective="ticket_sales",
            budget_cap_cents=5000, status=ExperimentStatus.COMPLETED,
            start_time=None, end_time=None, baseline_snapshot={},
        )
        repos["exp_repo"].save(exp)

        result = query_knowledge_base(
            show_id=show.show_id,
            show_repo=repos["show_repo"],
            exp_repo=repos["exp_repo"],
            seg_repo=repos["seg_repo"],
            frame_repo=repos["frame_repo"],
            filters={"city": "Dallas"},
        )
        assert result["experiments"] == []

    def test_empty_knowledge_base(self, repos):
        show = _create_show(repos["show_repo"])
        result = query_knowledge_base(
            show.show_id, repos["show_repo"], repos["exp_repo"],
            repos["seg_repo"], repos["frame_repo"],
        )
        assert result["experiments"] == []

    def test_show_not_found(self, repos):
        result = query_knowledge_base(
            uuid4(), repos["show_repo"], repos["exp_repo"],
            repos["seg_repo"], repos["frame_repo"],
        )
        assert result["error"] == "show_not_found"
