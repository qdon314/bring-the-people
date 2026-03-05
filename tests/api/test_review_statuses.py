"""Tests for canonical review status mapping in segment/frame/variant review APIs."""
from datetime import datetime, timezone
from uuid import uuid4

import pytest

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


def _build_resource_routes(segment_id, frame_id, variant_id):
    return {
        "segment": {
            "review": f"/api/segments/{segment_id}/review",
            "get": f"/api/segments/{segment_id}",
        },
        "frame": {
            "review": f"/api/frames/{frame_id}/review",
            "get": f"/api/frames/{frame_id}",
        },
        "variant": {
            "review": f"/api/variants/{variant_id}/review",
            "get": f"/api/variants/{variant_id}",
        },
    }


def test_review_defaults_are_pending(client, container):
    segment_id, frame_id, variant_id = _seed_review_chain(container)
    routes = _build_resource_routes(segment_id, frame_id, variant_id)

    for resource in ("segment", "frame", "variant"):
        resp = client.get(routes[resource]["get"])
        assert resp.status_code == 200
        assert resp.json()["review_status"] == "pending"


@pytest.mark.parametrize(
    "resource,action,expected_status",
    [
        ("segment", "approve", "approved"),
        ("segment", "reject", "rejected"),
        ("frame", "approve", "approved"),
        ("frame", "reject", "rejected"),
        ("variant", "approve", "approved"),
        ("variant", "reject", "rejected"),
    ],
)
def test_review_actions_map_to_canonical_statuses(
    client, container, resource: str, action: str, expected_status: str
):
    segment_id, frame_id, variant_id = _seed_review_chain(container)
    routes = _build_resource_routes(segment_id, frame_id, variant_id)

    resp = client.post(
        routes[resource]["review"],
        json={"action": action, "notes": "", "reviewed_by": "producer"},
    )
    assert resp.status_code == 200
    assert resp.json()["review_status"] == expected_status

    persisted = client.get(routes[resource]["get"])
    assert persisted.status_code == 200
    assert persisted.json()["review_status"] == expected_status


@pytest.mark.parametrize("resource", ["segment", "frame", "variant"])
def test_review_rejects_status_values_as_actions(client, container, resource: str):
    segment_id, frame_id, variant_id = _seed_review_chain(container)
    routes = _build_resource_routes(segment_id, frame_id, variant_id)

    resp = client.post(
        routes[resource]["review"],
        json={"action": "approved", "notes": "", "reviewed_by": "producer"},
    )
    assert resp.status_code == 422


@pytest.mark.parametrize(
    "resource,initial_action",
    [
        ("segment", "approve"),
        ("segment", "reject"),
        ("frame", "approve"),
        ("frame", "reject"),
    ],
)
def test_undo_resets_review_to_pending(
    client, container, resource: str, initial_action: str
):
    """Undo resets review_status to pending and clears reviewed_at/reviewed_by."""
    segment_id, frame_id, variant_id = _seed_review_chain(container)
    routes = _build_resource_routes(segment_id, frame_id, variant_id)

    # First apply an approve or reject
    resp = client.post(
        routes[resource]["review"],
        json={"action": initial_action, "notes": "", "reviewed_by": "producer"},
    )
    assert resp.status_code == 200
    assert resp.json()["review_status"] != "pending"

    # Then undo it
    resp = client.post(
        routes[resource]["review"],
        json={"action": "undo", "notes": "", "reviewed_by": "producer"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["review_status"] == "pending"
    assert data["reviewed_at"] is None
    assert data["reviewed_by"] is None

    # Verify persistence
    persisted = client.get(routes[resource]["get"])
    assert persisted.status_code == 200
    persisted_data = persisted.json()
    assert persisted_data["review_status"] == "pending"
    assert persisted_data["reviewed_at"] is None
    assert persisted_data["reviewed_by"] is None


@pytest.mark.parametrize("resource", ["segment", "frame"])
def test_undo_on_already_pending_resets_cleanly(client, container, resource: str):
    """Undo on a pending resource is idempotent — stays pending."""
    segment_id, frame_id, variant_id = _seed_review_chain(container)
    routes = _build_resource_routes(segment_id, frame_id, variant_id)

    resp = client.post(
        routes[resource]["review"],
        json={"action": "undo", "notes": "", "reviewed_by": "producer"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["review_status"] == "pending"
    assert data["reviewed_at"] is None
    assert data["reviewed_by"] is None
