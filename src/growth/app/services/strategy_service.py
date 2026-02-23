"""Strategy service — orchestrates a Strategy Agent run."""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import List, cast
from uuid import UUID, uuid4

from growth.adapters.llm.agent_runner import run as run_agent
from growth.adapters.llm.client import ClaudeClient
from growth.adapters.llm.errors import AgentAPIError, AgentParseError, AgentTurnLimitError
from growth.adapters.llm.prompts.strategy import (
    STRATEGY_SYSTEM_PROMPT,
    STRATEGY_TOOL_SCHEMAS,
)
from growth.adapters.llm.schemas import StrategyOutput
from growth.domain.events import StrategyCompleted, StrategyFailed
from growth.domain.models import AudienceSegment, CreativeFrame
from growth.domain.policy_config import PolicyConfig
from growth.ports.event_log import EventLog
from growth.ports.repositories import (
    ExperimentRepository,
    FrameRepository,
    SegmentRepository,
    ShowRepository,
)


class StrategyRunError(Exception):
    """Raised when a strategy run fails."""

    def __init__(self, message: str, run_id: UUID):
        self.run_id = run_id
        super().__init__(message)


@dataclass(frozen=True)
class StrategyRunResult:
    """Result from a successful strategy run."""

    run_id: UUID
    strategy_output: StrategyOutput
    segment_ids: List[UUID]
    frame_ids: List[UUID]
    turns_used: int
    total_input_tokens: int
    total_output_tokens: int


class StrategyService:
    """Orchestrates a Strategy Agent run end-to-end."""

    def __init__(
        self,
        claude_client: ClaudeClient,
        show_repo: ShowRepository,
        exp_repo: ExperimentRepository,
        seg_repo: SegmentRepository,
        frame_repo: FrameRepository,
        event_log: EventLog,
        policy: PolicyConfig,
        runs_path: Path = Path("data/runs"),
    ):
        self._client = claude_client
        self._show_repo = show_repo
        self._exp_repo = exp_repo
        self._seg_repo = seg_repo
        self._frame_repo = frame_repo
        self._event_log = event_log
        self._policy = policy
        self._runs_path = runs_path

    def run(self, show_id: UUID) -> StrategyRunResult:
        """Run the Strategy Agent for a show."""
        show = self._show_repo.get_by_id(show_id)
        if show is None:
            raise ValueError(f"Show {show_id} not found")

        run_id = uuid4()
        run_dir = self._runs_path / str(run_id)
        run_dir.mkdir(parents=True, exist_ok=True)
        conversation_log = run_dir / "strategy_conversation.jsonl"

        dispatcher = self._build_tool_dispatcher(show_id)

        user_message = (
            f"Plan the next experiment cycle for this show:\n"
            f"- Artist: {show.artist_name}\n"
            f"- City: {show.city}\n"
            f"- Venue: {show.venue}\n"
            f"- Show date: {show.show_time.isoformat()}\n"
            f"- Capacity: {show.capacity}\n"
            f"- Tickets sold: {show.tickets_sold}/{show.tickets_total}\n\n"
            f"Show ID for tool calls: {show_id}"
        )

        try:
            agent_result = run_agent(
                client=self._client,
                system_prompt=STRATEGY_SYSTEM_PROMPT,
                user_message=user_message,
                tools=STRATEGY_TOOL_SCHEMAS,
                tool_dispatcher=dispatcher,
                output_model=StrategyOutput,
                max_turns=10,
                conversation_log_path=conversation_log,
            )
        except (AgentTurnLimitError, AgentParseError, AgentAPIError) as e:
            self._emit_failure(show_id, run_id, e)
            raise StrategyRunError(str(e), run_id) from e

        strategy_output = cast(StrategyOutput, agent_result.output)

        # Persist segments and frames
        segment_ids: List[UUID] = []
        frame_ids: List[UUID] = []
        for plan in strategy_output.frame_plans:
            seg_id = uuid4()
            segment = AudienceSegment(
                segment_id=seg_id,
                show_id=show_id,
                name=plan.segment_name,
                definition_json=plan.segment_definition.model_dump(),
                estimated_size=plan.estimated_size,
                created_by="strategy_agent",
            )
            self._seg_repo.save(segment)
            segment_ids.append(seg_id)

            frame_id = uuid4()
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
            self._frame_repo.save(frame)
            frame_ids.append(frame_id)

        # Write plan artifact
        plan_artifact = {
            **strategy_output.model_dump(),
            "run_id": str(run_id),
            "show_id": str(show_id),
            "turns_used": agent_result.turns_used,
            "total_input_tokens": agent_result.total_input_tokens,
            "total_output_tokens": agent_result.total_output_tokens,
            "segment_ids": [str(sid) for sid in segment_ids],
            "frame_ids": [str(fid) for fid in frame_ids],
        }
        plan_path = run_dir / "plan.json"
        plan_path.write_text(json.dumps(plan_artifact, indent=2, default=str))

        # Emit success event
        self._event_log.append(
            StrategyCompleted(
                event_id=uuid4(),
                occurred_at=datetime.now(timezone.utc),
                show_id=show_id,
                run_id=run_id,
                num_frame_plans=len(strategy_output.frame_plans),
                segment_ids=tuple(segment_ids),
                frame_ids=tuple(frame_ids),
                turns_used=agent_result.turns_used,
                total_input_tokens=agent_result.total_input_tokens,
                total_output_tokens=agent_result.total_output_tokens,
            )
        )

        return StrategyRunResult(
            run_id=run_id,
            strategy_output=strategy_output,
            segment_ids=segment_ids,
            frame_ids=frame_ids,
            turns_used=agent_result.turns_used,
            total_input_tokens=agent_result.total_input_tokens,
            total_output_tokens=agent_result.total_output_tokens,
        )

    def _build_tool_dispatcher(self, show_id: UUID):
        from growth.adapters.llm.strategy_tools import (
            get_active_experiments,
            get_budget_status,
            get_show_details,
            query_knowledge_base,
        )

        def dispatch(name: str, input: dict) -> dict:
            if name == "get_show_details":
                return get_show_details(
                    show_id=UUID(input["show_id"]),
                    show_repo=self._show_repo,
                )
            elif name == "get_active_experiments":
                return get_active_experiments(
                    show_id=UUID(input["show_id"]),
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
            elif name == "query_knowledge_base":
                return query_knowledge_base(
                    show_id=UUID(input["show_id"]),
                    show_repo=self._show_repo,
                    exp_repo=self._exp_repo,
                    seg_repo=self._seg_repo,
                    frame_repo=self._frame_repo,
                    filters=input.get("filters"),
                )
            else:
                return {"error": f"Unknown tool: {name}"}

        return dispatch

    def _emit_failure(self, show_id: UUID, run_id: UUID, error: Exception) -> None:
        self._event_log.append(
            StrategyFailed(
                event_id=uuid4(),
                occurred_at=datetime.now(timezone.utc),
                show_id=show_id,
                run_id=run_id,
                error_type=type(error).__name__,
                error_message=str(error),
            )
        )
