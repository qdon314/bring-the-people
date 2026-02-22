"""Repository protocols (ports) for the domain."""
from __future__ import annotations

from typing import Protocol
from uuid import UUID

from growth.domain.models import Decision, Experiment, Observation, Show


class ShowRepository(Protocol):
    """Protocol for show persistence."""

    def get_by_id(self, show_id: UUID) -> Show | None:
        """Get a show by ID."""
        ...

    def save(self, show: Show) -> None:
        """Save a show."""
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
