"""Frame API routes."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request

from growth.app.schemas import FrameResponse, ReviewAction, ReviewRequest
from growth.domain.models import ReviewStatus

router = APIRouter()


@router.get("", response_model=list[FrameResponse])
def list_frames(
    show_id: UUID,
    cycle_id: UUID | None = None,
    segment_id: UUID | None = None,
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


@router.post("/{frame_id}/review", response_model=FrameResponse)
def review_frame(frame_id: UUID, body: ReviewRequest, request: Request):
    repo = request.state.container.frame_repo()
    frame = repo.get_by_id(frame_id)
    if frame is None:
        raise HTTPException(404, "Frame not found")

    from growth.domain.models import CreativeFrame

    new_status = (
        ReviewStatus.APPROVED
        if body.action == ReviewAction.APPROVE
        else ReviewStatus.REJECTED
    )
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
        reviewed_at=datetime.now(timezone.utc),
        reviewed_by=body.reviewed_by,
    )
    repo.save(updated)
    return FrameResponse.from_domain(updated)
