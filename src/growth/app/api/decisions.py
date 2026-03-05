"""Decisions API routes."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Request

from growth.app.schemas import DecisionResponse
from growth.domain.models import Decision, DecisionAction, ExperimentRun, RunStatus

router = APIRouter()

CANONICAL_EVALUATE_ROUTE = "/api/decisions/evaluate/{run_id}"


@router.post("/evaluate", include_in_schema=False)
def evaluate_experiment_legacy_route():
    """Legacy route shape no longer supported; use path-param route."""
    raise HTTPException(
        status_code=410,
        detail=f"Use {CANONICAL_EVALUATE_ROUTE}",
    )


@router.post("/evaluate/{run_id}", response_model=DecisionResponse)
def evaluate_run(run_id: UUID, request: Request):
    container = request.state.container
    run_repo = container.run_repo()
    run = run_repo.get_by_id(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.status != RunStatus.ACTIVE:
        raise HTTPException(status_code=409, detail=f"Run must be active, got {run.status.value}")

    observations = run_repo.get_observations(run_id)
    if not observations:
        raise HTTPException(status_code=422, detail="No observations to evaluate")

    total_purchases = sum(o.purchases for o in observations)
    total_spend = sum(o.spend_cents for o in observations)
    total_impressions = sum(o.impressions for o in observations)

    policy = container.policy_config()
    evidence_sufficient = (
        total_purchases >= policy.min_purchases
        and total_impressions >= policy.min_clicks
    )

    if not evidence_sufficient:
        action = DecisionAction.HOLD
        confidence = 0.3
        rationale = "Insufficient evidence to make a confident decision."
    elif total_purchases >= 5:
        action = DecisionAction.SCALE
        confidence = 0.85
        rationale = f"Strong purchase signal: {total_purchases} purchases observed."
    elif total_spend > 0 and total_purchases == 0:
        action = DecisionAction.KILL
        confidence = 0.8
        rationale = "No purchases despite meaningful spend."
    else:
        action = DecisionAction.HOLD
        confidence = 0.6
        rationale = f"Mixed signal: {total_purchases} purchases, monitoring recommended."

    decision = Decision(
        decision_id=uuid4(),
        run_id=run_id,
        action=action,
        confidence=confidence,
        rationale=rationale,
        policy_version="v1",
        metrics_snapshot={
            "total_purchases": total_purchases,
            "total_spend_cents": total_spend,
            "total_impressions": total_impressions,
        },
    )
    run_repo.save_decision(decision)

    # Transition run to DECIDED
    updated_run = ExperimentRun(
        run_id=run.run_id,
        experiment_id=run.experiment_id,
        cycle_id=run.cycle_id,
        status=RunStatus.DECIDED,
        start_time=run.start_time,
        end_time=datetime.now(timezone.utc),
        budget_cap_cents_override=run.budget_cap_cents_override,
        channel_config=run.channel_config,
        variant_snapshot=run.variant_snapshot,
    )
    run_repo.save(updated_run)

    return DecisionResponse.from_domain(decision)


@router.get("", response_model=list[DecisionResponse])
def list_decisions(run_id: UUID, request: Request):
    run_repo = request.state.container.run_repo()
    return [DecisionResponse.from_domain(d) for d in run_repo.get_decisions(run_id)]
