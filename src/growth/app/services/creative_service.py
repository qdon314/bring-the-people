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
            "model_name": self._client._model,
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
