"""Creative Agent tool functions."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from growth.domain.models import get_show_phase
from growth.ports.repositories import FrameRepository, SegmentRepository, ShowRepository


# Platform constraints — hardcoded for MVP
PLATFORM_CONSTRAINTS: dict[str, dict[str, Any]] = {
    "meta": {
        "constraints": {"hook": 80, "body": 500, "cta": 60},
        "notes": "Front-load value prop in first line. Emoji OK but not required. "
                 "Primary text shows ~125 chars before 'See more' on mobile.",
    },
    "instagram": {
        "constraints": {"hook": 80, "body": 400, "cta": 60},
        "notes": "Visual-first platform. Hook must work as overlay text. "
                 "Keep body concise — captions are secondary to creative.",
    },
    "youtube": {
        "constraints": {"hook": 70, "body": 500, "cta": 50},
        "notes": "Hook must grab in first 5 seconds. Body supports the video script. "
                 "CTA should be specific and time-bound.",
    },
    "tiktok": {
        "constraints": {"hook": 60, "body": 300, "cta": 40},
        "notes": "Authenticity over polish. Hook must stop the scroll. "
                 "Avoid corporate language. Short, punchy copy wins.",
    },
    "reddit": {
        "constraints": {"hook": 80, "body": 500, "cta": 60},
        "notes": "Community-aware tone. Avoid hard sell. "
                 "Frame as genuine recommendation, not advertisement.",
    },
    "snapchat": {
        "constraints": {"hook": 50, "body": 200, "cta": 30},
        "notes": "Ephemeral, casual tone. Very short copy. "
                 "Hook is everything — body is optional on most placements.",
    },
}


def get_frame_context(
    frame_id: UUID,
    frame_repo: FrameRepository,
    seg_repo: SegmentRepository,
    show_repo: ShowRepository,
) -> dict[str, Any]:
    """Get the creative brief: frame, segment, and show context."""
    frame = frame_repo.get_by_id(frame_id)
    if frame is None:
        return {"error": "frame_not_found"}

    segment = seg_repo.get_by_id(frame.segment_id)
    if segment is None:
        return {"error": "segment_not_found"}

    show = show_repo.get_by_id(frame.show_id)
    if show is None:
        return {"error": "show_not_found"}

    now = datetime.now(timezone.utc)
    phase = get_show_phase(show.show_time, now)
    days_until_show = (show.show_time - now).days

    return {
        "frame": {
            "hypothesis": frame.hypothesis,
            "promise": frame.promise,
            "evidence_refs": frame.evidence_refs,
            "risk_notes": frame.risk_notes,
            "channel": frame.channel,
        },
        "segment": {
            "name": segment.name,
            "definition": segment.definition_json,
            "estimated_size": segment.estimated_size,
        },
        "show": {
            "artist_name": show.artist_name,
            "city": show.city,
            "venue": show.venue,
            "show_time": show.show_time.isoformat(),
            "capacity": show.capacity,
            "tickets_sold": show.tickets_sold,
            "tickets_total": show.tickets_total,
            "phase": phase.value,
            "days_until_show": days_until_show,
        },
    }


def get_platform_constraints(
    channel: str,
) -> dict[str, Any]:
    """Get character limits and formatting rules for a platform."""
    if channel not in PLATFORM_CONSTRAINTS:
        return {"error": "unknown_channel"}

    return {
        "channel": channel,
        **PLATFORM_CONSTRAINTS[channel],
    }
