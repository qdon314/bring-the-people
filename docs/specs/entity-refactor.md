Absolutely. Below is a **clean, fresh-DB** implementation package: SQLAlchemy ORM + domain dataclasses + Pydantic + FastAPI router skeletons + frontend query keys/hooks.

I’m going to assume:

* FastAPI + SQLAlchemy 2.0 style is OK (I’ll keep it mostly classic ORM but modern-ish)
* UUIDs stored as `String(36)` like you do now
* You already have `shows`, `cycles`, `segments`, `frames` tables/models somewhere

If your project is SQLAlchemy-1.4-ish, this still ports easily.

---

# 1) Enums + Domain dataclasses

```python
# src/growth/domain/models.py
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID


class RunStatus(str, Enum):
    DRAFT = "draft"
    AWAITING_APPROVAL = "awaiting_approval"
    ACTIVE = "active"
    DECIDED = "decided"


class DecisionAction(str, Enum):
    SCALE = "scale"
    HOLD = "hold"
    KILL = "kill"


@dataclass(frozen=True)
class Experiment:
    experiment_id: UUID
    show_id: UUID
    origin_cycle_id: UUID
    segment_id: UUID
    frame_id: UUID
    channel: str
    objective: str
    budget_cap_cents: int
    baseline_snapshot: dict[str, Any]


@dataclass(frozen=True)
class ExperimentRun:
    run_id: UUID
    experiment_id: UUID
    cycle_id: UUID
    status: RunStatus
    start_time: datetime | None
    end_time: datetime | None


@dataclass(frozen=True)
class Observation:
    observation_id: UUID
    run_id: UUID
    window_start: datetime
    window_end: datetime
    spend_cents: int
    impressions: int
    clicks: int
    sessions: int
    checkouts: int
    purchases: int
    revenue_cents: int
    refunds: int
    refund_cents: int
    complaints: int
    negative_comment_rate: float | None
    attribution_model: str
    raw_json: dict[str, Any]


@dataclass(frozen=True)
class Decision:
    decision_id: UUID
    run_id: UUID
    action: DecisionAction
    confidence: float
    rationale: str
    policy_version: str
    metrics_snapshot: dict[str, Any]
```

---

# 2) SQLAlchemy ORM models + tables

