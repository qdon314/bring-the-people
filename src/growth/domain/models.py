"""Core domain models. All dataclasses are frozen (immutable)."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID


class ShowPhase(Enum):
    """Time-to-show phase, determines cadence and baseline windows."""
    EARLY = "early"    # T-60..T-22
    MID = "mid"        # T-21..T-8
    LATE = "late"      # T-7..T-0


class RunStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    AWAITING_APPROVAL = "awaiting_approval"
    DECIDED = "decided"


# Backward-compatibility alias — existing code importing ExperimentStatus continues to work.
ExperimentStatus = RunStatus


class DecisionAction(Enum):
    SCALE = "scale"
    HOLD = "hold"
    KILL = "kill"


class ReviewStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class JobType(str, Enum):
    STRATEGY = "strategy"
    CREATIVE = "creative"
    MEMO = "memo"


def get_show_phase(show_time: datetime, now: datetime) -> ShowPhase:
    """Determine the show phase based on days until showtime."""
    days_out = (show_time - now).days
    if days_out >= 22:
        return ShowPhase.EARLY
    elif days_out >= 8:
        return ShowPhase.MID
    else:
        return ShowPhase.LATE


@dataclass(frozen=True)
class Show:
    show_id: UUID
    artist_name: str
    city: str
    venue: str
    show_time: datetime
    timezone: str
    capacity: int
    tickets_total: int
    tickets_sold: int
    currency: str = "USD"
    ticket_base_url: str | None = None


@dataclass(frozen=True)
class Cycle:
    cycle_id: UUID
    show_id: UUID
    started_at: datetime
    label: str | None = None    # e.g. "Cycle 3 · Feb 10–16", auto-generated if None


@dataclass(frozen=True)
class AudienceSegment:
    segment_id: UUID
    show_id: UUID
    name: str
    definition_json: dict[str, Any]
    estimated_size: int | None
    created_by: str
    cycle_id: UUID | None = None
    review_status: ReviewStatus = ReviewStatus.PENDING
    reviewed_at: datetime | None = None
    reviewed_by: str | None = None


@dataclass(frozen=True)
class CreativeFrame:
    frame_id: UUID
    show_id: UUID
    segment_id: UUID
    hypothesis: str
    promise: str
    evidence_refs: list[dict[str, Any]]
    channel: str
    risk_notes: str | None = None
    cycle_id: UUID | None = None
    review_status: ReviewStatus = ReviewStatus.PENDING
    reviewed_at: datetime | None = None
    reviewed_by: str | None = None


@dataclass(frozen=True)
class CreativeVariant:
    variant_id: UUID
    frame_id: UUID
    platform: str
    hook: str
    body: str
    cta: str
    constraints_passed: bool = False
    cycle_id: UUID | None = None
    review_status: ReviewStatus = ReviewStatus.PENDING
    reviewed_at: datetime | None = None
    reviewed_by: str | None = None


@dataclass(frozen=True)
class Experiment:
    experiment_id: UUID
    show_id: UUID
    origin_cycle_id: UUID
    segment_id: UUID
    frame_id: UUID
    channel: str
    objective: str
    budget_cap_cents: int
    baseline_snapshot: dict[str, Any]


@dataclass(frozen=True)
class ExperimentRun:
    run_id: UUID
    experiment_id: UUID
    cycle_id: UUID
    status: RunStatus
    start_time: datetime | None
    end_time: datetime | None
    budget_cap_cents_override: int | None = None
    channel_config: dict[str, Any] = field(default_factory=dict)
    variant_snapshot: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class Observation:
    observation_id: UUID
    run_id: UUID
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
    negative_comment_rate: float | None
    attribution_model: str
    raw_json: dict[str, Any]


@dataclass(frozen=True)
class Decision:
    decision_id: UUID
    run_id: UUID
    action: DecisionAction
    confidence: float
    rationale: str
    policy_version: str
    metrics_snapshot: dict[str, Any]


@dataclass(frozen=True)
class ProducerMemo:
    memo_id: UUID
    show_id: UUID
    cycle_start: datetime
    cycle_end: datetime
    markdown: str
    cycle_id: UUID | None = None


@dataclass(frozen=True)
class BackgroundJob:
    job_id: UUID
    job_type: JobType
    status: JobStatus
    show_id: UUID
    input_json: dict[str, Any]          # e.g. {"show_id": "...", "frame_id": "..."}
    result_json: dict[str, Any] | None
    error_message: str | None
    attempt_count: int
    last_heartbeat_at: datetime | None
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None
