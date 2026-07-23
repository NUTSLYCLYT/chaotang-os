"""Real SQLite verification for migration 019 outbox rework generation identity."""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

alembic_command = pytest.importorskip("alembic.command")
alembic_config = pytest.importorskip("alembic.config")

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
_ALEMBIC_INI = _BACKEND_ROOT / "alembic.ini"


def _config(path: Path, monkeypatch):
    monkeypatch.setenv("DB_URL", f"sqlite:///{path}")
    monkeypatch.chdir(_BACKEND_ROOT)
    return alembic_config.Config(str(_ALEMBIC_INI))


def test_upgrade_adds_generation_identity_without_losing_existing_outbox(
    tmp_path: Path,
    monkeypatch,
) -> None:
    path = tmp_path / "upgrade.db"
    cfg = _config(path, monkeypatch)
    alembic_command.upgrade(cfg, "018_canonical_completion_identity_fields")

    conn = sqlite3.connect(path)
    try:
        conn.execute(
            """
            INSERT INTO outbox_events (
                id, tenant_id, task_id, decision_id, event_type, status,
                attempts, max_attempts, payload_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "outbox-existing",
                1,
                "task-existing",
                "decision-existing",
                "route.council",
                "completed",
                1,
                3,
                "{}",
                "2026-07-23T00:00:00+00:00",
                "2026-07-23T00:00:01+00:00",
            ),
        )
        conn.commit()
    finally:
        conn.close()

    alembic_command.upgrade(cfg, "head")

    conn = sqlite3.connect(path)
    try:
        assert (
            conn.execute("SELECT version_num FROM alembic_version").fetchone()[0]
            == "019_outbox_rework_generation"
        )
        columns = {row[1] for row in conn.execute("PRAGMA table_info(outbox_events)")}
        assert {"generation", "idempotency_key"} <= columns
        assert conn.execute(
            "SELECT id, generation, idempotency_key FROM outbox_events"
        ).fetchall() == [("outbox-existing", None, None)]
        insert_sql = """
            INSERT INTO outbox_events (
                id, tenant_id, task_id, decision_id, event_type, generation,
                idempotency_key, status, attempts, max_attempts, payload_json,
                created_at, updated_at
            ) VALUES (?, 1, 'task-rework', 'decision-rework', 'evidence.rework',
                      ?, ?, 'awaiting_evidence', 0, 3, '{}', '', '')
        """
        conn.execute(insert_sql, ("outbox-generation-2", 2, "request-a"))
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute(insert_sql, ("outbox-generation-2-duplicate", 2, "request-b"))
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute(insert_sql, ("outbox-request-a-duplicate", 3, "request-a"))
    finally:
        conn.close()


def test_downgrade_removes_generation_identity(tmp_path: Path, monkeypatch) -> None:
    path = tmp_path / "downgrade.db"
    cfg = _config(path, monkeypatch)
    alembic_command.upgrade(cfg, "head")
    alembic_command.downgrade(cfg, "018_canonical_completion_identity_fields")

    conn = sqlite3.connect(path)
    try:
        columns = {row[1] for row in conn.execute("PRAGMA table_info(outbox_events)")}
        assert "generation" not in columns
        assert "idempotency_key" not in columns
        assert (
            conn.execute("SELECT version_num FROM alembic_version").fetchone()[0]
            == "018_canonical_completion_identity_fields"
        )
    finally:
        conn.close()
