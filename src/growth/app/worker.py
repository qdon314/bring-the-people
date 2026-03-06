"""In-process background job worker."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from growth.app.container import Container

logger = logging.getLogger(__name__)


async def worker_loop(container: Container) -> None:
    """Poll the jobs table for queued jobs and run them. Runs forever."""
    logger.info("Background worker started")
    sc = container.session_container()
    try:
        sc.job_repo().reset_stale_running_jobs()
    finally:
        sc.close()

    while True:
        try:
            sc = container.session_container()
            try:
                job = sc.job_repo().claim_next_queued()
            finally:
                sc.close()

            if job is not None:
                await _run_job(job, container)
            else:
                await asyncio.sleep(1)
        except Exception:
            logger.exception("Worker loop error; continuing")
            await asyncio.sleep(2)


async def _run_job(job, container: Container) -> None:
    sc = container.session_container()
    try:
        job_repo = sc.job_repo()

        async def heartbeat(job_id, interval: int = 10):
            while True:
                await asyncio.sleep(interval)
                _update_heartbeat(job_repo, job_id)

        hb_task = asyncio.create_task(heartbeat(job.job_id))
        try:
            result = await _dispatch(job, sc)
            _mark_completed(job_repo, job.job_id, result)
        except Exception as e:
            logger.exception(f"Job {job.job_id} failed")
            _mark_failed(job_repo, job.job_id, str(e))
        finally:
            hb_task.cancel()
    finally:
        sc.close()


async def _dispatch(job, sc) -> dict:
    """Route job to the appropriate service and run it. Returns result_json dict."""
    from uuid import UUID
    if job.job_type.value == "strategy":
        service = sc.strategy_service()
        result = service.run(
            UUID(job.input_json["show_id"]),
            UUID(job.input_json["cycle_id"]),
        )
        return {
            "run_id": str(result.run_id),
            "cycle_id": str(result.cycle_id),
            "segment_ids": [str(s) for s in result.segment_ids],
            "frame_ids": [str(f) for f in result.frame_ids],
            "reasoning_summary": result.strategy_output.reasoning_summary,
            "turns_used": result.turns_used,
        }
    elif job.job_type.value == "creative":
        service = sc.creative_service()
        result = service.run(UUID(job.input_json["frame_id"]))
        return {
            "run_id": str(result.run_id),
            "variant_ids": [str(v) for v in result.variant_ids],
            "reasoning_summary": result.creative_output.reasoning_summary,
            "turns_used": result.turns_used,
        }
    elif job.job_type.value == "memo":
        service = sc.memo_service()
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None, service.run,
            UUID(job.input_json["show_id"]),
            job.input_json["cycle_start"],
            job.input_json["cycle_end"],
        )
        return {"memo_id": str(result.memo_id), "run_id": str(result.run_id)}
    else:
        raise ValueError(f"Unknown job type: {job.job_type}")


def _mark_completed(job_repo, job_id, result: dict):
    """Mark a job as completed."""
    job = job_repo.get_by_id(job_id)
    if job is None:
        return

    from growth.domain.models import BackgroundJob, JobStatus
    updated = BackgroundJob(
        job_id=job.job_id,
        job_type=job.job_type,
        status=JobStatus.COMPLETED,
        show_id=job.show_id,
        input_json=job.input_json,
        result_json=result,
        error_message=None,
        attempt_count=job.attempt_count,
        last_heartbeat_at=job.last_heartbeat_at,
        created_at=job.created_at,
        updated_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
    )
    job_repo.save(updated)


def _mark_failed(job_repo, job_id, error: str):
    """Mark a job as failed."""
    job = job_repo.get_by_id(job_id)
    if job is None:
        return

    from growth.domain.models import BackgroundJob, JobStatus
    updated = BackgroundJob(
        job_id=job.job_id,
        job_type=job.job_type,
        status=JobStatus.FAILED,
        show_id=job.show_id,
        input_json=job.input_json,
        result_json=None,
        error_message=error,
        attempt_count=job.attempt_count,
        last_heartbeat_at=job.last_heartbeat_at,
        created_at=job.created_at,
        updated_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
    )
    job_repo.save(updated)


def _update_heartbeat(job_repo, job_id):
    """Update the heartbeat for a running job."""
    job = job_repo.get_by_id(job_id)
    if job is None:
        return

    from growth.domain.models import BackgroundJob
    updated = BackgroundJob(
        job_id=job.job_id,
        job_type=job.job_type,
        status=job.status,
        show_id=job.show_id,
        input_json=job.input_json,
        result_json=job.result_json,
        error_message=job.error_message,
        attempt_count=job.attempt_count,
        last_heartbeat_at=datetime.now(timezone.utc),
        created_at=job.created_at,
        updated_at=datetime.now(timezone.utc),
        completed_at=job.completed_at,
    )
    job_repo.save(updated)
