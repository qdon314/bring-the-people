"""Tests for Creative Agent tool functions."""
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from growth.adapters.llm.creative_tools import get_frame_context, get_platform_constraints
from growth.adapters.orm import create_tables, get_engine, get_session_maker
from growth.adapters.repositories import (
    SQLAlchemyFrameRepository,
    SQLAlchemySegmentRepository,
    SQLAlchemyShowRepository,
)
from growth.domain.models import AudienceSegment, CreativeFrame, Show


@pytest.fixture
def repos(tmp_path):
    db_path = tmp_path / "test.db"
    engine = get_engine(f"sqlite:///{db_path}")
    create_tables(engine)
    Session = get_session_maker(engine)
    session = Session()
    show_repo = SQLAlchemyShowRepository(session)
    seg_repo = SQLAlchemySegmentRepository(session)
    frame_repo = SQLAlchemyFrameRepository(session)
    yield {"show_repo": show_repo, "seg_repo": seg_repo, "frame_repo": frame_repo}
    session.close()


def _create_test_data(repos):
    show_id = uuid4()
    show = Show(
        show_id=show_id, artist_name="Test Artist", city="Austin",
        venue="The Parish", show_time=datetime.now(timezone.utc) + timedelta(days=30),
        timezone="America/Chicago", capacity=200, tickets_total=200, tickets_sold=50,
    )
    repos["show_repo"].save(show)

    seg_id = uuid4()
    segment = AudienceSegment(
        segment_id=seg_id, show_id=show_id, name="Austin indie fans",
        definition_json={"geo": {"city": "Austin"}, "interests": ["indie music"]},
        estimated_size=5000, created_by="strategy_agent",
    )
    repos["seg_repo"].save(segment)

    frame_id = uuid4()
    frame = CreativeFrame(
        frame_id=frame_id, show_id=show_id, segment_id=seg_id,
        hypothesis="Indie fans respond to intimate venue framing",
        promise="An intimate night of live indie music",
        evidence_refs=[{"source": "show_data", "summary": "200-cap venue"}],
        channel="meta", risk_notes="Small venue may limit reach",
    )
    repos["frame_repo"].save(frame)

    return show_id, seg_id, frame_id


class TestGetFrameContext:
    def test_returns_frame_segment_show(self, repos):
        show_id, seg_id, frame_id = _create_test_data(repos)
        result = get_frame_context(
            frame_id=frame_id,
            frame_repo=repos["frame_repo"],
            seg_repo=repos["seg_repo"],
            show_repo=repos["show_repo"],
        )
        assert result["frame"]["hypothesis"] == "Indie fans respond to intimate venue framing"
        assert result["segment"]["name"] == "Austin indie fans"
        assert result["show"]["artist_name"] == "Test Artist"
        assert result["show"]["phase"] in ("early", "mid", "late")
        assert "days_until_show" in result["show"]

    def test_frame_not_found(self, repos):
        result = get_frame_context(
            frame_id=uuid4(),
            frame_repo=repos["frame_repo"],
            seg_repo=repos["seg_repo"],
            show_repo=repos["show_repo"],
        )
        assert result == {"error": "frame_not_found"}


class TestGetPlatformConstraints:
    def test_meta(self):
        result = get_platform_constraints(channel="meta")
        assert "constraints" in result
        assert "hook" in result["constraints"]
        assert "body" in result["constraints"]
        assert "cta" in result["constraints"]
        assert "notes" in result

    def test_instagram(self):
        result = get_platform_constraints(channel="instagram")
        assert result["channel"] == "instagram"

    def test_unknown_channel(self):
        result = get_platform_constraints(channel="unknown")
        assert result == {"error": "unknown_channel"}
