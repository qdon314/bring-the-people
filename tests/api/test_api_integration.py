"""End-to-end API integration test for the full experiment lifecycle."""
from uuid import uuid4


class TestFullAPILifecycle:
    def test_show_to_decision_lifecycle(self, client):
        """Full lifecycle: show -> cycle -> experiment -> run -> launch -> observe -> decide."""
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

        # 2. Create cycle
        cycle_resp = client.post(f"/api/shows/{show_id}/cycles", json={})
        assert cycle_resp.status_code == 201
        cycle_id = cycle_resp.json()["cycle_id"]

        # 3. Create experiment
        exp_resp = client.post("/api/experiments", json={
            "show_id": show_id,
            "origin_cycle_id": cycle_id,
            "segment_id": str(uuid4()),
            "frame_id": str(uuid4()),
            "channel": "meta",
            "objective": "ticket_sales",
            "budget_cap_cents": 5000,
            "baseline_snapshot": {"cac_cents": 800, "conversion_rate": 0.02},
        })
        assert exp_resp.status_code == 201
        exp_id = exp_resp.json()["experiment_id"]

        # 4. Create a run
        run_resp = client.post("/api/runs", json={
            "experiment_id": exp_id,
            "cycle_id": cycle_id,
        })
        assert run_resp.status_code == 201
        run_id = run_resp.json()["run_id"]
        assert run_resp.json()["status"] == "draft"

        # 5. Launch the run (draft -> active)
        launch_resp = client.post(f"/api/runs/{run_id}/launch")
        assert launch_resp.status_code == 200
        assert launch_resp.json()["status"] == "active"

        # 6. Add observations (two windows)
        for day in [1, 2]:
            obs_resp = client.post("/api/observations", json={
                "run_id": run_id,
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
        obs_list_resp = client.get(f"/api/observations?run_id={run_id}")
        assert len(obs_list_resp.json()) == 2

        # 7. Evaluate (creates a decision)
        decision_resp = client.post(f"/api/decisions/evaluate/{run_id}")
        assert decision_resp.status_code == 200
        decision = decision_resp.json()
        assert decision["action"] in ["scale", "hold", "kill"]
        assert decision["run_id"] == run_id

        # 8. Verify decision persisted
        decisions_resp = client.get(f"/api/decisions?run_id={run_id}")
        assert len(decisions_resp.json()) == 1

        # 9. Verify show still accessible
        show_get_resp = client.get(f"/api/shows/{show_id}")
        assert show_get_resp.status_code == 200
