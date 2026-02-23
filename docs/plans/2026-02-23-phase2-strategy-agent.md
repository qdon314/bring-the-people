# Phase 2: Strategy Agent Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the shared agent infrastructure (Claude client, tool-use loop runner) and the Strategy Agent — the first LLM agent that proposes audience segments and framing hypotheses for a show's experiment cycle.

**Architecture:** A generic `agent_runner.run()` function handles the Claude tool-use loop with normalized message shapes (always content blocks, never raw strings). The Strategy Agent plugs in its own system prompt, four tool functions, and a `StrategyOutput` Pydantic model with enum-constrained fields. The `StrategyService` orchestrates the full flow: fetch show → run agent → persist segments/frames → write artifacts → emit events.

**Tech Stack:** Python 3.14, `anthropic` SDK, Pydantic 2.x, existing FastAPI/SQLAlchemy/pytest stack

**Scope:**
- Anthropic SDK dependency
- Claude client wrapper (wraps SDK errors in `AgentAPIError`)
- Generic agent runner (normalized content blocks, handles multiple tool_use blocks per response)
- Strategy agent output schemas (enums for Channel/EvidenceSource, structured SegmentDefinition, explicit BudgetRangeCents model, single channel per plan)
- Strategy agent tool functions (4 tools; `query_knowledge_base` and `get_budget_status` accept `show_repo` for real city/phase data)
- Strategy agent system prompt
- Strategy service (orchestration)
- Strategy API endpoint
- Domain events for strategy runs
- Container wiring
- Full test coverage (unit, integration with fixtures)
- **Deferred:** Creative Agent, Memo Writer Agent, cycle_runner, dedupe_key on FramePlan

---

### Task 1: Add Anthropic SDK Dependency

**Files:**
- Modify: `pyproject.toml`

**Step 1: Update pyproject.toml**

Add `anthropic` to dependencies and bump version to `0.3.0`:

```toml
[project]
name = "bring-the-people"
version = "0.3.0"
description = "Agentic growth system for live show ticket sales"
requires-python = ">=3.9"
dependencies = [
    "sqlalchemy>=2.0,<3.0",
    "pydantic>=2.0,<3.0",
    "fastapi>=0.115,<1.0",
    "uvicorn[standard]>=0.34,<1.0",
    "tomli>=2.0,<3.0;python_version<'3.11'",
    "anthropic>=0.52,<1.0",
]
```

**Step 2: Install updated dependencies**

```bash
.venv/bin/pip install -e ".[dev]"
```

Expected: `anthropic` importable.

**Step 3: Verify existing tests still pass**

```bash
.venv/bin/pytest -v
```

Expected: all existing tests PASS.

**Step 4: Commit**

```bash
git add pyproject.toml
git commit -m "chore: add anthropic SDK dependency for Phase 2"
```

---

### Task 2: Agent Errors and Result Model

**Files:**
- Create: `src/growth/adapters/llm/__init__.py`
- Create: `src/growth/adapters/llm/errors.py`
- Create: `src/growth/adapters/llm/result.py`
- Create: `tests/adapters/llm/__init__.py`
- Create: `tests/adapters/llm/test_result.py`

These are the shared types that the runner, client, and all agents depend on. Build them first so everything else can import them.

**Step 1: Write the failing tests**

```python
# tests/adapters/llm/test_result.py
"""Tests for agent result and error types."""
import pytest

from growth.adapters.llm.errors import (
    AgentAPIError,
    AgentParseError,
    AgentTurnLimitError,
)
from growth.adapters.llm.result import AgentResult


class TestAgentResult:
    def test_create_result(self):
        from pydantic import BaseModel

        class DummyOutput(BaseModel):
            value: str

        output = DummyOutput(value="test")
        result = AgentResult(
            output=output,
            turns_used=3,
            total_input_tokens=1500,
            total_output_tokens=800,
        )
        assert result.output.value == "test"
        assert result.turns_used == 3
        assert result.total_input_tokens == 1500
        assert result.total_output_tokens == 800

    def test_result_is_frozen(self):
        from pydantic import BaseModel

        class DummyOutput(BaseModel):
            value: str

        result = AgentResult(
            output=DummyOutput(value="test"),
            turns_used=1,
            total_input_tokens=100,
            total_output_tokens=50,
        )
        with pytest.raises(AttributeError):
            result.turns_used = 5


class TestAgentErrors:
    def test_turn_limit_error(self):
        err = AgentTurnLimitError(10)
        assert "10" in str(err)

    def test_parse_error(self):
        err = AgentParseError("invalid JSON", attempts=2)
        assert "invalid JSON" in str(err)
        assert err.attempts == 2

    def test_api_error(self):
        err = AgentAPIError("rate limited")
        assert "rate limited" in str(err)

    def test_api_error_with_cause(self):
        cause = RuntimeError("connection reset")
        err = AgentAPIError("Claude API call failed", cause=cause)
        assert err.cause is cause
```

**Step 2: Run tests to verify they fail**

```bash
.venv/bin/pytest tests/adapters/llm/test_result.py -v
```

Expected: FAIL with `ModuleNotFoundError`

**Step 3: Implement the types**

```python
# src/growth/adapters/llm/__init__.py
```

```python
# src/growth/adapters/llm/errors.py
"""Agent error types."""
from __future__ import annotations


class AgentTurnLimitError(Exception):
    """Raised when the agent exceeds the maximum number of turns."""

    def __init__(self, max_turns: int):
        self.max_turns = max_turns
        super().__init__(f"Agent exceeded maximum turns ({max_turns})")


class AgentParseError(Exception):
    """Raised when the agent's output cannot be parsed into the expected schema."""

    def __init__(self, message: str, attempts: int = 1):
        self.attempts = attempts
        super().__init__(message)


class AgentAPIError(Exception):
    """Raised when the LLM API returns an error."""

    def __init__(self, message: str, *, cause: Exception | None = None):
        self.cause = cause
        super().__init__(message)
```

```python
# src/growth/adapters/llm/result.py
"""Agent result model."""
from __future__ import annotations

from dataclasses import dataclass

from pydantic import BaseModel


@dataclass(frozen=True)
class AgentResult:
    """Result from an agent run."""
    output: BaseModel
    turns_used: int
    total_input_tokens: int
    total_output_tokens: int
```

**Step 4: Run tests to verify they pass**

```bash
.venv/bin/pytest tests/adapters/llm/test_result.py -v
```

Expected: all PASS

**Step 5: Commit**

```bash
git add src/growth/adapters/llm/ tests/adapters/llm/
git commit -m "feat: agent result model and error types"
```

---

### Task 3: Claude Client Wrapper

**Files:**
- Create: `src/growth/adapters/llm/client.py`
- Create: `tests/adapters/llm/test_client.py`

Thin wrapper around `anthropic.Anthropic()`. Wraps SDK exceptions in `AgentAPIError` so error handling is predictable everywhere. Tests mock the SDK so no real API calls are made.

**Step 1: Write the failing tests**

```python
# tests/adapters/llm/test_client.py
"""Tests for the Claude client wrapper."""
from unittest.mock import MagicMock, patch

import pytest

from growth.adapters.llm.client import ClaudeClient
from growth.adapters.llm.errors import AgentAPIError


class TestClaudeClient:
    def test_create_with_api_key(self):
        client = ClaudeClient(api_key="test-key")
        assert client._model == "claude-sonnet-4-20250514"

    def test_create_with_custom_model(self):
        client = ClaudeClient(api_key="test-key", model="claude-opus-4-20250514")
        assert client._model == "claude-opus-4-20250514"

    @patch("growth.adapters.llm.client.Anthropic")
    def test_chat_calls_messages_create(self, mock_anthropic_cls):
        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client

        mock_response = MagicMock()
        mock_response.content = [MagicMock(type="text", text="hello")]
        mock_response.usage.input_tokens = 100
        mock_response.usage.output_tokens = 50
        mock_client.messages.create.return_value = mock_response

        client = ClaudeClient(api_key="test-key")
        messages = [{"role": "user", "content": "test"}]
        result = client.chat(messages=messages, system="You are helpful.")

        mock_client.messages.create.assert_called_once()
        call_kwargs = mock_client.messages.create.call_args[1]
        assert call_kwargs["model"] == "claude-sonnet-4-20250514"
        assert call_kwargs["system"] == "You are helpful."
        assert call_kwargs["messages"] == messages
        assert result == mock_response

    @patch("growth.adapters.llm.client.Anthropic")
    def test_chat_passes_tools(self, mock_anthropic_cls):
        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = MagicMock()

        client = ClaudeClient(api_key="test-key")
        tools = [{"name": "get_data", "description": "Get data", "input_schema": {"type": "object"}}]
        client.chat(
            messages=[{"role": "user", "content": "test"}],
            system="test",
            tools=tools,
        )

        call_kwargs = mock_client.messages.create.call_args[1]
        assert call_kwargs["tools"] == tools

    @patch("growth.adapters.llm.client.Anthropic")
    def test_chat_without_tools(self, mock_anthropic_cls):
        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = MagicMock()

        client = ClaudeClient(api_key="test-key")
        client.chat(
            messages=[{"role": "user", "content": "test"}],
            system="test",
        )

        call_kwargs = mock_client.messages.create.call_args[1]
        assert "tools" not in call_kwargs

    @patch("growth.adapters.llm.client.Anthropic")
    def test_chat_wraps_sdk_errors(self, mock_anthropic_cls):
        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.side_effect = RuntimeError("connection reset")

        client = ClaudeClient(api_key="test-key")
        with pytest.raises(AgentAPIError) as exc_info:
            client.chat(
                messages=[{"role": "user", "content": "test"}],
                system="test",
            )
        assert exc_info.value.cause is not None
```

**Step 2: Run tests to verify they fail**

```bash
.venv/bin/pytest tests/adapters/llm/test_client.py -v
```

Expected: FAIL with `ModuleNotFoundError`

**Step 3: Implement the client**

