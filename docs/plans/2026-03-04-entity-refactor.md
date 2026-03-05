# Entity Refactor: Experiment → Experiment + ExperimentRun

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split the current `Experiment` entity into a show-scoped `Experiment` (definition) and a cycle-scoped `ExperimentRun` (execution), so that lifecycle state, observations, and decisions attach to runs rather than to the definition.

**Architecture:** Backend follows the existing hexagonal pattern (domain → ports → adapters → app). `ExperimentRun` gets its own domain model, ORM table, repository protocol, repository implementation, and API router. `Observation` and `Decision` FKs change from `experiment_id` to `run_id`. Frontend adds a `runs` feature module and updates `getCycleProgress` + `useOverviewSnapshot` to be run-centric.

**Tech Stack:** Python/FastAPI/SQLAlchemy (backend), Next.js/TypeScript/React Query/MSW (frontend)

---

## Context

**Current problem:** `Experiment` carries both definition fields (`segment_id`, `frame_id`, `channel`, `baseline_snapshot`) _and_ lifecycle state (`status`, `start_time`, `end_time`). Observations and decisions FK directly to `experiment_id`. This means:
- You can't re-run an experiment in a new cycle without cloning the whole entity
- Cycle pages must load all-show experiments and filter by `cycle_id`, which is ambiguous
- "This experiment is from cycle 1 but active in cycle 2" has no clean model

**After refactor:**
- `Experiment` = reusable show-scoped definition (no status)
- `ExperimentRun` = cycle-scoped execution instance (has status, time, observations, decisions)
- Cycle pages fetch `GET /api/runs?cycle_id=` — unambiguous

**Fresh DB:** This is a schema-breaking change. Delete `data/growth.db` before running.

---

## Implementation Order

Backend → OpenAPI schema regen → Frontend

---

## Task 1: Update Domain Models

**Files:**
- Modify: `src/growth/domain/models.py`

**Step 1: Write the failing test**

```python
# tests/test_domain_models.py  (create this file)
from uuid import uuid4
from growth.domain.models import Experiment, ExperimentRun, RunStatus, Observation, Decision


def test_experiment_has_no_status():
    exp = Experiment(
        experiment_id=uuid4(),
        show_id=uuid4(),
        origin_cycle_id=uuid4(),
        segment_id=uuid4(),
        frame_id=uuid4(),
        channel="meta",
        objective="ticket_sales",
        budget_cap_cents=5000,
        baseline_snapshot={},
    )
    assert not hasattr(exp, "status")
    assert not hasattr(exp, "start_time")
    assert not hasattr(exp, "end_time")
    assert exp.origin_cycle_id is not None


def test_experiment_run_has_status():
    run = ExperimentRun(
        run_id=uuid4(),
        experiment_id=uuid4(),
        cycle_id=uuid4(),
        status=RunStatus.DRAFT,
        start_time=None,
        end_time=None,
    )
    assert run.status == RunStatus.DRAFT


def test_observation_has_run_id():
    from datetime import datetime, timezone
    obs = Observation(
        observation_id=uuid4(),
        run_id=uuid4(),
        window_start=datetime(2026, 4, 1, tzinfo=timezone.utc),
        window_end=datetime(2026, 4, 2, tzinfo=timezone.utc),
        spend_cents=1000,
        impressions=5000,
        clicks=100,
        sessions=90,
        checkouts=10,
        purchases=3,
        revenue_cents=12000,
        refunds=0,
        refund_cents=0,
        complaints=0,
        negative_comment_rate=None,
        attribution_model="last_click_utm",
        raw_json={},
    )
    assert hasattr(obs, "run_id")
    assert not hasattr(obs, "experiment_id")


def test_decision_has_run_id():
    from growth.domain.models import DecisionAction
    d = Decision(
        decision_id=uuid4(),
        run_id=uuid4(),
        action=DecisionAction.SCALE,
        confidence=0.8,
        rationale="good",
        policy_version="v1",
        metrics_snapshot={},
    )
    assert hasattr(d, "run_id")
    assert not hasattr(d, "experiment_id")
```

**Step 2: Run to verify it fails**

```bash
pytest tests/test_domain_models.py -v
```
Expected: FAIL with `ImportError` or `AttributeError`

**Step 3: Update `src/growth/domain/models.py`**

Replace the `ExperimentStatus` enum → `RunStatus` (same values). Add `ExperimentRun`. Update `Experiment`, `Observation`, `Decision`.

```python
# In src/growth/domain/models.py, make these changes:

# 1. Rename ExperimentStatus → RunStatus (keep same values)
class RunStatus(str, Enum):
    DRAFT = "draft"
    AWAITING_APPROVAL = "awaiting_approval"
    ACTIVE = "active"
    DECIDED = "decided"

# Add backward-compat alias (remove after all callers updated)
ExperimentStatus = RunStatus

# 2. Update Experiment dataclass — remove status/start_time/end_time, rename cycle_id → origin_cycle_id
@dataclass(frozen=True)
class Experiment:
    experiment_id: UUID
    show_id: UUID
    origin_cycle_id: UUID          # was: cycle_id (nullable); now required
    segment_id: UUID
    frame_id: UUID
    channel: str
    objective: str
    budget_cap_cents: int
    baseline_snapshot: dict[str, Any]
    # REMOVED: status, start_time, end_time

# 3. Add ExperimentRun dataclass
@dataclass(frozen=True)
class ExperimentRun:
    run_id: UUID
    experiment_id: UUID
    cycle_id: UUID
    status: RunStatus
    start_time: datetime | None
    end_time: datetime | None
    budget_cap_cents_override: int | None = None
    channel_config: dict[str, Any] = field(default_factory=dict)
    variant_snapshot: dict[str, Any] = field(default_factory=dict)

# 4. Update Observation — experiment_id → run_id
@dataclass(frozen=True)
class Observation:
    observation_id: UUID
    run_id: UUID               # was: experiment_id
    # ... rest unchanged

# 5. Update Decision — experiment_id → run_id
@dataclass(frozen=True)
class Decision:
    decision_id: UUID
    run_id: UUID               # was: experiment_id
    # ... rest unchanged
```

**Step 4: Run tests to verify they pass**

```bash
pytest tests/test_domain_models.py -v
```
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add tests/test_domain_models.py src/growth/domain/models.py
git commit -m "feat(domain): add ExperimentRun model, rename RunStatus, move FKs to run_id"
```

---

## Task 2: Update ORM Models

**Files:**
- Modify: `src/growth/adapters/orm.py`

**Step 1: Write the failing test**

```python
# tests/test_orm_models.py  (create this file)
from growth.adapters.orm import (
    ExperimentORM, ExperimentRunORM, ObservationORM, DecisionORM, Base
)
from sqlalchemy import inspect


def test_experiment_orm_has_origin_cycle_id():
    cols = {c.key for c in inspect(ExperimentORM).mapper.columns}
    assert "origin_cycle_id" in cols
    assert "status" not in cols
    assert "start_time" not in cols
    assert "end_time" not in cols
    assert "cycle_id" not in cols


def test_experiment_run_orm_exists():
    cols = {c.key for c in inspect(ExperimentRunORM).mapper.columns}
    assert "run_id" in cols
    assert "experiment_id" in cols
    assert "cycle_id" in cols
    assert "status" in cols


def test_observation_orm_fk_is_run_id():
    cols = {c.key for c in inspect(ObservationORM).mapper.columns}
    assert "run_id" in cols
    assert "experiment_id" not in cols


def test_decision_orm_fk_is_run_id():
    cols = {c.key for c in inspect(DecisionORM).mapper.columns}
    assert "run_id" in cols
    assert "experiment_id" not in cols
