"""tests/test_migration_008_build_ledger_ownership.py

alembic 008 给 build_ledger_entries/build_ledger_audit_events 补
tenant_id/user_id 归属列(P0-A:这两张表原来完全没有归属列，是 IDOR/broken
access control)。跟 007 不同，这里只是普通 ADD COLUMN(不是约束)，
SQLite/PostgreSQL 都不需要 batch 模式——但仍然值得对真实 SQLite 跑一次
真实 upgrade/downgrade，验证旧行会被数据库自动回填成默认值
(tenant_id=1, user_id='anonymous')，而不是留空/报错。

需要真实安装的 alembic，见 test_migration_007_...py 同款说明。
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

alembic_config = pytest.importorskip("alembic.config")
alembic_command = pytest.importorskip("alembic.command")

import sqlalchemy as sa  # noqa: E402
from sqlalchemy import Column, Index, MetaData, Table, Text, create_engine  # noqa: E402

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
_ALEMBIC_INI = _BACKEND_ROOT / "alembic.ini"


def _build_legacy_pre_008_schema(engine) -> None:
    """008 之前(当前已提交状态)的 schema：没有 tenant_id/user_id。"""
    metadata = MetaData()
    Table(
        "build_ledger_entries", metadata,
        Column("id", Text, primary_key=True),
        Column("task_id", Text, nullable=False),
        Column("status", Text, nullable=False, default="dispatched"),
        Column("entry_json", Text, nullable=False),
        Column("created_at", Text, nullable=False),
        Column("updated_at", Text, nullable=False),
        Index("ix_build_ledger_entries_task", "task_id"),
        Index("ix_build_ledger_entries_created", "created_at"),
    )
    Table(
        "build_ledger_audit_events", metadata,
        Column("id", Text, primary_key=True),
        Column("task_id", Text, nullable=False),
        Column("actor", Text, nullable=False),
        Column("action", Text, nullable=False),
        Column("from_status", Text, nullable=False),
        Column("to_status", Text, nullable=False),
        Column("note", Text, nullable=False, default=""),
        Column("created_at", Text, nullable=False),
        Index("ix_build_ledger_audit_task", "task_id"),
    )
    metadata.create_all(engine)


def _seed_legacy_rows(engine) -> None:
    with engine.begin() as conn:
        conn.execute(sa.text(
            "INSERT INTO build_ledger_entries "
            "(id, task_id, status, entry_json, created_at, updated_at) "
            "VALUES ('e1', 't1', 'dispatched', '{}', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')"
        ))
        conn.execute(sa.text(
            "INSERT INTO build_ledger_audit_events "
            "(id, task_id, actor, action, from_status, to_status, note, created_at) "
            "VALUES ('a1', 't1', 'ops', 'x', 'dispatched', 'reviewing', '', '2026-01-01T00:00:00Z')"
        ))


def _run_migration(db_path: Path, monkeypatch, revision: str) -> None:
    monkeypatch.setenv("DB_URL", f"sqlite:///{db_path}")
    monkeypatch.chdir(_BACKEND_ROOT)
    cfg = alembic_config.Config(str(_ALEMBIC_INI))
    alembic_command.stamp(cfg, "007_jinyiwei_evidence_unique_constraint")
    alembic_command.upgrade(cfg, revision)


def test_migration_008_backfills_ownership_columns_on_sqlite(tmp_path, monkeypatch):
    db_path = tmp_path / "repro_008.db"
    engine = create_engine(f"sqlite:///{db_path}")
    _build_legacy_pre_008_schema(engine)
    _seed_legacy_rows(engine)
    engine.dispose()

    _run_migration(db_path, monkeypatch, "008_build_ledger_ownership")

    conn = sqlite3.connect(str(db_path))
    try:
        entry_row = conn.execute(
            "SELECT id, tenant_id, user_id FROM build_ledger_entries"
        ).fetchone()
        assert entry_row == ("e1", 1, "anonymous"), (
            "旧行应该被数据库 DEFAULT 自动回填成 tenant_id=1, user_id='anonymous'，"
            "不是留空或报错"
        )
        audit_row = conn.execute(
            "SELECT id, tenant_id, user_id FROM build_ledger_audit_events"
        ).fetchone()
        assert audit_row == ("a1", 1, "anonymous")

        index_names = {
            row[0]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='index' "
                "AND tbl_name IN ('build_ledger_entries', 'build_ledger_audit_events')"
            )
        }
        assert "ix_build_ledger_entries_tenant_user" in index_names
        assert "ix_build_ledger_audit_tenant_user" in index_names

        # 新行不显式传 tenant_id/user_id 时也应该落到默认值,而不是 NULL 报错
        conn.execute(
            "INSERT INTO build_ledger_entries "
            "(id, task_id, status, entry_json, created_at, updated_at) "
            "VALUES ('e2', 't2', 'dispatched', '{}', '2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z')"
        )
        conn.commit()
        new_row = conn.execute(
            "SELECT tenant_id, user_id FROM build_ledger_entries WHERE id='e2'"
        ).fetchone()
        assert new_row == (1, "anonymous")
    finally:
        conn.close()


def test_migration_008_downgrade_removes_ownership_columns_on_sqlite(tmp_path, monkeypatch):
    db_path = tmp_path / "repro_008_downgrade.db"
    engine = create_engine(f"sqlite:///{db_path}")
    _build_legacy_pre_008_schema(engine)
    _seed_legacy_rows(engine)
    engine.dispose()

    _run_migration(db_path, monkeypatch, "008_build_ledger_ownership")

    monkeypatch.setenv("DB_URL", f"sqlite:///{db_path}")
    cfg = alembic_config.Config(str(_ALEMBIC_INI))
    alembic_command.downgrade(cfg, "-1")

    conn = sqlite3.connect(str(db_path))
    try:
        table_sql = conn.execute(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='build_ledger_entries'"
        ).fetchone()[0]
        assert "tenant_id" not in table_sql
        assert "user_id" not in table_sql
    finally:
        conn.close()