```python
# src/growth/adapters/llm/client.py
"""Thin wrapper around the Anthropic SDK."""
from __future__ import annotations

from typing import Any

from anthropic import Anthropic

from growth.adapters.llm.errors import AgentAPIError


class ClaudeClient:
    """Claude API client.

    Wraps anthropic.Anthropic with a simplified chat() interface.
    SDK exceptions are wrapped in AgentAPIError.
    """

    def __init__(
        self,
        api_key: str | None = None,
        model: str = "claude-sonnet-4-20250514",
        max_tokens: int = 4096,
    ):
        self._anthropic = Anthropic(api_key=api_key)
        self._model = model
        self._max_tokens = max_tokens

    def chat(
        self,
        messages: list[dict[str, Any]],
        system: str,
        tools: list[dict[str, Any]] | None = None,
    ):
        """Send messages to Claude and return the raw response.

        Raises AgentAPIError on SDK exceptions.
        """
        kwargs: dict[str, Any] = {
            "model": self._model,
            "max_tokens": self._max_tokens,
            "system": system,
            "messages": messages,
        }
        if tools:
            kwargs["tools"] = tools

        try:
            return self._anthropic.messages.create(**kwargs)
        except Exception as e:
            raise AgentAPIError("Claude API call failed", cause=e) from e
```

**Step 4: Run tests to verify they pass**

```bash
.venv/bin/pytest tests/adapters/llm/test_client.py -v
```

Expected: all PASS

**Step 5: Commit**

```bash
git add src/growth/adapters/llm/client.py tests/adapters/llm/test_client.py
git commit -m "feat: Claude client wrapper — wraps anthropic SDK with AgentAPIError"
```

---

### Task 4: Agent Runner — Normalized Tool-Use Loop

**Files:**
- Create: `src/growth/adapters/llm/agent_runner.py`
- Create: `tests/adapters/llm/test_agent_runner.py`

The generic tool-use loop. Key properties: always uses content blocks (never raw strings), handles multiple tool_use blocks in a single response, serializes SDK blocks to plain dicts for conversation state, retry appends a user message (never injects raw text as assistant content).

**Step 1: Write the failing tests**

```python
# tests/adapters/llm/test_agent_runner.py
"""Tests for the generic agent runner tool-use loop."""
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from pydantic import BaseModel, Field

from growth.adapters.llm.agent_runner import run
from growth.adapters.llm.errors import AgentAPIError, AgentParseError, AgentTurnLimitError


class SimpleOutput(BaseModel):
    answer: str
    score: float = Field(ge=0, le=1)


def _make_text_response(text: str, input_tokens: int = 100, output_tokens: int = 50):
    """Create a mock Claude response with a text content block."""
    block = MagicMock()
    block.type = "text"
    block.text = text

    response = MagicMock()
    response.content = [block]
    response.stop_reason = "end_turn"
    response.usage.input_tokens = input_tokens
    response.usage.output_tokens = output_tokens
    return response


def _make_tool_use_response(
    tool_name: str,
    tool_input: dict,
    tool_use_id: str = "toolu_123",
    input_tokens: int = 100,
    output_tokens: int = 50,
):
    """Create a mock Claude response with a tool_use content block."""
    block = MagicMock()
    block.type = "tool_use"
    block.name = tool_name
    block.input = tool_input
    block.id = tool_use_id

    response = MagicMock()
    response.content = [block]
    response.stop_reason = "tool_use"
    response.usage.input_tokens = input_tokens
    response.usage.output_tokens = output_tokens
    return response


def _make_multi_tool_response(tools: list[tuple[str, dict, str]], input_tokens=100, output_tokens=50):
    """Create a mock response with multiple tool_use blocks."""
    blocks = []
    for name, inp, tid in tools:
        block = MagicMock()
        block.type = "tool_use"
        block.name = name
        block.input = inp
        block.id = tid
        blocks.append(block)

    response = MagicMock()
    response.content = blocks
    response.stop_reason = "tool_use"
    response.usage.input_tokens = input_tokens
    response.usage.output_tokens = output_tokens
    return response


class TestAgentRunnerHappyPath:
    def test_direct_text_response_parses_output(self):
        """Agent responds with valid JSON on first message — no tool calls."""
        mock_client = MagicMock()
        mock_client.chat.return_value = _make_text_response(
            json.dumps({"answer": "42", "score": 0.9})
        )

        result = run(
            client=mock_client,
            system_prompt="You are helpful.",
            user_message="What is the answer?",
            tools=[],
            tool_dispatcher=lambda name, input: {},
            output_model=SimpleOutput,
        )

        assert result.output.answer == "42"
        assert result.output.score == 0.9
        assert result.turns_used == 1
        assert result.total_input_tokens == 100
        assert result.total_output_tokens == 50

    def test_tool_call_then_text_response(self):
        """Agent calls a tool, gets result, then responds with valid JSON."""
        mock_client = MagicMock()
        mock_client.chat.side_effect = [
            _make_tool_use_response("get_data", {"id": "abc"}),
            _make_text_response(json.dumps({"answer": "got it", "score": 0.8})),
        ]

        tool_calls = []

        def dispatcher(name, input):
            tool_calls.append((name, input))
            return {"data": "some result"}

        result = run(
            client=mock_client,
            system_prompt="You are helpful.",
            user_message="Get the data.",
            tools=[{"name": "get_data", "description": "Get data", "input_schema": {"type": "object"}}],
            tool_dispatcher=dispatcher,
            output_model=SimpleOutput,
        )

        assert len(tool_calls) == 1
        assert tool_calls[0] == ("get_data", {"id": "abc"})
        assert result.output.answer == "got it"
        assert result.turns_used == 2
        assert result.total_input_tokens == 200
        assert result.total_output_tokens == 100

    def test_multiple_tool_calls_in_sequence(self):
        """Agent calls tools across multiple turns before final response."""
        mock_client = MagicMock()
        mock_client.chat.side_effect = [
            _make_tool_use_response("tool_a", {"x": 1}, tool_use_id="toolu_1"),
            _make_tool_use_response("tool_b", {"y": 2}, tool_use_id="toolu_2"),
            _make_text_response(json.dumps({"answer": "done", "score": 0.7})),
        ]

        result = run(
            client=mock_client,
            system_prompt="test",
            user_message="do stuff",
            tools=[],
            tool_dispatcher=lambda name, input: {"ok": True},
            output_model=SimpleOutput,
        )

        assert result.turns_used == 3
        assert result.output.answer == "done"

    def test_multiple_tool_use_blocks_in_single_response(self):
        """Agent returns multiple tool_use blocks in one response — all dispatched."""
        mock_client = MagicMock()
        mock_client.chat.side_effect = [
            _make_multi_tool_response([
                ("tool_a", {"x": 1}, "toolu_1"),
                ("tool_b", {"y": 2}, "toolu_2"),
            ]),
            _make_text_response(json.dumps({"answer": "both done", "score": 0.6})),
        ]

        dispatched = []

        def dispatcher(name, input):
            dispatched.append(name)
            return {"ok": True}

        result = run(
            client=mock_client,
            system_prompt="test",
            user_message="do both",
            tools=[],
            tool_dispatcher=dispatcher,
            output_model=SimpleOutput,
        )

        assert dispatched == ["tool_a", "tool_b"]
        assert result.turns_used == 2


class TestAgentRunnerRetry:
    def test_retry_on_parse_failure(self):
        """First response is invalid JSON, retry succeeds."""
        mock_client = MagicMock()
        mock_client.chat.side_effect = [
            _make_text_response("this is not json"),
            _make_text_response(json.dumps({"answer": "fixed", "score": 0.5})),
        ]

        result = run(
            client=mock_client,
            system_prompt="test",
            user_message="test",
            tools=[],
            tool_dispatcher=lambda name, input: {},
            output_model=SimpleOutput,
        )

        assert result.output.answer == "fixed"
        # Verify the retry message was sent as a user message with content blocks
        second_call_messages = mock_client.chat.call_args_list[1][1]["messages"]
        last_user = [m for m in second_call_messages if m["role"] == "user"][-1]
        text = last_user["content"][0]["text"]
        assert "could not be parsed" in text.lower()

    def test_second_parse_failure_raises(self):
        """Two consecutive parse failures raise AgentParseError."""
        mock_client = MagicMock()
        mock_client.chat.side_effect = [
            _make_text_response("not json"),
            _make_text_response("still not json"),
        ]

        with pytest.raises(AgentParseError) as exc_info:
            run(
                client=mock_client,
                system_prompt="test",
                user_message="test",
                tools=[],
                tool_dispatcher=lambda name, input: {},
                output_model=SimpleOutput,
            )
        assert exc_info.value.attempts == 2

    def test_validation_error_triggers_retry(self):
        """Valid JSON but fails Pydantic validation, retry succeeds."""
        mock_client = MagicMock()
        mock_client.chat.side_effect = [
            _make_text_response(json.dumps({"answer": "x", "score": 5.0})),  # score > 1
            _make_text_response(json.dumps({"answer": "x", "score": 0.5})),
        ]

        result = run(
            client=mock_client,
            system_prompt="test",
            user_message="test",
            tools=[],
            tool_dispatcher=lambda name, input: {},
            output_model=SimpleOutput,
        )

        assert result.output.score == 0.5


class TestAgentRunnerTurnLimit:
    def test_turn_limit_raises(self):
        """Agent exceeds max_turns with continuous tool calls."""
        mock_client = MagicMock()
        mock_client.chat.return_value = _make_tool_use_response("loop", {})

        with pytest.raises(AgentTurnLimitError) as exc_info:
            run(
                client=mock_client,
                system_prompt="test",
                user_message="test",
                tools=[],
                tool_dispatcher=lambda name, input: {"ok": True},
                output_model=SimpleOutput,
                max_turns=3,
            )
        assert exc_info.value.max_turns == 3


class TestAgentRunnerAPIError:
    def test_api_error_propagates(self):
        """AgentAPIError from client propagates through the runner."""
        mock_client = MagicMock()
        mock_client.chat.side_effect = AgentAPIError("rate limited")

        with pytest.raises(AgentAPIError):
            run(
                client=mock_client,
                system_prompt="test",
                user_message="test",
                tools=[],
                tool_dispatcher=lambda name, input: {},
                output_model=SimpleOutput,
            )


class TestAgentRunnerConversationLog:
    def test_conversation_logged_to_jsonl(self, tmp_path):
        """Conversation messages are logged to JSONL file."""
        log_path = tmp_path / "conversation.jsonl"

        mock_client = MagicMock()
        mock_client.chat.side_effect = [
            _make_tool_use_response("get_info", {"q": "test"}, tool_use_id="toolu_1"),
            _make_text_response(json.dumps({"answer": "done", "score": 0.6})),
        ]

        run(
            client=mock_client,
            system_prompt="test",
            user_message="hello",
            tools=[],
            tool_dispatcher=lambda name, input: {"result": "data"},
            output_model=SimpleOutput,
            conversation_log_path=log_path,
        )

        assert log_path.exists()
        lines = log_path.read_text().strip().split("\n")
        assert len(lines) >= 3  # user message, tool call+result, final response
        for line in lines:
            json.loads(line)

    def test_conversation_logged_on_failure(self, tmp_path):
        """Partial conversation is logged even when the agent fails."""
        log_path = tmp_path / "conversation.jsonl"

        mock_client = MagicMock()
        mock_client.chat.side_effect = [
            _make_text_response("bad output"),
            _make_text_response("still bad"),
        ]

        with pytest.raises(AgentParseError):
            run(
                client=mock_client,
                system_prompt="test",
                user_message="test",
                tools=[],
                tool_dispatcher=lambda name, input: {},
                output_model=SimpleOutput,
                conversation_log_path=log_path,
            )

        assert log_path.exists()
        lines = log_path.read_text().strip().split("\n")
        assert len(lines) >= 1


class TestAgentRunnerTokenAccumulation:
    def test_tokens_accumulated_across_turns(self):
        """Token counts are summed across all turns."""
        mock_client = MagicMock()
        mock_client.chat.side_effect = [
            _make_tool_use_response("tool", {}, input_tokens=200, output_tokens=100),
            _make_text_response(
                json.dumps({"answer": "done", "score": 0.5}),
                input_tokens=300,
                output_tokens=150,
            ),
        ]

        result = run(
            client=mock_client,
            system_prompt="test",
            user_message="test",
            tools=[],
            tool_dispatcher=lambda name, input: {"ok": True},
            output_model=SimpleOutput,
        )

        assert result.total_input_tokens == 500
        assert result.total_output_tokens == 250
```

