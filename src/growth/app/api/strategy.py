"""Strategy API routes."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Request

from growth.app.schemas import StrategyRunRequest
from growth.app.services.strategy_service import StrategyRunError
from growth.domain.models import BackgroundJob, JobStatus, JobType

router = APIRouter()


@router.post("/{show_id}/run", status_code=202)
def run_strategy(show_id: UUID, body: StrategyRunRequest, request: Request):
    """Run the Strategy Agent for a show (enqueues a job)."""
    container = request.state.container
    cycle_id = body.cycle_id
    # Validate show exists
    show = container.show_repo().get_by_id(show_id)
    if show is None:
        raise HTTPException(404, "Show not found")

    # Validate cycle exists and belongs to this show
    cycle = container.cycle_repo().get_by_id(cycle_id)
    if cycle is None or cycle.show_id != show_id:
        raise HTTPException(404, "Cycle not found")

    job = BackgroundJob(
        job_id=uuid4(),
        job_type=JobType.STRATEGY,
        status=JobStatus.QUEUED,
        show_id=show_id,
        input_json={"show_id": str(show_id), "cycle_id": str(cycle_id)},
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
