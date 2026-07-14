"""009 — upgrade decree execution timeline to a structured event ledger.

Revision ID: 009_decree_event_ledger
Revises: 008_build_ledger_ownership
Create Date: 2026-07-14
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "009_decree_event_ledger"
down_revision = "008_build_ledger_ownership"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 2026-07-14 复审:004b 对已经靠 create_all 建过表的库是 checkfirst 直接跳过
    # 创建——那种库里 decree_execution_events 已经是最终 ORM schema,这几列/这个
    # 唯一索引都已存在,不判断存在性直接 add_column/create_index 会在这类库上炸,
    # 迁移链在非干净库上中途崩溃(数据丢失风险)。
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing_cols = {c["name"] for c in insp.get_columns("decree_execution_events")}
    new_columns = (
        ("event_type", sa.Column("event_type", sa.Text(), nullable=False, server_default="timeline.note")),
        ("trace_id", sa.Column("trace_id", sa.Text(), nullable=True)),
        ("source_label", sa.Column("source_label", sa.Text(), nullable=False, server_default="FALLBACK")),
        ("payload_json", sa.Column("payload_json", sa.Text(), nullable=False, server_default="{}")),
        ("idempotency_key", sa.Column("idempotency_key", sa.Text(), nullable=True)),
    )
    for name, column in new_columns:
        if name not in existing_cols:
            op.add_column("decree_execution_events", column)

    existing_idx = {i["name"] for i in insp.get_indexes("decree_execution_events")}
    if "uq_decree_execution_events_task_idempotency" not in existing_idx:
        op.create_index(
            "uq_decree_execution_events_task_idempotency",
            "decree_execution_events",
            ["task_id", "idempotency_key"],
            unique=True,
        )


def downgrade() -> None:
    op.drop_index(
        "uq_decree_execution_events_task_idempotency",
        table_name="decree_execution_events",
    )
    op.drop_column("decree_execution_events", "idempotency_key")
    op.drop_column("decree_execution_events", "payload_json")
    op.drop_column("decree_execution_events", "source_label")
    op.drop_column("decree_execution_events", "trace_id")
    op.drop_column("decree_execution_events", "event_type")
