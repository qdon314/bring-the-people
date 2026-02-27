"""Tests for the Creative API endpoint."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from growth.app.api.app import create_app
from growth.app.container import Container
from growth.domain.models import AudienceSegment, CreativeFrame


@pytest.fixture
def client(tmp_path):
    container = Container(
        db_url=f"sqlite:///{tmp_path / 'test.db'}",
        event_log_path=tmp_path / "events.jsonl",
        policy_config_path="config/policy.toml",
        runs_path=tmp_path / "runs",
    )
    app = create_app(container)
    yield TestClient(app)


def _create_show_and_frame(client) -> tuple[str, str]:
    """Create a show, then seed segment/frame directly via repositories."""
    # Create show via API
    resp = client.post("/api/shows", json={
        "artist_name": "Test Artist",
        "city": "Austin",
        "venue": "The Parish",
        "show_time": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
        "timezone": "America/Chicago",
        "capacity": 200,
        "tickets_total": 200,
        "tickets_sold": 50,
    })
    show_id = resp.json()["show_id"]

    sc = client.app.state.container.session_container()
    try:
        segment = AudienceSegment(
            segment_id=uuid4(),
            show_id=UUID(show_id),
            name="Indie fans",
            definition_json={"interests": ["indie"]},
            estimated_size=1000,
            created_by="strategy_agent",
        )
        sc.segment_repo().save(segment)
        frame = CreativeFrame(
            frame_id=uuid4(),
            show_id=segment.show_id,
            segment_id=segment.segment_id,
            hypothesis="Indie fans respond to scarcity framing in short video.",
            promise="One intimate night at The Parish.",
            evidence_refs=[],
            channel="meta",
        )
        sc.frame_repo().save(frame)
        frame_id = str(frame.frame_id)
    finally:
        sc.close()

    return show_id, frame_id


class TestCreativeAPI:
    def test_run_creative_success(self, client):
        _, frame_id = _create_show_and_frame(client)

        resp = client.post(f"/api/creative/{frame_id}/run")
        assert resp.status_code == 202
        data = resp.json()
        assert data["status"] == "queued"
        assert "job_id" in data

    def test_run_creative_frame_not_found(self, client):
        resp = client.post(f"/api/creative/{uuid4()}/run")
        assert resp.status_code == 404
