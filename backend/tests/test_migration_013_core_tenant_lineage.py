"""Real temporary-SQLite verification for migration 013 core tenant lineage."""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

alembic_config = pytest.importorskip("alembic.config")
alembic_command = pytest.importorskip("alembic.command")

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
_ALEMBIC_INI = _BACKEND_ROOT / "alembic.ini"
_REVISION = "013_core_tenant_lineage"
_TABLES = (
    "decision_tasks",
    "chancellor_route_decisions",
    "outbox_events",
    "decree_execution_events",
    "court_reviews",
    "final_memorials",
    "emperor_decisions",
    "shiguan_archives",
)


def _legacy_database(
    path: Path,
    *,
    omit: str | None = None,
    tenant_definitions: dict[str, str] | None = None,
) -> None:
    tenant_definitions = tenant_definitions or {}
    conn = sqlite3.connect(path)
    try:
        for table in _TABLES:
            if table == omit:
                continue
            identity = "decision_id" if table == "chancellor_route_decisions" else "id"
            tenant_sql = tenant_definitions.get(table)
            extra = f", tenant_id {tenant_sql}" if tenant_sql else ""
            conn.execute(f"CREATE TABLE {table} ({identity} TEXT PRIMARY KEY{extra})")
            columns = identity + (", tenant_id" if tenant_sql else "")
            values = "?" + (", ?" if tenant_sql else "")
            tenant_value = 9 if tenant_sql and "NOT NULL" in tenant_sql else None
            params = [f"row_{table}"] + ([tenant_value] if tenant_sql else [])
            conn.execute(
                f"INSERT INTO {table} ({columns}) VALUES ({values})",
                params,
            )
        conn.commit()
    finally:
        conn.close()


def _config(path: Path, monkeypatch):
    monkeypatch.setenv("DB_URL", f"sqlite:///{path}")
    monkeypatch.chdir(_BACKEND_ROOT)
    return alembic_config.Config(str(_ALEMBIC_INI))


def _upgrade_from_012(path: Path, monkeypatch) -> None:
    cfg = _config(path, monkeypatch)
    alembic_command.stamp(cfg, "012_emperor_decision_kind")
    alembic_command.upgrade(cfg, _REVISION)


def _column(path: Path, table: str, name: str) -> tuple | None:
    conn = sqlite3.connect(path)
    try:
        return next(
            (row for row in conn.execute(f"PRAGMA table_info({table})") if row[1] == name),
            None,
        )
    finally:
        conn.close()


def test_migration_013_adds_nullable_default_free_columns_and_preserves_null_history(tmp_path, monkeypatch):
    path = tmp_path / "legacy-012.db"
    _legacy_database(path)
    _upgrade_from_012(path, monkeypatch)

    conn = sqlite3.connect(path)
    try:
        for table in _TABLES:
            column = next(row for row in conn.execute(f"PRAGMA table_info({table})") if row[1] == "tenant_id")
            assert column[3] == 0, table
            assert column[4] is None, table
            assert conn.execute(f"SELECT tenant_id FROM {table}").fetchone()[0] is None
    finally:
        conn.close()


def test_migration_013_accepts_an_existing_compliant_nullable_column(tmp_path, monkeypatch):
    path = tmp_path / "preexisting-nullable.db"
    _legacy_database(path, tenant_definitions={"decision_tasks": "INTEGER"})
    _upgrade_from_012(path, monkeypatch)
    assert _column(path, "decision_tasks", "tenant_id")[3:5] == (0, None)


@pytest.mark.parametrize("definition", ["INTEGER NOT NULL", "INTEGER DEFAULT 1", "TEXT"])
def test_migration_013_blocks_preexisting_constraints_that_mask_unknown_ownership(tmp_path, monkeypatch, definition):
    path = tmp_path / f"invalid-{definition.replace(' ', '-')}.db"
    _legacy_database(path, tenant_definitions={"decision_tasks": definition})
    with pytest.raises(Exception, match="incompatible tenant_id"):
        _upgrade_from_012(path, monkeypatch)


def test_migration_013_preflights_all_columns_before_any_ddl(tmp_path, monkeypatch):
    path = tmp_path / "late-invalid-column.db"
    _legacy_database(path, tenant_definitions={"final_memorials": "INTEGER NOT NULL"})

    with pytest.raises(Exception, match="incompatible tenant_id"):
        _upgrade_from_012(path, monkeypatch)

    assert _column(path, "decision_tasks", "tenant_id") is None


def test_migration_013_fails_closed_when_a_core_table_is_missing(tmp_path, monkeypatch):
    path = tmp_path / "missing-core-table.db"
    _legacy_database(path, omit="final_memorials")
    with pytest.raises(Exception, match="missing core tables.*final_memorials"):
        _upgrade_from_012(path, monkeypatch)


def test_migration_013_temporary_downgrade_removes_only_its_columns(tmp_path, monkeypatch):
    path = tmp_path / "downgrade.db"
    _legacy_database(path)
    _upgrade_from_012(path, monkeypatch)
    cfg = _config(path, monkeypatch)
    alembic_command.downgrade(cfg, "012_emperor_decision_kind")
    assert all(_column(path, table, "tenant_id") is None for table in _TABLES)


def test_fresh_migration_chain_reaches_head_with_all_013_columns(tmp_path, monkeypatch):
    path = tmp_path / "fresh.db"
    cfg = _config(path, monkeypatch)
    alembic_command.upgrade(cfg, "head")

    conn = sqlite3.connect(path)
    try:
        assert (
            conn.execute("SELECT version_num FROM alembic_version").fetchone()[0]
            == "022_shiguan_memorial_identity"
        )
        for table in _TABLES:
            column = _column(path, table, "tenant_id")
            assert column is not None, table
            assert column[3:5] == (0, None), table
    finally:
        conn.close()
