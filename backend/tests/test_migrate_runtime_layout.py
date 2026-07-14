from __future__ import annotations

from pathlib import Path

import pytest

from scripts import migrate_runtime_layout as migration
from src.runtime_paths import RuntimePaths


def _paths(root: Path) -> RuntimePaths:
    data = root / "data"
    return RuntimePaths(
        root=root,
        data=data,
        events=root / "events",
        memory=root / "memory",
        chat_sessions=root / "sessions",
        swarm_sessions=root / "swarm_sessions",
        traces=root / "traces",
        direct_cache=root / "direct_cache",
        direct_feedback=root / "direct_feedback",
        runs=data / "default" / "runs",
        repairs=root / "repairs",
        drafts=root / "drafts",
        reports=root / "reports",
        cases=root / "cases",
        ab_tests=root / "ab_tests",
        database=data / "fengqun.db",
    )


def test_build_plan_ignores_empty_legacy_shells(monkeypatch, tmp_path):
    backend = tmp_path / "backend"
    (backend / "events" / "empty").mkdir(parents=True)
    monkeypatch.setattr(migration, "BACKEND_ROOT", backend)
    monkeypatch.setattr(migration, "resolve_runtime_paths", lambda: _paths(backend / "var"))

    assert migration.build_plan() == []


def test_apply_refuses_existing_destination_without_moving_source(tmp_path):
    source = tmp_path / "backend" / "data"
    destination = tmp_path / "backend" / "var" / "data"
    source.mkdir(parents=True)
    destination.mkdir(parents=True)
    (source / "fengqun.db").write_bytes(b"old")
    (destination / "fengqun.db").write_bytes(b"new")

    with pytest.raises(SystemExit, match="Refusing to merge competing runtime trees"):
        migration.apply_plan([(source, destination)])

    assert (source / "fengqun.db").read_bytes() == b"old"
    assert (destination / "fengqun.db").read_bytes() == b"new"


def test_apply_refuses_nested_competing_runs_before_any_move(tmp_path):
    old_data = tmp_path / "backend" / "data"
    old_runs = tmp_path / "backend" / "runs"
    new_data = tmp_path / "backend" / "var" / "data"
    new_runs = new_data / "default" / "runs"
    (old_data / "default" / "runs").mkdir(parents=True)
    (old_data / "default" / "runs" / "from-data.json").write_text("data")
    old_runs.mkdir(parents=True)
    (old_runs / "from-runs.json").write_text("runs")

    with pytest.raises(SystemExit, match="Refusing to merge competing runtime trees"):
        migration.apply_plan([(old_data, new_data), (old_runs, new_runs)])

    assert old_data.exists()
    assert old_runs.exists()
    assert not new_data.exists()
