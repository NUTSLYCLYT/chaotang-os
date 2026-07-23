"""CRUD, review-status and statistics operations for 史馆 archives.

Pure functions/no FastAPI dependency: this module only imports
``sqlite3``, ``app.shiguan.db``, ``app.shiguan.validation`` and
``app.shiguan.models``. Every function opens its own short-lived
connection via ``db.get_connection()`` and closes it before returning
(``try``/``finally``), so callers never need to manage connection
lifecycle themselves.
"""

from __future__ import annotations

import hashlib
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
    ShiguanWriteNotCommittedError,
)
from app.shiguan.models import (
    Archive,
    ArchiveCreate,
    ArchiveEvidenceReference,
    ArchiveEvidenceReferenceCreate,
    ArchiveEvidenceSnapshot,
    ArchiveType,
    Evidence,
    ReviewStatus,
    Statistics,
    _snapshot_json,
)

_ARCHIVE_COLUMNS = (
    "id, type, title, content, matter_type, department, created_at, "
    "lessons_learned, pitfalls, source_kind, source_text, participating_departments, "
    "reply_process, reply_conclusion, reply_time, respondent"
)


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _insert_validated_archive(
    conn: sqlite3.Connection,
    validated: ArchiveCreate,
    *,
    archive_id: str | None = None,
) -> Archive:
    """Insert one validated archive into the caller-owned transaction."""
    validation.validate_related_archive_ids(conn, validated.related_archive_ids)
    validation.validate_reply_source(conn, validated)
    archive_id = archive_id or uuid.uuid4().hex
    created_at = _now_iso()
    conn.execute(
        f"INSERT INTO archives ({_ARCHIVE_COLUMNS}) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
            validated.source_kind,
            validated.source_text,
            json.dumps(validated.participating_departments, ensure_ascii=False)
            if validated.participating_departments is not None
            else None,
            validated.reply_process,
            validated.reply_conclusion,
            validated.reply_time,
            validated.respondent,
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
    return _build_archive(conn, row)


def _build_archive(conn: sqlite3.Connection, row: sqlite3.Row) -> Archive:
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
        "SELECT related_id FROM archive_relations WHERE archive_id = ? ORDER BY seq ASC",
        (archive_id,),
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

    reference_rows = conn.execute(
        "SELECT ordinal, evidence_id, pack_id, investigation_id, "
        "snapshot_json, snapshot_hash FROM archive_evidence_references "
        "WHERE archive_id = ? ORDER BY ordinal ASC",
        (archive_id,),
    ).fetchall()
    evidence_references: list[ArchiveEvidenceReference] = []
    for reference_row in reference_rows:
        snapshot_json = reference_row["snapshot_json"]
        expected_hash = hashlib.sha256(snapshot_json.encode()).hexdigest()
        if expected_hash != reference_row["snapshot_hash"]:
            raise ShiguanStorageError("史馆证据快照校验失败")
        try:
            snapshot = ArchiveEvidenceSnapshot.model_validate_json(snapshot_json)
            evidence_references.append(
                ArchiveEvidenceReference(
                    ordinal=reference_row["ordinal"],
                    evidence_id=reference_row["evidence_id"],
                    pack_id=reference_row["pack_id"],
                    investigation_id=reference_row["investigation_id"],
                    snapshot=snapshot,
                    snapshot_hash=reference_row["snapshot_hash"],
                )
            )
        except Exception as exc:
            raise ShiguanStorageError("史馆证据快照校验失败") from exc

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
        source_kind=row["source_kind"],
        source_text=row["source_text"],
        participating_departments=participating_departments,
        reply_process=row["reply_process"],
        reply_conclusion=row["reply_conclusion"],
        reply_time=row["reply_time"],
        respondent=row["respondent"],
        review_status=review_status,
        evidence_references=evidence_references,
    )


def _canonical_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def _canonical_payload(payload: ArchiveCreate) -> str:
    return _canonical_json(payload.model_dump(mode="json"))


def _canonical_reference_input(reference: ArchiveEvidenceReferenceCreate) -> str:
    return _canonical_json(reference.model_dump(mode="json"))


def _payload_from_archive(archive: Archive) -> ArchiveCreate:
    return ArchiveCreate.model_validate(
        archive.model_dump(
            mode="json",
            exclude={"id", "created_at", "review_status", "evidence_references"},
        )
    )


