
"""Freeze owner-scoped Shiguan facts for one daily memorial run."""

from __future__ import annotations

import hashlib
import json
import sqlite3
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path

from app.daily_memorial_drafts.models import RunStatus
from app.daily_memorial_drafts.storage import (
    _get_or_create_run_in_transaction,
    report_window,
)
from app.shiguan import db
from app.shiguan.errors import ShiguanStorageError


@dataclass(frozen=True, slots=True)
class ControlledFact:
    """One immutable archive or adopted-evidence atom in a run snapshot."""

    fact_id: str
    run_id: str
    owner_user_id: str
    report_date: date
    archive_id: str
    evidence_ordinal: int | None
    payload_hash: str
    snapshot_json: str


def _canonical_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def controlled_fact_id(
    owner_user_id: str,
    archive_id: str,
    ordinal: int | None,
    payload_hash: str,
) -> str:
    """Derive an opaque deterministic identity without exposing the owner."""

    ordinal_text = ordinal if ordinal is not None else "-"
    raw = f"{owner_user_id}\0{archive_id}\0{ordinal_text}\0{payload_hash}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _fact_from_snapshot_row(
    row: sqlite3.Row, *, owner_user_id: str, report_date: date
) -> ControlledFact:
    try:
        payload = json.loads(row["snapshot_json"])
        archive_id = payload["archive_id"]
        ordinal = payload["evidence_ordinal"]
        payload_hash = hashlib.sha256(row["snapshot_json"].encode("utf-8")).hexdigest()
        expected_id = controlled_fact_id(
            owner_user_id, archive_id, ordinal, payload_hash
        )
        if row["fact_id"] != expected_id:
            raise ValueError("controlled fact identity mismatch")
        return ControlledFact(
            fact_id=row["fact_id"],
            run_id=row["run_id"],
            owner_user_id=owner_user_id,
            report_date=report_date,
            archive_id=archive_id,
            evidence_ordinal=ordinal,
            payload_hash=payload_hash,
            snapshot_json=row["snapshot_json"],
        )
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise ShiguanStorageError("每日奏报事实快照校验失败") from exc


def _load_facts(
    conn: sqlite3.Connection,
    run_id: str,
    *,
    owner_user_id: str,
    report_date: date,
) -> tuple[ControlledFact, ...]:
    rows = conn.execute(
        "SELECT run_id, fact_id, snapshot_json "
        "FROM daily_memorial_fact_snapshots WHERE run_id = ? ORDER BY fact_id",
        (run_id,),
    ).fetchall()
    return tuple(
        _fact_from_snapshot_row(
            row, owner_user_id=owner_user_id, report_date=report_date
        )
        for row in rows
    )


def _eligible_archives(
    conn: sqlite3.Connection,
    owner_user_id: str,
    report_date: date,
) -> tuple[sqlite3.Row, ...]:
    start, end = report_window(report_date)
    rows = conn.execute(
        "SELECT * FROM archives WHERE owner_user_id = ? "
        "AND type IN ('MEMORIAL', 'REPLY') ORDER BY created_at, id",
        (owner_user_id,),
    ).fetchall()
    selected: list[sqlite3.Row] = []
    for row in rows:
        try:
            created_at = datetime.fromisoformat(row["created_at"])
        except (TypeError, ValueError) as exc:
            raise ShiguanStorageError("史馆档案时间无效") from exc
        if created_at.tzinfo is None or created_at.utcoffset() is None:
            raise ShiguanStorageError("史馆档案时间无效")
        if start <= created_at < end:
            selected.append(row)
    return tuple(selected)


def _archive_payload(conn: sqlite3.Connection, row: sqlite3.Row) -> dict[str, object]:
    evidence = [
        {
            "source": item["source"],
            "reality_label": item["reality_label"],
            "note": item["note"],
        }
        for item in conn.execute(
            "SELECT source, reality_label, note FROM archive_evidence "
            "WHERE archive_id = ? ORDER BY id",
            (row["id"],),
        ).fetchall()
    ]
    return {
        "archive_id": row["id"],
        "evidence_ordinal": None,
        "kind": "ARCHIVE",
        "archive_type": row["type"],
        "title": row["title"],
        "content": row["content"],
        "matter_type": row["matter_type"],
        "department": row["department"],
        "created_at": row["created_at"],
        "evidence": evidence,
    }


