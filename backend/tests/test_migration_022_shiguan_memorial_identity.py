"""Real SQLite verification for exact FinalMemorial identity in ShiguanArchive."""

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


def test_upgrade_preserves_old_archive_with_nullable_memorial_identity(
    tmp_path: Path,
    monkeypatch,
) -> None:
    path = tmp_path / "shiguan-identity.db"
    cfg = _config(path, monkeypatch)
    alembic_command.upgrade(cfg, "021_decision_task_contract_scope")

    conn = sqlite3.connect(path)
    try:
        conn.execute(
            """
            INSERT INTO shiguan_archives (
                id, tenant_id, task_id, raw_question, refined_edict,
                final_memorial_json, emperor_decision_json,
                evidence_chain_json, source_label, synthetic_flag, created_at
            ) VALUES (
                'archive-existing', 1, 'task-existing', '原问', '拟旨',
                '{}', '{}', '[]', 'LIVE', 0,
                '2026-07-24T00:00:00+00:00'
            )
            """
        )
        conn.commit()
    finally:
        conn.close()

    alembic_command.upgrade(cfg, "head")

    conn = sqlite3.connect(path)
    try:
        assert conn.execute("SELECT version_num FROM alembic_version").fetchone()[0] == (
            "025_artifact_delivery_state"
        )
        columns = {row[1] for row in conn.execute("PRAGMA table_info(shiguan_archives)")}
        assert {
            "final_memorial_id",
            "final_memorial_version",
            "final_memorial_content_hash",
        } <= columns
        assert conn.execute(
            """
            SELECT final_memorial_id, final_memorial_version,
                   final_memorial_content_hash
            FROM shiguan_archives
            WHERE id='archive-existing'
            """
        ).fetchone() == (None, None, None)
    finally:
        conn.close()
