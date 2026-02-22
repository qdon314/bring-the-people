"""Deterministic decision engine. Pure functions, no IO."""
from __future__ import annotations

from growth.domain.models import Decision, DecisionAction
from growth.domain.policy_config import PolicyConfig


def check_guardrails(
    refund_rate: float,
    complaint_rate: float,
    negative_comment_rate: float,
    max_refund_rate: float,
    max_complaint_rate: float,
    max_negative_comment_rate: float,
) -> DecisionAction | None:
    """Check guardrail metrics. Returns KILL if any exceeded, None if all OK."""
    if refund_rate > max_refund_rate:
        return DecisionAction.KILL
    if complaint_rate > max_complaint_rate:
        return DecisionAction.KILL
    if negative_comment_rate > max_negative_comment_rate:
        return DecisionAction.KILL
    return None


def check_evidence_minimums(
    num_windows: int,
    total_clicks: int,
    total_purchases: int,
    min_windows: int,
    min_clicks: int,
    min_purchases: int,
) -> bool:
    """Return True if all evidence minimums are met."""
    return (
        num_windows >= min_windows
        and total_clicks >= min_clicks
        and total_purchases >= min_purchases
    )


def check_kill_conditions(
    spend_cents: int,
    budget_cap_cents: int,
    total_purchases: int,
    conversion_rate: float,
    baseline_conversion_rate: float,
    total_clicks: int,
    min_clicks: int,
    min_conversion_rate_vs_baseline_ratio: float,
) -> DecisionAction | None:
    """Check kill conditions. Returns KILL if triggered, None otherwise."""
    # Budget exhausted with zero purchases
    if spend_cents >= budget_cap_cents and total_purchases == 0:
        return DecisionAction.KILL

    # Conversion rate below threshold (only if enough clicks to judge)
    if total_clicks >= min_clicks and baseline_conversion_rate > 0:
        threshold = baseline_conversion_rate * min_conversion_rate_vs_baseline_ratio
        if conversion_rate < threshold:
            return DecisionAction.KILL

    return None


def check_scale_conditions(
    incremental_tickets_per_100usd: float,
    cac_cents: float,
    baseline_cac_cents: float,
    min_incremental_tickets_per_100usd: float,
    max_cac_vs_baseline_ratio: float,
) -> bool:
    """Check if scale conditions are met. Returns True if experiment should scale."""
    # Must have incremental tickets
    if incremental_tickets_per_100usd <= min_incremental_tickets_per_100usd:
        return False

    # Must have valid baseline to compare against
    if baseline_cac_cents <= 0:
        return False

    # CAC must be below threshold relative to baseline
    max_cac = baseline_cac_cents * max_cac_vs_baseline_ratio
    if cac_cents > max_cac:
        return False

    return True


def _calculate_confidence(
    num_windows: int,
    min_windows: int,
    total_clicks: int,
    min_clicks: int,
    total_purchases: int,
    min_purchases: int,
    cac_cents: float,
    baseline_cac_cents: float,
    confidence_weight_sample: float,
    confidence_weight_lift: float,
    confidence_weight_consistency: float,
) -> float:
    """Calculate confidence score for a decision."""
    # Sample sufficiency: how well we meet minimums
    window_ratio = min(num_windows / min_windows, 2.0) / 2.0
    click_ratio = min(total_clicks / min_clicks, 2.0) / 2.0
    purchase_ratio = min(total_purchases / min_purchases, 2.0) / 2.0
    sample_score = (window_ratio + click_ratio + purchase_ratio) / 3.0

    # Lift strength: how much better than baseline
    if baseline_cac_cents > 0:
        lift_ratio = max(0, 1.0 - (cac_cents / baseline_cac_cents))
    else:
        lift_ratio = 0.0
    lift_score = min(lift_ratio * 2, 1.0)  # Scale up to 1.0

    # Window consistency: simplified - assume consistent if enough windows
    consistency_score = min(num_windows / (min_windows * 2), 1.0)

    confidence = (
        sample_score * confidence_weight_sample +
        lift_score * confidence_weight_lift +
        consistency_score * confidence_weight_consistency
    )
    return round(confidence, 2)


