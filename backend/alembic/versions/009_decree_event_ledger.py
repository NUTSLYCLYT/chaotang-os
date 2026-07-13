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
    op.add_column(
        "decree_execution_events",
        sa.Column(
            "event_type", sa.Text(), nullable=False, server_default="timeline.note"
        ),
    )
    op.add_column(
        "decree_execution_events", sa.Column("trace_id", sa.Text(), nullable=True)
    )
    op.add_column(
        "decree_execution_events",
        sa.Column("source_label", sa.Text(), nullable=False, server_default="FALLBACK"),
    )
    op.add_column(
        "decree_execution_events",
        sa.Column("payload_json", sa.Text(), nullable=False, server_default="{}"),
    )
    op.add_column(
        "decree_execution_events",
        sa.Column("idempotency_key", sa.Text(), nullable=True),
    )
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
