"""Tests for the Decisions API."""
from uuid import uuid4


def _create_experiment_with_observation(client) -> str:
    """Helper: create show + running experiment + observation. Returns exp_id."""
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

    client.post(f"/api/experiments/{exp_id}/launch")

    # Add observation with strong performance
    client.post("/api/observations", json={
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

    return exp_id


class TestDecisionsAPI:
    def test_evaluate_experiment(self, client):
        exp_id = _create_experiment_with_observation(client)
        resp = client.post(f"/api/decisions/evaluate/{exp_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["action"] in ["scale", "hold", "kill"]
        assert data["experiment_id"] == exp_id
        assert "confidence" in data
        assert "rationale" in data

    def test_evaluate_nonexistent_experiment(self, client):
        resp = client.post(f"/api/decisions/evaluate/{uuid4()}")
        assert resp.status_code == 404

    def test_legacy_evaluate_route_returns_contract_guidance(self, client):
        exp_id = _create_experiment_with_observation(client)

        resp = client.post("/api/decisions/evaluate", json={"experiment_id": exp_id})

        assert resp.status_code == 410
        assert resp.json()["detail"] == "Use /api/decisions/evaluate/{experiment_id}"

    def test_get_decisions_for_experiment(self, client):
        exp_id = _create_experiment_with_observation(client)
        # Evaluate twice
        client.post(f"/api/decisions/evaluate/{exp_id}")
        client.post(f"/api/decisions/evaluate/{exp_id}")

        resp = client.get(f"/api/decisions?experiment_id={exp_id}")
        assert resp.status_code == 200
        assert len(resp.json()) == 2
