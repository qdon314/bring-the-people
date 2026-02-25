"""Tests for the Creative API endpoint."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from growth.adapters.llm.result import AgentResult
from growth.adapters.llm.schemas import CreativeOutput, CreativeVariantDraft
from growth.app.api.app import create_app
from growth.app.container import Container


def _make_creative_output() -> CreativeOutput:
    return CreativeOutput(
        variants=[
            CreativeVariantDraft(
                hook="Don't miss this show tonight",
                body="An intimate night of live indie music at The Parish in Austin",
                cta="Get your tickets now",
                reasoning="Urgency angle with limited capacity framing",
            ),
            CreativeVariantDraft(
                hook="Austin's best kept secret",
                body="200 seats. One night. The indie show everyone will talk about",
                cta="Reserve your spot today",
                reasoning="Exclusivity angle — small venue as insider knowledge",
            ),
        ],
        reasoning_summary="Two variants covering urgency and exclusivity for indie fans.",
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


def _create_show_and_frame(client) -> tuple[str, str]:
    """Create a show, segment, and frame via API + direct repo calls."""
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

    # Create segment and frame via strategy agent mock
    from growth.adapters.llm.schemas import (
        BudgetRangeCents, Channel, EvidenceRef, EvidenceSource, FramePlan,
        SegmentDefinition, StrategyOutput,
    )
    from growth.adapters.llm.result import AgentResult

    strategy_output = StrategyOutput(
        frame_plans=[
            FramePlan(
                segment_name=f"Segment {i} name",
                segment_definition=SegmentDefinition(interests=[f"interest_{i}"]),
                estimated_size=1000,
                hypothesis=f"Hypothesis {i} that is long enough to validate properly",
                promise=f"Promise {i} here",
                evidence_refs=[EvidenceRef(source=EvidenceSource.show_data, id=None,
                               summary=f"Evidence {i} supporting this hypothesis clearly")],
                channel=Channel.meta,
                budget_range_cents=BudgetRangeCents(min=5000, max=15000),
            )
            for i in range(3)
        ],
        reasoning_summary="Test strategy output from mock agent run.",
    )

    with patch("growth.app.services.strategy_service.run_agent") as mock_run:
        mock_run.return_value = AgentResult(
            output=strategy_output, turns_used=2,
            total_input_tokens=700, total_output_tokens=400,
        )
        resp = client.post(f"/api/strategy/{show_id}/run")
        frame_id = resp.json()["frame_ids"][0]

    return show_id, frame_id


class TestCreativeAPI:
    @patch("growth.app.services.creative_service.run_agent")
    def test_run_creative_success(self, mock_run_agent, client):
        _, frame_id = _create_show_and_frame(client)

        mock_run_agent.return_value = AgentResult(
            output=_make_creative_output(),
            turns_used=3,
            total_input_tokens=600,
            total_output_tokens=350,
        )

        resp = client.post(f"/api/creative/{frame_id}/run")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["variant_ids"]) == 2
        assert "reasoning_summary" in data

    def test_run_creative_frame_not_found(self, client):
        resp = client.post(f"/api/creative/{uuid4()}/run")
        assert resp.status_code == 404
