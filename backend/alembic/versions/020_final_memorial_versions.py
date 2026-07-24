"""020 — append-only version lineage on the canonical FinalMemorial table.

Revision ID: 020_final_memorial_versions
Revises: 019_outbox_rework_generation
Create Date: 2026-07-24
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op
from src.w05_downgrade_guard import refuse_w05_downgrade_if_facts_exist

revision = "020_final_memorial_versions"
down_revision = "019_outbox_rework_generation"
branch_labels = None
depends_on = None

_OLD_TASK_UNIQUE = "uq_final_memorials_task_id"
_VERSION_UNIQUE = "uq_final_memorials_task_version"
_CURRENT_UNIQUE = "uq_final_memorials_current_task"


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("final_memorials")}
    unique_names = {
        constraint["name"]
        for constraint in inspector.get_unique_constraints("final_memorials")
    }
    with op.batch_alter_table("final_memorials") as batch:
        if "version" not in columns:
            batch.add_column(
                sa.Column("version", sa.Integer(), nullable=False, server_default="1")
            )
        if "supersedes_id" not in columns:
            batch.add_column(sa.Column("supersedes_id", sa.Text(), nullable=True))
        if "is_current" not in columns:
            batch.add_column(
                sa.Column(
                    "is_current",
                    sa.Boolean(),
                    nullable=False,
                    server_default=sa.true(),
                )
            )
        if _OLD_TASK_UNIQUE in unique_names:
            batch.drop_constraint(_OLD_TASK_UNIQUE, type_="unique")
        if _VERSION_UNIQUE not in unique_names:
            batch.create_unique_constraint(
                _VERSION_UNIQUE,
                ["task_id", "version"],
            )

    index_names = {index["name"] for index in inspector.get_indexes("final_memorials")}
    if _CURRENT_UNIQUE not in index_names:
        op.create_index(
            _CURRENT_UNIQUE,
            "final_memorials",
            ["task_id"],
            unique=True,
            sqlite_where=sa.text("is_current = 1"),
            postgresql_where=sa.text("is_current = true"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    refuse_w05_downgrade_if_facts_exist(bind)
    inspector = sa.inspect(bind)
    if _CURRENT_UNIQUE in {index["name"] for index in inspector.get_indexes("final_memorials")}:
        op.drop_index(_CURRENT_UNIQUE, table_name="final_memorials")
    with op.batch_alter_table("final_memorials") as batch:
        batch.drop_constraint(_VERSION_UNIQUE, type_="unique")
        batch.create_unique_constraint(_OLD_TASK_UNIQUE, ["task_id"])
        batch.drop_column("is_current")
        batch.drop_column("supersedes_id")
        batch.drop_column("version")