```

**Step 2: Run to verify it fails**

```bash
pytest tests/test_orm_models.py -v
```
Expected: FAIL

**Step 3: Update `src/growth/adapters/orm.py`**

```python
# 1. Update ExperimentORM
class ExperimentORM(Base):
    __tablename__ = "experiments"

    experiment_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    show_id: Mapped[str] = mapped_column(ForeignKey("shows.show_id"))
    origin_cycle_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("cycles.cycle_id")
    )                                              # was: cycle_id (nullable)
    segment_id: Mapped[str] = mapped_column(String(36))
    frame_id: Mapped[str] = mapped_column(String(36))
    channel: Mapped[str] = mapped_column(String(50))
    objective: Mapped[str] = mapped_column(String(100))
    budget_cap_cents: Mapped[int] = mapped_column(Integer)
    baseline_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON)
    # REMOVED: status, start_time, end_time

    show: Mapped["ShowORM"] = relationship(back_populates="experiments")
    runs: Mapped[list["ExperimentRunORM"]] = relationship(
        back_populates="experiment", cascade="all, delete-orphan"
    )
    # REMOVED: observations, decisions relationships (now on ExperimentRunORM)


# 2. Add ExperimentRunORM (new table)
class ExperimentRunORM(Base):
    __tablename__ = "experiment_runs"

    run_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    experiment_id: Mapped[str] = mapped_column(ForeignKey("experiments.experiment_id"))
    cycle_id: Mapped[str] = mapped_column(String(36), ForeignKey("cycles.cycle_id"))
    status: Mapped[str] = mapped_column(String(50))
    start_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    budget_cap_cents_override: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    channel_config: Mapped[dict[str, Any]] = mapped_column(JSON)
    variant_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON)

    experiment: Mapped["ExperimentORM"] = relationship(back_populates="runs")
    observations: Mapped[list["ObservationORM"]] = relationship(
        back_populates="run", cascade="all, delete-orphan"
    )
    decisions: Mapped[list["DecisionORM"]] = relationship(
        back_populates="run", cascade="all, delete-orphan"
    )


# 3. Update ObservationORM — experiment_id → run_id FK
class ObservationORM(Base):
    __tablename__ = "observations"

    observation_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    run_id: Mapped[str] = mapped_column(ForeignKey("experiment_runs.run_id"))  # was experiment_id
    # ... all other columns unchanged ...

    run: Mapped["ExperimentRunORM"] = relationship(back_populates="observations")
    # REMOVED: experiment relationship


# 4. Update DecisionORM — experiment_id → run_id FK
class DecisionORM(Base):
    __tablename__ = "decisions"

    decision_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    run_id: Mapped[str] = mapped_column(ForeignKey("experiment_runs.run_id"))  # was experiment_id
    # ... all other columns unchanged ...

    run: Mapped["ExperimentRunORM"] = relationship(back_populates="decisions")
    # REMOVED: experiment relationship
```

**Step 4: Run tests**

```bash
pytest tests/test_orm_models.py -v
```
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add tests/test_orm_models.py src/growth/adapters/orm.py
git commit -m "feat(orm): add ExperimentRunORM, move obs/decision FKs to run_id"
```

---

## Task 3: Update Repository Protocol + Implementation

**Files:**
- Modify: `src/growth/ports/repositories.py`
- Modify: `src/growth/adapters/repositories.py`

**Step 1: Write the failing test**

```python
# tests/test_repositories.py  (create this file)
import pytest
from uuid import uuid4
from datetime import datetime, timezone
from growth.adapters.orm import get_engine, create_tables, get_session_maker
from growth.adapters.repositories import (
    SQLAlchemyExperimentRepository,
    SQLAlchemyExperimentRunRepository,
)
from growth.domain.models import Experiment, ExperimentRun, RunStatus, Observation, Decision, DecisionAction


@pytest.fixture
def session(tmp_path):
    engine = get_engine(f"sqlite:///{tmp_path}/test.db")
    create_tables(engine)
    Session = get_session_maker(engine)
    s = Session()
    yield s
    s.close()


def _make_experiment(show_id, origin_cycle_id):
    return Experiment(
        experiment_id=uuid4(),
        show_id=show_id,
        origin_cycle_id=origin_cycle_id,
        segment_id=uuid4(),
        frame_id=uuid4(),
        channel="meta",
        objective="ticket_sales",
        budget_cap_cents=5000,
        baseline_snapshot={},
    )


def _make_run(experiment_id, cycle_id):
    return ExperimentRun(
        run_id=uuid4(),
        experiment_id=experiment_id,
        cycle_id=cycle_id,
        status=RunStatus.DRAFT,
        start_time=None,
        end_time=None,
    )


def test_experiment_repo_save_and_get(session):
    # Need a show and cycle in DB first (foreign keys)
    from growth.adapters.orm import ShowORM, CycleORM
    show_id = uuid4()
    cycle_id = uuid4()
    session.add(ShowORM(
        show_id=str(show_id), artist_name="A", city="B", venue="C",
        show_time=datetime(2026, 5, 1), timezone="UTC",
        capacity=100, tickets_total=100, tickets_sold=0
    ))
    session.add(CycleORM(
        cycle_id=str(cycle_id), show_id=str(show_id),
        started_at=datetime(2026, 1, 1)
    ))
    session.commit()

    repo = SQLAlchemyExperimentRepository(session)
    exp = _make_experiment(show_id, cycle_id)
    repo.save(exp)

    fetched = repo.get_by_id(exp.experiment_id)
    assert fetched is not None
    assert fetched.origin_cycle_id == exp.origin_cycle_id
    assert not hasattr(fetched, "status")


def test_run_repo_save_get_by_cycle(session):
    from growth.adapters.orm import ShowORM, CycleORM
    show_id = uuid4()
    cycle_id = uuid4()
    session.add(ShowORM(
        show_id=str(show_id), artist_name="A", city="B", venue="C",
        show_time=datetime(2026, 5, 1), timezone="UTC",
        capacity=100, tickets_total=100, tickets_sold=0
    ))
    session.add(CycleORM(
        cycle_id=str(cycle_id), show_id=str(show_id),
        started_at=datetime(2026, 1, 1)
    ))
    session.commit()

    exp_repo = SQLAlchemyExperimentRepository(session)
    exp = _make_experiment(show_id, cycle_id)
    exp_repo.save(exp)

    run_repo = SQLAlchemyExperimentRunRepository(session)
    run = _make_run(exp.experiment_id, cycle_id)
    run_repo.save(run)

    runs = run_repo.get_by_cycle(cycle_id)
    assert len(runs) == 1
    assert runs[0].run_id == run.run_id


def test_run_repo_observations_use_run_id(session):
    from growth.adapters.orm import ShowORM, CycleORM
    show_id = uuid4()
    cycle_id = uuid4()
    session.add(ShowORM(
        show_id=str(show_id), artist_name="A", city="B", venue="C",
        show_time=datetime(2026, 5, 1), timezone="UTC",
        capacity=100, tickets_total=100, tickets_sold=0
    ))
    session.add(CycleORM(
        cycle_id=str(cycle_id), show_id=str(show_id),
        started_at=datetime(2026, 1, 1)
    ))
    session.commit()

    exp_repo = SQLAlchemyExperimentRepository(session)
    exp = _make_experiment(show_id, cycle_id)
    exp_repo.save(exp)

    run_repo = SQLAlchemyExperimentRunRepository(session)
    run = _make_run(exp.experiment_id, cycle_id)
    run_repo.save(run)

    obs = Observation(
        observation_id=uuid4(),
        run_id=run.run_id,
        window_start=datetime(2026, 4, 1, tzinfo=timezone.utc),
        window_end=datetime(2026, 4, 2, tzinfo=timezone.utc),
        spend_cents=1000,
        impressions=5000,
        clicks=100,
        sessions=90,
        checkouts=10,
        purchases=3,
        revenue_cents=12000,
        refunds=0, refund_cents=0, complaints=0,
        negative_comment_rate=None,
        attribution_model="last_click_utm",
        raw_json={},
    )
    run_repo.add_observation(obs)

    fetched = run_repo.get_observations(run.run_id)
    assert len(fetched) == 1
    assert fetched[0].run_id == run.run_id
```

**Step 2: Run to verify it fails**

```bash
pytest tests/test_repositories.py -v
```
Expected: FAIL

**Step 3: Update `src/growth/ports/repositories.py`**