**Step 2: Run tests to verify they fail**

```bash
.venv/bin/pytest tests/adapters/llm/test_agent_runner.py -v
```

Expected: FAIL with `ModuleNotFoundError`

**Step 3: Implement the agent runner**

```python
# src/growth/adapters/llm/agent_runner.py
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
            if c.startswith("{"):
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
    if path is None:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "role": role,
        "content": content,
    }
    with open(path, "a", encoding="utf-8") as f:
        json.dump(entry, f, default=str)
        f.write("\n")
```

**Step 4: Run tests to verify they pass**

```bash
.venv/bin/pytest tests/adapters/llm/test_agent_runner.py -v
```

Expected: all PASS

**Step 5: Verify all existing tests still pass**

```bash
.venv/bin/pytest -v
```

**Step 6: Commit**

```bash
git add src/growth/adapters/llm/agent_runner.py tests/adapters/llm/test_agent_runner.py
git commit -m "feat: generic agent runner — normalized content blocks, multi-tool dispatch, retry"
```

---

### Task 5: Strategy Output Schemas (Tightened)

**Files:**
- Create: `src/growth/adapters/llm/schemas.py`
- Create: `tests/adapters/llm/test_strategy_schemas.py`

Pydantic models with enums for `Channel` and `EvidenceSource`, structured `SegmentDefinition`, explicit `BudgetRangeCents` model, and single channel per plan.

**Step 1: Write the failing tests**

```python
# tests/adapters/llm/test_strategy_schemas.py
"""Tests for Strategy Agent output schemas."""
import pytest
from pydantic import ValidationError

from growth.adapters.llm.schemas import (
    BudgetRangeCents,
    Channel,
    EvidenceRef,
    EvidenceSource,
    FramePlan,
    SegmentDefinition,
    StrategyOutput,
)


class TestEvidenceRef:
    def test_valid(self):
        ref = EvidenceRef(
            source=EvidenceSource.past_experiment,
            id="exp-123",
            summary="This experiment scaled with 3.2 tickets per $100",
        )
        assert ref.source == EvidenceSource.past_experiment

    def test_nullable_id(self):
        ref = EvidenceRef(
            source=EvidenceSource.show_data,
            id=None,
            summary="High capacity venue with 200 seats",
        )
        assert ref.id is None

    def test_rejects_invalid_source(self):
        with pytest.raises(ValidationError):
            EvidenceRef(source="made_up", id=None, summary="This should fail validation")

    def test_rejects_short_summary(self):
        with pytest.raises(ValidationError):
            EvidenceRef(source=EvidenceSource.show_data, id=None, summary="Too short")


class TestSegmentDefinition:
    def test_valid_with_interests(self):
        seg = SegmentDefinition(interests=["indie music", "live shows"])
        assert seg.interests == ["indie music", "live shows"]

    def test_valid_with_geo(self):
        seg = SegmentDefinition(geo={"city": "Austin", "radius_miles": 25})
        assert seg.geo["city"] == "Austin"

    def test_rejects_all_empty(self):
        with pytest.raises(ValidationError):
            SegmentDefinition()

    def test_valid_with_notes_only(self):
        seg = SegmentDefinition(notes="Broad audience test targeting")
        assert seg.notes is not None


class TestBudgetRangeCents:
    def test_valid(self):
        br = BudgetRangeCents(min=10000, max=25000)
        assert br.min == 10000
        assert br.max == 25000

    def test_rejects_max_less_than_min(self):
        with pytest.raises(ValidationError):
            BudgetRangeCents(min=25000, max=10000)

    def test_rejects_negative(self):
        with pytest.raises(ValidationError):
            BudgetRangeCents(min=-100, max=5000)

    def test_equal_min_max(self):
        br = BudgetRangeCents(min=5000, max=5000)
        assert br.min == br.max


class TestFramePlan:
    def _make_evidence(self):
        return EvidenceRef(
            source=EvidenceSource.show_data,
            id=None,
            summary="200-cap venue with 150 tickets remaining",
        )

    def _make_segment(self):
        return SegmentDefinition(interests=["indie", "live music"])

    def test_valid(self):
        plan = FramePlan(
            segment_name="Austin indie fans",
            segment_definition=self._make_segment(),
            estimated_size=5000,
            hypothesis="Indie fans respond to intimate venue framing and urgency",
            promise="An unforgettable night of live indie music",
            evidence_refs=[self._make_evidence()],
            channel=Channel.meta,
            budget_range_cents=BudgetRangeCents(min=10000, max=25000),
            risk_notes="Small venue may limit appeal",
        )
        assert plan.segment_name == "Austin indie fans"
        assert plan.channel == Channel.meta

    def test_rejects_empty_evidence_refs(self):
        with pytest.raises(ValidationError):
            FramePlan(
                segment_name="Test segment name",
                segment_definition=self._make_segment(),
                estimated_size=None,
                hypothesis="Test hypothesis that is long enough",
                promise="Test promise here",
                evidence_refs=[],
                channel=Channel.meta,
                budget_range_cents=BudgetRangeCents(min=1000, max=5000),
                risk_notes=None,
            )

    def test_rejects_invalid_channel(self):
        with pytest.raises(ValidationError):
            FramePlan(
                segment_name="Test segment name",
                segment_definition=self._make_segment(),
                estimated_size=None,
                hypothesis="Test hypothesis that is long enough",
                promise="Test promise here",
                evidence_refs=[self._make_evidence()],
                channel="facebook",
                budget_range_cents=BudgetRangeCents(min=1000, max=5000),
                risk_notes=None,
            )

    def test_nullable_fields(self):
        plan = FramePlan(
            segment_name="Test segment name",
            segment_definition=self._make_segment(),
            estimated_size=None,
            hypothesis="Test hypothesis that is long enough",
            promise="Test promise here",
            evidence_refs=[self._make_evidence()],
            channel=Channel.meta,
            budget_range_cents=BudgetRangeCents(min=1000, max=5000),
            risk_notes=None,
        )
        assert plan.estimated_size is None
        assert plan.risk_notes is None


class TestStrategyOutput:
    def _make_plan(self, name: str = "Test segment") -> FramePlan:
        return FramePlan(
            segment_name=name,
            segment_definition=SegmentDefinition(interests=["test"]),
            estimated_size=1000,
            hypothesis=f"{name} hypothesis that is long enough to pass",
            promise=f"{name} promise",
            evidence_refs=[
                EvidenceRef(
                    source=EvidenceSource.show_data,
                    id=None,
                    summary="Test evidence that is long enough to validate",
                ),
            ],
            channel=Channel.meta,
            budget_range_cents=BudgetRangeCents(min=1000, max=5000),
            risk_notes=None,
        )

    def test_valid_with_3_plans(self):
        output = StrategyOutput(
            frame_plans=[self._make_plan(f"Plan {i} segment") for i in range(3)],
            reasoning_summary="Test strategy reasoning that explains the overall approach to experiments.",
        )
        assert len(output.frame_plans) == 3

    def test_valid_with_5_plans(self):
        output = StrategyOutput(
            frame_plans=[self._make_plan(f"Plan {i} segment") for i in range(5)],
            reasoning_summary="Test strategy reasoning that explains the overall approach to experiments.",
        )
        assert len(output.frame_plans) == 5

    def test_rejects_fewer_than_3_plans(self):
        with pytest.raises(ValidationError):
            StrategyOutput(
                frame_plans=[self._make_plan("Only one")],
                reasoning_summary="Too few plans in this strategy output.",
            )

    def test_rejects_more_than_5_plans(self):
        with pytest.raises(ValidationError):
            StrategyOutput(
                frame_plans=[self._make_plan(f"Plan {i} segment") for i in range(6)],
                reasoning_summary="Too many plans in this strategy output here.",
            )

    def test_json_round_trip(self):
        output = StrategyOutput(
            frame_plans=[self._make_plan(f"Plan {i} segment") for i in range(3)],
            reasoning_summary="Test strategy round trip serialization and deserialization.",
        )
        json_str = output.model_dump_json()
        parsed = StrategyOutput.model_validate_json(json_str)
        assert parsed.frame_plans[0].segment_name == output.frame_plans[0].segment_name
```

