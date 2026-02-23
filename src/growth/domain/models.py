"""Core domain models. All dataclasses are frozen (immutable)."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID


class ShowPhase(Enum):
    """Time-to-show phase, determines cadence and baseline windows."""
    EARLY = "early"    # T-60..T-22
    MID = "mid"        # T-21..T-8
    LATE = "late"      # T-7..T-0


class ExperimentStatus(Enum):
    DRAFT = "draft"
    AWAITING_APPROVAL = "awaiting_approval"
    APPROVED = "approved"
    RUNNING = "running"
    COMPLETED = "completed"
    STOPPED = "stopped"
    ARCHIVED = "archived"


class DecisionAction(Enum):
    SCALE = "scale"
    HOLD = "hold"
    KILL = "kill"


class ReviewStatus(str, Enum):
    DRAFT = "draft"
    APPROVED = "approved"
    REJECTED = "rejected"


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


@dataclass(frozen=True)
class Experiment:
    experiment_id: UUID
    show_id: UUID
    segment_id: UUID
    frame_id: UUID
    channel: str
    objective: str
    budget_cap_cents: int
    status: ExperimentStatus
    start_time: datetime | None
    end_time: datetime | None
    baseline_snapshot: dict[str, Any]
    cycle_id: UUID | None = None


@dataclass(frozen=True)
class Observation:
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
    negative_comment_rate: float | None
    attribution_model: str
    raw_json: dict[str, Any]


@dataclass(frozen=True)
class Decision:
    decision_id: UUID
    experiment_id: UUID
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
