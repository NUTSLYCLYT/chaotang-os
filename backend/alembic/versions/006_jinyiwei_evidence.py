"""006 — jinyiwei_evidence：锦衣卫共享情报池，跨任务可查。

Revision ID: 006_jinyiwei_evidence
Revises: 005_decree_execution_event_sequence
Create Date: 2026-07-12

见 /home/ubuntu/.claude/plans/valiant-crunching-candy.md「锦衣卫作为跨阶段共享证据服务」
阶段1。这是一张全新的表，没有历史行需要回填——`create_all(checkfirst=True)`
(`web/main.py:91`)对没跑过 alembic 的开发库本来就会正确建表，本迁移只是
生产迁移路径的对应记录，不需要、也没有写 `ensure_*_column` 式自愈函数
(那是给"已有表加列"用的，这里是建新表，不适用)。
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "006_jinyiwei_evidence"
down_revision = "005_decree_execution_event_sequence"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "jinyiwei_evidence",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("origin_task_id", sa.Text(), nullable=True),
        sa.Column("swarm_run_id", sa.Text(), nullable=True),
        sa.Column("query", sa.Text(), nullable=False),
        sa.Column("claim", sa.Text(), nullable=False),
        sa.Column("claim_key", sa.Text(), nullable=False),
        sa.Column("grade", sa.Text(), nullable=False),
        sa.Column("decision", sa.Text(), nullable=False),
        sa.Column("trust", sa.Text(), nullable=False),
        sa.Column("source_label", sa.Text(), nullable=False, server_default="FALLBACK"),
        sa.Column("sources_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("dept_affinity_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.Text(), nullable=False, server_default=""),
        sa.Column("updated_at", sa.Text(), nullable=False, server_default=""),
    )
    op.create_index(
        "ix_jinyiwei_evidence_tenant_key", "jinyiwei_evidence", ["tenant_id", "claim_key"]
    )
    op.create_index(
        "ix_jinyiwei_evidence_tenant_query", "jinyiwei_evidence", ["tenant_id", "query"]
    )
    op.create_index(
        "ix_jinyiwei_evidence_tenant_decision", "jinyiwei_evidence", ["tenant_id", "decision"]
    )


def downgrade() -> None:
    op.drop_index("ix_jinyiwei_evidence_tenant_decision", table_name="jinyiwei_evidence")
    op.drop_index("ix_jinyiwei_evidence_tenant_query", table_name="jinyiwei_evidence")
    op.drop_index("ix_jinyiwei_evidence_tenant_key", table_name="jinyiwei_evidence")
    op.drop_table("jinyiwei_evidence")
