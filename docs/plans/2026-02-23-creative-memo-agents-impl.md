# Creative & Memo Agents Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the Creative Agent (turns frames into ad copy variants) and Memo Agent (summarizes experiment cycles for the producer), following the patterns established by the Strategy Agent.

**Architecture:** Both agents reuse the generic `agent_runner.run()` loop, `AgentResult`, and error types. Each gets its own tool functions, system prompt, service, and API route. The Creative Agent works on a single `CreativeFrame`, producing 2-3 `CreativeVariant` drafts. The Memo Agent takes a show ID and explicit cycle window, producing a `ProducerMemo` with structured fields.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy, Pydantic v2, Anthropic SDK (via existing `ClaudeClient`), pytest.

**Design doc:** `docs/plans/2026-02-23-creative-memo-agents-design.md`

---

### Task 1: Add `channel` field to `CreativeFrame`

The `CreativeFrame` domain model is missing the `channel` field. The strategy agent's `FramePlan` has `channel`, but it's dropped when persisting frames. The creative agent needs this to know which platform to write copy for.

**Files:**
- Modify: `src/growth/domain/models.py:70-77`
- Modify: `src/growth/adapters/orm.py:120-129`
- Modify: `src/growth/adapters/repositories.py:265-288`
- Modify: `src/growth/app/services/strategy_service.py:132-143`
- Test: `tests/adapters/llm/test_strategy_tools.py` (existing tests should still pass)

**Step 1: Add `channel` to the domain model**

In `src/growth/domain/models.py`, add `channel: str` to `CreativeFrame`:

```python
@dataclass(frozen=True)
class CreativeFrame:
    frame_id: UUID
    show_id: UUID
    segment_id: UUID
    hypothesis: str
    promise: str
    evidence_refs: list[dict[str, Any]]
    channel: str
    risk_notes: str | None = None
```

**Step 2: Add `channel` column to ORM**

In `src/growth/adapters/orm.py`, add to `CreativeFrameORM`:

```python
channel: Mapped[str] = mapped_column(String(50))
```

Place it after `evidence_refs` and before `risk_notes`.

**Step 3: Update conversion functions**

In `src/growth/adapters/repositories.py`, update `_frame_to_domain` and `_frame_to_orm` to include `channel`:

```python
def _frame_to_domain(orm: CreativeFrameORM) -> CreativeFrame:
    return CreativeFrame(
        frame_id=UUID(orm.frame_id),
        show_id=UUID(orm.show_id),
        segment_id=UUID(orm.segment_id),
        hypothesis=orm.hypothesis,
        promise=orm.promise,
        evidence_refs=orm.evidence_refs,
        channel=orm.channel,
        risk_notes=orm.risk_notes,
    )

def _frame_to_orm(domain: CreativeFrame) -> CreativeFrameORM:
    return CreativeFrameORM(
        frame_id=str(domain.frame_id),
        show_id=str(domain.show_id),
        segment_id=str(domain.segment_id),
        hypothesis=domain.hypothesis,
        promise=domain.promise,
        evidence_refs=domain.evidence_refs,
        channel=domain.channel,
        risk_notes=domain.risk_notes,
    )
```

**Step 4: Update strategy service to persist channel**

In `src/growth/app/services/strategy_service.py`, update the frame creation loop (line ~133) to include `channel`:

```python
frame = CreativeFrame(
    frame_id=frame_id,
    show_id=show_id,
    segment_id=seg_id,
    hypothesis=plan.hypothesis,
    promise=plan.promise,
    evidence_refs=[ref.model_dump() for ref in plan.evidence_refs],
    channel=plan.channel.value,
    risk_notes=plan.risk_notes,
)
```

**Step 5: Run all existing tests**

Run: `python -m pytest tests/ -v`

Expected: All tests pass. Some tests that create `CreativeFrame` directly may need the new `channel` field added. Fix any that fail by adding `channel="meta"` to test frame constructions.

**Step 6: Commit**

```bash
git add src/growth/domain/models.py src/growth/adapters/orm.py src/growth/adapters/repositories.py src/growth/app/services/strategy_service.py
git commit -m "feat: add channel field to CreativeFrame domain model"
```

---

### Task 2: Add `CreativeVariantRepository` and `ProducerMemoRepository`

**Files:**
- Modify: `src/growth/ports/repositories.py`
- Modify: `src/growth/adapters/orm.py`
- Modify: `src/growth/adapters/repositories.py`
- Modify: `src/growth/app/container.py`
- Test: new tests inline with existing patterns

**Step 1: Write failing test for variant repo**

Create `tests/adapters/test_variant_repo.py`:

```python
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
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/adapters/test_variant_repo.py -v`

Expected: ImportError — `SQLAlchemyCreativeVariantRepository` doesn't exist.

**Step 3: Add ORM model for `CreativeVariant`**

In `src/growth/adapters/orm.py`, add after `CreativeFrameORM`:

```python
class CreativeVariantORM(Base):
    __tablename__ = "creative_variants"

    variant_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    frame_id: Mapped[str] = mapped_column(ForeignKey("creative_frames.frame_id"))
    platform: Mapped[str] = mapped_column(String(50))
    hook: Mapped[str] = mapped_column(String(500))
    body: Mapped[str] = mapped_column(String(2000))
    cta: Mapped[str] = mapped_column(String(200))
    constraints_passed: Mapped[int] = mapped_column(Integer, default=0)
```

**Step 4: Add protocol**

In `src/growth/ports/repositories.py`, add import for `CreativeVariant` and the protocol:

```python
class CreativeVariantRepository(Protocol):
    """Protocol for creative variant persistence."""

    def get_by_id(self, variant_id: UUID) -> CreativeVariant | None:
        """Get a variant by ID."""
        ...

    def save(self, variant: CreativeVariant) -> None:
        """Save a variant."""
        ...

    def get_by_frame(self, frame_id: UUID) -> list[CreativeVariant]:
        """Get all variants for a frame."""
        ...
```

**Step 5: Add SQLAlchemy implementation**

In `src/growth/adapters/repositories.py`, add:

```python
def _variant_to_domain(orm: CreativeVariantORM) -> CreativeVariant:
    return CreativeVariant(
        variant_id=UUID(orm.variant_id),
        frame_id=UUID(orm.frame_id),
        platform=orm.platform,
        hook=orm.hook,
        body=orm.body,
        cta=orm.cta,
        constraints_passed=bool(orm.constraints_passed),
    )


def _variant_to_orm(domain: CreativeVariant) -> CreativeVariantORM:
    return CreativeVariantORM(
        variant_id=str(domain.variant_id),
        frame_id=str(domain.frame_id),
        platform=domain.platform,
        hook=domain.hook,
        body=domain.body,
        cta=domain.cta,
        constraints_passed=int(domain.constraints_passed),
    )


class SQLAlchemyCreativeVariantRepository(CreativeVariantRepository):
    def __init__(self, session: Session):
        self._session = session

    def get_by_id(self, variant_id: UUID) -> CreativeVariant | None:
        orm = self._session.get(CreativeVariantORM, str(variant_id))
        if orm is None:
            return None
        return _variant_to_domain(orm)

    def save(self, variant: CreativeVariant) -> None:
        orm = _variant_to_orm(variant)
        self._session.merge(orm)
        self._session.commit()

    def get_by_frame(self, frame_id: UUID) -> list[CreativeVariant]:
        orms = self._session.query(CreativeVariantORM).filter_by(frame_id=str(frame_id)).all()
        return [_variant_to_domain(orm) for orm in orms]
```

Add the needed imports: `CreativeVariantORM` from orm, `CreativeVariant` from models, `CreativeVariantRepository` from ports.

**Step 6: Run variant repo test**

Run: `python -m pytest tests/adapters/test_variant_repo.py -v`

Expected: PASS

**Step 7: Write failing test for memo repo**

Create `tests/adapters/test_memo_repo.py`:

```python
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
```

**Step 8: Add ORM, protocol, and implementation for ProducerMemo**

In `src/growth/adapters/orm.py`, add after `CreativeVariantORM`:

```python
class ProducerMemoORM(Base):
    __tablename__ = "producer_memos"

    memo_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    show_id: Mapped[str] = mapped_column(ForeignKey("shows.show_id"))
    cycle_start: Mapped[datetime] = mapped_column(DateTime)
    cycle_end: Mapped[datetime] = mapped_column(DateTime)
    markdown: Mapped[str] = mapped_column(String(10000))
```

In `src/growth/ports/repositories.py`, add:

```python
class ProducerMemoRepository(Protocol):
    """Protocol for producer memo persistence."""

    def get_by_id(self, memo_id: UUID) -> ProducerMemo | None:
        """Get a memo by ID."""
        ...

    def save(self, memo: ProducerMemo) -> None:
        """Save a memo."""
        ...

    def get_by_show(self, show_id: UUID) -> list[ProducerMemo]:
        """Get all memos for a show."""
        ...
```

In `src/growth/adapters/repositories.py`, add:

```python
def _memo_to_domain(orm: ProducerMemoORM) -> ProducerMemo:
    from datetime import timezone
    return ProducerMemo(
        memo_id=UUID(orm.memo_id),
        show_id=UUID(orm.show_id),
        cycle_start=orm.cycle_start.replace(tzinfo=timezone.utc),
        cycle_end=orm.cycle_end.replace(tzinfo=timezone.utc),
        markdown=orm.markdown,
    )


def _memo_to_orm(domain: ProducerMemo) -> ProducerMemoORM:
    return ProducerMemoORM(
        memo_id=str(domain.memo_id),
        show_id=str(domain.show_id),
        cycle_start=domain.cycle_start,
        cycle_end=domain.cycle_end,
        markdown=domain.markdown,
    )


class SQLAlchemyProducerMemoRepository(ProducerMemoRepository):
    def __init__(self, session: Session):
        self._session = session

    def get_by_id(self, memo_id: UUID) -> ProducerMemo | None:
        orm = self._session.get(ProducerMemoORM, str(memo_id))
        if orm is None:
            return None
        return _memo_to_domain(orm)

    def save(self, memo: ProducerMemo) -> None:
        orm = _memo_to_orm(memo)
        self._session.merge(orm)
        self._session.commit()

    def get_by_show(self, show_id: UUID) -> list[ProducerMemo]:
        orms = self._session.query(ProducerMemoORM).filter_by(show_id=str(show_id)).all()
        return [_memo_to_domain(orm) for orm in orms]
```

**Step 9: Run memo repo test**

Run: `python -m pytest tests/adapters/test_memo_repo.py -v`

Expected: PASS

**Step 10: Add container methods**

In `src/growth/app/container.py`, add:

```python
def variant_repo(self):
    from growth.adapters.repositories import SQLAlchemyCreativeVariantRepository
    return SQLAlchemyCreativeVariantRepository(self._session)

def memo_repo(self):
    from growth.adapters.repositories import SQLAlchemyProducerMemoRepository
    return SQLAlchemyProducerMemoRepository(self._session)
```

**Step 11: Run all tests**

Run: `python -m pytest tests/ -v`

Expected: All pass.

**Step 12: Commit**

```bash
git add src/growth/ports/repositories.py src/growth/adapters/orm.py src/growth/adapters/repositories.py src/growth/app/container.py tests/adapters/test_variant_repo.py tests/adapters/test_memo_repo.py
git commit -m "feat: add CreativeVariant and ProducerMemo repositories"
```

---

### Task 3: Add domain events

**Files:**
- Modify: `src/growth/domain/events.py`
- Test: `tests/domain/test_events.py` (new)

**Step 1: Write failing test**

Create `tests/domain/test_events.py`:

```python
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
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/domain/test_events.py -v`

Expected: ImportError — events don't exist yet.

**Step 3: Add events to `events.py`**

In `src/growth/domain/events.py`, add after `StrategyFailed`:

```python
@dataclass(frozen=True)
class CreativeCompleted(DomainEvent):
    """Emitted when the Creative Agent produces variants successfully."""
    frame_id: UUID
    run_id: UUID
    num_variants: int
    variant_ids: tuple[UUID, ...]
    turns_used: int
    total_input_tokens: int
    total_output_tokens: int
    event_type: str = field(default="creative_completed", init=False)


@dataclass(frozen=True)
class CreativeFailed(DomainEvent):
    """Emitted when the Creative Agent fails."""
    frame_id: UUID
    run_id: UUID
    error_type: str
    error_message: str
    event_type: str = field(default="creative_failed", init=False)


@dataclass(frozen=True)
class MemoCompleted(DomainEvent):
    """Emitted when the Memo Agent produces a memo successfully."""
    show_id: UUID
    memo_id: UUID
    run_id: UUID
    cycle_start: str
    cycle_end: str
    turns_used: int
    total_input_tokens: int
    total_output_tokens: int
    event_type: str = field(default="memo_completed", init=False)


@dataclass(frozen=True)
class MemoFailed(DomainEvent):
    """Emitted when the Memo Agent fails."""
    show_id: UUID
    run_id: UUID
    error_type: str
    error_message: str
    event_type: str = field(default="memo_failed", init=False)
```

**Step 4: Run test**

Run: `python -m pytest tests/domain/test_events.py -v`

Expected: PASS

**Step 5: Commit**

```bash
git add src/growth/domain/events.py tests/domain/test_events.py
git commit -m "feat: add Creative and Memo domain events"
```

---

### Task 4: Add output schemas

**Files:**
- Modify: `src/growth/adapters/llm/schemas.py`
- Test: `tests/adapters/llm/test_creative_schemas.py` (new)
- Test: `tests/adapters/llm/test_memo_schemas.py` (new)

**Step 1: Write failing test for creative schemas**

Create `tests/adapters/llm/test_creative_schemas.py`:

```python
"""Tests for Creative Agent output schemas."""
import pytest
from pydantic import ValidationError

from growth.adapters.llm.schemas import CreativeOutput, CreativeVariantDraft


class TestCreativeVariantDraft:
    def test_valid(self):
        draft = CreativeVariantDraft(
            hook="Don't miss this show",
            body="An unforgettable night of live indie music in Austin at The Parish",
            cta="Get your tickets now",
            reasoning="Direct urgency angle targeting indie music fans in Austin",
        )
        assert draft.hook == "Don't miss this show"

    def test_rejects_short_hook(self):
        with pytest.raises(ValidationError):
            CreativeVariantDraft(hook="Hi", body="Valid body text for the ad copy here",
                                cta="Buy now please", reasoning="Valid reasoning for the angle")

    def test_rejects_short_body(self):
        with pytest.raises(ValidationError):
            CreativeVariantDraft(hook="Valid hook text", body="Short",
                                cta="Buy now please", reasoning="Valid reasoning for the angle")

    def test_rejects_short_cta(self):
        with pytest.raises(ValidationError):
            CreativeVariantDraft(hook="Valid hook text", body="Valid body text for the ad copy here",
                                cta="Buy", reasoning="Valid reasoning for the angle")


class TestCreativeOutput:
    def _make_draft(self, hook: str = "Don't miss this show") -> CreativeVariantDraft:
        return CreativeVariantDraft(
            hook=hook,
            body="An unforgettable night of live indie music in Austin at The Parish",
            cta="Get your tickets now",
            reasoning="Direct urgency angle targeting indie music fans in Austin",
        )

    def test_valid_with_2_variants(self):
        output = CreativeOutput(
            variants=[self._make_draft("Hook A variant"), self._make_draft("Hook B variant")],
            reasoning_summary="Two variants targeting urgency and social proof angles.",
        )
        assert len(output.variants) == 2

    def test_valid_with_3_variants(self):
        output = CreativeOutput(
            variants=[self._make_draft(f"Hook {c} variant") for c in "ABC"],
            reasoning_summary="Three variants covering urgency, social proof, and scarcity.",
        )
        assert len(output.variants) == 3

    def test_rejects_1_variant(self):
        with pytest.raises(ValidationError):
            CreativeOutput(
                variants=[self._make_draft()],
                reasoning_summary="Only one variant which is not enough.",
            )

    def test_rejects_4_variants(self):
        with pytest.raises(ValidationError):
            CreativeOutput(
                variants=[self._make_draft(f"Hook {i} variant") for i in range(4)],
                reasoning_summary="Four variants which exceeds the maximum.",
            )

    def test_json_round_trip(self):
        output = CreativeOutput(
            variants=[self._make_draft("Hook A variant"), self._make_draft("Hook B variant")],
            reasoning_summary="Round trip test for creative output serialization.",
        )
        json_str = output.model_dump_json()
        parsed = CreativeOutput.model_validate_json(json_str)
        assert parsed.variants[0].hook == output.variants[0].hook
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/adapters/llm/test_creative_schemas.py -v`

