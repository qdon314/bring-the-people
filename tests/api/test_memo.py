"""Tests for the Memo API endpoint."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from growth.adapters.llm.result import AgentResult
from growth.adapters.llm.schemas import MemoOutput
from growth.app.api.app import create_app
from growth.app.container import Container


VALID_MEMO_OUTPUT = MemoOutput(
    what_worked="Instagram Reels targeting indie fans drove 5 purchases at $10 CAC with strong engagement",
    what_failed="No experiments failed this cycle — all showed positive early signal from the market",
    cost_per_seat_cents=1000,
    cost_per_seat_explanation="Total spend $50 / 5 purchases = $10 per seat blended",
    next_three_tests=["Test TikTok targeting 18-24 in Austin"],
    policy_exceptions=None,
    markdown="# Cycle Report\n\n## What Worked\n\nIndie fans responded well to intimate venue framing.",
    reasoning_summary="Single-experiment cycle focused on validating the indie fan segment.",
)


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
    @patch("growth.app.services.memo_service.run_agent")
    def test_run_memo_success(self, mock_run_agent, client):
        show_id = _create_show(client)

        mock_run_agent.return_value = AgentResult(
            output=VALID_MEMO_OUTPUT,
            turns_used=4,
            total_input_tokens=800,
            total_output_tokens=500,
        )

        resp = client.post(
            f"/api/memo/{show_id}/run",
            params={
                "cycle_start": "2026-02-15T00:00:00Z",
                "cycle_end": "2026-02-22T00:00:00Z",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "memo_id" in data
        assert data["cost_per_seat_cents"] == 1000
        assert "reasoning_summary" in data

    def test_run_memo_show_not_found(self, client):
        resp = client.post(
            f"/api/memo/{uuid4()}/run",
            params={
                "cycle_start": "2026-02-15T00:00:00Z",
                "cycle_end": "2026-02-22T00:00:00Z",
            },
        )
        assert resp.status_code == 404

    def test_run_memo_missing_params(self, client):
        show_id = _create_show(client)
        resp = client.post(f"/api/memo/{show_id}/run")
        assert resp.status_code == 422
