"""021 — freeze the supported contract scope on canonical DecisionTask.

Revision ID: 021_decision_task_contract_scope
Revises: 020_final_memorial_versions
Create Date: 2026-07-24
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "021_decision_task_contract_scope"
down_revision = "020_final_memorial_versions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {
        column["name"]
        for column in sa.inspect(op.get_bind()).get_columns("decision_tasks")
    }
    if "contract_scope_json" not in columns:
        op.add_column(
            "decision_tasks",
            sa.Column("contract_scope_json", sa.Text(), nullable=True),
        )


def downgrade() -> None:
    op.drop_column("decision_tasks", "contract_scope_json")
