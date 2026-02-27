"""Tests for canonical review status mapping in segment/frame/variant review APIs."""
from datetime import datetime, timezone
from uuid import uuid4

from growth.domain.models import AudienceSegment, CreativeFrame, CreativeVariant, Show


def _seed_review_chain(container):
    show = Show(
        show_id=uuid4(),
        artist_name="Test Artist",
        city="Austin",
        venue="The Parish",
        show_time=datetime(2026, 6, 1, 20, 0, tzinfo=timezone.utc),
        timezone="America/Chicago",
        capacity=200,
        tickets_total=200,
        tickets_sold=0,
    )
    segment = AudienceSegment(
        segment_id=uuid4(),
        show_id=show.show_id,
        name="Indie fans",
        definition_json={"interests": ["indie"]},
        estimated_size=1000,
        created_by="strategy_agent",
    )
    frame = CreativeFrame(
        frame_id=uuid4(),
        show_id=show.show_id,
        segment_id=segment.segment_id,
        hypothesis="Social proof drives clicks",
        promise="Packed room, one night only",
        evidence_refs=[],
        channel="meta",
    )
    variant = CreativeVariant(
        variant_id=uuid4(),
        frame_id=frame.frame_id,
        platform="meta",
        hook="Austin is showing up for this one",
        body="Tickets are moving. Join the crowd this Friday.",
        cta="Get tickets",
    )

    sc = container.session_container()
    try:
        sc.show_repo().save(show)
        sc.segment_repo().save(segment)
        sc.frame_repo().save(frame)
        sc.variant_repo().save(variant)
    finally:
        sc.close()
    return segment.segment_id, frame.frame_id, variant.variant_id


def test_segment_review_maps_to_approved_status(client, container):
    segment_id, _, _ = _seed_review_chain(container)
    initial = client.get(f"/api/segments/{segment_id}")
    assert initial.status_code == 200
    assert initial.json()["review_status"] == "pending"

    resp = client.post(
        f"/api/segments/{segment_id}/review",
        json={"action": "approve", "notes": "", "reviewed_by": "producer"},
    )
    assert resp.status_code == 200
    assert resp.json()["review_status"] == "approved"


def test_frame_review_maps_to_rejected_status(client, container):
    _, frame_id, _ = _seed_review_chain(container)
    resp = client.post(
        f"/api/frames/{frame_id}/review",
        json={"action": "reject", "notes": "", "reviewed_by": "producer"},
    )
    assert resp.status_code == 200
    assert resp.json()["review_status"] == "rejected"


def test_variant_review_rejects_status_value_as_action(client, container):
    _, _, variant_id = _seed_review_chain(container)
    resp = client.post(
        f"/api/variants/{variant_id}/review",
        json={"action": "approved", "notes": "", "reviewed_by": "producer"},
    )
    assert resp.status_code == 422
