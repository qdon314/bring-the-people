"""Generic agent tool-use loop runner."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from pydantic import BaseModel, ValidationError

from growth.adapters.llm.errors import AgentAPIError, AgentParseError, AgentTurnLimitError
from growth.adapters.llm.result import AgentResult


def run(
    client: Any,
    system_prompt: str,
    user_message: str,
    tools: list[dict[str, Any]],
    tool_dispatcher: Callable[[str, dict[str, Any]], dict[str, Any]],
    output_model: type[BaseModel],
    max_turns: int = 10,
    conversation_log_path: Path | None = None,
) -> AgentResult:
    """Run a tool-use agent loop until structured output is produced.

    All messages use normalized content blocks (never raw strings).
    Handles multiple tool_use blocks in a single response.
    Retry appends a user message — never injects raw text as assistant content.
    """
    messages: list[dict[str, Any]] = [
        {"role": "user", "content": [{"type": "text", "text": user_message}]}
    ]

    total_input_tokens = 0
    total_output_tokens = 0
    turns = 0
    parse_attempts = 0

    _log(conversation_log_path, role="user", content=user_message)

    while True:
        turns += 1
        if turns > max_turns:
            _log(conversation_log_path, role="error", content={"type": "turn_limit", "max_turns": max_turns})
            raise AgentTurnLimitError(max_turns)

        try:
            response = client.chat(
                messages=messages,
                system=system_prompt,
                tools=tools if tools else None,
            )
        except AgentAPIError:
            raise
        except Exception as e:
            raise AgentAPIError("LLM API call failed", cause=e) from e

        # Usage accumulation
        usage = getattr(response, "usage", None)
        if usage is not None:
            total_input_tokens += getattr(usage, "input_tokens", 0) or 0
            total_output_tokens += getattr(usage, "output_tokens", 0) or 0

        content_blocks = list(getattr(response, "content", []) or [])
        if not content_blocks:
            _log(conversation_log_path, role="error", content={"type": "empty_response"})
            raise AgentParseError("Response contained no content blocks", attempts=1)

        tool_use_blocks = [b for b in content_blocks if getattr(b, "type", None) == "tool_use"]
        text_blocks = [b for b in content_blocks if getattr(b, "type", None) == "text"]

        # If any tool_use blocks, dispatch them all and continue
        if tool_use_blocks:
            messages.append({"role": "assistant", "content": _to_serializable_blocks(tool_use_blocks)})
            _log(conversation_log_path, role="assistant", content=_summarize_blocks(tool_use_blocks))

            tool_results: list[dict[str, Any]] = []
            for b in tool_use_blocks:
                name = str(getattr(b, "name"))
                tool_input = getattr(b, "input")
                tool_use_id = str(getattr(b, "id"))

                _log(conversation_log_path, role="tool_use", content={"name": name, "input": tool_input, "id": tool_use_id})

                result_obj = tool_dispatcher(name, tool_input)
                _log(conversation_log_path, role="tool_result", content={"tool_use_id": tool_use_id, "result": result_obj})

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_use_id,
                    "content": [{"type": "text", "text": json.dumps(result_obj, default=str)}],
                })

            messages.append({"role": "user", "content": tool_results})
            continue

        # Text response — parse as structured output
        if not text_blocks:
            _log(conversation_log_path, role="error", content={"type": "no_text_blocks"})
            raise AgentParseError("Response contained no text or tool_use blocks", attempts=1)

        raw_text = "\n".join(str(getattr(b, "text", "")) for b in text_blocks).strip()
        _log(conversation_log_path, role="assistant", content=raw_text)

        json_str = _extract_json(raw_text)

        try:
            parsed = output_model.model_validate_json(json_str)
            return AgentResult(
                output=parsed,
                turns_used=turns,
                total_input_tokens=total_input_tokens,
                total_output_tokens=total_output_tokens,
            )
        except (ValidationError, json.JSONDecodeError, ValueError) as e:
            parse_attempts += 1
            _log(
                conversation_log_path,
                role="parse_error",
                content={"attempt": parse_attempts, "error": str(e), "raw_text": raw_text},
            )

            if parse_attempts >= 2:
                raise AgentParseError(
                    f"Failed to parse output after {parse_attempts} attempts: {e}",
                    attempts=parse_attempts,
                ) from e

            retry_prompt = _build_retry_prompt(error=str(e))
            messages.append({"role": "user", "content": [{"type": "text", "text": retry_prompt}]})
            _log(conversation_log_path, role="retry_feedback", content=retry_prompt)


def _build_retry_prompt(*, error: str) -> str:
    return (
        "Your previous message could not be parsed into the required JSON schema.\n"
        f"Error: {error}\n\n"
        "Return ONLY a valid JSON object matching the schema.\n"
        "- No markdown\n"
        "- No explanation\n"
        "- No trailing commas\n"
        "- Do not wrap in ```\n"
    )


def _extract_json(text: str) -> str:
    """Extract JSON from text, handling markdown code fences."""
    t = text.strip()

    # Fast path: already looks like a JSON object
    if t.startswith("{") and t.endswith("}"):
        return t

    # Code fence path
    if "```" in t:
        parts = t.split("```")
        for part in parts:
            c = part.strip()
            if c.startswith("json"):
                c = c[4:].strip()
            if c.startswith("{") and c.endswith("}"):
                return c

    return t


def _to_serializable_blocks(blocks: list[Any]) -> list[dict[str, Any]]:
    """Convert SDK blocks to plain dict blocks for conversation state."""
    out: list[dict[str, Any]] = []
    for b in blocks:
        btype = getattr(b, "type", None)
        if btype == "tool_use":
            out.append({
                "type": "tool_use",
                "id": str(getattr(b, "id")),
                "name": str(getattr(b, "name")),
                "input": getattr(b, "input"),
            })
        elif btype == "text":
            out.append({"type": "text", "text": str(getattr(b, "text", ""))})
        else:
            out.append({"type": str(btype), "raw": str(b)})
    return out


def _summarize_blocks(blocks: list[Any]) -> Any:
    """Readable summary for logs."""
    summary: list[dict[str, Any]] = []
    for b in blocks:
        if getattr(b, "type", None) == "tool_use":
            summary.append({"type": "tool_use", "name": str(getattr(b, "name")), "id": str(getattr(b, "id"))})
        elif getattr(b, "type", None) == "text":
            txt = str(getattr(b, "text", ""))
            summary.append({"type": "text", "preview": txt[:200]})
        else:
            summary.append({"type": str(getattr(b, "type", None))})
    return summary


def _log(path: Path | None, *, role: str, content: Any) -> None:
    """Append a log entry to the conversation log."""
    if path is None:
        return
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "role": role,
        "content": content,
    }
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, default=str) + "\n")
