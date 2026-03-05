"""Variant API routes."""
from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request

from growth.app.schemas import ReviewAction, ReviewRequest, VariantResponse, VariantUpdate
from growth.domain.models import CreativeVariant, ReviewStatus

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


@router.patch("/{variant_id}", response_model=VariantResponse)
def update_variant(variant_id: UUID, body: VariantUpdate, request: Request):
    repo = request.state.container.variant_repo()
    variant = repo.get_by_id(variant_id)
    if variant is None:
        raise HTTPException(404, "Variant not found")

    updates = {}
    if "hook" in body.model_fields_set:
        updates["hook"] = body.hook
    if "body" in body.model_fields_set:
        updates["body"] = body.body
    if "cta" in body.model_fields_set:
        updates["cta"] = body.cta

    updated = replace(variant, **updates)
    repo.save(updated)
    return VariantResponse.from_domain(updated)


@router.post("/{variant_id}/review", response_model=VariantResponse)
def review_variant(variant_id: UUID, body: ReviewRequest, request: Request):
    repo = request.state.container.variant_repo()
    variant = repo.get_by_id(variant_id)
    if variant is None:
        raise HTTPException(404, "Variant not found")

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

    updated = replace(variant, review_status=new_status, reviewed_at=reviewed_at, reviewed_by=reviewed_by)
    repo.save(updated)
    return VariantResponse.from_domain(updated)
