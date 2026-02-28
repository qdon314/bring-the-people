"""Tests for Memo Agent tool functions."""
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from growth.adapters.llm.memo_tools import get_cycle_experiments
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


def _setup_cycle_data(repos):
    """Create a show with experiments, observations, and decisions."""
    show_id = uuid4()
    show = Show(
        show_id=show_id, artist_name="Test Artist", city="Austin",
        venue="The Parish", show_time=datetime.now(timezone.utc) + timedelta(days=30),
        timezone="America/Chicago", capacity=200, tickets_total=200, tickets_sold=50,
    )
    repos["show_repo"].save(show)

    seg_id = uuid4()
    repos["seg_repo"].save(AudienceSegment(
        segment_id=seg_id, show_id=show_id, name="Indie fans",
        definition_json={"interests": ["indie"]}, estimated_size=5000,
        created_by="strategy_agent",
    ))

    frame_id = uuid4()
    repos["frame_repo"].save(CreativeFrame(
        frame_id=frame_id, show_id=show_id, segment_id=seg_id,
        hypothesis="Indie fans respond to intimate framing",
        promise="Intimate indie night",
        evidence_refs=[{"source": "show_data", "summary": "200-cap venue"}],
        channel="meta",
    ))

    exp_id = uuid4()
    cycle_start = datetime(2026, 2, 15, tzinfo=timezone.utc)
    cycle_end = datetime(2026, 2, 22, tzinfo=timezone.utc)

    repos["exp_repo"].save(Experiment(
        experiment_id=exp_id, show_id=show_id, segment_id=seg_id,
        frame_id=frame_id, channel="meta", objective="ticket_sales",
        budget_cap_cents=15000, status=ExperimentStatus.DECIDED,
        start_time=cycle_start, end_time=cycle_end,
        baseline_snapshot={"tickets_sold": 50},
    ))

    repos["exp_repo"].add_observation(Observation(
        observation_id=uuid4(), experiment_id=exp_id,
        window_start=cycle_start, window_end=cycle_start + timedelta(days=3),
        spend_cents=5000, impressions=2000, clicks=100, sessions=80,
        checkouts=10, purchases=5, revenue_cents=12500, refunds=0,
        refund_cents=0, complaints=0, negative_comment_rate=0.01,
        attribution_model="last_click_utm", raw_json={},
    ))

    repos["exp_repo"].save_decision(Decision(
        decision_id=uuid4(), experiment_id=exp_id,
        action=DecisionAction.SCALE, confidence=0.8,
        rationale="Strong conversion rate", policy_version="1.0",
        metrics_snapshot={"cac_cents": 1000},
    ))

    return show_id, cycle_start, cycle_end


class TestGetCycleExperiments:
    def test_returns_experiments_in_window(self, repos):
        show_id, cycle_start, cycle_end = _setup_cycle_data(repos)
        result = get_cycle_experiments(
            show_id=show_id,
            cycle_start=cycle_start.isoformat(),
            cycle_end=cycle_end.isoformat(),
            exp_repo=repos["exp_repo"],
            seg_repo=repos["seg_repo"],
            frame_repo=repos["frame_repo"],
        )
        assert len(result["experiments"]) == 1
        exp = result["experiments"][0]
        assert exp["segment_name"] == "Indie fans"
        assert exp["frame_hypothesis"] == "Indie fans respond to intimate framing"
        assert exp["channel"] == "meta"
        assert exp["observations"]["spend_cents"] == 5000
        assert exp["observations"]["purchases"] == 5
        assert exp["decision"]["action"] == "scale"
        assert exp["decision"]["confidence"] == 0.8

    def test_empty_when_no_experiments(self, repos):
        show_id = uuid4()
        repos["show_repo"].save(Show(
            show_id=show_id, artist_name="Empty", city="Austin",
            venue="Venue", show_time=datetime.now(timezone.utc) + timedelta(days=30),
            timezone="UTC", capacity=100, tickets_total=100, tickets_sold=0,
        ))
        result = get_cycle_experiments(
            show_id=show_id,
            cycle_start="2026-02-15T00:00:00+00:00",
            cycle_end="2026-02-22T00:00:00+00:00",
            exp_repo=repos["exp_repo"],
            seg_repo=repos["seg_repo"],
            frame_repo=repos["frame_repo"],
        )
        assert result["experiments"] == []