```python
# Add ExperimentRun import
from growth.domain.models import (
    ..., ExperimentRun, ...
)

# Update ExperimentRepository — remove obs/decision methods
class ExperimentRepository(Protocol):
    def get_by_id(self, experiment_id: UUID) -> Experiment | None: ...
    def save(self, experiment: Experiment) -> None: ...
    def get_by_show(self, show_id: UUID) -> list[Experiment]: ...
    # REMOVED: add_observation, get_observations, save_decision, get_decisions

# Add ExperimentRunRepository
class ExperimentRunRepository(Protocol):
    def get_by_id(self, run_id: UUID) -> ExperimentRun | None: ...
    def save(self, run: ExperimentRun) -> None: ...
    def get_by_cycle(self, cycle_id: UUID) -> list[ExperimentRun]: ...
    def get_by_experiment(self, experiment_id: UUID) -> list[ExperimentRun]: ...
    def add_observation(self, observation: Observation) -> None: ...
    def get_observations(self, run_id: UUID) -> list[Observation]: ...
    def save_decision(self, decision: Decision) -> None: ...
    def get_decisions(self, run_id: UUID) -> list[Decision]: ...
```

**Step 4: Update `src/growth/adapters/repositories.py`**

Follow the existing `_X_to_domain()` / `_X_to_orm()` pattern:

```python
# Add to imports
from growth.domain.models import ExperimentRun, RunStatus
from growth.adapters.orm import ExperimentRunORM

# Update _experiment_to_orm() — remove status/start_time/end_time, use origin_cycle_id
def _experiment_to_orm(exp: Experiment) -> ExperimentORM:
    return ExperimentORM(
        experiment_id=str(exp.experiment_id),
        show_id=str(exp.show_id),
        origin_cycle_id=str(exp.origin_cycle_id),
        segment_id=str(exp.segment_id),
        frame_id=str(exp.frame_id),
        channel=exp.channel,
        objective=exp.objective,
        budget_cap_cents=exp.budget_cap_cents,
        baseline_snapshot=exp.baseline_snapshot,
    )

# Update _experiment_to_domain()
def _experiment_to_domain(row: ExperimentORM) -> Experiment:
    return Experiment(
        experiment_id=UUID(row.experiment_id),
        show_id=UUID(row.show_id),
        origin_cycle_id=UUID(row.origin_cycle_id),
        segment_id=UUID(row.segment_id),
        frame_id=UUID(row.frame_id),
        channel=row.channel,
        objective=row.objective,
        budget_cap_cents=row.budget_cap_cents,
        baseline_snapshot=row.baseline_snapshot or {},
    )

# Update SQLAlchemyExperimentRepository — remove obs/decision methods
class SQLAlchemyExperimentRepository:
    def __init__(self, session: Session): ...
    def get_by_id(self, experiment_id: UUID) -> Experiment | None: ...
    def save(self, experiment: Experiment) -> None: ...
    def get_by_show(self, show_id: UUID) -> list[Experiment]: ...
    # REMOVED: add_observation, get_observations, save_decision, get_decisions

# Add _run_to_domain(), _run_to_orm()
def _run_to_orm(run: ExperimentRun) -> ExperimentRunORM:
    return ExperimentRunORM(
        run_id=str(run.run_id),
        experiment_id=str(run.experiment_id),
        cycle_id=str(run.cycle_id),
        status=run.status.value,
        start_time=run.start_time,
        end_time=run.end_time,
        budget_cap_cents_override=run.budget_cap_cents_override,
        channel_config=run.channel_config,
        variant_snapshot=run.variant_snapshot,
    )

def _run_to_domain(row: ExperimentRunORM) -> ExperimentRun:
    return ExperimentRun(
        run_id=UUID(row.run_id),
        experiment_id=UUID(row.experiment_id),
        cycle_id=UUID(row.cycle_id),
        status=RunStatus(row.status),
        start_time=row.start_time.replace(tzinfo=timezone.utc) if row.start_time else None,
        end_time=row.end_time.replace(tzinfo=timezone.utc) if row.end_time else None,
        budget_cap_cents_override=row.budget_cap_cents_override,
        channel_config=row.channel_config or {},
        variant_snapshot=row.variant_snapshot or {},
    )

# Observation and Decision mapping: experiment_id field → run_id
# Update _observation_to_domain / _observation_to_orm to use run_id
# Update _decision_to_domain / _decision_to_orm to use run_id

# Add SQLAlchemyExperimentRunRepository
class SQLAlchemyExperimentRunRepository:
    def __init__(self, session: Session):
        self._session = session

    def get_by_id(self, run_id: UUID) -> ExperimentRun | None:
        row = self._session.get(ExperimentRunORM, str(run_id))
        return _run_to_domain(row) if row else None

    def save(self, run: ExperimentRun) -> None:
        existing = self._session.get(ExperimentRunORM, str(run.run_id))
        if existing:
            row = _run_to_orm(run)
            for col in ("status", "start_time", "end_time", "budget_cap_cents_override",
                        "channel_config", "variant_snapshot"):
                setattr(existing, col, getattr(row, col))
        else:
            self._session.add(_run_to_orm(run))
        self._session.commit()

    def get_by_cycle(self, cycle_id: UUID) -> list[ExperimentRun]:
        rows = (
            self._session.query(ExperimentRunORM)
            .filter(ExperimentRunORM.cycle_id == str(cycle_id))
            .all()
        )
        return [_run_to_domain(r) for r in rows]

    def get_by_experiment(self, experiment_id: UUID) -> list[ExperimentRun]:
        rows = (
            self._session.query(ExperimentRunORM)
            .filter(ExperimentRunORM.experiment_id == str(experiment_id))
            .all()
        )
        return [_run_to_domain(r) for r in rows]

    def add_observation(self, observation: Observation) -> None:
        self._session.add(_observation_to_orm(observation))
        self._session.commit()

    def get_observations(self, run_id: UUID) -> list[Observation]:
        rows = (
            self._session.query(ObservationORM)
            .filter(ObservationORM.run_id == str(run_id))
            .order_by(ObservationORM.window_start.asc())
            .all()
        )
        return [_observation_to_domain(r) for r in rows]

    def save_decision(self, decision: Decision) -> None:
        self._session.add(_decision_to_orm(decision))
        self._session.commit()

    def get_decisions(self, run_id: UUID) -> list[Decision]:
        rows = (
            self._session.query(DecisionORM)
            .filter(DecisionORM.run_id == str(run_id))
            .order_by(DecisionORM.created_at.desc() if hasattr(DecisionORM, "created_at") else DecisionORM.decision_id)
            .all()
        )
        return [_decision_to_domain(r) for r in rows]
```

**Step 5: Run tests**

```bash
pytest tests/test_repositories.py -v
```
Expected: PASS (4 tests)

**Step 6: Commit**

```bash
git add tests/test_repositories.py src/growth/ports/repositories.py src/growth/adapters/repositories.py
git commit -m "feat(repo): add ExperimentRunRepository, move obs/decision methods to run repo"
```

---

## Task 4: Update Pydantic Schemas

**Files:**
- Modify: `src/growth/app/schemas.py`

**What changes:**
- `ExperimentCreate`: `cycle_id` → `origin_cycle_id` (required, not optional)
- `ExperimentResponse`: remove `status`/`start_time`/`end_time`, rename `cycle_id` → `origin_cycle_id`
- `ObservationCreate` / `ObservationResponse`: `experiment_id` → `run_id`
- `DecisionResponse`: `experiment_id` → `run_id`
- Add `RunCreate`, `RunResponse`, `RunMetricsResponse`

**Step 1: No test for schemas directly; they're tested via API tests. Proceed to implementation.**

**Step 2: Update `src/growth/app/schemas.py`**

