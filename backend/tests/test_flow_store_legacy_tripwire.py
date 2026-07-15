"""P2: legacy flow writers are explicit, observable, and fail closed."""

from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from src.db import flow_store
from src.db.models import Base, Task


_RETIRED_PRODUCTION_WRITERS = {
    "chaotang-router-p3-pending": "flow_store.upsert_persisted_task",
    "chaotang-orchestrator-p3-pending": "flow_store.update_task_status",
    "chaotang-store-p3-pending": "chaotang_store.save_review",
    "flow-store-backfill": "flow_store.upsert_memorial",
}


def _metric_value(exported: str, series: str) -> float:
    prefix = f"{series} "
    for line in exported.splitlines():
        if line.startswith(prefix):
            return float(line.removeprefix(prefix))
    return 0.0


@pytest.fixture()
def session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        yield db
    engine.dispose()


def test_missing_writer_id_fails_before_mutation(session):
    with pytest.raises(RuntimeError, match="unregistered legacy writer"):
        flow_store.upsert_persisted_task(
            session=session,
            task_id="blocked-missing",
            raw_command="blocked",
            status="running",
        )

    assert session.query(Task).filter_by(task_id="blocked-missing").first() is None


def test_unknown_writer_id_fails_before_mutation(session):
    with pytest.raises(RuntimeError, match="unregistered legacy writer"):
        flow_store.upsert_persisted_task(
            session=session,
            task_id="blocked-unknown",
            raw_command="blocked",
            status="running",
            legacy_writer_id="made-up-writer",
        )

    assert session.query(Task).filter_by(task_id="blocked-unknown").first() is None


def test_registered_test_writer_can_use_declared_operation(session):
    flow_store.upsert_persisted_task(
        session=session,
        task_id="allowed-test",
        raw_command="allowed",
        status="running",
        legacy_writer_id="pytest-flow-store",
    )

    assert session.query(Task).filter_by(task_id="allowed-test").one().status == "running"


def test_runtime_allowlist_contains_only_test_writers():
    from src.legacy_write_tripwire import _LEGACY_WRITER_ALLOWLIST

    assert set(_LEGACY_WRITER_ALLOWLIST) == {
        "pytest-flow-store",
        "pytest-chaotang-store",
    }


@pytest.mark.parametrize("writer_id,operation", _RETIRED_PRODUCTION_WRITERS.items())
def test_retired_production_writer_ids_fail_closed(writer_id, operation):
    from src.legacy_write_tripwire import require_legacy_write

    with pytest.raises(RuntimeError, match="unregistered legacy writer"):
        require_legacy_write(operation, writer_id)


def test_global_rollback_switch_bypasses_tripwire(monkeypatch, session):
    monkeypatch.setenv("FENGQUN_LEGACY_WRITE_TRIPWIRE", "0")

    flow_store.upsert_persisted_task(
        session=session,
        task_id="rollback-path",
        raw_command="rollback",
        status="running",
        legacy_writer_id="unregistered-during-rollback",
    )

    assert session.query(Task).filter_by(task_id="rollback-path").one().status == "running"


def test_migration_metrics_expose_zero_and_nonzero_series():
    from src.legacy_write_tripwire import require_legacy_write
    from web.routers.metrics import prometheus_metrics

    initial = prometheus_metrics().body.decode()
    assert 'canonical_chain_events_total{stage="final_memorial_promoted",status="completed"}' in initial

    with pytest.raises(RuntimeError):
        require_legacy_write("flow_store.save_decree_and_task", "metric-unknown")

    after = prometheus_metrics().body.decode()
    assert (
        'legacy_writer_calls_total{caller_id="metric-unknown",'
        'operation="flow_store.save_decree_and_task",outcome="blocked_unregistered"} 1.0' in after
    )


def test_chaotang_json_writer_is_also_fail_closed(monkeypatch, tmp_path):
    from src import chaotang_store

    monkeypatch.setattr(chaotang_store, "_DATA_ROOT", tmp_path)
    with pytest.raises(RuntimeError, match="unregistered legacy writer"):
        chaotang_store.save_review(
            "blocked-json",
            action="approve",
            comment="must not write",
            reviewer="test",
        )

    assert list(tmp_path.rglob("*.json")) == []


def test_direct_review_json_copy_writer_is_fail_closed(monkeypatch, tmp_path):
    from src import chaotang_store

    monkeypatch.setattr(chaotang_store, "_DATA_ROOT", tmp_path)
    with pytest.raises(RuntimeError, match="unregistered legacy writer"):
        chaotang_store.write_review_files(
            {
                "id": "direct-copy",
                "memorialId": "blocked-copy",
                "action": "approve",
                "createdAt": "2026-07-15T00:00:00+00:00",
            }
        )

    assert list(tmp_path.rglob("*.json")) == []


def test_direct_review_json_copy_is_observed_as_write(monkeypatch, tmp_path):
    from src import chaotang_store
    from src.observability import metrics_exporter

    series = (
        'legacy_endpoint_calls_total{caller_id="pytest-chaotang-store",'
        'endpoint="chaotang_store.write_review_files",operation="write"}'
    )
    before = _metric_value(metrics_exporter.export(), series)
    monkeypatch.setattr(chaotang_store, "_DATA_ROOT", tmp_path)
    chaotang_store.write_review_files(
        {
            "id": "allowed-copy",
            "memorialId": "observed-copy",
            "action": "approve",
            "createdAt": "2026-07-15T00:00:00+00:00",
        },
        legacy_writer_id="pytest-chaotang-store",
    )

    after = _metric_value(metrics_exporter.export(), series)
    assert after == before + 1
