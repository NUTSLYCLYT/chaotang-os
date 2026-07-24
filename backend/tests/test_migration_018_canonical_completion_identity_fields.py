"""Real SQLite verification for migration 018 canonical completion identity fields."""

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


def test_fresh_chain_creates_identity_columns_at_revision_018(
    tmp_path: Path,
    monkeypatch,
) -> None:
    path = tmp_path / "fresh.db"
    cfg = _config(path, monkeypatch)
    alembic_command.upgrade(cfg, "018_canonical_completion_identity_fields")
    conn = sqlite3.connect(path)
    try:
        assert (
            conn.execute("SELECT version_num FROM alembic_version").fetchone()[0]
            == "018_canonical_completion_identity_fields"
        )
        task_cols = {row[1] for row in conn.execute("PRAGMA table_info(decision_tasks)")}
        assert "request_id" in task_cols
        event_cols = {row[1] for row in conn.execute("PRAGMA table_info(decree_execution_events)")}
        assert {"request_id", "release_id", "model_version"} <= event_cols
    finally:
        conn.close()


def test_downgrade_drops_identity_columns(tmp_path: Path, monkeypatch) -> None:
    path = tmp_path / "downgrade.db"
    cfg = _config(path, monkeypatch)
    alembic_command.upgrade(cfg, "018_canonical_completion_identity_fields")
    alembic_command.downgrade(cfg, "017_secure_ingest_tables")
    conn = sqlite3.connect(path)
    try:
        task_cols = {row[1] for row in conn.execute("PRAGMA table_info(decision_tasks)")}
        assert "request_id" not in task_cols
        event_cols = {row[1] for row in conn.execute("PRAGMA table_info(decree_execution_events)")}
        assert not ({"request_id", "release_id", "model_version"} & event_cols)
        assert (
            conn.execute("SELECT version_num FROM alembic_version").fetchone()[0]
            == "017_secure_ingest_tables"
        )
    finally:
        conn.close()
