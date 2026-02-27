"""Pydantic schemas for API request/response validation."""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from growth.domain.models import ReviewStatus


# --- Show schemas ---

class ShowCreate(BaseModel):
    artist_name: str = Field(min_length=1, max_length=255)
    city: str = Field(min_length=1, max_length=100)
    venue: str = Field(min_length=1, max_length=255)
    show_time: datetime
    timezone: str = Field(min_length=1, max_length=50)
    capacity: int = Field(gt=0)
    tickets_total: int = Field(ge=0)
    tickets_sold: int = Field(ge=0)
    currency: str = Field(default="USD", max_length=3)
    ticket_base_url: Optional[str] = None


class ShowUpdate(BaseModel):
    artist_name: Optional[str] = None
    city: Optional[str] = None
    venue: Optional[str] = None
    show_time: Optional[datetime] = None
    timezone: Optional[str] = None
    capacity: Optional[int] = Field(default=None, gt=0)
    tickets_total: Optional[int] = Field(default=None, ge=0)
    tickets_sold: Optional[int] = Field(default=None, ge=0)
    ticket_base_url: Optional[str] = None


class ShowResponse(BaseModel):
    show_id: UUID
    artist_name: str
    city: str
    venue: str
    show_time: datetime
    timezone: str
    capacity: int
    tickets_total: int
    tickets_sold: int
    currency: str
    ticket_base_url: Optional[str] = None

    @classmethod
    def from_domain(cls, show) -> ShowResponse:
        return cls(
            show_id=show.show_id,
            artist_name=show.artist_name,
            city=show.city,
            venue=show.venue,
            show_time=show.show_time,
            timezone=show.timezone,
            capacity=show.capacity,
            tickets_total=show.tickets_total,
            tickets_sold=show.tickets_sold,
            currency=show.currency,
            ticket_base_url=show.ticket_base_url,
        )


# --- Experiment schemas ---

class ExperimentCreate(BaseModel):
    show_id: UUID
    segment_id: UUID
    frame_id: UUID
    channel: str = Field(min_length=1, max_length=50)
    objective: str = Field(default="ticket_sales", max_length=100)
    budget_cap_cents: int = Field(gt=0)
    baseline_snapshot: dict[str, Any] = Field(default_factory=dict)


class ExperimentResponse(BaseModel):
    experiment_id: UUID
    show_id: UUID
    cycle_id: Optional[UUID]
    segment_id: UUID
    frame_id: UUID
    channel: str
    objective: str
    budget_cap_cents: int
    status: str
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    baseline_snapshot: dict[str, Any]

    @classmethod
    def from_domain(cls, exp) -> ExperimentResponse:
        return cls(
            experiment_id=exp.experiment_id,
            show_id=exp.show_id,
            cycle_id=exp.cycle_id,
            segment_id=exp.segment_id,
            frame_id=exp.frame_id,
            channel=exp.channel,
            objective=exp.objective,
            budget_cap_cents=exp.budget_cap_cents,
            status=exp.status.value,
            start_time=exp.start_time,
            end_time=exp.end_time,
            baseline_snapshot=exp.baseline_snapshot,
        )


# --- Observation schemas ---

class ObservationCreate(BaseModel):
    experiment_id: UUID
    window_start: datetime
    window_end: datetime
    spend_cents: int = Field(ge=0)
    impressions: int = Field(ge=0)
    clicks: int = Field(ge=0)
    sessions: int = Field(ge=0)
    checkouts: int = Field(ge=0)
    purchases: int = Field(ge=0)
    revenue_cents: int = Field(ge=0)
    refunds: int = Field(ge=0)
    refund_cents: int = Field(ge=0)
    complaints: int = Field(ge=0)
    negative_comment_rate: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    attribution_model: str = Field(default="last_click_utm", max_length=50)

    @model_validator(mode="after")
    def window_end_after_start(self):
        if self.window_end <= self.window_start:
            raise ValueError("window_end must be after window_start")
        return self


class ObservationBulkCreate(BaseModel):
    """Wrapper for CSV/bulk observation ingest."""
    observations: list[ObservationCreate] = Field(min_length=1)


class ObservationResponse(BaseModel):
    observation_id: UUID
    experiment_id: UUID
    window_start: datetime
    window_end: datetime
    spend_cents: int
    impressions: int
    clicks: int
    sessions: int
    checkouts: int
    purchases: int
    revenue_cents: int
    refunds: int
    refund_cents: int
    complaints: int
    negative_comment_rate: Optional[float]
    attribution_model: str

    @classmethod
    def from_domain(cls, obs) -> ObservationResponse:
        return cls(
            observation_id=obs.observation_id,
            experiment_id=obs.experiment_id,
            window_start=obs.window_start,
            window_end=obs.window_end,
            spend_cents=obs.spend_cents,
            impressions=obs.impressions,
            clicks=obs.clicks,
            sessions=obs.sessions,
            checkouts=obs.checkouts,
            purchases=obs.purchases,
            revenue_cents=obs.revenue_cents,
            refunds=obs.refunds,
            refund_cents=obs.refund_cents,
            complaints=obs.complaints,
            negative_comment_rate=obs.negative_comment_rate,
            attribution_model=obs.attribution_model,
        )


# --- Decision schemas ---

