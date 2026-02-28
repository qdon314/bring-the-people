"""Decisions API routes."""
from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request

from growth.app.schemas import DecisionResponse
from growth.domain.models import ExperimentStatus

router = APIRouter()


def _get_exp_repo(request: Request):
    return request.state.container.experiment_repo()


def _get_decision_service(request: Request):
    return request.state.container.decision_service()


@router.post("/evaluate/{experiment_id}", response_model=DecisionResponse)
def evaluate_experiment(experiment_id: UUID, request: Request):
    """Evaluate an experiment and return a decision."""
    # Verify experiment exists first
    repo = _get_exp_repo(request)
    exp = repo.get_by_id(experiment_id)
    if exp is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    # Use decision service to evaluate
    service = _get_decision_service(request)
    decision = service.evaluate_experiment(experiment_id)

    # Transition experiment to DECIDED status
    updated_exp = replace(
        exp,
        status=ExperimentStatus.DECIDED,
        end_time=datetime.now(timezone.utc),
    )
    repo.save(updated_exp)

    return DecisionResponse.from_domain(decision)


@router.get("", response_model=list[DecisionResponse])
def list_decisions(experiment_id: UUID, request: Request):
    """Get all decisions for an experiment."""
    repo = _get_exp_repo(request)
    decisions = repo.get_decisions(experiment_id)
    return [DecisionResponse.from_domain(d) for d in decisions]
