"""Real SQLite verification for migration 017 secure_ingest tables."""

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


def test_fresh_chain_creates_secure_ingest_tables_at_head(tmp_path: Path, monkeypatch) -> None:
    path = tmp_path / "fresh.db"
    cfg = _config(path, monkeypatch)
    alembic_command.upgrade(cfg, "head")
    conn = sqlite3.connect(path)
    try:
        tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        assert {
            "secure_ingest_artifacts",
            "secure_ingest_download_tickets",
            "secure_ingest_audit_events",
        } <= tables
        assert (
            conn.execute("SELECT version_num FROM alembic_version").fetchone()[0]
            == "017_secure_ingest_tables"
        )
        artifact_cols = {row[1] for row in conn.execute("PRAGMA table_info(secure_ingest_artifacts)")}
        assert {
            "tenant_id",
            "mission_contract_id",
            "digest_sha256",
            "status",
            "ocr_status",
            "macro_detected",
            "zip_bomb_suspected",
        } <= artifact_cols
        ticket_cols = {row[1] for row in conn.execute("PRAGMA table_info(secure_ingest_download_tickets)")}
        assert {"token_hash", "tenant_id", "artifact_id", "purpose", "expires_at", "redeemed_at"} <= ticket_cols
        audit_cols = {row[1] for row in conn.execute("PRAGMA table_info(secure_ingest_audit_events)")}
        assert {
            "tenant_id",
            "event_type",
            "task_id",
            "artifact_id",
            "input_digest",
            "provider_id",
            "model_id",
            "policy_version",
        } <= audit_cols
    finally:
        conn.close()


def test_downgrade_drops_secure_ingest_tables(tmp_path: Path, monkeypatch) -> None:
    path = tmp_path / "downgrade.db"
    cfg = _config(path, monkeypatch)
    alembic_command.upgrade(cfg, "head")
    alembic_command.downgrade(cfg, "016_schema_literal_contract_guard")
    conn = sqlite3.connect(path)
    try:
        tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        assert "secure_ingest_artifacts" not in tables
        assert "secure_ingest_download_tickets" not in tables
        assert "secure_ingest_audit_events" not in tables
        assert (
            conn.execute("SELECT version_num FROM alembic_version").fetchone()[0]
            == "016_schema_literal_contract_guard"
        )
    finally:
        conn.close()
