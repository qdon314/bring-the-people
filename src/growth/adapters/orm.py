"""SQLAlchemy ORM models for persistence."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import (
    JSON,
    DateTime,
    ForeignKey,
    Integer,
    String,
    create_engine,
)
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
    relationship,
    sessionmaker,
)


class Base(DeclarativeBase):
    pass


class ShowORM(Base):
    __tablename__ = "shows"

    show_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    artist_name: Mapped[str] = mapped_column(String(255))
    city: Mapped[str] = mapped_column(String(100))
    venue: Mapped[str] = mapped_column(String(255))
    show_time: Mapped[datetime] = mapped_column(DateTime)
    timezone: Mapped[str] = mapped_column(String(50))
    capacity: Mapped[int] = mapped_column(Integer)
    tickets_total: Mapped[int] = mapped_column(Integer)
    tickets_sold: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(3), default="USD")

    experiments: Mapped[list["ExperimentORM"]] = relationship(
        back_populates="show", cascade="all, delete-orphan"
    )


class ExperimentORM(Base):
    __tablename__ = "experiments"

    experiment_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    show_id: Mapped[str] = mapped_column(ForeignKey("shows.show_id"))
    segment_id: Mapped[str] = mapped_column(String(36))
    frame_id: Mapped[str] = mapped_column(String(36))
    channel: Mapped[str] = mapped_column(String(50))
    objective: Mapped[str] = mapped_column(String(100))
    budget_cap_cents: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(50))
    start_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    baseline_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON)

    show: Mapped["ShowORM"] = relationship(back_populates="experiments")
    observations: Mapped[list["ObservationORM"]] = relationship(
        back_populates="experiment", cascade="all, delete-orphan"
    )
    decisions: Mapped[list["DecisionORM"]] = relationship(
        back_populates="experiment", cascade="all, delete-orphan"
    )


class ObservationORM(Base):
    __tablename__ = "observations"

    observation_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    experiment_id: Mapped[str] = mapped_column(ForeignKey("experiments.experiment_id"))
    window_start: Mapped[datetime] = mapped_column(DateTime)
    window_end: Mapped[datetime] = mapped_column(DateTime)
    spend_cents: Mapped[int] = mapped_column(Integer)
    impressions: Mapped[int] = mapped_column(Integer)
    clicks: Mapped[int] = mapped_column(Integer)
    sessions: Mapped[int] = mapped_column(Integer)
    checkouts: Mapped[int] = mapped_column(Integer)
    purchases: Mapped[int] = mapped_column(Integer)
    revenue_cents: Mapped[int] = mapped_column(Integer)
    refunds: Mapped[int] = mapped_column(Integer)
    refund_cents: Mapped[int] = mapped_column(Integer)
    complaints: Mapped[int] = mapped_column(Integer)
    negative_comment_rate: Mapped[Optional[float]] = mapped_column(nullable=True)
    attribution_model: Mapped[str] = mapped_column(String(50))
    raw_json: Mapped[dict[str, Any]] = mapped_column(JSON)

    experiment: Mapped["ExperimentORM"] = relationship(back_populates="observations")


class DecisionORM(Base):
    __tablename__ = "decisions"

    decision_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    experiment_id: Mapped[str] = mapped_column(ForeignKey("experiments.experiment_id"))
    action: Mapped[str] = mapped_column(String(20))
    confidence: Mapped[float] = mapped_column()
    rationale: Mapped[str] = mapped_column(String(500))
    policy_version: Mapped[str] = mapped_column(String(20))
    metrics_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON)

    experiment: Mapped["ExperimentORM"] = relationship(back_populates="decisions")


class AudienceSegmentORM(Base):
    __tablename__ = "audience_segments"

    segment_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    show_id: Mapped[str] = mapped_column(ForeignKey("shows.show_id"))
    name: Mapped[str] = mapped_column(String(255))
    definition_json: Mapped[dict[str, Any]] = mapped_column(JSON)
    estimated_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_by: Mapped[str] = mapped_column(String(100))


class CreativeFrameORM(Base):
    __tablename__ = "creative_frames"

    frame_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    show_id: Mapped[str] = mapped_column(ForeignKey("shows.show_id"))
    segment_id: Mapped[str] = mapped_column(ForeignKey("audience_segments.segment_id"))
    hypothesis: Mapped[str] = mapped_column(String(500))
    promise: Mapped[str] = mapped_column(String(500))
    evidence_refs: Mapped[list[dict[str, Any]]] = mapped_column(JSON)
    channel: Mapped[str] = mapped_column(String(50))
    risk_notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)


class CreativeVariantORM(Base):
    __tablename__ = "creative_variants"

    variant_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    frame_id: Mapped[str] = mapped_column(ForeignKey("creative_frames.frame_id"))
    platform: Mapped[str] = mapped_column(String(50))
    hook: Mapped[str] = mapped_column(String(500))
    body: Mapped[str] = mapped_column(String(2000))
    cta: Mapped[str] = mapped_column(String(200))
    constraints_passed: Mapped[int] = mapped_column(Integer, default=0)


class ProducerMemoORM(Base):
    __tablename__ = "producer_memos"

    memo_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    show_id: Mapped[str] = mapped_column(ForeignKey("shows.show_id"))
    cycle_start: Mapped[datetime] = mapped_column(DateTime)
    cycle_end: Mapped[datetime] = mapped_column(DateTime)
    markdown: Mapped[str] = mapped_column(String(10000))
class CycleORM(Base):
    __tablename__ = "cycles"

    cycle_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    show_id: Mapped[str] = mapped_column(ForeignKey("shows.show_id"))
    started_at: Mapped[datetime] = mapped_column(DateTime)
    label: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)


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


def get_engine(db_url: str = "sqlite:///growth.db"):
    """Create a SQLAlchemy engine."""
    return create_engine(db_url, echo=False)


def get_session_maker(engine):
    """Create a session maker bound to the engine."""
    return sessionmaker(bind=engine)


def create_tables(engine):
    """Create all tables."""
    Base.metadata.create_all(engine)
