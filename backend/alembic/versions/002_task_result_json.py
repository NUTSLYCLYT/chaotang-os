"""Add tasks.result_json for frontend-visible persisted task output.

Revision ID: 002_task_result_json
Revises: 001_flow_tables
Create Date: 2026-06-12
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "002_task_result_json"
down_revision = "001_flow_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("result_json", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("tasks", "result_json")
