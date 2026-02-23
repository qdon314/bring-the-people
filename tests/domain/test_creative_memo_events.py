"""Tests for Creative and Memo domain events."""
from datetime import datetime, timezone
from uuid import uuid4

from growth.domain.events import (
    CreativeCompleted,
    CreativeFailed,
    MemoCompleted,
    MemoFailed,
)


class TestCreativeEvents:
    def test_creative_completed(self):
        event = CreativeCompleted(
            event_id=uuid4(),
            occurred_at=datetime.now(timezone.utc),
            frame_id=uuid4(),
            run_id=uuid4(),
            num_variants=3,
            variant_ids=(uuid4(), uuid4(), uuid4()),
            turns_used=3,
            total_input_tokens=500,
            total_output_tokens=300,
        )
        assert event.event_type == "creative_completed"
        assert event.num_variants == 3

    def test_creative_failed(self):
        event = CreativeFailed(
            event_id=uuid4(),
            occurred_at=datetime.now(timezone.utc),
            frame_id=uuid4(),
            run_id=uuid4(),
            error_type="AgentTurnLimitError",
            error_message="Exceeded 8 turns",
        )
        assert event.event_type == "creative_failed"


class TestMemoEvents:
    def test_memo_completed(self):
        event = MemoCompleted(
            event_id=uuid4(),
            occurred_at=datetime.now(timezone.utc),
            show_id=uuid4(),
            memo_id=uuid4(),
            run_id=uuid4(),
            cycle_start="2026-02-15T00:00:00Z",
            cycle_end="2026-02-22T00:00:00Z",
            turns_used=4,
            total_input_tokens=600,
            total_output_tokens=400,
        )
        assert event.event_type == "memo_completed"

    def test_memo_failed(self):
        event = MemoFailed(
            event_id=uuid4(),
            occurred_at=datetime.now(timezone.utc),
            show_id=uuid4(),
            run_id=uuid4(),
            error_type="AgentParseError",
            error_message="Failed to parse output",
        )
        assert event.event_type == "memo_failed"
