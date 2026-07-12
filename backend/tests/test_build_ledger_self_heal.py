"""tests/test_build_ledger_self_heal.py

`ensure_build_ledger_ownership_columns`(P0-A)的直接单测。

2026-07-12 独立只读审查(P0-A diff 复审)指出:这个函数完全没有直接测试
覆盖——`test_build_ledger_tenant_isolation.py` 全部用 `isolated_session_local`
(表直接从当前 models.py 建,天生就有归属列)，从没真正跑过"检测老库缺列 →
ALTER TABLE 补列"这条分支，也没有针对 PostgreSQL 方言的测试。这片代码区域
(flow_store.py 里同类的 ensure_* 自愈函数)已经连续出过两个 P0
(ensure_jinyiwei_evidence_unique_constraint 的 SAVEPOINT 缺失 + 错误消息
误判分支)，不能靠"看起来安全"就跳过测试——这里补上直接覆盖。
"""
from __future__ import annotations

from unittest.mock import MagicMock

from sqlalchemy import Column, MetaData, Table, Text, create_engine, text
from sqlalchemy.orm import Session

from src.db.flow_store import ensure_build_ledger_ownership_columns


def _build_legacy_sqlite_tables(engine) -> None:
    """P0-A 之前的 schema:两张表都没有 tenant_id/user_id。"""
    metadata = MetaData()
    Table(
        "build_ledger_entries", metadata,
        Column("id", Text, primary_key=True),
        Column("task_id", Text, nullable=False),
        Column("status", Text, nullable=False),
        Column("entry_json", Text, nullable=False),
        Column("created_at", Text, nullable=False),
        Column("updated_at", Text, nullable=False),
    )
    Table(
        "build_ledger_audit_events", metadata,
        Column("id", Text, primary_key=True),
        Column("task_id", Text, nullable=False),
        Column("actor", Text, nullable=False),
        Column("action", Text, nullable=False),
        Column("from_status", Text, nullable=False),
        Column("to_status", Text, nullable=False),
        Column("note", Text, nullable=False),
        Column("created_at", Text, nullable=False),
    )
    metadata.create_all(engine)


def test_ensure_build_ledger_ownership_columns_backfills_legacy_sqlite_table():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    _build_legacy_sqlite_tables(engine)
    with engine.begin() as conn:
        conn.exec_driver_sql(
            "INSERT INTO build_ledger_entries "
            "(id, task_id, status, entry_json, created_at, updated_at) "
            "VALUES ('e1', 't1', 'dispatched', '{}', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')"
        )

    session = Session(engine)
    try:
        ensure_build_ledger_ownership_columns(session)
        session.commit()

        cols = {
            row[1]
            for row in session.execute(text(
                "PRAGMA table_info(build_ledger_entries)"
            )).all()
        }
        assert {"tenant_id", "user_id"} <= cols

        row = session.execute(
            text(
                "SELECT tenant_id, user_id FROM build_ledger_entries WHERE id='e1'"
            )
        ).first()
        assert row == (1, "anonymous"), "老行应该被 DEFAULT 自动回填,不是留空"

        index_names = {
            r[0]
            for r in session.execute(
                text(
                    "SELECT name FROM sqlite_master WHERE type='index' "
                    "AND tbl_name IN ('build_ledger_entries','build_ledger_audit_events')"
                )
            ).all()
        }
        assert "ix_build_ledger_entries_tenant_user" in index_names
        assert "ix_build_ledger_audit_tenant_user" in index_names

        # 幂等:再跑一次不该报错(列/索引都已存在)
        ensure_build_ledger_ownership_columns(session)
        session.commit()
    finally:
        session.close()
        engine.dispose()


def test_ensure_build_ledger_ownership_columns_uses_if_not_exists_on_postgres():
    """非 sqlite dialect 下必须用 ADD COLUMN IF NOT EXISTS——这条语法在
    PostgreSQL 上合法、幂等、不会报错,不像 alembic 007 的 ADD CONSTRAINT
    那样需要 SAVEPOINT 兜底(那是约束特有的限制,不适用于普通加列)。"""
    session = MagicMock()
    session.get_bind.return_value.dialect.name = "postgresql"

    ensure_build_ledger_ownership_columns(session)

    executed_sql = [str(call.args[0]) for call in session.execute.call_args_list]
    assert any(
        "ADD COLUMN IF NOT EXISTS" in sql and "tenant_id" in sql and "build_ledger_entries" in sql
        for sql in executed_sql
    )
    assert any(
        "ADD COLUMN IF NOT EXISTS" in sql and "user_id" in sql and "build_ledger_entries" in sql
        for sql in executed_sql
    )
    assert any(
        "ADD COLUMN IF NOT EXISTS" in sql and "tenant_id" in sql and "build_ledger_audit_events" in sql
        for sql in executed_sql
    )
    assert any("CREATE INDEX IF NOT EXISTS" in sql for sql in executed_sql)
    # 非 sqlite 分支不应该走 PRAGMA(那是 sqlite 专属语法)
    assert not any("PRAGMA" in sql for sql in executed_sql)
