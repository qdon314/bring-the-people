"""ExperimentRun API routes."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Request

from growth.app.schemas import RunCreate, RunResponse, RunMetricsResponse
from growth.domain.models import ExperimentRun, RunStatus

router = APIRouter()

LAUNCHABLE_STATUSES = {RunStatus.DRAFT, RunStatus.AWAITING_APPROVAL}


def _get_run_repo(request: Request):
    return request.state.container.run_repo()


def _get_run_or_404(repo, run_id: UUID) -> ExperimentRun:
    run = repo.get_by_id(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


def _transition(run: ExperimentRun, **overrides) -> ExperimentRun:
    fields = {
        "run_id": run.run_id,
        "experiment_id": run.experiment_id,
        "cycle_id": run.cycle_id,
        "status": run.status,
        "start_time": run.start_time,
        "end_time": run.end_time,
        "budget_cap_cents_override": run.budget_cap_cents_override,
        "channel_config": run.channel_config,
        "variant_snapshot": run.variant_snapshot,
    }
    fields.update(overrides)
    return ExperimentRun(**fields)


@router.post("", status_code=201, response_model=RunResponse)
def create_run(body: RunCreate, request: Request):
    exp = request.state.container.experiment_repo().get_by_id(body.experiment_id)
    if exp is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    repo = _get_run_repo(request)
    run = ExperimentRun(
        run_id=uuid4(),
        experiment_id=body.experiment_id,
        cycle_id=body.cycle_id,
        status=body.status,
        start_time=None,
        end_time=None,
        budget_cap_cents_override=body.budget_cap_cents_override,
        channel_config=body.channel_config,
        variant_snapshot=body.variant_snapshot,
    )
    repo.save(run)
    return RunResponse.from_domain(run)


@router.get("", response_model=list[RunResponse])
def list_runs(
    request: Request,
    cycle_id: Optional[UUID] = None,
    experiment_id: Optional[UUID] = None,
):
    if cycle_id is None and experiment_id is None:
        raise HTTPException(status_code=400, detail="cycle_id or experiment_id required")
    repo = _get_run_repo(request)
    if cycle_id is not None:
        runs = repo.get_by_cycle(cycle_id)
    else:
        runs = repo.get_by_experiment(experiment_id)
    return [RunResponse.from_domain(r) for r in runs]


@router.get("/{run_id}", response_model=RunResponse)
def get_run(run_id: UUID, request: Request):
    return RunResponse.from_domain(_get_run_or_404(_get_run_repo(request), run_id))


@router.post("/{run_id}/launch", response_model=RunResponse)
def launch_run(run_id: UUID, request: Request):
    repo = _get_run_repo(request)
    run = _get_run_or_404(repo, run_id)
    if run.status not in LAUNCHABLE_STATUSES:
        raise HTTPException(409, f"Cannot launch from status {run.status.value}")
    updated = _transition(run, status=RunStatus.ACTIVE, start_time=datetime.now(timezone.utc))
    repo.save(updated)
    return RunResponse.from_domain(updated)


@router.post("/{run_id}/request-reapproval", response_model=RunResponse)
def request_reapproval(run_id: UUID, request: Request):
    repo = _get_run_repo(request)
    run = _get_run_or_404(repo, run_id)
    if run.status != RunStatus.DRAFT:
        raise HTTPException(409, f"Cannot request reapproval from status {run.status.value}")
    updated = _transition(run, status=RunStatus.AWAITING_APPROVAL)
    repo.save(updated)
    return RunResponse.from_domain(updated)


@router.get("/{run_id}/metrics", response_model=RunMetricsResponse)
def get_run_metrics(run_id: UUID, request: Request):
    container = request.state.container
    _get_run_or_404(container.run_repo(), run_id)
    observations = container.run_repo().get_observations(run_id)

    total_spend = sum(o.spend_cents for o in observations)
    total_impressions = sum(o.impressions for o in observations)
    total_clicks = sum(o.clicks for o in observations)
    total_purchases = sum(o.purchases for o in observations)
    total_revenue = sum(o.revenue_cents for o in observations)
    windows_count = len(observations)

    policy = container.policy_config()
    evidence_sufficient = (
        total_clicks >= policy.min_clicks
        and total_purchases >= policy.min_purchases
        and windows_count >= policy.min_windows
    )

    return RunMetricsResponse(
        run_id=run_id,
        total_spend_cents=total_spend,
        total_impressions=total_impressions,
        total_clicks=total_clicks,
        total_purchases=total_purchases,
        total_revenue_cents=total_revenue,
        windows_count=windows_count,
        ctr=total_clicks / total_impressions if total_impressions > 0 else None,
        cpc_cents=total_spend / total_clicks if total_clicks > 0 else None,
        cpa_cents=total_spend / total_purchases if total_purchases > 0 else None,
        roas=total_revenue / total_spend if total_spend > 0 else None,
        conversion_rate=total_purchases / total_clicks if total_clicks > 0 else None,
        evidence_sufficient=evidence_sufficient,
    )
