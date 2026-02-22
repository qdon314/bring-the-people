"""JSONL event log implementation."""
from __future__ import annotations

import json
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import UUID

from growth.domain.events import DomainEvent
from growth.ports.event_log import EventLog


class JSONLEventLog(EventLog):
    """Append-only JSONL event log.

    Each line is a JSON object representing a domain event.
    The log is append-only and immutable.
    """

    def __init__(self, log_path: Path):
        self._log_path = log_path
        # Ensure parent directory exists
        self._log_path.parent.mkdir(parents=True, exist_ok=True)

    def append(self, event: DomainEvent) -> None:
        """Append an event to the log."""
        record = _event_to_dict(event)
        with open(self._log_path, "a") as f:
            json.dump(record, f, default=_json_serializer)
            f.write("\n")

    def read_all(self) -> list[dict[str, Any]]:
        """Read all events from the log."""
        events = []
        if not self._log_path.exists():
            return events

        with open(self._log_path, "r") as f:
            for line in f:
                line = line.strip()
                if line:
                    events.append(json.loads(line))
        return events

    def read_since(self, since: datetime) -> list[dict[str, Any]]:
        """Read events since a given timestamp."""
        all_events = self.read_all()
        return [
            e for e in all_events
            if datetime.fromisoformat(e["occurred_at"]) >= since
        ]


def _event_to_dict(event: DomainEvent) -> dict[str, Any]:
    """Convert a domain event to a dictionary for serialization."""
    # Start with base fields
    result = {
        "event_id": str(event.event_id),
        "event_type": event.event_type,
        "occurred_at": event.occurred_at.isoformat(),
    }

    # Add all other fields from the dataclass
    for key, value in asdict(event).items():
        if key in ("event_id", "event_type", "occurred_at"):
            continue
        if isinstance(value, UUID):
            result[key] = str(value)
        elif hasattr(value, "value"):  # Enum
            result[key] = value.value
        elif isinstance(value, datetime):
            result[key] = value.isoformat()
        else:
            result[key] = value

    return result


def _json_serializer(obj: Any) -> Any:
    """JSON serializer for special types."""
    if isinstance(obj, UUID):
        return str(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")
