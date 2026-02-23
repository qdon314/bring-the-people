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
