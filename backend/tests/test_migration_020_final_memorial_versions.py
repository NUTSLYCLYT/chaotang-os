"""Real SQLite verification for append-only FinalMemorial version lineage."""

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


def test_upgrade_preserves_v1_and_enforces_one_current_version(
    tmp_path: Path,
    monkeypatch,
) -> None:
    path = tmp_path / "upgrade.db"
    cfg = _config(path, monkeypatch)
    alembic_command.upgrade(cfg, "019_outbox_rework_generation")

    conn = sqlite3.connect(path)
    try:
        conn.execute(
            """
            INSERT INTO final_memorials (
                id, tenant_id, task_id, review_id, swarm_run_id,
                quality_result_id, status, source_label, memorial_json,
                content_hash, created_at
            ) VALUES (
                'formal-v1', 1, 'task-versioned', 'review-v1', 'run-v1',
                'quality-v1', 'ready_for_decision', 'LIVE_SWARM', '{}',
                'hash-v1', '2026-07-24T00:00:00+00:00'
            )
            """
        )
        conn.commit()
    finally:
        conn.close()

    alembic_command.upgrade(cfg, "020_final_memorial_versions")

    conn = sqlite3.connect(path)
    try:
        assert conn.execute("SELECT version_num FROM alembic_version").fetchone()[0] == (
            "020_final_memorial_versions"
        )
        columns = {row[1] for row in conn.execute("PRAGMA table_info(final_memorials)")}
        assert {"version", "supersedes_id", "is_current"} <= columns
        assert conn.execute(
            """
            SELECT id, version, supersedes_id, is_current
            FROM final_memorials
            """
        ).fetchall() == [("formal-v1", 1, None, 1)]

        insert_sql = """
            INSERT INTO final_memorials (
                id, tenant_id, task_id, review_id, swarm_run_id,
                quality_result_id, status, source_label, memorial_json,
                content_hash, created_at, version, supersedes_id, is_current
            ) VALUES (?, 1, 'task-versioned', ?, ?, ?, 'ready_for_decision',
                      'LIVE_SWARM', '{}', ?, '', ?, ?, ?)
        """
        conn.execute(
            "UPDATE final_memorials SET status='superseded', is_current=0 WHERE id='formal-v1'"
        )
        conn.execute(
            insert_sql,
            (
                "formal-v2",
                "review-v2",
                "run-v2",
                "quality-v2",
                "hash-v2",
                2,
                "formal-v1",
                1,
            ),
        )
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute(
                insert_sql,
                (
                    "formal-v2-duplicate",
                    "review-v2b",
                    "run-v2b",
                    "quality-v2b",
                    "hash-v2b",
                    2,
                    "formal-v1",
                    0,
                ),
            )
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute(
                insert_sql,
                (
                    "formal-v3-current-duplicate",
                    "review-v3",
                    "run-v3",
                    "quality-v3",
                    "hash-v3",
                    3,
                    "formal-v2",
                    1,
                ),
            )
    finally:
        conn.close()
