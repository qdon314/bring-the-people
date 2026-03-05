"""Observations API routes."""
from __future__ import annotations

from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Request

from growth.app.schemas import ObservationBulkCreate, ObservationCreate, ObservationResponse
from growth.domain.models import Observation

router = APIRouter()


def _get_run_repo(request: Request):
    return request.state.container.run_repo()


@router.post("", status_code=201, response_model=ObservationResponse)
def create_observation(body: ObservationCreate, request: Request):
    repo = _get_run_repo(request)

    # Verify run exists
    run = repo.get_by_id(body.run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")

    obs = Observation(
        observation_id=uuid4(),
        run_id=body.run_id,
        window_start=body.window_start,
        window_end=body.window_end,
        spend_cents=body.spend_cents,
        impressions=body.impressions,
        clicks=body.clicks,
        sessions=body.sessions,
        checkouts=body.checkouts,
        purchases=body.purchases,
        revenue_cents=body.revenue_cents,
        refunds=body.refunds,
        refund_cents=body.refund_cents,
        complaints=body.complaints,
        negative_comment_rate=body.negative_comment_rate,
        attribution_model=body.attribution_model,
        raw_json={},
    )
    repo.add_observation(obs)
    return ObservationResponse.from_domain(obs)


@router.post("/bulk", status_code=201, response_model=list[ObservationResponse])
def create_observations_bulk(body: ObservationBulkCreate, request: Request):
    repo = _get_run_repo(request)
    responses = []

    for obs_create in body.observations:
        # Verify run exists
        run = repo.get_by_id(obs_create.run_id)
        if run is None:
            raise HTTPException(status_code=404, detail=f"Run {obs_create.run_id} not found")

        obs = Observation(
            observation_id=uuid4(),
            run_id=obs_create.run_id,
            window_start=obs_create.window_start,
            window_end=obs_create.window_end,
            spend_cents=obs_create.spend_cents,
            impressions=obs_create.impressions,
            clicks=obs_create.clicks,
            sessions=obs_create.sessions,
            checkouts=obs_create.checkouts,
            purchases=obs_create.purchases,
            revenue_cents=obs_create.revenue_cents,
            refunds=obs_create.refunds,
            refund_cents=obs_create.refund_cents,
            complaints=obs_create.complaints,
            negative_comment_rate=obs_create.negative_comment_rate,
            attribution_model=obs_create.attribution_model,
            raw_json={},
        )
        repo.add_observation(obs)
        responses.append(ObservationResponse.from_domain(obs))

    return responses


@router.get("", response_model=list[ObservationResponse])
def list_observations(run_id: UUID, request: Request):
    repo = _get_run_repo(request)
    observations = repo.get_observations(run_id)
    return [ObservationResponse.from_domain(o) for o in observations]
