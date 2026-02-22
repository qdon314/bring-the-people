"""Tests for the deterministic decision engine."""
from growth.domain.models import DecisionAction
from growth.domain.policies import check_evidence_minimums, check_guardrails, check_kill_conditions, check_scale_conditions, evaluate
from growth.domain.policy_config import PolicyConfig


class TestGuardrails:
    def test_refund_rate_over_limit_kills(self):
        result = check_guardrails(
            refund_rate=0.12,
            complaint_rate=0.01,
            negative_comment_rate=0.05,
            max_refund_rate=0.10,
            max_complaint_rate=0.05,
            max_negative_comment_rate=0.15,
        )
        assert result == DecisionAction.KILL

    def test_complaint_rate_over_limit_kills(self):
        result = check_guardrails(
            refund_rate=0.02,
            complaint_rate=0.08,
            negative_comment_rate=0.05,
            max_refund_rate=0.10,
            max_complaint_rate=0.05,
            max_negative_comment_rate=0.15,
        )
        assert result == DecisionAction.KILL

    def test_negative_comment_rate_over_limit_kills(self):
        result = check_guardrails(
            refund_rate=0.02,
            complaint_rate=0.01,
            negative_comment_rate=0.20,
            max_refund_rate=0.10,
            max_complaint_rate=0.05,
            max_negative_comment_rate=0.15,
        )
        assert result == DecisionAction.KILL

    def test_all_within_limits_passes(self):
        result = check_guardrails(
            refund_rate=0.02,
            complaint_rate=0.01,
            negative_comment_rate=0.05,
            max_refund_rate=0.10,
            max_complaint_rate=0.05,
            max_negative_comment_rate=0.15,
        )
        assert result is None

    def test_exactly_at_limit_passes(self):
        result = check_guardrails(
            refund_rate=0.10,
            complaint_rate=0.05,
            negative_comment_rate=0.15,
            max_refund_rate=0.10,
            max_complaint_rate=0.05,
            max_negative_comment_rate=0.15,
        )
        assert result is None


class TestEvidenceMinimums:
    def test_all_met(self):
        assert check_evidence_minimums(
            num_windows=3, total_clicks=200, total_purchases=8,
            min_windows=2, min_clicks=150, min_purchases=5,
        ) is True

    def test_windows_not_met(self):
        assert check_evidence_minimums(
            num_windows=1, total_clicks=200, total_purchases=8,
            min_windows=2, min_clicks=150, min_purchases=5,
        ) is False

    def test_clicks_not_met(self):
        assert check_evidence_minimums(
            num_windows=3, total_clicks=100, total_purchases=8,
            min_windows=2, min_clicks=150, min_purchases=5,
        ) is False

    def test_purchases_not_met(self):
        assert check_evidence_minimums(
            num_windows=3, total_clicks=200, total_purchases=3,
            min_windows=2, min_clicks=150, min_purchases=5,
        ) is False

    def test_exactly_at_minimums(self):
        assert check_evidence_minimums(
            num_windows=2, total_clicks=150, total_purchases=5,
            min_windows=2, min_clicks=150, min_purchases=5,
        ) is True


class TestKillConditions:
    def test_budget_exhausted_no_purchases_kills(self):
        result = check_kill_conditions(
            spend_cents=5000,
            budget_cap_cents=5000,
            total_purchases=0,
            conversion_rate=0.0,
            baseline_conversion_rate=0.02,
            total_clicks=200,
            min_clicks=150,
            min_conversion_rate_vs_baseline_ratio=0.50,
        )
        assert result == DecisionAction.KILL

    def test_conversion_below_threshold_kills(self):
        result = check_kill_conditions(
            spend_cents=3000,
            budget_cap_cents=5000,
            total_purchases=1,
            conversion_rate=0.005,
            baseline_conversion_rate=0.02,
            total_clicks=200,
            min_clicks=150,
            min_conversion_rate_vs_baseline_ratio=0.50,
        )
        # 0.005 < 0.02 * 0.50 = 0.01 → KILL
        assert result == DecisionAction.KILL

    def test_conversion_ok_no_kill(self):
        result = check_kill_conditions(
            spend_cents=3000,
            budget_cap_cents=5000,
            total_purchases=5,
            conversion_rate=0.025,
            baseline_conversion_rate=0.02,
            total_clicks=200,
            min_clicks=150,
            min_conversion_rate_vs_baseline_ratio=0.50,
        )
        assert result is None

    def test_low_clicks_skips_conversion_check(self):
        # Below min_clicks, conversion check should not trigger kill
        result = check_kill_conditions(
            spend_cents=1000,
            budget_cap_cents=5000,
            total_purchases=0,
            conversion_rate=0.0,
            baseline_conversion_rate=0.02,
            total_clicks=50,
            min_clicks=150,
            min_conversion_rate_vs_baseline_ratio=0.50,
        )
        assert result is None


