"""SQLAlchemy repository implementations."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from growth.adapters.orm import (
    AudienceSegmentORM,
    BackgroundJobORM,
    CreativeFrameORM,
    CreativeVariantORM,
    CycleORM,
    DecisionORM,
    ExperimentORM,
    ObservationORM,
    ProducerMemoORM,
    ShowORM,
)
from growth.domain.models import (
    AudienceSegment,
    BackgroundJob,
    CreativeFrame,
    CreativeVariant,
    Cycle,
    Decision,
    DecisionAction,
    Experiment,
    ExperimentStatus,
    JobStatus,
    JobType,
    Observation,
    ProducerMemo,
    Show,
)
from growth.ports.repositories import (
    CreativeVariantRepository,
    ExperimentRepository,
    FrameRepository,
    JobRepository,
    ProducerMemoRepository,
    SegmentRepository,
    ShowRepository,
    CycleRepository,
)


def _show_to_domain(orm: ShowORM) -> Show:
    """Convert ShowORM to domain Show."""
    from datetime import timezone
    return Show(
        show_id=UUID(orm.show_id),
        artist_name=orm.artist_name,
        city=orm.city,
        venue=orm.venue,
        show_time=orm.show_time.replace(tzinfo=timezone.utc),
        timezone=orm.timezone,
        capacity=orm.capacity,
        tickets_total=orm.tickets_total,
        tickets_sold=orm.tickets_sold,
        currency=orm.currency,
        ticket_base_url=orm.ticket_base_url,
    )


def _show_to_orm(domain: Show) -> ShowORM:
    """Convert domain Show to ShowORM."""
    return ShowORM(
        show_id=str(domain.show_id),
        artist_name=domain.artist_name,
        city=domain.city,
        venue=domain.venue,
        show_time=domain.show_time,
        timezone=domain.timezone,
        capacity=domain.capacity,
        tickets_total=domain.tickets_total,
        tickets_sold=domain.tickets_sold,
        currency=domain.currency,
        ticket_base_url=domain.ticket_base_url,
    )


def _experiment_to_domain(orm: ExperimentORM) -> Experiment:
    """Convert ExperimentORM to domain Experiment."""
    from datetime import timezone
    return Experiment(
        experiment_id=UUID(orm.experiment_id),
        show_id=UUID(orm.show_id),
        segment_id=UUID(orm.segment_id),
        frame_id=UUID(orm.frame_id),
        channel=orm.channel,
        objective=orm.objective,
        budget_cap_cents=orm.budget_cap_cents,
        status=ExperimentStatus(orm.status),
        start_time=orm.start_time.replace(tzinfo=timezone.utc) if orm.start_time else None,
        end_time=orm.end_time.replace(tzinfo=timezone.utc) if orm.end_time else None,
        baseline_snapshot=orm.baseline_snapshot,
        cycle_id=UUID(orm.cycle_id) if orm.cycle_id else None,
    )


def _experiment_to_orm(domain: Experiment) -> ExperimentORM:
    """Convert domain Experiment to ExperimentORM."""
    return ExperimentORM(
        experiment_id=str(domain.experiment_id),
        show_id=str(domain.show_id),
        segment_id=str(domain.segment_id),
        frame_id=str(domain.frame_id),
        channel=domain.channel,
        objective=domain.objective,
        budget_cap_cents=domain.budget_cap_cents,
        status=domain.status.value,
        start_time=domain.start_time,
        end_time=domain.end_time,
        baseline_snapshot=domain.baseline_snapshot,
        cycle_id=str(domain.cycle_id) if domain.cycle_id else None,
    )


def _observation_to_domain(orm: ObservationORM) -> Observation:
    """Convert ObservationORM to domain Observation."""
    return Observation(
        observation_id=UUID(orm.observation_id),
        experiment_id=UUID(orm.experiment_id),
        window_start=orm.window_start.replace(tzinfo=timezone.utc),
        window_end=orm.window_end.replace(tzinfo=timezone.utc),
        spend_cents=orm.spend_cents,
        impressions=orm.impressions,
        clicks=orm.clicks,
        sessions=orm.sessions,
        checkouts=orm.checkouts,
        purchases=orm.purchases,
        revenue_cents=orm.revenue_cents,
        refunds=orm.refunds,
        refund_cents=orm.refund_cents,
        complaints=orm.complaints,
        negative_comment_rate=orm.negative_comment_rate,
        attribution_model=orm.attribution_model,
        raw_json=orm.raw_json,
    )


def _observation_to_orm(domain: Observation) -> ObservationORM:
    """Convert domain Observation to ObservationORM."""
    return ObservationORM(
        observation_id=str(domain.observation_id),
        experiment_id=str(domain.experiment_id),
        window_start=domain.window_start,
        window_end=domain.window_end,
        spend_cents=domain.spend_cents,
        impressions=domain.impressions,
        clicks=domain.clicks,
        sessions=domain.sessions,
        checkouts=domain.checkouts,
        purchases=domain.purchases,
        revenue_cents=domain.revenue_cents,
        refunds=domain.refunds,
        refund_cents=domain.refund_cents,
        complaints=domain.complaints,
        negative_comment_rate=domain.negative_comment_rate,
        attribution_model=domain.attribution_model,
        raw_json=domain.raw_json,
    )


def _decision_to_orm(domain: Decision) -> DecisionORM:
    """Convert domain Decision to DecisionORM."""
    return DecisionORM(
        decision_id=str(domain.decision_id),
        experiment_id=str(domain.experiment_id),
        action=domain.action.value,
        confidence=domain.confidence,
        rationale=domain.rationale,
        policy_version=domain.policy_version,
        metrics_snapshot=domain.metrics_snapshot,
    )


def _decision_to_domain(orm: DecisionORM) -> Decision:
    """Convert DecisionORM to domain Decision."""
    return Decision(
        decision_id=UUID(orm.decision_id),
        experiment_id=UUID(orm.experiment_id),
        action=DecisionAction(orm.action),
        confidence=orm.confidence,
        rationale=orm.rationale,
        policy_version=orm.policy_version,
        metrics_snapshot=orm.metrics_snapshot,
    )


class SQLAlchemyShowRepository(ShowRepository):
    """SQLAlchemy implementation of ShowRepository."""

    def __init__(self, session: Session):
        self._session = session

    def get_by_id(self, show_id: UUID) -> Show | None:
        orm = self._session.get(ShowORM, str(show_id))
        if orm is None:
            return None
        return _show_to_domain(orm)

    def save(self, show: Show) -> None:
        orm = _show_to_orm(show)
        self._session.merge(orm)
        self._session.commit()

    def list_all(self) -> list[Show]:
        orms = self._session.query(ShowORM).all()
        return [_show_to_domain(orm) for orm in orms]


class SQLAlchemyExperimentRepository(ExperimentRepository):
    """SQLAlchemy implementation of ExperimentRepository."""

    def __init__(self, session: Session):
        self._session = session

    def get_by_id(self, experiment_id: UUID) -> Experiment | None:
        orm = self._session.get(ExperimentORM, str(experiment_id))
        if orm is None:
            return None
        return _experiment_to_domain(orm)

    def save(self, experiment: Experiment) -> None:
        orm = _experiment_to_orm(experiment)
        self._session.merge(orm)
        self._session.commit()

    def get_by_show(self, show_id: UUID) -> list[Experiment]:
        orms = self._session.query(ExperimentORM).filter_by(show_id=str(show_id)).all()
        return [_experiment_to_domain(orm) for orm in orms]

    def add_observation(self, observation: Observation) -> None:
        orm = _observation_to_orm(observation)
        self._session.merge(orm)
        self._session.commit()

    def get_observations(self, experiment_id: UUID) -> list[Observation]:
        orms = self._session.query(ObservationORM).filter_by(
            experiment_id=str(experiment_id)
        ).all()
        return [_observation_to_domain(orm) for orm in orms]

    def save_decision(self, decision: Decision) -> None:
        orm = _decision_to_orm(decision)
        self._session.merge(orm)
        self._session.commit()

    def get_decisions(self, experiment_id: UUID) -> list[Decision]:
        orms = self._session.query(DecisionORM).filter_by(
            experiment_id=str(experiment_id)
        ).all()
        return [_decision_to_domain(orm) for orm in orms]


def _segment_to_domain(orm: AudienceSegmentORM) -> AudienceSegment:
    """Convert AudienceSegmentORM to domain AudienceSegment."""
    return AudienceSegment(
        segment_id=UUID(orm.segment_id),
        show_id=UUID(orm.show_id),
        name=orm.name,
        definition_json=orm.definition_json,
        estimated_size=orm.estimated_size,
        created_by=orm.created_by,
        cycle_id=UUID(orm.cycle_id) if orm.cycle_id else None,
        review_status=orm.review_status,
        reviewed_at=orm.reviewed_at,
        reviewed_by=orm.reviewed_by,
    )


def _segment_to_orm(domain: AudienceSegment) -> AudienceSegmentORM:
    """Convert domain AudienceSegment to AudienceSegmentORM."""
    return AudienceSegmentORM(
        segment_id=str(domain.segment_id),
        show_id=str(domain.show_id),
        name=domain.name,
        definition_json=domain.definition_json,
        estimated_size=domain.estimated_size,
        created_by=domain.created_by,
        cycle_id=str(domain.cycle_id) if domain.cycle_id else None,
        review_status=domain.review_status,
        reviewed_at=domain.reviewed_at,
        reviewed_by=domain.reviewed_by,
    )


def _frame_to_domain(orm: CreativeFrameORM) -> CreativeFrame:
    """Convert CreativeFrameORM to domain CreativeFrame."""
    return CreativeFrame(
        frame_id=UUID(orm.frame_id),
        show_id=UUID(orm.show_id),
        segment_id=UUID(orm.segment_id),
        hypothesis=orm.hypothesis,
        promise=orm.promise,
        evidence_refs=orm.evidence_refs,
        channel=orm.channel,
        risk_notes=orm.risk_notes,
        cycle_id=UUID(orm.cycle_id) if orm.cycle_id else None,
        review_status=orm.review_status,
        reviewed_at=orm.reviewed_at,
        reviewed_by=orm.reviewed_by,
    )


def _frame_to_orm(domain: CreativeFrame) -> CreativeFrameORM:
    """Convert domain CreativeFrame to CreativeFrameORM."""
    return CreativeFrameORM(
        frame_id=str(domain.frame_id),
        show_id=str(domain.show_id),
        segment_id=str(domain.segment_id),
        hypothesis=domain.hypothesis,
        promise=domain.promise,
        evidence_refs=domain.evidence_refs,
        channel=domain.channel,
        risk_notes=domain.risk_notes,
        cycle_id=str(domain.cycle_id) if domain.cycle_id else None,
        review_status=domain.review_status,
        reviewed_at=domain.reviewed_at,
        reviewed_by=domain.reviewed_by,
    )


class SQLAlchemySegmentRepository(SegmentRepository):
    """SQLAlchemy implementation of SegmentRepository."""

    def __init__(self, session: Session):
        self._session = session

    def get_by_id(self, segment_id: UUID) -> AudienceSegment | None:
        orm = self._session.get(AudienceSegmentORM, str(segment_id))
        if orm is None:
            return None
        return _segment_to_domain(orm)

    def save(self, segment: AudienceSegment) -> None:
        orm = _segment_to_orm(segment)
        self._session.merge(orm)
        self._session.commit()

    def get_by_show(self, show_id: UUID) -> list[AudienceSegment]:
        orms = self._session.query(AudienceSegmentORM).filter_by(show_id=str(show_id)).all()
        return [_segment_to_domain(orm) for orm in orms]


class SQLAlchemyFrameRepository(FrameRepository):
    """SQLAlchemy implementation of FrameRepository."""

    def __init__(self, session: Session):
        self._session = session

    def get_by_id(self, frame_id: UUID) -> CreativeFrame | None:
        orm = self._session.get(CreativeFrameORM, str(frame_id))
        if orm is None:
            return None
        return _frame_to_domain(orm)

    def save(self, frame: CreativeFrame) -> None:
        orm = _frame_to_orm(frame)
        self._session.merge(orm)
        self._session.commit()

    def get_by_show(self, show_id: UUID) -> list[CreativeFrame]:
        orms = self._session.query(CreativeFrameORM).filter_by(show_id=str(show_id)).all()
        return [_frame_to_domain(orm) for orm in orms]


def _variant_to_domain(orm: CreativeVariantORM) -> CreativeVariant:
    return CreativeVariant(
        variant_id=UUID(orm.variant_id),
        frame_id=UUID(orm.frame_id),
        platform=orm.platform,
        hook=orm.hook,
        body=orm.body,
        cta=orm.cta,
        constraints_passed=bool(orm.constraints_passed),
        cycle_id=UUID(orm.cycle_id) if orm.cycle_id else None,
        review_status=orm.review_status,
        reviewed_at=orm.reviewed_at,
        reviewed_by=orm.reviewed_by,
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
        cycle_id=str(domain.cycle_id) if domain.cycle_id else None,
        review_status=domain.review_status,
        reviewed_at=domain.reviewed_at,
        reviewed_by=domain.reviewed_by,
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


def _memo_to_domain(orm: ProducerMemoORM) -> ProducerMemo:
    from datetime import timezone
    return ProducerMemo(
        memo_id=UUID(orm.memo_id),
        show_id=UUID(orm.show_id),
        cycle_start=orm.cycle_start.replace(tzinfo=timezone.utc),
        cycle_end=orm.cycle_end.replace(tzinfo=timezone.utc),
        markdown=orm.markdown,
        cycle_id=UUID(orm.cycle_id) if orm.cycle_id else None,
    )


def _memo_to_orm(domain: ProducerMemo) -> ProducerMemoORM:
    return ProducerMemoORM(
        memo_id=str(domain.memo_id),
        show_id=str(domain.show_id),
        cycle_start=domain.cycle_start,
        cycle_end=domain.cycle_end,
        markdown=domain.markdown,
        cycle_id=str(domain.cycle_id) if domain.cycle_id else None,
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


# --- Cycle ---

def _cycle_to_domain(orm: CycleORM) -> Cycle:
    from datetime import timezone
    return Cycle(
        cycle_id=UUID(orm.cycle_id),
        show_id=UUID(orm.show_id),
        started_at=orm.started_at.replace(tzinfo=timezone.utc),
        label=orm.label,
    )


def _cycle_to_orm(domain: Cycle) -> CycleORM:
    return CycleORM(
        cycle_id=str(domain.cycle_id),
        show_id=str(domain.show_id),
        started_at=domain.started_at,
        label=domain.label,
    )


class SQLAlchemyCycleRepository(CycleRepository):
    def __init__(self, session: Session):
        self._session = session

    def get_by_id(self, cycle_id: UUID) -> Cycle | None:
        orm = self._session.get(CycleORM, str(cycle_id))
        if orm is None:
            return None
        return _cycle_to_domain(orm)

    def save(self, cycle: Cycle) -> None:
        orm = _cycle_to_orm(cycle)
        self._session.merge(orm)
        self._session.commit()

    def get_by_show(self, show_id: UUID) -> list[Cycle]:
        orms = (
            self._session.query(CycleORM)
            .filter_by(show_id=str(show_id))
            .order_by(CycleORM.started_at.desc())
            .all()
        )
        return [_cycle_to_domain(orm) for orm in orms]


# --- Background Jobs ---

def _job_to_domain(orm: BackgroundJobORM) -> BackgroundJob:
    from datetime import timezone
    return BackgroundJob(
        job_id=UUID(orm.job_id),
        job_type=JobType(orm.job_type),
        status=JobStatus(orm.status),
        show_id=UUID(orm.show_id),
        input_json=orm.input_json,
        result_json=orm.result_json,
        error_message=orm.error_message,
        attempt_count=orm.attempt_count,
        last_heartbeat_at=orm.last_heartbeat_at.replace(tzinfo=timezone.utc) if orm.last_heartbeat_at else None,
        created_at=orm.created_at.replace(tzinfo=timezone.utc),
        updated_at=orm.updated_at.replace(tzinfo=timezone.utc),
        completed_at=orm.completed_at.replace(tzinfo=timezone.utc) if orm.completed_at else None,
    )


def _job_to_orm(domain: BackgroundJob) -> BackgroundJobORM:
    return BackgroundJobORM(
        job_id=str(domain.job_id),
        job_type=domain.job_type.value,
        status=domain.status.value,
        show_id=str(domain.show_id),
        input_json=domain.input_json,
        result_json=domain.result_json,
        error_message=domain.error_message,
        attempt_count=domain.attempt_count,
        last_heartbeat_at=domain.last_heartbeat_at,
        created_at=domain.created_at,
        updated_at=domain.updated_at,
        completed_at=domain.completed_at,
    )


class SQLAlchemyJobRepository(JobRepository):
    def __init__(self, session: Session):
        self._session = session

    def get_by_id(self, job_id: UUID) -> BackgroundJob | None:
        try:
            orm = self._session.get(BackgroundJobORM, str(job_id))
        except Exception:
            self._session.rollback()
            raise
        if orm is None:
            return None
        return _job_to_domain(orm)

    def save(self, job: BackgroundJob) -> None:
        orm = _job_to_orm(job)
        try:
            self._session.merge(orm)
            self._session.commit()
        except Exception:
            self._session.rollback()
            raise

    def claim_next_queued(self) -> BackgroundJob | None:
        from datetime import timezone
        now = datetime.now(timezone.utc)
        try:
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
        except Exception:
            self._session.rollback()
            raise
        return _job_to_domain(orm)

    def reset_stale_running_jobs(self, stale_after_seconds: int = 120) -> int:
        from datetime import timezone
        cutoff = datetime.now(timezone.utc) - timedelta(seconds=stale_after_seconds)
        try:
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
        except Exception:
            self._session.rollback()
            raise
        return len(stale)
