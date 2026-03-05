"""Segment API routes."""
from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request

from growth.app.schemas import ReviewAction, ReviewRequest, SegmentResponse, SegmentUpdate
from growth.domain.models import AudienceSegment, ReviewStatus

router = APIRouter()


@router.get("", response_model=list[SegmentResponse])
def list_segments(
    show_id: UUID,
    cycle_id: Optional[UUID] = None,
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

    if body.action == ReviewAction.UNDO:
        new_status = ReviewStatus.PENDING
        reviewed_at = None
        reviewed_by = None
    elif body.action == ReviewAction.APPROVE:
        new_status = ReviewStatus.APPROVED
        reviewed_at = datetime.now(timezone.utc)
        reviewed_by = body.reviewed_by
    else:
        new_status = ReviewStatus.REJECTED
        reviewed_at = datetime.now(timezone.utc)
        reviewed_by = body.reviewed_by

    updated = replace(segment, review_status=new_status, reviewed_at=reviewed_at, reviewed_by=reviewed_by)
    repo.save(updated)
    return SegmentResponse.from_domain(updated)
