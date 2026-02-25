"""Job API routes."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Request

from growth.app.schemas import JobResponse

router = APIRouter()


@router.get("/{job_id}", response_model=JobResponse)
def get_job(job_id: UUID, request: Request):
    repo = request.state.container.job_repo()
    job = repo.get_by_id(job_id)
    if job is None:
        raise HTTPException(404, "Job not found")
    return JobResponse.from_domain(job)