```python
# src/growth/infra/db/models.py
from __future__ import annotations

from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, DateTime, Float, ForeignKey, JSON, Index
)
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


class ExperimentORM(Base):
    __tablename__ = "experiments"

    experiment_id = Column(String(36), primary_key=True)
    show_id = Column(String(36), ForeignKey("shows.show_id"), nullable=False, index=True)

    # where the definition was first created (a useful audit/tracking field)
    origin_cycle_id = Column(String(36), ForeignKey("cycles.cycle_id"), nullable=False, index=True)

    segment_id = Column(String(36), ForeignKey("segments.segment_id"), nullable=False, index=True)
    frame_id = Column(String(36), ForeignKey("frames.frame_id"), nullable=False, index=True)

    channel = Column(String(50), nullable=False)
    objective = Column(String(100), nullable=False, default="ticket_sales")
    budget_cap_cents = Column(Integer, nullable=False)
    baseline_snapshot = Column(JSON, nullable=False, default=dict)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # relationships
    runs = relationship("ExperimentRunORM", back_populates="experiment", cascade="all, delete-orphan")


class ExperimentRunORM(Base):
    __tablename__ = "experiment_runs"

    run_id = Column(String(36), primary_key=True)

    experiment_id = Column(String(36), ForeignKey("experiments.experiment_id"), nullable=False, index=True)
    cycle_id = Column(String(36), ForeignKey("cycles.cycle_id"), nullable=False, index=True)

    status = Column(String(50), nullable=False)  # values from RunStatus
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)

    # optional overrides / snapshots
    budget_cap_cents_override = Column(Integer, nullable=True)
    channel_config = Column(JSON, nullable=False, default=dict)   # targeting, placements, etc.
    variant_snapshot = Column(JSON, nullable=False, default=dict) # snapshot of creative IDs/content used

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    experiment = relationship("ExperimentORM", back_populates="runs")
    observations = relationship("ObservationORM", back_populates="run", cascade="all, delete-orphan")
    decisions = relationship("DecisionORM", back_populates="run", cascade="all, delete-orphan")


class ObservationORM(Base):
    __tablename__ = "observations"

    observation_id = Column(String(36), primary_key=True)
    run_id = Column(String(36), ForeignKey("experiment_runs.run_id"), nullable=False, index=True)

    window_start = Column(DateTime, nullable=False)
    window_end = Column(DateTime, nullable=False)

    spend_cents = Column(Integer, nullable=False, default=0)
    impressions = Column(Integer, nullable=False, default=0)
    clicks = Column(Integer, nullable=False, default=0)
    sessions = Column(Integer, nullable=False, default=0)
    checkouts = Column(Integer, nullable=False, default=0)
    purchases = Column(Integer, nullable=False, default=0)
    revenue_cents = Column(Integer, nullable=False, default=0)
    refunds = Column(Integer, nullable=False, default=0)
    refund_cents = Column(Integer, nullable=False, default=0)
    complaints = Column(Integer, nullable=False, default=0)
    negative_comment_rate = Column(Float, nullable=True)
    attribution_model = Column(String(50), nullable=False, default="last_click_utm")

    raw_json = Column(JSON, nullable=False, default=dict)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    run = relationship("ExperimentRunORM", back_populates="observations")

    __table_args__ = (
        Index("ix_observations_run_window", "run_id", "window_start", "window_end"),
    )


class DecisionORM(Base):
    __tablename__ = "decisions"

    decision_id = Column(String(36), primary_key=True)
    run_id = Column(String(36), ForeignKey("experiment_runs.run_id"), nullable=False, index=True)

    action = Column(String(20), nullable=False)  # scale|hold|kill
    confidence = Column(Float, nullable=False)
    rationale = Column(String(500), nullable=False)
    policy_version = Column(String(20), nullable=False)
    metrics_snapshot = Column(JSON, nullable=False, default=dict)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    run = relationship("ExperimentRunORM", back_populates="decisions")
```

### DB constraints you should add (since fresh DB is fine)

* Unique constraint to prevent duplicate “same experiment run twice in same cycle” if desired:

  * `Unique(experiment_id, cycle_id)` on `experiment_runs`
* Check constraints for known enum values (optional but I recommend)

---

# 3) Pydantic Schemas (API contract)

