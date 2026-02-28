"""Integration tests for the growth system."""
from datetime import datetime, timezone
from uuid import uuid4

import pytest

from growth.adapters.event_log import JSONLEventLog
from growth.adapters.orm import create_tables, get_engine, get_session_maker
from growth.adapters.repositories import (
    SQLAlchemyExperimentRepository,
    SQLAlchemyShowRepository,
)
from growth.domain.events import DecisionRecorded, ExperimentStarted
from growth.domain.models import (
    DecisionAction,
    Experiment,
    ExperimentStatus,
    Observation,
    Show,
)
from growth.domain.policies import evaluate
from growth.domain.policy_config import PolicyConfig


@pytest.fixture
def integration_setup(tmp_path):
    """Set up all components for integration testing."""
    # Database
    db_path = tmp_path / "test.db"
    engine = get_engine(f"sqlite:///{db_path}")
    create_tables(engine)
    Session = get_session_maker(engine)
    session = Session()

    # Repositories
    show_repo = SQLAlchemyShowRepository(session)
    exp_repo = SQLAlchemyExperimentRepository(session)

    # Event log
    log_path = tmp_path / "events.jsonl"
    event_log = JSONLEventLog(log_path)

    # Policy config
    policy = PolicyConfig(
        min_windows=1,  # Lower for testing
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

    yield {
        "session": session,
        "show_repo": show_repo,
        "exp_repo": exp_repo,
        "event_log": event_log,
        "policy": policy,
    }

    session.close()


class TestFullExperimentLifecycle:
    """Test a complete experiment lifecycle from creation to decision."""

    def test_scale_scenario(self, integration_setup):
        """Test an experiment that should scale."""
        setup = integration_setup
        show_repo = setup["show_repo"]
        exp_repo = setup["exp_repo"]
        event_log = setup["event_log"]
        policy = setup["policy"]

        # 1. Create show
        show = Show(
            show_id=uuid4(),
            artist_name="Scale Test Artist",
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

        # 2. Create experiment
        experiment = Experiment(
            experiment_id=uuid4(),
            show_id=show.show_id,
            segment_id=uuid4(),
            frame_id=uuid4(),
            channel="meta",
            objective="ticket_sales",
            budget_cap_cents=10000,
            status=ExperimentStatus.ACTIVE,
            start_time=datetime(2026, 4, 1, 10, 0, tzinfo=timezone.utc),
            end_time=None,
            baseline_snapshot={"cac_cents": 1000, "conversion_rate": 0.02},
        )
        exp_repo.save(experiment)

        # Log experiment started
        event = ExperimentStarted(
            event_id=uuid4(),
            experiment_id=experiment.experiment_id,
            show_id=show.show_id,
            channel=experiment.channel,
            objective=experiment.objective,
            budget_cap_cents=experiment.budget_cap_cents,
            baseline_snapshot=experiment.baseline_snapshot,
            occurred_at=datetime.now(timezone.utc),
        )
        event_log.append(event)

        # 3. Add observation with good performance
        observation = Observation(
            observation_id=uuid4(),
            experiment_id=experiment.experiment_id,
            window_start=datetime(2026, 4, 1, 0, 0, tzinfo=timezone.utc),
            window_end=datetime(2026, 4, 2, 0, 0, tzinfo=timezone.utc),
            spend_cents=5000,
            impressions=20000,
            clicks=500,
            sessions=450,
            checkouts=50,
            purchases=20,  # Good conversion
            revenue_cents=80000,
            refunds=0,
            refund_cents=0,
            complaints=0,
            negative_comment_rate=0.01,
            attribution_model="last_click_utm",
            raw_json={"source": "manual"},
        )
        exp_repo.add_observation(observation)

        # 4. Evaluate
        conversion_rate = observation.purchases / observation.clicks
        cac_cents = observation.spend_cents / observation.purchases
        incremental_per_100usd = observation.purchases / (observation.spend_cents / 100)

        baseline_cac = experiment.baseline_snapshot.get("cac_cents", 1000)
        baseline_conversion = experiment.baseline_snapshot.get("conversion_rate", 0.02)

        decision = evaluate(
            num_windows=1,
            total_clicks=observation.clicks,
            total_purchases=observation.purchases,
            spend_cents=observation.spend_cents,
            budget_cap_cents=experiment.budget_cap_cents,
            conversion_rate=conversion_rate,
            baseline_conversion_rate=baseline_conversion,
            incremental_tickets_per_100usd=incremental_per_100usd,
            cac_cents=cac_cents,
            baseline_cac_cents=baseline_cac,
            refund_rate=0.0,
            complaint_rate=0.0,
            negative_comment_rate=observation.negative_comment_rate or 0.0,
            policy=policy,
        )

        # 5. Verify SCALE decision
        assert decision.action == DecisionAction.SCALE
        assert decision.confidence > 0.5

        # 6. Save and log decision
        exp_repo.save_decision(decision)

        decision_event = DecisionRecorded(
            event_id=uuid4(),
            decision_id=decision.decision_id,
            experiment_id=experiment.experiment_id,
            action=decision.action,
            confidence=decision.confidence,
            rationale=decision.rationale,
            policy_version=decision.policy_version,
            occurred_at=datetime.now(timezone.utc),
        )
        event_log.append(decision_event)

        # 7. Verify event log
        events = event_log.read_all()
        assert len(events) == 2
        assert events[0]["event_type"] == "experiment_started"
        assert events[1]["event_type"] == "decision_recorded"
        assert events[1]["action"] == "scale"

    def test_kill_scenario(self, integration_setup):
        """Test an experiment that should be killed."""
        setup = integration_setup
        show_repo = setup["show_repo"]
        exp_repo = setup["exp_repo"]
        policy = setup["policy"]

        # 1. Create show
        show = Show(
            show_id=uuid4(),
            artist_name="Kill Test Artist",
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

        # 2. Create experiment
        experiment = Experiment(
            experiment_id=uuid4(),
            show_id=show.show_id,
            segment_id=uuid4(),
            frame_id=uuid4(),
            channel="meta",
            objective="ticket_sales",
            budget_cap_cents=10000,
            status=ExperimentStatus.ACTIVE,
            start_time=datetime(2026, 4, 1, 10, 0, tzinfo=timezone.utc),
            end_time=None,
            baseline_snapshot={"cac_cents": 1000, "conversion_rate": 0.02},
        )
        exp_repo.save(experiment)

        # 3. Add observation with poor performance (high refund rate)
        observation = Observation(
            observation_id=uuid4(),
            experiment_id=experiment.experiment_id,
            window_start=datetime(2026, 4, 1, 0, 0, tzinfo=timezone.utc),
            window_end=datetime(2026, 4, 2, 0, 0, tzinfo=timezone.utc),
            spend_cents=5000,
            impressions=20000,
            clicks=500,
            sessions=450,
            checkouts=50,
            purchases=5,
            revenue_cents=20000,
            refunds=2,  # High refund rate
            refund_cents=8000,
            complaints=1,
            negative_comment_rate=0.20,  # Over limit
            attribution_model="last_click_utm",
            raw_json={"source": "manual"},
        )
        exp_repo.add_observation(observation)

        # 4. Evaluate
        conversion_rate = observation.purchases / observation.clicks
        cac_cents = observation.spend_cents / observation.purchases if observation.purchases > 0 else float('inf')
        incremental_per_100usd = observation.purchases / (observation.spend_cents / 100) if observation.spend_cents > 0 else 0

        baseline_cac = experiment.baseline_snapshot.get("cac_cents", 1000)
        baseline_conversion = experiment.baseline_snapshot.get("conversion_rate", 0.02)

        decision = evaluate(
            num_windows=1,
            total_clicks=observation.clicks,
            total_purchases=observation.purchases,
            spend_cents=observation.spend_cents,
            budget_cap_cents=experiment.budget_cap_cents,
            conversion_rate=conversion_rate,
            baseline_conversion_rate=baseline_conversion,
            incremental_tickets_per_100usd=incremental_per_100usd,
            cac_cents=cac_cents,
            baseline_cac_cents=baseline_cac,
            refund_rate=observation.refunds / observation.purchases if observation.purchases > 0 else 0,
            complaint_rate=observation.complaints / observation.purchases if observation.purchases > 0 else 0,
            negative_comment_rate=observation.negative_comment_rate or 0.0,
            policy=policy,
        )

        # 5. Verify KILL decision due to guardrail violation
        assert decision.action == DecisionAction.KILL
        assert "guardrail" in decision.rationale.lower() or "refund" in decision.rationale.lower()

    def test_hold_insufficient_evidence(self, integration_setup):
        """Test an experiment that should hold due to insufficient evidence."""
        setup = integration_setup
        show_repo = setup["show_repo"]
        exp_repo = setup["exp_repo"]
        policy = setup["policy"]

        # 1. Create show
        show = Show(
            show_id=uuid4(),
            artist_name="Hold Test Artist",
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

        # 2. Create experiment
        experiment = Experiment(
            experiment_id=uuid4(),
            show_id=show.show_id,
            segment_id=uuid4(),
            frame_id=uuid4(),
            channel="meta",
            objective="ticket_sales",
            budget_cap_cents=10000,
            status=ExperimentStatus.ACTIVE,
            start_time=datetime(2026, 4, 1, 10, 0, tzinfo=timezone.utc),
            end_time=None,
            baseline_snapshot={"cac_cents": 1000, "conversion_rate": 0.02},
        )
        exp_repo.save(experiment)

        # 3. Add observation with too few clicks (below min_clicks threshold)
        # This avoids triggering kill conditions while still having insufficient evidence
        observation = Observation(
            observation_id=uuid4(),
            experiment_id=experiment.experiment_id,
            window_start=datetime(2026, 4, 1, 0, 0, tzinfo=timezone.utc),
            window_end=datetime(2026, 4, 2, 0, 0, tzinfo=timezone.utc),
            spend_cents=1000,  # Low spend
            impressions=5000,
            clicks=50,  # Below min_clicks (100), so conversion check won't trigger
            sessions=45,
            checkouts=2,
            purchases=1,  # Too few purchases
            revenue_cents=4000,
            refunds=0,
            refund_cents=0,
            complaints=0,
            negative_comment_rate=0.01,
            attribution_model="last_click_utm",
            raw_json={"source": "manual"},
        )
        exp_repo.add_observation(observation)

        # 4. Evaluate
        conversion_rate = observation.purchases / observation.clicks
        cac_cents = observation.spend_cents / observation.purchases if observation.purchases > 0 else float('inf')
        incremental_per_100usd = observation.purchases / (observation.spend_cents / 100) if observation.spend_cents > 0 else 0

        baseline_cac = experiment.baseline_snapshot.get("cac_cents", 1000)
        baseline_conversion = experiment.baseline_snapshot.get("conversion_rate", 0.02)

        decision = evaluate(
            num_windows=1,
            total_clicks=observation.clicks,
            total_purchases=observation.purchases,
            spend_cents=observation.spend_cents,
            budget_cap_cents=experiment.budget_cap_cents,
            conversion_rate=conversion_rate,
            baseline_conversion_rate=baseline_conversion,
            incremental_tickets_per_100usd=incremental_per_100usd,
            cac_cents=cac_cents,
            baseline_cac_cents=baseline_cac,
            refund_rate=0.0,
            complaint_rate=0.0,
            negative_comment_rate=observation.negative_comment_rate or 0.0,
            policy=policy,
        )

        # 5. Verify HOLD decision due to insufficient evidence
        assert decision.action == DecisionAction.HOLD
        assert "evidence" in decision.rationale.lower()
