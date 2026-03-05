"""Tests for the Shows API."""
from uuid import uuid4

class TestShowsAPI:
    def test_create_show(self, client):
        resp = client.post("/api/shows", json={
            "artist_name": "Test Artist",
            "city": "Austin",
            "venue": "The Parish",
            "show_time": "2026-05-01T20:00:00Z",
            "timezone": "America/Chicago",
            "capacity": 200,
            "tickets_total": 200,
            "tickets_sold": 0,
            "ticket_base_url": "https://tickets.example.com/show/test",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["artist_name"] == "Test Artist"
        assert "show_id" in data
        assert data["ticket_base_url"] == "https://tickets.example.com/show/test"

    def test_get_show(self, client):
        # Create first
        create_resp = client.post("/api/shows", json={
            "artist_name": "Test Artist",
            "city": "Austin",
            "venue": "The Parish",
            "show_time": "2026-05-01T20:00:00Z",
            "timezone": "America/Chicago",
            "capacity": 200,
            "tickets_total": 200,
            "tickets_sold": 0,
        })
        show_id = create_resp.json()["show_id"]

        # Get
        resp = client.get(f"/api/shows/{show_id}")
        assert resp.status_code == 200
        assert resp.json()["show_id"] == show_id

    def test_get_show_not_found(self, client):
        import uuid
        resp = client.get(f"/api/shows/{uuid.uuid4()}")
        assert resp.status_code == 404

    def test_list_shows(self, client):
        # Create two shows
        for name in ["Artist A", "Artist B"]:
            client.post("/api/shows", json={
                "artist_name": name,
                "city": "Austin",
                "venue": "The Parish",
                "show_time": "2026-05-01T20:00:00Z",
                "timezone": "America/Chicago",
                "capacity": 200,
                "tickets_total": 200,
                "tickets_sold": 0,
            })
        resp = client.get("/api/shows")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_update_show(self, client):
        create_resp = client.post("/api/shows", json={
            "artist_name": "Test Artist",
            "city": "Austin",
            "venue": "The Parish",
            "show_time": "2026-05-01T20:00:00Z",
            "timezone": "America/Chicago",
            "capacity": 200,
            "tickets_total": 200,
            "tickets_sold": 0,
        })
        show_id = create_resp.json()["show_id"]

        resp = client.patch(f"/api/shows/{show_id}", json={
            "tickets_sold": 50,
        })
        assert resp.status_code == 200
        assert resp.json()["tickets_sold"] == 50

    def test_delete_show(self, client):
        create_resp = client.post("/api/shows", json={
            "artist_name": "Delete Me",
            "city": "Austin",
            "venue": "The Parish",
            "show_time": "2026-05-01T20:00:00Z",
            "timezone": "America/Chicago",
            "capacity": 200,
            "tickets_total": 200,
            "tickets_sold": 0,
        })
        show_id = create_resp.json()["show_id"]

        delete_resp = client.delete(f"/api/shows/{show_id}")
        assert delete_resp.status_code == 204

        get_resp = client.get(f"/api/shows/{show_id}")
        assert get_resp.status_code == 404

    def test_delete_show_removes_related_experiments(self, client):
        create_resp = client.post("/api/shows", json={
            "artist_name": "Delete With Children",
            "city": "Austin",
            "venue": "The Parish",
            "show_time": "2026-05-01T20:00:00Z",
            "timezone": "America/Chicago",
            "capacity": 200,
            "tickets_total": 200,
            "tickets_sold": 0,
        })
        show_id = create_resp.json()["show_id"]

        cycle_resp = client.post(f"/api/shows/{show_id}/cycles", json={})
        cycle_id = cycle_resp.json()["cycle_id"]

        exp_resp = client.post("/api/experiments", json={
            "show_id": show_id,
            "origin_cycle_id": cycle_id,
            "segment_id": str(uuid4()),
            "frame_id": str(uuid4()),
            "channel": "meta",
            "budget_cap_cents": 5000,
        })
        assert exp_resp.status_code == 201
        experiment_id = exp_resp.json()["experiment_id"]

        delete_resp = client.delete(f"/api/shows/{show_id}")
        assert delete_resp.status_code == 204

        get_experiment_resp = client.get(f"/api/experiments/{experiment_id}")
        assert get_experiment_resp.status_code == 404

    def test_delete_show_not_found(self, client):
        import uuid

        resp = client.delete(f"/api/shows/{uuid.uuid4()}")
        assert resp.status_code == 404

    def test_create_show_invalid_capacity(self, client):
        resp = client.post("/api/shows", json={
            "artist_name": "Test",
            "city": "Austin",
            "venue": "The Parish",
            "show_time": "2026-05-01T20:00:00Z",
            "timezone": "America/Chicago",
            "capacity": -1,
            "tickets_total": 200,
            "tickets_sold": 0,
        })
        assert resp.status_code == 422


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