class TestScaleConditions:
    def test_all_conditions_met_scales(self):
        result = check_scale_conditions(
            incremental_tickets_per_100usd=1.5,
            cac_cents=600,
            baseline_cac_cents=800,
            min_incremental_tickets_per_100usd=0.0,
            max_cac_vs_baseline_ratio=0.85,
        )
        assert result is True

    def test_no_incremental_tickets_does_not_scale(self):
        result = check_scale_conditions(
            incremental_tickets_per_100usd=0.0,
            cac_cents=600,
            baseline_cac_cents=800,
            min_incremental_tickets_per_100usd=0.0,
            max_cac_vs_baseline_ratio=0.85,
        )
        # > 0 required, 0.0 is not > 0
        assert result is False

    def test_cac_too_high_does_not_scale(self):
        result = check_scale_conditions(
            incremental_tickets_per_100usd=1.5,
            cac_cents=750,
            baseline_cac_cents=800,
            min_incremental_tickets_per_100usd=0.0,
            max_cac_vs_baseline_ratio=0.85,
        )
        # 750 > 800 * 0.85 = 680 → does not scale
        assert result is False

    def test_zero_baseline_cac_does_not_scale(self):
        result = check_scale_conditions(
            incremental_tickets_per_100usd=1.5,
            cac_cents=100,
            baseline_cac_cents=0,
            min_incremental_tickets_per_100usd=0.0,
            max_cac_vs_baseline_ratio=0.85,
        )
        # No baseline to compare against
        assert result is False


def _default_config() -> PolicyConfig:
    return PolicyConfig(
        min_windows=2,
        min_clicks=150,
        min_purchases=5,
        min_incremental_tickets_per_100usd=0.0,
        max_cac_vs_baseline_ratio=0.85,
        min_conversion_rate_vs_baseline_ratio=0.50,
        max_refund_rate=0.10,
        max_complaint_rate=0.05,
        max_negative_comment_rate=0.15,
        confidence_weight_sample=0.4,
        confidence_weight_lift=0.4,
        confidence_weight_consistency=0.2,
        discovery_max_pct=0.10,
        validation_max_pct=0.20,
        scale_max_pct=0.40,
    )


class TestEvaluate:
    def test_guardrail_violation_returns_kill(self):
        decision = evaluate(
            num_windows=3,
            total_clicks=200,
            total_purchases=8,
            spend_cents=3000,
            budget_cap_cents=5000,
            conversion_rate=0.04,
            baseline_conversion_rate=0.02,
            incremental_tickets_per_100usd=1.5,
            cac_cents=600,
            baseline_cac_cents=800,
            refund_rate=0.12,  # Over limit
            complaint_rate=0.01,
            negative_comment_rate=0.05,
            policy=_default_config(),
        )
        assert decision.action == DecisionAction.KILL
        assert "refund" in decision.rationale.lower()

    def test_kill_condition_returns_kill(self):
        decision = evaluate(
            num_windows=3,
            total_clicks=200,
            total_purchases=8,
            spend_cents=3000,
            budget_cap_cents=5000,
            conversion_rate=0.005,  # Below threshold
            baseline_conversion_rate=0.02,
            incremental_tickets_per_100usd=1.5,
            cac_cents=600,
            baseline_cac_cents=800,
            refund_rate=0.02,
            complaint_rate=0.01,
            negative_comment_rate=0.05,
            policy=_default_config(),
        )
        assert decision.action == DecisionAction.KILL
        assert "conversion" in decision.rationale.lower()

    def test_scale_conditions_met_returns_scale(self):
        decision = evaluate(
            num_windows=3,
            total_clicks=200,
            total_purchases=8,
            spend_cents=3000,
            budget_cap_cents=5000,
            conversion_rate=0.04,
            baseline_conversion_rate=0.02,
            incremental_tickets_per_100usd=1.5,
            cac_cents=600,
            baseline_cac_cents=800,
            refund_rate=0.02,
            complaint_rate=0.01,
            negative_comment_rate=0.05,
            policy=_default_config(),
        )
        assert decision.action == DecisionAction.SCALE

    def test_insufficient_evidence_returns_hold(self):
        decision = evaluate(
            num_windows=1,  # Not enough
            total_clicks=200,
            total_purchases=8,
            spend_cents=3000,
            budget_cap_cents=5000,
            conversion_rate=0.04,
            baseline_conversion_rate=0.02,
            incremental_tickets_per_100usd=1.5,
            cac_cents=600,
            baseline_cac_cents=800,
            refund_rate=0.02,
            complaint_rate=0.01,
            negative_comment_rate=0.05,
            policy=_default_config(),
        )
        assert decision.action == DecisionAction.HOLD
        assert "evidence" in decision.rationale.lower()

    def test_no_scale_conditions_met_returns_hold(self):
        decision = evaluate(
            num_windows=3,
            total_clicks=200,
            total_purchases=8,
            spend_cents=3000,
            budget_cap_cents=5000,
            conversion_rate=0.04,
            baseline_conversion_rate=0.02,
            incremental_tickets_per_100usd=0.0,  # No incremental
            cac_cents=600,
            baseline_cac_cents=800,
            refund_rate=0.02,
            complaint_rate=0.01,
            negative_comment_rate=0.05,
            policy=_default_config(),
        )
        assert decision.action == DecisionAction.HOLD
        assert "threshold" in decision.rationale.lower()
