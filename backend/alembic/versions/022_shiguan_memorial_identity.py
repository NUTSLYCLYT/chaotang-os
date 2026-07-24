"""022 — bind ShiguanArchive to one exact FinalMemorial version.

Revision ID: 022_shiguan_memorial_identity
Revises: 021_decision_task_contract_scope
Create Date: 2026-07-24
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op
from src.w05_downgrade_guard import refuse_w05_downgrade_if_facts_exist

revision = "022_shiguan_memorial_identity"
down_revision = "021_decision_task_contract_scope"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {
        column["name"]
        for column in sa.inspect(op.get_bind()).get_columns("shiguan_archives")
    }
    additions = (
        sa.Column("final_memorial_id", sa.Text(), nullable=True),
        sa.Column("final_memorial_version", sa.Integer(), nullable=True),
        sa.Column("final_memorial_content_hash", sa.Text(), nullable=True),
    )
    for column in additions:
        if column.name not in columns:
            op.add_column("shiguan_archives", column)


def downgrade() -> None:
    refuse_w05_downgrade_if_facts_exist(op.get_bind())
    op.drop_column("shiguan_archives", "final_memorial_content_hash")
    op.drop_column("shiguan_archives", "final_memorial_version")
    op.drop_column("shiguan_archives", "final_memorial_id")
