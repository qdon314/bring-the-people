"""Tests for the Runs API."""
from uuid import uuid4


def _setup(client) -> tuple[str, str, str]:
    """Create show, cycle, experiment. Returns (show_id, cycle_id, experiment_id)."""
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

    cycle_resp = client.post(f"/api/shows/{show_id}/cycles", json={})
    cycle_id = cycle_resp.json()["cycle_id"]

    exp_resp = client.post("/api/experiments", json={
        "show_id": show_id,
        "origin_cycle_id": cycle_id,
        "segment_id": str(uuid4()),
        "frame_id": str(uuid4()),
        "channel": "meta",
        "budget_cap_cents": 5000,
        "baseline_snapshot": {"cac_cents": 800, "conversion_rate": 0.02},
    })
    exp_id = exp_resp.json()["experiment_id"]
    return show_id, cycle_id, exp_id


class TestRunsAPI:
    def test_create_run(self, client):
        _, cycle_id, exp_id = _setup(client)
        resp = client.post("/api/runs", json={
            "experiment_id": exp_id,
            "cycle_id": cycle_id,
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "draft"
        assert data["experiment_id"] == exp_id
        assert data["cycle_id"] == cycle_id
        assert "run_id" in data

    def test_list_runs_by_cycle(self, client):
        _, cycle_id, exp_id = _setup(client)
        client.post("/api/runs", json={"experiment_id": exp_id, "cycle_id": cycle_id})
        client.post("/api/runs", json={"experiment_id": exp_id, "cycle_id": cycle_id})
        resp = client.get(f"/api/runs?cycle_id={cycle_id}")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_list_runs_requires_param(self, client):
        resp = client.get("/api/runs")
        assert resp.status_code == 400

    def test_get_run(self, client):
        _, cycle_id, exp_id = _setup(client)
        run_resp = client.post("/api/runs", json={"experiment_id": exp_id, "cycle_id": cycle_id})
        run_id = run_resp.json()["run_id"]
        resp = client.get(f"/api/runs/{run_id}")
        assert resp.status_code == 200
        assert resp.json()["run_id"] == run_id

    def test_launch_run(self, client):
        _, cycle_id, exp_id = _setup(client)
        run_resp = client.post("/api/runs", json={"experiment_id": exp_id, "cycle_id": cycle_id})
        run_id = run_resp.json()["run_id"]
        resp = client.post(f"/api/runs/{run_id}/launch")
        assert resp.status_code == 200
        assert resp.json()["status"] == "active"
        assert resp.json()["start_time"] is not None

    def test_request_reapproval(self, client):
        _, cycle_id, exp_id = _setup(client)
        run_resp = client.post("/api/runs", json={"experiment_id": exp_id, "cycle_id": cycle_id})
        run_id = run_resp.json()["run_id"]
        resp = client.post(f"/api/runs/{run_id}/request-reapproval")
        assert resp.status_code == 200
        assert resp.json()["status"] == "awaiting_approval"

    def test_get_run_metrics(self, client):
        _, cycle_id, exp_id = _setup(client)
        run_resp = client.post("/api/runs", json={"experiment_id": exp_id, "cycle_id": cycle_id})
        run_id = run_resp.json()["run_id"]
        client.post(f"/api/runs/{run_id}/launch")
        client.post("/api/observations", json={
            "run_id": run_id,
            "window_start": "2026-04-01T00:00:00Z",
            "window_end": "2026-04-02T00:00:00Z",
            "spend_cents": 2500,
            "impressions": 10000,
            "clicks": 200,
            "sessions": 180,
            "checkouts": 20,
            "purchases": 8,
            "revenue_cents": 32000,
            "refunds": 0, "refund_cents": 0, "complaints": 0,
            "attribution_model": "last_click_utm",
        })
        resp = client.get(f"/api/runs/{run_id}/metrics")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_spend_cents"] == 2500
        assert data["run_id"] == run_id

    def test_old_experiment_launch_returns_410(self, client):
        _, _, exp_id = _setup(client)
        resp = client.post(f"/api/experiments/{exp_id}/launch")
        assert resp.status_code == 410

    def test_old_experiment_request_reapproval_returns_410(self, client):
        _, _, exp_id = _setup(client)
        resp = client.post(f"/api/experiments/{exp_id}/request-reapproval")
        assert resp.status_code == 410

    def test_observations_use_run_id(self, client):
        _, cycle_id, exp_id = _setup(client)
        run_resp = client.post("/api/runs", json={"experiment_id": exp_id, "cycle_id": cycle_id})
        run_id = run_resp.json()["run_id"]
        resp = client.post("/api/observations", json={
            "run_id": run_id,
            "window_start": "2026-04-01T00:00:00Z",
            "window_end": "2026-04-02T00:00:00Z",
            "spend_cents": 1000,
            "impressions": 5000,
            "clicks": 100,
            "sessions": 90,
            "checkouts": 10,
            "purchases": 3,
            "revenue_cents": 12000,
            "refunds": 0, "refund_cents": 0, "complaints": 0,
            "attribution_model": "last_click_utm",
        })
        assert resp.status_code == 201
        assert resp.json()["run_id"] == run_id
