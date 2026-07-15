"""011 — add the append-only archive outcome event ledger.

Revision ID: 011_archive_outcome_events
Revises: 010_final_memorial_quality_gate
Create Date: 2026-07-15
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "011_archive_outcome_events"
down_revision = "010_final_memorial_quality_gate"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "archive_outcome_events" not in inspector.get_table_names():
        op.create_table(
            "archive_outcome_events",
            sa.Column("id", sa.Text(), nullable=False),
            sa.Column("tenant_id", sa.Integer(), nullable=False),
            sa.Column("archive_id", sa.Text(), nullable=True),
            sa.Column("task_id", sa.Text(), nullable=False),
            sa.Column("event_type", sa.Text(), nullable=False),
            sa.Column("actual", sa.Text(), nullable=False),
            sa.Column("source_type", sa.Text(), nullable=False),
            sa.Column("source_auth_level", sa.Text(), nullable=False),
            sa.Column("occurred_at", sa.Text(), nullable=False),
            sa.Column("recorded_at", sa.Text(), nullable=False),
            sa.Column("recorded_by", sa.Text(), nullable=False),
            sa.Column("evidence_ref", sa.Text(), nullable=True),
            sa.Column("idempotency_key", sa.Text(), nullable=False),
            sa.Column("supersedes_event_id", sa.Text(), nullable=True),
            sa.Column("payload_hash", sa.Text(), nullable=False),
            sa.Column("payload_json", sa.Text(), nullable=False),
            sa.Column(
                "synthetic_flag",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "tenant_id",
                "idempotency_key",
                name="uq_archive_outcome_events_tenant_idempotency",
            ),
        )
        op.create_index(
            "ix_archive_outcome_events_tenant_archive_recorded",
            "archive_outcome_events",
            ["tenant_id", "archive_id", "recorded_at"],
            unique=False,
        )
        op.create_index(
            "ix_archive_outcome_events_tenant_task_recorded",
            "archive_outcome_events",
            ["tenant_id", "task_id", "recorded_at"],
            unique=False,
        )
        op.create_index(
            "ix_archive_outcome_events_supersedes",
            "archive_outcome_events",
            ["supersedes_event_id"],
            unique=False,
        )


def downgrade() -> None:
    # This is structurally destructive. Production rollback must first export and
    # verify the append-only ledger; Alembic keeps the conventional inverse only.
    op.drop_index(
        "ix_archive_outcome_events_supersedes",
        table_name="archive_outcome_events",
    )
    op.drop_index(
        "ix_archive_outcome_events_tenant_task_recorded",
        table_name="archive_outcome_events",
    )
    op.drop_index(
        "ix_archive_outcome_events_tenant_archive_recorded",
        table_name="archive_outcome_events",
    )
    op.drop_table("archive_outcome_events")
