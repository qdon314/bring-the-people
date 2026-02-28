"""Tests for the Observations API."""
from uuid import uuid4


def _create_running_experiment(client) -> tuple[str, str]:
    """Helper: create a show + experiment in RUNNING state. Returns (show_id, exp_id)."""
    show_resp = client.post("/api/shows", json={
        "artist_name": "Test Artist",
        "city": "Austin",
        "venue": "The Parish",
        "show_time": "2026-05-01T20:00:00Z",
        "timezone": "America/Chicago",
        "capacity": 200,
        "tickets_total": 200,
        "tickets_sold": 0,
    })
    show_id = show_resp.json()["show_id"]

    exp_resp = client.post("/api/experiments", json={
        "show_id": show_id,
        "cycle_id": str(uuid4()),
        "segment_id": str(uuid4()),
        "frame_id": str(uuid4()),
        "channel": "meta",
        "budget_cap_cents": 5000,
        "baseline_snapshot": {"cac_cents": 800, "conversion_rate": 0.02},
    })
    exp_id = exp_resp.json()["experiment_id"]

    # Move to running
    client.post(f"/api/experiments/{exp_id}/submit")
    client.post(f"/api/experiments/{exp_id}/approve", json={"approved": True, "notes": ""})
    client.post(f"/api/experiments/{exp_id}/start")

    return show_id, exp_id


class TestObservationsAPI:
    def test_add_single_observation(self, client):
        _, exp_id = _create_running_experiment(client)
        resp = client.post("/api/observations", json={
            "experiment_id": exp_id,
            "window_start": "2026-04-01T00:00:00Z",
            "window_end": "2026-04-02T00:00:00Z",
            "spend_cents": 2500,
            "impressions": 10000,
            "clicks": 200,
            "sessions": 180,
            "checkouts": 20,
            "purchases": 8,
            "revenue_cents": 32000,
            "refunds": 0,
            "refund_cents": 0,
            "complaints": 0,
            "negative_comment_rate": 0.01,
            "attribution_model": "last_click_utm",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["purchases"] == 8
        assert "observation_id" in data

    def test_add_bulk_observations(self, client):
        _, exp_id = _create_running_experiment(client)
        obs_list = []
        for day in range(1, 4):
            obs_list.append({
                "experiment_id": exp_id,
                "window_start": f"2026-04-0{day}T00:00:00Z",
                "window_end": f"2026-04-0{day + 1}T00:00:00Z",
                "spend_cents": 1000,
                "impressions": 5000,
                "clicks": 100,
                "sessions": 90,
                "checkouts": 10,
                "purchases": 3,
                "revenue_cents": 12000,
                "refunds": 0,
                "refund_cents": 0,
                "complaints": 0,
                "negative_comment_rate": 0.02,
                "attribution_model": "last_click_utm",
            })
        resp = client.post("/api/observations/bulk", json={
            "observations": obs_list,
        })
        assert resp.status_code == 201
        data = resp.json()
        assert len(data) == 3

    def test_list_observations_for_experiment(self, client):
        _, exp_id = _create_running_experiment(client)
        # Add two observations
        for day in [1, 2]:
            client.post("/api/observations", json={
                "experiment_id": exp_id,
                "window_start": f"2026-04-0{day}T00:00:00Z",
                "window_end": f"2026-04-0{day + 1}T00:00:00Z",
                "spend_cents": 1000,
                "impressions": 5000,
                "clicks": 100,
                "sessions": 90,
                "checkouts": 10,
                "purchases": 3,
                "revenue_cents": 12000,
                "refunds": 0,
                "refund_cents": 0,
                "complaints": 0,
                "attribution_model": "last_click_utm",
            })
        resp = client.get(f"/api/observations?experiment_id={exp_id}")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_add_observation_invalid_window(self, client):
        _, exp_id = _create_running_experiment(client)
        resp = client.post("/api/observations", json={
            "experiment_id": exp_id,
            "window_start": "2026-04-02T00:00:00Z",
            "window_end": "2026-04-01T00:00:00Z",  # end before start
            "spend_cents": 1000,
            "impressions": 0,
            "clicks": 0,
            "sessions": 0,
            "checkouts": 0,
            "purchases": 0,
            "revenue_cents": 0,
            "refunds": 0,
            "refund_cents": 0,
            "complaints": 0,
            "attribution_model": "last_click_utm",
        })
        assert resp.status_code == 422
