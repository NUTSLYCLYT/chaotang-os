"""019 — R0-W05 evidence rework generation identity on canonical outbox.

Revision ID: 019_outbox_rework_generation
Revises: 018_canonical_completion_identity_fields
Create Date: 2026-07-24

The existing outbox remains the generation fact source.  Nullable columns preserve
legacy rows honestly; W05 rework rows always set both values.
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "019_outbox_rework_generation"
down_revision = "018_canonical_completion_identity_fields"
branch_labels = None
depends_on = None

_GENERATION_UNIQUE = "uq_outbox_events_task_generation"
_IDEMPOTENCY_UNIQUE = "uq_outbox_events_task_idempotency"


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("outbox_events")}
    if "generation" not in columns:
        op.add_column(
            "outbox_events",
            sa.Column("generation", sa.Integer(), nullable=True),
        )
    if "idempotency_key" not in columns:
        op.add_column(
            "outbox_events",
            sa.Column("idempotency_key", sa.Text(), nullable=True),
        )

    inspector = sa.inspect(bind)
    unique_names = {
        constraint["name"]
        for constraint in inspector.get_unique_constraints("outbox_events")
    }
    with op.batch_alter_table("outbox_events") as batch:
        if _GENERATION_UNIQUE not in unique_names:
            batch.create_unique_constraint(
                _GENERATION_UNIQUE,
                ["task_id", "generation"],
            )
        if _IDEMPOTENCY_UNIQUE not in unique_names:
            batch.create_unique_constraint(
                _IDEMPOTENCY_UNIQUE,
                ["task_id", "idempotency_key"],
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    unique_names = {
        constraint["name"]
        for constraint in inspector.get_unique_constraints("outbox_events")
    }
    columns = {column["name"] for column in inspector.get_columns("outbox_events")}
    with op.batch_alter_table("outbox_events") as batch:
        if _IDEMPOTENCY_UNIQUE in unique_names:
            batch.drop_constraint(_IDEMPOTENCY_UNIQUE, type_="unique")
        if _GENERATION_UNIQUE in unique_names:
            batch.drop_constraint(_GENERATION_UNIQUE, type_="unique")
        if "idempotency_key" in columns:
            batch.drop_column("idempotency_key")
        if "generation" in columns:
            batch.drop_column("generation")
