"""Explicit, fail-closed upgrade of the legacy Shiguan archive schema."""

from __future__ import annotations

import json
import shutil
import sqlite3
from collections.abc import Mapping
from pathlib import Path

from app.shiguan import validation
from app.shiguan.errors import ArchiveValidationError

_V2_ARCHIVES_SCHEMA = """
CREATE TABLE archives_v2 (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    matter_type TEXT NOT NULL,
    department TEXT NOT NULL,
    created_at TEXT NOT NULL,
    lessons_learned TEXT,
    pitfalls TEXT,
    source_kind TEXT,
    source_text TEXT,
    participating_departments TEXT,
    reply_process TEXT,
    reply_conclusion TEXT,
    reply_time TEXT,
    respondent TEXT,
    owner_user_id TEXT
)
"""


def migrate_legacy_archives(
    db_path: Path, confirmed_pairs: Mapping[str, str], backup_path: Path
) -> None:
    """Upgrade a v1 database only when every fake pair is explicitly confirmed.

    The mapping is deliberately the only provenance input.  A failed validation
    leaves the live database unchanged; a successful v1 upgrade first creates a
    copy at ``backup_path``.  Version 2 databases are intentionally no-ops.
    """

    conn = sqlite3.connect(db_path)
    try:
        version = conn.execute("PRAGMA user_version").fetchone()[0]
    finally:
        conn.close()
    if version == 2:
        return

    shutil.copy2(db_path, backup_path)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("BEGIN IMMEDIATE")
        _validate_exact_legacy_set(conn, confirmed_pairs)
        _replace_confirmed_pairs_with_replies(conn, confirmed_pairs)
        conn.execute("PRAGMA user_version = 2")
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _validate_exact_legacy_set(
    conn: sqlite3.Connection, confirmed_pairs: Mapping[str, str]
) -> None:
    rows = conn.execute("SELECT * FROM archives").fetchall()
    archives = {row["id"]: row for row in rows}
    decisions = {row["id"]: row for row in rows if row["type"] == "DECISION"}
    if any(row["type"] not in {"MEMORIAL", "DECISION"} for row in rows):
        raise ArchiveValidationError("legacy archive type is unsupported")
    if set(confirmed_pairs) != set(decisions):
        raise ArchiveValidationError("every legacy decision requires an explicit pair")
    if len(set(confirmed_pairs.values())) != len(confirmed_pairs):
        raise ArchiveValidationError("a legacy memorial cannot be shared by decisions")

    actual_relations = {
        (row["archive_id"], row["related_id"])
        for row in conn.execute("SELECT archive_id, related_id FROM archive_relations")
    }
    expected_relations = set(confirmed_pairs.items())
    if actual_relations != expected_relations:
        raise ArchiveValidationError("legacy relations are missing, unknown, or ambiguous")

    for decision_id, memorial_id in confirmed_pairs.items():
        decision = archives.get(decision_id)
        memorial = archives.get(memorial_id)
        if decision is None or decision["type"] != "DECISION":
            raise ArchiveValidationError("confirmed decision is not a legacy decision")
        if memorial is None or memorial["type"] != "MEMORIAL":
            raise ArchiveValidationError("confirmed memorial is not a legacy memorial")
        _validate_reply_payload(decision, memorial)


def _validate_reply_payload(decision: sqlite3.Row, memorial: sqlite3.Row) -> None:
    try:
        participating_departments = json.loads(decision["participating_departments"])
    except (TypeError, json.JSONDecodeError) as exc:
        raise ArchiveValidationError("legacy decision departments are invalid") from exc
    validation.validate_archive_create(
        {
            "type": "REPLY",
            "title": decision["title"],
            "content": decision["content"],
            "matter_type": decision["matter_type"],
            "department": decision["department"],
            "source_kind": "DECREE",
            "source_text": memorial["content"],
            "participating_departments": participating_departments,
            "reply_process": decision["decision_process"],
            "reply_conclusion": decision["decision_conclusion"],
            "reply_time": decision["decision_time"],
            "respondent": decision["responsible_owner"],
        }
    )


def _replace_confirmed_pairs_with_replies(
    conn: sqlite3.Connection, confirmed_pairs: Mapping[str, str]
) -> None:
    rows = conn.execute("SELECT * FROM archives").fetchall()
    by_id = {row["id"]: row for row in rows}
    conn.execute(_V2_ARCHIVES_SCHEMA)
    memorial_ids = set(confirmed_pairs.values())
    for row in rows:
        if row["id"] in memorial_ids:
            continue
        if row["type"] == "DECISION":
            memorial = by_id[confirmed_pairs[row["id"]]]
            values = (
                row["id"],
                "REPLY",
                row["title"],
                row["content"],
                row["matter_type"],
                row["department"],
                row["created_at"],
                row["lessons_learned"],
                row["pitfalls"],
                "DECREE",
                memorial["content"],
                row["participating_departments"],
                row["decision_process"],
                row["decision_conclusion"],
                row["decision_time"],
                row["responsible_owner"],
                row["owner_user_id"],
            )
        else:
            values = (
                row["id"],
                row["type"],
                row["title"],
                row["content"],
                row["matter_type"],
                row["department"],
                row["created_at"],
                row["lessons_learned"],
                row["pitfalls"],
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                row["owner_user_id"],
            )
        conn.execute(
            "INSERT INTO archives_v2 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            values,
        )

    for memorial_id in memorial_ids:
        conn.execute(
            "DELETE FROM archive_relations WHERE archive_id = ? OR related_id = ?",
            (memorial_id, memorial_id),
        )
        conn.execute("DELETE FROM archive_evidence WHERE archive_id = ?", (memorial_id,))
        conn.execute("DELETE FROM archive_review_status WHERE archive_id = ?", (memorial_id,))
    if confirmed_pairs:
        conn.execute(
            "DELETE FROM archive_relations WHERE archive_id IN ({})".format(
                ", ".join("?" for _ in confirmed_pairs)
            ),
            tuple(confirmed_pairs),
        )
    conn.execute("DROP TABLE archives")
    conn.execute("ALTER TABLE archives_v2 RENAME TO archives")
