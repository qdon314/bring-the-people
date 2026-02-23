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