```python
# ExperimentCreate
class ExperimentCreate(BaseModel):
    show_id: UUID
    origin_cycle_id: UUID        # was: cycle_id
    segment_id: UUID
    frame_id: UUID
    channel: str = Field(min_length=1, max_length=50)
    objective: str = Field(default="ticket_sales", max_length=100)
    budget_cap_cents: int = Field(gt=0)
    baseline_snapshot: dict[str, Any] = Field(default_factory=dict)

# ExperimentResponse
class ExperimentResponse(BaseModel):
    experiment_id: UUID
    show_id: UUID
    origin_cycle_id: UUID        # was: cycle_id
    segment_id: UUID
    frame_id: UUID
    channel: str
    objective: str
    budget_cap_cents: int
    baseline_snapshot: dict[str, Any]
    # REMOVED: status, start_time, end_time

    @classmethod
    def from_domain(cls, exp: Experiment) -> "ExperimentResponse":
        return cls(
            experiment_id=exp.experiment_id,
            show_id=exp.show_id,
            origin_cycle_id=exp.origin_cycle_id,
            segment_id=exp.segment_id,
            frame_id=exp.frame_id,
            channel=exp.channel,
            objective=exp.objective,
            budget_cap_cents=exp.budget_cap_cents,
            baseline_snapshot=exp.baseline_snapshot,
        )

# RunCreate
class RunCreate(BaseModel):
    experiment_id: UUID
    cycle_id: UUID
    status: RunStatus = RunStatus.DRAFT
    budget_cap_cents_override: int | None = Field(default=None, gt=0)
    channel_config: dict[str, Any] = Field(default_factory=dict)
    variant_snapshot: dict[str, Any] = Field(default_factory=dict)

# RunResponse
class RunResponse(BaseModel):
    run_id: UUID
    experiment_id: UUID
    cycle_id: UUID
    status: str
    start_time: datetime | None
    end_time: datetime | None
    budget_cap_cents_override: int | None
    channel_config: dict[str, Any]
    variant_snapshot: dict[str, Any]

    @classmethod
    def from_domain(cls, run: ExperimentRun) -> "RunResponse":
        return cls(
            run_id=run.run_id,
            experiment_id=run.experiment_id,
            cycle_id=run.cycle_id,
            status=run.status.value,
            start_time=run.start_time,
            end_time=run.end_time,
            budget_cap_cents_override=run.budget_cap_cents_override,
            channel_config=run.channel_config,
            variant_snapshot=run.variant_snapshot,
        )

# RunMetricsResponse
class RunMetricsResponse(BaseModel):
    run_id: UUID
    total_spend_cents: int
    total_impressions: int
    total_clicks: int
    total_purchases: int
    total_revenue_cents: int
    windows_count: int
    ctr: float | None
    cpc_cents: float | None
    cpa_cents: float | None
    roas: float | None
    conversion_rate: float | None
    evidence_sufficient: bool

# ObservationCreate — experiment_id → run_id
class ObservationCreate(BaseModel):
    run_id: UUID                 # was: experiment_id
    window_start: datetime
    window_end: datetime
    # ... all metric fields unchanged ...

    @model_validator(mode="after")
    def window_end_after_start(self): ...

class ObservationBulkCreate(BaseModel):
    observations: list[ObservationCreate] = Field(min_length=1)

# ObservationResponse — experiment_id → run_id
class ObservationResponse(BaseModel):
    observation_id: UUID
    run_id: UUID                 # was: experiment_id
    # ... all other fields unchanged ...

# DecisionResponse — experiment_id → run_id
class DecisionResponse(BaseModel):
    decision_id: UUID
    run_id: UUID                 # was: experiment_id
    action: str
    confidence: float
    rationale: str
    policy_version: str
    metrics_snapshot: dict[str, Any]

    @classmethod
    def from_domain(cls, d: Decision) -> "DecisionResponse":
        return cls(
            decision_id=d.decision_id,
            run_id=d.run_id,
            action=d.action.value,
            confidence=d.confidence,
            rationale=d.rationale,
            policy_version=d.policy_version,
            metrics_snapshot=d.metrics_snapshot,
        )

# ExperimentMetrics → RunMetrics (keep old name as alias if other code references it)
# Can keep ExperimentMetrics for now, just add RunMetricsResponse
```

**Step 3: Commit**

```bash
git add src/growth/app/schemas.py
git commit -m "feat(schemas): update experiment/observation/decision schemas for run-based model"
```

---

## Task 5: Add /api/runs Endpoints

**Files:**
- Create: `src/growth/app/api/runs.py`
- Modify: `src/growth/app/api/experiments.py` (remove launch/request-reapproval/metrics)
- Modify: `src/growth/app/api/observations.py` (use run_id)
- Modify: `src/growth/app/api/decisions.py` (use run_id, evaluate by run_id)
- Modify: `src/growth/app/container.py` (add run_repo())
- Modify: `src/growth/app/api/app.py` (register runs router)

**Step 1: Write failing API tests**

```python
# tests/api/test_runs.py  (create this file)
from uuid import uuid4


def _create_show_and_experiment(client) -> tuple[str, str]:
    """Returns (show_id, experiment_id)."""
    show_resp = client.post("/api/shows", json={
        "artist_name": "Test Artist",
        "city": "Austin",
        "venue": "The Parish",
        "show_time": "2026-05-01T20:00:00Z",
        "timezone": "America/Chicago",
        "capacity": 200,
        "tickets_total": 200,
        "tickets_sold": 0,
    })
    show_id = show_resp.json()["show_id"]

    cycle_resp = client.post(f"/api/shows/{show_id}/cycles", json={})
    cycle_id = cycle_resp.json()["cycle_id"]

    exp_resp = client.post("/api/experiments", json={
        "show_id": show_id,
        "origin_cycle_id": cycle_id,
        "segment_id": str(uuid4()),
        "frame_id": str(uuid4()),
        "channel": "meta",
        "budget_cap_cents": 5000,
        "baseline_snapshot": {"cac_cents": 800, "conversion_rate": 0.02},
    })
    return show_id, exp_resp.json()["experiment_id"], cycle_id


class TestRunsAPI:
    def test_create_run(self, client):
        _, exp_id, cycle_id = _create_show_and_experiment(client)
        resp = client.post("/api/runs", json={
            "experiment_id": exp_id,
            "cycle_id": cycle_id,
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "draft"
        assert data["experiment_id"] == exp_id
        assert data["cycle_id"] == cycle_id
        assert "run_id" in data

    def test_list_runs_by_cycle(self, client):
        _, exp_id, cycle_id = _create_show_and_experiment(client)
        client.post("/api/runs", json={"experiment_id": exp_id, "cycle_id": cycle_id})
        client.post("/api/runs", json={"experiment_id": exp_id, "cycle_id": cycle_id})

        resp = client.get(f"/api/runs?cycle_id={cycle_id}")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_launch_run(self, client):
        _, exp_id, cycle_id = _create_show_and_experiment(client)
        run_resp = client.post("/api/runs", json={"experiment_id": exp_id, "cycle_id": cycle_id})
        run_id = run_resp.json()["run_id"]

        resp = client.post(f"/api/runs/{run_id}/launch")
        assert resp.status_code == 200
        assert resp.json()["status"] == "active"
        assert resp.json()["start_time"] is not None

    def test_request_reapproval(self, client):
        _, exp_id, cycle_id = _create_show_and_experiment(client)
        run_resp = client.post("/api/runs", json={"experiment_id": exp_id, "cycle_id": cycle_id})
        run_id = run_resp.json()["run_id"]

        resp = client.post(f"/api/runs/{run_id}/request-reapproval")
        assert resp.status_code == 200
        assert resp.json()["status"] == "awaiting_approval"

    def test_get_run_metrics(self, client):
        _, exp_id, cycle_id = _create_show_and_experiment(client)
        run_resp = client.post("/api/runs", json={"experiment_id": exp_id, "cycle_id": cycle_id})
        run_id = run_resp.json()["run_id"]
        client.post(f"/api/runs/{run_id}/launch")

        # Add observation
        client.post("/api/observations", json={
            "run_id": run_id,
            "window_start": "2026-04-01T00:00:00Z",
            "window_end": "2026-04-02T00:00:00Z",
            "spend_cents": 2500,
            "impressions": 10000,
            "clicks": 200,
            "sessions": 180,
            "checkouts": 20,
            "purchases": 8,
            "revenue_cents": 32000,
            "refunds": 0, "refund_cents": 0, "complaints": 0,
            "attribution_model": "last_click_utm",
        })

        resp = client.get(f"/api/runs/{run_id}/metrics")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_spend_cents"] == 2500
        assert data["run_id"] == run_id
```

**Step 2: Run to verify it fails**

```bash
pytest tests/api/test_runs.py -v
```
Expected: FAIL (404 on /api/runs)

**Step 3: Create `src/growth/app/api/runs.py`**

