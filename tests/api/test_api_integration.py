"""End-to-end API integration test for the full experiment lifecycle."""
from uuid import uuid4


class TestFullAPILifecycle:
    def test_show_to_decision_lifecycle(self, client):
        """Full lifecycle: show → experiment → approve → observe → decide."""
        # 1. Create show
        show_resp = client.post("/api/shows", json={
            "artist_name": "Integration Test Artist",
            "city": "Austin",
            "venue": "The Parish",
            "show_time": "2026-05-01T20:00:00Z",
            "timezone": "America/Chicago",
            "capacity": 200,
            "tickets_total": 200,
            "tickets_sold": 0,
        })
        assert show_resp.status_code == 201
        show_id = show_resp.json()["show_id"]

        # 2. Create experiment
        exp_resp = client.post("/api/experiments", json={
            "show_id": show_id,
            "segment_id": str(uuid4()),
            "frame_id": str(uuid4()),
            "channel": "meta",
            "objective": "ticket_sales",
            "budget_cap_cents": 5000,
            "baseline_snapshot": {"cac_cents": 800, "conversion_rate": 0.02},
        })
        assert exp_resp.status_code == 201
        exp_id = exp_resp.json()["experiment_id"]
        assert exp_resp.json()["status"] == "draft"

        # 3. Submit for approval
        submit_resp = client.post(f"/api/experiments/{exp_id}/submit")
        assert submit_resp.status_code == 200
        assert submit_resp.json()["status"] == "awaiting_approval"

        # 4. Approve
        approve_resp = client.post(f"/api/experiments/{exp_id}/approve", json={
            "approved": True,
            "notes": "Approved for testing",
        })
        assert approve_resp.status_code == 200
        assert approve_resp.json()["status"] == "approved"

        # 5. Start
        start_resp = client.post(f"/api/experiments/{exp_id}/start")
        assert start_resp.status_code == 200
        assert start_resp.json()["status"] == "running"

        # 6. Add observations (two windows)
        for day in [1, 2]:
            obs_resp = client.post("/api/observations", json={
                "experiment_id": exp_id,
                "window_start": f"2026-04-0{day}T00:00:00Z",
                "window_end": f"2026-04-0{day + 1}T00:00:00Z",
                "spend_cents": 1500,
                "impressions": 6000,
                "clicks": 120,
                "sessions": 100,
                "checkouts": 12,
                "purchases": 5,
                "revenue_cents": 20000,
                "refunds": 0,
                "refund_cents": 0,
                "complaints": 0,
                "negative_comment_rate": 0.01,
                "attribution_model": "last_click_utm",
            })
            assert obs_resp.status_code == 201

        # Verify observations stored
        obs_list_resp = client.get(f"/api/observations?experiment_id={exp_id}")
        assert len(obs_list_resp.json()) == 2

        # 7. Evaluate
        decision_resp = client.post(f"/api/decisions/evaluate/{exp_id}")
        assert decision_resp.status_code == 200
        decision = decision_resp.json()
        assert decision["action"] in ["scale", "hold", "kill"]
        assert decision["experiment_id"] == exp_id

        # 8. Verify decision persisted
        decisions_resp = client.get(f"/api/decisions?experiment_id={exp_id}")
        assert len(decisions_resp.json()) == 1

        # 9. Verify show still accessible
        show_get_resp = client.get(f"/api/shows/{show_id}")
        assert show_get_resp.status_code == 200
