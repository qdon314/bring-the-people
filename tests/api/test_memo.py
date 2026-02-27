"""Tests for the Memo API endpoint."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from growth.app.api.app import create_app
from growth.app.container import Container


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


def _create_show(client) -> str:
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
    return resp.json()["show_id"]


class TestMemoAPI:
    def test_run_memo_success(self, client):
        show_id = _create_show(client)

        resp = client.post(
            f"/api/memos/{show_id}/run",
            params={
                "cycle_start": "2026-02-15T00:00:00Z",
                "cycle_end": "2026-02-22T00:00:00Z",
            },
        )
        assert resp.status_code == 202
        data = resp.json()
        assert data["status"] == "queued"
        assert "job_id" in data

    def test_run_memo_show_not_found(self, client):
        resp = client.post(
            f"/api/memos/{uuid4()}/run",
            params={
                "cycle_start": "2026-02-15T00:00:00Z",
                "cycle_end": "2026-02-22T00:00:00Z",
            },
        )
        assert resp.status_code == 404

    def test_run_memo_missing_params(self, client):
        show_id = _create_show(client)
        resp = client.post(f"/api/memos/{show_id}/run")
        assert resp.status_code == 422
