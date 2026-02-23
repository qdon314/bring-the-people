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
