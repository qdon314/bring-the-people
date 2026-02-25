"""Dependency injection container. Wires ports to adapters."""
from __future__ import annotations

from pathlib import Path

from sqlalchemy.orm import Session

from growth.adapters.event_log import JSONLEventLog
from growth.adapters.orm import create_tables, get_engine, get_session_maker
from growth.adapters.repositories import (
    SQLAlchemyExperimentRepository,
    SQLAlchemyFrameRepository,
    SQLAlchemySegmentRepository,
    SQLAlchemyShowRepository,
)
from growth.domain.policy_config import load_policy_config


class Container:
    """Application-level dependency container.

    Owns the database engine, session factory, and configuration.
    Use session_container() to create a short-lived SessionContainer
    scoped to a single request or background job.
    """

    def __init__(
        self,
        db_url: str = "sqlite:///growth.db",
        event_log_path: str | Path = "data/events.jsonl",
        policy_config_path: str | Path = "config/policy.toml",
        runs_path: str | Path = "data/runs",
    ):
        self._engine = get_engine(db_url)
        create_tables(self._engine)
        self._session_maker = get_session_maker(self._engine)
        self._event_log_path = Path(event_log_path)
        self._policy_config_path = Path(policy_config_path)
        self._runs_path = Path(runs_path)
        self._policy = None

    def session_container(self) -> SessionContainer:
        """Create a new SessionContainer with its own DB session."""
        session = self._session_maker()
        return SessionContainer(session, self)

    def event_log(self) -> JSONLEventLog:
        return JSONLEventLog(self._event_log_path)

    def policy_config(self):
        if self._policy is None:
            self._policy = load_policy_config(self._policy_config_path)
        return self._policy


class SessionContainer:
    """Short-lived container scoped to one request or job. Owns a DB session."""

    def __init__(self, session: Session, parent: Container):
        self._session = session
        self._parent = parent

    def close(self) -> None:
        self._session.close()

    # --- Repositories (each uses this container's session) ---

    def show_repo(self) -> SQLAlchemyShowRepository:
        return SQLAlchemyShowRepository(self._session)

    def experiment_repo(self) -> SQLAlchemyExperimentRepository:
        return SQLAlchemyExperimentRepository(self._session)

    def segment_repo(self) -> SQLAlchemySegmentRepository:
        return SQLAlchemySegmentRepository(self._session)

    def frame_repo(self) -> SQLAlchemyFrameRepository:
        return SQLAlchemyFrameRepository(self._session)

    def variant_repo(self):
        from growth.adapters.repositories import SQLAlchemyCreativeVariantRepository
        return SQLAlchemyCreativeVariantRepository(self._session)

    def memo_repo(self):
        from growth.adapters.repositories import SQLAlchemyProducerMemoRepository
        return SQLAlchemyProducerMemoRepository(self._session)

    def cycle_repo(self):
        from growth.adapters.repositories import SQLAlchemyCycleRepository
        return SQLAlchemyCycleRepository(self._session)

    def job_repo(self):
        from growth.adapters.repositories import SQLAlchemyJobRepository
        return SQLAlchemyJobRepository(self._session)

    # --- Non-session deps (delegate to parent) ---

    def event_log(self) -> JSONLEventLog:
        return self._parent.event_log()

    def policy_config(self):
        return self._parent.policy_config()

    def claude_client(self):
        from growth.adapters.llm.client import ClaudeClient
        return ClaudeClient()

    # --- Services ---

    def decision_service(self):
        from growth.app.services.decision_service import DecisionService
        return DecisionService(
            experiment_repo=self.experiment_repo(),
            event_log=self.event_log(),
            policy=self.policy_config(),
        )

    def strategy_service(self):
        from growth.app.services.strategy_service import StrategyService
        return StrategyService(
            claude_client=self.claude_client(),
            show_repo=self.show_repo(),
            exp_repo=self.experiment_repo(),
            seg_repo=self.segment_repo(),
            frame_repo=self.frame_repo(),
            cycle_repo=self.cycle_repo(),
            event_log=self.event_log(),
            policy=self.policy_config(),
            runs_path=self._parent._runs_path,
        )

    def creative_service(self):
        from growth.app.services.creative_service import CreativeService
        return CreativeService(
            claude_client=self.claude_client(),
            frame_repo=self.frame_repo(),
            seg_repo=self.segment_repo(),
            show_repo=self.show_repo(),
            variant_repo=self.variant_repo(),
            event_log=self.event_log(),
            runs_path=self._parent._runs_path,
        )

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
            runs_path=self._parent._runs_path,
        )
