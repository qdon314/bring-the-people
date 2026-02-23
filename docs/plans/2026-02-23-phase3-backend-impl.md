# Phase 3: Backend Implementation Plan

All backend changes required before the Next.js dashboard can be built. This plan covers exact file changes, data model additions, and task sequence. Implementors should work through tasks in order since later tasks depend on earlier ones.

**Parent design**: [`docs/plans/2026-02-23-phase3-dashboard.md`](2026-02-23-phase3-dashboard.md)

---

## Task 1: Cycle Domain Model and Table

**Why first**: `cycle_id` will be added as a FK on segments, frames, variants, experiments, and memos in later tasks. The `Cycle` table must exist before those columns are added.

### 1.1 Add `Cycle` domain model

**File**: [`src/growth/domain/models.py`](../../src/growth/domain/models.py)

Add after the `Show` dataclass:

```python
@dataclass(frozen=True)
class Cycle:
    cycle_id: UUID
    show_id: UUID
    started_at: datetime
    label: str | None = None    # e.g. "Cycle 3 · Feb 10–16", auto-generated if None
```

### 1.2 Add `CycleORM` table

**File**: [`src/growth/adapters/orm.py`](../../src/growth/adapters/orm.py)

```python
class CycleORM(Base):
    __tablename__ = "cycles"

    cycle_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    show_id: Mapped[str] = mapped_column(ForeignKey("shows.show_id"))
    started_at: Mapped[datetime] = mapped_column(DateTime)
    label: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
```

### 1.3 Add `CycleRepository` port

**File**: [`src/growth/ports/repositories.py`](../../src/growth/ports/repositories.py)

```python
class CycleRepository(Protocol):
    def get_by_id(self, cycle_id: UUID) -> Cycle | None: ...
    def save(self, cycle: Cycle) -> None: ...
    def get_by_show(self, show_id: UUID) -> list[Cycle]: ...
```

### 1.4 Add `SQLAlchemyCycleRepository`

**File**: [`src/growth/adapters/repositories.py`](../../src/growth/adapters/repositories.py)

Standard pattern matching existing repositories (get_by_id, save, get_by_show).

### 1.5 Add `cycle_repo()` to Container

**File**: [`src/growth/app/container.py`](../../src/growth/app/container.py)

```python
def cycle_repo(self):
    from growth.adapters.repositories import SQLAlchemyCycleRepository
    return SQLAlchemyCycleRepository(self._session)
```

### 1.6 Add `CycleResponse` schema + API route

**File**: [`src/growth/app/schemas.py`](../../src/growth/app/schemas.py)

```python
class CycleResponse(BaseModel):
    cycle_id: UUID
    show_id: UUID
    started_at: datetime
    label: str | None

    @classmethod
    def from_domain(cls, cycle: Cycle) -> CycleResponse: ...
```

**New file**: [`src/growth/app/api/cycles.py`](../../src/growth/app/api/cycles.py)

```python
router = APIRouter()

@router.get("/{show_id}/cycles", response_model=list[CycleResponse])
def list_cycles(show_id: UUID, request: Request):
    repo = request.app.state.container.cycle_repo()
    return [CycleResponse.from_domain(c) for c in repo.get_by_show(show_id)]

@router.get("/cycles/{cycle_id}", response_model=CycleResponse)
def get_cycle(cycle_id: UUID, request: Request):
    repo = request.app.state.container.cycle_repo()
    cycle = repo.get_by_id(cycle_id)
    if cycle is None:
        raise HTTPException(404, "Cycle not found")
    return CycleResponse.from_domain(cycle)
```

Register in [`src/growth/app/api/app.py`](../../src/growth/app/api/app.py):
```python
from growth.app.api.cycles import router as cycles_router
app.include_router(cycles_router, prefix="/api/shows", tags=["cycles"])
# also:
app.include_router(cycles_router, prefix="/api", tags=["cycles"])
```

### 1.7 Tests

**New file**: `tests/api/test_cycles.py`
- `POST /api/shows` → then `GET /api/shows/{show_id}/cycles` → empty list
- POST a cycle directly via repo → cycle appears in list
- `GET /api/cycles/{cycle_id}` returns cycle
- `GET /api/cycles/{bad_id}` → 404

---

## Task 2: Add `cycle_id` to Segments, Frames, Variants, Experiments, Memos

