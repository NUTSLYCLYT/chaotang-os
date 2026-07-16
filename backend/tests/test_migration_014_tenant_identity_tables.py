"""Real SQLite verification for migrations 014/015 tenant identity adoption."""

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


def test_fresh_chain_creates_identity_tables_at_head(tmp_path: Path, monkeypatch) -> None:
    path = tmp_path / "fresh.db"
    cfg = _config(path, monkeypatch)
    alembic_command.upgrade(cfg, "head")
    conn = sqlite3.connect(path)
    try:
        tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        assert {"tenants", "users", "invites"} <= tables
        assert conn.execute("SELECT version_num FROM alembic_version").fetchone()[0] == "015_schema_contract_guard"
    finally:
        conn.close()

def test_existing_identity_rows_survive_upgrade_and_safe_downgrade(tmp_path: Path, monkeypatch) -> None:
    path = tmp_path / "existing.db"
    cfg = _config(path, monkeypatch)
    alembic_command.upgrade(cfg, "013_core_tenant_lineage")
    conn = sqlite3.connect(path)
    try:
        conn.execute("CREATE TABLE tenants (id INTEGER PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT (datetime('now')))")
        conn.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, email TEXT DEFAULT '', password_hash TEXT NOT NULL, tenant_id INTEGER NOT NULL, role TEXT NOT NULL DEFAULT 'user', display_name TEXT DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY(tenant_id) REFERENCES tenants(id))")
        conn.execute("CREATE TABLE invites (id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, max_uses INTEGER NOT NULL DEFAULT 1, used_count INTEGER NOT NULL DEFAULT 0, expires_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))")
        conn.execute("INSERT INTO tenants VALUES (7, 'Legacy', 'legacy', 'now')")
        conn.commit()
    finally:
        conn.close()

    alembic_command.upgrade(cfg, "head")
    alembic_command.downgrade(cfg, "014_tenant_identity_tables")
    conn = sqlite3.connect(path)
    try:
        assert conn.execute("SELECT id, slug FROM tenants").fetchone() == (7, "legacy")
        assert conn.execute("SELECT version_num FROM alembic_version").fetchone()[0] == "014_tenant_identity_tables"
    finally:
        conn.close()

    alembic_command.downgrade(cfg, "013_core_tenant_lineage")
    conn = sqlite3.connect(path)
    try:
        assert conn.execute("SELECT id, slug FROM tenants").fetchone() == (7, "legacy")
        assert conn.execute("SELECT version_num FROM alembic_version").fetchone()[0] == "013_core_tenant_lineage"
    finally:
        conn.close()


def test_015_blocks_a_previously_stamped_malformed_users_table_without_identity_ddl(
    tmp_path: Path,
    monkeypatch,
) -> None:
    path = tmp_path / "malformed-users.db"
    cfg = _config(path, monkeypatch)
    alembic_command.upgrade(cfg, "013_core_tenant_lineage")
    conn = sqlite3.connect(path)
    try:
        conn.execute(
            "CREATE TABLE users (id INTEGER, username TEXT NOT NULL, email TEXT DEFAULT '', "
            "password_hash TEXT NOT NULL, tenant_id INTEGER NOT NULL, "
            "role TEXT NOT NULL DEFAULT 'user', display_name TEXT DEFAULT '', "
            "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
        )
        conn.commit()
    finally:
        conn.close()

    alembic_command.stamp(cfg, "014_tenant_identity_tables")

    with pytest.raises(Exception, match="incompatible tenant identity tables"):
        alembic_command.upgrade(cfg, "head")

    conn = sqlite3.connect(path)
    try:
        assert conn.execute("SELECT version_num FROM alembic_version").fetchone()[0] == "014_tenant_identity_tables"
        tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        assert "tenants" not in tables
        assert "invites" not in tables
    finally:
        conn.close()


def test_015_blocks_a_previously_stamped_wrong_identity_default(tmp_path: Path, monkeypatch) -> None:
    path = tmp_path / "wrong-default.db"
    cfg = _config(path, monkeypatch)
    alembic_command.upgrade(cfg, "013_core_tenant_lineage")
    conn = sqlite3.connect(path)
    try:
        conn.execute(
            "CREATE TABLE invites (id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, "
            "max_uses INTEGER NOT NULL DEFAULT 99, used_count INTEGER NOT NULL DEFAULT 0, "
            "expires_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
        )
        conn.commit()
    finally:
        conn.close()

    alembic_command.stamp(cfg, "014_tenant_identity_tables")

    with pytest.raises(Exception, match="invites.max_uses"):
        alembic_command.upgrade(cfg, "head")

    conn = sqlite3.connect(path)
    try:
        assert conn.execute("SELECT version_num FROM alembic_version").fetchone()[0] == "014_tenant_identity_tables"
    finally:
        conn.close()


def test_015_blocks_a_previously_stamped_users_table_without_tenant_foreign_key(
    tmp_path: Path,
    monkeypatch,
) -> None:
    path = tmp_path / "missing-identity-fk.db"
    cfg = _config(path, monkeypatch)
    alembic_command.upgrade(cfg, "013_core_tenant_lineage")
    conn = sqlite3.connect(path)
    try:
        conn.execute(
            "CREATE TABLE tenants (id INTEGER PRIMARY KEY, name TEXT NOT NULL, "
            "slug TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
        )
        conn.execute(
            "CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, "
            "email TEXT DEFAULT '', password_hash TEXT NOT NULL, tenant_id INTEGER NOT NULL, "
            "role TEXT NOT NULL DEFAULT 'user', display_name TEXT DEFAULT '', "
            "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
        )
        conn.execute(
            "CREATE TABLE invites (id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, "
            "max_uses INTEGER NOT NULL DEFAULT 1, used_count INTEGER NOT NULL DEFAULT 0, "
            "expires_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
        )
        conn.commit()
    finally:
        conn.close()

    alembic_command.stamp(cfg, "014_tenant_identity_tables")

    with pytest.raises(Exception, match="users foreign keys mismatch"):
        alembic_command.upgrade(cfg, "head")

    conn = sqlite3.connect(path)
    try:
        assert conn.execute("SELECT version_num FROM alembic_version").fetchone()[0] == "014_tenant_identity_tables"
    finally:
        conn.close()
