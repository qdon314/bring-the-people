"""Creative Agent API endpoint."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Request

from growth.domain.models import BackgroundJob, JobStatus, JobType

router = APIRouter()


@router.post("/{frame_id}/run", status_code=202)
def run_creative(frame_id: UUID, request: Request):
    """Run the Creative Agent for a frame (enqueues a job)."""
    container = request.app.state.container
    
    # Validate frame exists
    frame = container.frame_repo().get_by_id(frame_id)
    if frame is None:
        raise HTTPException(404, "Frame not found")

    job = BackgroundJob(
        job_id=uuid4(),
        job_type=JobType.CREATIVE,
        status=JobStatus.QUEUED,
        show_id=frame.show_id,
        input_json={"frame_id": str(frame_id)},
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