**Step 2: Run tests to verify they fail**

```bash
.venv/bin/pytest tests/adapters/llm/test_strategy_schemas.py -v
```

Expected: FAIL with `ModuleNotFoundError`

**Step 3: Implement the schemas**

```python
# src/growth/adapters/llm/schemas.py
"""Pydantic schemas for LLM agent structured outputs."""
from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, conint


class EvidenceSource(str, Enum):
    past_experiment = "past_experiment"
    show_data = "show_data"
    budget_data = "budget_data"


class Channel(str, Enum):
    meta = "meta"
    instagram = "instagram"
    youtube = "youtube"
    tiktok = "tiktok"
    reddit = "reddit"
    snapchat = "snapchat"


class EvidenceRef(BaseModel):
    """A reference to evidence supporting a hypothesis."""
    source: EvidenceSource
    id: str | None = None
    summary: str = Field(min_length=10, max_length=280)


class BudgetRangeCents(BaseModel):
    """Budget range with explicit min/max fields."""
    min: conint(ge=0)  # type: ignore[valid-type]
    max: conint(ge=0)  # type: ignore[valid-type]

    def model_post_init(self, __context: Any) -> None:
        if self.max < self.min:
            raise ValueError("BudgetRangeCents.max must be >= min")


class SegmentDefinition(BaseModel):
    """Semi-structured segment definition.

    Flexible but shaped enough to render in UI, diff across runs,
    and translate to platform targeting later.
    """
    geo: dict[str, Any] | None = None
    interests: list[str] = Field(default_factory=list, max_length=50)
    behaviors: list[str] = Field(default_factory=list, max_length=50)
    demographics: dict[str, Any] | None = None
    lookalikes: dict[str, Any] | None = None
    exclusions: list[str] = Field(default_factory=list, max_length=50)
    notes: str | None = Field(default=None, max_length=280)

    def model_post_init(self, __context: Any) -> None:
        if (
            not self.geo
            and not self.interests
            and not self.behaviors
            and not self.demographics
            and not self.lookalikes
            and not self.exclusions
            and not self.notes
        ):
            raise ValueError("SegmentDefinition must include at least one targeting hint")


class FramePlan(BaseModel):
    """A proposed experiment frame from the Strategy Agent."""
    segment_name: str = Field(min_length=3, max_length=80)
    segment_definition: SegmentDefinition
    estimated_size: conint(ge=0) | None = None  # type: ignore[valid-type]
    hypothesis: str = Field(min_length=10, max_length=220)
    promise: str = Field(min_length=5, max_length=140)
    evidence_refs: list[EvidenceRef] = Field(min_length=1, max_length=4)
    channel: Channel
    budget_range_cents: BudgetRangeCents
    risk_notes: str | None = Field(default=None, max_length=280)


class StrategyOutput(BaseModel):
    """Complete output from the Strategy Agent."""
    frame_plans: list[FramePlan] = Field(min_length=3, max_length=5)
    reasoning_summary: str = Field(min_length=20, max_length=800)
```

**Step 4: Run tests to verify they pass**

```bash
.venv/bin/pytest tests/adapters/llm/test_strategy_schemas.py -v
```

Expected: all PASS

**Step 5: Commit**

```bash
git add src/growth/adapters/llm/schemas.py tests/adapters/llm/test_strategy_schemas.py
git commit -m "feat: tightened Strategy schemas — enums, structured segments, explicit budget range"
```

---

### Task 6: Strategy Agent Tool Functions

**Files:**
- Create: `src/growth/adapters/llm/strategy_tools.py`
- Create: `tests/adapters/llm/test_strategy_tools.py`

Four plain functions. `query_knowledge_base` and `get_budget_status` accept `show_repo` for real city lookup and phase computation. No placeholder logic.

**Step 1: Write the failing tests**

