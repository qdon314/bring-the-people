"""Integration tests for MemoService."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from growth.adapters.event_log import JSONLEventLog
from growth.adapters.llm.client import ClaudeClient
from growth.adapters.llm.schemas import MemoOutput
from growth.adapters.orm import create_tables, get_engine, get_session_maker
from growth.adapters.repositories import (
    SQLAlchemyExperimentRepository,
    SQLAlchemyFrameRepository,
    SQLAlchemyProducerMemoRepository,
    SQLAlchemySegmentRepository,
    SQLAlchemyShowRepository,
)
from growth.app.services.memo_service import MemoRunError, MemoService
from growth.domain.models import (
    AudienceSegment,
    CreativeFrame,
    Decision,
    DecisionAction,
    Experiment,
    ExperimentStatus,
    Observation,
    Show,
)
from growth.domain.policy_config import load_policy_config


VALID_MEMO_OUTPUT = MemoOutput(
    what_worked="Instagram Reels targeting indie fans drove 5 purchases at $10 CAC with strong engagement",
    what_failed="No experiments failed in this cycle — all showed positive signal from the audience",
    cost_per_seat_cents=1000,
    cost_per_seat_explanation="Total spend $50 across 1 experiment / 5 purchases = $10 per seat",
    next_three_tests=["Test TikTok with artist interview clips targeting 18-24 in Austin"],
    policy_exceptions=None,
    markdown="# Cycle Report\n\n## What Worked\n\nIndiana Reels targeting indie fans performed well with 5 purchases.",
    reasoning_summary="Single-experiment cycle focused on validating the indie fan segment on Meta.",
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
    exp_repo = SQLAlchemyExperimentRepository(session)
    seg_repo = SQLAlchemySegmentRepository(session)
    frame_repo = SQLAlchemyFrameRepository(session)
    memo_repo = SQLAlchemyProducerMemoRepository(session)
    event_log = JSONLEventLog(tmp_path / "events.jsonl")
    client = MagicMock(spec=ClaudeClient)
    client._model = "claude-test-model"
    policy = load_policy_config("config/policy.toml")

    # Create test data
    show_id = uuid4()
    show_repo.save(Show(
        show_id=show_id, artist_name="Test Artist", city="Austin",
        venue="The Parish", show_time=datetime.now(timezone.utc) + timedelta(days=30),
        timezone="America/Chicago", capacity=200, tickets_total=200, tickets_sold=50,
    ))

    cycle_start = datetime(2026, 2, 15, tzinfo=timezone.utc)
    cycle_end = datetime(2026, 2, 22, tzinfo=timezone.utc)

    service = MemoService(
        claude_client=client,
        show_repo=show_repo,
        exp_repo=exp_repo,
        seg_repo=seg_repo,
        frame_repo=frame_repo,
        memo_repo=memo_repo,
        event_log=event_log,
        policy=policy,
        runs_path=tmp_path / "runs",
    )

    yield {
        "service": service,
        "client": client,
        "show_id": show_id,
        "cycle_start": cycle_start,
        "cycle_end": cycle_end,
        "memo_repo": memo_repo,
        "event_log": event_log,
        "runs_path": tmp_path / "runs",
    }
    session.close()


class TestMemoService:
    def test_successful_run(self, setup):
        s = setup
        s["client"].chat.side_effect = [
            _make_tool_use_response("get_show_details", {"show_id": str(s["show_id"])}),
            _make_tool_use_response("get_cycle_experiments", {
                "show_id": str(s["show_id"]),
                "cycle_start": s["cycle_start"].isoformat(),
                "cycle_end": s["cycle_end"].isoformat(),
            }, "toolu_2"),
            _make_tool_use_response("get_budget_status", {"show_id": str(s["show_id"])}, "toolu_3"),
            _make_text_response(VALID_MEMO_OUTPUT.model_dump_json()),
        ]

        result = s["service"].run(s["show_id"], s["cycle_start"], s["cycle_end"])

        assert result.memo_id is not None
        assert result.turns_used == 4

        # Verify memo persisted
        memos = s["memo_repo"].get_by_show(s["show_id"])
        assert len(memos) == 1
        assert "Cycle Report" in memos[0].markdown

        # Verify artifacts written
        run_dir = s["runs_path"] / str(result.run_id)
        assert (run_dir / "memo.json").exists()
        assert (run_dir / "memo.md").exists()

        # Verify event emitted
        events = s["event_log"].read_all()
        assert len(events) == 1
        assert events[0]["event_type"] == "memo_completed"

    def test_show_not_found(self, setup):
        with pytest.raises(ValueError, match="not found"):
            setup["service"].run(uuid4(), setup["cycle_start"], setup["cycle_end"])

    def test_agent_failure_emits_event(self, setup):
        s = setup
        from growth.adapters.llm.errors import AgentTurnLimitError
        s["client"].chat.side_effect = AgentTurnLimitError(6)

        with pytest.raises(MemoRunError):
            s["service"].run(s["show_id"], s["cycle_start"], s["cycle_end"])

        events = s["event_log"].read_all()
        assert len(events) == 1
        assert events[0]["event_type"] == "memo_failed"
