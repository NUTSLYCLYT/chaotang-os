"""CRUD, review-status and statistics operations for 史馆 archives.

Pure functions/no FastAPI dependency: this module only imports
``sqlite3``, ``app.shiguan.db``, ``app.shiguan.validation`` and
``app.shiguan.models``. Every function opens its own short-lived
connection via ``db.get_connection()`` and closes it before returning
(``try``/``finally``), so callers never need to manage connection
lifecycle themselves.
"""

from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import UTC, datetime
from pathlib import Path

from app.shiguan import db, validation
from app.shiguan.errors import (
    ArchiveNotFoundError,
    ArchiveValidationError,
    ShiguanStorageError,
)
from app.shiguan.models import (
    Archive,
    ArchiveCreate,
    ArchiveType,
    Evidence,
    ReviewStatus,
    Statistics,
)

_ARCHIVE_COLUMNS = (
    "id, type, title, content, matter_type, department, created_at, "
    "lessons_learned, pitfalls, participating_departments, "
    "decision_process, decision_conclusion, decision_time, responsible_owner, owner_user_id"
)


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _insert_validated_archive(
    conn: sqlite3.Connection, validated: ArchiveCreate, owner_user_id: str
) -> Archive:
    """Insert one validated archive into the caller-owned transaction."""
    validation.validate_related_archive_ids(
        conn, validated.related_archive_ids, owner_user_id=owner_user_id
    )
    archive_id = uuid.uuid4().hex
    created_at = _now_iso()
    conn.execute(
        f"INSERT INTO archives ({_ARCHIVE_COLUMNS}) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            archive_id,
            validated.type,
            validated.title,
            validated.content,
            validated.matter_type,
            validated.department,
            created_at,
            validated.lessons_learned,
            validated.pitfalls,
            json.dumps(validated.participating_departments, ensure_ascii=False)
            if validated.participating_departments is not None
            else None,
            validated.decision_process,
            validated.decision_conclusion,
            validated.decision_time,
            validated.responsible_owner,
            owner_user_id,
        ),
    )
    for evidence in validated.evidence:
        conn.execute(
            "INSERT INTO archive_evidence (archive_id, source, reality_label, note) "
            "VALUES (?, ?, ?, ?)",
            (archive_id, evidence.source, evidence.reality_label, evidence.note),
        )
    for related_id in validated.related_archive_ids:
        conn.execute(
            "INSERT INTO archive_relations (archive_id, related_id) VALUES (?, ?)",
            (archive_id, related_id),
        )
    row = conn.execute("SELECT * FROM archives WHERE id = ?", (archive_id,)).fetchone()
    return _build_archive(conn, row, owner_user_id)


def _build_archive(
    conn: sqlite3.Connection, row: sqlite3.Row, owner_user_id: str
) -> Archive:
    archive_id = row["id"]

    evidence_rows = conn.execute(
        "SELECT source, reality_label, note FROM archive_evidence "
        "WHERE archive_id = ? ORDER BY id ASC",
        (archive_id,),
    ).fetchall()
    evidence = [
        Evidence(source=r["source"], reality_label=r["reality_label"], note=r["note"])
        for r in evidence_rows
    ]

    related_rows = conn.execute(
        "SELECT relation.related_id FROM archive_relations AS relation "
        "JOIN archives AS related ON related.id = relation.related_id "
        "WHERE relation.archive_id = ? AND related.owner_user_id = ? "
        "ORDER BY relation.seq ASC",
        (archive_id, owner_user_id),
    ).fetchall()
    related_archive_ids = [r["related_id"] for r in related_rows]

    review_row = conn.execute(
        "SELECT status, reviewed_at, note FROM archive_review_status WHERE archive_id = ?",
        (archive_id,),
    ).fetchone()
    review_status = (
        ReviewStatus(
            status=review_row["status"],
            reviewed_at=review_row["reviewed_at"],
            note=review_row["note"],
        )
        if review_row is not None
        else None
    )

    participating_departments = (
        json.loads(row["participating_departments"])
        if row["participating_departments"] is not None
        else None
    )

    return Archive(
        id=archive_id,
        type=row["type"],
        title=row["title"],
        content=row["content"],
        matter_type=row["matter_type"],
        department=row["department"],
        related_archive_ids=related_archive_ids,
        evidence=evidence,
        created_at=row["created_at"],
        lessons_learned=row["lessons_learned"],
        pitfalls=row["pitfalls"],
        participating_departments=participating_departments,
        decision_process=row["decision_process"],
        decision_conclusion=row["decision_conclusion"],
        decision_time=row["decision_time"],
        responsible_owner=row["responsible_owner"],
        review_status=review_status,
    )


