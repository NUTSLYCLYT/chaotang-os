"""Real SQLite verification for the canonical DecisionTask contract-scope projection."""

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


def test_upgrade_adds_nullable_contract_scope_to_existing_decision_tasks(
    tmp_path: Path,
    monkeypatch,
) -> None:
    path = tmp_path / "contract-scope.db"
    cfg = _config(path, monkeypatch)
    alembic_command.upgrade(cfg, "020_final_memorial_versions")

    conn = sqlite3.connect(path)
    try:
        conn.execute(
            """
            INSERT INTO decision_tasks (
                id, tenant_id, user_id, raw_question, status, source_label,
                risk_flags_json, known_facts_json, unknown_gaps_json,
                recommended_departments_json, created_at, updated_at
            ) VALUES (
                'task-existing', 1, '1', '审查合同', 'awaiting_evidence', 'LIVE',
                '[]', '[]', '[]', '[]',
                '2026-07-24T00:00:00+00:00', '2026-07-24T00:00:00+00:00'
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
            "021_decision_task_contract_scope"
        )
        columns = {row[1] for row in conn.execute("PRAGMA table_info(decision_tasks)")}
        assert "contract_scope_json" in columns
        assert conn.execute(
            "SELECT contract_scope_json FROM decision_tasks WHERE id='task-existing'"
        ).fetchone() == (None,)
    finally:
        conn.close()