```python
# tests/adapters/llm/test_strategy_tools.py
"""Tests for Strategy Agent tool functions."""
from datetime import datetime, timezone, timedelta
from uuid import uuid4

import pytest

from growth.adapters.llm.strategy_tools import (
    get_active_experiments,
    get_budget_status,
    get_show_details,
    query_knowledge_base,
)
from growth.adapters.orm import create_tables, get_engine, get_session_maker
from growth.adapters.repositories import (
    SQLAlchemyExperimentRepository,
    SQLAlchemyFrameRepository,
    SQLAlchemySegmentRepository,
    SQLAlchemyShowRepository,
)
from growth.domain.models import (
    AudienceSegment,
    CreativeFrame,
    Decision,
    DecisionAction,
    Experiment,
    ExperimentStatus,
    Observation,
    Show,
)
from growth.domain.policy_config import PolicyConfig


def _test_policy() -> PolicyConfig:
    return PolicyConfig(
        min_windows=2, min_clicks=150, min_purchases=5,
        min_incremental_tickets_per_100usd=0.0,
        max_cac_vs_baseline_ratio=0.85,
        min_conversion_rate_vs_baseline_ratio=0.50,
        max_refund_rate=0.10, max_complaint_rate=0.05,
        max_negative_comment_rate=0.15,
        confidence_weight_sample=0.4, confidence_weight_lift=0.4,
        confidence_weight_consistency=0.2,
        discovery_max_pct=0.10, validation_max_pct=0.20,
        scale_max_pct=0.40,
    )


@pytest.fixture
def repos(tmp_path):
    db_path = tmp_path / "test.db"
    engine = get_engine(f"sqlite:///{db_path}")
    create_tables(engine)
    Session = get_session_maker(engine)
    session = Session()

    yield {
        "show_repo": SQLAlchemyShowRepository(session),
        "exp_repo": SQLAlchemyExperimentRepository(session),
        "seg_repo": SQLAlchemySegmentRepository(session),
        "frame_repo": SQLAlchemyFrameRepository(session),
    }
    session.close()


def _create_show(show_repo, **overrides) -> Show:
    defaults = {
        "show_id": uuid4(),
        "artist_name": "Test Artist",
        "city": "Austin",
        "venue": "The Parish",
        "show_time": datetime.now(timezone.utc) + timedelta(days=30),
        "timezone": "America/Chicago",
        "capacity": 200,
        "tickets_total": 200,
        "tickets_sold": 50,
    }
    defaults.update(overrides)
    show = Show(**defaults)
    show_repo.save(show)
    return show


class TestGetShowDetails:
    def test_returns_show_info(self, repos):
        show = _create_show(repos["show_repo"])
        result = get_show_details(show_id=show.show_id, show_repo=repos["show_repo"])
        assert result["artist_name"] == "Test Artist"
        assert result["city"] == "Austin"
        assert result["capacity"] == 200
        assert result["tickets_sold"] == 50
        assert "phase" in result
        assert "days_until_show" in result

    def test_returns_early_phase(self, repos):
        show = _create_show(
            repos["show_repo"],
            show_time=datetime.now(timezone.utc) + timedelta(days=40),
        )
        result = get_show_details(show.show_id, repos["show_repo"])
        assert result["phase"] == "early"

    def test_returns_late_phase(self, repos):
        show = _create_show(
            repos["show_repo"],
            show_time=datetime.now(timezone.utc) + timedelta(days=3),
        )
        result = get_show_details(show.show_id, repos["show_repo"])
        assert result["phase"] == "late"

    def test_show_not_found(self, repos):
        result = get_show_details(uuid4(), repos["show_repo"])
        assert result["error"] == "show_not_found"


class TestGetActiveExperiments:
    def test_returns_running_experiments(self, repos):
        show = _create_show(repos["show_repo"])
        seg = AudienceSegment(
            segment_id=uuid4(), show_id=show.show_id,
            name="Test Segment", definition_json={},
            estimated_size=1000, created_by="test",
        )
        repos["seg_repo"].save(seg)
        frame = CreativeFrame(
            frame_id=uuid4(), show_id=show.show_id, segment_id=seg.segment_id,
            hypothesis="Test hypothesis", promise="Test promise",
            evidence_refs=[], risk_notes=None,
        )
        repos["frame_repo"].save(frame)

        exp = Experiment(
            experiment_id=uuid4(), show_id=show.show_id,
            segment_id=seg.segment_id, frame_id=frame.frame_id,
            channel="meta", objective="ticket_sales",
            budget_cap_cents=5000, status=ExperimentStatus.RUNNING,
            start_time=datetime.now(timezone.utc), end_time=None,
            baseline_snapshot={},
        )
        repos["exp_repo"].save(exp)

        result = get_active_experiments(
            show_id=show.show_id,
            exp_repo=repos["exp_repo"],
            seg_repo=repos["seg_repo"],
            frame_repo=repos["frame_repo"],
        )
        assert len(result["experiments"]) == 1
        assert result["experiments"][0]["segment_name"] == "Test Segment"
        assert result["experiments"][0]["status"] == "running"

    def test_excludes_completed_experiments(self, repos):
        show = _create_show(repos["show_repo"])
        exp = Experiment(
            experiment_id=uuid4(), show_id=show.show_id,
            segment_id=uuid4(), frame_id=uuid4(),
            channel="meta", objective="ticket_sales",
            budget_cap_cents=5000, status=ExperimentStatus.COMPLETED,
            start_time=datetime.now(timezone.utc), end_time=None,
            baseline_snapshot={},
        )
        repos["exp_repo"].save(exp)

        result = get_active_experiments(
            show.show_id, repos["exp_repo"], repos["seg_repo"], repos["frame_repo"],
        )
        assert len(result["experiments"]) == 0

    def test_no_experiments(self, repos):
        show = _create_show(repos["show_repo"])
        result = get_active_experiments(
            show.show_id, repos["exp_repo"], repos["seg_repo"], repos["frame_repo"],
        )
        assert result["experiments"] == []


class TestGetBudgetStatus:
    def test_computes_remaining_budget(self, repos):
        show = _create_show(repos["show_repo"])
        exp = Experiment(
            experiment_id=uuid4(), show_id=show.show_id,
            segment_id=uuid4(), frame_id=uuid4(),
            channel="meta", objective="ticket_sales",
            budget_cap_cents=5000, status=ExperimentStatus.RUNNING,
            start_time=datetime.now(timezone.utc), end_time=None,
            baseline_snapshot={},
        )
        repos["exp_repo"].save(exp)
        obs = Observation(
            observation_id=uuid4(), experiment_id=exp.experiment_id,
            window_start=datetime.now(timezone.utc) - timedelta(days=1),
            window_end=datetime.now(timezone.utc),
            spend_cents=2000, impressions=5000, clicks=100,
            sessions=90, checkouts=10, purchases=3,
            revenue_cents=12000, refunds=0, refund_cents=0,
            complaints=0, negative_comment_rate=0.01,
            attribution_model="last_click_utm", raw_json={},
        )
        repos["exp_repo"].add_observation(obs)

        result = get_budget_status(
            show_id=show.show_id,
            show_repo=repos["show_repo"],
            exp_repo=repos["exp_repo"],
            policy=_test_policy(),
            total_budget_cents=50000,
        )
        assert result["total_budget_cents"] == 50000
        assert result["spent_cents"] == 2000
        assert result["remaining_cents"] == 48000
        assert "phase" in result
        assert "current_phase_cap_cents" in result

    def test_no_spend(self, repos):
        show = _create_show(repos["show_repo"])
        result = get_budget_status(
            show.show_id, repos["show_repo"], repos["exp_repo"],
            _test_policy(), total_budget_cents=50000,
        )
        assert result["spent_cents"] == 0
        assert result["remaining_cents"] == 50000

    def test_show_not_found(self, repos):
        result = get_budget_status(
            uuid4(), repos["show_repo"], repos["exp_repo"],
            _test_policy(), total_budget_cents=50000,
        )
        assert result["error"] == "show_not_found"


class TestQueryKnowledgeBase:
    def test_returns_past_experiment_summaries(self, repos):
        show = _create_show(repos["show_repo"])
        seg = AudienceSegment(
            segment_id=uuid4(), show_id=show.show_id,
            name="Past Segment", definition_json={},
            estimated_size=2000, created_by="test",
        )
        repos["seg_repo"].save(seg)
        frame = CreativeFrame(
            frame_id=uuid4(), show_id=show.show_id, segment_id=seg.segment_id,
            hypothesis="Past hypothesis", promise="Past promise",
            evidence_refs=[], risk_notes=None,
        )
        repos["frame_repo"].save(frame)

        exp = Experiment(
            experiment_id=uuid4(), show_id=show.show_id,
            segment_id=seg.segment_id, frame_id=frame.frame_id,
            channel="meta", objective="ticket_sales",
            budget_cap_cents=5000, status=ExperimentStatus.COMPLETED,
            start_time=datetime.now(timezone.utc) - timedelta(days=14),
            end_time=datetime.now(timezone.utc) - timedelta(days=7),
            baseline_snapshot={"cac_cents": 800},
        )
        repos["exp_repo"].save(exp)
        decision = Decision(
            decision_id=uuid4(), experiment_id=exp.experiment_id,
            action=DecisionAction.SCALE, confidence=0.85,
            rationale="Good performance", policy_version="v1",
            metrics_snapshot={"cac_cents": 350},
        )
        repos["exp_repo"].save_decision(decision)

        result = query_knowledge_base(
            show_id=show.show_id,
            show_repo=repos["show_repo"],
            exp_repo=repos["exp_repo"],
            seg_repo=repos["seg_repo"],
            frame_repo=repos["frame_repo"],
        )
        assert len(result["experiments"]) == 1
        assert result["experiments"][0]["segment_name"] == "Past Segment"
        assert result["experiments"][0]["decision"] == "scale"
        assert result["experiments"][0]["city"] == "Austin"

    def test_filters_by_matching_city(self, repos):
        show = _create_show(repos["show_repo"], city="Austin")
        exp = Experiment(
            experiment_id=uuid4(), show_id=show.show_id,
            segment_id=uuid4(), frame_id=uuid4(),
            channel="meta", objective="ticket_sales",
            budget_cap_cents=5000, status=ExperimentStatus.COMPLETED,
            start_time=None, end_time=None, baseline_snapshot={},
        )
        repos["exp_repo"].save(exp)

        result = query_knowledge_base(
            show_id=show.show_id,
            show_repo=repos["show_repo"],
            exp_repo=repos["exp_repo"],
            seg_repo=repos["seg_repo"],
            frame_repo=repos["frame_repo"],
            filters={"city": "Austin"},
        )
        assert len(result["experiments"]) == 1

    def test_city_filter_mismatch_returns_empty(self, repos):
        show = _create_show(repos["show_repo"], city="Austin")
        exp = Experiment(
            experiment_id=uuid4(), show_id=show.show_id,
            segment_id=uuid4(), frame_id=uuid4(),
            channel="meta", objective="ticket_sales",
            budget_cap_cents=5000, status=ExperimentStatus.COMPLETED,
            start_time=None, end_time=None, baseline_snapshot={},
        )
        repos["exp_repo"].save(exp)

        result = query_knowledge_base(
            show_id=show.show_id,
            show_repo=repos["show_repo"],
            exp_repo=repos["exp_repo"],
            seg_repo=repos["seg_repo"],
            frame_repo=repos["frame_repo"],
            filters={"city": "Dallas"},
        )
        assert result["experiments"] == []

    def test_empty_knowledge_base(self, repos):
        show = _create_show(repos["show_repo"])
        result = query_knowledge_base(
            show.show_id, repos["show_repo"], repos["exp_repo"],
            repos["seg_repo"], repos["frame_repo"],
        )
        assert result["experiments"] == []

    def test_show_not_found(self, repos):
        result = query_knowledge_base(
            uuid4(), repos["show_repo"], repos["exp_repo"],
            repos["seg_repo"], repos["frame_repo"],
        )
        assert result["error"] == "show_not_found"
```

**Step 2: Run tests to verify they fail**

```bash
.venv/bin/pytest tests/adapters/llm/test_strategy_tools.py -v
```

Expected: FAIL with `ModuleNotFoundError`

**Step 3: Implement the tool functions**

```python
# src/growth/adapters/llm/strategy_tools.py
"""Strategy Agent tool functions.

Each function reads from repositories and returns dicts that get
JSON-serialized as tool results in the Claude conversation.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from growth.domain.models import ExperimentStatus, get_show_phase
from growth.domain.policy_config import PolicyConfig
from growth.ports.repositories import (
    ExperimentRepository,
    FrameRepository,
    SegmentRepository,
    ShowRepository,
)


def get_show_details(
    show_id: UUID,
    show_repo: ShowRepository,
) -> dict[str, Any]:
    """Get show details including computed phase and days until showtime."""
    show = show_repo.get_by_id(show_id)
    if show is None:
        return {"error": "show_not_found"}

    now = datetime.now(timezone.utc)
    phase = get_show_phase(show.show_time, now)
    delta = show.show_time - now
    days_until = int(delta.total_seconds() // 86400)

    return {
        "show_id": str(show.show_id),
        "artist_name": show.artist_name,
        "city": show.city,
        "venue": show.venue,
        "show_time": show.show_time.isoformat(),
        "timezone": show.timezone,
        "capacity": show.capacity,
        "tickets_total": show.tickets_total,
        "tickets_sold": show.tickets_sold,
        "tickets_remaining": max(0, show.tickets_total - show.tickets_sold),
        "phase": phase.value,
        "days_until_show": days_until,
    }


def get_active_experiments(
    show_id: UUID,
    exp_repo: ExperimentRepository,
    seg_repo: SegmentRepository,
    frame_repo: FrameRepository,
) -> dict[str, Any]:
    """Get all running or approved experiments for a show."""
    all_experiments = exp_repo.get_by_show(show_id)
    active_statuses = {ExperimentStatus.RUNNING, ExperimentStatus.APPROVED}
    active = [e for e in all_experiments if e.status in active_statuses]

    experiments: list[dict[str, Any]] = []
    for exp in active:
        segment = seg_repo.get_by_id(exp.segment_id)
        frame = frame_repo.get_by_id(exp.frame_id)
        experiments.append({
            "experiment_id": str(exp.experiment_id),
            "segment_id": str(exp.segment_id),
            "frame_id": str(exp.frame_id),
            "segment_name": segment.name if segment else "unknown",
            "hypothesis": frame.hypothesis if frame else "unknown",
            "promise": frame.promise if frame else "unknown",
            "channel": exp.channel,
            "budget_cap_cents": exp.budget_cap_cents,
            "status": exp.status.value,
        })

    return {"experiments": experiments}


def get_budget_status(
    show_id: UUID,
    show_repo: ShowRepository,
    exp_repo: ExperimentRepository,
    policy: PolicyConfig,
    total_budget_cents: int = 50000,
) -> dict[str, Any]:
    """Compute budget status for a show, including current phase cap."""
    show = show_repo.get_by_id(show_id)
    if show is None:
        return {"error": "show_not_found"}

    all_experiments = exp_repo.get_by_show(show_id)

    spent_cents = 0
    for exp in all_experiments:
        observations = exp_repo.get_observations(exp.experiment_id)
        spent_cents += sum(o.spend_cents for o in observations)

    remaining_cents = max(0, total_budget_cents - spent_cents)

    now = datetime.now(timezone.utc)
    phase = get_show_phase(show.show_time, now).value

    phase_caps = {
        "discovery": policy.discovery_max_pct,
        "validation": policy.validation_max_pct,
        "scale": policy.scale_max_pct,
    }
    # Map show phase to budget stage
    phase_to_stage = {"early": "discovery", "mid": "validation", "late": "scale"}
    stage = phase_to_stage.get(phase, "validation")
    current_phase_cap_pct = phase_caps.get(stage, policy.validation_max_pct)
    current_phase_cap_cents = int(total_budget_cents * current_phase_cap_pct)

    return {
        "show_id": str(show_id),
        "phase": phase,
        "total_budget_cents": total_budget_cents,
        "spent_cents": spent_cents,
        "remaining_cents": remaining_cents,
        "phase_cap_pct": phase_caps,
        "current_phase_cap_pct": current_phase_cap_pct,
        "current_phase_cap_cents": current_phase_cap_cents,
    }


def query_knowledge_base(
    show_id: UUID,
    show_repo: ShowRepository,
    exp_repo: ExperimentRepository,
    seg_repo: SegmentRepository,
    frame_repo: FrameRepository,
    filters: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Query past experiments and their outcomes for this show.

    Filters:
      - channel: exact match
      - decision: scale|hold|kill (matches latest decision)
      - city: must match this show's city (otherwise empty)
    """
    filters = filters or {}

    show = show_repo.get_by_id(show_id)
    if show is None:
        return {"error": "show_not_found"}

    if "city" in filters and filters["city"] != show.city:
        return {"experiments": []}

    all_experiments = exp_repo.get_by_show(show_id)

    experiments: list[dict[str, Any]] = []
    for exp in all_experiments:
        if "channel" in filters and exp.channel != filters["channel"]:
            continue

        segment = seg_repo.get_by_id(exp.segment_id)
        frame = frame_repo.get_by_id(exp.frame_id)
        decisions = exp_repo.get_decisions(exp.experiment_id)
        latest_decision = decisions[-1] if decisions else None

        if "decision" in filters:
            got = latest_decision.action.value if latest_decision else None
            if got != filters["decision"]:
                continue

        experiments.append({
            "experiment_id": str(exp.experiment_id),
            "show_id": str(exp.show_id),
            "city": show.city,
            "segment_id": str(exp.segment_id),
            "frame_id": str(exp.frame_id),
            "segment_name": segment.name if segment else "unknown",
            "hypothesis": frame.hypothesis if frame else "unknown",
            "promise": frame.promise if frame else "unknown",
            "channel": exp.channel,
            "budget_cap_cents": exp.budget_cap_cents,
            "status": exp.status.value,
            "decision": latest_decision.action.value if latest_decision else None,
            "confidence": latest_decision.confidence if latest_decision else None,
            "metrics": latest_decision.metrics_snapshot if latest_decision else {},
        })

    return {"experiments": experiments}
```

