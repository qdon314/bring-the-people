"""Variant API routes."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request

from growth.app.schemas import ReviewRequest, VariantResponse

router = APIRouter()


@router.get("", response_model=list[VariantResponse])
def list_variants(frame_id: UUID, request: Request):
    repo = request.state.container.variant_repo()
    variants = repo.get_by_frame(frame_id)
    return [VariantResponse.from_domain(v) for v in variants]


@router.get("/{variant_id}", response_model=VariantResponse)
def get_variant(variant_id: UUID, request: Request):
    repo = request.state.container.variant_repo()
    variant = repo.get_by_id(variant_id)
    if variant is None:
        raise HTTPException(404, "Variant not found")
    return VariantResponse.from_domain(variant)


@router.post("/{variant_id}/review", response_model=VariantResponse)
def review_variant(variant_id: UUID, body: ReviewRequest, request: Request):
    repo = request.state.container.variant_repo()
    variant = repo.get_by_id(variant_id)
    if variant is None:
        raise HTTPException(404, "Variant not found")

    from growth.domain.models import CreativeVariant

    new_status = body.action  # "approve" or "reject"
    updated = CreativeVariant(
        variant_id=variant.variant_id,
        frame_id=variant.frame_id,
        platform=variant.platform,
        hook=variant.hook,
        body=variant.body,
        cta=variant.cta,
        constraints_passed=variant.constraints_passed,
        cycle_id=variant.cycle_id,
        review_status=new_status,
        reviewed_at=datetime.now(timezone.utc),
        reviewed_by=body.reviewed_by,
    )
    repo.save(updated)
    return VariantResponse.from_domain(updated)
