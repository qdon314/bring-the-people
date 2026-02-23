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