**Step 4: Run tests to verify they pass**

```bash
.venv/bin/pytest tests/adapters/llm/test_strategy_tools.py -v
```

Expected: all PASS

**Step 5: Commit**

```bash
git add src/growth/adapters/llm/strategy_tools.py tests/adapters/llm/test_strategy_tools.py
git commit -m "feat: Strategy Agent tool functions — real city/phase data, clean filtering"
```

---

### Task 7: Strategy Agent System Prompt and Tool Schemas

**Files:**
- Create: `src/growth/adapters/llm/prompts/__init__.py`
- Create: `src/growth/adapters/llm/prompts/strategy.py`

System prompt updated to match the tightened schema (single channel, structured SegmentDefinition, BudgetRangeCents object, EvidenceSource enum values).

**Step 1: Create the prompt and tool schemas**

```python
# src/growth/adapters/llm/prompts/__init__.py
```

```python
# src/growth/adapters/llm/prompts/strategy.py
"""Strategy Agent system prompt and tool schemas."""

STRATEGY_SYSTEM_PROMPT = """\
You are a growth strategy agent for live show ticket sales.

## Goal

Analyze the show and propose 3-5 experiment frames for the current cycle. Each frame \
defines an audience segment, a framing hypothesis, and a recommended channel and budget range.

## Process

1. Start by calling get_show_details to understand the show context.
2. Call get_active_experiments to see what's already running (avoid duplicates).
3. Call get_budget_status to understand available budget for new experiments.
4. Call query_knowledge_base to find relevant past experiments and their outcomes.
5. Synthesize your findings into 3-5 experiment frame proposals.

## Constraints

- Every hypothesis MUST cite at least one evidence reference. Valid sources: \
"past_experiment", "show_data", "budget_data". If no past experiments exist, cite show data.
- Do NOT propose segments or angles that overlap with active experiments.
- Stay within the available budget for the current phase.
- Propose exactly 3-5 frame plans. No fewer, no more.
- Each frame targets exactly ONE channel: meta, instagram, youtube, tiktok, reddit, or snapchat.

## Output Format

When you have gathered enough context, respond with a JSON object matching this schema exactly:

{
  "frame_plans": [
    {
      "segment_name": "Austin indie fans",
      "segment_definition": {
        "geo": {"city": "Austin", "radius_miles": 25},
        "interests": ["indie music", "live music"],
        "behaviors": [],
        "demographics": {"age_min": 21, "age_max": 45},
        "lookalikes": null,
        "exclusions": [],
        "notes": "Prioritize fans of smaller venues"
      },
      "estimated_size": 5000,
      "hypothesis": "Indie fans respond to intimate venue framing and limited capacity urgency.",
      "promise": "One night only — an intimate set at The Parish.",
      "evidence_refs": [
        {"source": "show_data", "id": null, "summary": "200-cap venue; 150 tickets remaining 30 days out."}
      ],
      "channel": "meta",
      "budget_range_cents": {"min": 10000, "max": 25000},
      "risk_notes": "May overlap with general live music audiences."
    }
  ],
  "reasoning_summary": "Brief explanation of your overall strategy (20-800 chars)"
}

IMPORTANT:
- segment_definition must include at least one of: geo, interests, behaviors, demographics, \
lookalikes, exclusions, or notes.
- evidence_refs summary must be 10-280 characters.
- hypothesis must be 10-220 characters.
- promise must be 5-140 characters.
- budget_range_cents.max must be >= min.
- Respond with ONLY the JSON object. No markdown, no explanation, no code fences.
"""


STRATEGY_TOOL_SCHEMAS = [
    {
        "name": "get_show_details",
        "description": "Get the show's core info: artist, city, venue, date, capacity, "
                       "current ticket sales, computed show phase (early/mid/late), "
                       "and days until showtime.",
        "input_schema": {
            "type": "object",
            "properties": {
                "show_id": {
                    "type": "string",
                    "description": "The UUID of the show to look up.",
                },
            },
            "required": ["show_id"],
        },
    },
    {
        "name": "get_active_experiments",
        "description": "Get all experiments currently in 'running' or 'approved' status "
                       "for this show, including their segment names, hypotheses, channels, "
                       "and budget caps. Use this to avoid proposing duplicate segments or angles.",
        "input_schema": {
            "type": "object",
            "properties": {
                "show_id": {
                    "type": "string",
                    "description": "The UUID of the show.",
                },
            },
            "required": ["show_id"],
        },
    },
    {
        "name": "get_budget_status",
        "description": "Get the budget status for a show: total budget, amount spent, "
                       "remaining budget, current phase, and phase-specific budget cap. "
                       "Use this to ensure proposals stay within budget.",
        "input_schema": {
            "type": "object",
            "properties": {
                "show_id": {
                    "type": "string",
                    "description": "The UUID of the show.",
                },
            },
            "required": ["show_id"],
        },
    },
    {
        "name": "query_knowledge_base",
        "description": "Search past experiments and their outcomes for this show. "
                       "Returns experiment summaries with segment names, hypotheses, "
                       "channels, Scale/Hold/Kill decisions, and key metrics. "
                       "Use this to find what worked and what didn't.",
        "input_schema": {
            "type": "object",
            "properties": {
                "show_id": {
                    "type": "string",
                    "description": "The UUID of the show.",
                },
                "filters": {
                    "type": "object",
                    "description": "Optional filters: channel (string), decision (scale|hold|kill), city (string).",
                    "properties": {
                        "channel": {"type": "string"},
                        "decision": {"type": "string", "enum": ["scale", "hold", "kill"]},
                        "city": {"type": "string"},
                    },
                },
            },
            "required": ["show_id"],
        },
    },
]
```

**Step 2: Commit**

```bash
git add src/growth/adapters/llm/prompts/
git commit -m "feat: Strategy Agent system prompt and tool schemas — aligned with tightened output schema"
```

---

### Task 8: Domain Events for Strategy Runs

**Files:**
- Modify: `src/growth/domain/events.py`
- Modify: `tests/domain/test_events.py`

Add `StrategyCompleted` and `StrategyFailed` domain events.

**Step 1: Add the event dataclasses to `src/growth/domain/events.py`**

After the existing events, add:

```python
@dataclass(frozen=True)
class StrategyCompleted(DomainEvent):
    """Emitted when the Strategy Agent produces a successful plan."""
    show_id: UUID
    run_id: UUID
    num_frame_plans: int
    segment_ids: list[UUID]
    frame_ids: list[UUID]
    turns_used: int
    total_input_tokens: int
    total_output_tokens: int
    event_type: str = field(default="strategy_completed", init=False)


@dataclass(frozen=True)
class StrategyFailed(DomainEvent):
    """Emitted when the Strategy Agent fails."""
    show_id: UUID
    run_id: UUID
    error_type: str
    error_message: str
    event_type: str = field(default="strategy_failed", init=False)
```

**Step 2: Add tests to `tests/domain/test_events.py`**

```python
def test_strategy_completed_event():
    from growth.domain.events import StrategyCompleted
    event = StrategyCompleted(
        event_id=uuid4(),
        occurred_at=datetime.now(timezone.utc),
        show_id=uuid4(),
        run_id=uuid4(),
        num_frame_plans=4,
        segment_ids=[uuid4() for _ in range(4)],
        frame_ids=[uuid4() for _ in range(4)],
        turns_used=7,
        total_input_tokens=3500,
        total_output_tokens=1200,
    )
    assert event.event_type == "strategy_completed"
    assert event.num_frame_plans == 4


def test_strategy_failed_event():
    from growth.domain.events import StrategyFailed
    event = StrategyFailed(
        event_id=uuid4(),
        occurred_at=datetime.now(timezone.utc),
        show_id=uuid4(),
        run_id=uuid4(),
        error_type="AgentTurnLimitError",
        error_message="Agent exceeded maximum turns (10)",
    )
    assert event.event_type == "strategy_failed"
    assert event.error_type == "AgentTurnLimitError"
```

