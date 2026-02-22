"""SQLAlchemy repository implementations."""
from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from growth.adapters.orm import (
    DecisionORM,
    ExperimentORM,
    ObservationORM,
    ShowORM,
)
from growth.domain.models import (
    Decision,
    Experiment,
    ExperimentStatus,
    Observation,
    Show,
)
from growth.ports.repositories import (
    ExperimentRepository,
    ShowRepository,
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
    )


def _observation_to_domain(orm: ObservationORM) -> Observation:
    """Convert ObservationORM to domain Observation."""
    from datetime import timezone
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
