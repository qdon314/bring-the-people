"""Tests for the decision service."""
from datetime import datetime, timezone
from uuid import uuid4

import pytest

from growth.adapters.event_log import JSONLEventLog
from growth.adapters.orm import create_tables, get_engine, get_session_maker
from growth.adapters.repositories import (
    SQLAlchemyExperimentRepository,
    SQLAlchemyExperimentRunRepository,
)
from growth.app.services.decision_service import DecisionService
from growth.domain.models import (
    DecisionAction,
    Experiment,
    ExperimentRun,
    Observation,
    RunStatus,
)
from growth.domain.policy_config import PolicyConfig


def _test_policy() -> PolicyConfig:
    return PolicyConfig(
        min_windows=1,
        min_clicks=100,
        min_purchases=3,
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


@pytest.fixture
def service_setup(tmp_path):
    db_path = tmp_path / "test.db"
    engine = get_engine(f"sqlite:///{db_path}")
    create_tables(engine)
    Session = get_session_maker(engine)
    session = Session()

    exp_repo = SQLAlchemyExperimentRepository(session)
    run_repo = SQLAlchemyExperimentRunRepository(session)
    event_log = JSONLEventLog(tmp_path / "events.jsonl")
    policy = _test_policy()

    service = DecisionService(
        run_repo=run_repo,
        experiment_repo=exp_repo,
        event_log=event_log,
        policy=policy,
    )

    yield {
        "service": service,
        "exp_repo": exp_repo,
        "run_repo": run_repo,
        "event_log": event_log,
    }
    session.close()


def _make_experiment(exp_repo, show_id=None):
    """Create and save an experiment, return it."""
    exp = Experiment(
        experiment_id=uuid4(),
        show_id=show_id or uuid4(),
        origin_cycle_id=uuid4(),
        segment_id=uuid4(),
        frame_id=uuid4(),
        channel="meta",
        objective="ticket_sales",
        budget_cap_cents=5000,
        baseline_snapshot={"cac_cents": 800, "conversion_rate": 0.02},
    )
    exp_repo.save(exp)
    return exp


def _make_active_run(run_repo, experiment_id, cycle_id=None):
    """Create and save an active run, return it."""
    run = ExperimentRun(
        run_id=uuid4(),
        experiment_id=experiment_id,
        cycle_id=cycle_id or uuid4(),
        status=RunStatus.ACTIVE,
        start_time=datetime(2026, 4, 1, 10, 0, tzinfo=timezone.utc),
        end_time=None,
    )
    run_repo.save(run)
    return run


class TestDecisionService:
    def test_evaluate_experiment_with_good_data_scales(self, service_setup):
        setup = service_setup
        exp_repo = setup["exp_repo"]
        run_repo = setup["run_repo"]
        service = setup["service"]

        # Create experiment + active run
        exp = _make_experiment(exp_repo)
        run = _make_active_run(run_repo, exp.experiment_id)

        # Add observation with strong performance
        obs = Observation(
            observation_id=uuid4(),
            run_id=run.run_id,
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
        run_repo.add_observation(obs)

        # Evaluate
        decision = service.evaluate_run(run.run_id)
        assert decision.action == DecisionAction.SCALE
        assert decision.run_id == run.run_id

    def test_evaluate_experiment_not_found_raises(self, service_setup):
        service = service_setup["service"]
        with pytest.raises(ValueError, match="not found"):
            service.evaluate_run(uuid4())

    def test_evaluate_experiment_no_observations_holds(self, service_setup):
        setup = service_setup
        exp_repo = setup["exp_repo"]
        run_repo = setup["run_repo"]
        service = setup["service"]

        exp = _make_experiment(exp_repo)
        run = _make_active_run(run_repo, exp.experiment_id)

        decision = service.evaluate_run(run.run_id)
        assert decision.action == DecisionAction.HOLD

    def test_evaluate_emits_event(self, service_setup):
        setup = service_setup
        exp_repo = setup["exp_repo"]
        run_repo = setup["run_repo"]
        service = setup["service"]
        event_log = setup["event_log"]

        exp = _make_experiment(exp_repo)
        run = _make_active_run(run_repo, exp.experiment_id)

        service.evaluate_run(run.run_id)
        events = event_log.read_all()
        assert len(events) == 1
        assert events[0]["event_type"] == "decision_recorded"