**Step 3: Run tests**

```bash
.venv/bin/pytest tests/domain/test_events.py -v
```

Expected: all PASS

**Step 4: Commit**

```bash
git add src/growth/domain/events.py tests/domain/test_events.py
git commit -m "feat: StrategyCompleted and StrategyFailed domain events"
```

---

### Task 9: Strategy Service

**Files:**
- Create: `src/growth/app/services/strategy_service.py`
- Create: `tests/app/test_strategy_service.py`

Orchestrates: fetch show → build tool dispatcher (with `show_repo` passed to budget/knowledge tools) → run agent → persist segments/frames → write artifacts → emit events.

**Step 1: Write the failing tests**

```python
# tests/app/test_strategy_service.py
"""Tests for the Strategy Service."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from growth.adapters.event_log import JSONLEventLog
from growth.adapters.llm.client import ClaudeClient
from growth.adapters.llm.schemas import (
    BudgetRangeCents,
    Channel,
    EvidenceRef,
    EvidenceSource,
    FramePlan,
    SegmentDefinition,
    StrategyOutput,
)
from growth.adapters.orm import create_tables, get_engine, get_session_maker
from growth.adapters.repositories import (
    SQLAlchemyExperimentRepository,
    SQLAlchemyFrameRepository,
    SQLAlchemySegmentRepository,
    SQLAlchemyShowRepository,
)
from growth.app.services.strategy_service import StrategyRunError, StrategyService
from growth.domain.models import Show
from growth.domain.policy_config import PolicyConfig


def _make_strategy_output() -> StrategyOutput:
    plans = []
    for i in range(3):
        plans.append(FramePlan(
            segment_name=f"Segment {i} name",
            segment_definition=SegmentDefinition(interests=[f"interest_{i}"]),
            estimated_size=1000 * (i + 1),
            hypothesis=f"Hypothesis {i} that is long enough to validate properly",
            promise=f"Promise {i} here",
            evidence_refs=[
                EvidenceRef(
                    source=EvidenceSource.show_data,
                    id=None,
                    summary=f"Evidence {i} supporting this hypothesis clearly",
                ),
            ],
            channel=Channel.meta,
            budget_range_cents=BudgetRangeCents(min=5000, max=15000),
            risk_notes=None,
        ))
    return StrategyOutput(
        frame_plans=plans,
        reasoning_summary="Test strategy based on show data analysis and available budget.",
    )


VALID_STRATEGY_JSON = _make_strategy_output().model_dump_json()


def _make_text_response(text: str, input_tokens: int = 500, output_tokens: int = 300):
    block = MagicMock()
    block.type = "text"
    block.text = text
    response = MagicMock()
    response.content = [block]
    response.stop_reason = "end_turn"
    response.usage.input_tokens = input_tokens
    response.usage.output_tokens = output_tokens
    return response


def _make_tool_use_response(tool_name, tool_input, tool_use_id="toolu_1"):
    block = MagicMock()
    block.type = "tool_use"
    block.name = tool_name
    block.input = tool_input
    block.id = tool_use_id
    response = MagicMock()
    response.content = [block]
    response.stop_reason = "tool_use"
    response.usage.input_tokens = 200
    response.usage.output_tokens = 100
    return response


def _test_policy() -> PolicyConfig:
    return PolicyConfig(
        min_windows=2, min_clicks=150, min_purchases=5,
        min_incremental_tickets_per_100usd=0.0,
        max_cac_vs_baseline_ratio=0.85,
        min_conversion_rate_vs_baseline_ratio=0.50,
        max_refund_rate=0.10, max_complaint_rate=0.05,
        max_negative_comment_rate=0.15,
        confidence_weight_sample=0.4, confidence_weight_lift=0.4,
        confidence_weight_consistency=0.2,
        discovery_max_pct=0.10, validation_max_pct=0.20,
        scale_max_pct=0.40,
    )


@pytest.fixture
def setup(tmp_path):
    db_path = tmp_path / "test.db"
    engine = get_engine(f"sqlite:///{db_path}")
    create_tables(engine)
    Session = get_session_maker(engine)
    session = Session()

    show_repo = SQLAlchemyShowRepository(session)
    exp_repo = SQLAlchemyExperimentRepository(session)
    seg_repo = SQLAlchemySegmentRepository(session)
    frame_repo = SQLAlchemyFrameRepository(session)
    event_log = JSONLEventLog(tmp_path / "events.jsonl")
    runs_path = tmp_path / "runs"

    show = Show(
        show_id=uuid4(),
        artist_name="Test Artist",
        city="Austin",
        venue="The Parish",
        show_time=datetime.now(timezone.utc) + timedelta(days=30),
        timezone="America/Chicago",
        capacity=200,
        tickets_total=200,
        tickets_sold=50,
    )
    show_repo.save(show)

    mock_client = MagicMock(spec=ClaudeClient)

    service = StrategyService(
        claude_client=mock_client,
        show_repo=show_repo,
        exp_repo=exp_repo,
        seg_repo=seg_repo,
        frame_repo=frame_repo,
        event_log=event_log,
        policy=_test_policy(),
        runs_path=runs_path,
    )

    yield {
        "service": service,
        "client": mock_client,
        "show": show,
        "seg_repo": seg_repo,
        "frame_repo": frame_repo,
        "event_log": event_log,
        "runs_path": runs_path,
    }
    session.close()


class TestStrategyService:
    def test_run_creates_segments_and_frames(self, setup):
        s = setup
        s["client"].chat.side_effect = [
            _make_tool_use_response("get_show_details", {"show_id": str(s["show"].show_id)}),
            _make_text_response(VALID_STRATEGY_JSON),
        ]

        result = s["service"].run(s["show"].show_id)

        assert len(result.segment_ids) == 3
        assert len(result.frame_ids) == 3

        for seg_id in result.segment_ids:
            seg = s["seg_repo"].get_by_id(seg_id)
            assert seg is not None
            assert seg.created_by == "strategy_agent"

        for frame_id in result.frame_ids:
            frame = s["frame_repo"].get_by_id(frame_id)
            assert frame is not None

    def test_run_writes_plan_artifact(self, setup):
        s = setup
        s["client"].chat.side_effect = [
            _make_text_response(VALID_STRATEGY_JSON),
        ]

        result = s["service"].run(s["show"].show_id)

        plan_path = s["runs_path"] / str(result.run_id) / "plan.json"
        assert plan_path.exists()
        plan = json.loads(plan_path.read_text())
        assert len(plan["frame_plans"]) == 3
        assert "turns_used" in plan
        assert "total_input_tokens" in plan

    def test_run_emits_strategy_completed_event(self, setup):
        s = setup
        s["client"].chat.side_effect = [
            _make_text_response(VALID_STRATEGY_JSON),
        ]

        s["service"].run(s["show"].show_id)

        events = s["event_log"].read_all()
        assert len(events) == 1
        assert events[0]["event_type"] == "strategy_completed"

    def test_run_show_not_found_raises(self, setup):
        with pytest.raises(ValueError, match="not found"):
            setup["service"].run(uuid4())

    def test_run_agent_failure_emits_failed_event(self, setup):
        s = setup
        s["client"].chat.side_effect = [
            _make_text_response("not json"),
            _make_text_response("still not json"),
        ]

        with pytest.raises(StrategyRunError):
            s["service"].run(s["show"].show_id)

        events = s["event_log"].read_all()
        assert len(events) == 1
        assert events[0]["event_type"] == "strategy_failed"

    def test_run_returns_strategy_output(self, setup):
        s = setup
        s["client"].chat.side_effect = [
            _make_text_response(VALID_STRATEGY_JSON),
        ]

        result = s["service"].run(s["show"].show_id)

        assert "show data analysis" in result.strategy_output.reasoning_summary
        assert result.run_id is not None
```

**Step 2: Run tests to verify they fail**

```bash
.venv/bin/pytest tests/app/test_strategy_service.py -v
```

Expected: FAIL with `ModuleNotFoundError`

**Step 3: Implement the strategy service**

```python
# src/growth/app/services/strategy_service.py
"""Strategy service — orchestrates a Strategy Agent run."""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4

from growth.adapters.llm.agent_runner import run as run_agent
from growth.adapters.llm.client import ClaudeClient
from growth.adapters.llm.errors import AgentParseError, AgentTurnLimitError
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
    segment_ids: list[UUID]
    frame_ids: list[UUID]
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
        except (AgentTurnLimitError, AgentParseError) as e:
            self._emit_failure(show_id, run_id, e)
            raise StrategyRunError(str(e), run_id) from e

        strategy_output: StrategyOutput = agent_result.output

        # Persist segments and frames
        segment_ids = []
        frame_ids = []
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
        self._event_log.append(StrategyCompleted(
            event_id=uuid4(),
            occurred_at=datetime.now(timezone.utc),
            show_id=show_id,
            run_id=run_id,
            num_frame_plans=len(strategy_output.frame_plans),
            segment_ids=segment_ids,
            frame_ids=frame_ids,
            turns_used=agent_result.turns_used,
            total_input_tokens=agent_result.total_input_tokens,
            total_output_tokens=agent_result.total_output_tokens,
        ))

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
        self._event_log.append(StrategyFailed(
            event_id=uuid4(),
            occurred_at=datetime.now(timezone.utc),
            show_id=show_id,
            run_id=run_id,
            error_type=type(error).__name__,
            error_message=str(error),
        ))
```

**Step 4: Run tests to verify they pass**

```bash
.venv/bin/pytest tests/app/test_strategy_service.py -v
```

Expected: all PASS

**Step 5: Verify all existing tests still pass**

```bash
.venv/bin/pytest -v
```

**Step 6: Commit**

```bash
git add src/growth/app/services/strategy_service.py tests/app/test_strategy_service.py
git commit -m "feat: Strategy Service — orchestrates agent run with show_repo-aware tools"
```

---

### Task 10: Strategy API Endpoint

**Files:**
- Create: `src/growth/app/api/strategy.py`
- Modify: `src/growth/app/api/app.py`
- Create: `tests/api/test_strategy.py`

