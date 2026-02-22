"""Repository protocols (ports) for the domain."""
from __future__ import annotations

from typing import Protocol
from uuid import UUID

from growth.domain.models import AudienceSegment, CreativeFrame, Decision, Experiment, Observation, Show


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
