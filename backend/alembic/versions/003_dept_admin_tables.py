"""003 — admin 可编辑部门管理：departments / department_flows / user_departments。

Revision ID: 003_dept_admin_tables
Revises: 002_task_result_json
Create Date: 2026-06-30

支撑前端 admin/jiqun-depts 页的 /api/admin/depts* 端点。
不涉及 tenants/users（由 src/tenant.py sqlite3 原生管理）；user_id/tenant_id 为逻辑 FK。
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "003_dept_admin_tables"
down_revision = "002_task_result_json"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "departments",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("tenant_id", sa.Integer, nullable=False, server_default="1"),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("created_at", sa.Text, nullable=False, server_default=""),
        sa.UniqueConstraint("tenant_id", "name", name="uq_departments_tenant_name"),
    )
    op.create_index("ix_departments_tenant", "departments", ["tenant_id"])

    op.create_table(
        "department_flows",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("dept_id", sa.Integer, nullable=False),
        sa.Column("flow_id", sa.Text, nullable=False),
        sa.UniqueConstraint("dept_id", "flow_id", name="uq_department_flows_dept_flow"),
    )
    op.create_index("ix_department_flows_dept", "department_flows", ["dept_id"])

    op.create_table(
        "user_departments",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, nullable=False),
        sa.Column("dept_id", sa.Integer, nullable=False),
        sa.UniqueConstraint("user_id", "dept_id", name="uq_user_departments_user_dept"),
    )
    op.create_index("ix_user_departments_user", "user_departments", ["user_id"])
    op.create_index("ix_user_departments_dept", "user_departments", ["dept_id"])


def downgrade() -> None:
    op.drop_table("user_departments")
    op.drop_table("department_flows")
    op.drop_table("departments")
