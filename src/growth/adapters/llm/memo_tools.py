"""Memo Agent tool functions."""
from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from growth.ports.repositories import ExperimentRepository, FrameRepository, SegmentRepository


def get_cycle_experiments(
    show_id: UUID,
    cycle_start: str,
    cycle_end: str,
    exp_repo: ExperimentRepository,
    seg_repo: SegmentRepository,
    frame_repo: FrameRepository,
) -> dict[str, Any]:
    """Get all experiments in the cycle window with normalized, memo-friendly fields."""
    start = datetime.fromisoformat(cycle_start)
    end = datetime.fromisoformat(cycle_end)

    all_experiments = exp_repo.get_by_show(show_id)

    # Filter to experiments overlapping the cycle window
    cycle_experiments = []
    for exp in all_experiments:
        if exp.start_time is None:
            continue
        exp_end = exp.end_time or end
        if exp.start_time < end and exp_end > start:
            cycle_experiments.append(exp)

    results = []
    for exp in cycle_experiments:
        # Get segment and frame context
        segment = seg_repo.get_by_id(exp.segment_id)
        frame = frame_repo.get_by_id(exp.frame_id)

        # Aggregate observations
        observations = exp_repo.get_observations(exp.experiment_id)
        agg = {
            "spend_cents": sum(o.spend_cents for o in observations),
            "impressions": sum(o.impressions for o in observations),
            "clicks": sum(o.clicks for o in observations),
            "purchases": sum(o.purchases for o in observations),
            "revenue_cents": sum(o.revenue_cents for o in observations),
        }

        # Get latest decision
        decisions = exp_repo.get_decisions(exp.experiment_id)
        decision_data = None
        if decisions:
            latest = decisions[-1]
            decision_data = {
                "action": latest.action.value,
                "confidence": latest.confidence,
                "rationale": latest.rationale,
            }

        results.append({
            "experiment_id": str(exp.experiment_id),
            "segment_name": segment.name if segment else "unknown",
            "frame_hypothesis": frame.hypothesis if frame else "unknown",
            "channel": exp.channel,
            "budget_cap_cents": exp.budget_cap_cents,
            "observations": agg,
            "decision": decision_data,
        })

    return {"experiments": results}
