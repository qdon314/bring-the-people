"""Tests for updated repositories after entity refactor."""
import pytest
from uuid import uuid4
from datetime import datetime, timezone

from growth.adapters.orm import get_engine, create_tables, get_session_maker, ShowORM, CycleORM
from growth.adapters.repositories import (
    SQLAlchemyExperimentRepository,
    SQLAlchemyExperimentRunRepository,
)
from growth.domain.models import (
    Experiment, ExperimentRun, RunStatus, Observation, Decision, DecisionAction
)


@pytest.fixture
def session(tmp_path):
    engine = get_engine(f"sqlite:///{tmp_path}/test.db")
    create_tables(engine)
    Session = get_session_maker(engine)
    s = Session()
    # Seed required FKs
    show_id = uuid4()
    cycle_id = uuid4()
    s.add(ShowORM(
        show_id=str(show_id), artist_name="A", city="B", venue="C",
        show_time=datetime(2026, 5, 1), timezone="UTC",
        capacity=100, tickets_total=100, tickets_sold=0
    ))
    s.add(CycleORM(
        cycle_id=str(cycle_id), show_id=str(show_id),
        started_at=datetime(2026, 1, 1)
    ))
    s.commit()
    yield s, show_id, cycle_id
    s.close()


def _make_experiment(show_id, origin_cycle_id):
    return Experiment(
        experiment_id=uuid4(),
        show_id=show_id,
        origin_cycle_id=origin_cycle_id,
        segment_id=uuid4(),
        frame_id=uuid4(),
        channel="meta",
        objective="ticket_sales",
        budget_cap_cents=5000,
        baseline_snapshot={},
    )


def _make_run(experiment_id, cycle_id):
    return ExperimentRun(
        run_id=uuid4(),
        experiment_id=experiment_id,
        cycle_id=cycle_id,
        status=RunStatus.DRAFT,
        start_time=None,
        end_time=None,
    )


def _make_observation(run_id):
    return Observation(
        observation_id=uuid4(),
        run_id=run_id,
        window_start=datetime(2026, 4, 1, tzinfo=timezone.utc),
        window_end=datetime(2026, 4, 2, tzinfo=timezone.utc),
        spend_cents=1000,
        impressions=5000,
        clicks=100,
        sessions=90,
        checkouts=10,
        purchases=3,
        revenue_cents=12000,
        refunds=0, refund_cents=0, complaints=0,
        negative_comment_rate=None,
        attribution_model="last_click_utm",
        raw_json={},
    )


def test_experiment_round_trip(session):
    s, show_id, cycle_id = session
    repo = SQLAlchemyExperimentRepository(s)
    exp = _make_experiment(show_id, cycle_id)
    repo.save(exp)

    fetched = repo.get_by_id(exp.experiment_id)
    assert fetched is not None
    assert fetched.origin_cycle_id == exp.origin_cycle_id
    assert fetched.show_id == exp.show_id
    assert not hasattr(fetched, "status")


def test_run_save_and_get_by_id(session):
    s, show_id, cycle_id = session
    exp_repo = SQLAlchemyExperimentRepository(s)
    exp = _make_experiment(show_id, cycle_id)
    exp_repo.save(exp)

    run_repo = SQLAlchemyExperimentRunRepository(s)
    run = _make_run(exp.experiment_id, cycle_id)
    run_repo.save(run)

    fetched = run_repo.get_by_id(run.run_id)
    assert fetched is not None
    assert fetched.experiment_id == exp.experiment_id
    assert fetched.status == RunStatus.DRAFT


def test_run_get_by_cycle(session):
    s, show_id, cycle_id = session
    exp_repo = SQLAlchemyExperimentRepository(s)
    exp = _make_experiment(show_id, cycle_id)
    exp_repo.save(exp)

    run_repo = SQLAlchemyExperimentRunRepository(s)
    run1 = _make_run(exp.experiment_id, cycle_id)
    run2 = _make_run(exp.experiment_id, cycle_id)
    run_repo.save(run1)
    run_repo.save(run2)

    runs = run_repo.get_by_cycle(cycle_id)
    assert len(runs) == 2


def test_run_observations_round_trip(session):
    s, show_id, cycle_id = session
    exp_repo = SQLAlchemyExperimentRepository(s)
    exp = _make_experiment(show_id, cycle_id)
    exp_repo.save(exp)

    run_repo = SQLAlchemyExperimentRunRepository(s)
    run = _make_run(exp.experiment_id, cycle_id)
    run_repo.save(run)

    obs = _make_observation(run.run_id)
    run_repo.add_observation(obs)

    fetched = run_repo.get_observations(run.run_id)
    assert len(fetched) == 1
    assert fetched[0].run_id == run.run_id
    assert not hasattr(fetched[0], "experiment_id")


def test_run_decision_round_trip(session):
    s, show_id, cycle_id = session
    exp_repo = SQLAlchemyExperimentRepository(s)
    exp = _make_experiment(show_id, cycle_id)
    exp_repo.save(exp)

    run_repo = SQLAlchemyExperimentRunRepository(s)
    run = _make_run(exp.experiment_id, cycle_id)
    run_repo.save(run)

    decision = Decision(
        decision_id=uuid4(),
        run_id=run.run_id,
        action=DecisionAction.SCALE,
        confidence=0.8,
        rationale="looks good",
        policy_version="v1",
        metrics_snapshot={"spend": 1000},
    )
    run_repo.save_decision(decision)

    decisions = run_repo.get_decisions(run.run_id)
    assert len(decisions) == 1
    assert decisions[0].run_id == run.run_id
    assert decisions[0].action == DecisionAction.SCALE
