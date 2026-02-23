"""Tests for CreativeVariant repository."""
from uuid import uuid4

import pytest

from growth.adapters.orm import create_tables, get_engine, get_session_maker
from growth.adapters.repositories import SQLAlchemyCreativeVariantRepository
from growth.domain.models import CreativeVariant


@pytest.fixture
def repo(tmp_path):
    db_path = tmp_path / "test.db"
    engine = get_engine(f"sqlite:///{db_path}")
    create_tables(engine)
    Session = get_session_maker(engine)
    session = Session()
    yield SQLAlchemyCreativeVariantRepository(session)
    session.close()


class TestCreativeVariantRepository:
    def test_save_and_get_by_id(self, repo):
        variant = CreativeVariant(
            variant_id=uuid4(),
            frame_id=uuid4(),
            platform="meta",
            hook="Don't miss this show",
            body="An unforgettable night of live music in Austin",
            cta="Get tickets now",
            constraints_passed=True,
        )
        repo.save(variant)
        result = repo.get_by_id(variant.variant_id)
        assert result is not None
        assert result.variant_id == variant.variant_id
        assert result.hook == variant.hook

    def test_get_by_id_not_found(self, repo):
        assert repo.get_by_id(uuid4()) is None

    def test_get_by_frame(self, repo):
        frame_id = uuid4()
        v1 = CreativeVariant(variant_id=uuid4(), frame_id=frame_id, platform="meta",
                             hook="Hook one here", body="Body one for the variant",
                             cta="CTA one", constraints_passed=True)
        v2 = CreativeVariant(variant_id=uuid4(), frame_id=frame_id, platform="meta",
                             hook="Hook two here", body="Body two for the variant",
                             cta="CTA two", constraints_passed=True)
        repo.save(v1)
        repo.save(v2)
        results = repo.get_by_frame(frame_id)
        assert len(results) == 2
