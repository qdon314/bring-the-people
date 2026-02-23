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