Expected: ImportError — `CreativeVariantDraft` doesn't exist.

**Step 3: Write failing test for memo schemas**

Create `tests/adapters/llm/test_memo_schemas.py`:

```python
"""Tests for Memo Agent output schemas."""
import pytest
from pydantic import ValidationError

from growth.adapters.llm.schemas import MemoOutput


class TestMemoOutput:
    def _make_valid(self, **overrides) -> MemoOutput:
        defaults = dict(
            what_worked="Instagram Reels targeting college students drove 12 purchases at $8.50 CAC",
            what_failed="Meta broad audience experiment killed after zero purchases in 3 days of spend",
            cost_per_seat_cents=850,
            cost_per_seat_explanation="Blended CAC across 3 experiments: $2,550 spend / 30 purchases",
            next_three_tests=["Test TikTok with artist interview clips targeting 18-24 in Austin"],
            policy_exceptions=None,
            markdown="# Cycle Report\n\n## What Worked\n\nInstagram Reels performed well...",
            reasoning_summary="This cycle focused on discovery with 3 experiments across 2 channels.",
        )
        defaults.update(overrides)
        return MemoOutput(**defaults)

    def test_valid(self):
        memo = self._make_valid()
        assert memo.cost_per_seat_cents == 850

    def test_rejects_negative_cost(self):
        with pytest.raises(ValidationError):
            self._make_valid(cost_per_seat_cents=-100)

    def test_rejects_empty_next_tests(self):
        with pytest.raises(ValidationError):
            self._make_valid(next_three_tests=[])

    def test_rejects_too_many_next_tests(self):
        with pytest.raises(ValidationError):
            self._make_valid(next_three_tests=["a", "b", "c", "d"])

    def test_nullable_policy_exceptions(self):
        memo = self._make_valid(policy_exceptions=None)
        assert memo.policy_exceptions is None

    def test_with_policy_exceptions(self):
        memo = self._make_valid(policy_exceptions="Overrode kill on experiment #3 per producer request")
        assert memo.policy_exceptions is not None

    def test_json_round_trip(self):
        memo = self._make_valid()
        json_str = memo.model_dump_json()
        parsed = MemoOutput.model_validate_json(json_str)
        assert parsed.cost_per_seat_cents == memo.cost_per_seat_cents
```

**Step 4: Add schemas to `schemas.py`**

In `src/growth/adapters/llm/schemas.py`, add after `StrategyOutput`:

```python
# --- Creative Agent schemas ---

class CreativeVariantDraft(BaseModel):
    """A single ad copy variant from the Creative Agent."""

    hook: str = Field(min_length=5, max_length=80)
    body: str = Field(min_length=10, max_length=500)
    cta: str = Field(min_length=5, max_length=60)
    reasoning: str = Field(min_length=10, max_length=280)


class CreativeOutput(BaseModel):
    """Complete output from the Creative Agent."""

    variants: list[CreativeVariantDraft] = Field(min_length=2, max_length=3)
    reasoning_summary: str = Field(min_length=20, max_length=800)


# --- Memo Agent schemas ---

class MemoOutput(BaseModel):
    """Complete output from the Memo Agent."""

    what_worked: str = Field(min_length=20, max_length=800)
    what_failed: str = Field(min_length=20, max_length=800)
    cost_per_seat_cents: int = Field(ge=0)
    cost_per_seat_explanation: str = Field(min_length=10, max_length=400)
    next_three_tests: list[str] = Field(min_length=1, max_length=3)
    policy_exceptions: Optional[str] = Field(default=None, max_length=400)
    markdown: str = Field(min_length=50)
    reasoning_summary: str = Field(min_length=20, max_length=800)
```

**Step 5: Run both schema tests**

Run: `python -m pytest tests/adapters/llm/test_creative_schemas.py tests/adapters/llm/test_memo_schemas.py -v`

Expected: All PASS.

**Step 6: Commit**

```bash
git add src/growth/adapters/llm/schemas.py tests/adapters/llm/test_creative_schemas.py tests/adapters/llm/test_memo_schemas.py
git commit -m "feat: add Creative and Memo agent output schemas"
```

---

### Task 5: Creative agent tools

**Files:**
- Create: `src/growth/adapters/llm/creative_tools.py`
- Test: `tests/adapters/llm/test_creative_tools.py` (new)

**Step 1: Write failing test**

Create `tests/adapters/llm/test_creative_tools.py`:

```python
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
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/adapters/llm/test_creative_tools.py -v`

Expected: ImportError — `creative_tools` doesn't exist.

**Step 3: Implement creative tools**

Create `src/growth/adapters/llm/creative_tools.py`:

```python
"""Creative Agent tool functions."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from growth.domain.models import get_show_phase
from growth.ports.repositories import FrameRepository, SegmentRepository, ShowRepository


# Platform constraints — hardcoded for MVP
PLATFORM_CONSTRAINTS: dict[str, dict[str, Any]] = {
    "meta": {
        "constraints": {"hook": 80, "body": 500, "cta": 60},
        "notes": "Front-load value prop in first line. Emoji OK but not required. "
                 "Primary text shows ~125 chars before 'See more' on mobile.",
    },
    "instagram": {
        "constraints": {"hook": 80, "body": 400, "cta": 60},
        "notes": "Visual-first platform. Hook must work as overlay text. "
                 "Keep body concise — captions are secondary to creative.",
    },
    "youtube": {
        "constraints": {"hook": 70, "body": 500, "cta": 50},
        "notes": "Hook must grab in first 5 seconds. Body supports the video script. "
                 "CTA should be specific and time-bound.",
    },
    "tiktok": {
        "constraints": {"hook": 60, "body": 300, "cta": 40},
        "notes": "Authenticity over polish. Hook must stop the scroll. "
                 "Avoid corporate language. Short, punchy copy wins.",
    },
    "reddit": {
        "constraints": {"hook": 80, "body": 500, "cta": 60},
        "notes": "Community-aware tone. Avoid hard sell. "
                 "Frame as genuine recommendation, not advertisement.",
    },
    "snapchat": {
        "constraints": {"hook": 50, "body": 200, "cta": 30},
        "notes": "Ephemeral, casual tone. Very short copy. "
                 "Hook is everything — body is optional on most placements.",
    },
}


def get_frame_context(
    frame_id: UUID,
    frame_repo: FrameRepository,
    seg_repo: SegmentRepository,
    show_repo: ShowRepository,
) -> dict[str, Any]:
    """Get the creative brief: frame, segment, and show context."""
    frame = frame_repo.get_by_id(frame_id)
    if frame is None:
        return {"error": "frame_not_found"}

    segment = seg_repo.get_by_id(frame.segment_id)
    if segment is None:
        return {"error": "segment_not_found"}

    show = show_repo.get_by_id(frame.show_id)
    if show is None:
        return {"error": "show_not_found"}

    now = datetime.now(timezone.utc)
    phase = get_show_phase(show.show_time, now)
    days_until_show = (show.show_time - now).days

    return {
        "frame": {
            "hypothesis": frame.hypothesis,
            "promise": frame.promise,
            "evidence_refs": frame.evidence_refs,
            "risk_notes": frame.risk_notes,
            "channel": frame.channel,
        },
        "segment": {
            "name": segment.name,
            "definition": segment.definition_json,
            "estimated_size": segment.estimated_size,
        },
        "show": {
            "artist_name": show.artist_name,
            "city": show.city,
            "venue": show.venue,
            "show_time": show.show_time.isoformat(),
            "capacity": show.capacity,
            "tickets_sold": show.tickets_sold,
            "tickets_total": show.tickets_total,
            "phase": phase.value,
            "days_until_show": days_until_show,
        },
    }


def get_platform_constraints(
    channel: str,
) -> dict[str, Any]:
    """Get character limits and formatting rules for a platform."""
    if channel not in PLATFORM_CONSTRAINTS:
        return {"error": "unknown_channel"}

    return {
        "channel": channel,
        **PLATFORM_CONSTRAINTS[channel],
    }
```

