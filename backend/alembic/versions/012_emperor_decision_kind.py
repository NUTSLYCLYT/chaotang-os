"""012 — freeze the semantic kind of every emperor decision.

Revision ID: 012_emperor_decision_kind
Revises: 011_archive_outcome_events
Create Date: 2026-07-16
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "012_emperor_decision_kind"
down_revision = "011_archive_outcome_events"
branch_labels = None
depends_on = None

_KIND_CHECK = "kind IN ('edict_confirm', 'compat_dispatch', 'final_verdict')"


def _column_state(inspector: sa.Inspector) -> dict | None:
    return next(
        (
            column
            for column in inspector.get_columns("emperor_decisions")
            if column["name"] == "kind"
        ),
        None,
    )


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if _column_state(inspector) is None:
        op.add_column(
            "emperor_decisions",
            sa.Column("kind", sa.Text(), nullable=True),
        )

    bind.execute(
        sa.text(
            "UPDATE emperor_decisions SET kind = 'edict_confirm' "
            "WHERE kind IS NULL AND action IN "
            "('confirm_direct_task', 'confirm_edict')"
        )
    )
    bind.execute(
        sa.text(
            "UPDATE emperor_decisions SET kind = 'compat_dispatch' "
            "WHERE kind IS NULL AND action = 'compat_court_dispatch'"
        )
    )
    bind.execute(
        sa.text(
            "UPDATE emperor_decisions SET kind = 'final_verdict' "
            "WHERE kind IS NULL AND action IN "
            "('adopt', 'approve', 'archive', 'reject', 'request_evidence', "
            "'recheck', 'followup')"
        )
    )

    unknown = bind.execute(
        sa.text(
            "SELECT action, kind, COUNT(*) AS row_count "
            "FROM emperor_decisions "
            "WHERE kind IS NULL OR kind NOT IN "
            "('edict_confirm', 'compat_dispatch', 'final_verdict') "
            "GROUP BY action, kind ORDER BY action, kind"
        )
    ).fetchall()
    if unknown:
        sample = ", ".join(
            f"action={row.action!r} kind={row.kind!r} rows={row.row_count}"
            for row in unknown[:10]
        )
        raise RuntimeError(
            "unknown EmperorDecision action or kind blocks migration 012: " + sample
        )

    inspector = sa.inspect(bind)
    kind_column = _column_state(inspector)
    checks = {
        check.get("name")
        for check in inspector.get_check_constraints("emperor_decisions")
    }
    needs_not_null = bool(kind_column and kind_column.get("nullable", True))
    needs_check = "ck_emperor_decisions_kind" not in checks
    if needs_not_null or needs_check:
        with op.batch_alter_table("emperor_decisions") as batch_op:
            if needs_not_null:
                batch_op.alter_column(
                    "kind", existing_type=sa.Text(), nullable=False
                )
            if needs_check:
                batch_op.create_check_constraint(
                    "ck_emperor_decisions_kind", _KIND_CHECK
                )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if _column_state(inspector) is None:
        return
    checks = {
        check.get("name")
        for check in inspector.get_check_constraints("emperor_decisions")
    }
    with op.batch_alter_table("emperor_decisions") as batch_op:
        if "ck_emperor_decisions_kind" in checks:
            batch_op.drop_constraint(
                "ck_emperor_decisions_kind", type_="check"
            )
        batch_op.drop_column("kind")
