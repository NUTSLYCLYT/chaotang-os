"""Transactional persistence, cache, and adoption operations for Jinyiwei."""

from __future__ import annotations

import hashlib
import json
import sqlite3
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

from pydantic import ValidationError

from app.jinyiwei import db
from app.jinyiwei.models import (
    CacheMetadata,
    DataGapRequest,
    EvidenceItem,
    EvidencePack,
    EvidencePackStatus,
    SourceAttempt,
)
from app.jinyiwei.read_models import (
    EvidenceAdoptionRead,
    InvestigationDetail,
    InvestigationListItem,
    InvestigationPage,
    InvestigationSummary,
)


class JinyiweiStorageError(RuntimeError):
    """A Jinyiwei persistence operation failed."""


class ImmutablePackConflictError(JinyiweiStorageError):
    """An existing pack ID was presented with different content."""


class ImmutableEvidenceConflictError(JinyiweiStorageError):
    """An existing evidence ID was presented with different immutable content."""


class RequestContentConflictError(JinyiweiStorageError):
    """An existing request ID was presented with different content."""


class InvestigationNotFoundError(JinyiweiStorageError):
    """The requested investigation does not exist."""


@dataclass(frozen=True)
class EvidenceAdoption:
    evidence_id: str
    reply_id: str
    status: Literal["PENDING", "CONFIRMED"]
    created_at: datetime
    updated_at: datetime
    confirmed_at: datetime | None


def _json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def _canonical(model: DataGapRequest | EvidencePack) -> str:
    return _json(model.model_dump(mode="json", warnings="none", fallback=_serialization_fallback))


def _serialization_fallback(value: object) -> object:
    if isinstance(value, Mapping):
        return dict(value)
    if isinstance(value, tuple):
        return list(value)
    raise TypeError(f"unsupported model value: {type(value).__name__}")


def _evidence_identity(item_json: Mapping[str, object]) -> str:
    """Canonical immutable evidence fields; retrieval time is pack-local audit data."""

    return _json({key: value for key, value in item_json.items() if key != "retrieved_at"})


def adoption_batch_fingerprint(evidence_items: tuple[object, ...]) -> str:
    """Fingerprint an ordered batch of immutable EvidenceItem identities."""

    if not evidence_items:
        raise ValueError("evidence batch must not be empty")
    identities: list[dict[str, str]] = []
    evidence_ids: set[str] = set()
    for item in evidence_items:
        if hasattr(item, "model_dump"):
            item_json = item.model_dump(mode="json", warnings="none")
        elif isinstance(item, Mapping):
            item_json = dict(item)
        else:
            raise ValueError("invalid evidence item")
        evidence_id = item_json.get("evidence_id")
        if not isinstance(evidence_id, str) or not evidence_id or evidence_id in evidence_ids:
            raise ValueError("evidence batch IDs must be unique non-empty strings")
        evidence_ids.add(evidence_id)
        identities.append(
            {
                "evidence_id": evidence_id,
                "identity": _evidence_identity(item_json),
            }
        )
    return hashlib.sha256(_json(identities).encode()).hexdigest()


def _iso(value: datetime) -> str:
    if value.utcoffset() is None:
        raise ValueError("timestamp must be timezone-aware")
    return value.astimezone(UTC).isoformat()