```python
# src/growth/api/schemas.py
from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID
from pydantic import BaseModel, Field, conint, confloat, model_validator

from growth.domain.models import RunStatus, DecisionAction


# ---------- Experiments (definition) ----------

class ExperimentCreate(BaseModel):
    show_id: UUID
    origin_cycle_id: UUID
    segment_id: UUID
    frame_id: UUID
    channel: str = Field(min_length=1, max_length=50)
    objective: str = Field(default="ticket_sales", max_length=100)
    budget_cap_cents: conint(gt=0)
    baseline_snapshot: dict[str, Any] = Field(default_factory=dict)


class ExperimentResponse(BaseModel):
    experiment_id: UUID
    show_id: UUID
    origin_cycle_id: UUID
    segment_id: UUID
    frame_id: UUID
    channel: str
    objective: str
    budget_cap_cents: int
    baseline_snapshot: dict[str, Any]
    created_at: datetime
    updated_at: datetime


# ---------- Runs (execution) ----------

class RunCreate(BaseModel):
    experiment_id: UUID
    cycle_id: UUID
    status: RunStatus = RunStatus.DRAFT
    budget_cap_cents_override: conint(gt=0) | None = None
    channel_config: dict[str, Any] = Field(default_factory=dict)
    variant_snapshot: dict[str, Any] = Field(default_factory=dict)


class RunResponse(BaseModel):
    run_id: UUID
    experiment_id: UUID
    cycle_id: UUID
    status: RunStatus
    start_time: datetime | None
    end_time: datetime | None
    budget_cap_cents_override: int | None
    channel_config: dict[str, Any]
    variant_snapshot: dict[str, Any]
    created_at: datetime
    updated_at: datetime


# ---------- Observations ----------

class ObservationCreate(BaseModel):
    run_id: UUID
    window_start: datetime
    window_end: datetime

    spend_cents: conint(ge=0) = 0
    impressions: conint(ge=0) = 0
    clicks: conint(ge=0) = 0
    sessions: conint(ge=0) = 0
    checkouts: conint(ge=0) = 0
    purchases: conint(ge=0) = 0
    revenue_cents: conint(ge=0) = 0
    refunds: conint(ge=0) = 0
    refund_cents: conint(ge=0) = 0
    complaints: conint(ge=0) = 0

    negative_comment_rate: confloat(ge=0.0, le=1.0) | None = None
    attribution_model: str = Field(default="last_click_utm", max_length=50)
    raw_json: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_window(self):
        if self.window_end <= self.window_start:
            raise ValueError("window_end must be > window_start")
        return self


class ObservationBulkCreate(BaseModel):
    observations: list[ObservationCreate] = Field(min_length=1)


class ObservationResponse(BaseModel):
    observation_id: UUID
    run_id: UUID
    window_start: datetime
    window_end: datetime
    spend_cents: int
    impressions: int
    clicks: int
    sessions: int
    checkouts: int
    purchases: int
    revenue_cents: int
    refunds: int
    refund_cents: int
    complaints: int
    negative_comment_rate: float | None
    attribution_model: str
    created_at: datetime


# ---------- Decisions ----------

class DecisionResponse(BaseModel):
    decision_id: UUID
    run_id: UUID
    action: DecisionAction
    confidence: float
    rationale: str
    policy_version: str
    metrics_snapshot: dict[str, Any]
    created_at: datetime


# ---------- Metrics (derived) ----------

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
```

---

# 4) FastAPI Routers (skeletons)

This is intentionally “boring”: create/list/get, plus run transitions and decision evaluate.

```python
# src/growth/api/routes/experiments.py
from __future__ import annotations

from uuid import uuid4, UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from growth.api.schemas import ExperimentCreate, ExperimentResponse
from growth.infra.db.models import ExperimentORM
from growth.infra.db.session import get_db  # your existing dependency

router = APIRouter(prefix="/api/experiments", tags=["experiments"])


@router.post("", response_model=ExperimentResponse)
def create_experiment(payload: ExperimentCreate, db: Session = Depends(get_db)):
    now = datetime.utcnow()
    exp = ExperimentORM(
        experiment_id=str(uuid4()),
        show_id=str(payload.show_id),
        origin_cycle_id=str(payload.origin_cycle_id),
        segment_id=str(payload.segment_id),
        frame_id=str(payload.frame_id),
        channel=payload.channel,
        objective=payload.objective,
        budget_cap_cents=int(payload.budget_cap_cents),
        baseline_snapshot=payload.baseline_snapshot,
        created_at=now,
        updated_at=now,
    )
    db.add(exp)
    db.commit()
    db.refresh(exp)
    return ExperimentResponse(
        experiment_id=UUID(exp.experiment_id),
        show_id=UUID(exp.show_id),
        origin_cycle_id=UUID(exp.origin_cycle_id),
        segment_id=UUID(exp.segment_id),
        frame_id=UUID(exp.frame_id),
        channel=exp.channel,
        objective=exp.objective,
        budget_cap_cents=exp.budget_cap_cents,
        baseline_snapshot=exp.baseline_snapshot or {},
        created_at=exp.created_at,
        updated_at=exp.updated_at,
    )


@router.get("", response_model=list[ExperimentResponse])
def list_experiments(show_id: UUID, db: Session = Depends(get_db)):
    rows = db.query(ExperimentORM).filter(ExperimentORM.show_id == str(show_id)).all()
    return [
        ExperimentResponse(
            experiment_id=UUID(r.experiment_id),
            show_id=UUID(r.show_id),
            origin_cycle_id=UUID(r.origin_cycle_id),
            segment_id=UUID(r.segment_id),
            frame_id=UUID(r.frame_id),
            channel=r.channel,
            objective=r.objective,
            budget_cap_cents=r.budget_cap_cents,
            baseline_snapshot=r.baseline_snapshot or {},
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in rows
    ]


@router.get("/{experiment_id}", response_model=ExperimentResponse)
def get_experiment(experiment_id: UUID, db: Session = Depends(get_db)):
    r = db.query(ExperimentORM).get(str(experiment_id))
    if not r:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return ExperimentResponse(
        experiment_id=UUID(r.experiment_id),
        show_id=UUID(r.show_id),
        origin_cycle_id=UUID(r.origin_cycle_id),
        segment_id=UUID(r.segment_id),
        frame_id=UUID(r.frame_id),
        channel=r.channel,
        objective=r.objective,
        budget_cap_cents=r.budget_cap_cents,
        baseline_snapshot=r.baseline_snapshot or {},
        created_at=r.created_at,
        updated_at=r.updated_at,
    )
```