```python
"""ExperimentRun API routes."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Request

from growth.app.schemas import RunCreate, RunResponse, RunMetricsResponse
from growth.domain.models import ExperimentRun, RunStatus

router = APIRouter()

LAUNCHABLE_STATUSES = {RunStatus.DRAFT, RunStatus.AWAITING_APPROVAL}


def _get_run_repo(request: Request):
    return request.state.container.run_repo()


def _get_run_or_404(repo, run_id: UUID) -> ExperimentRun:
    run = repo.get_by_id(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


def _transition(run: ExperimentRun, **overrides) -> ExperimentRun:
    fields = {
        "run_id": run.run_id,
        "experiment_id": run.experiment_id,
        "cycle_id": run.cycle_id,
        "status": run.status,
        "start_time": run.start_time,
        "end_time": run.end_time,
        "budget_cap_cents_override": run.budget_cap_cents_override,
        "channel_config": run.channel_config,
        "variant_snapshot": run.variant_snapshot,
    }
    fields.update(overrides)
    return ExperimentRun(**fields)


@router.post("", status_code=201, response_model=RunResponse)
def create_run(body: RunCreate, request: Request):
    # Verify experiment exists
    exp = request.state.container.experiment_repo().get_by_id(body.experiment_id)
    if exp is None:
        raise HTTPException(status_code=404, detail="Experiment not found")

    repo = _get_run_repo(request)
    run = ExperimentRun(
        run_id=uuid4(),
        experiment_id=body.experiment_id,
        cycle_id=body.cycle_id,
        status=body.status,
        start_time=None,
        end_time=None,
        budget_cap_cents_override=body.budget_cap_cents_override,
        channel_config=body.channel_config,
        variant_snapshot=body.variant_snapshot,
    )
    repo.save(run)
    return RunResponse.from_domain(run)


@router.get("", response_model=list[RunResponse])
def list_runs(
    request: Request,
    cycle_id: UUID | None = None,
    experiment_id: UUID | None = None,
):
    repo = _get_run_repo(request)
    if cycle_id is not None:
        runs = repo.get_by_cycle(cycle_id)
    elif experiment_id is not None:
        runs = repo.get_by_experiment(experiment_id)
    else:
        raise HTTPException(status_code=400, detail="cycle_id or experiment_id required")
    return [RunResponse.from_domain(r) for r in runs]


@router.get("/{run_id}", response_model=RunResponse)
def get_run(run_id: UUID, request: Request):
    repo = _get_run_repo(request)
    run = _get_run_or_404(repo, run_id)
    return RunResponse.from_domain(run)


@router.post("/{run_id}/launch", response_model=RunResponse)
def launch_run(run_id: UUID, request: Request):
    """Transition draft or awaiting_approval -> active."""
    repo = _get_run_repo(request)
    run = _get_run_or_404(repo, run_id)
    if run.status not in LAUNCHABLE_STATUSES:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot launch from status {run.status.value}",
        )
    updated = _transition(
        run,
        status=RunStatus.ACTIVE,
        start_time=datetime.now(timezone.utc),
    )
    repo.save(updated)
    return RunResponse.from_domain(updated)


@router.post("/{run_id}/request-reapproval", response_model=RunResponse)
def request_reapproval(run_id: UUID, request: Request):
    """Transition draft -> awaiting_approval."""
    repo = _get_run_repo(request)
    run = _get_run_or_404(repo, run_id)
    if run.status != RunStatus.DRAFT:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot request reapproval from status {run.status.value}",
        )
    updated = _transition(run, status=RunStatus.AWAITING_APPROVAL)
    repo.save(updated)
    return RunResponse.from_domain(updated)


@router.get("/{run_id}/metrics", response_model=RunMetricsResponse)
def get_run_metrics(run_id: UUID, request: Request):
    container = request.state.container
    run = _get_run_or_404(container.run_repo(), run_id)
    observations = container.run_repo().get_observations(run_id)

    total_spend = sum(o.spend_cents for o in observations)
    total_impressions = sum(o.impressions for o in observations)
    total_clicks = sum(o.clicks for o in observations)
    total_purchases = sum(o.purchases for o in observations)
    total_revenue = sum(o.revenue_cents for o in observations)
    windows_count = len(observations)

    policy = container.policy_config()
    evidence_sufficient = (
        total_impressions >= policy.min_observations_impressions
        and total_spend >= policy.min_observations_spend_cents
        and windows_count >= 1
    )

    return RunMetricsResponse(
        run_id=run_id,
        total_spend_cents=total_spend,
        total_impressions=total_impressions,
        total_clicks=total_clicks,
        total_purchases=total_purchases,
        total_revenue_cents=total_revenue,
        windows_count=windows_count,
        ctr=total_clicks / total_impressions if total_impressions > 0 else None,
        cpc_cents=total_spend / total_clicks if total_clicks > 0 else None,
        cpa_cents=total_spend / total_purchases if total_purchases > 0 else None,
        roas=total_revenue / total_spend if total_spend > 0 else None,
        conversion_rate=total_purchases / total_clicks if total_clicks > 0 else None,
        evidence_sufficient=evidence_sufficient,
    )
```

**Step 4: Update `src/growth/app/api/experiments.py`**

Remove: `launch_experiment`, `request_reapproval`, `get_experiment_metrics`.
Update `create_experiment` to use `origin_cycle_id`.
Add 410 tombstones for removed endpoints so callers get clear guidance:

```python
@router.post("/{experiment_id}/launch", status_code=410)
def launch_experiment_deprecated(experiment_id: UUID):
    raise HTTPException(status_code=410, detail="Use POST /api/runs/{run_id}/launch")


@router.post("/{experiment_id}/request-reapproval", status_code=410)
def request_reapproval_deprecated(experiment_id: UUID):
    raise HTTPException(status_code=410, detail="Use POST /api/runs/{run_id}/request-reapproval")


@router.get("/{experiment_id}/metrics", status_code=410)
def metrics_deprecated(experiment_id: UUID):
    raise HTTPException(status_code=410, detail="Use GET /api/runs/{run_id}/metrics")
```

**Step 5: Update `src/growth/app/api/observations.py`**

Change `experiment_id` param to `run_id` everywhere:

```python
@router.post("", status_code=201, response_model=ObservationResponse)
def create_observation(body: ObservationCreate, request: Request):
    repo = request.state.container.run_repo()
    run = repo.get_by_id(body.run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    obs = Observation(
        observation_id=uuid4(),
        run_id=body.run_id,
        ...
    )
    repo.add_observation(obs)
    return ObservationResponse.from_domain(obs)


@router.get("", response_model=list[ObservationResponse])
def list_observations(run_id: UUID, request: Request):
    repo = request.state.container.run_repo()
    return [ObservationResponse.from_domain(o) for o in repo.get_observations(run_id)]
```

Bulk endpoint likewise uses `run_id` validation.

**Step 6: Update `src/growth/app/api/decisions.py`**

```python
@router.post("/evaluate/{run_id}", response_model=DecisionResponse)
def evaluate_run(run_id: UUID, request: Request):
    # DecisionService.evaluate_run(run_id)
    ...

@router.get("", response_model=list[DecisionResponse])
def list_decisions(run_id: UUID, request: Request):
    repo = request.state.container.run_repo()
    return [DecisionResponse.from_domain(d) for d in repo.get_decisions(run_id)]
```

**Step 7: Update `src/growth/app/container.py`**

```python
from growth.adapters.repositories import SQLAlchemyExperimentRunRepository

class SessionContainer:
    ...
    def run_repo(self) -> SQLAlchemyExperimentRunRepository:
        return SQLAlchemyExperimentRunRepository(self._session)
```

**Step 8: Register router in `src/growth/app/api/app.py`**

```python
from growth.app.api.runs import router as runs_router
app.include_router(runs_router, prefix="/api/runs", tags=["runs"])
```

**Step 9: Run tests**

```bash
pytest tests/api/test_runs.py -v
```
Expected: PASS

**Step 10: Commit**

```bash
git add src/growth/app/api/runs.py src/growth/app/api/experiments.py \
        src/growth/app/api/observations.py src/growth/app/api/decisions.py \
        src/growth/app/container.py src/growth/app/api/app.py \
        tests/api/test_runs.py
git commit -m "feat(api): add /api/runs endpoints, tombstone deprecated experiment lifecycle endpoints"
```