**Step 1: Write the failing tests**

```python
# tests/api/test_strategy.py
"""Tests for the Strategy API endpoint."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from growth.adapters.llm.result import AgentResult
from growth.adapters.llm.schemas import (
    BudgetRangeCents,
    Channel,
    EvidenceRef,
    EvidenceSource,
    FramePlan,
    SegmentDefinition,
    StrategyOutput,
)
from growth.app.api.app import create_app
from growth.app.container import Container


def _make_strategy_output() -> StrategyOutput:
    plans = []
    for i in range(3):
        plans.append(FramePlan(
            segment_name=f"Segment {i} name",
            segment_definition=SegmentDefinition(interests=[f"interest_{i}"]),
            estimated_size=1000,
            hypothesis=f"Hypothesis {i} that is long enough to validate properly",
            promise=f"Promise {i} here",
            evidence_refs=[
                EvidenceRef(source=EvidenceSource.show_data, id=None, summary=f"Evidence {i} supporting this hypothesis clearly"),
            ],
            channel=Channel.meta,
            budget_range_cents=BudgetRangeCents(min=5000, max=15000),
            risk_notes=None,
        ))
    return StrategyOutput(
        frame_plans=plans,
        reasoning_summary="Test strategy output from mock agent run.",
    )


@pytest.fixture
def client(tmp_path):
    db_path = tmp_path / "test.db"
    log_path = tmp_path / "events.jsonl"
    config_path = "config/policy.toml"
    runs_path = tmp_path / "runs"

    container = Container(
        db_url=f"sqlite:///{db_path}",
        event_log_path=log_path,
        policy_config_path=config_path,
        runs_path=runs_path,
    )

    app = create_app(container)
    yield TestClient(app)
    container.close()


def _create_show(client) -> str:
    resp = client.post("/api/shows", json={
        "artist_name": "Test Artist",
        "city": "Austin",
        "venue": "The Parish",
        "show_time": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
        "timezone": "America/Chicago",
        "capacity": 200,
        "tickets_total": 200,
        "tickets_sold": 50,
    })
    return resp.json()["show_id"]


class TestStrategyAPI:
    @patch("growth.app.services.strategy_service.run_agent")
    def test_run_strategy_success(self, mock_run_agent, client):
        show_id = _create_show(client)

        mock_run_agent.return_value = AgentResult(
            output=_make_strategy_output(),
            turns_used=2,
            total_input_tokens=700,
            total_output_tokens=400,
        )

        resp = client.post(f"/api/strategy/{show_id}/run")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["segment_ids"]) == 3
        assert len(data["frame_ids"]) == 3
        assert "reasoning_summary" in data

    def test_run_strategy_show_not_found(self, client):
        resp = client.post(f"/api/strategy/{uuid4()}/run")
        assert resp.status_code == 404
```

**Step 2: Run tests to verify they fail**

```bash
.venv/bin/pytest tests/api/test_strategy.py -v
```

Expected: FAIL with `ModuleNotFoundError`

**Step 3: Implement the endpoint**

```python
# src/growth/app/api/strategy.py
"""Strategy API routes."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Request

from growth.app.services.strategy_service import StrategyRunError

router = APIRouter()


@router.post("/{show_id}/run")
def run_strategy(show_id: UUID, request: Request):
    """Run the Strategy Agent for a show."""
    container = request.app.state.container
    service = container.strategy_service()

    try:
        result = service.run(show_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except StrategyRunError as e:
        raise HTTPException(
            status_code=502,
            detail={"error": str(e), "run_id": str(e.run_id)},
        )

    return {
        "run_id": str(result.run_id),
        "segment_ids": [str(sid) for sid in result.segment_ids],
        "frame_ids": [str(fid) for fid in result.frame_ids],
        "reasoning_summary": result.strategy_output.reasoning_summary,
        "turns_used": result.turns_used,
        "total_input_tokens": result.total_input_tokens,
        "total_output_tokens": result.total_output_tokens,
    }
```

**Step 4: Register the router in `src/growth/app/api/app.py`**

Add after the existing router registrations:

```python
from growth.app.api.strategy import router as strategy_router
app.include_router(strategy_router, prefix="/api/strategy", tags=["strategy"])
```

**Step 5: Run tests**

```bash
.venv/bin/pytest tests/api/test_strategy.py -v
```

Expected: all PASS

**Step 6: Commit**

```bash
git add src/growth/app/api/strategy.py src/growth/app/api/app.py tests/api/test_strategy.py
git commit -m "feat: Strategy API endpoint — POST /api/strategy/{show_id}/run"
```

---

### Task 11: Container Wiring for Strategy Service

**Files:**
- Modify: `src/growth/app/container.py`
- Modify: `tests/app/test_container.py`

**Step 1: Add the test to `tests/app/test_container.py`**

```python
def test_provides_strategy_service(self, container):
    svc = container.strategy_service()
    assert svc is not None
```

**Step 2: Run test to verify it fails**

```bash
.venv/bin/pytest tests/app/test_container.py::TestContainer::test_provides_strategy_service -v
```

Expected: FAIL with `AttributeError`

**Step 3: Update the container**

In `src/growth/app/container.py`:

1. Add `runs_path` parameter to `__init__`:

```python
def __init__(
    self,
    db_url: str = "sqlite:///growth.db",
    event_log_path: str | Path = "data/events.jsonl",
    policy_config_path: str | Path = "config/policy.toml",
    runs_path: str | Path = "data/runs",
):
    # ... existing code ...
    self._runs_path = Path(runs_path)
```

2. Add `claude_client()` method:

```python
def claude_client(self):
    from growth.adapters.llm.client import ClaudeClient
    return ClaudeClient()
```

3. Add `strategy_service()` method:

```python
def strategy_service(self):
    from growth.app.services.strategy_service import StrategyService
    return StrategyService(
        claude_client=self.claude_client(),
        show_repo=self.show_repo(),
        exp_repo=self.experiment_repo(),
        seg_repo=self.segment_repo(),
        frame_repo=self.frame_repo(),
        event_log=self.event_log(),
        policy=self.policy_config(),
        runs_path=self._runs_path,
    )
```

**Step 4: Run tests**

```bash
.venv/bin/pytest tests/app/test_container.py -v
```

Expected: all PASS

**Step 5: Verify all existing tests still pass**

```bash
.venv/bin/pytest -v
```

**Step 6: Commit**

```bash
git add src/growth/app/container.py tests/app/test_container.py
git commit -m "feat: wire StrategyService into DI container with runs_path and claude_client"
```

---

### Task 12: Full Test Suite Verification

**Step 1: Run the full test suite**

```bash
.venv/bin/pytest -v --tb=short
```

Expected: all tests PASS.

**Step 2: Verify the app factory imports cleanly**

```bash
ANTHROPIC_API_KEY=dummy .venv/bin/python -c "from growth.app.api.app import create_app; print('OK')"
```

Expected: prints "OK".

**Step 3: Tag**

```bash
git tag v0.3.0-strategy-agent
```

---

## Architecture Summary

```
Shared Infrastructure (reused by all agents):
  adapters/llm/client.py        → ClaudeClient wraps anthropic SDK, AgentAPIError on failure
  adapters/llm/agent_runner.py  → Normalized content blocks, multi-tool dispatch, retry
  adapters/llm/errors.py        → AgentTurnLimitError, AgentParseError, AgentAPIError
  adapters/llm/result.py        → AgentResult dataclass

Strategy Agent:
  adapters/llm/schemas.py            → Enums (Channel, EvidenceSource), SegmentDefinition,
                                       BudgetRangeCents, FramePlan, StrategyOutput
  adapters/llm/strategy_tools.py     → 4 tools with show_repo for real city/phase data
  adapters/llm/prompts/strategy.py   → System prompt + tool schemas
  app/services/strategy_service.py   → Orchestrates run → persist → artifacts → events
  app/api/strategy.py                → POST /api/strategy/{show_id}/run

Supporting:
  domain/events.py     → StrategyCompleted, StrategyFailed
  app/container.py     → strategy_service() + claude_client() providers
```

## File Inventory

### New files:
| File | Purpose |
|------|---------|
| `src/growth/adapters/llm/__init__.py` | LLM adapters package |
| `src/growth/adapters/llm/errors.py` | Agent error types (with AgentAPIError.cause) |
| `src/growth/adapters/llm/result.py` | AgentResult dataclass |
| `src/growth/adapters/llm/client.py` | Claude API client (wraps SDK errors) |
| `src/growth/adapters/llm/agent_runner.py` | Normalized tool-use loop runner |
| `src/growth/adapters/llm/schemas.py` | Tightened output schemas with enums |
| `src/growth/adapters/llm/strategy_tools.py` | Tool functions with show_repo |
| `src/growth/adapters/llm/prompts/__init__.py` | Prompts package |
| `src/growth/adapters/llm/prompts/strategy.py` | System prompt and tool schemas |
| `src/growth/app/services/strategy_service.py` | Strategy run orchestration |
| `src/growth/app/api/strategy.py` | Strategy API endpoint |
| `tests/adapters/llm/__init__.py` | LLM test package |
| `tests/adapters/llm/test_result.py` | Result and error type tests |
| `tests/adapters/llm/test_client.py` | Client wrapper tests |
| `tests/adapters/llm/test_agent_runner.py` | Runner loop tests |
| `tests/adapters/llm/test_strategy_schemas.py` | Schema validation tests |
| `tests/adapters/llm/test_strategy_tools.py` | Tool function tests |
| `tests/app/test_strategy_service.py` | Service integration tests |
| `tests/api/test_strategy.py` | API endpoint tests |

### Modified files:
| File | Changes |
|------|---------|
| `pyproject.toml` | Add `anthropic` SDK, bump to v0.3.0 |
| `src/growth/domain/events.py` | Add `StrategyCompleted`, `StrategyFailed` |
| `src/growth/app/container.py` | Add `runs_path`, `claude_client()`, `strategy_service()` |
| `src/growth/app/api/app.py` | Register strategy router |
| `tests/domain/test_events.py` | Tests for new events |
| `tests/app/test_container.py` | Test for strategy_service provider |
