"""018 — R0-W04 canonical 完成与恢复：decision_tasks.request_id +
decree_execution_events.request_id/release_id/model_version。

Revision ID: 018_canonical_completion_identity_fields
Revises: 017_secure_ingest_tables
Create Date: 2026-07-23

R0-REQ-020：request_id/task_id/tenant_id/release_id/model_version 贯穿全链。
task_id/tenant_id 已经在这两张表上；这里只补 request_id/release_id/
model_version 三个缺的字段。纯新增可空列，不新建表（R0-REQ-008：不新建第二
Mission/完成事实源）。旧行允许 request_id/release_id/model_version 为 NULL——
"没有值"和"假造一个值"是两码事。
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "018_canonical_completion_identity_fields"
down_revision = "017_secure_ingest_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 2026-07-23：checkfirst 判断存在性，避免在已经靠 create_all 建过表的库
    # (ORM schema 已含这些列)上重复 add_column 炸 "duplicate column"。
    bind = op.get_bind()
    insp = sa.inspect(bind)

    task_cols = {c["name"] for c in insp.get_columns("decision_tasks")}
    if "request_id" not in task_cols:
        op.add_column("decision_tasks", sa.Column("request_id", sa.Text(), nullable=True))

    event_cols = {c["name"] for c in insp.get_columns("decree_execution_events")}
    if "request_id" not in event_cols:
        op.add_column("decree_execution_events", sa.Column("request_id", sa.Text(), nullable=True))
    if "release_id" not in event_cols:
        op.add_column("decree_execution_events", sa.Column("release_id", sa.Text(), nullable=True))
    if "model_version" not in event_cols:
        op.add_column("decree_execution_events", sa.Column("model_version", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("decree_execution_events", "model_version")
    op.drop_column("decree_execution_events", "release_id")
    op.drop_column("decree_execution_events", "request_id")
    op.drop_column("decision_tasks", "request_id")
