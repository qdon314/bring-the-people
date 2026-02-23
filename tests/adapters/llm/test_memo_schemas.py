"""Tests for Memo Agent output schemas."""
import pytest
from pydantic import ValidationError

from growth.adapters.llm.schemas import MemoOutput


class TestMemoOutput:
    def _make_valid(self, **overrides) -> MemoOutput:
        defaults = dict(
            what_worked="Instagram Reels targeting college students drove 12 purchases at $8.50 CAC",
            what_failed="Meta broad audience experiment killed after zero purchases in 3 days of spend",
            cost_per_seat_cents=850,
            cost_per_seat_explanation="Blended CAC across 3 experiments: $2,550 spend / 30 purchases",
            next_three_tests=["Test TikTok with artist interview clips targeting 18-24 in Austin"],
            policy_exceptions=None,
            markdown="# Cycle Report\n\n## What Worked\n\nInstagram Reels performed well...",
            reasoning_summary="This cycle focused on discovery with 3 experiments across 2 channels.",
        )
        defaults.update(overrides)
        return MemoOutput(**defaults)

    def test_valid(self):
        memo = self._make_valid()
        assert memo.cost_per_seat_cents == 850

    def test_rejects_negative_cost(self):
        with pytest.raises(ValidationError):
            self._make_valid(cost_per_seat_cents=-100)

    def test_rejects_empty_next_tests(self):
        with pytest.raises(ValidationError):
            self._make_valid(next_three_tests=[])

    def test_rejects_too_many_next_tests(self):
        with pytest.raises(ValidationError):
            self._make_valid(next_three_tests=["a", "b", "c", "d"])

    def test_nullable_policy_exceptions(self):
        memo = self._make_valid(policy_exceptions=None)
        assert memo.policy_exceptions is None

    def test_with_policy_exceptions(self):
        memo = self._make_valid(policy_exceptions="Overrode kill on experiment #3 per producer request")
        assert memo.policy_exceptions is not None

    def test_json_round_trip(self):
        memo = self._make_valid()
        json_str = memo.model_dump_json()
        parsed = MemoOutput.model_validate_json(json_str)
        assert parsed.cost_per_seat_cents == memo.cost_per_seat_cents