def create_reply_with_evidence(
    payload: dict | ArchiveCreate,
    refs: list[ArchiveEvidenceReferenceCreate] | tuple[ArchiveEvidenceReferenceCreate, ...],
    *,
    reply_id: str,
    db_path: Path | None = None,
) -> Archive:
    """Atomically create one server-identified REPLY and trusted citations."""

    if not isinstance(reply_id, str) or not reply_id.strip():
        raise ArchiveValidationError("reply_id 不能为空")
    payload_dict = payload.model_dump() if isinstance(payload, ArchiveCreate) else dict(payload)
    validated = validation.validate_archive_create(payload_dict)
    if validated.type != "REPLY":
        raise ArchiveValidationError("只有 REPLY 可以关联锦衣卫证据")
    try:
        validated_refs = tuple(
            reference
            if isinstance(reference, ArchiveEvidenceReferenceCreate)
            else ArchiveEvidenceReferenceCreate.model_validate(reference)
            for reference in refs
        )
    except Exception as exc:
        raise ArchiveValidationError("锦衣卫证据引用无效") from exc
    evidence_ids = [reference.snapshot.evidence_id for reference in validated_refs]
    if len(evidence_ids) != len(set(evidence_ids)):
        raise ArchiveValidationError("同一回奏不能重复引用证据")

    conn = db.get_connection(db_path)
    commit_started = False
    try:
        conn.execute("BEGIN IMMEDIATE")
        existing_row = conn.execute(
            "SELECT * FROM archives WHERE id = ?", (reply_id.strip(),)
        ).fetchone()
        if existing_row is not None:
            existing = _build_archive(conn, existing_row)
            existing_refs = tuple(
                ArchiveEvidenceReferenceCreate(
                    pack_id=reference.pack_id,
                    investigation_id=reference.investigation_id,
                    snapshot=reference.snapshot,
                )
                for reference in existing.evidence_references
            )
            same_payload = _canonical_payload(
                _payload_from_archive(existing)
            ) == _canonical_payload(validated)
            same_refs = tuple(map(_canonical_reference_input, existing_refs)) == tuple(
                map(_canonical_reference_input, validated_refs)
            )
            if not same_payload or not same_refs:
                raise ShiguanWriteNotCommittedError("史馆回奏不可变冲突")
            commit_started = True
            conn.commit()
            return existing

        archive = _insert_validated_archive(
            conn, validated, archive_id=reply_id.strip()
        )
        for ordinal, reference in enumerate(validated_refs):
            snapshot_json = _snapshot_json(reference.snapshot)
            snapshot_hash = hashlib.sha256(snapshot_json.encode()).hexdigest()
            prior_rows = conn.execute(
                "SELECT snapshot_json, snapshot_hash "
                "FROM archive_evidence_references WHERE evidence_id = ?",
                (reference.snapshot.evidence_id,),
            ).fetchall()
            if any(
                prior_row["snapshot_hash"] != snapshot_hash
                or prior_row["snapshot_json"] != snapshot_json
                for prior_row in prior_rows
            ):
                raise ShiguanWriteNotCommittedError(
                    "史馆证据 ID 存在不可变内容冲突"
                )
            conn.execute(
                "INSERT INTO archive_evidence_references "
                "(archive_id, ordinal, evidence_id, pack_id, investigation_id, "
                "snapshot_json, snapshot_hash) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (
                    reply_id.strip(),
                    ordinal,
                    reference.snapshot.evidence_id,
                    reference.pack_id,
                    reference.investigation_id,
                    snapshot_json,
                    snapshot_hash,
                ),
            )
        row = conn.execute("SELECT * FROM archives WHERE id = ?", (reply_id.strip(),)).fetchone()
        archive = _build_archive(conn, row)
        commit_started = True
        conn.commit()
        return archive
    except (ArchiveValidationError, ShiguanStorageError):
        conn.rollback()
        raise
    except sqlite3.Error as exc:
        conn.rollback()
        error_type = (
            ShiguanStorageError
            if commit_started
            else ShiguanWriteNotCommittedError
        )
        raise error_type("史馆回奏与证据写入失败，请稍后再试") from exc
    finally:
        conn.close()


def create_archive(payload: dict | ArchiveCreate, *, db_path: Path | None = None) -> Archive:
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
            archive = _insert_validated_archive(conn, validated)
            conn.commit()
        except sqlite3.Error as exc:
            conn.rollback()
            raise ShiguanStorageError("史馆写入失败，请稍后再试") from exc

        return archive
    finally:
        conn.close()


def get_archive(archive_id: str, *, db_path: Path | None = None) -> Archive:
    """Fetch a single archive by id.

    Raises:
        ArchiveNotFoundError: No archive with ``archive_id`` exists.
        ShiguanStorageError: The sqlite read itself failed.
    """

    conn = db.get_connection(db_path)
    try:
        try:
            row = conn.execute("SELECT * FROM archives WHERE id = ?", (archive_id,)).fetchone()
        except sqlite3.Error as exc:
            raise ShiguanStorageError("史馆查询失败，请稍后再试") from exc
        if row is None:
            raise ArchiveNotFoundError(f"档案不存在: {archive_id}")
        try:
            return _build_archive(conn, row)
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

    conditions: list[str] = []
    params: list[object] = []
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
            return [_build_archive(conn, row) for row in rows]
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
            exists = conn.execute("SELECT 1 FROM archives WHERE id = ?", (archive_id,)).fetchone()
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


def get_statistics(*, db_path: Path | None = None) -> Statistics:
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
            total = conn.execute("SELECT COUNT(*) FROM archives").fetchone()[0]
            status_rows = conn.execute(
                "SELECT status, COUNT(*) AS n FROM archive_review_status GROUP BY status"
            ).fetchall()
            reviewed_total = conn.execute(
                "SELECT COUNT(*) FROM archive_review_status"
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
