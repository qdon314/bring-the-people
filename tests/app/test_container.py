"""Tests for the dependency injection container."""
import pytest

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


class TestContainer:
    def test_provides_session_container(self, container):
        sc = container.session_container()
        assert sc is not None
        sc.close()

    def test_provides_show_repo(self, container):
        sc = container.session_container()
        repo = sc.show_repo()
        assert repo is not None
        sc.close()

    def test_provides_experiment_repo(self, container):
        sc = container.session_container()
        repo = sc.experiment_repo()
        assert repo is not None
        sc.close()

    def test_provides_segment_repo(self, container):
        sc = container.session_container()
        repo = sc.segment_repo()
        assert repo is not None
        sc.close()

    def test_provides_frame_repo(self, container):
        sc = container.session_container()
        repo = sc.frame_repo()
        assert repo is not None
        sc.close()

    def test_provides_event_log(self, container):
        log = container.event_log()
        assert log is not None

    def test_provides_policy_config(self, container):
        config = container.policy_config()
        assert config is not None
        assert config.min_windows == 2

    def test_provides_decision_service(self, container):
        sc = container.session_container()
        svc = sc.decision_service()
        assert svc is not None
        sc.close()

    def test_provides_strategy_service(self, container):
        sc = container.session_container()
        svc = sc.strategy_service()
        assert svc is not None
        sc.close()
