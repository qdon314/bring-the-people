"""Experiments API routes."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Request

from growth.app.schemas import ApprovalRequest, ExperimentCreate, ExperimentResponse, ExperimentMetrics
from growth.domain.models import Experiment, ExperimentStatus

router = APIRouter()


def _get_exp_repo(request: Request):
    return request.app.state.container.experiment_repo()


@router.post("", status_code=201, response_model=ExperimentResponse)
def create_experiment(body: ExperimentCreate, request: Request):
    repo = _get_exp_repo(request)
    exp = Experiment(
        experiment_id=uuid4(),
        show_id=body.show_id,
        segment_id=body.segment_id,
        frame_id=body.frame_id,
        channel=body.channel,
        objective=body.objective,
        budget_cap_cents=body.budget_cap_cents,
        status=ExperimentStatus.DRAFT,
        start_time=None,
        end_time=None,
        baseline_snapshot=body.baseline_snapshot,
        cycle_id=None,
    )
    repo.save(exp)
    return ExperimentResponse.from_domain(exp)


@router.get("", response_model=list[ExperimentResponse])
def list_experiments(show_id: UUID, request: Request):
    repo = _get_exp_repo(request)
    experiments = repo.get_by_show(show_id)
    return [ExperimentResponse.from_domain(e) for e in experiments]


@router.get("/{experiment_id}", response_model=ExperimentResponse)
def get_experiment(experiment_id: UUID, request: Request):
    repo = _get_exp_repo(request)
    exp = repo.get_by_id(experiment_id)
    if exp is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return ExperimentResponse.from_domain(exp)


@router.post("/{experiment_id}/submit", response_model=ExperimentResponse)
def submit_for_approval(experiment_id: UUID, request: Request):
    repo = _get_exp_repo(request)
    exp = repo.get_by_id(experiment_id)
    if exp is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    if exp.status != ExperimentStatus.DRAFT:
        raise HTTPException(status_code=409, detail=f"Cannot submit from status {exp.status.value}")
    
    updated = Experiment(
        experiment_id=exp.experiment_id,
        show_id=exp.show_id,
        segment_id=exp.segment_id,
        frame_id=exp.frame_id,
        channel=exp.channel,
        objective=exp.objective,
        budget_cap_cents=exp.budget_cap_cents,
        status=ExperimentStatus.AWAITING_APPROVAL,
        start_time=exp.start_time,
        end_time=exp.end_time,
        baseline_snapshot=exp.baseline_snapshot,
        cycle_id=exp.cycle_id,
    )
    repo.save(updated)
    return ExperimentResponse.from_domain(updated)


@router.post("/{experiment_id}/approve", response_model=ExperimentResponse)
def approve_experiment(experiment_id: UUID, body: ApprovalRequest, request: Request):
    repo = _get_exp_repo(request)
    exp = repo.get_by_id(experiment_id)
    if exp is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    if exp.status != ExperimentStatus.AWAITING_APPROVAL:
        raise HTTPException(status_code=409, detail=f"Cannot approve from status {exp.status.value}")
    
    new_status = ExperimentStatus.APPROVED if body.approved else ExperimentStatus.DRAFT
    updated = Experiment(
        experiment_id=exp.experiment_id,
        show_id=exp.show_id,
        segment_id=exp.segment_id,
        frame_id=exp.frame_id,
        channel=exp.channel,
        objective=exp.objective,
        budget_cap_cents=exp.budget_cap_cents,
        status=new_status,
        start_time=exp.start_time,
        end_time=exp.end_time,
        baseline_snapshot=exp.baseline_snapshot,
        cycle_id=exp.cycle_id,
    )
    repo.save(updated)
    return ExperimentResponse.from_domain(updated)


@router.post("/{experiment_id}/start", response_model=ExperimentResponse)
def start_experiment(experiment_id: UUID, request: Request):
    repo = _get_exp_repo(request)
    exp = repo.get_by_id(experiment_id)
    if exp is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    if exp.status != ExperimentStatus.APPROVED:
        raise HTTPException(status_code=409, detail=f"Cannot start from status {exp.status.value}")
    
    updated = Experiment(
        experiment_id=exp.experiment_id,
        show_id=exp.show_id,
        segment_id=exp.segment_id,
        frame_id=exp.frame_id,
        channel=exp.channel,
        objective=exp.objective,
        budget_cap_cents=exp.budget_cap_cents,
        status=ExperimentStatus.RUNNING,
        start_time=datetime.now(timezone.utc),
        end_time=exp.end_time,
        baseline_snapshot=exp.baseline_snapshot,
        cycle_id=exp.cycle_id,
    )
    repo.save(updated)
    return ExperimentResponse.from_domain(updated)


@router.post("/{experiment_id}/complete", response_model=ExperimentResponse)
def complete_experiment(experiment_id: UUID, request: Request):
    repo = _get_exp_repo(request)
    exp = repo.get_by_id(experiment_id)
    if exp is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    if exp.status != ExperimentStatus.RUNNING:
        raise HTTPException(status_code=409, detail=f"Cannot complete from status {exp.status.value}")
    
    updated = Experiment(
        experiment_id=exp.experiment_id,
        show_id=exp.show_id,
        segment_id=exp.segment_id,
        frame_id=exp.frame_id,
        channel=exp.channel,
        objective=exp.objective,
        budget_cap_cents=exp.budget_cap_cents,
        status=ExperimentStatus.COMPLETED,
        start_time=exp.start_time,
        end_time=datetime.now(timezone.utc),
        baseline_snapshot=exp.baseline_snapshot,
        cycle_id=exp.cycle_id,
    )
    repo.save(updated)
    return ExperimentResponse.from_domain(updated)


@router.post("/{experiment_id}/stop", response_model=ExperimentResponse)
def stop_experiment(experiment_id: UUID, request: Request):
    repo = _get_exp_repo(request)
    exp = repo.get_by_id(experiment_id)
    if exp is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    if exp.status != ExperimentStatus.RUNNING:
        raise HTTPException(status_code=409, detail=f"Cannot stop from status {exp.status.value}")
    
    updated = Experiment(
        experiment_id=exp.experiment_id,
        show_id=exp.show_id,
        segment_id=exp.segment_id,
        frame_id=exp.frame_id,
        channel=exp.channel,
        objective=exp.objective,
        budget_cap_cents=exp.budget_cap_cents,
        status=ExperimentStatus.STOPPED,
        start_time=exp.start_time,
        end_time=datetime.now(timezone.utc),
        baseline_snapshot=exp.baseline_snapshot,
        cycle_id=exp.cycle_id,
    )
    repo.save(updated)
    return ExperimentResponse.from_domain(updated)


@router.get("/{experiment_id}/metrics", response_model=ExperimentMetrics)
def get_experiment_metrics(experiment_id: UUID, request: Request):
    from growth.app.schemas import ExperimentMetrics as MetricsSchema
    container = request.app.state.container
    exp = container.experiment_repo().get_by_id(experiment_id)
    if exp is None:
        raise HTTPException(404, "Experiment not found")
    observations = container.experiment_repo().get_observations(experiment_id)
    
    # Compute metrics
    total_spend_cents = sum(o.spend_cents for o in observations)
    total_impressions = sum(o.impressions for o in observations)
    total_clicks = sum(o.clicks for o in observations)
    total_purchases = sum(o.purchases for o in observations)
    total_revenue_cents = sum(o.revenue_cents for o in observations)
    windows_count = len(observations)
    
    ctr = total_clicks / total_impressions if total_impressions > 0 else None
    cpc_cents = total_spend_cents / total_clicks if total_clicks > 0 else None
    cpa_cents = total_spend_cents / total_purchases if total_purchases > 0 else None
    roas = total_revenue_cents / total_spend_cents if total_spend_cents > 0 else None
    conversion_rate = total_purchases / total_clicks if total_clicks > 0 else None
    
    # Check evidence sufficiency
    policy = container.policy_config()
    evidence_sufficient = (
        total_impressions >= policy.min_observations_impressions and
        total_spend_cents >= policy.min_observations_spend_cents and
        windows_count >= 1
    )
    
    return MetricsSchema(
        experiment_id=experiment_id,
        total_spend_cents=total_spend_cents,
        total_impressions=total_impressions,
        total_clicks=total_clicks,
        total_purchases=total_purchases,
        total_revenue_cents=total_revenue_cents,
        windows_count=windows_count,
        ctr=ctr,
        cpc_cents=cpc_cents,
        cpa_cents=cpa_cents,
        roas=roas,
        conversion_rate=conversion_rate,
        evidence_sufficient=evidence_sufficient,
    )