```python
# src/growth/api/routes/runs.py
from __future__ import annotations

from uuid import uuid4, UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from growth.domain.models import RunStatus
from growth.api.schemas import RunCreate, RunResponse, RunMetricsResponse
from growth.infra.db.models import ExperimentORM, ExperimentRunORM, ObservationORM, DecisionORM
from growth.infra.db.session import get_db

router = APIRouter(prefix="/api/runs", tags=["runs"])


def _run_to_response(r: ExperimentRunORM) -> RunResponse:
    return RunResponse(
        run_id=UUID(r.run_id),
        experiment_id=UUID(r.experiment_id),
        cycle_id=UUID(r.cycle_id),
        status=RunStatus(r.status),
        start_time=r.start_time,
        end_time=r.end_time,
        budget_cap_cents_override=r.budget_cap_cents_override,
        channel_config=r.channel_config or {},
        variant_snapshot=r.variant_snapshot or {},
        created_at=r.created_at,
        updated_at=r.updated_at,
    )


@router.post("", response_model=RunResponse)
def create_run(payload: RunCreate, db: Session = Depends(get_db)):
    exp = db.query(ExperimentORM).get(str(payload.experiment_id))
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")

    now = datetime.utcnow()
    r = ExperimentRunORM(
        run_id=str(uuid4()),
        experiment_id=str(payload.experiment_id),
        cycle_id=str(payload.cycle_id),
        status=payload.status.value,
        start_time=None,
        end_time=None,
        budget_cap_cents_override=payload.budget_cap_cents_override,
        channel_config=payload.channel_config,
        variant_snapshot=payload.variant_snapshot,
        created_at=now,
        updated_at=now,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return _run_to_response(r)


@router.get("", response_model=list[RunResponse])
def list_runs(
    cycle_id: UUID | None = None,
    experiment_id: UUID | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(ExperimentRunORM)
    if cycle_id:
        q = q.filter(ExperimentRunORM.cycle_id == str(cycle_id))
    if experiment_id:
        q = q.filter(ExperimentRunORM.experiment_id == str(experiment_id))
    rows = q.order_by(ExperimentRunORM.created_at.desc()).all()
    return [_run_to_response(r) for r in rows]


@router.get("/{run_id}", response_model=RunResponse)
def get_run(run_id: UUID, db: Session = Depends(get_db)):
    r = db.query(ExperimentRunORM).get(str(run_id))
    if not r:
        raise HTTPException(status_code=404, detail="Run not found")
    return _run_to_response(r)


@router.post("/{run_id}/request-reapproval", response_model=RunResponse)
def request_reapproval(run_id: UUID, db: Session = Depends(get_db)):
    r = db.query(ExperimentRunORM).get(str(run_id))
    if not r:
        raise HTTPException(status_code=404, detail="Run not found")
    if r.status != RunStatus.DRAFT.value:
        raise HTTPException(status_code=409, detail="Can only request reapproval from draft")
    r.status = RunStatus.AWAITING_APPROVAL.value
    r.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(r)
    return _run_to_response(r)


@router.post("/{run_id}/launch", response_model=RunResponse)
def launch_run(run_id: UUID, db: Session = Depends(get_db)):
    r = db.query(ExperimentRunORM).get(str(run_id))
    if not r:
        raise HTTPException(status_code=404, detail="Run not found")
    if r.status not in {RunStatus.DRAFT.value, RunStatus.AWAITING_APPROVAL.value}:
        raise HTTPException(status_code=409, detail="Run not launchable from current status")
    r.status = RunStatus.ACTIVE.value
    if r.start_time is None:
        r.start_time = datetime.utcnow()
    r.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(r)
    return _run_to_response(r)


@router.get("/{run_id}/metrics", response_model=RunMetricsResponse)
def get_run_metrics(run_id: UUID, db: Session = Depends(get_db)):
    r = db.query(ExperimentRunORM).get(str(run_id))
    if not r:
        raise HTTPException(status_code=404, detail="Run not found")

    obs = (
        db.query(ObservationORM)
        .filter(ObservationORM.run_id == str(run_id))
        .all()
    )

    total_spend = sum(o.spend_cents for o in obs)
    total_impressions = sum(o.impressions for o in obs)
    total_clicks = sum(o.clicks for o in obs)
    total_purchases = sum(o.purchases for o in obs)
    total_revenue = sum(o.revenue_cents for o in obs)
    windows_count = len(obs)

    ctr = (total_clicks / total_impressions) if total_impressions > 0 else None
    cpc = (total_spend / total_clicks) if total_clicks > 0 else None
    cpa = (total_spend / total_purchases) if total_purchases > 0 else None
    roas = (total_revenue / total_spend) if total_spend > 0 else None
    conversion_rate = (total_purchases / total_clicks) if total_clicks > 0 else None

    # You can tune this; placeholder:
    evidence_sufficient = windows_count >= 1 and total_spend > 0

    return RunMetricsResponse(
        run_id=run_id,
        total_spend_cents=total_spend,
        total_impressions=total_impressions,
        total_clicks=total_clicks,
        total_purchases=total_purchases,
        total_revenue_cents=total_revenue,
        windows_count=windows_count,
        ctr=ctr,
        cpc_cents=cpc,
        cpa_cents=cpa,
        roas=roas,
        conversion_rate=conversion_rate,
        evidence_sufficient=evidence_sufficient,
    )
```

