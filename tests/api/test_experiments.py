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


class TestExperimentsAPI:
    def test_create_experiment(self, client):
        show_id = _create_show(client)
        resp = client.post("/api/experiments", json={
            "show_id": show_id,
            "segment_id": str(uuid4()),
            "frame_id": str(uuid4()),
            "channel": "meta",
            "objective": "ticket_sales",
            "budget_cap_cents": 5000,
            "baseline_snapshot": {"cac_cents": 800},
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "draft"
        assert data["channel"] == "meta"

    def test_get_experiment(self, client):
        show_id = _create_show(client)
        create_resp = client.post("/api/experiments", json={
            "show_id": show_id,
            "segment_id": str(uuid4()),
            "frame_id": str(uuid4()),
            "channel": "meta",
            "budget_cap_cents": 5000,
        })
        exp_id = create_resp.json()["experiment_id"]

        resp = client.get(f"/api/experiments/{exp_id}")
        assert resp.status_code == 200
        assert resp.json()["experiment_id"] == exp_id

    def test_list_experiments_by_show(self, client):
        show_id = _create_show(client)
        for _ in range(3):
            client.post("/api/experiments", json={
                "show_id": show_id,
                "segment_id": str(uuid4()),
                "frame_id": str(uuid4()),
                "channel": "meta",
                "budget_cap_cents": 5000,
            })
        resp = client.get(f"/api/experiments?show_id={show_id}")
        assert resp.status_code == 200
        assert len(resp.json()) == 3

    def test_submit_for_approval(self, client):
        show_id = _create_show(client)
        create_resp = client.post("/api/experiments", json={
            "show_id": show_id,
            "segment_id": str(uuid4()),
            "frame_id": str(uuid4()),
            "channel": "meta",
            "budget_cap_cents": 5000,
        })
        exp_id = create_resp.json()["experiment_id"]

        resp = client.post(f"/api/experiments/{exp_id}/submit")
        assert resp.status_code == 200
        assert resp.json()["status"] == "awaiting_approval"

    def test_approve_experiment(self, client):
        show_id = _create_show(client)
        create_resp = client.post("/api/experiments", json={
            "show_id": show_id,
            "segment_id": str(uuid4()),
            "frame_id": str(uuid4()),
            "channel": "meta",
            "budget_cap_cents": 5000,
        })
        exp_id = create_resp.json()["experiment_id"]

        # Submit for approval
        client.post(f"/api/experiments/{exp_id}/submit")

        # Approve
        resp = client.post(f"/api/experiments/{exp_id}/approve", json={
            "approved": True,
            "notes": "Looks good",
        })
        assert resp.status_code == 200
        assert resp.json()["status"] == "approved"

    def test_reject_experiment(self, client):
        show_id = _create_show(client)
        create_resp = client.post("/api/experiments", json={
            "show_id": show_id,
            "segment_id": str(uuid4()),
            "frame_id": str(uuid4()),
            "channel": "meta",
            "budget_cap_cents": 5000,
        })
        exp_id = create_resp.json()["experiment_id"]

        client.post(f"/api/experiments/{exp_id}/submit")

        resp = client.post(f"/api/experiments/{exp_id}/approve", json={
            "approved": False,
            "notes": "Budget too high",
        })
        assert resp.status_code == 200
        assert resp.json()["status"] == "draft"

    def test_approve_without_submit_fails(self, client):
        show_id = _create_show(client)
        create_resp = client.post("/api/experiments", json={
            "show_id": show_id,
            "segment_id": str(uuid4()),
            "frame_id": str(uuid4()),
            "channel": "meta",
            "budget_cap_cents": 5000,
        })
        exp_id = create_resp.json()["experiment_id"]

        resp = client.post(f"/api/experiments/{exp_id}/approve", json={
            "approved": True,
            "notes": "",
        })
        assert resp.status_code == 409  # Conflict — wrong state

    def test_start_approved_experiment(self, client):
        show_id = _create_show(client)
        create_resp = client.post("/api/experiments", json={
            "show_id": show_id,
            "segment_id": str(uuid4()),
            "frame_id": str(uuid4()),
            "channel": "meta",
            "budget_cap_cents": 5000,
        })
        exp_id = create_resp.json()["experiment_id"]

        client.post(f"/api/experiments/{exp_id}/submit")
        client.post(f"/api/experiments/{exp_id}/approve", json={
            "approved": True, "notes": "",
        })

        resp = client.post(f"/api/experiments/{exp_id}/start")
        assert resp.status_code == 200
        assert resp.json()["status"] == "running"