**Step 4: Run test**

Run: `python -m pytest tests/adapters/llm/test_creative_tools.py -v`

Expected: All PASS.

**Step 5: Commit**

```bash
git add src/growth/adapters/llm/creative_tools.py tests/adapters/llm/test_creative_tools.py
git commit -m "feat: add Creative Agent tool functions"
```

---

### Task 6: Creative agent prompt and tool schemas

**Files:**
- Create: `src/growth/adapters/llm/prompts/creative.py`

No separate test — prompt correctness is validated by the service integration test in Task 8.

**Step 1: Write the prompt and tool schemas**

Create `src/growth/adapters/llm/prompts/creative.py`:

```python
"""Creative Agent system prompt and tool schemas."""

CREATIVE_PROMPT_VERSION = "1.0"

CREATIVE_SYSTEM_PROMPT = """\
You are a creative copywriter agent for live show ticket sales.

## Goal

Write 2-3 ad copy variants for a single audience segment and framing hypothesis. \
Each variant must work on the specified platform and stay within character constraints.

## Process

1. Call get_frame_context to understand the creative brief: the audience segment, \
framing hypothesis, promise, evidence, and show details.
2. Call get_platform_constraints to get the character limits and formatting rules \
for the target platform.
3. Write 2-3 distinct variants. Each must take a different creative angle \
(e.g., urgency, social proof, curiosity, exclusivity, FOMO).

## Constraints

- Each variant MUST have a different creative angle. Do not produce minor rewrites.
- Stay within platform character limits for hook, body, and cta.
- The hook must be attention-grabbing and work standalone (e.g., as overlay text).
- The body must reinforce the frame's promise and hypothesis.
- The cta must be specific and action-oriented (not generic "Learn more").
- Do NOT invent facts. Use only information from the frame context and show details.
- Tone should match the platform (casual for TikTok, community-aware for Reddit, etc.).

## Output Format

When you have written your variants, respond with a JSON object matching this schema exactly:

{
  "variants": [
    {
      "hook": "One night only at The Parish",
      "body": "Austin's most intimate venue. 200 seats. An evening of raw indie music you won't forget.",
      "cta": "Grab your tickets before they're gone",
      "reasoning": "Scarcity angle — limited capacity creates urgency for indie fans"
    }
  ],
  "reasoning_summary": "Brief explanation of your creative strategy (20-800 chars)"
}

IMPORTANT:
- hook: 5-80 characters
- body: 10-500 characters
- cta: 5-60 characters
- reasoning: 10-280 characters per variant
- Produce exactly 2-3 variants. No fewer, no more.
- Each variant must use a materially different creative angle.
- Respond with ONLY the JSON object. No markdown, no explanation, no code fences.
"""


CREATIVE_TOOL_SCHEMAS = [
    {
        "name": "get_frame_context",
        "description": "Get the creative brief: the frame's hypothesis, promise, evidence, "
                       "risk notes, the audience segment definition, and show details "
                       "(artist, city, venue, date, tickets, phase).",
        "input_schema": {
            "type": "object",
            "properties": {
                "frame_id": {
                    "type": "string",
                    "description": "The UUID of the creative frame to write copy for.",
                },
            },
            "required": ["frame_id"],
        },
    },
    {
        "name": "get_platform_constraints",
        "description": "Get the character limits and formatting rules for a platform. "
                       "Returns max character counts for hook, body, and cta, "
                       "plus platform-specific copywriting guidance.",
        "input_schema": {
            "type": "object",
            "properties": {
                "channel": {
                    "type": "string",
                    "description": "The platform: meta, instagram, youtube, tiktok, reddit, or snapchat.",
                },
            },
            "required": ["channel"],
        },
    },
]
```

**Step 2: Commit**

```bash
git add src/growth/adapters/llm/prompts/creative.py
git commit -m "feat: add Creative Agent system prompt and tool schemas"
```

---

### Task 7: Memo agent tools

**Files:**
- Create: `src/growth/adapters/llm/memo_tools.py`
- Test: `tests/adapters/llm/test_memo_tools.py` (new)

**Step 1: Write failing test**

Create `tests/adapters/llm/test_memo_tools.py`:

```python
"""Tests for Memo Agent tool functions."""
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from growth.adapters.llm.memo_tools import get_cycle_experiments
from growth.adapters.orm import create_tables, get_engine, get_session_maker
from growth.adapters.repositories import (
    SQLAlchemyExperimentRepository,
    SQLAlchemyFrameRepository,
    SQLAlchemySegmentRepository,
    SQLAlchemyShowRepository,
)
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


@pytest.fixture
def repos(tmp_path):
    db_path = tmp_path / "test.db"
    engine = get_engine(f"sqlite:///{db_path}")
    create_tables(engine)
    Session = get_session_maker(engine)
    session = Session()
    yield {
        "show_repo": SQLAlchemyShowRepository(session),
        "exp_repo": SQLAlchemyExperimentRepository(session),
        "seg_repo": SQLAlchemySegmentRepository(session),
        "frame_repo": SQLAlchemyFrameRepository(session),
    }
    session.close()


def _setup_cycle_data(repos):
    """Create a show with experiments, observations, and decisions."""
    show_id = uuid4()
    show = Show(
        show_id=show_id, artist_name="Test Artist", city="Austin",
        venue="The Parish", show_time=datetime.now(timezone.utc) + timedelta(days=30),
        timezone="America/Chicago", capacity=200, tickets_total=200, tickets_sold=50,
    )
    repos["show_repo"].save(show)

    seg_id = uuid4()
    repos["seg_repo"].save(AudienceSegment(
        segment_id=seg_id, show_id=show_id, name="Indie fans",
        definition_json={"interests": ["indie"]}, estimated_size=5000,
        created_by="strategy_agent",
    ))

    frame_id = uuid4()
    repos["frame_repo"].save(CreativeFrame(
        frame_id=frame_id, show_id=show_id, segment_id=seg_id,
        hypothesis="Indie fans respond to intimate framing",
        promise="Intimate indie night",
        evidence_refs=[{"source": "show_data", "summary": "200-cap venue"}],
        channel="meta",
    ))

    exp_id = uuid4()
    cycle_start = datetime(2026, 2, 15, tzinfo=timezone.utc)
    cycle_end = datetime(2026, 2, 22, tzinfo=timezone.utc)

    repos["exp_repo"].save(Experiment(
        experiment_id=exp_id, show_id=show_id, segment_id=seg_id,
        frame_id=frame_id, channel="meta", objective="ticket_sales",
        budget_cap_cents=15000, status=ExperimentStatus.COMPLETED,
        start_time=cycle_start, end_time=cycle_end,
        baseline_snapshot={"tickets_sold": 50},
    ))

    repos["exp_repo"].add_observation(Observation(
        observation_id=uuid4(), experiment_id=exp_id,
        window_start=cycle_start, window_end=cycle_start + timedelta(days=3),
        spend_cents=5000, impressions=2000, clicks=100, sessions=80,
        checkouts=10, purchases=5, revenue_cents=12500, refunds=0,
        refund_cents=0, complaints=0, negative_comment_rate=0.01,
        attribution_model="last_click_utm", raw_json={},
    ))

    repos["exp_repo"].save_decision(Decision(
        decision_id=uuid4(), experiment_id=exp_id,
        action=DecisionAction.SCALE, confidence=0.8,
        rationale="Strong conversion rate", policy_version="1.0",
        metrics_snapshot={"cac_cents": 1000},
    ))

    return show_id, cycle_start, cycle_end


class TestGetCycleExperiments:
    def test_returns_experiments_in_window(self, repos):
        show_id, cycle_start, cycle_end = _setup_cycle_data(repos)
        result = get_cycle_experiments(
            show_id=show_id,
            cycle_start=cycle_start.isoformat(),
            cycle_end=cycle_end.isoformat(),
            exp_repo=repos["exp_repo"],
            seg_repo=repos["seg_repo"],
            frame_repo=repos["frame_repo"],
        )
        assert len(result["experiments"]) == 1
        exp = result["experiments"][0]
        assert exp["segment_name"] == "Indie fans"
        assert exp["frame_hypothesis"] == "Indie fans respond to intimate framing"
        assert exp["channel"] == "meta"
        assert exp["observations"]["spend_cents"] == 5000
        assert exp["observations"]["purchases"] == 5
        assert exp["decision"]["action"] == "scale"
        assert exp["decision"]["confidence"] == 0.8

    def test_empty_when_no_experiments(self, repos):
        show_id = uuid4()
        repos["show_repo"].save(Show(
            show_id=show_id, artist_name="Empty", city="Austin",
            venue="Venue", show_time=datetime.now(timezone.utc) + timedelta(days=30),
            timezone="UTC", capacity=100, tickets_total=100, tickets_sold=0,
        ))
        result = get_cycle_experiments(
            show_id=show_id,
            cycle_start="2026-02-15T00:00:00+00:00",
            cycle_end="2026-02-22T00:00:00+00:00",
            exp_repo=repos["exp_repo"],
            seg_repo=repos["seg_repo"],
            frame_repo=repos["frame_repo"],
        )
        assert result["experiments"] == []
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/adapters/llm/test_memo_tools.py -v`