```python
# src/growth/api/routes/observations.py
from __future__ import annotations

from uuid import uuid4, UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from growth.api.schemas import ObservationCreate, ObservationBulkCreate, ObservationResponse
from growth.infra.db.models import ObservationORM, ExperimentRunORM
from growth.infra.db.session import get_db

router = APIRouter(prefix="/api/observations", tags=["observations"])


def _obs_to_response(o: ObservationORM) -> ObservationResponse:
    return ObservationResponse(
        observation_id=UUID(o.observation_id),
        run_id=UUID(o.run_id),
        window_start=o.window_start,
        window_end=o.window_end,
        spend_cents=o.spend_cents,
        impressions=o.impressions,
        clicks=o.clicks,
        sessions=o.sessions,
        checkouts=o.checkouts,
        purchases=o.purchases,
        revenue_cents=o.revenue_cents,
        refunds=o.refunds,
        refund_cents=o.refund_cents,
        complaints=o.complaints,
        negative_comment_rate=o.negative_comment_rate,
        attribution_model=o.attribution_model,
        created_at=o.created_at,
    )


@router.post("", response_model=ObservationResponse)
def create_observation(payload: ObservationCreate, db: Session = Depends(get_db)):
    run = db.query(ExperimentRunORM).get(str(payload.run_id))
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    o = ObservationORM(
        observation_id=str(uuid4()),
        run_id=str(payload.run_id),
        window_start=payload.window_start,
        window_end=payload.window_end,
        spend_cents=payload.spend_cents,
        impressions=payload.impressions,
        clicks=payload.clicks,
        sessions=payload.sessions,
        checkouts=payload.checkouts,
        purchases=payload.purchases,
        revenue_cents=payload.revenue_cents,
        refunds=payload.refunds,
        refund_cents=payload.refund_cents,
        complaints=payload.complaints,
        negative_comment_rate=payload.negative_comment_rate,
        attribution_model=payload.attribution_model,
        raw_json=payload.raw_json,
        created_at=datetime.utcnow(),
    )
    db.add(o)
    db.commit()
    db.refresh(o)
    return _obs_to_response(o)


@router.post("/bulk", response_model=list[ObservationResponse])
def create_observations_bulk(payload: ObservationBulkCreate, db: Session = Depends(get_db)):
    # optional: validate all run_ids exist up front
    run_ids = {str(o.run_id) for o in payload.observations}
    existing = {
        r.run_id for r in db.query(ExperimentRunORM.run_id).filter(ExperimentRunORM.run_id.in_(run_ids)).all()
    }
    missing = run_ids - existing
    if missing:
        raise HTTPException(status_code=404, detail=f"Runs not found: {sorted(missing)}")

    now = datetime.utcnow()
    rows: list[ObservationORM] = []
    for o in payload.observations:
        rows.append(
            ObservationORM(
                observation_id=str(uuid4()),
                run_id=str(o.run_id),
                window_start=o.window_start,
                window_end=o.window_end,
                spend_cents=o.spend_cents,
                impressions=o.impressions,
                clicks=o.clicks,
                sessions=o.sessions,
                checkouts=o.checkouts,
                purchases=o.purchases,
                revenue_cents=o.revenue_cents,
                refunds=o.refunds,
                refund_cents=o.refund_cents,
                complaints=o.complaints,
                negative_comment_rate=o.negative_comment_rate,
                attribution_model=o.attribution_model,
                raw_json=o.raw_json,
                created_at=now,
            )
        )
    db.add_all(rows)
    db.commit()
    for r in rows:
        db.refresh(r)
    return [_obs_to_response(r) for r in rows]


@router.get("", response_model=list[ObservationResponse])
def list_observations(run_id: UUID, db: Session = Depends(get_db)):
    rows = (
        db.query(ObservationORM)
        .filter(ObservationORM.run_id == str(run_id))
        .order_by(ObservationORM.window_start.asc())
        .all()
    )
    return [_obs_to_response(o) for o in rows]
```

