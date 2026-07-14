"""008 — build_ledger_entries/build_ledger_audit_events 加 tenant_id/user_id 归属列。

Revision ID: 008_build_ledger_ownership
Revises: 007_jinyiwei_evidence_unique_constraint
Create Date: 2026-07-12

P0-A(外部只读审查发现)：这两张表原来完全没有归属列，
`/api/court/build-ledger` 的 GET(不带 taskId)会把最近 50 条记录跨所有
用户/租户返回给任意已登录调用方，transition/persist/prune 也都不按归属
校验——是 IDOR/broken access control。这里只是普通 ADD COLUMN(不是像 007
那样的约束)，SQLite/PostgreSQL 都不需要 batch 模式——`ADD COLUMN ...
DEFAULT ... NOT NULL` 两边都是合法语法，旧行会被数据库自动回填成默认值
(tenant_id=1, user_id='anonymous')。
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "008_build_ledger_ownership"
down_revision = "007_jinyiwei_evidence_unique_constraint"
branch_labels = None
depends_on = None

_TABLES = ("build_ledger_entries", "build_ledger_audit_events")


def upgrade() -> None:
    # 2026-07-14 复审:004b 对已经靠 create_all 建过表的库是 checkfirst 直接跳过
    # 创建——那种库里这两张表已经是最终 ORM schema(tenant_id/user_id/索引都在),
    # 不判断存在性直接 add_column/create_index 会在这类库上炸("duplicate
    # column"/"index already exists"),迁移链在非干净库上中途崩溃(数据丢失风险)。
    bind = op.get_bind()
    insp = sa.inspect(bind)
    for table in _TABLES:
        existing_cols = {c["name"] for c in insp.get_columns(table)}
        if "tenant_id" not in existing_cols:
            op.add_column(
                table,
                sa.Column("tenant_id", sa.Integer(), nullable=False, server_default="1"),
            )
        if "user_id" not in existing_cols:
            op.add_column(
                table,
                sa.Column("user_id", sa.Text(), nullable=False, server_default="anonymous"),
            )

    entries_idx = {i["name"] for i in insp.get_indexes("build_ledger_entries")}
    if "ix_build_ledger_entries_tenant_user" not in entries_idx:
        op.create_index(
            "ix_build_ledger_entries_tenant_user",
            "build_ledger_entries",
            ["tenant_id", "user_id"],
        )
    audit_idx = {i["name"] for i in insp.get_indexes("build_ledger_audit_events")}
    if "ix_build_ledger_audit_tenant_user" not in audit_idx:
        op.create_index(
            "ix_build_ledger_audit_tenant_user",
            "build_ledger_audit_events",
            ["tenant_id", "user_id"],
        )


def downgrade() -> None:
    op.drop_index("ix_build_ledger_audit_tenant_user", table_name="build_ledger_audit_events")
    op.drop_index("ix_build_ledger_entries_tenant_user", table_name="build_ledger_entries")
    for table in _TABLES:
        op.drop_column(table, "user_id")
        op.drop_column(table, "tenant_id")
