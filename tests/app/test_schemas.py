"""Tests for Pydantic API schemas."""
from datetime import datetime, timezone
from uuid import uuid4

import pytest
from pydantic import ValidationError

from growth.app.schemas import (
    ShowCreate,
    ShowResponse,
    ObservationCreate,
    ApprovalRequest,
)


class TestShowSchemas:
    def test_show_create_valid(self):
        data = ShowCreate(
            artist_name="Test Artist",
            city="Austin",
            venue="The Parish",
            show_time=datetime(2026, 5, 1, 20, 0, tzinfo=timezone.utc),
            timezone="America/Chicago",
            capacity=200,
            tickets_total=200,
            tickets_sold=0,
        )
        assert data.artist_name == "Test Artist"

    def test_show_create_rejects_negative_capacity(self):
        with pytest.raises(ValidationError):
            ShowCreate(
                artist_name="Test",
                city="Austin",
                venue="The Parish",
                show_time=datetime(2026, 5, 1, 20, 0, tzinfo=timezone.utc),
                timezone="America/Chicago",
                capacity=-1,
                tickets_total=200,
                tickets_sold=0,
            )

    def test_show_response_from_domain(self):
        from growth.domain.models import Show
        show = Show(
            show_id=uuid4(),
            artist_name="Test",
            city="Austin",
            venue="The Parish",
            show_time=datetime(2026, 5, 1, 20, 0, tzinfo=timezone.utc),
            timezone="America/Chicago",
            capacity=200,
            tickets_total=200,
            tickets_sold=50,
        )
        resp = ShowResponse.from_domain(show)
        assert resp.show_id == show.show_id
        assert resp.tickets_sold == 50


class TestObservationSchemas:
    def test_observation_create_valid(self):
        data = ObservationCreate(
            experiment_id=uuid4(),
            window_start=datetime(2026, 4, 1, 0, 0, tzinfo=timezone.utc),
            window_end=datetime(2026, 4, 2, 0, 0, tzinfo=timezone.utc),
            spend_cents=2500,
            impressions=10000,
            clicks=200,
            sessions=180,
            checkouts=20,
            purchases=8,
            revenue_cents=32000,
            refunds=0,
            refund_cents=0,
            complaints=0,
            negative_comment_rate=0.01,
            attribution_model="last_click_utm",
        )
        assert data.purchases == 8

    def test_observation_rejects_negative_spend(self):
        with pytest.raises(ValidationError):
            ObservationCreate(
                experiment_id=uuid4(),
                window_start=datetime(2026, 4, 1, 0, 0, tzinfo=timezone.utc),
                window_end=datetime(2026, 4, 2, 0, 0, tzinfo=timezone.utc),
                spend_cents=-100,
                impressions=0,
                clicks=0,
                sessions=0,
                checkouts=0,
                purchases=0,
                revenue_cents=0,
                refunds=0,
                refund_cents=0,
                complaints=0,
                negative_comment_rate=0.0,
                attribution_model="last_click_utm",
            )

    def test_observation_rejects_window_end_before_start(self):
        with pytest.raises(ValidationError):
            ObservationCreate(
                experiment_id=uuid4(),
                window_start=datetime(2026, 4, 2, 0, 0, tzinfo=timezone.utc),
                window_end=datetime(2026, 4, 1, 0, 0, tzinfo=timezone.utc),
                spend_cents=100,
                impressions=0,
                clicks=0,
                sessions=0,
                checkouts=0,
                purchases=0,
                revenue_cents=0,
                refunds=0,
                refund_cents=0,
                complaints=0,
                negative_comment_rate=0.0,
                attribution_model="last_click_utm",
            )


class TestApprovalSchema:
    def test_approval_request_valid(self):
        req = ApprovalRequest(
            approved=True,
            notes="Looks good, proceed.",
        )
        assert req.approved is True

    def test_approval_request_rejection(self):
        req = ApprovalRequest(
            approved=False,
            notes="Budget too high for this segment.",
        )
        assert req.approved is False
