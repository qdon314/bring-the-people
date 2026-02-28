"""Strategy Agent tool functions.

Each function reads from repositories and returns dicts that get
JSON-serialized as tool results in the Claude conversation.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from growth.domain.models import ExperimentStatus, get_show_phase
from growth.domain.policy_config import PolicyConfig
from growth.ports.repositories import (
    ExperimentRepository,
    FrameRepository,
    SegmentRepository,
    ShowRepository,
)


def get_show_details(
    show_id: UUID,
    show_repo: ShowRepository,
) -> dict[str, Any]:
    """Get show details including computed phase and days until showtime."""
    show = show_repo.get_by_id(show_id)
    if show is None:
        return {"error": "show_not_found"}

    now = datetime.now(timezone.utc)
    phase = get_show_phase(show.show_time, now)
    delta = show.show_time - now
    days_until = int(delta.total_seconds() // 86400)

    return {
        "show_id": str(show.show_id),
        "artist_name": show.artist_name,
        "city": show.city,
        "venue": show.venue,
        "show_time": show.show_time.isoformat(),
        "timezone": show.timezone,
        "capacity": show.capacity,
        "tickets_total": show.tickets_total,
        "tickets_sold": show.tickets_sold,
        "tickets_remaining": max(0, show.tickets_total - show.tickets_sold),
        "phase": phase.value,
        "days_until_show": days_until,
    }


def get_active_experiments(
    show_id: UUID,
    exp_repo: ExperimentRepository,
    seg_repo: SegmentRepository,
    frame_repo: FrameRepository,
) -> dict[str, Any]:
    """Get all active experiments for a show."""
    all_experiments = exp_repo.get_by_show(show_id)
    active_statuses = {ExperimentStatus.ACTIVE}
    active = [e for e in all_experiments if e.status in active_statuses]

    experiments: list[dict[str, Any]] = []
    for exp in active:
        segment = seg_repo.get_by_id(exp.segment_id)
        frame = frame_repo.get_by_id(exp.frame_id)
        experiments.append({
            "experiment_id": str(exp.experiment_id),
            "segment_id": str(exp.segment_id),
            "frame_id": str(exp.frame_id),
            "segment_name": segment.name if segment else "unknown",
            "hypothesis": frame.hypothesis if frame else "unknown",
            "promise": frame.promise if frame else "unknown",
            "channel": exp.channel,
            "budget_cap_cents": exp.budget_cap_cents,
            "status": exp.status.value,
        })

    return {"experiments": experiments}


def get_budget_status(
    show_id: UUID,
    show_repo: ShowRepository,
    exp_repo: ExperimentRepository,
    policy: PolicyConfig,
    total_budget_cents: int = 50000,
) -> dict[str, Any]:
    """Compute budget status for a show, including current phase cap."""
    show = show_repo.get_by_id(show_id)
    if show is None:
        return {"error": "show_not_found"}

    all_experiments = exp_repo.get_by_show(show_id)

    spent_cents = 0
    for exp in all_experiments:
        observations = exp_repo.get_observations(exp.experiment_id)
        spent_cents += sum(o.spend_cents for o in observations)

    remaining_cents = max(0, total_budget_cents - spent_cents)

    now = datetime.now(timezone.utc)
    phase = get_show_phase(show.show_time, now).value

    phase_caps = {
        "discovery": policy.discovery_max_pct,
        "validation": policy.validation_max_pct,
        "scale": policy.scale_max_pct,
    }
    # Map show phase to budget stage
    phase_to_stage = {"early": "discovery", "mid": "validation", "late": "scale"}
    stage = phase_to_stage.get(phase, "validation")
    current_phase_cap_pct = phase_caps.get(stage, policy.validation_max_pct)
    current_phase_cap_cents = int(total_budget_cents * current_phase_cap_pct)

    return {
        "show_id": str(show_id),
        "phase": phase,
        "total_budget_cents": total_budget_cents,
        "spent_cents": spent_cents,
        "remaining_cents": remaining_cents,
        "phase_cap_pct": phase_caps,
        "current_phase_cap_pct": current_phase_cap_pct,
        "current_phase_cap_cents": current_phase_cap_cents,
    }


def query_knowledge_base(
    show_id: UUID,
    show_repo: ShowRepository,
    exp_repo: ExperimentRepository,
    seg_repo: SegmentRepository,
    frame_repo: FrameRepository,
    filters: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Query past experiments and their outcomes for this show.

    Filters:
      - channel: exact match
      - decision: scale|hold|kill (matches latest decision)
      - city: must match this show's city (otherwise empty)
    """
    filters = filters or {}

    show = show_repo.get_by_id(show_id)
    if show is None:
        return {"error": "show_not_found"}

    if "city" in filters and filters["city"] != show.city:
        return {"experiments": []}

    all_experiments = exp_repo.get_by_show(show_id)

    experiments: list[dict[str, Any]] = []
    for exp in all_experiments:
        if "channel" in filters and exp.channel != filters["channel"]:
            continue

        segment = seg_repo.get_by_id(exp.segment_id)
        frame = frame_repo.get_by_id(exp.frame_id)
        decisions = exp_repo.get_decisions(exp.experiment_id)
        latest_decision = decisions[-1] if decisions else None

        if "decision" in filters:
            got = latest_decision.action.value if latest_decision else None
            if got != filters["decision"]:
                continue

        experiments.append({
            "experiment_id": str(exp.experiment_id),
            "show_id": str(exp.show_id),
            "city": show.city,
            "segment_id": str(exp.segment_id),
            "frame_id": str(exp.frame_id),
            "segment_name": segment.name if segment else "unknown",
            "hypothesis": frame.hypothesis if frame else "unknown",
            "promise": frame.promise if frame else "unknown",
            "channel": exp.channel,
            "budget_cap_cents": exp.budget_cap_cents,
            "status": exp.status.value,
            "decision": latest_decision.action.value if latest_decision else None,
            "confidence": latest_decision.confidence if latest_decision else None,
            "metrics": latest_decision.metrics_snapshot if latest_decision else {},
        })

    return {"experiments": experiments}
