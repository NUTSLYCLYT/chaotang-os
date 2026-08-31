"""CRUD, review-status and statistics operations for 史馆 archives.

Pure functions/no FastAPI dependency: this module only imports
``sqlite3``, ``app.shiguan.db``, ``app.shiguan.validation`` and
``app.shiguan.models``. Every function opens its own short-lived
connection via ``db.get_connection()`` and closes it before returning
(``try``/``finally``), so callers never need to manage connection
lifecycle themselves.
"""

from __future__ import annotations

import base64
import hashlib
import json
import sqlite3
import uuid
from datetime import UTC, datetime
from pathlib import Path

from app.auth.models import AuthenticatedPrincipal
from app.shiguan import db, validation
from app.shiguan.errors import (
    ArchiveDecisionConflictError,
    ArchiveNotFoundError,
    ArchiveValidationError,
    ShiguanStorageError,
    ShiguanWriteNotCommittedError,
)
from app.shiguan.models import (
    Archive,
    ArchiveCreate,
    ArchiveDecision,
    ArchiveEvidenceReference,
    ArchiveEvidenceReferenceCreate,
    ArchiveEvidenceSnapshot,
    ArchiveType,
    DadianOverview,
    DepartmentCount,
    Evidence,
    OutcomeCreate,
    OutcomeEvent,
    OutcomePage,
    OutcomeProjection,
    RecentReply,
    ReviewStatus,
    Statistics,
    _snapshot_json,
)

_ARCHIVE_COLUMNS = (
    "id, type, title, content, matter_type, department, created_at, "
    "lessons_learned, pitfalls, source_kind, source_text, participating_departments, "
    "reply_process, reply_conclusion, reply_time, respondent, owner_user_id"
)

