"""Cycle API routes."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Request

from growth.app.schemas import CycleResponse
from growth.domain.models import Cycle

router = APIRouter()


@router.get("/{show_id}/cycles", response_model=list[CycleResponse])
def list_cycles(show_id: UUID, request: Request):
    repo = request.state.container.cycle_repo()
    return [CycleResponse.from_domain(c) for c in repo.get_by_show(show_id)]


@router.post("/{show_id}/cycles", status_code=201, response_model=CycleResponse)
def create_cycle(show_id: UUID, request: Request):
    show_repo = request.state.container.show_repo()
    show = show_repo.get_by_id(show_id)
    if show is None:
        raise HTTPException(status_code=404, detail="Show not found")
    cycle = Cycle(
        cycle_id=uuid4(),
        show_id=show_id,
        started_at=datetime.now(timezone.utc),
    )
    repo = request.state.container.cycle_repo()
    repo.save(cycle)
    return CycleResponse.from_domain(cycle)


@router.get("/cycles/{cycle_id}", response_model=CycleResponse)
def get_cycle(cycle_id: UUID, request: Request):
    repo = request.state.container.cycle_repo()
    cycle = repo.get_by_id(cycle_id)
    if cycle is None:
        raise HTTPException(404, "Cycle not found")
    return CycleResponse.from_domain(cycle)
