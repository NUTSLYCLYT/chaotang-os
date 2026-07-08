"""001 — baseline: 创建 5 张 flow 持久化表。

Revision ID: 001_flow_tables
Revises: (none — baseline)
Create Date: 2026-05-31

表: decrees / tasks / memorials / reviews / retrospectives
不涉及 tenants/users(由 src/tenant.py sqlite3 原生管理)。
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "001_flow_tables"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── decrees ──────────────────────────────────────────────────────────
    op.create_table(
        "decrees",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("decree_id", sa.Text, nullable=False, unique=True),
        sa.Column("tenant_id", sa.Integer, nullable=False, server_default="1"),
        sa.Column("user_id", sa.Integer, nullable=True),
        sa.Column("raw_command", sa.Text, nullable=False, server_default=""),
        sa.Column("intent", sa.Text, nullable=True),
        sa.Column("task_type", sa.Text, nullable=True),
        sa.Column("ministers_json", sa.Text, nullable=False, server_default="[]"),
        sa.Column("groups_json", sa.Text, nullable=False, server_default="[]"),
        sa.Column("created_at", sa.Text, nullable=False, server_default=""),
    )
    op.create_index("ix_decrees_decree_id", "decrees", ["decree_id"])
    op.create_index("ix_decrees_tenant_created", "decrees", ["tenant_id", "created_at"])

    # ── tasks ─────────────────────────────────────────────────────────────
    op.create_table(
        "tasks",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("task_id", sa.Text, nullable=False, unique=True),
        sa.Column("decree_id", sa.Text, nullable=True),
        sa.Column("tenant_id", sa.Integer, nullable=False, server_default="1"),
        sa.Column("status", sa.Text, nullable=False, server_default="running"),
        sa.Column("task_status", sa.Text, nullable=True),
        sa.Column("task_input", sa.Text, nullable=True),
        sa.Column("flow_name", sa.Text, nullable=True),
        sa.Column("run_id", sa.Text, nullable=True),
        sa.Column("departments_json", sa.Text, nullable=False, server_default="[]"),
        sa.Column("total_steps", sa.Integer, nullable=True),
        sa.Column("completed_steps", sa.Integer, nullable=False, server_default="0"),
        sa.Column("started_at", sa.Text, nullable=True),
        sa.Column("finished_at", sa.Text, nullable=True),
        sa.Column("error", sa.Text, nullable=True),
        sa.Column("last_stage", sa.Text, nullable=True),
        sa.Column("created_at", sa.Text, nullable=False, server_default=""),
        sa.Column("updated_at", sa.Text, nullable=False, server_default=""),
    )
    op.create_index("ix_tasks_task_id", "tasks", ["task_id"])
    op.create_index("ix_tasks_tenant_status", "tasks", ["tenant_id", "status"])
    op.create_index("ix_tasks_run_id", "tasks", ["run_id"])

    # ── memorials ─────────────────────────────────────────────────────────
    op.create_table(
        "memorials",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("memorial_id", sa.Text, nullable=False, unique=True),
        sa.Column("tenant_id", sa.Integer, nullable=False, server_default="1"),
        sa.Column("task_id", sa.Text, nullable=True),
        sa.Column("title", sa.Text, nullable=False, server_default=""),
        sa.Column("source_department", sa.Text, nullable=False, server_default=""),
        sa.Column("agent_code", sa.Text, nullable=False, server_default=""),
        sa.Column("priority", sa.Text, nullable=False, server_default="medium"),
        sa.Column("status", sa.Text, nullable=False, server_default="running"),
        sa.Column("summary", sa.Text, nullable=False, server_default=""),
        sa.Column("created_at", sa.Text, nullable=False, server_default=""),
        sa.Column("updated_at", sa.Text, nullable=False, server_default=""),
    )
    op.create_index("ix_memorials_memorial_id", "memorials", ["memorial_id"])
    op.create_index("ix_memorials_tenant_status", "memorials", ["tenant_id", "status"])
    op.create_index("ix_memorials_tenant_dept", "memorials", ["tenant_id", "source_department"])
    op.create_index("ix_memorials_created_at", "memorials", ["created_at"])

    # ── reviews ───────────────────────────────────────────────────────────
    op.create_table(
        "reviews",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("review_id", sa.Text, nullable=False, unique=True),
        sa.Column("memorial_id", sa.Text, nullable=False),
        sa.Column("tenant_id", sa.Integer, nullable=False, server_default="1"),
        sa.Column("action", sa.Text, nullable=False),
        sa.Column("comment", sa.Text, nullable=False, server_default=""),
        sa.Column("reviewer_name", sa.Text, nullable=False, server_default=""),
        sa.Column("created_at", sa.Text, nullable=False, server_default=""),
    )
    op.create_index("ix_reviews_memorial_id", "reviews", ["memorial_id"])
    op.create_index("ix_reviews_tenant_created", "reviews", ["tenant_id", "created_at"])

    # ── retrospectives ────────────────────────────────────────────────────
    op.create_table(
        "retrospectives",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("task_id", sa.Text, nullable=False, unique=True),
        sa.Column("tenant_id", sa.Integer, nullable=False, server_default="1"),
        sa.Column("score", sa.Integer, nullable=False, server_default="3"),
        sa.Column("successes_json", sa.Text, nullable=False, server_default="[]"),
        sa.Column("failures_json", sa.Text, nullable=False, server_default="[]"),
        sa.Column("lessons_json", sa.Text, nullable=False, server_default="[]"),
        sa.Column("playbook", sa.Text, nullable=True),
        sa.Column("authored_by", sa.Text, nullable=False, server_default="史官"),
        sa.Column("authored_at", sa.Text, nullable=False, server_default=""),
        sa.Column("synthetic", sa.Boolean, nullable=False, server_default="0"),
    )
    op.create_index("ix_retrospectives_task_id", "retrospectives", ["task_id"])


def downgrade() -> None:
    """回滚:DROP 5 张表(不影响 tenants/users)。"""
    op.drop_table("retrospectives")
    op.drop_table("reviews")
    op.drop_table("memorials")
    op.drop_table("tasks")
    op.drop_table("decrees")
