"""tests/test_migration_007_jinyiwei_evidence_unique_constraint.py

alembic 007 把 jinyiwei_evidence.(tenant_id, claim_key) 从普通索引升级成真正的
UniqueConstraint，先去重旧竞态留下的坏数据、再建约束。

2026-07-12 独立审查纠正："alembic 007 用 op.create_unique_constraint，对本项目
默认的 SQLite DB_URL 不安全"——SQLite 的 ALTER TABLE 完全不支持给已有表加约束，
`op.create_unique_constraint`(非 batch 模式)对 SQLite 方言会直接报
`OperationalError: near "UNIQUE": syntax error`，不是"约束已存在"那种可以捕获、
容错的错误，是迁移脚本本身在默认 DB_URL 下就跑不通。改用 `op.batch_alter_table`
(SQLite 下整表重建复制；Postgres 等原生支持 ALTER 的方言下自动退化成普通 ALTER，
行为不变)后本测试针对真实 SQLite 文件跑一次完整的 upgrade/downgrade 验证。

需要真实安装的 `alembic`(本仓库 requirements-core.txt 的核心依赖，非可选项)——
如果当前解释器没装，跳过而不是伪造通过；本地/CI 只要装了 requirements-core.txt
这个测试就会真实执行。
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

alembic_config = pytest.importorskip("alembic.config")
alembic_command = pytest.importorskip("alembic.command")

import sqlalchemy as sa  # noqa: E402
from sqlalchemy import Column, Index, Integer, MetaData, Table, Text, create_engine  # noqa: E402

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
_ALEMBIC_INI = _BACKEND_ROOT / "alembic.ini"


def _build_legacy_pre_007_schema(engine) -> None:
    """P0-1(d88c17a)之前的 JinyiweiEvidence 表结构：普通索引，不是唯一约束。"""
    metadata = MetaData()
    Table(
        "jinyiwei_evidence",
        metadata,
        Column("id", Text, primary_key=True),
        Column("tenant_id", Integer, nullable=False, default=1),
        Column("origin_task_id", Text, nullable=True),
        Column("swarm_run_id", Text, nullable=True),
        Column("query", Text, nullable=False),
        Column("claim", Text, nullable=False),
        Column("claim_key", Text, nullable=False),
        Column("grade", Text, nullable=False),
        Column("decision", Text, nullable=False),
        Column("trust", Text, nullable=False),
        Column("source_label", Text, nullable=False, default="FALLBACK"),
        Column("sources_json", Text, nullable=False, default="[]"),
        Column("dept_affinity_json", Text, nullable=False, default="[]"),
        Column("created_at", Text, nullable=False),
        Column("updated_at", Text, nullable=False),
        Index("ix_jinyiwei_evidence_tenant_key", "tenant_id", "claim_key"),
        Index("ix_jinyiwei_evidence_tenant_query", "tenant_id", "query"),
        Index("ix_jinyiwei_evidence_tenant_decision", "tenant_id", "decision"),
    )
    metadata.create_all(engine)


def _seed_rows_with_legacy_duplicate(engine) -> None:
    """插入旧竞态遗留的坏数据(同一 (tenant_id, claim_key) 两行)+ 一行干净数据。"""
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "INSERT INTO jinyiwei_evidence "
                "(id, tenant_id, query, claim, claim_key, grade, decision, trust, "
                "source_label, sources_json, dept_affinity_json, created_at, updated_at) "
                "VALUES (:id, 1, 'q', :claim, :claim_key, '一手', '入库', 'verified', "
                "'X', '[]', '[]', :created_at, :updated_at)"
            ),
            [
                dict(id="a1", claim="c1-旧", claim_key="k1",
                     created_at="2026-01-01T00:00:00Z", updated_at="2026-01-01T00:00:00Z"),
                dict(id="a2", claim="c1-新", claim_key="k1",
                     created_at="2026-01-02T00:00:00Z", updated_at="2026-01-02T00:00:00Z"),
                dict(id="b1", claim="c2", claim_key="k2",
                     created_at="2026-01-01T00:00:00Z", updated_at="2026-01-01T00:00:00Z"),
            ],
        )


def _run_migration(db_path: Path, monkeypatch, revision: str) -> None:
    monkeypatch.setenv("DB_URL", f"sqlite:///{db_path}")
    monkeypatch.chdir(_BACKEND_ROOT)
    cfg = alembic_config.Config(str(_ALEMBIC_INI))
    alembic_command.stamp(cfg, "006_jinyiwei_evidence")
    alembic_command.upgrade(cfg, revision)


def test_migration_007_dedupes_legacy_rows_and_builds_real_constraint_on_sqlite(
    tmp_path, monkeypatch
):
    db_path = tmp_path / "repro_007.db"
    engine = create_engine(f"sqlite:///{db_path}")
    _build_legacy_pre_007_schema(engine)
    _seed_rows_with_legacy_duplicate(engine)
    engine.dispose()

    _run_migration(db_path, monkeypatch, "007_jinyiwei_evidence_unique_constraint")

    conn = sqlite3.connect(str(db_path))
    try:
        rows = conn.execute(
            "SELECT id, claim_key, updated_at FROM jinyiwei_evidence ORDER BY id"
        ).fetchall()
        assert rows == [
            ("a2", "k1", "2026-01-02T00:00:00Z"),
            ("b1", "k2", "2026-01-01T00:00:00Z"),
        ], "去重应保留 updated_at 最新的一行(a2)，删掉旧行(a1)，干净行(b1)不受影响"

        table_sql = conn.execute(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='jinyiwei_evidence'"
        ).fetchone()[0]
        assert "UNIQUE (tenant_id, claim_key)" in table_sql

        index_names = {
            row[0]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='jinyiwei_evidence'"
            )
        }
        assert "ix_jinyiwei_evidence_tenant_key" not in index_names
        assert "ix_jinyiwei_evidence_tenant_query" in index_names
        assert "ix_jinyiwei_evidence_tenant_decision" in index_names

        with pytest.raises(sqlite3.IntegrityError):
            conn.execute(
                "INSERT INTO jinyiwei_evidence "
                "(id, tenant_id, query, claim, claim_key, grade, decision, trust, "
                "source_label, sources_json, dept_affinity_json, created_at, updated_at) "
                "VALUES ('b2', 1, 'q', 'c2-又一个', 'k2', '一手', '入库', 'verified', "
                "'X', '[]', '[]', '2026-01-03T00:00:00Z', '2026-01-03T00:00:00Z')"
            )
    finally:
        conn.close()


def test_migration_007_downgrade_restores_plain_index_on_sqlite(tmp_path, monkeypatch):
    db_path = tmp_path / "repro_007_downgrade.db"
    engine = create_engine(f"sqlite:///{db_path}")
    _build_legacy_pre_007_schema(engine)
    _seed_rows_with_legacy_duplicate(engine)
    engine.dispose()

    _run_migration(db_path, monkeypatch, "007_jinyiwei_evidence_unique_constraint")

    monkeypatch.setenv("DB_URL", f"sqlite:///{db_path}")
    cfg = alembic_config.Config(str(_ALEMBIC_INI))
    alembic_command.downgrade(cfg, "-1")

    conn = sqlite3.connect(str(db_path))
    try:
        table_sql = conn.execute(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='jinyiwei_evidence'"
        ).fetchone()[0]
        assert "UNIQUE (tenant_id, claim_key)" not in table_sql

        index_names = {
            row[0]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='jinyiwei_evidence'"
            )
        }
        assert "ix_jinyiwei_evidence_tenant_key" in index_names
    finally:
        conn.close()
