"""Domain events for the growth system.

All events are immutable dataclasses with a unique event_id,
timestamp (occurred_at), and event_type string.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from uuid import UUID

from growth.domain.models import DecisionAction


@dataclass(frozen=True)
class DomainEvent:
    """Base class for all domain events."""
    event_id: UUID
    event_type: str
    occurred_at: datetime


@dataclass(frozen=True)
class ExperimentStarted(DomainEvent):
    """Emitted when an experiment begins running."""
    experiment_id: UUID
    show_id: UUID
    channel: str
    objective: str
    budget_cap_cents: int
    baseline_snapshot: dict[str, Any]
    event_type: str = field(default="experiment_started", init=False)


@dataclass(frozen=True)
class ObservationAdded(DomainEvent):
    """Emitted when a new observation window is recorded."""
    observation_id: UUID
    experiment_id: UUID
    window_start: datetime
    window_end: datetime
    spend_cents: int
    purchases: int
    revenue_cents: int
    event_type: str = field(default="observation_added", init=False)


@dataclass(frozen=True)
class DecisionRecorded(DomainEvent):
    """Emitted when a decision is made on an experiment."""
    decision_id: UUID
    experiment_id: UUID
    action: DecisionAction
    confidence: float
    rationale: str
    policy_version: str
    event_type: str = field(default="decision_recorded", init=False)


@dataclass(frozen=True)
class ExperimentApproved(DomainEvent):
    """Emitted when a producer approves an experiment."""
    experiment_id: UUID
    show_id: UUID
    approved_by: str
    approved_at: datetime
    event_type: str = field(default="experiment_approved", init=False)


@dataclass(frozen=True)
class ExperimentCompleted(DomainEvent):
    """Emitted when an experiment ends (scaled, killed, or stopped)."""
    experiment_id: UUID
    show_id: UUID
    final_action: DecisionAction
    total_spend_cents: int
    total_purchases: int
    total_revenue_cents: int
    event_type: str = field(default="experiment_completed", init=False)


@dataclass(frozen=True)
class StrategyCompleted(DomainEvent):
    """Emitted when the Strategy Agent produces a successful plan."""
    show_id: UUID
    run_id: UUID
    num_frame_plans: int
    segment_ids: tuple[UUID, ...]
    frame_ids: tuple[UUID, ...]
    turns_used: int
    total_input_tokens: int
    total_output_tokens: int
    event_type: str = field(default="strategy_completed", init=False)


@dataclass(frozen=True)
class StrategyFailed(DomainEvent):
    """Emitted when the Strategy Agent fails."""
    show_id: UUID
    run_id: UUID
    error_type: str
    error_message: str
    event_type: str = field(default="strategy_failed", init=False)
