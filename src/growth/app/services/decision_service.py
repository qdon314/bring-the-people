"""Application-level decision service.

Orchestrates: fetch run → fetch observations → compute aggregate metrics
→ call evaluate() → persist decision → emit event.
"""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from growth.domain.events import DecisionRecorded
from growth.domain.models import Decision, RunStatus
from growth.domain.policies import evaluate
from growth.domain.policy_config import PolicyConfig
from growth.ports.event_log import EventLog


class DecisionService:
    """Service for evaluating runs and making decisions."""

    def __init__(
        self,
        run_repo,
        experiment_repo,
        event_log: EventLog,
        policy: PolicyConfig,
    ):
        self._run_repo = run_repo
        self._experiment_repo = experiment_repo
        self._event_log = event_log
        self._policy = policy

    def evaluate_run(self, run_id: UUID) -> Decision:
        """Evaluate an active run and return a decision.

        Args:
            run_id: The ID of the run to evaluate

        Returns:
            The decision made for the run

        Raises:
            ValueError: If the run is not found or not active
        """

        # Fetch run
        run = self._run_repo.get_by_id(run_id)
        if run is None:
            raise ValueError(f"Run {run_id} not found")
        if run.status != RunStatus.ACTIVE:
            raise ValueError(f"Run must be active to evaluate, got {run.status.value}")

        # Fetch observations
        observations = self._run_repo.get_observations(run_id)

        # Compute aggregate metrics
        metrics = self._compute_metrics(observations)

        # Fetch the experiment to get baseline_snapshot and budget_cap_cents
        experiment = self._experiment_repo.get_by_id(run.experiment_id)
        if experiment is None:
            raise ValueError(f"Experiment {run.experiment_id} not found for run {run_id}")

        # Calculate derived metrics for evaluation
        num_windows = len(observations)
        total_clicks = metrics["total_clicks"]
        total_purchases = metrics["total_purchases"]
        spend_cents = metrics["total_spend_cents"]
        budget_cap_cents = experiment.budget_cap_cents

        # Conversion rate
        conversion_rate = total_purchases / total_clicks if total_clicks > 0 else 0.0
        baseline_conversion_rate = experiment.baseline_snapshot.get("conversion_rate", 0.0)

        # Incremental tickets per $100 spent
        spend_usd = spend_cents / 100
        incremental_tickets_per_100usd = total_purchases / (spend_usd / 100) if spend_usd > 0 else 0.0

        # CAC (Customer Acquisition Cost)
        cac_cents = spend_cents // total_purchases if total_purchases > 0 else float('inf')
        baseline_cac_cents = experiment.baseline_snapshot.get("cac_cents", 0)

        # Refund rate
        refund_rate = metrics["total_refunds"] / total_purchases if total_purchases > 0 else 0.0

        # Complaint rate (assume per 1000 impressions for normalization)
        total_impressions = metrics["total_impressions"]
        complaint_rate = metrics["total_complaints"] / (total_impressions / 1000) if total_impressions > 0 else 0.0

        # Negative comment rate (average from observations)
        negative_comment_rate = 0.0
        if observations:
            rates = [o.negative_comment_rate for o in observations if o.negative_comment_rate is not None]
            if rates:
                negative_comment_rate = sum(rates) / len(rates)

        # Call evaluate with computed metrics
        decision = evaluate(
            num_windows=num_windows,
            total_clicks=total_clicks,
            total_purchases=total_purchases,
            spend_cents=spend_cents,
            budget_cap_cents=budget_cap_cents,
            conversion_rate=conversion_rate,
            baseline_conversion_rate=baseline_conversion_rate,
            incremental_tickets_per_100usd=incremental_tickets_per_100usd,
            cac_cents=cac_cents,
            baseline_cac_cents=baseline_cac_cents,
            refund_rate=refund_rate,
            complaint_rate=complaint_rate,
            negative_comment_rate=negative_comment_rate,
            policy=self._policy,
        )

        # Update decision with actual run_id
        decision = Decision(
            decision_id=decision.decision_id,
            run_id=run_id,
            action=decision.action,
            confidence=decision.confidence,
            rationale=decision.rationale,
            policy_version=decision.policy_version,
            metrics_snapshot=decision.metrics_snapshot,
        )

        # Persist decision
        self._run_repo.save_decision(decision)

        # Emit event
        event = DecisionRecorded(
            event_id=uuid4(),
            occurred_at=datetime.now(timezone.utc),
            decision_id=decision.decision_id,
            experiment_id=run.experiment_id,
            action=decision.action,
            confidence=decision.confidence,
            rationale=decision.rationale,
            policy_version=decision.policy_version,
        )
        self._event_log.append(event)

        return decision

    def _compute_metrics(self, observations: list) -> dict:
        """Compute aggregate metrics from observations."""
        if not observations:
            return {
                "total_spend_cents": 0,
                "total_impressions": 0,
                "total_clicks": 0,
                "total_sessions": 0,
                "total_checkouts": 0,
                "total_purchases": 0,
                "total_revenue_cents": 0,
                "total_refunds": 0,
                "total_refund_cents": 0,
                "total_complaints": 0,
            }

        return {
            "total_spend_cents": sum(o.spend_cents for o in observations),
            "total_impressions": sum(o.impressions for o in observations),
            "total_clicks": sum(o.clicks for o in observations),
            "total_sessions": sum(o.sessions for o in observations),
            "total_checkouts": sum(o.checkouts for o in observations),
            "total_purchases": sum(o.purchases for o in observations),
            "total_revenue_cents": sum(o.revenue_cents for o in observations),
            "total_refunds": sum(o.refunds for o in observations),
            "total_refund_cents": sum(o.refund_cents for o in observations),
            "total_complaints": sum(o.complaints for o in observations),
        }
