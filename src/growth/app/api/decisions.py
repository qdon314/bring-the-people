"""Decisions API routes."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Request

from growth.app.schemas import DecisionResponse

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
    try:
        decision = container.decision_service().evaluate_run(run_id)
    except ValueError as exc:
        msg = str(exc)
        if "not found" in msg.lower():
            raise HTTPException(status_code=404, detail=msg)
        raise HTTPException(status_code=409, detail=msg)
    return DecisionResponse.from_domain(decision)


@router.get("", response_model=list[DecisionResponse])
def list_decisions(run_id: UUID, request: Request):
    run_repo = request.state.container.run_repo()
    return [DecisionResponse.from_domain(d) for d in run_repo.get_decisions(run_id)]
