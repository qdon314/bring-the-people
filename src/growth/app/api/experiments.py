"""Experiments API routes."""
from __future__ import annotations

from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Request

from growth.app.schemas import ExperimentCreate, ExperimentResponse
from growth.domain.models import Experiment

router = APIRouter()


def _get_exp_repo(request: Request):
    return request.state.container.experiment_repo()


def _get_exp_or_404(repo, experiment_id: UUID) -> Experiment:
    exp = repo.get_by_id(experiment_id)
    if exp is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return exp


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
        baseline_snapshot=body.baseline_snapshot,
        origin_cycle_id=body.origin_cycle_id,
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
    exp = _get_exp_or_404(repo, experiment_id)
    return ExperimentResponse.from_domain(exp)


@router.post("/{experiment_id}/launch", status_code=410)
def launch_experiment(experiment_id: UUID):
    raise HTTPException(status_code=410, detail="Use POST /api/runs/{run_id}/launch")


@router.post("/{experiment_id}/request-reapproval", status_code=410)
def request_reapproval(experiment_id: UUID):
    raise HTTPException(status_code=410, detail="Use POST /api/runs/{run_id}/request-reapproval")


@router.get("/{experiment_id}/metrics", status_code=410)
def get_experiment_metrics(experiment_id: UUID):
    raise HTTPException(status_code=410, detail="Use GET /api/runs/{run_id}/metrics")