Add `cycle_id` as a nullable FK (nullable so existing data doesn't break) to the ORM tables, domain models, repositories, and schemas.

### 2.1 Domain models

**File**: [`src/growth/domain/models.py`](../../src/growth/domain/models.py)

Add `cycle_id: UUID | None = None` to:
- `AudienceSegment`
- `CreativeFrame`
- `CreativeVariant`
- `Experiment`
- `ProducerMemo`

### 2.2 ORM columns

**File**: [`src/growth/adapters/orm.py`](../../src/growth/adapters/orm.py)

Add to each ORM class:
```python
cycle_id: Mapped[Optional[str]] = mapped_column(
    String(36), ForeignKey("cycles.cycle_id"), nullable=True
)
```

Tables affected: `audience_segments`, `creative_frames`, `creative_variants`, `experiments`, `producer_memos`.

### 2.3 Repository converters

**File**: [`src/growth/adapters/repositories.py`](../../src/growth/adapters/repositories.py)

Update all `_to_domain()` and `_to_orm()` converters to pass through `cycle_id`. Use `UUID(orm.cycle_id) if orm.cycle_id else None` pattern.

### 2.4 Response schemas

**File**: [`src/growth/app/schemas.py`](../../src/growth/app/schemas.py)

Add `cycle_id: UUID | None` to `ExperimentResponse` and add new schemas created in Task 3.

### 2.5 Strategy service creates a cycle

**File**: [`src/growth/app/services/strategy_service.py`](../../src/growth/app/services/strategy_service.py)

At the start of `run()`, create a `Cycle` record and pass the `cycle_id` to all newly created segments and frames:
```python
cycle = Cycle(
    cycle_id=uuid4(),
    show_id=show_id,
    started_at=datetime.now(timezone.utc),
    label=None,   # auto-generate later or accept as param
)
cycle_repo.save(cycle)
# then pass cycle_id=cycle.cycle_id to each AudienceSegment and CreativeFrame created
```

Update `StrategyRunResult` to include `cycle_id`.

### 2.6 Tests

Update existing strategy service tests to assert `cycle_id` is set on output segments/frames. Add a test that `cycle_id` appears in `GET /api/segments?show_id=`.

---

## Task 3: Segment, Frame, Variant Read Routes + Approval State

### 3.1 Add `approval_status` to domain models

**File**: [`src/growth/domain/models.py`](../../src/growth/domain/models.py)

Add enum:
```python
class ReviewStatus(str, Enum):
    DRAFT = "draft"
    APPROVED = "approved"
    REJECTED = "rejected"
```

Add to `AudienceSegment`, `CreativeFrame`, `CreativeVariant`:
```python
review_status: ReviewStatus = ReviewStatus.DRAFT
reviewed_at: datetime | None = None
reviewed_by: str | None = None
```

### 3.2 ORM columns

**File**: [`src/growth/adapters/orm.py`](../../src/growth/adapters/orm.py)

Add to `AudienceSegmentORM`, `CreativeFrameORM`, `CreativeVariantORM`:
```python
review_status: Mapped[str] = mapped_column(String(20), default="draft")
reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
reviewed_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
```

### 3.3 Response schemas

**File**: [`src/growth/app/schemas.py`](../../src/growth/app/schemas.py)

```python
class SegmentResponse(BaseModel):
    segment_id: UUID
    show_id: UUID
    cycle_id: UUID | None
    name: str
    definition_json: dict[str, Any]
    estimated_size: int | None
    created_by: str
    review_status: str
    reviewed_at: datetime | None
    reviewed_by: str | None

    @classmethod
    def from_domain(cls, seg: AudienceSegment) -> SegmentResponse: ...


class FrameResponse(BaseModel):
    frame_id: UUID
    show_id: UUID
    segment_id: UUID
    cycle_id: UUID | None
    hypothesis: str
    promise: str
    evidence_refs: list[dict[str, Any]]
    channel: str
    risk_notes: str | None
    review_status: str
    reviewed_at: datetime | None
    reviewed_by: str | None

    @classmethod
    def from_domain(cls, frame: CreativeFrame) -> FrameResponse: ...


class VariantResponse(BaseModel):
    variant_id: UUID
    frame_id: UUID
    cycle_id: UUID | None
    platform: str
    hook: str
    body: str
    cta: str
    constraints_passed: bool
    review_status: str
    reviewed_at: datetime | None
    reviewed_by: str | None

    @classmethod
    def from_domain(cls, variant: CreativeVariant) -> VariantResponse: ...


class ReviewRequest(BaseModel):
    action: Literal["approve", "reject"]
    notes: str = ""
    reviewed_by: str = "producer"
```

### 3.4 Segment route file

**New file**: [`src/growth/app/api/segments.py`](../../src/growth/app/api/segments.py)

```python
router = APIRouter()

@router.get("", response_model=list[SegmentResponse])
def list_segments(show_id: UUID, cycle_id: UUID | None = None, request: Request = ...):
    repo = request.app.state.container.segment_repo()
    segments = repo.get_by_show(show_id)
    if cycle_id:
        segments = [s for s in segments if s.cycle_id == cycle_id]
    return [SegmentResponse.from_domain(s) for s in segments]

@router.get("/{segment_id}", response_model=SegmentResponse)
def get_segment(segment_id: UUID, request: Request): ...

@router.post("/{segment_id}/review", response_model=SegmentResponse)
def review_segment(segment_id: UUID, body: ReviewRequest, request: Request):
    # load, update review_status + reviewed_at + reviewed_by, save, return
    ...
```

Register in [`app.py`](../../src/growth/app/api/app.py): `prefix="/api/segments"`

### 3.5 Frame route file

**New file**: [`src/growth/app/api/frames.py`](../../src/growth/app/api/frames.py)

Same pattern as segments. Add `cycle_id` and `segment_id` as optional query filters.

```python
@router.get("", response_model=list[FrameResponse])
def list_frames(show_id: UUID, cycle_id: UUID | None = None,
                segment_id: UUID | None = None, request: Request = ...):
    ...
```

Endpoints: `GET /api/frames`, `GET /api/frames/{frame_id}`, `POST /api/frames/{frame_id}/review`

Register: `prefix="/api/frames"`

### 3.6 Variant route file

**New file**: [`src/growth/app/api/variants.py`](../../src/growth/app/api/variants.py)

```python
@router.get("", response_model=list[VariantResponse])
def list_variants(frame_id: UUID, request: Request): ...

@router.get("/{variant_id}", response_model=VariantResponse)
def get_variant(variant_id: UUID, request: Request): ...

@router.post("/{variant_id}/review", response_model=VariantResponse)
def review_variant(variant_id: UUID, body: ReviewRequest, request: Request): ...
```

Register: `prefix="/api/variants"`

### 3.7 Update segment/frame repos to support `review_status` writes

The existing [`SQLAlchemySegmentRepository`](../../src/growth/adapters/repositories.py) and [`SQLAlchemyFrameRepository`](../../src/growth/adapters/repositories.py) use `session.merge()` on save — this will handle the new fields automatically once the ORM models are updated. Verify the `save()` method replaces the full record correctly.

### 3.8 Tests

**New files**: `tests/api/test_segments.py`, `tests/api/test_frames.py`, `tests/api/test_variants.py`

Key test cases:
- `GET /api/segments?show_id=` returns empty list
- After strategy run: segments appear with `review_status: "draft"`
- `POST /api/segments/{id}/review` `{"action": "approve"}` → `review_status: "approved"`
- `POST /api/segments/{id}/review` `{"action": "reject"}` → `review_status: "rejected"`
- Review is reversible: approve then reject works
- `GET /api/segments?show_id=&cycle_id=` filters to cycle
- `GET /api/segments/{bad_id}` → 404

---

## Task 4: Async Job System

### 4.1 `BackgroundJob` domain model

**File**: [`src/growth/domain/models.py`](../../src/growth/domain/models.py)

```python
class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class JobType(str, Enum):
    STRATEGY = "strategy"
    CREATIVE = "creative"
    MEMO = "memo"


@dataclass(frozen=True)
class BackgroundJob:
    job_id: UUID
    job_type: JobType
    status: JobStatus
    show_id: UUID
    input_json: dict[str, Any]          # e.g. {"show_id": "...", "frame_id": "..."}
    result_json: dict[str, Any] | None
    error_message: str | None
    attempt_count: int
    last_heartbeat_at: datetime | None
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None
```

### 4.2 `BackgroundJobORM` table

**File**: [`src/growth/adapters/orm.py`](../../src/growth/adapters/orm.py)

```python
class BackgroundJobORM(Base):
    __tablename__ = "background_jobs"

    job_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    job_type: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="queued", index=True)
    show_id: Mapped[str] = mapped_column(String(36))
    input_json: Mapped[dict[str, Any]] = mapped_column(JSON)
    result_json: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    last_heartbeat_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(DateTime)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
```

Add `index=True` on `status` to make the worker's `WHERE status='queued'` query fast.

### 4.3 `JobRepository` port

**File**: [`src/growth/ports/repositories.py`](../../src/growth/ports/repositories.py)

```python
class JobRepository(Protocol):
    def get_by_id(self, job_id: UUID) -> BackgroundJob | None: ...
    def save(self, job: BackgroundJob) -> None: ...
    def claim_next_queued(self) -> BackgroundJob | None:
        """Atomically transition one queued job to running. Returns it or None."""
        ...
    def reset_stale_running_jobs(self, stale_after_seconds: int = 120) -> int:
        """Reset running jobs with stale heartbeat back to queued. Returns count reset."""
        ...
```

### 4.4 `SQLAlchemyJobRepository`

**File**: [`src/growth/adapters/repositories.py`](../../src/growth/adapters/repositories.py)

`claim_next_queued()` implementation for SQLite (single-process, no `SELECT FOR UPDATE` needed):
```python
def claim_next_queued(self) -> BackgroundJob | None:
    now = datetime.now(timezone.utc)
    orm = (
        self._session.query(BackgroundJobORM)
        .filter(BackgroundJobORM.status == "queued")
        .order_by(BackgroundJobORM.created_at)
        .first()
    )
    if orm is None:
        return None
    orm.status = "running"
    orm.attempt_count += 1
    orm.last_heartbeat_at = now
    orm.updated_at = now
    self._session.commit()
    return _job_to_domain(orm)
```

`reset_stale_running_jobs()`:
```python
def reset_stale_running_jobs(self, stale_after_seconds: int = 120) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=stale_after_seconds)
    stale = (
        self._session.query(BackgroundJobORM)
        .filter(
            BackgroundJobORM.status == "running",
            BackgroundJobORM.last_heartbeat_at < cutoff,
        )
        .all()
    )
    for orm in stale:
        orm.status = "queued"
        orm.updated_at = datetime.now(timezone.utc)
    self._session.commit()
    return len(stale)
```

### 4.5 Worker loop

**New file**: [`src/growth/app/worker.py`](../../src/growth/app/worker.py)

```python
"""In-process background job worker."""
import asyncio
import logging
from datetime import datetime, timezone

from growth.app.container import Container

logger = logging.getLogger(__name__)


async def worker_loop(container: Container) -> None:
    """Poll the jobs table for queued jobs and run them. Runs forever."""
    logger.info("Background worker started")
    container.job_repo().reset_stale_running_jobs()   # clean up on startup

    while True:
        try:
            job = container.job_repo().claim_next_queued()
            if job is not None:
                await _run_job(job, container)
            else:
                await asyncio.sleep(1)
        except Exception:
            logger.exception("Worker loop error; continuing")
            await asyncio.sleep(2)


async def _run_job(job, container: Container) -> None:
    from uuid import UUID
    job_repo = container.job_repo()

    async def heartbeat(job_id, interval: int = 10):
        while True:
            await asyncio.sleep(interval)
            _update_heartbeat(job_repo, job_id)

    hb_task = asyncio.create_task(heartbeat(job.job_id))
    try:
        result = await _dispatch(job, container)
        _mark_completed(job_repo, job.job_id, result)
    except Exception as e:
        logger.exception(f"Job {job.job_id} failed")
        _mark_failed(job_repo, job.job_id, str(e))
    finally:
        hb_task.cancel()


async def _dispatch(job, container: Container) -> dict:
    """Route job to the appropriate service and run it. Returns result_json dict."""
    from uuid import UUID
    if job.job_type == "strategy":
        service = container.strategy_service()
        result = service.run(UUID(job.input_json["show_id"]))
        return {
            "run_id": str(result.run_id),
            "cycle_id": str(result.cycle_id),
            "segment_ids": [str(s) for s in result.segment_ids],
            "frame_ids": [str(f) for f in result.frame_ids],
            "reasoning_summary": result.strategy_output.reasoning_summary,
            "turns_used": result.turns_used,
        }
    elif job.job_type == "creative":
        service = container.creative_service()
        result = service.run(UUID(job.input_json["frame_id"]))
        return {
            "run_id": str(result.run_id),
            "variant_ids": [str(v) for v in result.variant_ids],
            "reasoning_summary": result.creative_output.reasoning_summary,
            "turns_used": result.turns_used,
        }
    elif job.job_type == "memo":
        service = container.memo_service()
        # memo_service.run() is synchronous; wrap in executor for safety
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None, service.run,
            UUID(job.input_json["show_id"]),
            job.input_json["cycle_start"],
            job.input_json["cycle_end"],
        )
        return {"memo_id": str(result.memo_id), "run_id": str(result.run_id)}
    else:
        raise ValueError(f"Unknown job type: {job.job_type}")


def _mark_completed(job_repo, job_id, result: dict):
    ...  # load job, update status=completed, result_json=result, completed_at=now, save


def _mark_failed(job_repo, job_id, error: str):
    ...  # load job, update status=failed, error_message=error, completed_at=now, save


def _update_heartbeat(job_repo, job_id):
    ...  # load job, update last_heartbeat_at=now, save
```

**Note**: The agent services (`strategy_service.run`, `creative_service.run`) are currently synchronous Python. Wrapping them in `asyncio.get_event_loop().run_in_executor(None, ...)` runs them in a thread pool so they don't block the event loop during the long Claude API calls.

### 4.6 Wire worker into application lifespan

**File**: [`src/growth/app/api/app.py`](../../src/growth/app/api/app.py)

Convert app creation to use a lifespan context manager:

```python
from contextlib import asynccontextmanager
import asyncio

def create_app(container=None):
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        from growth.app.worker import worker_loop
        task = asyncio.create_task(worker_loop(app.state.container))
        yield
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    if container is None:
        container = Container()

    app = FastAPI(
        title="Bring The People — Growth API",
        version="0.3.0",
        lifespan=lifespan,
        ...
    )
    app.state.container = container
    ...
```

### 4.7 Change agent routes to enqueue jobs

**File**: [`src/growth/app/api/strategy.py`](../../src/growth/app/api/strategy.py)

```python
@router.post("/{show_id}/run", status_code=202)
def run_strategy(show_id: UUID, request: Request):
    container = request.app.state.container
    # Validate show exists
    show = container.show_repo().get_by_id(show_id)
    if show is None:
        raise HTTPException(404, "Show not found")

    job = BackgroundJob(
        job_id=uuid4(),
        job_type=JobType.STRATEGY,
        status=JobStatus.QUEUED,
        show_id=show_id,
        input_json={"show_id": str(show_id)},
        result_json=None,
        error_message=None,
        attempt_count=0,
        last_heartbeat_at=None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        completed_at=None,
    )
    container.job_repo().save(job)
    return {"job_id": str(job.job_id), "status": "queued"}
```

Apply the same pattern to [`creative.py`](../../src/growth/app/api/creative.py) and [`memo.py`](../../src/growth/app/api/memo.py).

### 4.8 Job poll endpoint

**New file**: [`src/growth/app/api/jobs.py`](../../src/growth/app/api/jobs.py)

```python
class JobResponse(BaseModel):
    job_id: UUID
    job_type: str
    status: str
    show_id: UUID
    result_json: dict[str, Any] | None
    error_message: str | None
    attempt_count: int
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None

router = APIRouter()

@router.get("/{job_id}", response_model=JobResponse)
def get_job(job_id: UUID, request: Request):
    repo = request.app.state.container.job_repo()
    job = repo.get_by_id(job_id)
    if job is None:
        raise HTTPException(404, "Job not found")
    return JobResponse.from_domain(job)
```

Register in `app.py`: `prefix="/api/jobs"`, tags=["jobs"]

### 4.9 Add `job_repo()` to Container

**File**: [`src/growth/app/container.py`](../../src/growth/app/container.py)

```python
def job_repo(self):
    from growth.adapters.repositories import SQLAlchemyJobRepository
    return SQLAlchemyJobRepository(self._session)
```

### 4.10 Tests

**New file**: `tests/api/test_jobs.py`

- `POST /api/strategy/{show_id}/run` returns 202 with `job_id` and `status: "queued"`
- `GET /api/jobs/{job_id}` returns the job record
- `GET /api/jobs/{bad_id}` → 404
- Worker loop: unit test `_dispatch` with mocked services (no real Claude calls)
- `claim_next_queued()` is tested on repo directly: creates queued job, claims it, verify status=running
- `reset_stale_running_jobs()`: create a running job with old heartbeat, verify it resets to queued

**Integration test caveat**: Tests that previously called `POST /api/strategy/{show_id}/run` and expected immediate results will need updating. Either:
- Use a test container with a stub worker that completes jobs synchronously, or
- Use the existing `strategy_service.run()` directly in test setup (bypassing the async job layer)

---

## Task 5: Events Endpoint

### 5.1 Events endpoint

**New file**: [`src/growth/app/api/events.py`](../../src/growth/app/api/events.py)

The existing JSONL event log at `data/events.jsonl` stores events with the envelope: `event_id`, `event_type`, `occurred_at`, `show_id`, `experiment_id`, `actor`, `payload`.

The endpoint reads, filters, and enriches with a `display` field:

```python
class EventDisplay(BaseModel):
    title: str
    subtitle: str

class EventResponse(BaseModel):
    event_id: str
    at: datetime
    show_id: str
    cycle_id: str | None
    type: str
    actor: str
    display: EventDisplay
    payload: dict[str, Any]

router = APIRouter()

_DISPLAY_MAP: dict[str, tuple[str, str]] = {
    "experiment.created":         ("Experiment created",       "{experiment_id}"),
    "experiment.approval_requested": ("Approval requested",    "{experiment_id}"),
    "experiment.approved":        ("Experiment approved",      "{experiment_id}"),
    "experiment.launched":        ("Experiment launched",      "{experiment_id}"),
    "observation.window_closed":  ("Results window closed",    "{experiment_id}"),
    "decision.issued":            ("Decision issued",          "{action} · {experiment_id}"),
    "memo.published":             ("Memo published",           "Cycle memo ready"),
    "strategy.completed":         ("Strategy Agent ran",       "{segment_count} segments · {frame_count} frames"),
    "creative.completed":         ("Creative Agent ran",       "{variant_count} variants generated"),
}

@router.get("", response_model=list[EventResponse])
def list_events(show_id: str, cycle_id: str | None = None, limit: int = 50, request: Request = ...):
    event_log = request.app.state.container.event_log()
    events = event_log.read_by_show(show_id)   # new method needed (see 5.2)
    if cycle_id:
        events = [e for e in events if e.get("cycle_id") == cycle_id]
    # sort newest first, limit
    events = sorted(events, key=lambda e: e["occurred_at"], reverse=True)[:limit]
    return [_to_event_response(e) for e in events]
```

The `display` fields are generated server-side from the event type and payload so the frontend renders them directly without any type→string mapping.

### 5.2 Add `read_by_show()` to event log

**File**: [`src/growth/adapters/event_log.py`](../../src/growth/adapters/event_log.py)

```python
def read_by_show(self, show_id: str) -> list[dict]:
    """Read all events for a show from the JSONL log."""
    if not self._path.exists():
        return []
    results = []
    with self._path.open() as f:
        for line in f:
            try:
                event = json.loads(line.strip())
                if event.get("show_id") == show_id:
                    results.append(event)
            except json.JSONDecodeError:
                continue
    return results
```

### 5.3 Update strategy/creative/memo services to emit `cycle_id` in events

When the worker dispatches a job and it completes, the resulting domain events should carry `cycle_id`. Update event emission in the services to include `cycle_id` in the payload.

### 5.4 Add `cycle_id` to `EventEnvelope`

**File**: [`src/growth/domain/events.py`](../../src/growth/domain/events.py)

Add `cycle_id: UUID | None = None` to the event envelope dataclass. Update `JSONLEventLog.append()` to serialize it.

### 5.5 Tests

- `GET /api/events?show_id=` when no events: returns empty list
- After a strategy run (via service): events appear with correct `display.title`
- `?cycle_id=` filter works
- Unknown event types get a generic `display` without crashing

---

## Task 6: Experiment Complete/Stop + Computed Metrics

### 6.1 Experiment state transitions

**File**: [`src/growth/app/api/experiments.py`](../../src/growth/app/api/experiments.py)

```python
@router.post("/{experiment_id}/complete", response_model=ExperimentResponse)
def complete_experiment(experiment_id: UUID, request: Request):
    ...  # running → completed

@router.post("/{experiment_id}/stop", response_model=ExperimentResponse)
def stop_experiment(experiment_id: UUID, request: Request):
    ...  # running → stopped
```

Both follow the existing pattern from `start_experiment()`. Return 409 on invalid transitions.

State machine (all allowed transitions):
- `draft` → `awaiting_approval` (submit)
- `awaiting_approval` → `approved` | `draft` (approve)
- `approved` → `running` (start)
- `running` → `completed` (complete)
- `running` → `stopped` (stop)

### 6.2 Computed metrics endpoint

**File**: [`src/growth/app/api/experiments.py`](../../src/growth/app/api/experiments.py) (or new `metrics.py`)

```python
class ExperimentMetrics(BaseModel):
    experiment_id: UUID
    total_spend_cents: int
    total_impressions: int
    total_clicks: int
    total_purchases: int
    total_revenue_cents: int
    windows_count: int
    ctr: float | None             # clicks / impressions; None if impressions == 0
    cpc_cents: float | None       # spend / clicks; None if clicks == 0
    cpa_cents: float | None       # spend / purchases; None if purchases == 0
    roas: float | None            # revenue / spend; None if spend == 0
    conversion_rate: float | None # purchases / clicks; None if clicks == 0
    evidence_sufficient: bool     # meets minimums from policy config

@router.get("/{experiment_id}/metrics", response_model=ExperimentMetrics)
def get_experiment_metrics(experiment_id: UUID, request: Request):
    container = request.app.state.container
    exp = container.experiment_repo().get_by_id(experiment_id)
    if exp is None:
        raise HTTPException(404, "Experiment not found")
    observations = container.experiment_repo().get_observations(experiment_id)
    policy = container.policy_config()
    return _compute_metrics(exp, observations, policy)
```

The `_compute_metrics()` function aggregates observations and applies the same arithmetic as the client-side preview in the dashboard.

### 6.3 Tests

- `POST /complete` on running experiment → 200, status=completed
- `POST /stop` on running experiment → 200, status=stopped
- `POST /complete` on draft experiment → 409
- `GET /metrics` with 0 observations → all rates are None, evidence_sufficient=false
- `GET /metrics` with 2 observations meeting minimums → evidence_sufficient=true

---

## Task 7: Show Enhancements + Memo Route Fix

### 7.1 Add `ticket_base_url` to Show

**File**: [`src/growth/domain/models.py`](../../src/growth/domain/models.py)

```python
@dataclass(frozen=True)
class Show:
    ...
    ticket_base_url: str | None = None
```

**File**: [`src/growth/adapters/orm.py`](../../src/growth/adapters/orm.py)

```python
ticket_base_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
```

**File**: [`src/growth/app/schemas.py`](../../src/growth/app/schemas.py)

Add `ticket_base_url: str | None = None` to `ShowCreate`, `ShowUpdate`, `ShowResponse`.

### 7.2 Fix memo route naming

The current memo route is at `/api/memo/{show_id}/run`. The design calls for consistent REST naming.

**File**: [`src/growth/app/api/memo.py`](../../src/growth/app/api/memo.py) and [`app.py`](../../src/growth/app/api/app.py)

Change registration prefix from `/api/memo` to `/api/memos`.

Add new read endpoints to `memo.py`:
```python
@router.get("", response_model=list[MemoResponse])
def list_memos(show_id: UUID, request: Request): ...

@router.get("/{memo_id}", response_model=MemoResponse)
def get_memo(memo_id: UUID, request: Request): ...
```

Where `MemoResponse` wraps the `ProducerMemo` domain model.

The existing `POST /{show_id}/run` becomes `POST /api/memos/{show_id}/run` (same semantics, just under the new prefix). With Task 4 in place, this route will now enqueue a job and return 202.

### 7.3 Tests

- `GET /api/shows/{id}` response includes `ticket_base_url: null`
- `PATCH /api/shows/{id}` with `ticket_base_url` → updates field
- `GET /api/memos?show_id=` → returns list (empty initially)
- `GET /api/memos/{id}` → returns memo

---

## Summary: All New and Changed Files

### New files
| File | Purpose |
|------|---------|
| [`src/growth/app/api/cycles.py`](../../src/growth/app/api/cycles.py) | Cycle list/get endpoints |
| [`src/growth/app/api/segments.py`](../../src/growth/app/api/segments.py) | Segment read + review endpoints |
| [`src/growth/app/api/frames.py`](../../src/growth/app/api/frames.py) | Frame read + review endpoints |
| [`src/growth/app/api/variants.py`](../../src/growth/app/api/variants.py) | Variant read + review endpoints |
| [`src/growth/app/api/jobs.py`](../../src/growth/app/api/jobs.py) | Job poll endpoint |
| [`src/growth/app/api/events.py`](../../src/growth/app/api/events.py) | Events feed endpoint |
| [`src/growth/app/worker.py`](../../src/growth/app/worker.py) | In-process job worker loop |
| `tests/api/test_cycles.py` | Cycle API tests |
| `tests/api/test_segments.py` | Segment API + review tests |
| `tests/api/test_frames.py` | Frame API + review tests |
| `tests/api/test_variants.py` | Variant API + review tests |
| `tests/api/test_jobs.py` | Job system tests |
| `tests/app/test_worker.py` | Worker dispatch + heartbeat tests |

### Modified files
| File | Change |
|------|--------|
| [`src/growth/domain/models.py`](../../src/growth/domain/models.py) | Add `Cycle`, `BackgroundJob`, `ReviewStatus`, `JobStatus`, `JobType`; add `cycle_id` + review fields to existing models; add `ticket_base_url` to `Show` |
| [`src/growth/adapters/orm.py`](../../src/growth/adapters/orm.py) | Add `CycleORM`, `BackgroundJobORM`; add columns to existing tables |
| [`src/growth/adapters/repositories.py`](../../src/growth/adapters/repositories.py) | Add `SQLAlchemyCycleRepository`, `SQLAlchemyJobRepository`; update existing converters for new fields |
| [`src/growth/adapters/event_log.py`](../../src/growth/adapters/event_log.py) | Add `read_by_show()` method |
| [`src/growth/ports/repositories.py`](../../src/growth/ports/repositories.py) | Add `CycleRepository`, `JobRepository` protocols |
| [`src/growth/domain/events.py`](../../src/growth/domain/events.py) | Add `cycle_id` to event envelope |
| [`src/growth/app/schemas.py`](../../src/growth/app/schemas.py) | Add `SegmentResponse`, `FrameResponse`, `VariantResponse`, `ReviewRequest`, `CycleResponse`, `JobResponse`, `ExperimentMetrics`, `MemoResponse`; update existing schemas |
| [`src/growth/app/container.py`](../../src/growth/app/container.py) | Add `cycle_repo()`, `job_repo()` |
| [`src/growth/app/api/app.py`](../../src/growth/app/api/app.py) | Add lifespan handler (worker startup); register new routers |
| [`src/growth/app/api/strategy.py`](../../src/growth/app/api/strategy.py) | Convert to return 202 + job_id |
| [`src/growth/app/api/creative.py`](../../src/growth/app/api/creative.py) | Convert to return 202 + job_id |
| [`src/growth/app/api/memo.py`](../../src/growth/app/api/memo.py) | Convert to return 202 + job_id; add list/get routes; rename prefix |
| [`src/growth/app/api/experiments.py`](../../src/growth/app/api/experiments.py) | Add `complete`, `stop` transitions; add `metrics` endpoint |
| [`src/growth/app/services/strategy_service.py`](../../src/growth/app/services/strategy_service.py) | Create `Cycle` at start of run; tag output with `cycle_id` |
| `tests/api/test_api_integration.py` | Update agent call tests to use job polling pattern |
| `tests/api/test_strategy.py` | Update for 202 response |
| `tests/api/test_creative.py` | Update for 202 response |
| `tests/api/test_memo.py` | Update for 202 response + new routes |
| `tests/api/test_experiments.py` | Add complete/stop/metrics tests |
| `tests/api/test_shows.py` | Add ticket_base_url tests |

---

## Implementation Order Within This Plan

```
Task 1 (Cycle model + table + API)
  ↓
Task 2 (Add cycle_id FK to all entities)
  ↓
Task 3 (Segment/Frame/Variant reads + review_status)
  ↓
Task 4 (Async job system + worker loop)
  ↓
Tasks 5, 6, 7 (Events, state transitions/metrics, Show enhancements) — can be done in any order
```

Tasks 5–7 have no interdependencies and can be assigned to different people or done in any sequence.