Expected: ImportError — `memo_tools` doesn't exist.

**Step 3: Implement memo tools**

Create `src/growth/adapters/llm/memo_tools.py`:

```python
"""Memo Agent tool functions."""
from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from growth.ports.repositories import ExperimentRepository, FrameRepository, SegmentRepository


def get_cycle_experiments(
    show_id: UUID,
    cycle_start: str,
    cycle_end: str,
    exp_repo: ExperimentRepository,
    seg_repo: SegmentRepository,
    frame_repo: FrameRepository,
) -> dict[str, Any]:
    """Get all experiments in the cycle window with normalized, memo-friendly fields."""
    start = datetime.fromisoformat(cycle_start)
    end = datetime.fromisoformat(cycle_end)

    all_experiments = exp_repo.get_by_show(show_id)

    # Filter to experiments overlapping the cycle window
    cycle_experiments = []
    for exp in all_experiments:
        if exp.start_time is None:
            continue
        exp_end = exp.end_time or end
        if exp.start_time < end and exp_end > start:
            cycle_experiments.append(exp)

    results = []
    for exp in cycle_experiments:
        # Get segment and frame context
        segment = seg_repo.get_by_id(exp.segment_id)
        frame = frame_repo.get_by_id(exp.frame_id)

        # Aggregate observations
        observations = exp_repo.get_observations(exp.experiment_id)
        agg = {
            "spend_cents": sum(o.spend_cents for o in observations),
            "impressions": sum(o.impressions for o in observations),
            "clicks": sum(o.clicks for o in observations),
            "purchases": sum(o.purchases for o in observations),
            "revenue_cents": sum(o.revenue_cents for o in observations),
        }

        # Get latest decision
        decisions = exp_repo.get_decisions(exp.experiment_id)
        decision_data = None
        if decisions:
            latest = decisions[-1]
            decision_data = {
                "action": latest.action.value,
                "confidence": latest.confidence,
                "rationale": latest.rationale,
            }

        results.append({
            "experiment_id": str(exp.experiment_id),
            "segment_name": segment.name if segment else "unknown",
            "frame_hypothesis": frame.hypothesis if frame else "unknown",
            "channel": exp.channel,
            "budget_cap_cents": exp.budget_cap_cents,
            "observations": agg,
            "decision": decision_data,
        })

    return {"experiments": results}
```

**Step 4: Run test**

Run: `python -m pytest tests/adapters/llm/test_memo_tools.py -v`

Expected: All PASS.

**Step 5: Commit**

```bash
git add src/growth/adapters/llm/memo_tools.py tests/adapters/llm/test_memo_tools.py
git commit -m "feat: add Memo Agent tool functions"
```

---

### Task 8: Memo agent prompt and tool schemas

**Files:**
- Create: `src/growth/adapters/llm/prompts/memo.py`

**Step 1: Write the prompt and tool schemas**

Create `src/growth/adapters/llm/prompts/memo.py`:

```python
"""Memo Agent system prompt and tool schemas."""

MEMO_PROMPT_VERSION = "1.0"

MEMO_SYSTEM_PROMPT = """\
You are a producer memo writer for live show ticket sales experiments.

## Goal

Summarize a completed experiment cycle into a one-page memo for the show producer. \
The memo must be actionable, honest, and backed by the numbers.

## Process

1. Call get_show_details to understand the show context and current ticket status.
2. Call get_cycle_experiments to get all experiments, observations, and decisions from this cycle.
3. Call get_budget_status to understand spend efficiency and remaining budget.
4. Synthesize your findings into the structured memo format.

## Constraints

- Use ONLY data from the tools. Do not invent metrics or outcomes.
- cost_per_seat_cents must be computed from actual spend and purchases. \
If zero purchases, set to 0 and explain in cost_per_seat_explanation.
- what_worked and what_failed must reference specific experiments by segment name and channel.
- next_three_tests should be concrete: specify audience, channel, and angle.
- The markdown field must be a well-formatted one-page memo covering all sections.
- Be honest about failures. The producer needs truth, not optimism.

## Output Format

Respond with a JSON object matching this schema exactly:

{
  "what_worked": "Instagram Reels targeting college students in Austin drove 12 purchases at $8.50 CAC...",
  "what_failed": "Meta broad audience experiment killed after zero purchases in 3 days...",
  "cost_per_seat_cents": 850,
  "cost_per_seat_explanation": "Blended CAC across 3 experiments: $2,550 spend / 30 purchases",
  "next_three_tests": [
    "Test TikTok with artist interview clips targeting 18-24 in Austin, $100 cap"
  ],
  "policy_exceptions": null,
  "markdown": "# Cycle Report\\n\\n## What Worked\\n\\n...",
  "reasoning_summary": "Brief explanation of your analysis approach (20-800 chars)"
}

IMPORTANT:
- what_worked: 20-800 characters
- what_failed: 20-800 characters
- cost_per_seat_cents: integer >= 0
- cost_per_seat_explanation: 10-400 characters
- next_three_tests: 1-3 items
- policy_exceptions: optional, max 400 characters (null if none)
- markdown: at least 50 characters, well-formatted
- reasoning_summary: 20-800 characters
- Respond with ONLY the JSON object. No markdown, no explanation, no code fences.
"""


MEMO_TOOL_SCHEMAS = [
    {
        "name": "get_show_details",
        "description": "Get the show's core info: artist, city, venue, date, capacity, "
                       "current ticket sales, computed show phase (early/mid/late), "
                       "and days until showtime.",
        "input_schema": {
            "type": "object",
            "properties": {
                "show_id": {
                    "type": "string",
                    "description": "The UUID of the show.",
                },
            },
            "required": ["show_id"],
        },
    },
    {
        "name": "get_cycle_experiments",
        "description": "Get all experiments from the cycle window with aggregated observations "
                       "and decisions. Returns normalized fields: segment_name, frame_hypothesis, "
                       "channel, budget_cap_cents, observations (spend, impressions, clicks, "
                       "purchases, revenue), and decision (action, confidence, rationale).",
        "input_schema": {
            "type": "object",
            "properties": {
                "show_id": {
                    "type": "string",
                    "description": "The UUID of the show.",
                },
                "cycle_start": {
                    "type": "string",
                    "description": "ISO timestamp for cycle start.",
                },
                "cycle_end": {
                    "type": "string",
                    "description": "ISO timestamp for cycle end.",
                },
            },
            "required": ["show_id", "cycle_start", "cycle_end"],
        },
    },
    {
        "name": "get_budget_status",
        "description": "Get the budget status for a show: total budget, amount spent, "
                       "remaining budget, current phase, and phase-specific budget cap.",
        "input_schema": {
            "type": "object",
            "properties": {
                "show_id": {
                    "type": "string",
                    "description": "The UUID of the show.",
                },
            },
            "required": ["show_id"],
        },
    },
]
```

**Step 2: Commit**