def _parse_time(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.utcoffset() is None:
        raise ValueError("timestamp must be timezone-aware")
    return parsed


def _require_owner(owner_user_id: str) -> str:
    if not isinstance(owner_user_id, str) or not owner_user_id.strip():
        raise ValueError("owner_user_id must be nonempty")
    return owner_user_id


def _assert_stored_request(
    connection: sqlite3.Connection,
    request_row: sqlite3.Row,
    request: DataGapRequest,
) -> None:
    request_columns = {
        "request_id": request.request_id,
        "fingerprint": request.request_fingerprint,
        "requesting_agent": request.requesting_agent,
        "question": request.question,
        "decision_context": request.decision_context,
        "freshness_json": request.freshness.model_dump(mode="json"),
        "existing_evidence_ids_json": list(request.existing_evidence_ids),
        "timeout_seconds": request.timeout_seconds,
        "source_scope_json": [source.value for source in request.source_scope],
    }
    for column, expected in request_columns.items():
        actual = (
            json.loads(request_row[column])
            if column.endswith("_json")
            else request_row[column]
        )
        if actual != expected:
            raise ValueError("request columns mismatch")

    fact_rows = connection.execute(
        "SELECT ordinal, fact_key, description, category, data_scope, subject, "
        "jurisdiction, expected_unit, expected_shape "
        "FROM requested_fact_slots WHERE request_id = ? ORDER BY ordinal ASC",
        (request.request_id,),
    ).fetchall()
    expected_facts = [
        (
            ordinal,
            fact.key,
            fact.description,
            fact.category.value,
            fact.data_scope.value,
            fact.subject,
            fact.jurisdiction,
            fact.expected_unit,
            fact.expected_shape,
        )
        for ordinal, fact in enumerate(request.required_facts)
    ]
    if [tuple(row) for row in fact_rows] != expected_facts:
        raise ValueError("fact slots mismatch")


def _store_request(
    connection: sqlite3.Connection,
    request: DataGapRequest,
    *,
    owner_user_id: str,
) -> None:
    canonical = _canonical(request)
    existing = connection.execute(
        "SELECT * FROM data_gap_requests WHERE request_id = ?",
        (request.request_id,),
    ).fetchone()
    if existing is not None:
        if existing["canonical_json"] != canonical:
            raise RequestContentConflictError("request ID already has different content")
        if existing["owner_user_id"] != owner_user_id:
            raise RequestContentConflictError("request ID already belongs to another owner")
        _assert_stored_request(connection, existing, request)
        return
    connection.execute(
        """
        INSERT INTO data_gap_requests (
            request_id, owner_user_id, fingerprint, requesting_agent, question, decision_context,
            freshness_json, existing_evidence_ids_json, timeout_seconds,
            source_scope_json, canonical_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            request.request_id,
            owner_user_id,
            request.request_fingerprint,
            request.requesting_agent,
            request.question,
            request.decision_context,
            _json(request.freshness.model_dump(mode="json")),
            _json(list(request.existing_evidence_ids)),
            request.timeout_seconds,
            _json([source.value for source in request.source_scope]),
            canonical,
        ),
    )
    for ordinal, fact in enumerate(request.required_facts):
        connection.execute(
            """
            INSERT INTO requested_fact_slots (
                request_id, ordinal, fact_key, description, category, data_scope,
                subject, jurisdiction, expected_unit, expected_shape
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                request.request_id,
                ordinal,
                fact.key,
                fact.description,
                fact.category.value,
                fact.data_scope.value,
                fact.subject,
                fact.jurisdiction,
                fact.expected_unit,
                fact.expected_shape,
            ),
        )


def store_data_gap_request(
    request: DataGapRequest,
    *,
    owner_user_id: str,
    db_path: Path | None = None,
) -> None:
    owner_user_id = _require_owner(owner_user_id)
    connection = db.get_connection(db_path)
    try:
        connection.execute("BEGIN IMMEDIATE")
        _store_request(connection, request, owner_user_id=owner_user_id)
        connection.commit()
    except JinyiweiStorageError:
        connection.rollback()
        raise
    except (sqlite3.Error, ValueError) as exc:
        connection.rollback()
        raise JinyiweiStorageError("failed to store data-gap request") from exc
    finally:
        connection.close()


def get_data_gap_request(request_id: str, *, db_path: Path | None = None) -> DataGapRequest:
    connection = db.get_connection(db_path)
    try:
        row = connection.execute(
            "SELECT * FROM data_gap_requests WHERE request_id = ?",
            (request_id,),
        ).fetchone()
        if row is None:
            raise JinyiweiStorageError("data-gap request not found")
        request = DataGapRequest.model_validate_json(row["canonical_json"])
        _assert_stored_request(connection, row, request)
        return request
    except (
        sqlite3.Error,
        ValidationError,
        ValueError,
        TypeError,
    ) as exc:
        raise JinyiweiStorageError("failed to load data-gap request") from exc
    finally:
        connection.close()


def store_evidence_pack(
    pack: EvidencePack,
    *,
    owner_user_id: str,
    db_path: Path | None = None,
) -> None:
    owner_user_id = _require_owner(owner_user_id)
    canonical = _canonical(pack)
    content_hash = hashlib.sha256(canonical.encode()).hexdigest()
    connection = db.get_connection(db_path)
    try:
        connection.execute("BEGIN IMMEDIATE")
        existing = connection.execute(
            "SELECT ep.canonical_json, ep.content_hash, r.owner_user_id "
            "FROM evidence_packs AS ep "
            "JOIN investigations AS i ON i.investigation_id = ep.investigation_id "
            "JOIN data_gap_requests AS r ON r.request_id = i.request_id "
            "WHERE ep.pack_id = ?",
            (pack.pack_id,),
        ).fetchone()
        if existing is not None:
            if existing["content_hash"] != content_hash or existing["canonical_json"] != canonical:
                raise ImmutablePackConflictError("pack ID already has different immutable content")
            if existing["owner_user_id"] != owner_user_id:
                raise ImmutablePackConflictError("pack ID already belongs to another owner")
            connection.commit()
            return

        _store_request(connection, pack.request, owner_user_id=owner_user_id)
        connection.execute(
            """
            INSERT INTO investigations (
                investigation_id, request_id, status, plan_json, resolved_facts_json,
                unresolved_facts_json, conflicts_json, do_not_infer_json,
                started_at, completed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                pack.investigation_id,
                pack.request.request_id,
                pack.status.value,
                _json(pack.investigation_plan.model_dump(mode="json")),
                _json(list(pack.resolved_facts)),
                _json(list(pack.unresolved_facts)),
                _json([item.model_dump(mode="json") for item in pack.conflicts]),
                _json(list(pack.do_not_infer)),
                pack.investigation_started_at,
                pack.investigation_completed_at,
            ),
        )
        for ordinal, attempt in enumerate(pack.source_attempts):
            connection.execute(
                """
                INSERT INTO source_attempts (
                    investigation_id, ordinal, source_type, source_name, status,
                    started_at, completed_at, error, facts_attempted_json,
                    call_audits_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    pack.investigation_id,
                    ordinal,
                    attempt.source_type.value,
                    attempt.source_name,
                    attempt.status.value,
                    attempt.started_at,
                    attempt.completed_at,
                    attempt.error,
                    _json(list(attempt.facts_attempted)),
                    _json(
                        [
                            audit.model_dump(mode="json")
                            for audit in attempt.call_audits
                        ]
                    ),
                ),
            )
        for fact_key, items in pack.evidence_by_fact.items():
            for item in items:
                item_json = item.model_dump(mode="json")
                item_canonical = _json(item_json)
                existing_item = connection.execute(
                    "SELECT model_json FROM evidence_items WHERE evidence_id = ?",
                    (item.evidence_id,),
                ).fetchone()
                if existing_item is not None:
                    existing_json = json.loads(existing_item["model_json"])
                    if _evidence_identity(existing_json) != _evidence_identity(item_json):
                        raise ImmutableEvidenceConflictError(
                            "evidence ID already has different immutable content"
                        )
                    continue
                connection.execute(
                    """
                    INSERT INTO evidence_items (
                        evidence_id, fact_key, value_json, unit,
                        as_of, retrieved_at, source_url, publisher, source_type,
                        quality, stance, excerpt, content_hash, confidence, model_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        item.evidence_id,
                        fact_key,
                        _json(item_json["value"]),
                        item.unit,
                        item.as_of,
                        item.retrieved_at,
                        item.source_url,
                        item.publisher,
                        item.source_type.value,
                        item.quality.value,
                        item.stance.value,
                        item.excerpt,
                        item.content_hash,
                        item.confidence,
                        item_canonical,
                    ),
                )
        connection.execute(
            "INSERT INTO evidence_packs(pack_id, investigation_id, canonical_json, content_hash) "
            "VALUES (?, ?, ?, ?)",
            (pack.pack_id, pack.investigation_id, canonical, content_hash),
        )
        for fact_key, items in pack.evidence_by_fact.items():
            for ordinal, item in enumerate(items):
                connection.execute(
                    "INSERT INTO pack_items(pack_id, evidence_id, fact_key, ordinal) "
                    "VALUES (?, ?, ?, ?)",
                    (pack.pack_id, item.evidence_id, fact_key, ordinal),
                )
        connection.commit()
    except JinyiweiStorageError:
        connection.rollback()
        raise
    except (sqlite3.Error, ValueError) as exc:
        connection.rollback()
        raise JinyiweiStorageError("failed to store evidence pack") from exc
    finally:
        connection.close()


def get_evidence_pack(pack_id: str, *, db_path: Path | None = None) -> EvidencePack:
    connection = db.get_connection(db_path)
    try:
        row = connection.execute(
            "SELECT canonical_json, content_hash FROM evidence_packs WHERE pack_id = ?",
            (pack_id,),
        ).fetchone()
        if row is None:
            raise JinyiweiStorageError("evidence pack not found")
        actual_hash = hashlib.sha256(row["canonical_json"].encode()).hexdigest()
        if actual_hash != row["content_hash"]:
            raise JinyiweiStorageError("evidence pack is corrupt")
        return EvidencePack.model_validate_json(row["canonical_json"])
    except (sqlite3.Error, ValidationError, json.JSONDecodeError) as exc:
        raise JinyiweiStorageError("failed to load evidence pack") from exc
    finally:
        connection.close()


def put_cache_entry(
    fingerprint: str,
    pack_id: str,
    *,
    owner_user_id: str,
    cached_at: datetime,
    expires_at: datetime,
    db_path: Path | None = None,
) -> None:
    owner_user_id = _require_owner(owner_user_id)
    cached = _iso(cached_at)
    expires = _iso(expires_at)
    if expires_at <= cached_at:
        raise ValueError("cache expiry must follow cache time")
    connection = db.get_connection(db_path)
    try:
        connection.execute("BEGIN IMMEDIATE")
        pack_owner = connection.execute(
            """
            SELECT 1
            FROM evidence_packs AS p
            JOIN investigations AS i ON i.investigation_id = p.investigation_id
            JOIN data_gap_requests AS r ON r.request_id = i.request_id
            WHERE p.pack_id = ? AND r.owner_user_id = ?
            """,
            (pack_id, owner_user_id),
        ).fetchone()
        if pack_owner is None:
            raise JinyiweiStorageError("failed to store cache entry")
        connection.execute(
            """
            INSERT INTO cache_entries (
                owner_user_id, fingerprint, pack_id, cached_at, expires_at,
                hit_count, last_hit_at
            ) VALUES (?, ?, ?, ?, ?, 0, NULL)
            ON CONFLICT(owner_user_id, fingerprint) DO UPDATE SET
                pack_id=excluded.pack_id, cached_at=excluded.cached_at,
                expires_at=excluded.expires_at, hit_count=0, last_hit_at=NULL
            """,
            (owner_user_id, fingerprint, pack_id, cached, expires),
        )
        connection.commit()
    except JinyiweiStorageError:
        connection.rollback()
        raise
    except sqlite3.Error as exc:
        connection.rollback()
        raise JinyiweiStorageError("failed to store cache entry") from exc
    finally:
        connection.close()


def lookup_cached_pack(
    fingerprint: str,
    *,
    owner_user_id: str,
    now: datetime,
    db_path: Path | None = None,
) -> EvidencePack | None:
    owner_user_id = _require_owner(owner_user_id)
    now_iso = _iso(now)
    connection = db.get_connection(db_path)
    try:
        row = connection.execute(
            """
            SELECT c.cached_at, c.expires_at, p.canonical_json, p.content_hash,
                   r.owner_user_id AS pack_owner_user_id
            FROM cache_entries AS c
            LEFT JOIN evidence_packs AS p ON p.pack_id = c.pack_id
            LEFT JOIN investigations AS i ON i.investigation_id = p.investigation_id
            LEFT JOIN data_gap_requests AS r ON r.request_id = i.request_id
            WHERE c.owner_user_id = ? AND c.fingerprint = ?
            """,
            (owner_user_id, fingerprint),
        ).fetchone()
        if row is None:
            return None
        if row["pack_owner_user_id"] != owner_user_id:
            raise JinyiweiStorageError("failed to read cache")
        try:
            cached_at = _parse_time(row["cached_at"])
            expires_at = _parse_time(row["expires_at"])
            if expires_at <= now:
                return None
            actual_hash = hashlib.sha256(row["canonical_json"].encode()).hexdigest()
            if actual_hash != row["content_hash"]:
                return None
            pack = EvidencePack.model_validate_json(row["canonical_json"])
            cache = CacheMetadata(
                hit=True,
                cache_key=fingerprint,
                cached_at=cached_at.isoformat(),
                expires_at=expires_at.isoformat(),
            )
        except (ValidationError, ValueError, TypeError, json.JSONDecodeError):
            return None
        connection.execute("BEGIN IMMEDIATE")
        connection.execute(
            "UPDATE cache_entries SET hit_count = hit_count + 1, last_hit_at = ? "
            "WHERE owner_user_id = ? AND fingerprint = ?",
            (now_iso, owner_user_id, fingerprint),
        )
        connection.commit()
        return pack.model_copy(update={"cache": cache})
    except JinyiweiStorageError:
        connection.rollback()
        raise
    except sqlite3.Error as exc:
        connection.rollback()
        raise JinyiweiStorageError("failed to read cache") from exc
    finally:
        connection.close()


def _adoption(row: sqlite3.Row) -> EvidenceAdoption:
    return EvidenceAdoption(
        evidence_id=row["evidence_id"],
        reply_id=row["reply_id"],
        status=row["status"],
        created_at=_parse_time(row["created_at"]),
        updated_at=_parse_time(row["updated_at"]),
        confirmed_at=(_parse_time(row["confirmed_at"]) if row["confirmed_at"] else None),
    )


def upsert_evidence_adoption(
    evidence_id: str,
    reply_id: str,
    status: Literal["PENDING", "CONFIRMED"],
    *,
    owner_user_id: str,
    at: datetime,
    db_path: Path | None = None,
) -> EvidenceAdoption:
    if status not in ("PENDING", "CONFIRMED"):
        raise ValueError("invalid adoption status")
    pending = _write_adoption_batch(
        (evidence_id,), reply_id, "PENDING",
        owner_user_id=owner_user_id, at=at, db_path=db_path
    )
    if status == "PENDING":
        return pending[0]
    return _write_adoption_batch(
        (evidence_id,), reply_id, "CONFIRMED",
        owner_user_id=owner_user_id, at=at, db_path=db_path
    )[0]


def _write_adoption_batch(
    evidence_ids: tuple[str, ...],
    reply_id: str,
    status: Literal["PENDING", "CONFIRMED"],
    *,
    owner_user_id: str,
    at: datetime,
    db_path: Path | None,
    batch_fingerprint: str | None = None,
) -> list[EvidenceAdoption]:
    owner_user_id = _require_owner(owner_user_id)
    if not evidence_ids or len(evidence_ids) != len(set(evidence_ids)):
        raise ValueError("evidence IDs must be a non-empty unique tuple")
    if not reply_id:
        raise ValueError("reply ID must not be empty")
    at_iso = _iso(at)
    connection = db.get_connection(db_path)
    try:
        connection.execute("BEGIN IMMEDIATE")
        placeholders = ",".join("?" for _ in evidence_ids)
        rows = connection.execute(
            f"SELECT DISTINCT e.evidence_id, e.model_json FROM evidence_items AS e "
            f"JOIN pack_items AS pi ON pi.evidence_id = e.evidence_id "
            f"JOIN evidence_packs AS ep ON ep.pack_id = pi.pack_id "
            f"JOIN investigations AS i ON i.investigation_id = ep.investigation_id "
            f"JOIN data_gap_requests AS r ON r.request_id = i.request_id "
            f"WHERE e.evidence_id IN ({placeholders}) AND r.owner_user_id = ?",
            (*evidence_ids, owner_user_id),
        ).fetchall()
        if {row["evidence_id"] for row in rows} != set(evidence_ids):
            raise JinyiweiStorageError("adoption evidence does not exist")
        models_by_id = {
            row["evidence_id"]: json.loads(row["model_json"]) for row in rows
        }
        actual_fingerprint = adoption_batch_fingerprint(
            tuple(models_by_id[evidence_id] for evidence_id in evidence_ids)
        )
        if (
            batch_fingerprint is not None
            and batch_fingerprint != actual_fingerprint
        ):
            raise JinyiweiStorageError("adoption batch evidence identity conflict")
        evidence_ids_json = _json(list(evidence_ids))
        batch_row = connection.execute(
            "SELECT evidence_ids_json, batch_fingerprint "
            "FROM adoption_batches WHERE owner_user_id = ? AND reply_id = ?",
            (owner_user_id, reply_id),
        ).fetchone()
        if batch_row is None:
            if status == "CONFIRMED":
                raise JinyiweiStorageError("pending adoption batch does not exist")
            connection.execute(
                "INSERT INTO adoption_batches "
                "(owner_user_id, reply_id, evidence_ids_json, batch_fingerprint, "
                "created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                (
                    owner_user_id,
                    reply_id,
                    evidence_ids_json,
                    actual_fingerprint,
                    at_iso,
                    at_iso,
                ),
            )
        elif (
            batch_row["evidence_ids_json"] != evidence_ids_json
            or batch_row["batch_fingerprint"] != actual_fingerprint
        ):
            raise JinyiweiStorageError("adoption batch immutable conflict")
        adoption_rows = connection.execute(
            "SELECT evidence_id FROM evidence_adoptions "
            "WHERE owner_user_id = ? AND reply_id = ?",
            (owner_user_id, reply_id),
        ).fetchall()
        existing_ids = {row["evidence_id"] for row in adoption_rows}
        if existing_ids and existing_ids != set(evidence_ids):
            raise JinyiweiStorageError("adoption batch immutable conflict")
        if status == "CONFIRMED":
            if existing_ids != set(evidence_ids):
                raise JinyiweiStorageError("pending adoption batch does not exist")
        for evidence_id in evidence_ids:
            connection.execute(
                """
                INSERT INTO evidence_adoptions (
                    owner_user_id, evidence_id, reply_id, status,
                    created_at, updated_at, confirmed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(owner_user_id, evidence_id, reply_id) DO UPDATE SET
                    status = CASE
                        WHEN evidence_adoptions.status = 'CONFIRMED' THEN 'CONFIRMED'
                        ELSE excluded.status
                    END,
                    updated_at = CASE
                        WHEN evidence_adoptions.status = 'CONFIRMED'
                             OR evidence_adoptions.status = excluded.status
                        THEN evidence_adoptions.updated_at ELSE excluded.updated_at
                    END,
                    confirmed_at = CASE
                        WHEN evidence_adoptions.confirmed_at IS NOT NULL
                        THEN evidence_adoptions.confirmed_at
                        WHEN excluded.status = 'CONFIRMED' THEN excluded.confirmed_at
                        ELSE NULL
                    END
                """,
                (
                    owner_user_id,
                    evidence_id,
                    reply_id,
                    status,
                    at_iso,
                    at_iso,
                    at_iso if status == "CONFIRMED" else None,
                ),
            )
        result = []
        for evidence_id in evidence_ids:
            row = connection.execute(
                "SELECT * FROM evidence_adoptions "
                "WHERE owner_user_id = ? AND evidence_id = ? AND reply_id = ?",
                (owner_user_id, evidence_id, reply_id),
            ).fetchone()
            result.append(_adoption(row))
        connection.commit()
        return result
    except JinyiweiStorageError:
        connection.rollback()
        raise
    except sqlite3.Error as exc:
        connection.rollback()
        raise JinyiweiStorageError("failed to write evidence adoption batch") from exc
    finally:
        connection.close()


def write_pending_adoptions(
    evidence_ids: tuple[str, ...],
    reply_id: str,
    *,
    owner_user_id: str,
    at: datetime,
    db_path: Path | None = None,
    batch_fingerprint: str | None = None,
) -> list[EvidenceAdoption]:
    """Validate and write the whole PENDING batch in one transaction."""

    return _write_adoption_batch(
        evidence_ids,
        reply_id,
        "PENDING",
        owner_user_id=owner_user_id,
        at=at,
        db_path=db_path,
        batch_fingerprint=batch_fingerprint,
    )


def confirm_adoptions(
    evidence_ids: tuple[str, ...],
    reply_id: str,
    *,
    owner_user_id: str,
    at: datetime,
    db_path: Path | None = None,
    batch_fingerprint: str | None = None,
) -> list[EvidenceAdoption]:
    """Upgrade the whole adoption batch to CONFIRMED in a separate transaction."""

    return _write_adoption_batch(
        evidence_ids,
        reply_id,
        "CONFIRMED",
        owner_user_id=owner_user_id,
        at=at,
        db_path=db_path,
        batch_fingerprint=batch_fingerprint,
    )


def cancel_pending_adoptions(
    evidence_ids: tuple[str, ...],
    reply_id: str,
    *,
    owner_user_id: str,
    db_path: Path | None = None,
    batch_fingerprint: str | None = None,
) -> None:
    """Atomically remove one exact orphan PENDING batch.

    This compensates only a failed Shiguan write. It is idempotent when the
    whole batch is already absent and never removes or downgrades CONFIRMED
    adoption state.
    """

    owner_user_id = _require_owner(owner_user_id)
    if not evidence_ids or len(evidence_ids) != len(set(evidence_ids)):
        raise ValueError("evidence IDs must be a non-empty unique tuple")
    if not reply_id:
        raise ValueError("reply ID must not be empty")
    connection = db.get_connection(db_path)
    try:
        connection.execute("BEGIN IMMEDIATE")
        batch_row = connection.execute(
            "SELECT evidence_ids_json, batch_fingerprint FROM adoption_batches "
            "WHERE owner_user_id = ? AND reply_id = ?",
            (owner_user_id, reply_id),
        ).fetchone()
        rows = connection.execute(
            "SELECT evidence_id, status FROM evidence_adoptions "
            "WHERE owner_user_id = ? AND reply_id = ? ORDER BY evidence_id ASC",
            (owner_user_id, reply_id),
        ).fetchall()
        if batch_row is None and not rows:
            connection.commit()
            return
        if batch_row is None or not rows:
            raise JinyiweiStorageError("pending adoption batch metadata mismatch")
        if (
            batch_row["evidence_ids_json"] != _json(list(evidence_ids))
            or (
                batch_fingerprint is not None
                and batch_row["batch_fingerprint"] != batch_fingerprint
            )
        ):
            raise JinyiweiStorageError(
                "pending adoption cancellation requires the exact pending batch"
            )
        if (
            {row["evidence_id"] for row in rows} != set(evidence_ids)
            or any(row["status"] != "PENDING" for row in rows)
        ):
            raise JinyiweiStorageError(
                "pending adoption cancellation requires the exact pending batch"
            )
        cursor = connection.execute(
            "DELETE FROM evidence_adoptions "
            "WHERE owner_user_id = ? AND reply_id = ? AND status = 'PENDING'",
            (owner_user_id, reply_id),
        )
        if cursor.rowcount != len(evidence_ids):
            raise JinyiweiStorageError("pending adoption cancellation was incomplete")
        connection.execute(
            "DELETE FROM adoption_batches WHERE owner_user_id = ? AND reply_id = ?",
            (owner_user_id, reply_id),
        )
        connection.commit()
    except JinyiweiStorageError:
        connection.rollback()
        raise
    except sqlite3.Error as exc:
        connection.rollback()
        raise JinyiweiStorageError(
            "failed to cancel pending evidence adoption batch"
        ) from exc
    finally:
        connection.close()


def list_adoptions_by_reply(
    reply_id: str, *, owner_user_id: str, db_path: Path | None = None
) -> list[EvidenceAdoption]:
    owner_user_id = _require_owner(owner_user_id)
    return _list_adoptions(
        "a.owner_user_id = ? AND a.reply_id = ?",
        (owner_user_id, reply_id),
        "a.evidence_id ASC",
        db_path=db_path,
    )


def list_adoptions_by_investigation(
    investigation_id: str, *, owner_user_id: str, db_path: Path | None = None
) -> list[EvidenceAdoption]:
    owner_user_id = _require_owner(owner_user_id)
    connection = db.get_connection(db_path)
    try:
        rows = connection.execute(
            "SELECT a.* FROM evidence_adoptions AS a "
            "JOIN pack_items AS pi ON pi.evidence_id = a.evidence_id "
            "JOIN evidence_packs AS ep ON ep.pack_id = pi.pack_id "
            "JOIN investigations AS i ON i.investigation_id = ep.investigation_id "
            "JOIN data_gap_requests AS r ON r.request_id = i.request_id "
            "WHERE ep.investigation_id = ? AND a.owner_user_id = ? "
            "AND r.owner_user_id = ? "
            "ORDER BY a.reply_id ASC, a.evidence_id ASC",
            (investigation_id, owner_user_id, owner_user_id),
        ).fetchall()
        return [_adoption(row) for row in rows]
    except sqlite3.Error as exc:
        raise JinyiweiStorageError("failed to list evidence adoptions") from exc
    finally:
        connection.close()


def _list_adoptions(
    where: str,
    parameters: tuple[str, ...],
    order_by: str,
    *,
    db_path: Path | None,
) -> list[EvidenceAdoption]:
    connection = db.get_connection(db_path)
    try:
        rows = connection.execute(
            "SELECT a.* FROM evidence_adoptions AS a "
            "JOIN evidence_items AS e ON e.evidence_id = a.evidence_id "
            f"WHERE {where} ORDER BY {order_by}",
            parameters,
        ).fetchall()
        return [_adoption(row) for row in rows]
    except sqlite3.Error as exc:
        raise JinyiweiStorageError("failed to list evidence adoptions") from exc
    finally:
        connection.close()


def get_investigation_summary(
    *, owner_user_id: str, db_path: Path | None = None
) -> InvestigationSummary:
    """Return independent audit counters without multiplicative joins."""

    owner_user_id = _require_owner(owner_user_id)
    connection: sqlite3.Connection | None = None
    try:
        connection = db.get_connection(db_path)
        row = connection.execute(
            """
            WITH owned AS (
              SELECT i.investigation_id, i.status
              FROM investigations AS i
              JOIN data_gap_requests AS r ON r.request_id = i.request_id
              WHERE r.owner_user_id = ?
            ), owned_evidence AS (
              SELECT DISTINCT pi.evidence_id
              FROM owned AS o
              JOIN evidence_packs AS ep ON ep.investigation_id = o.investigation_id
              JOIN pack_items AS pi ON pi.pack_id = ep.pack_id
            )
            SELECT
              (SELECT COUNT(*) FROM owned) AS total_investigations,
              (SELECT COUNT(*) FROM owned WHERE status = 'RESOLVED') AS resolved_count,
              (SELECT COUNT(*) FROM owned WHERE status = 'PARTIAL') AS partial_count,
              (SELECT COUNT(*) FROM owned WHERE status = 'BLOCKED') AS blocked_count,
              (SELECT COUNT(*) FROM owned WHERE status = 'UNAVAILABLE')
                AS unavailable_count,
              (SELECT COUNT(*) FROM owned_evidence) AS distinct_evidence_count,
              (SELECT COUNT(*) FROM evidence_adoptions AS ea
               WHERE ea.status = 'PENDING'
                 AND ea.owner_user_id = ?
                 AND ea.evidence_id IN (SELECT evidence_id FROM owned_evidence))
                AS pending_adoption_count,
              (SELECT COUNT(*) FROM evidence_adoptions AS ea
               WHERE ea.status = 'CONFIRMED'
                 AND ea.owner_user_id = ?
                 AND ea.evidence_id IN (SELECT evidence_id FROM owned_evidence))
                AS confirmed_adoption_count
            """,
            (owner_user_id, owner_user_id, owner_user_id),
        ).fetchone()
        return InvestigationSummary.model_validate(dict(row))
    except (sqlite3.Error, ValidationError, ValueError, TypeError) as exc:
        raise JinyiweiStorageError("investigation data unavailable") from exc
    finally:
        if connection is not None:
            connection.close()


def list_investigations(
    *,
    owner_user_id: str,
    status: EvidencePackStatus | str | None = None,
    limit: int = 20,
    offset: int = 0,
    db_path: Path | None = None,
) -> InvestigationPage:
    """List safe investigation audit fields in deterministic order."""

    owner_user_id = _require_owner(owner_user_id)
    if isinstance(limit, bool) or not isinstance(limit, int) or not 1 <= limit <= 100:
        raise ValueError("limit must be between 1 and 100")
    if isinstance(offset, bool) or not isinstance(offset, int) or offset < 0:
        raise ValueError("offset must be nonnegative")
    try:
        normalized_status = None if status is None else EvidencePackStatus(status)
    except ValueError as exc:
        raise ValueError("invalid investigation status") from exc
    where = "WHERE r.owner_user_id = ?"
    parameters: tuple[object, ...] = (owner_user_id,)
    if normalized_status is not None:
        where += " AND i.status = ?"
        parameters += (normalized_status.value,)
    connection: sqlite3.Connection | None = None
    try:
        connection = db.get_connection(db_path)
        orphan_count = connection.execute(
            "SELECT COUNT(*) AS total FROM investigations AS i "
            "LEFT JOIN data_gap_requests AS r ON r.request_id = i.request_id "
            "WHERE r.request_id IS NULL",
        ).fetchone()["total"]
        if orphan_count:
            raise ValueError("investigation request relationship is corrupt")
        total = connection.execute(
            "SELECT COUNT(*) AS total FROM investigations AS i "
            "JOIN data_gap_requests AS r ON r.request_id = i.request_id "
            f"{where}",
            parameters,
        ).fetchone()["total"]
        rows = connection.execute(
            f"""
            SELECT i.investigation_id, i.request_id, r.requesting_agent, r.question,
                   i.status, i.started_at, i.completed_at,
                   (SELECT COUNT(*) FROM source_attempts AS sa
                    WHERE sa.investigation_id = i.investigation_id) AS source_attempt_count,
                   (SELECT COUNT(DISTINCT pi.evidence_id)
                    FROM evidence_packs AS ep JOIN pack_items AS pi ON pi.pack_id = ep.pack_id
                    WHERE ep.investigation_id = i.investigation_id) AS evidence_count,
                   (SELECT COUNT(DISTINCT ea.reply_id)
                    FROM evidence_packs AS ep
                    JOIN pack_items AS pi ON pi.pack_id = ep.pack_id
                    JOIN evidence_adoptions AS ea ON ea.evidence_id = pi.evidence_id
                    WHERE ep.investigation_id = i.investigation_id
                      AND ea.owner_user_id = r.owner_user_id) AS linked_reply_count
            FROM investigations AS i
            LEFT JOIN data_gap_requests AS r ON r.request_id = i.request_id
            {where}
            ORDER BY i.started_at DESC, i.investigation_id ASC
            LIMIT ? OFFSET ?
            """,
            (*parameters, limit, offset),
        ).fetchall()
        items = tuple(InvestigationListItem.model_validate(dict(row)) for row in rows)
        return InvestigationPage(items=items, total=total, limit=limit, offset=offset)
    except (sqlite3.Error, ValidationError, ValueError, TypeError) as exc:
        raise JinyiweiStorageError("investigation data unavailable") from exc
    finally:
        if connection is not None:
            connection.close()


def _load_json(value: str) -> object:
    return json.loads(value)


def _assert_pack_relations(connection: sqlite3.Connection, pack: EvidencePack) -> None:
    request_row = connection.execute(
        "SELECT * FROM data_gap_requests WHERE request_id = ?",
        (pack.request.request_id,),
    ).fetchone()
    if request_row is None or request_row["canonical_json"] != _canonical(pack.request):
        raise ValueError("request mismatch")
    stored_request = DataGapRequest.model_validate_json(request_row["canonical_json"])
    if stored_request != pack.request:
        raise ValueError("request mismatch")
    _assert_stored_request(connection, request_row, pack.request)

    investigation = connection.execute(
        "SELECT * FROM investigations WHERE investigation_id = ?", (pack.investigation_id,)
    ).fetchone()
    if investigation is None or investigation["request_id"] != pack.request.request_id:
        raise ValueError("investigation mismatch")
    expected_investigation = {
        "status": pack.status.value,
        "plan_json": pack.investigation_plan.model_dump(mode="json"),
        "resolved_facts_json": list(pack.resolved_facts),
        "unresolved_facts_json": list(pack.unresolved_facts),
        "conflicts_json": [item.model_dump(mode="json") for item in pack.conflicts],
        "do_not_infer_json": list(pack.do_not_infer),
        "started_at": pack.investigation_started_at,
        "completed_at": pack.investigation_completed_at,
    }
    for column, expected in expected_investigation.items():
        actual = (
            _load_json(investigation[column]) if column.endswith("_json") else investigation[column]
        )
        if actual != expected:
            raise ValueError("investigation mismatch")

    attempt_rows = connection.execute(
        "SELECT * FROM source_attempts WHERE investigation_id = ? ORDER BY ordinal ASC",
        (pack.investigation_id,),
    ).fetchall()
    if [row["ordinal"] for row in attempt_rows] != list(range(len(pack.source_attempts))):
        raise ValueError("attempt order mismatch")
    attempts = tuple(
        SourceAttempt.model_validate(
            {
                "source_type": row["source_type"],
                "source_name": row["source_name"],
                "status": row["status"],
                "started_at": row["started_at"],
                "completed_at": row["completed_at"],
                "error": row["error"],
                "facts_attempted": _load_json(row["facts_attempted_json"]),
                "call_audits": _load_json(row["call_audits_json"]),
            }
        )
        for row in attempt_rows
    )
    if attempts != pack.source_attempts:
        raise ValueError("attempt mismatch")

    membership_rows = connection.execute(
        "SELECT evidence_id, fact_key, ordinal FROM pack_items WHERE pack_id = ?",
        (pack.pack_id,),
    ).fetchall()
    actual_membership = {
        (row["fact_key"], row["ordinal"]): row["evidence_id"] for row in membership_rows
    }
    expected_membership = {
        (fact_key, ordinal): item.evidence_id
        for fact_key, items in pack.evidence_by_fact.items()
        for ordinal, item in enumerate(items)
    }
    if len(actual_membership) != len(membership_rows) or actual_membership != expected_membership:
        raise ValueError("pack membership mismatch")

    for items in pack.evidence_by_fact.values():
        for item in items:
            row = connection.execute(
                "SELECT * FROM evidence_items WHERE evidence_id = ?", (item.evidence_id,)
            ).fetchone()
            if row is None:
                raise ValueError("global evidence missing")
            global_item = EvidenceItem.model_validate_json(row["model_json"])
            denormalized = {
                "evidence_id": row["evidence_id"],
                "fact_key": row["fact_key"],
                "value": _load_json(row["value_json"]),
                "unit": row["unit"],
                "as_of": row["as_of"],
                "published_at": global_item.published_at,
                "retrieved_at": row["retrieved_at"],
                "source_url": row["source_url"],
                "publisher": row["publisher"],
                "source_type": row["source_type"],
                "coverage": global_item.coverage,
                "license_note": global_item.license_note,
                "quality": row["quality"],
                "stance": row["stance"],
                "excerpt": row["excerpt"],
                "content_hash": row["content_hash"],
                "confidence": row["confidence"],
            }
            if EvidenceItem.model_validate(denormalized) != global_item:
                raise ValueError("global evidence columns mismatch")
            pack_identity = _evidence_identity(item.model_dump(mode="json"))
            global_identity = _evidence_identity(global_item.model_dump(mode="json"))
            if pack_identity != global_identity:
                raise ValueError("global evidence identity mismatch")


def get_investigation_detail(
    investigation_id: str,
    *,
    owner_user_id: str,
    db_path: Path | None = None,
) -> InvestigationDetail:
    """Load and cross-check one canonical evidence pack and all audit relations."""

    owner_user_id = _require_owner(owner_user_id)
    connection: sqlite3.Connection | None = None
    try:
        connection = db.get_connection(db_path)
        investigation = connection.execute(
            "SELECT i.investigation_id FROM investigations AS i "
            "JOIN data_gap_requests AS r ON r.request_id = i.request_id "
            "WHERE i.investigation_id = ? AND r.owner_user_id = ?",
            (investigation_id, owner_user_id),
        ).fetchone()
        if investigation is None:
            raise InvestigationNotFoundError("investigation not found")
        rows = connection.execute(
            "SELECT ep.pack_id, ep.investigation_id, ep.canonical_json, ep.content_hash "
            "FROM evidence_packs AS ep "
            "WHERE ep.investigation_id = ?",
            (investigation_id,),
        ).fetchall()
        if len(rows) != 1:
            raise ValueError("investigation pack relationship is corrupt")
        row = rows[0]
        if hashlib.sha256(row["canonical_json"].encode()).hexdigest() != row["content_hash"]:
            raise ValueError("pack hash mismatch")
        pack = EvidencePack.model_validate_json(row["canonical_json"])
        if pack.investigation_id != investigation_id or pack.pack_id != row["pack_id"]:
            raise ValueError("pack investigation mismatch")
        _assert_pack_relations(connection, pack)
        evidence_ids = tuple(
            item.evidence_id for items in pack.evidence_by_fact.values() for item in items
        )
        adoption_rows: list[sqlite3.Row] = []
        if evidence_ids:
            placeholders = ",".join("?" for _ in evidence_ids)
            adoption_rows = connection.execute(
                "SELECT evidence_id, reply_id, status, created_at, updated_at, "
                "confirmed_at FROM evidence_adoptions "
                f"WHERE evidence_id IN ({placeholders}) "
                "AND owner_user_id = ? "
                "ORDER BY reply_id ASC, evidence_id ASC",
                (*evidence_ids, owner_user_id),
            ).fetchall()
        adoptions = tuple(EvidenceAdoptionRead.model_validate(dict(item)) for item in adoption_rows)
        return InvestigationDetail(
            pack_id=pack.pack_id,
            investigation_id=pack.investigation_id,
            status=pack.status,
            request=pack.request,
            investigation_plan=pack.investigation_plan,
            evidence_by_fact=pack.evidence_by_fact,
            historical_evidence_by_fact=pack.historical_evidence_by_fact,
            resolved_facts=pack.resolved_facts,
            unresolved_facts=pack.unresolved_facts,
            conflicts=pack.conflicts,
            source_attempts=pack.source_attempts,
            investigation_started_at=pack.investigation_started_at,
            investigation_completed_at=pack.investigation_completed_at,
            cache=pack.cache,
            do_not_infer=pack.do_not_infer,
            adoptions=adoptions,
        )
    except InvestigationNotFoundError:
        raise
    except (sqlite3.Error, ValidationError, ValueError, TypeError, json.JSONDecodeError) as exc:
        raise JinyiweiStorageError("investigation data unavailable") from exc
    finally:
        if connection is not None:
            connection.close()