```python
# src/growth/api/routes/decisions.py
from __future__ import annotations

from uuid import uuid4, UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from growth.domain.models import RunStatus, DecisionAction
from growth.api.schemas import DecisionResponse
from growth.infra.db.models import DecisionORM, ExperimentRunORM, ObservationORM
from growth.infra.db.session import get_db

router = APIRouter(prefix="/api/decisions", tags=["decisions"])


def _decision_to_response(d: DecisionORM) -> DecisionResponse:
    return DecisionResponse(
        decision_id=UUID(d.decision_id),
        run_id=UUID(d.run_id),
        action=DecisionAction(d.action),
        confidence=d.confidence,
        rationale=d.rationale,
        policy_version=d.policy_version,
        metrics_snapshot=d.metrics_snapshot or {},
        created_at=d.created_at,
    )


@router.get("", response_model=list[DecisionResponse])
def list_decisions(run_id: UUID, db: Session = Depends(get_db)):
    rows = (
        db.query(DecisionORM)
        .filter(DecisionORM.run_id == str(run_id))
        .order_by(DecisionORM.created_at.desc())
        .all()
    )
    return [_decision_to_response(d) for d in rows]


@router.post("/evaluate/{run_id}", response_model=DecisionResponse)
def evaluate_run(run_id: UUID, db: Session = Depends(get_db)):
    run = db.query(ExperimentRunORM).get(str(run_id))
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.status != RunStatus.ACTIVE.value:
        raise HTTPException(status_code=409, detail="Can only evaluate an ACTIVE run")

    # Pull observations
    obs = db.query(ObservationORM).filter(ObservationORM.run_id == str(run_id)).all()

    # TODO: call your real deterministic decision engine here.
    # Placeholder: decide based on purchases and spend.
    total_spend = sum(o.spend_cents for o in obs)
    total_purchases = sum(o.purchases for o in obs)

    if total_purchases >= 3:
        action = DecisionAction.SCALE
        confidence = 0.7
        rationale = "Purchases signal positive ROI; scaling recommended."
    elif total_spend > 0 and total_purchases == 0:
        action = DecisionAction.KILL
        confidence = 0.6
        rationale = "Spend without conversions; kill recommended."
    else:
        action = DecisionAction.HOLD
        confidence = 0.55
        rationale = "Insufficient evidence; hold and gather more data."

    metrics_snapshot = {
        "total_spend_cents": total_spend,
        "total_purchases": total_purchases,
        "windows_count": len(obs),
    }

    d = DecisionORM(
        decision_id=str(uuid4()),
        run_id=str(run_id),
        action=action.value,
        confidence=confidence,
        rationale=rationale,
        policy_version="v1",
        metrics_snapshot=metrics_snapshot,
        created_at=datetime.utcnow(),
    )
    db.add(d)

    # Transition run to decided
    run.status = RunStatus.DECIDED.value
    run.end_time = datetime.utcnow()
    run.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(d)
    return _decision_to_response(d)
```

