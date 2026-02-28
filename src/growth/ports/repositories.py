"""Repository protocols (ports) for the domain."""
from __future__ import annotations

from typing import Protocol
from uuid import UUID

from growth.domain.models import (
    AudienceSegment,
    BackgroundJob,
    CreativeFrame,
    CreativeVariant,
    Cycle,
    Decision,
    Experiment,
    Observation,
    ProducerMemo,
    Show,
)


class CycleRepository(Protocol):
    """Protocol for cycle persistence."""

    def get_by_id(self, cycle_id: UUID) -> Cycle | None:
        """Get a cycle by ID."""
        ...

    def save(self, cycle: Cycle) -> None:
        """Save a cycle."""
        ...

    def get_by_show(self, show_id: UUID) -> list[Cycle]:
        """Get all cycles for a show."""
        ...


class SegmentRepository(Protocol):
    """Protocol for audience segment persistence."""

    def get_by_id(self, segment_id: UUID) -> AudienceSegment | None:
        """Get a segment by ID."""
        ...

    def save(self, segment: AudienceSegment) -> None:
        """Save a segment."""
        ...

    def get_by_show(self, show_id: UUID) -> list[AudienceSegment]:
        """Get all segments for a show."""
        ...


class FrameRepository(Protocol):
    """Protocol for creative frame persistence."""

    def get_by_id(self, frame_id: UUID) -> CreativeFrame | None:
        """Get a frame by ID."""
        ...

    def save(self, frame: CreativeFrame) -> None:
        """Save a frame."""
        ...

    def get_by_show(self, show_id: UUID) -> list[CreativeFrame]:
        """Get all frames for a show."""
        ...


class CreativeVariantRepository(Protocol):
    """Protocol for creative variant persistence."""

    def get_by_id(self, variant_id: UUID) -> CreativeVariant | None:
        """Get a variant by ID."""
        ...

    def save(self, variant: CreativeVariant) -> None:
        """Save a variant."""
        ...

    def get_by_frame(self, frame_id: UUID) -> list[CreativeVariant]:
        """Get all variants for a frame."""
        ...


class ProducerMemoRepository(Protocol):
    """Protocol for producer memo persistence."""

    def get_by_id(self, memo_id: UUID) -> ProducerMemo | None:
        """Get a memo by ID."""
        ...

    def save(self, memo: ProducerMemo) -> None:
        """Save a memo."""
        ...

    def get_by_show(self, show_id: UUID) -> list[ProducerMemo]:
        """Get all memos for a show."""
        ...


class ShowRepository(Protocol):
    """Protocol for show persistence."""

    def get_by_id(self, show_id: UUID) -> Show | None:
        """Get a show by ID."""
        ...

    def save(self, show: Show) -> None:
        """Save a show."""
        ...

    def list_all(self) -> list[Show]:
        """Get all shows."""
        ...

    def delete(self, show_id: UUID) -> bool:
        """Delete a show by ID; returns True if deleted, False if not found."""
        ...


class ExperimentRepository(Protocol):
    """Protocol for experiment persistence."""

    def get_by_id(self, experiment_id: UUID) -> Experiment | None:
        """Get an experiment by ID."""
        ...

    def save(self, experiment: Experiment) -> None:
        """Save an experiment."""
        ...

    def get_by_show(self, show_id: UUID) -> list[Experiment]:
        """Get all experiments for a show."""
        ...

    def add_observation(self, observation: Observation) -> None:
        """Add an observation to an experiment."""
        ...

    def get_observations(self, experiment_id: UUID) -> list[Observation]:
        """Get all observations for an experiment."""
        ...

    def save_decision(self, decision: Decision) -> None:
        """Save a decision for an experiment."""
        ...

    def get_decisions(self, experiment_id: UUID) -> list[Decision]:
        """Get all decisions for an experiment."""
        ...


class JobRepository(Protocol):
    """Protocol for background job persistence."""

    def get_by_id(self, job_id: UUID) -> BackgroundJob | None:
        """Get a job by ID."""
        ...

    def save(self, job: BackgroundJob) -> None:
        """Save a job."""
        ...

    def claim_next_queued(self) -> BackgroundJob | None:
        """Atomically transition one queued job to running. Returns it or None."""
        ...

    def reset_stale_running_jobs(self, stale_after_seconds: int = 120) -> int:
        """Reset running jobs with stale heartbeat back to queued. Returns count reset."""
        ...