```bash
git add src/growth/adapters/llm/prompts/memo.py
git commit -m "feat: add Memo Agent system prompt and tool schemas"
```

---

### Task 9: Creative service

**Files:**
- Create: `src/growth/app/services/creative_service.py`
- Test: `tests/app/test_creative_service.py` (new)

**Step 1: Write failing integration test**

Create `tests/app/test_creative_service.py`:

```python
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
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/app/test_creative_service.py -v`

Expected: ImportError — `CreativeService` doesn't exist.

**Step 3: Implement the service**

Create `src/growth/app/services/creative_service.py`:

```python
"""Creative service — orchestrates a Creative Agent run."""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import List, cast
from uuid import UUID, uuid4

from growth.adapters.llm.agent_runner import run as run_agent
from growth.adapters.llm.client import ClaudeClient
from growth.adapters.llm.creative_tools import PLATFORM_CONSTRAINTS
from growth.adapters.llm.errors import AgentAPIError, AgentParseError, AgentTurnLimitError
from growth.adapters.llm.prompts.creative import (
    CREATIVE_PROMPT_VERSION,
    CREATIVE_SYSTEM_PROMPT,
    CREATIVE_TOOL_SCHEMAS,
)
from growth.adapters.llm.schemas import CreativeOutput
from growth.domain.events import CreativeCompleted, CreativeFailed
from growth.domain.models import CreativeVariant
from growth.ports.event_log import EventLog
from growth.ports.repositories import (
    CreativeVariantRepository,
    FrameRepository,
    SegmentRepository,
    ShowRepository,
)


class CreativeRunError(Exception):
    """Raised when a creative run fails."""

    def __init__(self, message: str, run_id: UUID):
        self.run_id = run_id
        super().__init__(message)


class ConstraintViolationError(Exception):
    """Raised when agent output violates platform constraints."""

    def __init__(self, message: str, run_id: UUID, violations: list[str]):
        self.run_id = run_id
        self.violations = violations
        super().__init__(message)


@dataclass(frozen=True)
class CreativeRunResult:
    """Result from a successful creative run."""

    run_id: UUID
    creative_output: CreativeOutput
    variant_ids: List[UUID]
    turns_used: int
    total_input_tokens: int
    total_output_tokens: int


class CreativeService:
    """Orchestrates a Creative Agent run end-to-end."""

    def __init__(
        self,
        claude_client: ClaudeClient,
        frame_repo: FrameRepository,
        seg_repo: SegmentRepository,
        show_repo: ShowRepository,
        variant_repo: CreativeVariantRepository,
        event_log: EventLog,
        runs_path: Path = Path("data/runs"),
    ):
        self._client = claude_client
        self._frame_repo = frame_repo
        self._seg_repo = seg_repo
        self._show_repo = show_repo
        self._variant_repo = variant_repo
        self._event_log = event_log
        self._runs_path = runs_path

    def run(self, frame_id: UUID) -> CreativeRunResult:
        """Run the Creative Agent for a frame."""
        frame = self._frame_repo.get_by_id(frame_id)
        if frame is None:
            raise ValueError(f"Frame {frame_id} not found")

        run_id = uuid4()
        run_dir = self._runs_path / str(run_id)
        run_dir.mkdir(parents=True, exist_ok=True)
        conversation_log = run_dir / "creative_conversation.jsonl"

        dispatcher = self._build_tool_dispatcher(frame_id)

        user_message = (
            f"Write ad copy variants for this creative frame:\n"
            f"- Frame ID for tool calls: {frame_id}\n"
            f"- Channel: {frame.channel}\n\n"
            f"Start by calling get_frame_context, then get_platform_constraints."
        )

        try:
            agent_result = run_agent(
                client=self._client,
                system_prompt=CREATIVE_SYSTEM_PROMPT,
                user_message=user_message,
                tools=CREATIVE_TOOL_SCHEMAS,
                tool_dispatcher=dispatcher,
                output_model=CreativeOutput,
                max_turns=8,
                conversation_log_path=conversation_log,
            )
        except (AgentTurnLimitError, AgentParseError, AgentAPIError) as e:
            self._emit_failure(frame_id, run_id, e)
            raise CreativeRunError(str(e), run_id) from e

        creative_output = cast(CreativeOutput, agent_result.output)

        # Validate constraints deterministically
        violations = self._validate_constraints(creative_output, frame.channel)
        if violations:
            error = ConstraintViolationError(
                f"Constraint violations: {'; '.join(violations)}", run_id, violations
            )
            self._emit_failure(frame_id, run_id, error)
            raise error

        # Persist variants
        variant_ids: List[UUID] = []
        for draft in creative_output.variants:
            vid = uuid4()
            variant = CreativeVariant(
                variant_id=vid,
                frame_id=frame_id,
                platform=frame.channel,
                hook=draft.hook,
                body=draft.body,
                cta=draft.cta,
                constraints_passed=True,
            )
            self._variant_repo.save(variant)
            variant_ids.append(vid)

        # Write artifact
        artifact = {
            **creative_output.model_dump(),
            "run_id": str(run_id),
            "frame_id": str(frame_id),
            "model_name": self._client.model,
            "prompt_version": CREATIVE_PROMPT_VERSION,
            "turns_used": agent_result.turns_used,
            "total_input_tokens": agent_result.total_input_tokens,
            "total_output_tokens": agent_result.total_output_tokens,
            "variant_ids": [str(vid) for vid in variant_ids],
        }
        artifact_path = run_dir / "creative_output.json"
        artifact_path.write_text(json.dumps(artifact, indent=2, default=str))

        # Emit success event
        self._event_log.append(
            CreativeCompleted(
                event_id=uuid4(),
                occurred_at=datetime.now(timezone.utc),
                frame_id=frame_id,
                run_id=run_id,
                num_variants=len(variant_ids),
                variant_ids=tuple(variant_ids),
                turns_used=agent_result.turns_used,
                total_input_tokens=agent_result.total_input_tokens,
                total_output_tokens=agent_result.total_output_tokens,
            )
        )

        return CreativeRunResult(
            run_id=run_id,
            creative_output=creative_output,
            variant_ids=variant_ids,
            turns_used=agent_result.turns_used,
            total_input_tokens=agent_result.total_input_tokens,
            total_output_tokens=agent_result.total_output_tokens,
        )

    def _validate_constraints(self, output: CreativeOutput, channel: str) -> list[str]:
        """Check variant copy lengths against platform constraints."""
        if channel not in PLATFORM_CONSTRAINTS:
            return []
        limits = PLATFORM_CONSTRAINTS[channel]["constraints"]
        violations = []
        for i, variant in enumerate(output.variants):
            if len(variant.hook) > limits["hook"]:
                violations.append(f"variant[{i}].hook exceeds {limits['hook']} chars")
            if len(variant.body) > limits["body"]:
                violations.append(f"variant[{i}].body exceeds {limits['body']} chars")
            if len(variant.cta) > limits["cta"]:
                violations.append(f"variant[{i}].cta exceeds {limits['cta']} chars")
        return violations

    def _build_tool_dispatcher(self, frame_id: UUID):
        from growth.adapters.llm.creative_tools import get_frame_context, get_platform_constraints

        def dispatch(name: str, input: dict) -> dict:
            if name == "get_frame_context":
                return get_frame_context(
                    frame_id=UUID(input["frame_id"]),
                    frame_repo=self._frame_repo,
                    seg_repo=self._seg_repo,
                    show_repo=self._show_repo,
                )
            elif name == "get_platform_constraints":
                return get_platform_constraints(channel=input["channel"])
            else:
                return {"error": f"Unknown tool: {name}"}

        return dispatch

    def _emit_failure(self, frame_id: UUID, run_id: UUID, error: Exception) -> None:
        self._event_log.append(
            CreativeFailed(
                event_id=uuid4(),
                occurred_at=datetime.now(timezone.utc),
                frame_id=frame_id,
                run_id=run_id,
                error_type=type(error).__name__,
                error_message=str(error),
            )
        )
```

**Step 4: Run test**

Run: `python -m pytest tests/app/test_creative_service.py -v`

Expected: All PASS.

**Step 5: Commit**

