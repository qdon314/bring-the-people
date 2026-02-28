"""Tests for the Experiments API."""
from uuid import uuid4


def _create_show(client) -> str:
    resp = client.post("/api/shows", json={
        "artist_name": "Test Artist",
        "city": "Austin",
        "venue": "The Parish",
        "show_time": "2026-05-01T20:00:00Z",
        "timezone": "America/Chicago",
        "capacity": 200,
        "tickets_total": 200,
        "tickets_sold": 0,
    })
    return resp.json()["show_id"]


def _experiment_create_payload(show_id: str, **overrides):
    payload = {
        "show_id": show_id,
        "cycle_id": str(uuid4()),
        "segment_id": str(uuid4()),
        "frame_id": str(uuid4()),
        "channel": "meta",
        "budget_cap_cents": 5000,
    }
    payload.update(overrides)
    return payload


class TestExperimentsAPI:
    def test_create_experiment(self, client):
        show_id = _create_show(client)
        cycle_id = str(uuid4())
        resp = client.post(
            "/api/experiments",
            json=_experiment_create_payload(
                show_id,
                cycle_id=cycle_id,
                objective="ticket_sales",
                baseline_snapshot={"cac_cents": 800},
            ),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "draft"
        assert data["channel"] == "meta"
        assert data["cycle_id"] == cycle_id

    def test_create_experiment_requires_cycle_id(self, client):
        show_id = _create_show(client)
        resp = client.post(
            "/api/experiments",
            json={
                "show_id": show_id,
                "segment_id": str(uuid4()),
                "frame_id": str(uuid4()),
                "channel": "meta",
                "budget_cap_cents": 5000,
            },
        )
        assert resp.status_code == 422

    def test_get_experiment(self, client):
        show_id = _create_show(client)
        create_resp = client.post("/api/experiments", json=_experiment_create_payload(show_id))
        exp_id = create_resp.json()["experiment_id"]

        resp = client.get(f"/api/experiments/{exp_id}")
        assert resp.status_code == 200
        assert resp.json()["experiment_id"] == exp_id

    def test_list_experiments_by_show(self, client):
        show_id = _create_show(client)
        for _ in range(3):
            client.post("/api/experiments", json=_experiment_create_payload(show_id))
        resp = client.get(f"/api/experiments?show_id={show_id}")
        assert resp.status_code == 200
        assert len(resp.json()) == 3

    def test_launch_from_draft(self, client):
        show_id = _create_show(client)
        create_resp = client.post("/api/experiments", json=_experiment_create_payload(show_id))
        exp_id = create_resp.json()["experiment_id"]

        resp = client.post(f"/api/experiments/{exp_id}/launch")
        assert resp.status_code == 200
        assert resp.json()["status"] == "active"
        assert resp.json()["start_time"] is not None

    def test_launch_from_awaiting_approval(self, client):
        """Cross-cycle: awaiting_approval experiments can be re-launched."""
        show_id = _create_show(client)
        create_resp = client.post("/api/experiments", json=_experiment_create_payload(show_id))
        exp_id = create_resp.json()["experiment_id"]

        # Transition to awaiting_approval first
        client.post(f"/api/experiments/{exp_id}/request-reapproval")

        resp = client.post(f"/api/experiments/{exp_id}/launch")
        assert resp.status_code == 200
        assert resp.json()["status"] == "active"

    def test_launch_from_active_fails(self, client):
        show_id = _create_show(client)
        create_resp = client.post("/api/experiments", json=_experiment_create_payload(show_id))
        exp_id = create_resp.json()["experiment_id"]

        client.post(f"/api/experiments/{exp_id}/launch")
        resp = client.post(f"/api/experiments/{exp_id}/launch")
        assert resp.status_code == 409

    def test_request_reapproval_from_draft(self, client):
        show_id = _create_show(client)
        create_resp = client.post("/api/experiments", json=_experiment_create_payload(show_id))
        exp_id = create_resp.json()["experiment_id"]

        resp = client.post(f"/api/experiments/{exp_id}/request-reapproval")
        assert resp.status_code == 200
        assert resp.json()["status"] == "awaiting_approval"

    def test_request_reapproval_from_active_fails(self, client):
        show_id = _create_show(client)
        create_resp = client.post("/api/experiments", json=_experiment_create_payload(show_id))
        exp_id = create_resp.json()["experiment_id"]

        client.post(f"/api/experiments/{exp_id}/launch")
        resp = client.post(f"/api/experiments/{exp_id}/request-reapproval")
        assert resp.status_code == 409
