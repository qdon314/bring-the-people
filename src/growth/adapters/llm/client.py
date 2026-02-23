"""Thin wrapper around the Anthropic SDK."""
from __future__ import annotations

from typing import Any

from anthropic import Anthropic
from anthropic.types import Message

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
    ) -> Message:
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
