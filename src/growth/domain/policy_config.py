"""Policy configuration loaded from TOML."""
from __future__ import annotations

try:
    import tomllib
except ImportError:
    import tomli as tomllib
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class PolicyConfig:
    # Evidence minimums
    min_windows: int
    min_clicks: int
    min_purchases: int

    # Scale thresholds
    min_incremental_tickets_per_100usd: float
    max_cac_vs_baseline_ratio: float

    # Kill thresholds
    min_conversion_rate_vs_baseline_ratio: float

    # Guardrails
    max_refund_rate: float
    max_complaint_rate: float
    max_negative_comment_rate: float

    # Confidence weights
    confidence_weight_sample: float
    confidence_weight_lift: float
    confidence_weight_consistency: float

    # Budget caps
    discovery_max_pct: float
    validation_max_pct: float
    scale_max_pct: float

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> PolicyConfig:
        return cls(
            min_windows=data["evidence_minimums"]["min_windows"],
            min_clicks=data["evidence_minimums"]["min_clicks"],
            min_purchases=data["evidence_minimums"]["min_purchases"],
            min_incremental_tickets_per_100usd=data["scale_thresholds"]["min_incremental_tickets_per_100usd"],
            max_cac_vs_baseline_ratio=data["scale_thresholds"]["max_cac_vs_baseline_ratio"],
            min_conversion_rate_vs_baseline_ratio=data["kill_thresholds"]["min_conversion_rate_vs_baseline_ratio"],
            max_refund_rate=data["guardrails"]["max_refund_rate"],
            max_complaint_rate=data["guardrails"]["max_complaint_rate"],
            max_negative_comment_rate=data["guardrails"]["max_negative_comment_rate"],
            confidence_weight_sample=data["confidence_weights"]["sample_sufficiency"],
            confidence_weight_lift=data["confidence_weights"]["lift_strength"],
            confidence_weight_consistency=data["confidence_weights"]["window_consistency"],
            discovery_max_pct=data["budget_caps"]["discovery_max_pct"],
            validation_max_pct=data["budget_caps"]["validation_max_pct"],
            scale_max_pct=data["budget_caps"]["scale_max_pct"],
        )


def load_policy_config(path: Path) -> PolicyConfig:
    """Load policy config from a TOML file."""
    with open(path, "rb") as f:
        data = tomllib.load(f)
    return PolicyConfig.from_dict(data)