def evaluate(
    num_windows: int,
    total_clicks: int,
    total_purchases: int,
    spend_cents: int,
    budget_cap_cents: int,
    conversion_rate: float,
    baseline_conversion_rate: float,
    incremental_tickets_per_100usd: float,
    cac_cents: float,
    baseline_cac_cents: float,
    refund_rate: float,
    complaint_rate: float,
    negative_comment_rate: float,
    policy: PolicyConfig,
) -> Decision:
    """Evaluate an experiment and return a decision.

    Decision hierarchy:
    1. Guardrails - if violated, KILL immediately
    2. Kill conditions - if triggered, KILL
    3. Evidence minimums - if not met, HOLD
    4. Scale conditions - if met, SCALE; else HOLD
    """
    from uuid import uuid4

    # 1. Check guardrails first (highest priority)
    guardrail_result = check_guardrails(
        refund_rate=refund_rate,
        complaint_rate=complaint_rate,
        negative_comment_rate=negative_comment_rate,
        max_refund_rate=policy.max_refund_rate,
        max_complaint_rate=policy.max_complaint_rate,
        max_negative_comment_rate=policy.max_negative_comment_rate,
    )
    if guardrail_result == DecisionAction.KILL:
        return Decision(
            decision_id=uuid4(),
            experiment_id=uuid4(),  # Will be set by caller
            action=DecisionAction.KILL,
            confidence=1.0,
            rationale=f"Guardrail violated: refund_rate={refund_rate:.2%}, complaint_rate={complaint_rate:.2%}, negative_comment_rate={negative_comment_rate:.2%}",
            policy_version="v1",
            metrics_snapshot={
                "refund_rate": refund_rate,
                "complaint_rate": complaint_rate,
                "negative_comment_rate": negative_comment_rate,
            },
        )

    # 2. Check kill conditions
    kill_result = check_kill_conditions(
        spend_cents=spend_cents,
        budget_cap_cents=budget_cap_cents,
        total_purchases=total_purchases,
        conversion_rate=conversion_rate,
        baseline_conversion_rate=baseline_conversion_rate,
        total_clicks=total_clicks,
        min_clicks=policy.min_clicks,
        min_conversion_rate_vs_baseline_ratio=policy.min_conversion_rate_vs_baseline_ratio,
    )
    if kill_result == DecisionAction.KILL:
        return Decision(
            decision_id=uuid4(),
            experiment_id=uuid4(),
            action=DecisionAction.KILL,
            confidence=0.9,
            rationale=f"Kill condition triggered: conversion_rate={conversion_rate:.2%} below threshold",
            policy_version="v1",
            metrics_snapshot={
                "conversion_rate": conversion_rate,
                "baseline_conversion_rate": baseline_conversion_rate,
                "spend_cents": spend_cents,
                "budget_cap_cents": budget_cap_cents,
            },
        )

    # 3. Check evidence minimums
    evidence_met = check_evidence_minimums(
        num_windows=num_windows,
        total_clicks=total_clicks,
        total_purchases=total_purchases,
        min_windows=policy.min_windows,
        min_clicks=policy.min_clicks,
        min_purchases=policy.min_purchases,
    )
    if not evidence_met:
        return Decision(
            decision_id=uuid4(),
            experiment_id=uuid4(),
            action=DecisionAction.HOLD,
            confidence=0.5,
            rationale=f"Insufficient evidence: windows={num_windows}, clicks={total_clicks}, purchases={total_purchases}",
            policy_version="v1",
            metrics_snapshot={
                "num_windows": num_windows,
                "total_clicks": total_clicks,
                "total_purchases": total_purchases,
            },
        )

    # 4. Check scale conditions
    should_scale = check_scale_conditions(
        incremental_tickets_per_100usd=incremental_tickets_per_100usd,
        cac_cents=cac_cents,
        baseline_cac_cents=baseline_cac_cents,
        min_incremental_tickets_per_100usd=policy.min_incremental_tickets_per_100usd,
        max_cac_vs_baseline_ratio=policy.max_cac_vs_baseline_ratio,
    )

    if should_scale:
        confidence = _calculate_confidence(
            num_windows=num_windows,
            min_windows=policy.min_windows,
            total_clicks=total_clicks,
            min_clicks=policy.min_clicks,
            total_purchases=total_purchases,
            min_purchases=policy.min_purchases,
            cac_cents=cac_cents,
            baseline_cac_cents=baseline_cac_cents,
            confidence_weight_sample=policy.confidence_weight_sample,
            confidence_weight_lift=policy.confidence_weight_lift,
            confidence_weight_consistency=policy.confidence_weight_consistency,
        )
        return Decision(
            decision_id=uuid4(),
            experiment_id=uuid4(),
            action=DecisionAction.SCALE,
            confidence=confidence,
            rationale=f"Scale conditions met: CAC ${cac_cents/100:.2f} vs baseline ${baseline_cac_cents/100:.2f}",
            policy_version="v1",
            metrics_snapshot={
                "cac_cents": cac_cents,
                "baseline_cac_cents": baseline_cac_cents,
                "incremental_tickets_per_100usd": incremental_tickets_per_100usd,
            },
        )
    else:
        return Decision(
            decision_id=uuid4(),
            experiment_id=uuid4(),
            action=DecisionAction.HOLD,
            confidence=0.6,
            rationale=f"Scale threshold not met: incremental_tickets={incremental_tickets_per_100usd}, CAC ${cac_cents/100:.2f}",
            policy_version="v1",
            metrics_snapshot={
                "cac_cents": cac_cents,
                "baseline_cac_cents": baseline_cac_cents,
                "incremental_tickets_per_100usd": incremental_tickets_per_100usd,
            },
        )
