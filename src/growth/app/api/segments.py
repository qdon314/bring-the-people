"""Segment API routes."""
from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request

from growth.app.schemas import ReviewAction, ReviewRequest, SegmentResponse, SegmentUpdate
from growth.domain.models import ReviewStatus

router = APIRouter()


@router.get("", response_model=list[SegmentResponse])
def list_segments(
    show_id: UUID,
    cycle_id: UUID | None = None,
    request: Request = ...,
):
    repo = request.state.container.segment_repo()
    segments = repo.get_by_show(show_id)
    if cycle_id:
        segments = [s for s in segments if s.cycle_id == cycle_id]
    return [SegmentResponse.from_domain(s) for s in segments]


@router.get("/{segment_id}", response_model=SegmentResponse)
def get_segment(segment_id: UUID, request: Request):
    repo = request.state.container.segment_repo()
    segment = repo.get_by_id(segment_id)
    if segment is None:
        raise HTTPException(404, "Segment not found")
    return SegmentResponse.from_domain(segment)


@router.patch("/{segment_id}", response_model=SegmentResponse)
def update_segment(segment_id: UUID, body: SegmentUpdate, request: Request):
    repo = request.state.container.segment_repo()
    segment = repo.get_by_id(segment_id)
    if segment is None:
        raise HTTPException(404, "Segment not found")

    updates = {}
    if "name" in body.model_fields_set:
        updates["name"] = body.name
    if "definition_json" in body.model_fields_set:
        updates["definition_json"] = body.definition_json
    if "estimated_size" in body.model_fields_set:
        updates["estimated_size"] = body.estimated_size

    updated = replace(segment, **updates)
    repo.save(updated)
    return SegmentResponse.from_domain(updated)


@router.post("/{segment_id}/review", response_model=SegmentResponse)
def review_segment(segment_id: UUID, body: ReviewRequest, request: Request):
    repo = request.state.container.segment_repo()
    segment = repo.get_by_id(segment_id)
    if segment is None:
        raise HTTPException(404, "Segment not found")

    from growth.domain.models import AudienceSegment

    new_status = (
        ReviewStatus.APPROVED
        if body.action == ReviewAction.APPROVE
        else ReviewStatus.REJECTED
    )
    updated = AudienceSegment(
        segment_id=segment.segment_id,
        show_id=segment.show_id,
        name=segment.name,
        definition_json=segment.definition_json,
        estimated_size=segment.estimated_size,
        created_by=segment.created_by,
        cycle_id=segment.cycle_id,
        review_status=new_status,
        reviewed_at=datetime.now(timezone.utc),
        reviewed_by=body.reviewed_by,
    )
    repo.save(updated)
    return SegmentResponse.from_domain(updated)
