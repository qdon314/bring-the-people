"""Tests for policy configuration loading."""
from pathlib import Path

from growth.domain.policy_config import PolicyConfig, load_policy_config


class TestPolicyConfig:
    def test_load_from_project_toml(self):
        config_path = Path(__file__).parents[2] / "config" / "policy.toml"
        config = load_policy_config(config_path)
        assert config.min_windows == 2
        assert config.min_clicks == 150
        assert config.min_purchases == 5
        assert config.max_cac_vs_baseline_ratio == 0.85
        assert config.max_refund_rate == 0.10
        assert config.confidence_weight_sample == 0.4
        assert config.confidence_weight_lift == 0.4
        assert config.confidence_weight_consistency == 0.2
        assert config.discovery_max_pct == 0.10
        assert config.scale_max_pct == 0.40

    def test_load_from_dict(self):
        data = {
            "evidence_minimums": {"min_windows": 3, "min_clicks": 200, "min_purchases": 10},
            "scale_thresholds": {"min_incremental_tickets_per_100usd": 0.5, "max_cac_vs_baseline_ratio": 0.90},
            "kill_thresholds": {"min_conversion_rate_vs_baseline_ratio": 0.40},
            "guardrails": {"max_refund_rate": 0.05, "max_complaint_rate": 0.03, "max_negative_comment_rate": 0.10},
            "confidence_weights": {"sample_sufficiency": 0.5, "lift_strength": 0.3, "window_consistency": 0.2},
            "budget_caps": {"discovery_max_pct": 0.08, "validation_max_pct": 0.15, "scale_max_pct": 0.35},
        }
        config = PolicyConfig.from_dict(data)
        assert config.min_windows == 3
        assert config.min_clicks == 200
        assert config.max_refund_rate == 0.05
        assert config.discovery_max_pct == 0.08
