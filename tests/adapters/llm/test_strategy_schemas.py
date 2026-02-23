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
