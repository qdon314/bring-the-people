"""Memo Agent tool functions."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from growth.ports.repositories import ExperimentRepository, ExperimentRunRepository, FrameRepository, SegmentRepository


def get_cycle_experiments(
    show_id: UUID,
    cycle_start: str,
    cycle_end: str,
    exp_repo: ExperimentRepository,
    seg_repo: SegmentRepository,
    frame_repo: FrameRepository,
    run_repo: Optional[ExperimentRunRepository] = None,
) -> dict[str, Any]:
    """Get all experiments in the cycle window with normalized, memo-friendly fields."""
    start = datetime.fromisoformat(cycle_start)
    end = datetime.fromisoformat(cycle_end)

    all_experiments = exp_repo.get_by_show(show_id)

    results = []
    for exp in all_experiments:
        # Get segment and frame context
        segment = seg_repo.get_by_id(exp.segment_id)
        frame = frame_repo.get_by_id(exp.frame_id)

        if run_repo is not None:
            # Filter by runs that overlap the cycle window
            runs = run_repo.get_by_experiment(exp.experiment_id)
            overlapping_runs = []
            for run in runs:
                if run.start_time is None:
                    continue
                run_end = run.end_time or end
                if run.start_time < end and run_end > start:
                    overlapping_runs.append(run)

            if not overlapping_runs:
                continue

            # Aggregate observations across all overlapping runs
            all_observations = []
            for run in overlapping_runs:
                all_observations.extend(run_repo.get_observations(run.run_id))

            agg = {
                "spend_cents": sum(o.spend_cents for o in all_observations),
                "impressions": sum(o.impressions for o in all_observations),
                "clicks": sum(o.clicks for o in all_observations),
                "purchases": sum(o.purchases for o in all_observations),
                "revenue_cents": sum(o.revenue_cents for o in all_observations),
            }

            # Get latest decision from any overlapping run
            all_decisions = []
            for run in overlapping_runs:
                all_decisions.extend(run_repo.get_decisions(run.run_id))
            decision_data = None
            if all_decisions:
                latest = all_decisions[-1]
                decision_data = {
                    "action": latest.action.value,
                    "confidence": latest.confidence,
                    "rationale": latest.rationale,
                }
        else:
            # Legacy fallback: no run_repo provided
            agg = {
                "spend_cents": 0,
                "impressions": 0,
                "clicks": 0,
                "purchases": 0,
                "revenue_cents": 0,
            }
            decision_data = None

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
