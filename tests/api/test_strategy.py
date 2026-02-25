"""Tests for the Strategy API endpoint."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from growth.adapters.llm.result import AgentResult
from growth.adapters.llm.schemas import (
    BudgetRangeCents,
    Channel,
    EvidenceRef,
    EvidenceSource,
    FramePlan,
    SegmentDefinition,
    StrategyOutput,
)
from growth.app.api.app import create_app
from growth.app.container import Container


def _make_strategy_output() -> StrategyOutput:
    plans = []
    for i in range(3):
        plans.append(
            FramePlan(
                segment_name=f"Segment {i} name",
                segment_definition=SegmentDefinition(interests=[f"interest_{i}"]),
                estimated_size=1000,
                hypothesis=f"Hypothesis {i} that is long enough to validate properly",
                promise=f"Promise {i} here",
                evidence_refs=[
                    EvidenceRef(
                        source=EvidenceSource.show_data,
                        id=None,
                        summary=f"Evidence {i} supporting this hypothesis clearly",
                    ),
                ],
                channel=Channel.meta,
                budget_range_cents=BudgetRangeCents(min=5000, max=15000),
                risk_notes=None,
            )
        )
    return StrategyOutput(
        frame_plans=plans,
        reasoning_summary="Test strategy output from mock agent run.",
    )


@pytest.fixture
def client(tmp_path):
    db_path = tmp_path / "test.db"
    log_path = tmp_path / "events.jsonl"
    config_path = "config/policy.toml"
    runs_path = tmp_path / "runs"

    container = Container(
        db_url=f"sqlite:///{db_path}",
        event_log_path=log_path,
        policy_config_path=config_path,
        runs_path=runs_path,
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


class TestStrategyAPI:
    @patch("growth.app.services.strategy_service.run_agent")
    def test_run_strategy_success(self, mock_run_agent, client):
        show_id = _create_show(client)

        mock_run_agent.return_value = AgentResult(
            output=_make_strategy_output(),
            turns_used=2,
            total_input_tokens=700,
            total_output_tokens=400,
        )

        resp = client.post(f"/api/strategy/{show_id}/run")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["segment_ids"]) == 3
        assert len(data["frame_ids"]) == 3
        assert "reasoning_summary" in data

    def test_run_strategy_show_not_found(self, client):
        resp = client.post(f"/api/strategy/{uuid4()}/run")
        assert resp.status_code == 404