---

## Task 6: Update DecisionService + Backend Tests

**Files:**
- Modify: `src/growth/app/services/decision_service.py`
- Modify: `tests/api/test_observations.py`
- Modify: `tests/api/test_decisions.py`
- Modify: `tests/api/test_experiments.py`

**Step 1: Update `decision_service.py`**

The service now operates on `run_id` rather than `experiment_id`:

```python
class DecisionService:
    def __init__(self, run_repo, event_log, policy): ...

    def evaluate_run(self, run_id: UUID) -> Decision:
        run = self._run_repo.get_by_id(run_id)
        if run is None:
            raise ValueError(f"Run {run_id} not found")
        if run.status != RunStatus.ACTIVE:
            raise ValueError(f"Run must be ACTIVE, got {run.status.value}")

        observations = self._run_repo.get_observations(run_id)
        metrics = self._compute_metrics(observations)
        decision = self._policy.evaluate(run_id=run_id, metrics=metrics)

        self._run_repo.save_decision(decision)
        self._event_log.record(...)

        # Transition run to DECIDED
        updated = ExperimentRun(
            run_id=run.run_id,
            experiment_id=run.experiment_id,
            cycle_id=run.cycle_id,
            status=RunStatus.DECIDED,
            start_time=run.start_time,
            end_time=datetime.now(timezone.utc),
            budget_cap_cents_override=run.budget_cap_cents_override,
            channel_config=run.channel_config,
            variant_snapshot=run.variant_snapshot,
        )
        self._run_repo.save(updated)
        return decision
```

Update `decisions.py` route to call `decision_service.evaluate_run(run_id)`.

Update `container.py` `decision_service()` to pass `run_repo` instead of `experiment_repo`.

**Step 2: Update test helpers in test files**

In `test_observations.py` and `test_decisions.py`, replace the `_create_running_experiment` helper with `_create_active_run` that creates show → experiment → run → launch:

```python
def _create_active_run(client) -> tuple[str, str, str]:
    """Returns (show_id, experiment_id, run_id)."""
    show_resp = client.post("/api/shows", json={...})
    show_id = show_resp.json()["show_id"]

    cycle_resp = client.post(f"/api/shows/{show_id}/cycles", json={})
    cycle_id = cycle_resp.json()["cycle_id"]

    exp_resp = client.post("/api/experiments", json={
        "show_id": show_id,
        "origin_cycle_id": cycle_id,
        "segment_id": str(uuid4()),
        "frame_id": str(uuid4()),
        "channel": "meta",
        "budget_cap_cents": 5000,
        "baseline_snapshot": {"cac_cents": 800, "conversion_rate": 0.02},
    })
    exp_id = exp_resp.json()["experiment_id"]

    run_resp = client.post("/api/runs", json={
        "experiment_id": exp_id,
        "cycle_id": cycle_id,
    })
    run_id = run_resp.json()["run_id"]

    client.post(f"/api/runs/{run_id}/launch")
    return show_id, exp_id, run_id
```

Update all observation tests to use `run_id` in the POST body.
Update all decision tests to `POST /api/decisions/evaluate/{run_id}` and check `run_id` in response.

**Step 3: Update `test_experiments.py`**

- Remove test for `launch` (now 410)
- Remove test for `request-reapproval` (now 410)
- Update `ExperimentCreate` payloads: `cycle_id` → `origin_cycle_id`
- Update `ExperimentResponse` assertions: no `status`, no `start_time`

**Step 4: Run full backend test suite**

```bash
pytest tests/ -v
```
Expected: PASS. Fix any remaining failures before committing.

**Step 5: Commit**

```bash
git add src/growth/app/services/decision_service.py \
        tests/api/test_observations.py tests/api/test_decisions.py \
        tests/api/test_experiments.py
git commit -m "fix(tests): update API tests for run-based observation/decision model"
```

---

## Task 7: Regenerate OpenAPI Schema

The frontend uses a generated TypeScript schema from `frontend-v2/shared/api/generated/`. After backend API changes, regenerate it so the frontend has correct types.

**Step 1: Start the backend (using fresh DB)**

```bash
# Delete old DB to avoid schema conflicts
rm -f data/growth.db

# Start server
uvicorn growth.app.main:app --reload
```

**Step 2: Export OpenAPI JSON**

```bash
curl http://localhost:8000/openapi.json > frontend-v2/shared/api/generated/openapi.json
```

**Step 3: Regenerate TypeScript types**

Check `frontend-v2/package.json` for an `openapi` or `generate` script. If it exists, run it:

```bash
cd frontend-v2
npm run generate  # or whatever script exists
```

If no script exists, use `openapi-typescript`:

```bash
cd frontend-v2
npx openapi-typescript shared/api/generated/openapi.json -o shared/api/generated/schema.ts
```

**Step 4: Verify schema has new types**

Check that `frontend-v2/shared/api/generated/schema.ts` contains:
- `ExperimentRunResponse` or `RunResponse` schema
- `origin_cycle_id` in experiment schemas (not `cycle_id`)
- `run_id` in observation/decision schemas (not `experiment_id`)

**Step 5: Commit**

```bash
git add frontend-v2/shared/api/generated/
git commit -m "chore: regenerate OpenAPI schema after entity refactor"
```

---

## Task 8: Frontend — Add runs Feature Module

**Files:**
- Modify: `frontend-v2/shared/queryKeys.ts`
- Create: `frontend-v2/features/runs/api.ts`
- Create: `frontend-v2/features/runs/queries.ts`
- Create: `frontend-v2/features/runs/queries.test.ts`

**Step 1: Write failing test**

```typescript
// frontend-v2/features/runs/queries.test.ts
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { useRunsByCycle, useRun } from './queries'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const mockRun = {
  run_id: 'run-1',
  experiment_id: 'exp-1',
  cycle_id: 'cycle-1',
  status: 'draft',
  start_time: null,
  end_time: null,
  budget_cap_cents_override: null,
  channel_config: {},
  variant_snapshot: {},
}

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useRunsByCycle', () => {
  it('returns runs for a cycle', async () => {
    server.use(http.get(`${API_BASE_URL}/api/runs`, () => HttpResponse.json([mockRun])))
    const { result } = renderHook(() => useRunsByCycle('cycle-1'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].run_id).toBe('run-1')
  })

  it('is disabled when cycleId is empty', () => {
    const { result } = renderHook(() => useRunsByCycle(''), { wrapper: makeWrapper() })
    expect(result.current.isPending).toBe(true)
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('sets isError on server failure', async () => {
    server.use(http.get(`${API_BASE_URL}/api/runs`, () => HttpResponse.json({}, { status: 500 })))
    const { result } = renderHook(() => useRunsByCycle('cycle-1'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useRun', () => {
  it('fetches a single run by id', async () => {
    server.use(http.get(`${API_BASE_URL}/api/runs/run-1`, () => HttpResponse.json(mockRun)))
    const { result } = renderHook(() => useRun('run-1'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.run_id).toBe('run-1')
  })
})
```

**Step 2: Run to verify it fails**

```bash
cd frontend-v2 && npm run test -- features/runs/queries.test.ts
```
Expected: FAIL (module not found)

**Step 3: Add `runKeys` to `frontend-v2/shared/queryKeys.ts`**

```typescript
export const runKeys = {
  all: () => ['runs'] as const,
  listByCycle: (cycleId: string) => ['runs', 'list', 'cycle', cycleId] as const,
  listByExperiment: (experimentId: string) => ['runs', 'list', 'experiment', experimentId] as const,
  detail: (runId: string) => ['runs', 'detail', runId] as const,
  metrics: (runId: string) => ['runs', 'metrics', runId] as const,
} as const

// Add to the queryKeys aggregate:
export const queryKeys = {
  ...
  runs: runKeys,
  ...
} as const
```

**Step 4: Create `frontend-v2/features/runs/api.ts`**

