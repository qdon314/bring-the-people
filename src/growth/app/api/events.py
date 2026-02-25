"""Events API routes."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel

router = APIRouter()


class EventDisplay(BaseModel):
    title: str
    subtitle: str


class EventResponse(BaseModel):
    event_id: str
    at: datetime
    show_id: str
    cycle_id: Optional[str]
    type: str
    actor: str
    display: EventDisplay
    payload: dict[str, Any]


_DISPLAY_MAP: dict[str, tuple[str, str]] = {
    "experiment.created": ("Experiment created", "{experiment_id}"),
    "experiment.approval_requested": ("Approval requested", "{experiment_id}"),
    "experiment.approved": ("Experiment approved", "{experiment_id}"),
    "experiment.launched": ("Experiment launched", "{experiment_id}"),
    "observation.window_closed": ("Results window closed", "{experiment_id}"),
    "decision.issued": ("Decision issued", "{action} · {experiment_id}"),
    "memo.published": ("Memo published", "Cycle memo ready"),
    "strategy.completed": ("Strategy Agent ran", "{segment_count} segments · {frame_count} frames"),
    "creative.completed": ("Creative Agent ran", "{variant_count} variants generated"),
}


def _to_display(event_type: str, payload: dict) -> EventDisplay:
    if event_type in _DISPLAY_MAP:
        title_template, subtitle_template = _DISPLAY_MAP[event_type]
        subtitle = subtitle_template.format(**payload)
        return EventDisplay(title=title_template, subtitle=subtitle)
    return EventDisplay(title=event_type, subtitle="")


def _to_event_response(event: dict) -> EventResponse:
    return EventResponse(
        event_id=event.get("event_id", ""),
        at=datetime.fromisoformat(event.get("occurred_at", "")),
        show_id=event.get("show_id", ""),
        cycle_id=event.get("cycle_id"),
        type=event.get("event_type", ""),
        actor=event.get("actor", ""),
        display=_to_display(event.get("event_type", ""), event),
        payload=event,
    )


@router.get("", response_model=list[EventResponse])
def list_events(
    show_id: str,
    cycle_id: str | None = None,
    limit: int = 50,
    request: Request = ...,
):
    event_log = request.state.container.event_log()
    events = event_log.read_by_show(show_id)
    if cycle_id:
        events = [e for e in events if e.get("cycle_id") == cycle_id]
    # sort newest first, limit
    events = sorted(events, key=lambda e: e.get("occurred_at", ""), reverse=True)[:limit]
    return [_to_event_response(e) for e in events]
