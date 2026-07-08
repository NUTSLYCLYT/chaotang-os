from __future__ import annotations

from src.production_events import recent_events
from src.step_log import RunLog, save_run_meta
from web import task_registry


def test_mark_done_records_run_index_drift_for_missing_run(tmp_path, monkeypatch):
    monkeypatch.setenv("FENGQUN_PRODUCTION_EVENTS", str(tmp_path / "events.jsonl"))
    monkeypatch.setattr(task_registry, "_task_registry", {})

    task_registry.register_task("task_missing", monitor=True)
    task_registry.mark_status("task_missing", "done", run_id="missing_run")

    task = task_registry.get_task("task_missing")
    assert task is not None
    assert task["status"] == "done"
    assert task["run_index_status"] == "missing"
    assert task["run_index_error"] == "load_run_missing"

    events = recent_events(path=tmp_path / "events.jsonl")
    assert events[-1]["event_type"] == "run_index_drift_detected"
    assert events[-1]["task_id"] == "task_missing"
    assert events[-1]["run_id"] == "missing_run"
    assert events[-1]["gate_status"] == "degraded"


def test_mark_done_missing_task_does_not_record_run_index_drift(tmp_path, monkeypatch):
    monkeypatch.setenv("FENGQUN_PRODUCTION_EVENTS", str(tmp_path / "events.jsonl"))
    monkeypatch.setattr(task_registry, "_task_registry", {})

    task_registry.mark_status("unknown_task", "done", run_id="missing_run")

    assert task_registry.get_task("unknown_task") is None
    assert not recent_events(path=tmp_path / "events.jsonl")


def test_mark_done_can_skip_run_index_for_non_run_artifacts(tmp_path, monkeypatch):
    monkeypatch.setenv("FENGQUN_PRODUCTION_EVENTS", str(tmp_path / "events.jsonl"))
    monkeypatch.setattr(task_registry, "_task_registry", {})

    task_registry.register_task("task_slot", monitor=True)
    task_registry.mark_status(
        "task_slot",
        "done",
        run_id="slot_abc123",
        run_index_required=False,
    )

    task = task_registry.get_task("task_slot")
    assert task is not None
    assert task["status"] == "done"
    assert task["run_id"] == "slot_abc123"
    assert task["run_index_status"] == "not_applicable"
    assert not recent_events(path=tmp_path / "events.jsonl")


def test_mark_done_records_canonical_run_id_for_queryable_prefix(tmp_path, monkeypatch):
    monkeypatch.setenv("FENGQUN_PRODUCTION_EVENTS", str(tmp_path / "events.jsonl"))
    monkeypatch.setattr(task_registry, "_task_registry", {})
    monkeypatch.setattr("src.tenant.DATA_ROOT", tmp_path / "data")
    monkeypatch.setattr("src.step_log._LEGACY_RUNS_DIR", tmp_path / "legacy_runs")
    monkeypatch.setattr("src.step_log.RUNS_DIR", tmp_path / "legacy_runs")

    save_run_meta(RunLog("20260609_003027_499455", "任务", "AI Ops"))

    task_registry.register_task("task_ok", monitor=True)
    task_registry.mark_status("task_ok", "done", run_id="20260609_003027")

    task = task_registry.get_task("task_ok")
    assert task is not None
    assert task["run_index_status"] == "ok"
    assert task["canonical_run_id"] == "20260609_003027_499455"
    assert not recent_events(path=tmp_path / "events.jsonl")
