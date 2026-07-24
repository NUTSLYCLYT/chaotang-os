"""Fail-before-DDL guard for destructive R0-W05 migration downgrades."""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.engine import Connection


def _has_row(bind: Connection, sql: str) -> bool:
    return bind.execute(sa.text(sql)).first() is not None


def refuse_w05_downgrade_if_facts_exist(bind: Connection) -> None:
    """Refuse before any revision in the W05 chain drops representable facts.

    SQLite migration DDL is non-transactional, so a later revision cannot safely
    protect data already dropped by an earlier step in a chained downgrade.
    Every W05 downgrade therefore runs the same preflight against the columns
    visible at its current revision.
    """
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    reasons: list[str] = []

    if "shiguan_archives" in tables:
        columns = {
            column["name"]
            for column in inspector.get_columns("shiguan_archives")
        }
        identity_columns = {
            "final_memorial_id",
            "final_memorial_version",
            "final_memorial_content_hash",
        }
        if identity_columns <= columns and _has_row(
            bind,
            """
            SELECT 1
            FROM shiguan_archives
            WHERE final_memorial_id IS NOT NULL
               OR final_memorial_version IS NOT NULL
               OR final_memorial_content_hash IS NOT NULL
            LIMIT 1
            """,
        ):
            reasons.append("Shiguan exact FinalMemorial identity")

    if "decision_tasks" in tables:
        columns = {
            column["name"] for column in inspector.get_columns("decision_tasks")
        }
        if "contract_scope_json" in columns and _has_row(
            bind,
            """
            SELECT 1
            FROM decision_tasks
            WHERE contract_scope_json IS NOT NULL
            LIMIT 1
            """,
        ):
            reasons.append("canonical contract scope")

    if "final_memorials" in tables:
        columns = {
            column["name"] for column in inspector.get_columns("final_memorials")
        }
        if {"version", "supersedes_id"} <= columns:
            has_version_history = _has_row(
                bind,
                """
                SELECT 1
                FROM final_memorials
                WHERE version <> 1 OR supersedes_id IS NOT NULL
                LIMIT 1
                """,
            )
            has_duplicate_task = _has_row(
                bind,
                """
                SELECT 1
                FROM final_memorials
                GROUP BY task_id
                HAVING COUNT(*) > 1
                LIMIT 1
                """,
            )
            if has_version_history or has_duplicate_task:
                reasons.append("FinalMemorial version history")

    if "outbox_events" in tables:
        columns = {
            column["name"] for column in inspector.get_columns("outbox_events")
        }
        if {"generation", "idempotency_key"} <= columns and _has_row(
            bind,
            """
            SELECT 1
            FROM outbox_events
            WHERE generation IS NOT NULL OR idempotency_key IS NOT NULL
            LIMIT 1
            """,
        ):
            reasons.append("outbox generation identity")

    if reasons:
        raise RuntimeError(
            "refusing downgrade: R0-W05 facts would be destroyed: "
            + ", ".join(reasons)
        )
