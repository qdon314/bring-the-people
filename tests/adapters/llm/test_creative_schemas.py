"""Tests for Creative Agent output schemas."""
import pytest
from pydantic import ValidationError

from growth.adapters.llm.schemas import CreativeOutput, CreativeVariantDraft


class TestCreativeVariantDraft:
    def test_valid(self):
        draft = CreativeVariantDraft(
            hook="Don't miss this show",
            body="An unforgettable night of live indie music in Austin at The Parish",
            cta="Get your tickets now",
            reasoning="Direct urgency angle targeting indie music fans in Austin",
        )
        assert draft.hook == "Don't miss this show"

    def test_rejects_short_hook(self):
        with pytest.raises(ValidationError):
            CreativeVariantDraft(hook="Hi", body="Valid body text for the ad copy here",
                                cta="Buy now please", reasoning="Valid reasoning for the angle")

    def test_rejects_short_body(self):
        with pytest.raises(ValidationError):
            CreativeVariantDraft(hook="Valid hook text", body="Short",
                                cta="Buy now please", reasoning="Valid reasoning for the angle")

    def test_rejects_short_cta(self):
        with pytest.raises(ValidationError):
            CreativeVariantDraft(hook="Valid hook text", body="Valid body text for the ad copy here",
                                cta="Buy", reasoning="Valid reasoning for the angle")


class TestCreativeOutput:
    def _make_draft(self, hook: str = "Don't miss this show") -> CreativeVariantDraft:
        return CreativeVariantDraft(
            hook=hook,
            body="An unforgettable night of live indie music in Austin at The Parish",
            cta="Get your tickets now",
            reasoning="Direct urgency angle targeting indie music fans in Austin",
        )

    def test_valid_with_2_variants(self):
        output = CreativeOutput(
            variants=[self._make_draft("Hook A variant"), self._make_draft("Hook B variant")],
            reasoning_summary="Two variants targeting urgency and social proof angles.",
        )
        assert len(output.variants) == 2

    def test_valid_with_3_variants(self):
        output = CreativeOutput(
            variants=[self._make_draft(f"Hook {c} variant") for c in "ABC"],
            reasoning_summary="Three variants covering urgency, social proof, and scarcity.",
        )
        assert len(output.variants) == 3

    def test_rejects_1_variant(self):
        with pytest.raises(ValidationError):
            CreativeOutput(
                variants=[self._make_draft()],
                reasoning_summary="Only one variant which is not enough.",
            )

    def test_rejects_4_variants(self):
        with pytest.raises(ValidationError):
            CreativeOutput(
                variants=[self._make_draft(f"Hook {i} variant") for i in range(4)],
                reasoning_summary="Four variants which exceeds the maximum.",
            )

    def test_json_round_trip(self):
        output = CreativeOutput(
            variants=[self._make_draft("Hook A variant"), self._make_draft("Hook B variant")],
            reasoning_summary="Round trip test for creative output serialization.",
        )
        json_str = output.model_dump_json()
        parsed = CreativeOutput.model_validate_json(json_str)
        assert parsed.variants[0].hook == output.variants[0].hook
