"""Integration tests for CreativeService."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from growth.adapters.event_log import JSONLEventLog
from growth.adapters.llm.client import ClaudeClient
from growth.adapters.llm.schemas import CreativeOutput, CreativeVariantDraft
from growth.adapters.orm import create_tables, get_engine, get_session_maker
from growth.adapters.repositories import (
    SQLAlchemyCreativeVariantRepository,
    SQLAlchemyFrameRepository,
    SQLAlchemySegmentRepository,
    SQLAlchemyShowRepository,
)
from growth.app.services.creative_service import CreativeRunError, CreativeService
from growth.domain.models import AudienceSegment, CreativeFrame, Show


VALID_CREATIVE_OUTPUT = CreativeOutput(
    variants=[
        CreativeVariantDraft(
            hook="Don't miss this show tonight",
            body="An intimate night of live indie music at The Parish in Austin",
            cta="Get your tickets now",
            reasoning="Urgency angle — limited capacity creates fear of missing out",
        ),
        CreativeVariantDraft(
            hook="Austin's best kept secret",
            body="200 seats. One night. The indie show everyone will be talking about",
            cta="Reserve your spot today",
            reasoning="Exclusivity angle — small venue framed as insider knowledge",
        ),
    ],
    reasoning_summary="Two variants covering urgency and exclusivity angles for indie fans.",
)


def _make_text_response(text: str, input_tokens: int = 500, output_tokens: int = 300):
    block = MagicMock()
    block.type = "text"
    block.text = text
    response = MagicMock()
    response.content = [block]
    response.stop_reason = "end_turn"
    response.usage.input_tokens = input_tokens
    response.usage.output_tokens = output_tokens
    return response


def _make_tool_use_response(tool_name, tool_input, tool_use_id="toolu_1"):
    block = MagicMock()
    block.type = "tool_use"
    block.name = tool_name
    block.input = tool_input
    block.id = tool_use_id
    response = MagicMock()
    response.content = [block]
    response.stop_reason = "tool_use"
    response.usage.input_tokens = 200
    response.usage.output_tokens = 100
    return response


@pytest.fixture
def setup(tmp_path):
    db_path = tmp_path / "test.db"
    engine = get_engine(f"sqlite:///{db_path}")
    create_tables(engine)
    Session = get_session_maker(engine)
    session = Session()

    show_repo = SQLAlchemyShowRepository(session)
    seg_repo = SQLAlchemySegmentRepository(session)
    frame_repo = SQLAlchemyFrameRepository(session)
    variant_repo = SQLAlchemyCreativeVariantRepository(session)
    event_log = JSONLEventLog(tmp_path / "events.jsonl")
    client = MagicMock(spec=ClaudeClient)
    client._model = "claude-test-model"

    # Create test data
    show_id = uuid4()
    show_repo.save(Show(
        show_id=show_id, artist_name="Test Artist", city="Austin",
        venue="The Parish", show_time=datetime.now(timezone.utc) + timedelta(days=30),
        timezone="America/Chicago", capacity=200, tickets_total=200, tickets_sold=50,
    ))

    seg_id = uuid4()
    seg_repo.save(AudienceSegment(
        segment_id=seg_id, show_id=show_id, name="Indie fans",
        definition_json={"interests": ["indie"]}, estimated_size=5000,
        created_by="strategy_agent",
    ))

    frame_id = uuid4()
    frame_repo.save(CreativeFrame(
        frame_id=frame_id, show_id=show_id, segment_id=seg_id,
        hypothesis="Indie fans respond to intimate framing",
        promise="Intimate indie night",
        evidence_refs=[{"source": "show_data", "summary": "200-cap venue"}],
        channel="meta",
    ))

    service = CreativeService(
        claude_client=client,
        frame_repo=frame_repo,
        seg_repo=seg_repo,
        show_repo=show_repo,
        variant_repo=variant_repo,
        event_log=event_log,
        runs_path=tmp_path / "runs",
    )

    yield {
        "service": service,
        "client": client,
        "frame_id": frame_id,
        "variant_repo": variant_repo,
        "event_log": event_log,
        "runs_path": tmp_path / "runs",
    }
    session.close()


class TestCreativeService:
    def test_successful_run(self, setup):
        s = setup
        # Simulate: tool call for frame context, tool call for constraints, then text output
        s["client"].chat.side_effect = [
            _make_tool_use_response("get_frame_context", {"frame_id": str(s["frame_id"])}),
            _make_tool_use_response("get_platform_constraints", {"channel": "meta"}, "toolu_2"),
            _make_text_response(VALID_CREATIVE_OUTPUT.model_dump_json()),
        ]

        result = s["service"].run(s["frame_id"])

        assert len(result.variant_ids) == 2
        assert result.turns_used == 3

        # Verify variants persisted
        variants = s["variant_repo"].get_by_frame(s["frame_id"])
        assert len(variants) == 2
        assert variants[0].platform == "meta"
        assert variants[0].constraints_passed is True

        # Verify event emitted
        events = s["event_log"].read_all()
        assert len(events) == 1
        assert events[0]["event_type"] == "creative_completed"

    def test_frame_not_found(self, setup):
        with pytest.raises(ValueError, match="not found"):
            setup["service"].run(uuid4())

    def test_agent_failure_emits_event(self, setup):
        s = setup
        from growth.adapters.llm.errors import AgentTurnLimitError
        s["client"].chat.side_effect = AgentTurnLimitError(8)

        with pytest.raises(CreativeRunError):
            s["service"].run(s["frame_id"])

        events = s["event_log"].read_all()
        assert len(events) == 1
        assert events[0]["event_type"] == "creative_failed"