def _reference_payload(row: sqlite3.Row) -> dict[str, object]:
    snapshot_json = row["snapshot_json"]
    snapshot_hash = hashlib.sha256(snapshot_json.encode("utf-8")).hexdigest()
    if snapshot_hash != row["snapshot_hash"]:
        raise ShiguanStorageError("史馆证据快照校验失败")
    try:
        snapshot = json.loads(snapshot_json)
    except json.JSONDecodeError as exc:
        raise ShiguanStorageError("史馆证据快照校验失败") from exc
    return {
        "archive_id": row["archive_id"],
        "evidence_ordinal": row["ordinal"],
        "kind": "EVIDENCE_REFERENCE",
        "evidence_id": row["evidence_id"],
        "pack_id": row["pack_id"],
        "investigation_id": row["investigation_id"],
        "evidence_snapshot": snapshot,
        "evidence_snapshot_hash": row["snapshot_hash"],
    }


def _insert_fact(
    conn: sqlite3.Connection,
    *,
    run_id: str,
    owner_user_id: str,
    report_date: date,
    payload: dict[str, object],
    created_at: str,
) -> None:
    start, end = report_window(report_date)
    payload = {
        **payload,
        "report_date": report_date.isoformat(),
        "source_window_start": start.isoformat(),
        "source_window_end": end.isoformat(),
    }
    snapshot_json = _canonical_json(payload)
    payload_hash = hashlib.sha256(snapshot_json.encode("utf-8")).hexdigest()
    fact_id = controlled_fact_id(
        owner_user_id,
        str(payload["archive_id"]),
        payload["evidence_ordinal"],
        payload_hash,
    )
    conn.execute(
        "INSERT INTO daily_memorial_fact_snapshots "
        "(id, run_id, fact_id, snapshot_json, created_at) VALUES (?, ?, ?, ?, ?)",
        (fact_id, run_id, fact_id, snapshot_json, created_at),
    )


def freeze_controlled_facts(
    owner_user_id: str,
    report_date: date,
    *,
    db_path: Path | None = None,
) -> tuple[ControlledFact, ...]:
    """Freeze the first owner-scoped Shiguan scan; retries only reload it."""

    conn = db.get_connection(db_path)
    try:
        try:
            conn.execute("BEGIN IMMEDIATE")
            now = datetime.now(UTC)
            run = _get_or_create_run_in_transaction(
                conn, owner_user_id, report_date, now=now
            )
            frozen = _load_facts(
                conn,
                run.id,
                owner_user_id=owner_user_id,
                report_date=report_date,
            )
            if frozen or run.status is RunStatus.SKIPPED_NO_FACTS:
                if frozen:
                    conn.execute(
                        "UPDATE daily_memorial_runs SET fact_refs_json = ? WHERE id = ?",
                        (_canonical_json([fact.fact_id for fact in frozen]), run.id),
                    )
                conn.commit()
                return frozen

            archives = _eligible_archives(conn, owner_user_id, report_date)
            for archive in archives:
                _insert_fact(
                    conn,
                    run_id=run.id,
                    owner_user_id=owner_user_id,
                    report_date=report_date,
                    payload=_archive_payload(conn, archive),
                    created_at=now.isoformat(),
                )
                references = conn.execute(
                    "SELECT archive_id, ordinal, evidence_id, pack_id, investigation_id, "
                    "snapshot_json, snapshot_hash FROM archive_evidence_references "
                    "WHERE archive_id = ? ORDER BY ordinal",
                    (archive["id"],),
                ).fetchall()
                for reference in references:
                    _insert_fact(
                        conn,
                        run_id=run.id,
                        owner_user_id=owner_user_id,
                        report_date=report_date,
                        payload=_reference_payload(reference),
                        created_at=now.isoformat(),
                    )

            frozen = _load_facts(
                conn,
                run.id,
                owner_user_id=owner_user_id,
                report_date=report_date,
            )
            if not frozen:
                conn.execute(
                    "UPDATE daily_memorial_runs SET status = ?, updated_at = ? "
                    "WHERE id = ? AND status = ?",
                    (
                        RunStatus.SKIPPED_NO_FACTS.value,
                        now.isoformat(),
                        run.id,
                        RunStatus.PENDING.value,
                    ),
                )
            else:
                conn.execute(
                    "UPDATE daily_memorial_runs SET fact_refs_json = ?, updated_at = ? "
                    "WHERE id = ?",
                    (
                        _canonical_json([fact.fact_id for fact in frozen]),
                        now.isoformat(),
                        run.id,
                    ),
                )
            conn.commit()
            return frozen
        except (ValueError, TypeError, ShiguanStorageError):
            conn.rollback()
            raise
        except sqlite3.Error as exc:
            conn.rollback()
            raise ShiguanStorageError("每日奏报事实冻结失败") from exc
    finally:
        conn.close()


__all__ = [
    "ControlledFact",
    "controlled_fact_id",
    "freeze_controlled_facts",
    "report_window",
]