### Router registration

```python
# src/growth/api/app.py (or wherever)
from fastapi import FastAPI
from growth.api.routes.experiments import router as experiments_router
from growth.api.routes.runs import router as runs_router
from growth.api.routes.observations import router as observations_router
from growth.api.routes.decisions import router as decisions_router

app = FastAPI()
app.include_router(experiments_router)
app.include_router(runs_router)
app.include_router(observations_router)
app.include_router(decisions_router)
```

---

# 5) Frontend: query keys + hooks (TanStack Query)

### Query keys

```ts
// frontend/shared/queryKeys.ts
export const experimentKeys = {
  list: (showId: string) => ["experiments", "list", showId] as const,
  detail: (experimentId: string) => ["experiments", "detail", experimentId] as const,
};

export const runKeys = {
  listByCycle: (cycleId: string) => ["runs", "list", "cycle", cycleId] as const,
  listByExperiment: (experimentId: string) => ["runs", "list", "experiment", experimentId] as const,
  detail: (runId: string) => ["runs", "detail", runId] as const,
  metrics: (runId: string) => ["runs", "metrics", runId] as const,
};

export const observationKeys = {
  list: (runId: string) => ["observations", "list", runId] as const,
};

export const decisionKeys = {
  list: (runId: string) => ["decisions", "list", runId] as const,
};
```

### Hooks (using your generated OpenAPI client patterns)

I’ll write these in a generic “fetch” style; swap in your existing `client.ts` wrapper.