class DecisionResponse(BaseModel):
    decision_id: UUID
    experiment_id: UUID
    action: str
    confidence: float
    rationale: str
    policy_version: str
    metrics_snapshot: dict[str, Any]

    @classmethod
    def from_domain(cls, dec) -> DecisionResponse:
        return cls(
            decision_id=dec.decision_id,
            experiment_id=dec.experiment_id,
            action=dec.action.value,
            confidence=dec.confidence,
            rationale=dec.rationale,
            policy_version=dec.policy_version,
            metrics_snapshot=dec.metrics_snapshot,
        )


# --- Approval schemas ---

class ApprovalRequest(BaseModel):
    approved: bool
    notes: str = Field(default="", max_length=1000)


# --- Cycle schemas ---

class CycleResponse(BaseModel):
    cycle_id: UUID
    show_id: UUID
    started_at: datetime
    label: Optional[str]

    @classmethod
    def from_domain(cls, cycle) -> CycleResponse:
        return cls(
            cycle_id=cycle.cycle_id,
            show_id=cycle.show_id,
            started_at=cycle.started_at,
            label=cycle.label,
        )


# --- Segment schemas ---

class SegmentResponse(BaseModel):
    segment_id: UUID
    show_id: UUID
    cycle_id: Optional[UUID]
    name: str
    definition_json: dict[str, Any]
    estimated_size: Optional[int]
    created_by: str
    review_status: ReviewStatus
    reviewed_at: Optional[datetime]
    reviewed_by: Optional[str]

    @classmethod
    def from_domain(cls, seg) -> SegmentResponse:
        return cls(
            segment_id=seg.segment_id,
            show_id=seg.show_id,
            cycle_id=seg.cycle_id,
            name=seg.name,
            definition_json=seg.definition_json,
            estimated_size=seg.estimated_size,
            created_by=seg.created_by,
            review_status=seg.review_status,
            reviewed_at=seg.reviewed_at,
            reviewed_by=seg.reviewed_by,
        )


# --- Frame schemas ---

class FrameResponse(BaseModel):
    frame_id: UUID
    show_id: UUID
    segment_id: UUID
    cycle_id: Optional[UUID]
    hypothesis: str
    promise: str
    evidence_refs: list[dict[str, Any]]
    channel: str
    risk_notes: Optional[str]
    review_status: ReviewStatus
    reviewed_at: Optional[datetime]
    reviewed_by: Optional[str]

    @classmethod
    def from_domain(cls, frame) -> FrameResponse:
        return cls(
            frame_id=frame.frame_id,
            show_id=frame.show_id,
            segment_id=frame.segment_id,
            cycle_id=frame.cycle_id,
            hypothesis=frame.hypothesis,
            promise=frame.promise,
            evidence_refs=frame.evidence_refs,
            channel=frame.channel,
            risk_notes=frame.risk_notes,
            review_status=frame.review_status,
            reviewed_at=frame.reviewed_at,
            reviewed_by=frame.reviewed_by,
        )


# --- Variant schemas ---

class VariantResponse(BaseModel):
    variant_id: UUID
    frame_id: UUID
    cycle_id: Optional[UUID]
    platform: str
    hook: str
    body: str
    cta: str
    constraints_passed: bool
    review_status: ReviewStatus
    reviewed_at: Optional[datetime]
    reviewed_by: Optional[str]

    @classmethod
    def from_domain(cls, variant) -> VariantResponse:
        return cls(
            variant_id=variant.variant_id,
            frame_id=variant.frame_id,
            cycle_id=variant.cycle_id,
            platform=variant.platform,
            hook=variant.hook,
            body=variant.body,
            cta=variant.cta,
            constraints_passed=variant.constraints_passed,
            review_status=variant.review_status,
            reviewed_at=variant.reviewed_at,
            reviewed_by=variant.reviewed_by,
        )


class ReviewAction(str, Enum):
    APPROVE = "approve"
    REJECT = "reject"


# --- Review schemas ---

class ReviewRequest(BaseModel):
    action: ReviewAction
    notes: str = ""
    reviewed_by: str = "producer"


# --- Job schemas ---

class JobResponse(BaseModel):
    job_id: UUID
    job_type: str
    status: str
    show_id: UUID
    result_json: Optional[dict[str, Any]]
    error_message: Optional[str]
    attempt_count: int
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]

    @classmethod
    def from_domain(cls, job) -> JobResponse:
        return cls(
            job_id=job.job_id,
            job_type=job.job_type.value,
            status=job.status.value,
            show_id=job.show_id,
            result_json=job.result_json,
            error_message=job.error_message,
            attempt_count=job.attempt_count,
            created_at=job.created_at,
            updated_at=job.updated_at,
            completed_at=job.completed_at,
        )


# --- Experiment Metrics ---

class ExperimentMetrics(BaseModel):
    experiment_id: UUID
    total_spend_cents: int
    total_impressions: int
    total_clicks: int
    total_purchases: int
    total_revenue_cents: int
    windows_count: int
    ctr: Optional[float]
    cpc_cents: Optional[float]
    cpa_cents: Optional[float]
    roas: Optional[float]
    conversion_rate: Optional[float]
    evidence_sufficient: bool


# --- Memo schemas ---

class MemoResponse(BaseModel):
    memo_id: UUID
    show_id: UUID
    cycle_id: Optional[UUID]
    cycle_start: datetime
    cycle_end: datetime
    markdown: str

    @classmethod
    def from_domain(cls, memo) -> MemoResponse:
        return cls(
            memo_id=memo.memo_id,
            show_id=memo.show_id,
            cycle_id=memo.cycle_id,
            cycle_start=memo.cycle_start,
            cycle_end=memo.cycle_end,
            markdown=memo.markdown,
        )