def create_archive(
    payload: dict | ArchiveCreate, *, owner_user_id: str, db_path: Path | None = None
) -> Archive:
    """Validate and persist a new archive, returning the full stored record.

    ``id`` is always server-generated (UUID4 hex) and inserted with a plain
    ``INSERT`` (never an upsert/replace), so an accidental id collision
    fails loudly instead of silently overwriting an existing archive.

    Raises:
        ArchiveValidationError: ``payload`` fails structural validation, or
            ``related_archive_ids`` references an archive that does not
            exist.
        ShiguanStorageError: The sqlite write itself failed.
    """

    payload_dict = payload.model_dump() if isinstance(payload, ArchiveCreate) else dict(payload)

    conn = db.get_connection(db_path)
    try:
        validated = validation.validate_archive_create(payload_dict)
        try:
            archive = _insert_validated_archive(conn, validated, owner_user_id)
            conn.commit()
        except sqlite3.Error as exc:
            conn.rollback()
            raise ShiguanStorageError("史馆写入失败，请稍后再试") from exc

        return archive
    finally:
        conn.close()


def create_linked_archive_pair(
    memorial_payload: dict,
    decision_payload: dict,
    *,
    owner_user_id: str,
    db_path: Path | None = None,
) -> tuple[Archive, Archive]:
    """Atomically create a MEMORIAL and its linked DECISION.

    The relation is injected internally, so callers cannot observe a lone
    memorial if decision validation or any SQLite statement fails.
    """
    conn = db.get_connection(db_path)
    try:
        try:
            memorial_data = validation.validate_archive_create(dict(memorial_payload))
            memorial = _insert_validated_archive(conn, memorial_data, owner_user_id)
            linked_decision = dict(decision_payload)
            linked_decision["related_archive_ids"] = [memorial.id]
            decision_data = validation.validate_archive_create(linked_decision)
            decision = _insert_validated_archive(conn, decision_data, owner_user_id)
            conn.commit()
            return memorial, decision
        except (ArchiveValidationError, ArchiveNotFoundError):
            conn.rollback()
            raise
        except sqlite3.Error as exc:
            conn.rollback()
            raise ShiguanStorageError("史馆写入失败，请稍后再试") from exc
    finally:
        conn.close()


def get_archive(
    archive_id: str, *, owner_user_id: str, db_path: Path | None = None
) -> Archive:
    """Fetch a single archive by id.

    Raises:
        ArchiveNotFoundError: No archive with ``archive_id`` exists.
        ShiguanStorageError: The sqlite read itself failed.
    """

    conn = db.get_connection(db_path)
    try:
        try:
            row = conn.execute(
                "SELECT * FROM archives WHERE id = ? AND owner_user_id = ?",
                (archive_id, owner_user_id),
            ).fetchone()
        except sqlite3.Error as exc:
            raise ShiguanStorageError("史馆查询失败，请稍后再试") from exc
        if row is None:
            raise ArchiveNotFoundError(f"档案不存在: {archive_id}")
        try:
            return _build_archive(conn, row, owner_user_id)
        except sqlite3.Error as exc:
            raise ShiguanStorageError("史馆查询失败，请稍后再试") from exc
    finally:
        conn.close()


def list_archives(
    type: ArchiveType | None = None,
    matter_type: str | None = None,
    department: str | None = None,
    limit: int = 100,
    *,
    owner_user_id: str,
    db_path: Path | None = None,
) -> list[Archive]:
    """List archives, optionally filtered, with a deterministic ordering.

    Ordering is ``created_at DESC, id ASC`` -- newest first, ties broken by
    id for a fully deterministic order. An empty list is a valid result
    (no matching archives).

    Raises:
        ArchiveValidationError: ``limit`` is not a positive integer.
        ShiguanStorageError: The sqlite read itself failed.
    """

    if not isinstance(limit, int) or isinstance(limit, bool) or limit <= 0:
        raise ArchiveValidationError("limit 必须为正整数")

    conditions: list[str] = ["owner_user_id = ?"]
    params: list[object] = [owner_user_id]
    if type is not None:
        conditions.append("type = ?")
        params.append(type)
    if matter_type is not None:
        conditions.append("matter_type = ?")
        params.append(matter_type)
    if department is not None:
        conditions.append(
            "(department = ? OR EXISTS ("
            "SELECT 1 FROM json_each(archives.participating_departments) "
            "WHERE json_each.value = ?))"
        )
        params.extend((department, department))

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    query = f"SELECT * FROM archives {where_clause} ORDER BY created_at DESC, id ASC LIMIT ?"
    params.append(limit)

    conn = db.get_connection(db_path)
    try:
        try:
            rows = conn.execute(query, params).fetchall()
        except sqlite3.Error as exc:
            raise ShiguanStorageError("史馆查询失败，请稍后再试") from exc
        try:
            return [_build_archive(conn, row, owner_user_id) for row in rows]
        except sqlite3.Error as exc:
            raise ShiguanStorageError("史馆查询失败，请稍后再试") from exc
    finally:
        conn.close()