```ts
// frontend/features/runs/queries.ts
import { useQuery } from "@tanstack/react-query";
import { runKeys } from "@/shared/queryKeys";
import { api } from "@/shared/api/client"; // your wrapper

export function useRunsByCycle(cycleId: string) {
  return useQuery({
    queryKey: runKeys.listByCycle(cycleId),
    enabled: !!cycleId,
    queryFn: async () => {
      const res = await api.get("/api/runs", { params: { cycle_id: cycleId } });
      return res.data;
    },
  });
}

export function useRun(runId: string) {
  return useQuery({
    queryKey: runKeys.detail(runId),
    enabled: !!runId,
    queryFn: async () => {
      const res = await api.get(`/api/runs/${runId}`);
      return res.data;
    },
  });
}

export function useRunMetrics(runId: string) {
  return useQuery({
    queryKey: runKeys.metrics(runId),
    enabled: !!runId,
    queryFn: async () => {
      const res = await api.get(`/api/runs/${runId}/metrics`);
      return res.data;
    },
  });
}
```

```ts
// frontend/features/observations/queries.ts
import { useQuery } from "@tanstack/react-query";
import { observationKeys } from "@/shared/queryKeys";
import { api } from "@/shared/api/client";

export function useObservations(runId: string) {
  return useQuery({
    queryKey: observationKeys.list(runId),
    enabled: !!runId,
    queryFn: async () => {
      const res = await api.get("/api/observations", { params: { run_id: runId } });
      return res.data;
    },
  });
}
```

```ts
// frontend/features/decisions/queries.ts
import { useQuery } from "@tanstack/react-query";
import { decisionKeys } from "@/shared/queryKeys";
import { api } from "@/shared/api/client";

export function useDecisions(runId: string) {
  return useQuery({
    queryKey: decisionKeys.list(runId),
    enabled: !!runId,
    queryFn: async () => {
      const res = await api.get("/api/decisions", { params: { run_id: runId } });
      return res.data;
    },
  });
}
```

### Mutations you’ll want immediately

```ts
// frontend/features/runs/mutations.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { runKeys, decisionKeys } from "@/shared/queryKeys";

export function useCreateRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => (await api.post("/api/runs", payload)).data,
    onSuccess: (run) => {
      qc.invalidateQueries({ queryKey: runKeys.listByCycle(run.cycle_id) });
      qc.invalidateQueries({ queryKey: runKeys.listByExperiment(run.experiment_id) });
    },
  });
}

export function useLaunchRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (runId: string) => (await api.post(`/api/runs/${runId}/launch`)).data,
    onSuccess: (run) => {
      qc.invalidateQueries({ queryKey: runKeys.detail(run.run_id) });
      qc.invalidateQueries({ queryKey: runKeys.listByCycle(run.cycle_id) });
    },
  });
}

export function useEvaluateRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (runId: string) => (await api.post(`/api/decisions/evaluate/${runId}`)).data,
    onSuccess: (decision) => {
      qc.invalidateQueries({ queryKey: decisionKeys.list(decision.run_id) });
      qc.invalidateQueries({ queryKey: runKeys.detail(decision.run_id) }); // if your run endpoint returns status, etc.
      qc.invalidateQueries({ queryKey: runKeys.metrics(decision.run_id) });
    },
  });
}
```

---

# 6) Delete/replace your old endpoints (fresh DB, so be ruthless)

You should remove (or 410) these to avoid mixed mental models:

* `POST /api/experiments/{id}/launch`
* `POST /api/experiments/{id}/request-reapproval`
* `POST /api/decisions/evaluate/{experiment_id}`
* `GET /api/observations?experiment_id=`
* `GET /api/decisions?experiment_id=`
* `GET /api/experiments/{id}/metrics` (replace with run metrics)

Replace with:

* run-based launch/evaluate
* observations/decisions keyed by `run_id`
* metrics keyed by `run_id`

---

# 7) What you do next in the UI (quick wiring)

Cycle pages should fetch:

1. `useRunsByCycle(cycleId)`
2. for each run selected, `useObservations(runId)` and `useDecisions(runId)` or show on-demand
3. show-level experiment library page uses `useExperiments(showId)` and `useCreateRun()` to “Run this in this cycle”

This gives you:

* a clean cycle-specific Run/Results view
* a clean show-level experiment definition library
* explicit carry-forward via “Create Run in current cycle”
