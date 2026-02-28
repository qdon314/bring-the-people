"""CLI smoke test for the growth system."""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

# Add src to path for development
sys.path.insert(0, str(Path(__file__).parents[2]))

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
from growth.domain.policy_config import load_policy_config


def create_show() -> Show:
    """Create a sample show."""
    return Show(
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


def create_experiment(show_id) -> Experiment:
    """Create a sample experiment."""
    from uuid import UUID
    if isinstance(show_id, str):
        show_id = UUID(show_id)
    return Experiment(
        experiment_id=uuid4(),
        show_id=show_id,
        segment_id=uuid4(),
        frame_id=uuid4(),
        channel="meta",
        objective="ticket_sales",
        budget_cap_cents=5000,
        status=ExperimentStatus.ACTIVE,
        start_time=datetime(2026, 4, 1, 10, 0, tzinfo=timezone.utc),
        end_time=None,
        baseline_snapshot={"cac_cents": 800, "conversion_rate": 0.02},
    )


def create_observation(experiment_id) -> Observation:
    """Create a sample observation."""
    from uuid import UUID
    if isinstance(experiment_id, str):
        experiment_id = UUID(experiment_id)
    return Observation(
        observation_id=uuid4(),
        experiment_id=experiment_id,
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


def run_smoke_test(db_path: str = "smoke_test.db", log_path: str = "smoke_test.jsonl"):
    """Run a smoke test of the entire system."""
    print("=" * 60)
    print("Growth System Smoke Test")
    print("=" * 60)

    # Setup
    print("\n1. Setting up database and event log...")
    engine = get_engine(f"sqlite:///{db_path}")
    create_tables(engine)
    Session = get_session_maker(engine)
    session = Session()

    show_repo = SQLAlchemyShowRepository(session)
    exp_repo = SQLAlchemyExperimentRepository(session)
    event_log = JSONLEventLog(Path(log_path))

    # Load policy config
    policy_path = Path(__file__).parents[3] / "config" / "policy.toml"
    policy = load_policy_config(policy_path)
    print(f"   Loaded policy from {policy_path}")

    # Create show
    print("\n2. Creating show...")
    show = create_show()
    show_repo.save(show)
    print(f"   Show: {show.artist_name} at {show.venue}")
    print(f"   Show ID: {show.show_id}")

    # Create experiment
    print("\n3. Creating experiment...")
    experiment = create_experiment(show.show_id)
    exp_repo.save(experiment)
    print(f"   Channel: {experiment.channel}")
    print(f"   Budget: ${experiment.budget_cap_cents / 100:.2f}")
    print(f"   Experiment ID: {experiment.experiment_id}")

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
    print("   Logged: experiment_started")

    # Add observation
    print("\n4. Adding observation...")
    observation = create_observation(experiment.experiment_id)
    exp_repo.add_observation(observation)
    print(f"   Spend: ${observation.spend_cents / 100:.2f}")
    print(f"   Clicks: {observation.clicks}")
    print(f"   Purchases: {observation.purchases}")
    print(f"   Revenue: ${observation.revenue_cents / 100:.2f}")

    # Calculate metrics
    conversion_rate = observation.purchases / observation.clicks
    cac_cents = observation.spend_cents / observation.purchases if observation.purchases > 0 else float('inf')
    incremental_tickets = observation.purchases  # Simplified
    incremental_per_100usd = incremental_tickets / (observation.spend_cents / 100)

    print(f"   Conversion Rate: {conversion_rate:.2%}")
    print(f"   CAC: ${cac_cents:.2f}")

    # Evaluate
    print("\n5. Evaluating experiment...")
    baseline_cac = experiment.baseline_snapshot.get("cac_cents", 800)
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

    print(f"   Decision: {decision.action.value.upper()}")
    print(f"   Confidence: {decision.confidence:.0%}")
    print(f"   Rationale: {decision.rationale}")

    # Save decision
    exp_repo.save_decision(decision)

    # Log decision
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
    print("   Logged: decision_recorded")

    # Read back from event log
    print("\n6. Reading event log...")
    events = event_log.read_all()
    print(f"   Total events: {len(events)}")
    for i, evt in enumerate(events, 1):
        print(f"   {i}. {evt['event_type']} at {evt['occurred_at']}")

    # Summary
    print("\n" + "=" * 60)
    print("Smoke Test Complete!")
    print("=" * 60)
    print(f"\nDatabase: {db_path}")
    print(f"Event Log: {log_path}")
    print(f"\nFinal Decision: {decision.action.value.upper()}")
    print(f"Recommendation: {'PASS' if decision.action == DecisionAction.SCALE else 'REVIEW'}")

    # Cleanup
    session.close()

    return decision.action


def main():
    parser = argparse.ArgumentParser(description="Growth System CLI Smoke Test")
    parser.add_argument(
        "--db", default="smoke_test.db", help="SQLite database path"
    )
    parser.add_argument(
        "--log", default="smoke_test.jsonl", help="Event log path"
    )
    parser.add_argument(
        "--cleanup", action="store_true", help="Remove files after test"
    )

    args = parser.parse_args()

    try:
        action = run_smoke_test(args.db, args.log)
        sys.exit(0 if action == DecisionAction.SCALE else 1)
    except Exception as e:
        print(f"\nError: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(2)
    finally:
        if args.cleanup:
            for path in [args.db, args.log]:
                p = Path(path)
                if p.exists():
                    p.unlink()
                    print(f"Cleaned up: {path}")


if __name__ == "__main__":
    main()
