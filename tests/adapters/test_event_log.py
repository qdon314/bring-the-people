"""Tests for JSONL event log implementation."""
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import pytest

from growth.adapters.event_log import JSONLEventLog
from growth.domain.events import ExperimentStarted


@pytest.fixture
def temp_log_file(tmp_path):
    """Create a temporary log file."""
    return tmp_path / "events.jsonl"


class TestJSONLEventLog:
    def test_append_and_read(self, temp_log_file):
        log = JSONLEventLog(temp_log_file)

        event = ExperimentStarted(
            event_id=uuid4(),
            experiment_id=uuid4(),
            show_id=uuid4(),
            channel="meta",
            objective="ticket_sales",
            budget_cap_cents=5000,
            baseline_snapshot={"cac_cents": 800},
            occurred_at=datetime(2026, 4, 1, 10, 0, tzinfo=timezone.utc),
        )

        log.append(event)
        events = log.read_all()

        assert len(events) == 1
        assert events[0]["event_type"] == "experiment_started"
        assert events[0]["channel"] == "meta"
        assert events[0]["budget_cap_cents"] == 5000

    def test_read_since_filters_by_time(self, temp_log_file):
        log = JSONLEventLog(temp_log_file)

        # Add event at time 1
        event1 = ExperimentStarted(
            event_id=uuid4(),
            experiment_id=uuid4(),
            show_id=uuid4(),
            channel="meta",
            objective="ticket_sales",
            budget_cap_cents=5000,
            baseline_snapshot={},
            occurred_at=datetime(2026, 4, 1, 10, 0, tzinfo=timezone.utc),
        )
        log.append(event1)

        # Add event at time 2
        event2 = ExperimentStarted(
            event_id=uuid4(),
            experiment_id=uuid4(),
            show_id=uuid4(),
            channel="tiktok",
            objective="ticket_sales",
            budget_cap_cents=3000,
            baseline_snapshot={},
            occurred_at=datetime(2026, 4, 2, 10, 0, tzinfo=timezone.utc),
        )
        log.append(event2)

        # Read since middle time
        since = datetime(2026, 4, 1, 12, 0, tzinfo=timezone.utc)
        events = log.read_since(since)

        assert len(events) == 1
        assert events[0]["channel"] == "tiktok"

    def test_multiple_appends(self, temp_log_file):
        log = JSONLEventLog(temp_log_file)

        for i in range(3):
            event = ExperimentStarted(
                event_id=uuid4(),
                experiment_id=uuid4(),
                show_id=uuid4(),
                channel=f"channel_{i}",
                objective="ticket_sales",
                budget_cap_cents=1000 * (i + 1),
                baseline_snapshot={},
                occurred_at=datetime(2026, 4, 1, 10, i, tzinfo=timezone.utc),
            )
            log.append(event)

        events = log.read_all()
        assert len(events) == 3
        assert events[0]["channel"] == "channel_0"
        assert events[1]["channel"] == "channel_1"
        assert events[2]["channel"] == "channel_2"

    def test_read_empty_log(self, temp_log_file):
        log = JSONLEventLog(temp_log_file)
        events = log.read_all()
        assert events == []

    def test_creates_parent_directory(self, tmp_path):
        nested_path = tmp_path / "nested" / "dir" / "events.jsonl"
        log = JSONLEventLog(nested_path)

        event = ExperimentStarted(
            event_id=uuid4(),
            experiment_id=uuid4(),
            show_id=uuid4(),
            channel="meta",
            objective="ticket_sales",
            budget_cap_cents=5000,
            baseline_snapshot={},
            occurred_at=datetime(2026, 4, 1, 10, 0, tzinfo=timezone.utc),
        )
        log.append(event)

        assert nested_path.exists()
