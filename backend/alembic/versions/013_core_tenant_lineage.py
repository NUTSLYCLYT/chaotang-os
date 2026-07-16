"""013 — add nullable tenant provenance to the canonical decision chain.

Revision ID: 013_core_tenant_lineage
Revises: 012_emperor_decision_kind
Create Date: 2026-07-16

This is deliberately expand-only: historical ownership is unknown, so the
column has no default and receives no backfill, index, or foreign key.
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "013_core_tenant_lineage"
down_revision = "012_emperor_decision_kind"
branch_labels = None
depends_on = None

_CORE_TABLES = (
    "decision_tasks",
    "chancellor_route_decisions",
    "outbox_events",
    "decree_execution_events",
    "court_reviews",
    "final_memorials",
    "emperor_decisions",
    "shiguan_archives",
)


def _tenant_column(inspector: sa.Inspector, table: str) -> dict | None:
    return next(
        (column for column in inspector.get_columns(table) if column["name"] == "tenant_id"),
        None,
    )


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())
    missing = sorted(set(_CORE_TABLES) - existing_tables)
    if missing:
        raise RuntimeError("missing core tables block migration 013: " + ", ".join(missing))

    columns = {table: _tenant_column(inspector, table) for table in _CORE_TABLES}
    for table, column in columns.items():
        if column is not None:
            if (
                not isinstance(column.get("type"), sa.Integer)
                or not column.get("nullable", True)
                or column.get("default") is not None
            ):
                raise RuntimeError(
                    f"incompatible tenant_id blocks migration 013: table={table} "
                    f"type={column.get('type')} nullable={column.get('nullable')} "
                    f"default={column.get('default')!r}"
                )

    for table, column in columns.items():
        if column is not None:
            continue
        op.add_column(
            table,
            sa.Column("tenant_id", sa.Integer(), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    for table in reversed(_CORE_TABLES):
        inspector = sa.inspect(bind)
        if table not in inspector.get_table_names():
            continue
        if _tenant_column(inspector, table) is None:
            continue
        with op.batch_alter_table(table) as batch_op:
            batch_op.drop_column("tenant_id")
