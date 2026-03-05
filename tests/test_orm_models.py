"""Tests for updated ORM models after entity refactor."""
from sqlalchemy import inspect
from growth.adapters.orm import (
    ExperimentORM,
    ExperimentRunORM,
    ObservationORM,
    DecisionORM,
)


def test_experiment_orm_has_origin_cycle_id_not_cycle_id():
    cols = {c.key for c in inspect(ExperimentORM).mapper.columns}
    assert "origin_cycle_id" in cols
    assert "cycle_id" not in cols
    assert "status" not in cols
    assert "start_time" not in cols
    assert "end_time" not in cols


def test_experiment_run_orm_exists_with_correct_columns():
    cols = {c.key for c in inspect(ExperimentRunORM).mapper.columns}
    assert "run_id" in cols
    assert "experiment_id" in cols
    assert "cycle_id" in cols
    assert "status" in cols
    assert "start_time" in cols
    assert "end_time" in cols


def test_observation_orm_fk_is_run_id():
    cols = {c.key for c in inspect(ObservationORM).mapper.columns}
    assert "run_id" in cols
    assert "experiment_id" not in cols


def test_decision_orm_fk_is_run_id():
    cols = {c.key for c in inspect(DecisionORM).mapper.columns}
    assert "run_id" in cols
    assert "experiment_id" not in cols


def test_experiment_run_orm_table_name():
    assert ExperimentRunORM.__tablename__ == "experiment_runs"