```typescript
import { apiClient } from '@/shared/api/client'
import type { components } from '@/shared/api/generated/schema'

export type RunResponse = components['schemas']['RunResponse']
export type RunCreate = components['schemas']['RunCreate']

export async function listRunsByCycle(cycleId: string): Promise<RunResponse[]> {
  return apiClient.get('/api/runs', { query: { cycle_id: cycleId } }) as Promise<RunResponse[]>
}

export async function listRunsByExperiment(experimentId: string): Promise<RunResponse[]> {
  return apiClient.get('/api/runs', { query: { experiment_id: experimentId } }) as Promise<RunResponse[]>
}

export async function getRun(runId: string): Promise<RunResponse> {
  return apiClient.get('/api/runs/{run_id}', { path: { run_id: runId } }) as Promise<RunResponse>
}

export async function createRun(body: RunCreate): Promise<RunResponse> {
  return apiClient.post('/api/runs', { body }) as Promise<RunResponse>
}

export async function launchRun(runId: string): Promise<RunResponse> {
  return apiClient.post('/api/runs/{run_id}/launch', { path: { run_id: runId } }) as Promise<RunResponse>
}

export async function requestRunReapproval(runId: string): Promise<RunResponse> {
  return apiClient.post('/api/runs/{run_id}/request-reapproval', { path: { run_id: runId } }) as Promise<RunResponse>
}
```

**Step 5: Create `frontend-v2/features/runs/queries.ts`**

```typescript
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/shared/queryKeys'
import {
  listRunsByCycle,
  listRunsByExperiment,
  getRun,
  createRun,
  launchRun,
  requestRunReapproval,
  type RunCreate,
} from './api'

export function useRunsByCycle(cycleId: string) {
  return useQuery({
    queryKey: queryKeys.runs.listByCycle(cycleId),
    queryFn: () => listRunsByCycle(cycleId),
    enabled: !!cycleId,
  })
}

export function useRunsByExperiment(experimentId: string) {
  return useQuery({
    queryKey: queryKeys.runs.listByExperiment(experimentId),
    queryFn: () => listRunsByExperiment(experimentId),
    enabled: !!experimentId,
  })
}

export function useRun(runId: string) {
  return useQuery({
    queryKey: queryKeys.runs.detail(runId),
    queryFn: () => getRun(runId),
    enabled: !!runId,
  })
}

export function useCreateRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: RunCreate) => createRun(body),
    onSuccess: (run) => {
      qc.invalidateQueries({ queryKey: queryKeys.runs.listByCycle(run.cycle_id) })
      qc.invalidateQueries({ queryKey: queryKeys.runs.listByExperiment(run.experiment_id) })
    },
  })
}

export function useLaunchRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (runId: string) => launchRun(runId),
    onSuccess: (run) => {
      qc.invalidateQueries({ queryKey: queryKeys.runs.detail(run.run_id) })
      qc.invalidateQueries({ queryKey: queryKeys.runs.listByCycle(run.cycle_id) })
    },
  })
}

export function useRequestRunReapproval() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (runId: string) => requestRunReapproval(runId),
    onSuccess: (run) => {
      qc.invalidateQueries({ queryKey: queryKeys.runs.detail(run.run_id) })
      qc.invalidateQueries({ queryKey: queryKeys.runs.listByCycle(run.cycle_id) })
    },
  })
}
```

**Step 6: Run tests**

```bash
cd frontend-v2 && npm run test -- features/runs/queries.test.ts
```
Expected: PASS

**Step 7: Commit**

```bash
git add frontend-v2/shared/queryKeys.ts \
        frontend-v2/features/runs/api.ts \
        frontend-v2/features/runs/queries.ts \
        frontend-v2/features/runs/queries.test.ts
git commit -m "feat(frontend): add runs feature module with query hooks"
```

---

## Task 9: Frontend — Update Observations + Decisions Features

**Files:**
- Modify: `frontend-v2/features/observations/api.ts`
- Modify: `frontend-v2/features/observations/queries.ts`
- Modify: `frontend-v2/features/observations/queries.test.ts`
- Modify: `frontend-v2/features/decisions/api.ts`
- Modify: `frontend-v2/features/decisions/queries.ts`
- Modify: `frontend-v2/features/decisions/queries.test.ts`
- Modify: `frontend-v2/shared/queryKeys.ts` (update `observationKeys` and `decisionKeys`)

**Step 1: Update `observationKeys` and `decisionKeys` in `queryKeys.ts`**

```typescript
// Before:
export const observationKeys = {
  list: (experimentId: string) => ['observations', 'list', experimentId] as const,
  ...
}
export const decisionKeys = {
  list: (experimentId: string) => ['decisions', 'list', experimentId] as const,
}

// After — rename param to runId:
export const observationKeys = {
  all: () => ['observations'] as const,
  lists: () => ['observations', 'list'] as const,
  list: (runId: string) => ['observations', 'list', runId] as const,
  detail: (observationId: string) => ['observations', 'detail', observationId] as const,
} as const

export const decisionKeys = {
  all: () => ['decisions'] as const,
  lists: () => ['decisions', 'list'] as const,
  list: (runId: string) => ['decisions', 'list', runId] as const,
} as const
```

**Step 2: Update `frontend-v2/features/observations/api.ts`**

```typescript
export async function listObservations(runId: string): Promise<ObservationResponse[]> {
  return apiClient.get('/api/observations', {
    query: { run_id: runId },    // was: experiment_id
  }) as Promise<ObservationResponse[]>
}
```

**Step 3: Update `frontend-v2/features/observations/queries.ts`**

```typescript
export function useObservations(runId: string) {  // was: experimentId
  return useQuery({
    queryKey: queryKeys.observations.list(runId),
    queryFn: () => listObservations(runId),
    enabled: !!runId,
  })
}
```

**Step 4: Update `frontend-v2/features/observations/queries.test.ts`**

```typescript
const mockObservations = [{ observation_id: 'obs-1', run_id: 'run-1' }]  // was experiment_id

describe('useObservations', () => {
  it('returns observation list for a run', async () => {  // was "experiment"
    server.use(http.get(`${API_BASE_URL}/api/observations`, () => HttpResponse.json(mockObservations)))
    const { result } = renderHook(() => useObservations('run-1'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })

  it('is disabled when runId is empty', () => {  // was experimentId
    const { result } = renderHook(() => useObservations(''), { wrapper: makeWrapper() })
    expect(result.current.isPending).toBe(true)
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('sets isError on server failure', async () => {
    server.use(http.get(`${API_BASE_URL}/api/observations`, () => HttpResponse.json({}, { status: 500 })))
    const { result } = renderHook(() => useObservations('run-1'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
```

**Step 5: Update `frontend-v2/features/decisions/api.ts`**

```typescript
export async function listDecisions(runId: string): Promise<DecisionResponse[]> {
  return apiClient.get('/api/decisions', {
    query: { run_id: runId },    // was: experiment_id
  }) as Promise<DecisionResponse[]>
}
```

**Step 6: Update `frontend-v2/features/decisions/queries.ts`**

```typescript
export function useDecisions(runId: string) {  // was: experimentId
  return useQuery({
    queryKey: queryKeys.decisions.list(runId),
    queryFn: () => listDecisions(runId),
    enabled: !!runId,
  })
}
```

**Step 7: Update `frontend-v2/features/decisions/queries.test.ts`**

Update `experimentId` → `runId` everywhere. Update mock data to use `run_id` not `experiment_id`.

**Step 8: Run tests**

```bash
cd frontend-v2 && npm run test -- features/observations features/decisions
```
Expected: PASS

**Step 9: Commit**

```bash
git add frontend-v2/features/observations/ \
        frontend-v2/features/decisions/ \
        frontend-v2/shared/queryKeys.ts
git commit -m "feat(frontend): update observations/decisions features to use run_id"
```

---

## Task 10: Frontend — Update getCycleProgress + useOverviewSnapshot

**Files:**
- Modify: `frontend-v2/features/cycles/getCycleProgress.ts`
- Modify: `frontend-v2/features/overview/useOverviewSnapshot.ts`
- Modify any existing tests for `getCycleProgress`

**Step 1: Write failing test for `getCycleProgress`**

