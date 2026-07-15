"""Real SQLite verification for the 011 archive outcome ledger migration."""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

alembic_config = pytest.importorskip("alembic.config")
alembic_command = pytest.importorskip("alembic.command")

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
_ALEMBIC_INI = _BACKEND_ROOT / "alembic.ini"


def _upgrade_011(db_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("DB_URL", f"sqlite:///{db_path}")
    monkeypatch.chdir(_BACKEND_ROOT)
    cfg = alembic_config.Config(str(_ALEMBIC_INI))
    alembic_command.stamp(cfg, "010_final_memorial_quality_gate")
    alembic_command.upgrade(cfg, "011_archive_outcome_events")


def test_migration_011_builds_ledger_constraints_and_indexes(tmp_path, monkeypatch):
    db_path = tmp_path / "outcomes.db"
    _upgrade_011(db_path, monkeypatch)

    conn = sqlite3.connect(str(db_path))
    try:
        columns = {
            row[1]: (row[2], row[3])
            for row in conn.execute("PRAGMA table_info(archive_outcome_events)")
        }
        assert columns["archive_id"][1] == 0
        assert columns["task_id"][1] == 1
        assert columns["payload_hash"][1] == 1
        index_names = {
            row[1]
            for row in conn.execute("PRAGMA index_list(archive_outcome_events)")
        }
        assert "ix_archive_outcome_events_tenant_archive_recorded" in index_names
        assert "ix_archive_outcome_events_tenant_task_recorded" in index_names
        assert "ix_archive_outcome_events_supersedes" in index_names

        values = (
            "event_1",
            1,
            None,
            "task_1",
            "outcome.recorded",
            "blocked",
            "MIXED",
            "legacy_unverified",
            "2026-07-15T00:00:00Z",
            "2026-07-15T00:00:01Z",
            "史官",
            "same-key",
            "hash",
            "{}",
            0,
        )
        conn.execute(
            "INSERT INTO archive_outcome_events "
            "(id, tenant_id, archive_id, task_id, event_type, actual, source_type, "
            "source_auth_level, occurred_at, recorded_at, recorded_by, idempotency_key, "
            "payload_hash, payload_json, synthetic_flag) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            values,
        )
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute(
                "INSERT INTO archive_outcome_events "
                "(id, tenant_id, task_id, event_type, actual, source_type, "
                "source_auth_level, occurred_at, recorded_at, recorded_by, "
                "idempotency_key, payload_hash, payload_json, synthetic_flag) "
                "VALUES ('event_2', 1, 'task_2', 'outcome.recorded', 'success', "
                "'LIVE', 'authenticated', 'now', 'now', 'ops', 'same-key', "
                "'other-hash', '{}', 0)"
            )
    finally:
        conn.close()


def test_migration_011_downgrade_removes_ledger(tmp_path, monkeypatch):
    db_path = tmp_path / "outcomes-downgrade.db"
    _upgrade_011(db_path, monkeypatch)
    cfg = alembic_config.Config(str(_ALEMBIC_INI))
    alembic_command.downgrade(cfg, "010_final_memorial_quality_gate")

    conn = sqlite3.connect(str(db_path))
    try:
        tables = {
            row[0]
            for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        }
        assert "archive_outcome_events" not in tables
    finally:
        conn.close()