```bash
git add src/growth/app/services/creative_service.py tests/app/test_creative_service.py
git commit -m "feat: add Creative Agent service with deterministic constraint validation"
```

---

### Task 10: Creative API endpoint and wiring

**Files:**
- Create: `src/growth/app/api/creative.py`
- Modify: `src/growth/app/api/app.py`
- Modify: `src/growth/app/container.py`
- Test: `tests/api/test_creative.py` (new)

**Step 1: Write failing API test**

Create `tests/api/test_creative.py`:

```python
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
    container.close()


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
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/api/test_creative.py -v`

Expected: ImportError — creative route doesn't exist.

**Step 3: Create the API route**

Create `src/growth/app/api/creative.py`:

```python
"""Creative Agent API endpoint."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Request

from growth.app.services.creative_service import ConstraintViolationError, CreativeRunError

router = APIRouter()


@router.post("/{frame_id}/run")
def run_creative(frame_id: UUID, request: Request):
    container = request.app.state.container
    service = container.creative_service()

    try:
        result = service.run(frame_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ConstraintViolationError as e:
        raise HTTPException(status_code=422, detail={
            "error": str(e),
            "run_id": str(e.run_id),
            "violations": e.violations,
        })
    except CreativeRunError as e:
        raise HTTPException(status_code=502, detail={
            "error": str(e),
            "run_id": str(e.run_id),
        })

    return {
        "run_id": str(result.run_id),
        "variant_ids": [str(vid) for vid in result.variant_ids],
        "reasoning_summary": result.creative_output.reasoning_summary,
        "turns_used": result.turns_used,
        "total_input_tokens": result.total_input_tokens,
        "total_output_tokens": result.total_output_tokens,
    }
```

**Step 4: Add container wiring**

In `src/growth/app/container.py`, add the `creative_service` method:

```python
def creative_service(self):
    from growth.app.services.creative_service import CreativeService
    return CreativeService(
        claude_client=self.claude_client(),
        frame_repo=self.frame_repo(),
        seg_repo=self.segment_repo(),
        show_repo=self.show_repo(),
        variant_repo=self.variant_repo(),
        event_log=self.event_log(),
        runs_path=self._runs_path,
    )
```

**Step 5: Register the router**

In `src/growth/app/api/app.py`, add after the strategy router:

```python
from growth.app.api.creative import router as creative_router
app.include_router(creative_router, prefix="/api/creative", tags=["creative"])
```

**Step 6: Run test**

Run: `python -m pytest tests/api/test_creative.py -v`

Expected: All PASS.

**Step 7: Run all tests**

Run: `python -m pytest tests/ -v`

Expected: All pass.

**Step 8: Commit**

```bash
git add src/growth/app/api/creative.py src/growth/app/api/app.py src/growth/app/container.py tests/api/test_creative.py
git commit -m "feat: add Creative Agent API endpoint and container wiring"
```

---

### Task 11: Memo service

**Files:**
- Create: `src/growth/app/services/memo_service.py`
- Test: `tests/app/test_memo_service.py` (new)

**Step 1: Write failing integration test**

Create `tests/app/test_memo_service.py`:

```python
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
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/app/test_memo_service.py -v`

Expected: ImportError — `MemoService` doesn't exist.

**Step 3: Implement the service**

Create `src/growth/app/services/memo_service.py`:

```python
"""Memo service — orchestrates a Memo Agent run."""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import cast
from uuid import UUID, uuid4

from growth.adapters.llm.agent_runner import run as run_agent
from growth.adapters.llm.client import ClaudeClient
from growth.adapters.llm.errors import AgentAPIError, AgentParseError, AgentTurnLimitError
from growth.adapters.llm.prompts.memo import (
    MEMO_PROMPT_VERSION,
    MEMO_SYSTEM_PROMPT,
    MEMO_TOOL_SCHEMAS,
)
from growth.adapters.llm.schemas import MemoOutput
from growth.domain.events import MemoCompleted, MemoFailed
from growth.domain.models import ProducerMemo
from growth.domain.policy_config import PolicyConfig
from growth.ports.event_log import EventLog
from growth.ports.repositories import (
    ExperimentRepository,
    FrameRepository,
    ProducerMemoRepository,
    SegmentRepository,
    ShowRepository,
)


class MemoRunError(Exception):
    """Raised when a memo run fails."""

    def __init__(self, message: str, run_id: UUID):
        self.run_id = run_id
        super().__init__(message)


@dataclass(frozen=True)
class MemoRunResult:
    """Result from a successful memo run."""

    run_id: UUID
    memo_id: UUID
    memo_output: MemoOutput
    turns_used: int
    total_input_tokens: int
    total_output_tokens: int


class MemoService:
    """Orchestrates a Memo Agent run end-to-end."""

    def __init__(
        self,
        claude_client: ClaudeClient,
        show_repo: ShowRepository,
        exp_repo: ExperimentRepository,
        seg_repo: SegmentRepository,
        frame_repo: FrameRepository,
        memo_repo: ProducerMemoRepository,
        event_log: EventLog,
        policy: PolicyConfig,
        runs_path: Path = Path("data/runs"),
    ):
        self._client = claude_client
        self._show_repo = show_repo
        self._exp_repo = exp_repo
        self._seg_repo = seg_repo
        self._frame_repo = frame_repo
        self._memo_repo = memo_repo
        self._event_log = event_log
        self._policy = policy
        self._runs_path = runs_path

    def run(self, show_id: UUID, cycle_start: datetime, cycle_end: datetime) -> MemoRunResult:
        """Run the Memo Agent for a show cycle."""
        show = self._show_repo.get_by_id(show_id)
        if show is None:
            raise ValueError(f"Show {show_id} not found")

        run_id = uuid4()
        run_dir = self._runs_path / str(run_id)
        run_dir.mkdir(parents=True, exist_ok=True)
        conversation_log = run_dir / "memo_conversation.jsonl"

        dispatcher = self._build_tool_dispatcher(show_id, cycle_start, cycle_end)

        user_message = (
            f"Write a producer memo for this show's experiment cycle:\n"
            f"- Show: {show.artist_name} at {show.venue}, {show.city}\n"
            f"- Cycle: {cycle_start.isoformat()} to {cycle_end.isoformat()}\n"
            f"- Show ID for tool calls: {show_id}\n\n"
            f"Start by calling get_show_details, then get_cycle_experiments, "
            f"then get_budget_status."
        )

        try:
            agent_result = run_agent(
                client=self._client,
                system_prompt=MEMO_SYSTEM_PROMPT,
                user_message=user_message,
                tools=MEMO_TOOL_SCHEMAS,
                tool_dispatcher=dispatcher,
                output_model=MemoOutput,
                max_turns=6,
                conversation_log_path=conversation_log,
            )
        except (AgentTurnLimitError, AgentParseError, AgentAPIError) as e:
            self._emit_failure(show_id, run_id, e)
            raise MemoRunError(str(e), run_id) from e

        memo_output = cast(MemoOutput, agent_result.output)

        # Persist memo
        memo_id = uuid4()
        memo = ProducerMemo(
            memo_id=memo_id,
            show_id=show_id,
            cycle_start=cycle_start,
            cycle_end=cycle_end,
            markdown=memo_output.markdown,
        )
        self._memo_repo.save(memo)

        # Write artifacts
        artifact = {
            **memo_output.model_dump(),
            "run_id": str(run_id),
            "memo_id": str(memo_id),
            "show_id": str(show_id),
            "model_name": self._client.model,
            "prompt_version": MEMO_PROMPT_VERSION,
            "turns_used": agent_result.turns_used,
            "total_input_tokens": agent_result.total_input_tokens,
            "total_output_tokens": agent_result.total_output_tokens,
        }
        (run_dir / "memo.json").write_text(json.dumps(artifact, indent=2, default=str))
        (run_dir / "memo.md").write_text(memo_output.markdown)

        # Emit success event
        self._event_log.append(
            MemoCompleted(
                event_id=uuid4(),
                occurred_at=datetime.now(timezone.utc),
                show_id=show_id,
                memo_id=memo_id,
                run_id=run_id,
                cycle_start=cycle_start.isoformat(),
                cycle_end=cycle_end.isoformat(),
                turns_used=agent_result.turns_used,
                total_input_tokens=agent_result.total_input_tokens,
                total_output_tokens=agent_result.total_output_tokens,
            )
        )

        return MemoRunResult(
            run_id=run_id,
            memo_id=memo_id,
            memo_output=memo_output,
            turns_used=agent_result.turns_used,
            total_input_tokens=agent_result.total_input_tokens,
            total_output_tokens=agent_result.total_output_tokens,
        )

    def _build_tool_dispatcher(self, show_id: UUID, cycle_start: datetime, cycle_end: datetime):
        from growth.adapters.llm.memo_tools import get_cycle_experiments
        from growth.adapters.llm.strategy_tools import get_budget_status, get_show_details

        def dispatch(name: str, input: dict) -> dict:
            if name == "get_show_details":
                return get_show_details(
                    show_id=UUID(input["show_id"]),
                    show_repo=self._show_repo,
                )
            elif name == "get_cycle_experiments":
                return get_cycle_experiments(
                    show_id=UUID(input["show_id"]),
                    cycle_start=input.get("cycle_start", cycle_start.isoformat()),
                    cycle_end=input.get("cycle_end", cycle_end.isoformat()),
                    exp_repo=self._exp_repo,
                    seg_repo=self._seg_repo,
                    frame_repo=self._frame_repo,
                )
            elif name == "get_budget_status":
                return get_budget_status(
                    show_id=UUID(input["show_id"]),
                    show_repo=self._show_repo,
                    exp_repo=self._exp_repo,
                    policy=self._policy,
                )
            else:
                return {"error": f"Unknown tool: {name}"}

        return dispatch

    def _emit_failure(self, show_id: UUID, run_id: UUID, error: Exception) -> None:
        self._event_log.append(
            MemoFailed(
                event_id=uuid4(),
                occurred_at=datetime.now(timezone.utc),
                show_id=show_id,
                run_id=run_id,
                error_type=type(error).__name__,
                error_message=str(error),
            )
        )
```

