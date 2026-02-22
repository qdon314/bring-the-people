"""Pydantic schemas for API request/response validation."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


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


class ShowUpdate(BaseModel):
    artist_name: Optional[str] = None
    city: Optional[str] = None
    venue: Optional[str] = None
    show_time: Optional[datetime] = None
    timezone: Optional[str] = None
    capacity: Optional[int] = Field(default=None, gt=0)
    tickets_total: Optional[int] = Field(default=None, ge=0)
    tickets_sold: Optional[int] = Field(default=None, ge=0)


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
