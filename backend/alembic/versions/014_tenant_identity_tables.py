"""014 — adopt tenant identity tables into the primary Alembic history.

Revision ID: 014_tenant_identity_tables
Revises: 013_core_tenant_lineage
Create Date: 2026-07-17
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "014_tenant_identity_tables"
down_revision = "013_core_tenant_lineage"
branch_labels = None
depends_on = None

_REQUIRED = {
    "tenants": {"id", "name", "slug", "created_at"},
    "users": {
        "id",
        "username",
        "password_hash",
        "tenant_id",
        "role",
        "display_name",
        "created_at",
    },
    "invites": {
        "id",
        "code",
        "max_uses",
        "used_count",
        "expires_at",
        "created_at",
    },
}


def _preflight(inspector: sa.Inspector) -> tuple[set[str], bool]:
    existing = set(inspector.get_table_names())
    users_need_email = False
    errors: list[str] = []
    for table, required in _REQUIRED.items():
        if table not in existing:
            continue
        columns = {column["name"] for column in inspector.get_columns(table)}
        missing = sorted(required - columns)
        if missing:
            errors.append(f"{table} missing columns: {', '.join(missing)}")
        if table == "users" and "email" not in columns:
            users_need_email = True
    if errors:
        raise RuntimeError("incompatible tenant identity tables block migration 014: " + "; ".join(errors))
    return existing, users_need_email


def upgrade() -> None:
    bind = op.get_bind()
    existing, users_need_email = _preflight(sa.inspect(bind))
    if "tenants" not in existing:
        op.create_table(
            "tenants",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("name", sa.Text(), nullable=False),
            sa.Column("slug", sa.Text(), nullable=False, unique=True),
            sa.Column("created_at", sa.Text(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        )
    if "users" not in existing:
        op.create_table(
            "users",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("username", sa.Text(), nullable=False, unique=True),
            sa.Column("email", sa.Text(), nullable=True, server_default=""),
            sa.Column("password_hash", sa.Text(), nullable=False),
            sa.Column("tenant_id", sa.Integer(), nullable=False),
            sa.Column("role", sa.Text(), nullable=False, server_default="user"),
            sa.Column("display_name", sa.Text(), nullable=True, server_default=""),
            sa.Column("created_at", sa.Text(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        )
    elif users_need_email:
        op.add_column("users", sa.Column("email", sa.Text(), nullable=True, server_default=""))
    if "invites" not in existing:
        op.create_table(
            "invites",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("code", sa.Text(), nullable=False, unique=True),
            sa.Column("max_uses", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("used_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("expires_at", sa.Text(), nullable=True),
            sa.Column("created_at", sa.Text(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        )


def downgrade() -> None:
    # These tables predate Alembic and hold authentication state.  Downgrading
    # authority must never delete identities.  Revision 013 treats them as the
    # legacy tenant.py-owned tables, so the safe inverse is intentionally no DDL.
    pass
