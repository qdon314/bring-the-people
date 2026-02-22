"""Event log protocol (port)."""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any, Protocol

from growth.domain.events import DomainEvent


class EventLog(Protocol):
    """Protocol for append-only event logs."""

    def append(self, event: DomainEvent) -> None:
        """Append an event to the log."""
        ...

    def read_all(self) -> list[dict[str, Any]]:
        """Read all events from the log."""
        ...

    def read_since(self, since: datetime) -> list[dict[str, Any]]:
        """Read events since a given timestamp."""
        ...
