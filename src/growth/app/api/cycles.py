"""Cycle API routes."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Request

from growth.app.schemas import CycleResponse

router = APIRouter()


@router.get("/{show_id}/cycles", response_model=list[CycleResponse])
def list_cycles(show_id: UUID, request: Request):
    repo = request.app.state.container.cycle_repo()
    return [CycleResponse.from_domain(c) for c in repo.get_by_show(show_id)]


@router.get("/cycles/{cycle_id}", response_model=CycleResponse)
def get_cycle(cycle_id: UUID, request: Request):
    repo = request.app.state.container.cycle_repo()
    cycle = repo.get_by_id(cycle_id)
    if cycle is None:
        raise HTTPException(404, "Cycle not found")
    return CycleResponse.from_domain(cycle)
