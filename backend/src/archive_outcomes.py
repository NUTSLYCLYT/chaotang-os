"""Canonical append-only outcome events and legacy retrospective backfill."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from src.db.models import ArchiveOutcomeEvent, Retrospective, ShiguanArchive


def _now_iso() -> str:
    # recorded_at is also the stable latest-event ordering key. Preserve
    # microseconds so a correction appended immediately after its predecessor
    # cannot lose the projection race merely because both landed in one second.
    return datetime.now(timezone.utc).isoformat(timespec="microseconds")


def _canonical_json(value: dict[str, Any]) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )


def _list_of_text(value: str | None) -> list[str]:
    try:
        loaded = json.loads(value or "[]")
    except (TypeError, ValueError):
        return []
    if not isinstance(loaded, list):
        return []
    return [item for item in loaded if isinstance(item, str)]


def record_archive_outcome(
    *,
    session: Session,
    tenant_id: int,
    task_id: str,
    archive_id: str | None,
    actual: str,
    source_type: str,
    source_auth_level: str,
    occurred_at: str,
    recorded_by: str,
    payload: dict[str, Any],
    idempotency_key: str,
    evidence_ref: str | None = None,
    supersedes_event_id: str | None = None,
    synthetic_flag: bool = False,
    event_type: str = "outcome.recorded",
) -> ArchiveOutcomeEvent:
    """Append one immutable outcome event; the caller owns the transaction.

    Replaying the same tenant-scoped idempotency key and exact immutable content
    returns the original row. Binding that key to different content fails closed.
    """

    payload_json = _canonical_json(payload)
    immutable = {
        "archive_id": archive_id,
        "task_id": task_id,
        "event_type": event_type,
        "actual": actual,
        "source_type": source_type,
        "source_auth_level": source_auth_level,
        "occurred_at": occurred_at,
        "recorded_by": recorded_by,
        "evidence_ref": evidence_ref,
        "supersedes_event_id": supersedes_event_id,
        "payload_json": payload_json,
        "synthetic_flag": bool(synthetic_flag),
    }
    payload_hash = hashlib.sha256(_canonical_json(immutable).encode("utf-8")).hexdigest()
    existing = (
        session.query(ArchiveOutcomeEvent)
        .filter_by(tenant_id=tenant_id, idempotency_key=idempotency_key)
        .first()
    )
    if existing is not None:
        if existing.payload_hash != payload_hash:
            raise ValueError(
                "idempotency key already binds a different archive outcome payload"
            )
        return existing

    event_id = "outcome_" + hashlib.sha256(
        f"{tenant_id}|{idempotency_key}".encode("utf-8")
    ).hexdigest()[:24]
    event = ArchiveOutcomeEvent(
        id=event_id,
        tenant_id=tenant_id,
        archive_id=archive_id,
        task_id=task_id,
        event_type=event_type,
        actual=actual,
        source_type=source_type,
        source_auth_level=source_auth_level,
        occurred_at=occurred_at,
        recorded_at=_now_iso(),
        recorded_by=recorded_by,
        evidence_ref=evidence_ref,
        idempotency_key=idempotency_key,
        supersedes_event_id=supersedes_event_id,
        payload_hash=payload_hash,
        payload_json=payload_json,
        synthetic_flag=bool(synthetic_flag),
    )
    session.add(event)
    session.flush()
    return event


def backfill_legacy_retrospectives(*, session: Session) -> dict[str, int]:
    """Append authored legacy retrospectives to the canonical outcome ledger.

    The source row is never mutated. A content-derived key makes reruns idempotent;
    if a mutable legacy row is later corrected, the new event supersedes the last
    event for that task instead of rewriting history.
    """

    stats = {"scanned": 0, "inserted": 0, "skipped_synthetic": 0}
    retrospectives = session.query(Retrospective).order_by(Retrospective.id.asc()).all()
    for retrospective in retrospectives:
        stats["scanned"] += 1
        if retrospective.synthetic:
            stats["skipped_synthetic"] += 1
            continue

        archive = (
            session.query(ShiguanArchive)
            .filter_by(task_id=retrospective.task_id)
            .order_by(ShiguanArchive.created_at.desc(), ShiguanArchive.id.desc())
            .first()
        )
        payload = {
            "score": retrospective.score,
            "successes": _list_of_text(retrospective.successes_json),
            "failures": _list_of_text(retrospective.failures_json),
            "lessons": _list_of_text(retrospective.lessons_json),
            "playbook": retrospective.playbook or "",
            "authored_by": retrospective.authored_by,
            "authored_at": retrospective.authored_at,
            "legacy_retrospective_id": retrospective.id,
        }
        content_hash = hashlib.sha256(_canonical_json(payload).encode("utf-8")).hexdigest()
        idempotency_key = (
            f"legacy-retrospective:{retrospective.id}:{content_hash}"
        )
        if (
            session.query(ArchiveOutcomeEvent)
            .filter_by(
                tenant_id=retrospective.tenant_id,
                idempotency_key=idempotency_key,
            )
            .first()
            is not None
        ):
            continue

        previous = (
            session.query(ArchiveOutcomeEvent)
            .filter_by(
                tenant_id=retrospective.tenant_id,
                task_id=retrospective.task_id,
            )
            .order_by(
                ArchiveOutcomeEvent.recorded_at.desc(),
                ArchiveOutcomeEvent.id.desc(),
            )
            .first()
        )
        record_archive_outcome(
            session=session,
            tenant_id=retrospective.tenant_id,
            task_id=retrospective.task_id,
            archive_id=archive.id if archive is not None else None,
            actual=retrospective.outcome,
            # A non-synthetic legacy observation without a canonical archive is
            # still visible, but honestly classified as MIXED and unsigned.
            source_type=(archive.source_label if archive is not None else "MIXED"),
            source_auth_level="legacy_unverified",
            occurred_at=retrospective.authored_at,
            recorded_by=retrospective.authored_by,
            payload=payload,
            idempotency_key=idempotency_key,
            supersedes_event_id=previous.id if previous is not None else None,
            synthetic_flag=False,
            event_type=("outcome.corrected" if previous is not None else "outcome.recorded"),
        )
        stats["inserted"] += 1
    return stats
