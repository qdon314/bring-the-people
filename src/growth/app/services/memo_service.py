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
            "model_name": self._client._model,
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
