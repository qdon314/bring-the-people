"""Pydantic schemas for LLM agent structured outputs."""
from __future__ import annotations

from enum import Enum
from typing import Any, Optional

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
    id: Optional[str] = None
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

    geo: Optional[dict[str, Any]] = None
    interests: list[str] = Field(default_factory=list, max_length=50)
    behaviors: list[str] = Field(default_factory=list, max_length=50)
    demographics: Optional[dict[str, Any]] = None
    lookalikes: Optional[dict[str, Any]] = None
    exclusions: list[str] = Field(default_factory=list, max_length=50)
    notes: Optional[str] = Field(default=None, max_length=280)

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
    estimated_size: Optional[conint(ge=0)] = None  # type: ignore[valid-type]
    hypothesis: str = Field(min_length=10, max_length=220)
    promise: str = Field(min_length=5, max_length=140)
    evidence_refs: list[EvidenceRef] = Field(min_length=1, max_length=4)
    channel: Channel
    budget_range_cents: BudgetRangeCents
    risk_notes: Optional[str] = Field(default=None, max_length=280)


class StrategyOutput(BaseModel):
    """Complete output from the Strategy Agent."""

    frame_plans: list[FramePlan] = Field(min_length=3, max_length=5)
    reasoning_summary: str = Field(min_length=20, max_length=800)
