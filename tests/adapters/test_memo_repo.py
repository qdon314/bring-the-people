"""Tests for ProducerMemo repository."""
from datetime import datetime, timezone
from uuid import uuid4

import pytest

from growth.adapters.orm import create_tables, get_engine, get_session_maker
from growth.adapters.repositories import SQLAlchemyProducerMemoRepository
from growth.domain.models import ProducerMemo


@pytest.fixture
def repo(tmp_path):
    db_path = tmp_path / "test.db"
    engine = get_engine(f"sqlite:///{db_path}")
    create_tables(engine)
    Session = get_session_maker(engine)
    session = Session()
    yield SQLAlchemyProducerMemoRepository(session)
    session.close()


class TestProducerMemoRepository:
    def test_save_and_get_by_id(self, repo):
        memo = ProducerMemo(
            memo_id=uuid4(),
            show_id=uuid4(),
            cycle_start=datetime(2026, 2, 15, tzinfo=timezone.utc),
            cycle_end=datetime(2026, 2, 22, tzinfo=timezone.utc),
            markdown="# Cycle Report\n\nThis week we tested...",
        )
        repo.save(memo)
        result = repo.get_by_id(memo.memo_id)
        assert result is not None
        assert result.memo_id == memo.memo_id
        assert result.markdown == memo.markdown

    def test_get_by_id_not_found(self, repo):
        assert repo.get_by_id(uuid4()) is None

    def test_get_by_show(self, repo):
        show_id = uuid4()
        m1 = ProducerMemo(memo_id=uuid4(), show_id=show_id,
                          cycle_start=datetime(2026, 2, 8, tzinfo=timezone.utc),
                          cycle_end=datetime(2026, 2, 15, tzinfo=timezone.utc),
                          markdown="# Week 1")
        m2 = ProducerMemo(memo_id=uuid4(), show_id=show_id,
                          cycle_start=datetime(2026, 2, 15, tzinfo=timezone.utc),
                          cycle_end=datetime(2026, 2, 22, tzinfo=timezone.utc),
                          markdown="# Week 2")
        repo.save(m1)
        repo.save(m2)
        results = repo.get_by_show(show_id)
        assert len(results) == 2
