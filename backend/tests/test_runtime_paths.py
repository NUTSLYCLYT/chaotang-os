from __future__ import annotations

from pathlib import Path

import pytest


def test_runtime_root_defaults_to_backend_var(monkeypatch):
    monkeypatch.delenv("FENGQUN_RUNTIME_ROOT", raising=False)

    from src.runtime_paths import resolve_runtime_paths

    paths = resolve_runtime_paths()

    assert paths.root == Path(__file__).resolve().parents[1] / "var"
    assert paths.data == paths.root / "data"
    assert paths.events == paths.root / "events"
    assert paths.memory == paths.root / "memory"
    assert paths.chat_sessions == paths.root / "sessions"
    assert paths.swarm_sessions == paths.root / "swarm_sessions"
    assert paths.traces == paths.root / "traces"
    assert paths.direct_cache == paths.root / "direct_cache"
    assert paths.direct_feedback == paths.root / "direct_feedback"
    assert paths.runs == paths.data / "default" / "runs"
    assert paths.repairs == paths.root / "repairs"
    assert paths.drafts == paths.root / "drafts"
    assert paths.reports == paths.root / "reports"
    assert paths.cases == paths.root / "cases"
    assert paths.ab_tests == paths.root / "ab_tests"


def test_runtime_root_can_be_overridden(monkeypatch, tmp_path):
    runtime_root = tmp_path / "court-runtime"
    monkeypatch.setenv("FENGQUN_RUNTIME_ROOT", str(runtime_root))

    from src.runtime_paths import resolve_runtime_paths

    paths = resolve_runtime_paths()

    assert paths.root == runtime_root.resolve()
    assert paths.data == runtime_root.resolve() / "data"


def test_explicit_database_configuration_has_priority(monkeypatch, tmp_path):
    runtime_root = tmp_path / "runtime"
    explicit_db = tmp_path / "explicit" / "court.db"
    monkeypatch.setenv("FENGQUN_RUNTIME_ROOT", str(runtime_root))
    monkeypatch.setenv("FENGQUN_DB_PATH", str(explicit_db))

    from src.runtime_paths import resolve_runtime_paths

    paths = resolve_runtime_paths()

    assert paths.database == explicit_db.resolve()


def test_legacy_database_is_not_silently_replaced(monkeypatch, tmp_path):
    import src.runtime_paths as runtime_paths

    backend = tmp_path / "backend"
    legacy = backend / "data" / "fengqun.db"
    legacy.parent.mkdir(parents=True)
    legacy.write_bytes(b"legacy")
    destination = backend / "var" / "data" / "fengqun.db"
    monkeypatch.setattr(runtime_paths, "BACKEND_ROOT", backend)

    with pytest.raises(RuntimeError, match="Legacy runtime database detected"):
        runtime_paths.guard_legacy_database(destination=destination)

    assert not destination.exists()


def test_memory_profile_seed_is_copied_to_writable_runtime(monkeypatch, tmp_path):
    import src.memory_tool as memory_tool

    runtime_persons = tmp_path / "var" / "memory" / "persons"
    seeds = tmp_path / "resources" / "memory_profiles" / "persons"
    seeds.mkdir(parents=True)
    (seeds / "alice.md").write_text("versioned seed", encoding="utf-8")
    monkeypatch.setattr(memory_tool, "PERSONS_DIR", runtime_persons)
    monkeypatch.setattr(memory_tool, "PERSON_SEEDS_DIR", seeds)

    assert memory_tool._read_content("alice") == "versioned seed"
    assert (runtime_persons / "alice.md").read_text(encoding="utf-8") == "versioned seed"
