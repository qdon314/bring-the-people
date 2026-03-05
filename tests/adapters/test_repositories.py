"""Tests for SQLAlchemy repository implementations."""
from datetime import datetime, timezone
from uuid import uuid4

import pytest

from growth.adapters.orm import create_tables, get_engine, get_session_maker
from growth.adapters.repositories import (
    SQLAlchemyExperimentRepository,
    SQLAlchemyExperimentRunRepository,
    SQLAlchemyShowRepository,
)
from growth.domain.models import (
    Decision,
    DecisionAction,
    Experiment,
    ExperimentRun,
    Observation,
    RunStatus,
    Show,
)


@pytest.fixture
def db_session():
    """Create a fresh in-memory database for each test."""
    engine = get_engine("sqlite:///:memory:")
    create_tables(engine)
    Session = get_session_maker(engine)
    session = Session()
    yield session
    session.close()


class TestShowRepository:
    def test_save_and_get_show(self, db_session):
        repo = SQLAlchemyShowRepository(db_session)
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
        repo.save(show)

        retrieved = repo.get_by_id(show.show_id)
        assert retrieved is not None
        assert retrieved.artist_name == "Test Artist"
        assert retrieved.capacity == 200

    def test_get_nonexistent_show_returns_none(self, db_session):
        repo = SQLAlchemyShowRepository(db_session)
        result = repo.get_by_id(uuid4())
        assert result is None


class TestExperimentRepository:
    def _make_show(self, db_session):
        show_repo = SQLAlchemyShowRepository(db_session)
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
        show_repo.save(show)
        return show

    def test_save_and_get_experiment(self, db_session):
        show = self._make_show(db_session)
        exp_repo = SQLAlchemyExperimentRepository(db_session)
        exp = Experiment(
            experiment_id=uuid4(),
            show_id=show.show_id,
            origin_cycle_id=uuid4(),
            segment_id=uuid4(),
            frame_id=uuid4(),
            channel="meta",
            objective="ticket_sales",
            budget_cap_cents=5000,
            baseline_snapshot={"cac_cents": 800},
        )
        exp_repo.save(exp)

        retrieved = exp_repo.get_by_id(exp.experiment_id)
        assert retrieved is not None
        assert retrieved.channel == "meta"
        assert retrieved.budget_cap_cents == 5000

    def test_get_experiments_by_show(self, db_session):
        show = self._make_show(db_session)
        exp_repo = SQLAlchemyExperimentRepository(db_session)
        for _ in range(2):
            exp = Experiment(
                experiment_id=uuid4(),
                show_id=show.show_id,
                origin_cycle_id=uuid4(),
                segment_id=uuid4(),
                frame_id=uuid4(),
                channel="meta",
                objective="ticket_sales",
                budget_cap_cents=5000,
                baseline_snapshot={},
            )
            exp_repo.save(exp)

        experiments = exp_repo.get_by_show(show.show_id)
        assert len(experiments) == 2

    def test_add_and_get_observations(self, db_session):
        show = self._make_show(db_session)
        exp_repo = SQLAlchemyExperimentRepository(db_session)
        run_repo = SQLAlchemyExperimentRunRepository(db_session)

        exp = Experiment(
            experiment_id=uuid4(),
            show_id=show.show_id,
            origin_cycle_id=uuid4(),
            segment_id=uuid4(),
            frame_id=uuid4(),
            channel="meta",
            objective="ticket_sales",
            budget_cap_cents=5000,
            baseline_snapshot={},
        )
        exp_repo.save(exp)

        run = ExperimentRun(
            run_id=uuid4(),
            experiment_id=exp.experiment_id,
            cycle_id=uuid4(),
            status=RunStatus.ACTIVE,
            start_time=datetime(2026, 4, 1, 10, 0, tzinfo=timezone.utc),
            end_time=None,
        )
        run_repo.save(run)

        # Add observation via run_repo
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

        observations = run_repo.get_observations(run.run_id)
        assert len(observations) == 1
        assert observations[0].purchases == 8
        assert observations[0].clicks == 200

    def test_save_decision(self, db_session):
        show = self._make_show(db_session)
        exp_repo = SQLAlchemyExperimentRepository(db_session)
        run_repo = SQLAlchemyExperimentRunRepository(db_session)

        exp = Experiment(
            experiment_id=uuid4(),
            show_id=show.show_id,
            origin_cycle_id=uuid4(),
            segment_id=uuid4(),
            frame_id=uuid4(),
            channel="meta",
            objective="ticket_sales",
            budget_cap_cents=5000,
            baseline_snapshot={},
        )
        exp_repo.save(exp)

        run = ExperimentRun(
            run_id=uuid4(),
            experiment_id=exp.experiment_id,
            cycle_id=uuid4(),
            status=RunStatus.ACTIVE,
            start_time=datetime(2026, 4, 1, 10, 0, tzinfo=timezone.utc),
            end_time=None,
        )
        run_repo.save(run)

        # Save decision via run_repo
        decision = Decision(
            decision_id=uuid4(),
            run_id=run.run_id,
            action=DecisionAction.SCALE,
            confidence=0.85,
            rationale="Strong CAC improvement",
            policy_version="v1",
            metrics_snapshot={"cac_cents": 600},
        )
        run_repo.save_decision(decision)

        # Verify by querying the database directly
        from growth.adapters.orm import DecisionORM
        orm_decision = db_session.get(DecisionORM, str(decision.decision_id))
        assert orm_decision is not None
        assert orm_decision.action == "scale"
        assert orm_decision.confidence == 0.85
