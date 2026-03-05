"""Frame API routes."""
from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request

from growth.app.schemas import FrameResponse, FrameUpdate, ReviewAction, ReviewRequest
from growth.domain.models import ReviewStatus

router = APIRouter()


@router.get("", response_model=list[FrameResponse])
def list_frames(
    show_id: UUID,
    cycle_id: Optional[UUID] = None,
    segment_id: Optional[UUID] = None,
    request: Request = ...,
):
    repo = request.state.container.frame_repo()
    frames = repo.get_by_show(show_id)
    if cycle_id:
        frames = [f for f in frames if f.cycle_id == cycle_id]
    if segment_id:
        frames = [f for f in frames if f.segment_id == segment_id]
    return [FrameResponse.from_domain(f) for f in frames]


@router.get("/{frame_id}", response_model=FrameResponse)
def get_frame(frame_id: UUID, request: Request):
    repo = request.state.container.frame_repo()
    frame = repo.get_by_id(frame_id)
    if frame is None:
        raise HTTPException(404, "Frame not found")
    return FrameResponse.from_domain(frame)


@router.patch("/{frame_id}", response_model=FrameResponse)
def update_frame(frame_id: UUID, body: FrameUpdate, request: Request):
    repo = request.state.container.frame_repo()
    frame = repo.get_by_id(frame_id)
    if frame is None:
        raise HTTPException(404, "Frame not found")

    updates = {}
    if "hypothesis" in body.model_fields_set:
        updates["hypothesis"] = body.hypothesis
    if "promise" in body.model_fields_set:
        updates["promise"] = body.promise
    if "evidence_refs" in body.model_fields_set:
        updates["evidence_refs"] = body.evidence_refs
    if "channel" in body.model_fields_set:
        updates["channel"] = body.channel
    if "risk_notes" in body.model_fields_set:
        updates["risk_notes"] = body.risk_notes

    updated = replace(frame, **updates)
    repo.save(updated)
    return FrameResponse.from_domain(updated)


@router.post("/{frame_id}/review", response_model=FrameResponse)
def review_frame(frame_id: UUID, body: ReviewRequest, request: Request):
    repo = request.state.container.frame_repo()
    frame = repo.get_by_id(frame_id)
    if frame is None:
        raise HTTPException(404, "Frame not found")

    from growth.domain.models import CreativeFrame

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

    updated = CreativeFrame(
        frame_id=frame.frame_id,
        show_id=frame.show_id,
        segment_id=frame.segment_id,
        hypothesis=frame.hypothesis,
        promise=frame.promise,
        evidence_refs=frame.evidence_refs,
        channel=frame.channel,
        risk_notes=frame.risk_notes,
        cycle_id=frame.cycle_id,
        review_status=new_status,
        reviewed_at=reviewed_at,
        reviewed_by=reviewed_by,
    )
    repo.save(updated)
    return FrameResponse.from_domain(updated)