**Step 4: Run test**

Run: `python -m pytest tests/app/test_memo_service.py -v`

Expected: All PASS.

**Step 5: Commit**

```bash
git add src/growth/app/services/memo_service.py tests/app/test_memo_service.py
git commit -m "feat: add Memo Agent service"
```

---

### Task 12: Memo API endpoint and wiring

**Files:**
- Create: `src/growth/app/api/memo.py`
- Modify: `src/growth/app/api/app.py`
- Modify: `src/growth/app/container.py`
- Test: `tests/api/test_memo.py` (new)

**Step 1: Write failing API test**

Create `tests/api/test_memo.py`:

```python
"""Tests for the Memo API endpoint."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from growth.adapters.llm.result import AgentResult
from growth.adapters.llm.schemas import MemoOutput
from growth.app.api.app import create_app
from growth.app.container import Container


VALID_MEMO_OUTPUT = MemoOutput(
    what_worked="Instagram Reels targeting indie fans drove 5 purchases at $10 CAC with strong engagement",
    what_failed="No experiments failed this cycle — all showed positive early signal from the market",
    cost_per_seat_cents=1000,
    cost_per_seat_explanation="Total spend $50 / 5 purchases = $10 per seat blended",
    next_three_tests=["Test TikTok targeting 18-24 in Austin"],
    policy_exceptions=None,
    markdown="# Cycle Report\n\n## What Worked\n\nIndie fans responded well to intimate venue framing.",
    reasoning_summary="Single-experiment cycle focused on validating the indie fan segment.",
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
    container.close()


def _create_show(client) -> str:
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
    return resp.json()["show_id"]


class TestMemoAPI:
    @patch("growth.app.services.memo_service.run_agent")
    def test_run_memo_success(self, mock_run_agent, client):
        show_id = _create_show(client)

        mock_run_agent.return_value = AgentResult(
            output=VALID_MEMO_OUTPUT,
            turns_used=4,
            total_input_tokens=800,
            total_output_tokens=500,
        )

        resp = client.post(
            f"/api/memo/{show_id}/run",
            params={
                "cycle_start": "2026-02-15T00:00:00Z",
                "cycle_end": "2026-02-22T00:00:00Z",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "memo_id" in data
        assert data["cost_per_seat_cents"] == 1000
        assert "reasoning_summary" in data

    def test_run_memo_show_not_found(self, client):
        resp = client.post(
            f"/api/memo/{uuid4()}/run",
            params={
                "cycle_start": "2026-02-15T00:00:00Z",
                "cycle_end": "2026-02-22T00:00:00Z",
            },
        )
        assert resp.status_code == 404

    def test_run_memo_missing_params(self, client):
        show_id = _create_show(client)
        resp = client.post(f"/api/memo/{show_id}/run")
        assert resp.status_code == 422
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/api/test_memo.py -v`

Expected: Failure — memo route doesn't exist.

**Step 3: Create the API route**

Create `src/growth/app/api/memo.py`:

```python
"""Memo Agent API endpoint."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request

from growth.app.services.memo_service import MemoRunError

router = APIRouter()


@router.post("/{show_id}/run")
def run_memo(
    show_id: UUID,
    request: Request,
    cycle_start: datetime = Query(..., description="ISO timestamp for cycle start"),
    cycle_end: datetime = Query(..., description="ISO timestamp for cycle end"),
):
    if cycle_start >= cycle_end:
        raise HTTPException(status_code=422, detail="cycle_start must be before cycle_end")

    container = request.app.state.container
    service = container.memo_service()

    try:
        result = service.run(show_id, cycle_start, cycle_end)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except MemoRunError as e:
        raise HTTPException(status_code=502, detail={
            "error": str(e),
            "run_id": str(e.run_id),
        })

    return {
        "run_id": str(result.run_id),
        "memo_id": str(result.memo_id),
        "what_worked": result.memo_output.what_worked,
        "what_failed": result.memo_output.what_failed,
        "cost_per_seat_cents": result.memo_output.cost_per_seat_cents,
        "cost_per_seat_explanation": result.memo_output.cost_per_seat_explanation,
        "next_three_tests": result.memo_output.next_three_tests,
        "policy_exceptions": result.memo_output.policy_exceptions,
        "reasoning_summary": result.memo_output.reasoning_summary,
        "turns_used": result.turns_used,
        "total_input_tokens": result.total_input_tokens,
        "total_output_tokens": result.total_output_tokens,
    }
```

**Step 4: Add container wiring**

In `src/growth/app/container.py`, add:

```python
def memo_service(self):
    from growth.app.services.memo_service import MemoService
    return MemoService(
        claude_client=self.claude_client(),
        show_repo=self.show_repo(),
        exp_repo=self.experiment_repo(),
        seg_repo=self.segment_repo(),
        frame_repo=self.frame_repo(),
        memo_repo=self.memo_repo(),
        event_log=self.event_log(),
        policy=self.policy_config(),
        runs_path=self._runs_path,
    )
```

**Step 5: Register the router**

In `src/growth/app/api/app.py`, add after the creative router:

```python
from growth.app.api.memo import router as memo_router
app.include_router(memo_router, prefix="/api/memo", tags=["memo"])
```

**Step 6: Run test**

Run: `python -m pytest tests/api/test_memo.py -v`

Expected: All PASS.

**Step 7: Run full test suite**

Run: `python -m pytest tests/ -v`

Expected: All pass.

**Step 8: Commit**

```bash
git add src/growth/app/api/memo.py src/growth/app/api/app.py src/growth/app/container.py tests/api/test_memo.py
git commit -m "feat: add Memo Agent API endpoint and container wiring"
```

---

### Task 13: Final verification

**Step 1: Run full test suite**

Run: `python -m pytest tests/ -v --tb=short`

Expected: All tests pass.

**Step 2: Verify API startup**

Run: `python -c "from growth.app.api.app import create_app; app = create_app(); print('OK')"` (or check the health endpoint if you can start the server)

Expected: No import errors, app creates successfully.

**Step 3: Commit design doc**

```bash
git add docs/plans/2026-02-23-creative-memo-agents-design.md docs/plans/2026-02-23-creative-memo-agents-impl.md docs/plans/creative-memo-feedback.md
git commit -m "docs: add creative and memo agents design and implementation plan"
```
