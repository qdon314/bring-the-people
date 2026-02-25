"""Memo Agent API endpoint."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Query, Request

from growth.app.schemas import MemoResponse
from growth.domain.models import BackgroundJob, JobStatus, JobType

router = APIRouter()


@router.get("", response_model=list[MemoResponse])
def list_memos(show_id: UUID, request: Request):
    """List all memos for a show."""
    repo = request.state.container.memo_repo()
    memos = repo.get_by_show(show_id)
    return [MemoResponse.from_domain(m) for m in memos]


@router.get("/{memo_id}", response_model=MemoResponse)
def get_memo(memo_id: UUID, request: Request):
    """Get a memo by ID."""
    repo = request.state.container.memo_repo()
    memo = repo.get_by_id(memo_id)
    if memo is None:
        raise HTTPException(404, "Memo not found")
    return MemoResponse.from_domain(memo)


@router.post("/{show_id}/run", status_code=202)
def run_memo(
    show_id: UUID,
    request: Request,
    cycle_start: datetime = Query(..., description="ISO timestamp for cycle start"),
    cycle_end: datetime = Query(..., description="ISO timestamp for cycle end"),
):
    """Run the Memo Agent for a show (enqueues a job)."""
    if cycle_start >= cycle_end:
        raise HTTPException(status_code=422, detail="cycle_start must be before cycle_end")

    container = request.state.container
    
    # Validate show exists
    show = container.show_repo().get_by_id(show_id)
    if show is None:
        raise HTTPException(404, "Show not found")

    job = BackgroundJob(
        job_id=uuid4(),
        job_type=JobType.MEMO,
        status=JobStatus.QUEUED,
        show_id=show_id,
        input_json={
            "show_id": str(show_id),
            "cycle_start": cycle_start.isoformat(),
            "cycle_end": cycle_end.isoformat(),
        },
        result_json=None,
        error_message=None,
        attempt_count=0,
        last_heartbeat_at=None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        completed_at=None,
    )
    container.job_repo().save(job)
    return {"job_id": str(job.job_id), "status": "queued"}
