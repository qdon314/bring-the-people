"""Tests for AudienceSegment and CreativeFrame repositories."""
from uuid import uuid4

import pytest

from growth.adapters.orm import get_engine, get_session_maker, create_tables
from growth.adapters.repositories import (
    SQLAlchemySegmentRepository,
    SQLAlchemyFrameRepository,
)
from growth.domain.models import AudienceSegment, CreativeFrame


@pytest.fixture
def session(tmp_path):
    db_path = tmp_path / "test.db"
    engine = get_engine(f"sqlite:///{db_path}")
    create_tables(engine)
    Session = get_session_maker(engine)
    s = Session()
    yield s
    s.close()


class TestSegmentRepository:
    def test_save_and_get_by_id(self, session):
        repo = SQLAlchemySegmentRepository(session)
        seg = AudienceSegment(
            segment_id=uuid4(),
            show_id=uuid4(),
            name="Austin indie fans",
            definition_json={"interests": ["indie", "live music"]},
            estimated_size=5000,
            created_by="strategy_agent",
        )
        repo.save(seg)
        loaded = repo.get_by_id(seg.segment_id)
        assert loaded is not None
        assert loaded.name == "Austin indie fans"
        assert loaded.estimated_size == 5000

    def test_get_by_show(self, session):
        repo = SQLAlchemySegmentRepository(session)
        show_id = uuid4()
        for i in range(3):
            repo.save(AudienceSegment(
                segment_id=uuid4(),
                show_id=show_id,
                name=f"Segment {i}",
                definition_json={},
                estimated_size=None,
                created_by="test",
            ))
        segments = repo.get_by_show(show_id)
        assert len(segments) == 3

    def test_get_nonexistent_returns_none(self, session):
        repo = SQLAlchemySegmentRepository(session)
        assert repo.get_by_id(uuid4()) is None


class TestFrameRepository:
    def test_save_and_get_by_id(self, session):
        repo = SQLAlchemyFrameRepository(session)
        frame = CreativeFrame(
            frame_id=uuid4(),
            show_id=uuid4(),
            segment_id=uuid4(),
            hypothesis="Indie fans respond to intimate venue framing",
            promise="An unforgettable night of live indie music",
            evidence_refs=[{"source": "past_experiment", "id": "abc123"}],
            risk_notes="Small venue may limit appeal",
        )
        repo.save(frame)
        loaded = repo.get_by_id(frame.frame_id)
        assert loaded is not None
        assert loaded.hypothesis == "Indie fans respond to intimate venue framing"

    def test_get_by_show(self, session):
        repo = SQLAlchemyFrameRepository(session)
        show_id = uuid4()
        seg_id = uuid4()
        for i in range(2):
            repo.save(CreativeFrame(
                frame_id=uuid4(),
                show_id=show_id,
                segment_id=seg_id,
                hypothesis=f"Hypothesis {i}",
                promise=f"Promise {i}",
                evidence_refs=[],
            ))
        frames = repo.get_by_show(show_id)
        assert len(frames) == 2
