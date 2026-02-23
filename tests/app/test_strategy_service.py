"""Tests for the Strategy Service."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from growth.adapters.event_log import JSONLEventLog
from growth.adapters.llm.client import ClaudeClient
from growth.adapters.llm.schemas import (
    BudgetRangeCents,
    Channel,
    EvidenceRef,
    EvidenceSource,
    FramePlan,
    SegmentDefinition,
    StrategyOutput,
)
from growth.adapters.orm import create_tables, get_engine, get_session_maker
from growth.adapters.repositories import (
    SQLAlchemyExperimentRepository,
    SQLAlchemyFrameRepository,
    SQLAlchemySegmentRepository,
    SQLAlchemyShowRepository,
)
from growth.app.services.strategy_service import StrategyRunError, StrategyService
from growth.domain.models import Show
from growth.domain.policy_config import PolicyConfig


def _make_strategy_output() -> StrategyOutput:
    plans = []
    for i in range(3):
        plans.append(
            FramePlan(
                segment_name=f"Segment {i} name",
                segment_definition=SegmentDefinition(interests=[f"interest_{i}"]),
                estimated_size=1000 * (i + 1),
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
        reasoning_summary="Test strategy based on show data analysis and available budget.",
    )


VALID_STRATEGY_JSON = _make_strategy_output().model_dump_json()


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


def _test_policy() -> PolicyConfig:
    return PolicyConfig(
        min_windows=2,
        min_clicks=150,
        min_purchases=5,
        min_incremental_tickets_per_100usd=0.0,
        max_cac_vs_baseline_ratio=0.85,
        min_conversion_rate_vs_baseline_ratio=0.50,
        max_refund_rate=0.10,
        max_complaint_rate=0.05,
        max_negative_comment_rate=0.15,
        confidence_weight_sample=0.4,
        confidence_weight_lift=0.4,
        confidence_weight_consistency=0.2,
        discovery_max_pct=0.10,
        validation_max_pct=0.20,
        scale_max_pct=0.40,
    )


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
    event_log = JSONLEventLog(tmp_path / "events.jsonl")
    runs_path = tmp_path / "runs"

    show = Show(
        show_id=uuid4(),
        artist_name="Test Artist",
        city="Austin",
        venue="The Parish",
        show_time=datetime.now(timezone.utc) + timedelta(days=30),
        timezone="America/Chicago",
        capacity=200,
        tickets_total=200,
        tickets_sold=50,
    )
    show_repo.save(show)

    mock_client = MagicMock(spec=ClaudeClient)

    service = StrategyService(
        claude_client=mock_client,
        show_repo=show_repo,
        exp_repo=exp_repo,
        seg_repo=seg_repo,
        frame_repo=frame_repo,
        event_log=event_log,
        policy=_test_policy(),
        runs_path=runs_path,
    )

    yield {
        "service": service,
        "client": mock_client,
        "show": show,
        "seg_repo": seg_repo,
        "frame_repo": frame_repo,
        "event_log": event_log,
        "runs_path": runs_path,
    }
    session.close()


class TestStrategyService:
    def test_run_creates_segments_and_frames(self, setup):
        s = setup
        s["client"].chat.side_effect = [
            _make_tool_use_response("get_show_details", {"show_id": str(s["show"].show_id)}),
            _make_text_response(VALID_STRATEGY_JSON),
        ]

        result = s["service"].run(s["show"].show_id)

        assert len(result.segment_ids) == 3
        assert len(result.frame_ids) == 3

        for seg_id in result.segment_ids:
            seg = s["seg_repo"].get_by_id(seg_id)
            assert seg is not None
            assert seg.created_by == "strategy_agent"

        for frame_id in result.frame_ids:
            frame = s["frame_repo"].get_by_id(frame_id)
            assert frame is not None

    def test_run_writes_plan_artifact(self, setup):
        s = setup
        s["client"].chat.side_effect = [
            _make_text_response(VALID_STRATEGY_JSON),
        ]

        result = s["service"].run(s["show"].show_id)

        plan_path = s["runs_path"] / str(result.run_id) / "plan.json"
        assert plan_path.exists()
        plan = json.loads(plan_path.read_text())
        assert len(plan["frame_plans"]) == 3
        assert "turns_used" in plan
        assert "total_input_tokens" in plan

    def test_run_emits_strategy_completed_event(self, setup):
        s = setup
        s["client"].chat.side_effect = [
            _make_text_response(VALID_STRATEGY_JSON),
        ]

        s["service"].run(s["show"].show_id)

        events = s["event_log"].read_all()
        assert len(events) == 1
        assert events[0]["event_type"] == "strategy_completed"

    def test_run_show_not_found_raises(self, setup):
        with pytest.raises(ValueError, match="not found"):
            setup["service"].run(uuid4())

    def test_run_agent_failure_emits_failed_event(self, setup):
        s = setup
        s["client"].chat.side_effect = [
            _make_text_response("not json"),
            _make_text_response("still not json"),
        ]

        with pytest.raises(StrategyRunError):
            s["service"].run(s["show"].show_id)

        events = s["event_log"].read_all()
        assert len(events) == 1
        assert events[0]["event_type"] == "strategy_failed"

    def test_run_returns_strategy_output(self, setup):
        s = setup
        s["client"].chat.side_effect = [
            _make_text_response(VALID_STRATEGY_JSON),
        ]

        result = s["service"].run(s["show"].show_id)

        assert "show data analysis" in result.strategy_output.reasoning_summary
        assert result.run_id is not None
