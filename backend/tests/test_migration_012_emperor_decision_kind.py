"""Real SQLite verification for migration 012 EmperorDecision.kind."""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

alembic_config = pytest.importorskip("alembic.config")
alembic_command = pytest.importorskip("alembic.command")

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
_ALEMBIC_INI = _BACKEND_ROOT / "alembic.ini"


def _legacy_database(path: Path, actions: list[str]) -> None:
    conn = sqlite3.connect(path)
    try:
        conn.execute(
            "CREATE TABLE emperor_decisions ("
            "id TEXT PRIMARY KEY, task_id TEXT NOT NULL, action TEXT NOT NULL, "
            "reason TEXT, human_confirmed BOOLEAN NOT NULL, "
            "confirmation_record_json TEXT, created_at TEXT NOT NULL)"
        )
        conn.executemany(
            "INSERT INTO emperor_decisions "
            "(id, task_id, action, human_confirmed, created_at) VALUES (?, ?, ?, 1, 'now')",
            [(f"d{index}", f"t{index}", action) for index, action in enumerate(actions)],
        )
        conn.commit()
    finally:
        conn.close()


def _upgrade(path: Path, monkeypatch) -> None:
    monkeypatch.setenv("DB_URL", f"sqlite:///{path}")
    monkeypatch.chdir(_BACKEND_ROOT)
    cfg = alembic_config.Config(str(_ALEMBIC_INI))
    alembic_command.stamp(cfg, "011_archive_outcome_events")
    alembic_command.upgrade(cfg, "012_emperor_decision_kind")


def test_migration_012_backfills_every_known_action_and_enforces_non_null(tmp_path, monkeypatch):
    path = tmp_path / "known.db"
    actions = [
        "confirm_direct_task",
        "confirm_edict",
        "compat_court_dispatch",
        "adopt",
        "approve",
        "archive",
        "reject",
        "request_evidence",
        "recheck",
        "followup",
    ]
    _legacy_database(path, actions)
    _upgrade(path, monkeypatch)

    conn = sqlite3.connect(path)
    try:
        columns = {row[1]: row for row in conn.execute("PRAGMA table_info(emperor_decisions)")}
        assert columns["kind"][3] == 1
        rows = dict(conn.execute("SELECT action, kind FROM emperor_decisions"))
        assert rows["confirm_direct_task"] == "edict_confirm"
        assert rows["confirm_edict"] == "edict_confirm"
        assert rows["compat_court_dispatch"] == "compat_dispatch"
        assert set(rows.values()) == {"edict_confirm", "compat_dispatch", "final_verdict"}
        null_count = conn.execute(
            "SELECT COUNT(*) FROM emperor_decisions WHERE kind IS NULL"
        ).fetchone()[0]
        assert null_count == 0
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute(
                "INSERT INTO emperor_decisions "
                "(id, task_id, action, kind, human_confirmed, created_at) "
                "VALUES ('bad', 't', 'approve', 'invented', 1, 'now')"
            )
    finally:
        conn.close()


def test_migration_012_fails_closed_for_unknown_historical_action(tmp_path, monkeypatch):
    path = tmp_path / "unknown.db"
    _legacy_database(path, ["approve", "invented_action"])
    with pytest.raises(Exception, match="unknown EmperorDecision action"):
        _upgrade(path, monkeypatch)


def test_migration_012_downgrade_removes_kind(tmp_path, monkeypatch):
    path = tmp_path / "downgrade.db"
    _legacy_database(path, ["approve"])
    _upgrade(path, monkeypatch)
    cfg = alembic_config.Config(str(_ALEMBIC_INI))
    alembic_command.downgrade(cfg, "011_archive_outcome_events")
    conn = sqlite3.connect(path)
    try:
        columns = {row[1] for row in conn.execute("PRAGMA table_info(emperor_decisions)")}
        assert "kind" not in columns
    finally:
        conn.close()
