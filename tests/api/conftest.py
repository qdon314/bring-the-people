"""Shared fixtures for API tests."""
import pytest
from fastapi.testclient import TestClient

from growth.app.api.app import create_app
from growth.app.container import Container


@pytest.fixture
def container(tmp_path):
    db_path = tmp_path / "test.db"
    log_path = tmp_path / "events.jsonl"
    config_path = "config/policy.toml"
    c = Container(
        db_url=f"sqlite:///{db_path}",
        event_log_path=log_path,
        policy_config_path=config_path,
    )
    yield c


@pytest.fixture
def client(container):
    app = create_app(container)
    return TestClient(app)
