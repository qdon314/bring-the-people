"""Tests for PATCH content-editing routes on segments, frames, and variants."""
from datetime import datetime, timezone
from uuid import uuid4

import pytest

from growth.domain.models import AudienceSegment, CreativeFrame, CreativeVariant, Show


def _seed_content_chain(container):
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
        name="Original segment",
        definition_json={"interests": ["indie"]},
        estimated_size=1000,
        created_by="strategy_agent",
    )
    frame = CreativeFrame(
        frame_id=uuid4(),
        show_id=show.show_id,
        segment_id=segment.segment_id,
        hypothesis="Original hypothesis",
        promise="Original promise",
        evidence_refs=[{"source": "show_data", "summary": "Original evidence"}],
        channel="meta",
        risk_notes="Original risk",
    )
    variant = CreativeVariant(
        variant_id=uuid4(),
        frame_id=frame.frame_id,
        platform="meta",
        hook="Original hook",
        body="Original body",
        cta="Original cta",
    )

    sc = container.session_container()
    try:
        sc.show_repo().save(show)
        sc.segment_repo().save(segment)
        sc.frame_repo().save(frame)
        sc.variant_repo().save(variant)
    finally:
        sc.close()

    return segment, frame, variant


def test_patch_segment_updates_selected_fields(client, container):
    segment, _, _ = _seed_content_chain(container)

    resp = client.patch(
        f"/api/segments/{segment.segment_id}",
        json={"name": "Updated segment"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Updated segment"
    assert data["definition_json"] == {"interests": ["indie"]}
    assert data["review_status"] == "pending"

    get_resp = client.get(f"/api/segments/{segment.segment_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["name"] == "Updated segment"


def test_patch_frame_allows_clearing_risk_notes(client, container):
    _, frame, _ = _seed_content_chain(container)

    resp = client.patch(
        f"/api/frames/{frame.frame_id}",
        json={"risk_notes": None},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["risk_notes"] is None
    assert data["hypothesis"] == "Original hypothesis"

    get_resp = client.get(f"/api/frames/{frame.frame_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["risk_notes"] is None


def test_patch_variant_updates_selected_fields(client, container):
    _, _, variant = _seed_content_chain(container)

    resp = client.patch(
        f"/api/variants/{variant.variant_id}",
        json={"hook": "Updated hook"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["hook"] == "Updated hook"
    assert data["body"] == "Original body"
    assert data["cta"] == "Original cta"

    get_resp = client.get(f"/api/variants/{variant.variant_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["hook"] == "Updated hook"


@pytest.mark.parametrize(
    "path,payload,expected_detail",
    [
        ("/api/segments/{id}", {"name": "Updated segment"}, "Segment not found"),
        ("/api/frames/{id}", {"hypothesis": "Updated hypothesis"}, "Frame not found"),
        ("/api/variants/{id}", {"hook": "Updated hook"}, "Variant not found"),
    ],
)
def test_patch_routes_return_404_for_missing_entities(client, path, payload, expected_detail):
    resp = client.patch(path.format(id=uuid4()), json=payload)
    assert resp.status_code == 404
    assert resp.json()["detail"] == expected_detail


def test_patch_segment_rejects_empty_payload(client, container):
    segment, _, _ = _seed_content_chain(container)

    resp = client.patch(f"/api/segments/{segment.segment_id}", json={})
    assert resp.status_code == 422
