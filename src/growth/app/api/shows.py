"""Shows API routes."""
from __future__ import annotations

from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Request, Response, status

from growth.app.schemas import ShowCreate, ShowResponse, ShowUpdate
from growth.domain.models import Show

router = APIRouter()


def _get_show_repo(request: Request):
    return request.state.container.show_repo()


@router.post("", status_code=201, response_model=ShowResponse)
def create_show(body: ShowCreate, request: Request):
    repo = _get_show_repo(request)
    show = Show(
        show_id=uuid4(),
        artist_name=body.artist_name,
        city=body.city,
        venue=body.venue,
        show_time=body.show_time,
        timezone=body.timezone,
        capacity=body.capacity,
        tickets_total=body.tickets_total,
        tickets_sold=body.tickets_sold,
        currency=body.currency,
        ticket_base_url=body.ticket_base_url,
    )
    repo.save(show)
    return ShowResponse.from_domain(show)


@router.get("", response_model=list[ShowResponse])
def list_shows(request: Request):
    repo = _get_show_repo(request)
    shows = repo.list_all()
    return [ShowResponse.from_domain(s) for s in shows]


@router.get("/{show_id}", response_model=ShowResponse)
def get_show(show_id: UUID, request: Request):
    repo = _get_show_repo(request)
    show = repo.get_by_id(show_id)
    if show is None:
        raise HTTPException(status_code=404, detail="Show not found")
    return ShowResponse.from_domain(show)


@router.patch("/{show_id}", response_model=ShowResponse)
def update_show(show_id: UUID, body: ShowUpdate, request: Request):
    repo = _get_show_repo(request)
    existing = repo.get_by_id(show_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Show not found")

    # Build updated show from existing + patch fields
    updates = body.model_dump(exclude_unset=True)
    from dataclasses import asdict
    current = asdict(existing)
    current.update(updates)
    updated_show = Show(**current)
    repo.save(updated_show)
    return ShowResponse.from_domain(updated_show)


@router.delete("/{show_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_show(show_id: UUID, request: Request):
    repo = _get_show_repo(request)
    deleted = repo.delete(show_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Show not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