```typescript
// In the existing getCycleProgress test file (or create one at):
// frontend-v2/features/cycles/getCycleProgress.test.ts

import { getCycleProgress, type CycleProgressSnapshot } from './getCycleProgress'

const baseSnapshot: CycleProgressSnapshot = {
  segments: [],
  frames: [],
  variants: [],
  runs: [],          // new field — was experiments
  observations: [],
  memos: [],
}

describe('getCycleProgress with runs', () => {
  it('runComplete is false when no runs exist', () => {
    const progress = getCycleProgress({ ...baseSnapshot })
    expect(progress.runComplete).toBe(false)
  })

  it('runComplete is true when a run has active status', () => {
    const progress = getCycleProgress({
      ...baseSnapshot,
      segments: [{ segment_id: 'seg-1', review_status: 'approved' }],
      frames: [{ frame_id: 'f-1', review_status: 'approved' }],
      variants: [{ variant_id: 'v-1', frame_id: 'f-1', review_status: 'approved' }],
      runs: [{ run_id: 'run-1', experiment_id: 'exp-1', status: 'active' }],
    })
    expect(progress.runComplete).toBe(true)
  })

  it('resultsComplete uses run_id on observations (not experiment_id)', () => {
    const progress = getCycleProgress({
      ...baseSnapshot,
      segments: [{ segment_id: 'seg-1', review_status: 'approved' }],
      frames: [{ frame_id: 'f-1', review_status: 'approved' }],
      variants: [{ variant_id: 'v-1', frame_id: 'f-1', review_status: 'approved' }],
      runs: [{ run_id: 'run-1', experiment_id: 'exp-1', status: 'active' }],
      observations: [{ observation_id: 'obs-1', run_id: 'run-1' }],
    })
    expect(progress.resultsComplete).toBe(true)
  })

  it('resultsComplete is false when observations reference unknown run_id', () => {
    const progress = getCycleProgress({
      ...baseSnapshot,
      segments: [{ segment_id: 'seg-1', review_status: 'approved' }],
      frames: [{ frame_id: 'f-1', review_status: 'approved' }],
      variants: [{ variant_id: 'v-1', frame_id: 'f-1', review_status: 'approved' }],
      runs: [{ run_id: 'run-1', experiment_id: 'exp-1', status: 'active' }],
      observations: [{ observation_id: 'obs-1', run_id: 'run-UNKNOWN' }],
    })
    expect(progress.resultsComplete).toBe(false)
  })
})
```

**Step 2: Run to verify it fails**

```bash
cd frontend-v2 && npm run test -- features/cycles/getCycleProgress
```
Expected: FAIL (type errors or logic failures)

**Step 3: Update `frontend-v2/features/cycles/getCycleProgress.ts`**

```typescript
// Update CycleProgressSnapshot — replace experiments with runs
export interface CycleProgressSnapshot {
  segments: readonly SegmentSnapshot[]
  frames: readonly FrameSnapshot[]
  variants: readonly VariantSnapshot[]
  runs: readonly RunSnapshot[]              // was: experiments
  observations: readonly ObservationSnapshot[]
  memos: readonly MemoSnapshot[]
}

// Add RunSnapshot type (inline or imported from runs feature)
interface RunSnapshot {
  run_id: string
  experiment_id: string
  status: string  // 'draft' | 'awaiting_approval' | 'active' | 'decided'
}

// Update ObservationSnapshot — run_id not experiment_id
interface ObservationSnapshot {
  observation_id: string
  run_id: string             // was: experiment_id
}

// Update getCycleProgress logic
const LAUNCHED_STATUSES = new Set(['active', 'decided'])

export function getCycleProgress(snapshot: CycleProgressSnapshot): CycleProgress {
  const approvedFrameIds = new Set(
    snapshot.frames.filter(isApproved).map((f) => f.frame_id)
  )

  // was: launchedExperimentIds from experiments
  const launchedRunIds = new Set(
    snapshot.runs
      .filter((run) => LAUNCHED_STATUSES.has(run.status))
      .map((run) => run.run_id)
  )

  const planComplete =
    snapshot.segments.some(isApproved) && approvedFrameIds.size > 0

  const createComplete = snapshot.variants.some(
    (v) => isApproved(v) && approvedFrameIds.has(v.frame_id)
  )

  const runComplete = launchedRunIds.size > 0   // was: launchedExperimentIds

  const resultsComplete = snapshot.observations.some(
    (obs) => launchedRunIds.has(obs.run_id)     // was: launchedExperimentIds.has(obs.experiment_id)
  )

  const memoComplete = snapshot.memos.length > 0

  // ... rest of function unchanged (nextAction logic)
}
```

**Step 4: Update `frontend-v2/features/overview/useOverviewSnapshot.ts`**

```typescript
// Replace experimentsQuery with runsQuery
// Before:
const experimentsQuery = useQuery({
  queryKey: queryKeys.experiments.list(showId),
  queryFn: () => listExperiments(showId),
})
// ...
const allExperiments = experimentsQuery.data ?? []
const cycleExperiments = allExperiments.filter((e) => e.cycle_id === cycleId)
const observationQueries = useQueries({
  queries: cycleExperiments.map((experiment) => ({
    queryKey: queryKeys.observations.list(experiment.experiment_id),
    queryFn: () => listObservations(experiment.experiment_id),
    enabled: experimentsQuery.isSuccess,
  })),
})

// After:
const runsQuery = useQuery({
  queryKey: queryKeys.runs.listByCycle(cycleId),
  queryFn: () => listRunsByCycle(cycleId),
})
// ...
const runs = runsQuery.data ?? []
const observationQueries = useQueries({
  queries: runs.map((run) => ({
    queryKey: queryKeys.observations.list(run.run_id),
    queryFn: () => listObservations(run.run_id),
    enabled: runsQuery.isSuccess,
  })),
})

// Update phase1Queries to include runsQuery instead of experimentsQuery
// Update isPhase1Loading, isError checks accordingly

// Update snapshot composition:
if (canCompose) {
  snapshot = {
    segments: segmentsQuery.data ?? [],
    frames: framesQuery.data ?? [],
    variants: variantQueries.flatMap((q) => q.data ?? []),
    runs: runs,                          // was: experiments: cycleExperiments
    observations: observationQueries.flatMap((q) => q.data ?? []),
    memos: cycleMemos,
  }
}
```

**Step 5: Run tests**

```bash
cd frontend-v2 && npm run test -- features/cycles/getCycleProgress
```
Expected: PASS

**Step 6: Run full frontend test suite + build**

```bash
cd frontend-v2 && npm run test && npm run lint && npm run build
```
Expected: All pass. Fix any type errors or test failures.

**Step 7: Commit**

```bash
git add frontend-v2/features/cycles/getCycleProgress.ts \
        frontend-v2/features/cycles/getCycleProgress.test.ts \
        frontend-v2/features/overview/useOverviewSnapshot.ts
git commit -m "feat(frontend): update getCycleProgress and useOverviewSnapshot to use runs"
```

---

## Task 11: Update Frontend Manifest

**Files:**
- Modify: `docs/contracts/frontend-manifest.md`

Add the new `runs` feature to the manifest:

```markdown
| runs | in progress | ✓ | ✓ | ✓ | - |
```

Note the updated field names: `observationKeys.list(runId)`, `decisionKeys.list(runId)`.

```bash
git add docs/contracts/frontend-manifest.md
git commit -m "docs: update frontend manifest for runs feature and updated observation/decision keys"
```

---

## Final Verification

```bash
# Backend
pytest tests/ -v

# Frontend
cd frontend-v2
npm run test
npm run lint
npm run build
```

All tests must pass before this branch is considered complete.

---

## Open Questions / Follow-ups

1. **Memo generation**: `ProducerMemo` currently summarizes experiments. After this refactor, it should summarize runs in a cycle. Update LLM prompts in `src/growth/adapters/llm/` when implementing the Memo step.

2. **Experiment library page**: The design doc mentions a show-level "Experiment library" page. This is not implemented here — the focus is on making runs work correctly. Revisit after this refactor is stable.

3. **Existing runs in DB**: Because it's a fresh DB, there is no migration. Delete `data/growth.db` before running with the new code.

4. **`ExperimentStatus` alias**: The `ExperimentStatus = RunStatus` alias can be removed once all callers are updated.

5. **Events**: If `DecisionRecorded` or other events reference `experiment_id`, update them to reference `run_id`.