_SYSTEM_OWNER_ID = "__system__"


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _insert_validated_archive(
    conn: sqlite3.Connection,
    validated: ArchiveCreate,
    *,
    owner_user_id: str,
    archive_id: str | None = None,
) -> Archive:
    """Insert one validated archive into the caller-owned transaction."""
    validation.validate_related_archive_ids(
        conn, validated.related_archive_ids, owner_user_id=owner_user_id
    )
    validation.validate_reply_source(
        conn, validated, owner_user_id=owner_user_id
    )
    archive_id = archive_id or uuid.uuid4().hex
    created_at = _now_iso()
    conn.execute(
        f"INSERT INTO archives ({_ARCHIVE_COLUMNS}) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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


def insert_archive_in_transaction(
    conn: sqlite3.Connection,
    payload: dict | ArchiveCreate,
    *,
    owner_user_id: str,
    archive_id: str | None = None,
) -> Archive:
    """Validate and insert an archive without ending the caller's transaction."""

    payload_dict = payload.model_dump() if isinstance(payload, ArchiveCreate) else dict(payload)
    validated = validation.validate_archive_create(payload_dict)
    return _insert_validated_archive(
        conn,
        validated,
        owner_user_id=owner_user_id,
        archive_id=archive_id,
    )


def _build_archive(conn: sqlite3.Connection, row: sqlite3.Row, owner_user_id: str) -> Archive:
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

    decision_row = conn.execute(
        "SELECT decision, decided_at FROM archive_decisions "
        "WHERE archive_id = ? AND owner_user_id = ?",
        (archive_id, owner_user_id),
    ).fetchone()
    decision_status = (
        ArchiveDecision(
            decision=decision_row["decision"],
            decided_at=decision_row["decided_at"],
        )
        if decision_row is not None
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
        decision_status=decision_status,
        evidence_references=evidence_references,
    )


def _canonical_json(value: object) -> str:
    return json.dumps(
        value,
        allow_nan=False,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def _canonical_payload(payload: ArchiveCreate) -> str:
    return _canonical_json(payload.model_dump(mode="json"))


def _canonical_reference_input(reference: ArchiveEvidenceReferenceCreate) -> str:
    return _canonical_json(reference.model_dump(mode="json"))


def _payload_from_archive(archive: Archive) -> ArchiveCreate:
    return ArchiveCreate.model_validate(
        archive.model_dump(
            mode="json",
            exclude={
                "id",
                "created_at",
                "review_status",
                "decision_status",
                "evidence_references",
            },
        )
    )


def create_reply_with_evidence(
    payload: dict | ArchiveCreate,
    refs: list[ArchiveEvidenceReferenceCreate] | tuple[ArchiveEvidenceReferenceCreate, ...],
    *,
    reply_id: str,
    owner_user_id: str = _SYSTEM_OWNER_ID,
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
            "SELECT * FROM archives WHERE id = ? AND owner_user_id = ?",
            (reply_id.strip(), owner_user_id),
        ).fetchone()
        if existing_row is not None:
            existing = _build_archive(conn, existing_row, owner_user_id)
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
            conn,
            validated,
            owner_user_id=owner_user_id,
            archive_id=reply_id.strip(),
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
        row = conn.execute(
            "SELECT * FROM archives WHERE id = ? AND owner_user_id = ?",
            (reply_id.strip(), owner_user_id),
        ).fetchone()
        archive = _build_archive(conn, row, owner_user_id)
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


def create_archive(
    payload: dict | ArchiveCreate,
    *,
    owner_user_id: str = _SYSTEM_OWNER_ID,
    db_path: Path | None = None,
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
            archive = _insert_validated_archive(
                conn, validated, owner_user_id=owner_user_id
            )
            conn.commit()
        except sqlite3.Error as exc:
            conn.rollback()
            raise ShiguanStorageError("史馆写入失败，请稍后再试") from exc

        return archive
    finally:
        conn.close()


def get_archive(
    archive_id: str,
    *,
    owner_user_id: str = _SYSTEM_OWNER_ID,
    db_path: Path | None = None,
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


_DECISIONS_BY_ARCHIVE_TYPE = {
    "MEMORIAL": frozenset({"APPROVED", "REJECTED"}),
    "REPLY": frozenset({"ADOPTED", "RETURNED_FOR_RECONSIDERATION"}),
}


def set_archive_decision(
    archive_id: str,
    decision: str,
    *,
    owner_user_id: str = _SYSTEM_OWNER_ID,
    db_path: Path | None = None,
) -> ArchiveDecision:
    """Record one immutable terminal decision for an owner-scoped archive."""

    valid_decisions = frozenset().union(*_DECISIONS_BY_ARCHIVE_TYPE.values())
    if decision not in valid_decisions:
        raise ArchiveValidationError("档案决定无效")

    conn = db.get_connection(db_path)
    try:
        try:
            conn.execute("BEGIN IMMEDIATE")
            archive_row = conn.execute(
                "SELECT type FROM archives WHERE id = ? AND owner_user_id = ?",
                (archive_id, owner_user_id),
            ).fetchone()
            if archive_row is None:
                raise ArchiveNotFoundError(f"档案不存在: {archive_id}")
            if decision not in _DECISIONS_BY_ARCHIVE_TYPE[archive_row["type"]]:
                raise ArchiveValidationError("档案类型与决定不匹配")

            existing = conn.execute(
                "SELECT decision, decided_at FROM archive_decisions "
                "WHERE archive_id = ? AND owner_user_id = ?",
                (archive_id, owner_user_id),
            ).fetchone()
            if existing is not None:
                if existing["decision"] != decision:
                    raise ArchiveDecisionConflictError("档案已有不同的最终决定")
                result = ArchiveDecision(
                    decision=existing["decision"], decided_at=existing["decided_at"]
                )
                conn.commit()
                return result

            decided_at = _now_iso()
            conn.execute(
                "INSERT INTO archive_decisions "
                "(archive_id, owner_user_id, actor_user_id, decision, decided_at) "
                "VALUES (?, ?, ?, ?, ?)",
                (archive_id, owner_user_id, owner_user_id, decision, decided_at),
            )
            result = ArchiveDecision(decision=decision, decided_at=decided_at)
            conn.commit()
            return result
        except (ArchiveNotFoundError, ArchiveValidationError, ArchiveDecisionConflictError):
            conn.rollback()
            raise
        except sqlite3.Error as exc:
            conn.rollback()
            raise ShiguanStorageError("史馆决定写入失败，请稍后再试") from exc
    finally:
        conn.close()


def list_archives(
    type: ArchiveType | None = None,
    matter_type: str | None = None,
    department: str | None = None,
    limit: int = 100,
    *,
    owner_user_id: str = _SYSTEM_OWNER_ID,
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
    owner_user_id: str = _SYSTEM_OWNER_ID,
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


_OUTCOME_NOT_FOUND = "authenticated outcome not found"
_OUTCOME_UNAVAILABLE = "authenticated outcome is unavailable"


def _canonical_digest(value: object) -> str:
    return f"sha256:{hashlib.sha256(_canonical_json(value).encode('utf-8')).hexdigest()}"


def _outcome_time_iso(value: datetime) -> str:
    return value.astimezone(UTC).isoformat(timespec="microseconds").replace(
        "+00:00", "Z"
    )


def _require_active_principal(
    connection: sqlite3.Connection,
    principal: AuthenticatedPrincipal,
    *,
    session_id: str,
    authorized_at: datetime,
) -> None:
    row = connection.execute(
        "SELECT sessions.expires_at FROM auth_sessions AS sessions "
        "JOIN tenant_memberships AS memberships "
        "ON memberships.id=sessions.membership_id "
        "AND memberships.user_id=sessions.user_id "
        "JOIN tenants AS tenants ON tenants.id=memberships.tenant_id "
        "WHERE sessions.id=? AND sessions.user_id=? "
        "AND sessions.membership_id=? AND sessions.revoked_at IS NULL "
        "AND memberships.tenant_id=? AND memberships.role='OWNER' "
        "AND memberships.revoked_at IS NULL AND tenants.kind='PERSONAL'",
        (session_id, principal.id, principal.membership_id, principal.tenant_id),
    ).fetchone()
    if row is None:
        raise ArchiveNotFoundError(_OUTCOME_NOT_FOUND)
    try:
        expires_at = datetime.fromisoformat(str(row["expires_at"]).replace("Z", "+00:00"))
        if expires_at.tzinfo is None or expires_at.utcoffset() is None:
            raise ValueError("session expiry must be timezone-aware")
    except (TypeError, ValueError):
        raise ArchiveNotFoundError(_OUTCOME_NOT_FOUND) from None
    if expires_at.astimezone(UTC) <= authorized_at.astimezone(UTC):
        raise ArchiveNotFoundError(_OUTCOME_NOT_FOUND)


def _outcome_source_digests(
    connection: sqlite3.Connection,
    archive_id: str,
    principal: AuthenticatedPrincipal,
) -> tuple[str, str, str, int, str]:
    archive_row = connection.execute(
        "SELECT * FROM archives WHERE id=? AND owner_user_id=? AND type='REPLY'",
        (archive_id, principal.id),
    ).fetchone()
    if archive_row is None:
        raise ArchiveNotFoundError(_OUTCOME_NOT_FOUND)
    decision_row = connection.execute(
        "SELECT owner_user_id,actor_user_id,decision,decided_at "
        "FROM archive_decisions WHERE archive_id=? AND owner_user_id=?",
        (archive_id, principal.id),
    ).fetchone()
    if decision_row is None or decision_row["decision"] != "ADOPTED":
        raise ArchiveDecisionConflictError("archive is not adopted for outcome")

    archive = _build_archive(connection, archive_row, principal.id)
    archive_digest = _canonical_digest(
        {
            "archiveCreate": _payload_from_archive(archive).model_dump(mode="json"),
            "archiveId": archive.id,
            "createdAt": archive.created_at,
            "ownerUserId": principal.id,
        }
    )
    decision_digest = _canonical_digest(
        {
            "actorUserId": decision_row["actor_user_id"],
            "archiveId": archive.id,
            "decidedAt": decision_row["decided_at"],
            "decision": decision_row["decision"],
            "ownerUserId": decision_row["owner_user_id"],
        }
    )
    reference_rows = connection.execute(
        "SELECT ordinal,evidence_id,pack_id,investigation_id,snapshot_json,snapshot_hash "
        "FROM archive_evidence_references WHERE archive_id=? ORDER BY ordinal ASC",
        (archive_id,),
    ).fetchall()
    if not reference_rows or [row["ordinal"] for row in reference_rows] != list(
        range(len(reference_rows))
    ):
        raise ArchiveDecisionConflictError("archive outcome evidence is incomplete")
    evidence_contract: list[dict[str, object]] = []
    for row in reference_rows:
        expected_hash = hashlib.sha256(row["snapshot_json"].encode("utf-8")).hexdigest()
        if expected_hash != row["snapshot_hash"]:
            raise ShiguanStorageError(_OUTCOME_UNAVAILABLE)
        try:
            ArchiveEvidenceSnapshot.model_validate_json(row["snapshot_json"])
        except Exception as exc:
            raise ShiguanStorageError(_OUTCOME_UNAVAILABLE) from exc
        evidence_contract.append(
            {
                "evidenceId": row["evidence_id"],
                "investigationId": row["investigation_id"],
                "ordinal": row["ordinal"],
                "packId": row["pack_id"],
                "snapshotHash": row["snapshot_hash"],
            }
        )
    return (
        archive_digest,
        decision_digest,
        _canonical_digest(evidence_contract),
        len(reference_rows),
        decision_row["decided_at"],
    )


def _event_digest_payload(event: OutcomeEvent) -> dict[str, object]:
    return event.model_dump(mode="json", exclude={"event_digest"})


def _outcome_request_digest(
    *,
    archive_id: str,
    outcome: str,
    occurred_at: str,
    idempotency_key: str,
    supersedes_event_id: str | None,
) -> str:
    return _canonical_digest(
        {
            "archiveId": archive_id,
            "idempotencyKey": idempotency_key,
            "occurredAt": occurred_at,
            "outcome": outcome,
            "supersedesEventId": supersedes_event_id,
        }
    )


def _outcome_event_from_row(row: sqlite3.Row) -> OutcomeEvent:
    try:
        return OutcomeEvent.model_validate(dict(row))
    except Exception as exc:
        raise ShiguanStorageError(_OUTCOME_UNAVAILABLE) from exc


def _validate_outcome_event(
    connection: sqlite3.Connection,
    event: OutcomeEvent,
    principal: AuthenticatedPrincipal,
) -> OutcomeEvent:
    if event.request_digest != _outcome_request_digest(
        archive_id=event.archive_id,
        outcome=event.outcome,
        occurred_at=event.occurred_at,
        idempotency_key=event.idempotency_key,
        supersedes_event_id=event.supersedes_event_id,
    ):
        raise ShiguanStorageError(_OUTCOME_UNAVAILABLE)
    if event.event_digest != _canonical_digest(_event_digest_payload(event)):
        raise ShiguanStorageError(_OUTCOME_UNAVAILABLE)
    current = _outcome_source_digests(connection, event.archive_id, principal)
    if (
        event.archive_digest,
        event.decision_digest,
        event.evidence_bundle_digest,
        event.evidence_count,
    ) != current[:4]:
        raise ShiguanStorageError(_OUTCOME_UNAVAILABLE)
    return event


def project_outcome(event: OutcomeEvent) -> OutcomeProjection:
    """Return the only redacted Outcome shape permitted at an API boundary."""

    return OutcomeProjection.model_validate(
        event.model_dump(
            mode="json",
            include={
                "event_id",
                "archive_id",
                "event_kind",
                "outcome",
                "source_type",
                "source_auth_level",
                "occurred_at",
                "recorded_at",
                "archive_digest",
                "decision_digest",
                "evidence_bundle_digest",
                "evidence_count",
                "supersedes_event_id",
                "event_digest",
            },
        )
    )


def create_outcome(
    archive_id: str,
    payload: dict | OutcomeCreate,
    *,
    principal: AuthenticatedPrincipal,
    session_id: str,
    db_path: Path | None = None,
) -> OutcomeEvent:
    """Append one authenticated Owner assertion after full source revalidation."""

    try:
        request = (
            payload
            if isinstance(payload, OutcomeCreate)
            else OutcomeCreate.model_validate(payload)
        )
    except Exception as exc:
        raise ArchiveValidationError("authenticated outcome request is invalid") from exc
    connection = db.get_connection(db_path)
    try:
        try:
            connection.execute("BEGIN IMMEDIATE")
            transaction_time = datetime.now(UTC)
            _require_active_principal(
                connection,
                principal,
                session_id=session_id,
                authorized_at=transaction_time,
            )
            request_digest = _outcome_request_digest(
                archive_id=archive_id,
                outcome=request.outcome,
                occurred_at=request.occurred_at,
                idempotency_key=request.idempotency_key,
                supersedes_event_id=request.supersedes_event_id,
            )
            existing_row = connection.execute(
                "SELECT * FROM outcome_events WHERE tenant_id=? AND owner_user_id=? "
                "AND membership_id=? AND idempotency_key=?",
                (
                    principal.tenant_id,
                    principal.id,
                    principal.membership_id,
                    request.idempotency_key,
                ),
            ).fetchone()
            if existing_row is not None:
                existing = _validate_outcome_event(
                    connection,
                    _outcome_event_from_row(existing_row),
                    principal,
                )
                if existing.request_digest != request_digest:
                    raise ArchiveDecisionConflictError(
                        "idempotency key already binds another outcome"
                    )
                connection.commit()
                return existing

            snapshots = _outcome_source_digests(connection, archive_id, principal)
            recorded_at = _outcome_time_iso(transaction_time)
            if not (
                datetime.fromisoformat(snapshots[4].replace("Z", "+00:00"))
                <= datetime.fromisoformat(request.occurred_at.replace("Z", "+00:00"))
                <= datetime.fromisoformat(recorded_at.replace("Z", "+00:00"))
            ):
                raise ArchiveValidationError("occurred_at is outside the outcome window")

            event_kind = "RECORDED"
            if request.supersedes_event_id is not None:
                prior_row = connection.execute(
                    "SELECT * FROM outcome_events WHERE event_id=? AND tenant_id=? "
                    "AND owner_user_id=? AND membership_id=? AND archive_id=?",
                    (
                        request.supersedes_event_id,
                        principal.tenant_id,
                        principal.id,
                        principal.membership_id,
                        archive_id,
                    ),
                ).fetchone()
                if prior_row is None:
                    raise ArchiveNotFoundError(_OUTCOME_NOT_FOUND)
                prior = _validate_outcome_event(
                    connection, _outcome_event_from_row(prior_row), principal
                )
                successor = connection.execute(
                    "SELECT 1 FROM outcome_events WHERE supersedes_event_id=?",
                    (prior.event_id,),
                ).fetchone()
                if successor is not None:
                    raise ArchiveDecisionConflictError("outcome correction target is not head")
                if (
                    prior.archive_digest,
                    prior.decision_digest,
                    prior.evidence_bundle_digest,
                    prior.evidence_count,
                ) != snapshots[:4]:
                    raise ShiguanStorageError(_OUTCOME_UNAVAILABLE)
                event_kind = "CORRECTED"

            event = OutcomeEvent(
                event_id=uuid.uuid4().hex,
                tenant_id=principal.tenant_id,
                owner_user_id=principal.id,
                membership_id=principal.membership_id,
                actor_user_id=principal.id,
                archive_id=archive_id,
                event_kind=event_kind,
                outcome=request.outcome,
                source_type="OWNER_ATTESTATION",
                source_auth_level="AUTHENTICATED_OWNER_ASSERTION",
                occurred_at=request.occurred_at,
                recorded_at=recorded_at,
                idempotency_key=request.idempotency_key,
                request_digest=request_digest,
                archive_digest=snapshots[0],
                decision_digest=snapshots[1],
                evidence_bundle_digest=snapshots[2],
                evidence_count=snapshots[3],
                supersedes_event_id=request.supersedes_event_id,
                event_digest="sha256:" + "0" * 64,
            )
            event = event.model_copy(
                update={"event_digest": _canonical_digest(_event_digest_payload(event))}
            )
            connection.execute(
                "INSERT INTO outcome_events VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                tuple(event.model_dump(mode="python").values()),
            )
            persisted = _outcome_event_from_row(
                connection.execute(
                    "SELECT * FROM outcome_events WHERE event_id=?", (event.event_id,)
                ).fetchone()
            )
            _validate_outcome_event(connection, persisted, principal)
            connection.commit()
            return persisted
        except (
            ArchiveNotFoundError,
            ArchiveValidationError,
            ArchiveDecisionConflictError,
            ShiguanStorageError,
        ):
            connection.rollback()
            raise
        except sqlite3.IntegrityError as exc:
            connection.rollback()
            raise ArchiveDecisionConflictError("outcome append conflict") from exc
        except (sqlite3.Error, ValueError, TypeError) as exc:
            connection.rollback()
            raise ShiguanStorageError(_OUTCOME_UNAVAILABLE) from exc
    finally:
        connection.close()


def _encode_outcome_cursor(recorded_at: str, event_id: str) -> str:
    raw = _canonical_json([recorded_at, event_id]).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _decode_outcome_cursor(cursor: str) -> tuple[str, str]:
    if not isinstance(cursor, str) or not (1 <= len(cursor) <= 256):
        raise ArchiveValidationError("outcome cursor is invalid")
    alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
    if any(character not in alphabet for character in cursor):
        raise ArchiveValidationError("outcome cursor is invalid")
    try:
        raw = base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4))
        value = json.loads(raw.decode("utf-8"))
        if (
            not isinstance(value, list)
            or len(value) != 2
            or not all(isinstance(item, str) for item in value)
            or len(value[1]) != 32
            or any(character not in "0123456789abcdef" for character in value[1])
            or _encode_outcome_cursor(value[0], value[1]) != cursor
        ):
            raise ValueError
        datetime.fromisoformat(value[0].replace("Z", "+00:00"))
    except (UnicodeDecodeError, ValueError, json.JSONDecodeError) as exc:
        raise ArchiveValidationError("outcome cursor is invalid") from exc
    return value[0], value[1]


def _list_outcomes(
    *,
    principal: AuthenticatedPrincipal,
    session_id: str,
    archive_id: str | None,
    limit: int,
    cursor: str | None,
    db_path: Path | None,
) -> OutcomePage:
    if not isinstance(limit, int) or isinstance(limit, bool) or not 1 <= limit <= 100:
        raise ArchiveValidationError("outcome limit is invalid")
    after = _decode_outcome_cursor(cursor) if cursor is not None else None
    connection = db.get_connection(db_path)
    try:
        try:
            connection.execute("BEGIN")
            _require_active_principal(
                connection,
                principal,
                session_id=session_id,
                authorized_at=datetime.now(UTC),
            )
            if archive_id is not None:
                _outcome_source_digests(connection, archive_id, principal)
            conditions = ["tenant_id=?", "owner_user_id=?", "membership_id=?"]
            params: list[object] = [
                principal.tenant_id,
                principal.id,
                principal.membership_id,
            ]
            if archive_id is not None:
                conditions.append("archive_id=?")
                params.append(archive_id)
            if after is not None:
                conditions.append("(recorded_at < ? OR (recorded_at = ? AND event_id > ?))")
                params.extend((after[0], after[0], after[1]))
            params.append(limit + 1)
            rows = connection.execute(
                "SELECT * FROM outcome_events WHERE "
                + " AND ".join(conditions)
                + " ORDER BY recorded_at DESC,event_id ASC LIMIT ?",
                params,
            ).fetchall()
            events = [
                _validate_outcome_event(
                    connection, _outcome_event_from_row(row), principal
                )
                for row in rows[:limit]
            ]
            next_cursor = None
            if len(rows) > limit and events:
                next_cursor = _encode_outcome_cursor(
                    events[-1].recorded_at, events[-1].event_id
                )
            connection.commit()
            return OutcomePage(
                items=[project_outcome(event) for event in events],
                next_cursor=next_cursor,
            )
        except (
            ArchiveNotFoundError,
            ArchiveValidationError,
            ArchiveDecisionConflictError,
            ShiguanStorageError,
        ):
            connection.rollback()
            raise
        except (sqlite3.Error, ValueError, TypeError) as exc:
            connection.rollback()
            raise ShiguanStorageError(_OUTCOME_UNAVAILABLE) from exc
    finally:
        connection.close()


def list_archive_outcomes(
    archive_id: str,
    *,
    principal: AuthenticatedPrincipal,
    session_id: str,
    limit: int = 50,
    cursor: str | None = None,
    db_path: Path | None = None,
) -> OutcomePage:
    return _list_outcomes(
        principal=principal,
        session_id=session_id,
        archive_id=archive_id,
        limit=limit,
        cursor=cursor,
        db_path=db_path,
    )


def list_outcomes(
    *,
    principal: AuthenticatedPrincipal,
    session_id: str,
    limit: int = 50,
    cursor: str | None = None,
    db_path: Path | None = None,
) -> OutcomePage:
    return _list_outcomes(
        principal=principal,
        session_id=session_id,
        archive_id=None,
        limit=limit,
        cursor=cursor,
        db_path=db_path,
    )


def get_statistics(
    *, owner_user_id: str = _SYSTEM_OWNER_ID, db_path: Path | None = None
) -> Statistics:
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


def get_dadian_overview(
    *,
    owner_user_id: str = _SYSTEM_OWNER_ID,
    department: str | None = None,
    db_path: Path | None = None,
) -> DadianOverview:
    """Read the owner-scoped, REPLY-only overview used by 大殿.

    Aggregates stay in SQLite so a browser never infers totals from a
    truncated archive list. A review row of any status means a reply is no
    longer pending review.
    """
    selected_department = department.strip() if department and department.strip() else None
    conditions = ["archives.owner_user_id = ?", "archives.type = 'REPLY'"]
    params: list[object] = [owner_user_id]
    if selected_department is not None:
        conditions.append(
            "EXISTS (SELECT 1 FROM json_each(archives.participating_departments) WHERE value = ?)"
        )
        params.append(selected_department)
    where_clause = " AND ".join(conditions)
    conn = db.get_connection(db_path)
    try:
        try:
            reply_count = conn.execute(
                f"SELECT COUNT(*) FROM archives WHERE {where_clause}", params
            ).fetchone()[0]
            pending_review_count = conn.execute(
                "SELECT COUNT(*) FROM archives LEFT JOIN archive_review_status AS review "
                "ON review.archive_id = archives.id "
                f"WHERE {where_clause} AND review.archive_id IS NULL",
                params,
            ).fetchone()[0]
            recent_rows = conn.execute(
                "SELECT id, title, participating_departments, reply_conclusion, reply_time, "
                "created_at, respondent "
                f"FROM archives WHERE {where_clause} ORDER BY created_at DESC, id ASC LIMIT 5",
                params,
            ).fetchall()
            department_rows = conn.execute(
                "SELECT json_each.value AS department, COUNT(*) AS count FROM archives "
                "CROSS JOIN json_each(archives.participating_departments) "
                "WHERE archives.owner_user_id = ? AND archives.type = 'REPLY' "
                "GROUP BY json_each.value ORDER BY count DESC, json_each.value ASC",
                (owner_user_id,),
            ).fetchall()
        except (sqlite3.Error, json.JSONDecodeError) as exc:
            raise ShiguanStorageError("史馆查询失败，请稍后再试") from exc

        recent_replies = [
            RecentReply(
                id=row["id"],
                title=row["title"],
                participating_departments=json.loads(row["participating_departments"]),
                reply_conclusion=row["reply_conclusion"],
                reply_time=row["reply_time"],
                created_at=row["created_at"],
                respondent=row["respondent"],
            )
            for row in recent_rows
        ]
        return DadianOverview(
            reply_count=reply_count,
            department_counts=[
                DepartmentCount(department=row["department"], count=row["count"])
                for row in department_rows
            ],
            recent_replies=recent_replies,
            pending_review_count=pending_review_count,
            today_focus=(
                f"有 {pending_review_count} 条回奏待复盘"
                if pending_review_count
                else "暂无建议"
            ),
        )
    except (sqlite3.Error, json.JSONDecodeError) as exc:
        raise ShiguanStorageError("史馆查询失败，请稍后再试") from exc
    finally:
        conn.close()