def upsert_review_status(
    archive_id: str,
    status: str,
    reviewed_at: str,
    note: str | None = None,
    *,
    owner_user_id: str,
    db_path: Path | None = None,
) -> ReviewStatus:
    """Set (or replace) an archive's review/复盘 status.

    Repeated calls for the same ``archive_id`` only keep the latest status
    -- no history rows accumulate and no duplicate archive is created.

    Raises:
        ArchiveNotFoundError: No archive with ``archive_id`` exists.
        ArchiveValidationError: ``status``/``reviewed_at``/``note`` fail
            structural validation.
        ShiguanStorageError: The sqlite write itself failed.
    """

    conn = db.get_connection(db_path)
    try:
        try:
            exists = conn.execute(
                "SELECT 1 FROM archives WHERE id = ? AND owner_user_id = ?",
                (archive_id, owner_user_id),
            ).fetchone()
        except sqlite3.Error as exc:
            raise ShiguanStorageError("史馆查询失败，请稍后再试") from exc
        if exists is None:
            raise ArchiveNotFoundError(f"档案不存在: {archive_id}")

        validated = validation.validate_review_status_update(
            {"status": status, "reviewed_at": reviewed_at, "note": note}
        )

        try:
            conn.execute(
                """
                INSERT INTO archive_review_status (archive_id, status, reviewed_at, note)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(archive_id) DO UPDATE SET
                    status = excluded.status,
                    reviewed_at = excluded.reviewed_at,
                    note = excluded.note
                """,
                (archive_id, validated.status, validated.reviewed_at, validated.note),
            )
            conn.commit()
        except sqlite3.Error as exc:
            conn.rollback()
            raise ShiguanStorageError("史馆写入失败，请稍后再试") from exc

        return validated
    finally:
        conn.close()


def get_statistics(*, owner_user_id: str, db_path: Path | None = None) -> Statistics:
    """Compute archive counters and the achievement success rate.

    ``success_rate`` is ``achieved / (achieved + not_achieved + partial)``;
    ``OBSERVING`` and archives with no review status at all are excluded
    from both numerator and denominator. When the denominator is zero,
    ``success_rate`` is ``None`` (never ``0``/``0.0``).

    Raises:
        ShiguanStorageError: The sqlite read itself failed.
    """

    conn = db.get_connection(db_path)
    try:
        try:
            total = conn.execute(
                "SELECT COUNT(*) FROM archives WHERE owner_user_id = ?", (owner_user_id,)
            ).fetchone()[0]
            status_rows = conn.execute(
                "SELECT review.status, COUNT(*) AS n FROM archive_review_status AS review "
                "JOIN archives ON archives.id = review.archive_id "
                "WHERE archives.owner_user_id = ? GROUP BY review.status",
                (owner_user_id,),
            ).fetchall()
            reviewed_total = conn.execute(
                "SELECT COUNT(*) FROM archive_review_status AS review "
                "JOIN archives ON archives.id = review.archive_id "
                "WHERE archives.owner_user_id = ?",
                (owner_user_id,),
            ).fetchone()[0]
        except sqlite3.Error as exc:
            raise ShiguanStorageError("史馆统计查询失败，请稍后再试") from exc

        counts = {"ACHIEVED": 0, "NOT_ACHIEVED": 0, "PARTIAL": 0, "OBSERVING": 0}
        for row in status_rows:
            counts[row["status"]] = row["n"]

        pending_review = total - reviewed_total
        denominator = counts["ACHIEVED"] + counts["NOT_ACHIEVED"] + counts["PARTIAL"]
        success_rate = (counts["ACHIEVED"] / denominator) if denominator > 0 else None

        return Statistics(
            total=total,
            achieved=counts["ACHIEVED"],
            not_achieved=counts["NOT_ACHIEVED"],
            partial=counts["PARTIAL"],
            observing=counts["OBSERVING"],
            pending_review=pending_review,
            success_rate=success_rate,
        )
    finally:
        conn.close()
