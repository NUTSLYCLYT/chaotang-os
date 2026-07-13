"""010 — add the unique, quality-gated formal memorial fact source.

Revision ID: 010_final_memorial_quality_gate
Revises: 009_decree_event_ledger
Create Date: 2026-07-14
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "010_final_memorial_quality_gate"
down_revision = "009_decree_event_ledger"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "final_memorials",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("task_id", sa.Text(), nullable=False),
        sa.Column("review_id", sa.Text(), nullable=False),
        sa.Column("swarm_run_id", sa.Text(), nullable=False),
        sa.Column("quality_result_id", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.Text(),
            nullable=False,
            server_default="ready_for_decision",
        ),
        sa.Column("source_label", sa.Text(), nullable=False),
        sa.Column("memorial_json", sa.Text(), nullable=False),
        sa.Column("content_hash", sa.Text(), nullable=False),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("task_id", name="uq_final_memorials_task_id"),
    )
    op.create_index(
        "ix_final_memorials_review", "final_memorials", ["review_id"], unique=False
    )
    op.create_index(
        "ix_final_memorials_swarm_run",
        "final_memorials",
        ["swarm_run_id"],
        unique=False,
    )
    op.create_index(
        "ix_final_memorials_status_created",
        "final_memorials",
        ["status", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_final_memorials_status_created", table_name="final_memorials")
    op.drop_index("ix_final_memorials_swarm_run", table_name="final_memorials")
    op.drop_index("ix_final_memorials_review", table_name="final_memorials")
    op.drop_table("final_memorials")
