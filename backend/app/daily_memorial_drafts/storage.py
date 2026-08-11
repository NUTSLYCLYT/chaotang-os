
"""SQLite persistence for owner/date daily memorial runs."""

from __future__ import annotations

import json
import re
import sqlite3
import uuid
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from app.daily_memorial_drafts.models import (
    ConfirmDailyMemorialRequest,
    ConfirmDailyMemorialResponse,
    DailyMemorialDraft,
    DailyMemorialLatestResponse,
    RunStatus,
)
from app.shiguan import db
from app.shiguan import storage as shiguan_storage
from app.shiguan.errors import ShiguanStorageError
from app.shiguan.models import ArchiveCreate

_SHANGHAI = ZoneInfo("Asia/Shanghai")
_SHA256 = re.compile(r"^[0-9a-f]{64}$")


class DailyMemorialNotFoundError(Exception):
    """The requested owner-scoped draft does not exist."""


class DailyMemorialConflictError(Exception):
    """The reviewed snapshot is stale or cannot currently be confirmed."""


class DailyMemorialStorageError(ShiguanStorageError):
    """A sanitized daily-memorial persistence failure."""


@dataclass(frozen=True, slots=True)
class DailyMemorialRun:
    """Immutable application view of one persisted owner/date run."""

    id: str
    owner_user_id: str
    report_date: date
    source_window_start: datetime
    source_window_end: datetime
    status: RunStatus
    version: int
    fingerprint: str | None
    content: str | None
    fact_refs: tuple[str, ...]
    failure_code: str | None
    confirmed_memorial_id: str | None
    created_at: datetime
    updated_at: datetime
    confirmed_at: datetime | None


def report_window(report_date: date) -> tuple[datetime, datetime]:
    """Return the exact Asia/Shanghai calendar-day half-open interval."""

    if not isinstance(report_date, date) or isinstance(report_date, datetime):
        raise TypeError("report_date must be a date")
    start = datetime.combine(report_date, time.min, tzinfo=_SHANGHAI)
    return start, start + timedelta(days=1)


def _parse_datetime(value: str | None) -> datetime | None:
    return None if value is None else datetime.fromisoformat(value)


def _run_from_row(row: sqlite3.Row) -> DailyMemorialRun:
    return DailyMemorialRun(
        id=row["id"],
        owner_user_id=row["owner_user_id"],
        report_date=date.fromisoformat(row["report_date"]),
        source_window_start=datetime.fromisoformat(row["source_window_start"]),
        source_window_end=datetime.fromisoformat(row["source_window_end"]),
        status=RunStatus(row["status"]),
        version=row["version"],
        fingerprint=row["fingerprint"],
        content=row["content"],
        fact_refs=tuple(json.loads(row["fact_refs_json"])),
        failure_code=row["failure_code"],
        confirmed_memorial_id=row["confirmed_memorial_id"],
        created_at=datetime.fromisoformat(row["created_at"]),
        updated_at=datetime.fromisoformat(row["updated_at"]),
        confirmed_at=_parse_datetime(row["confirmed_at"]),
    )


def _get_or_create_run_in_transaction(
    conn: sqlite3.Connection,
    owner_user_id: str,
    report_date: date,
    *,
    now: datetime,
) -> DailyMemorialRun:
    if not isinstance(owner_user_id, str) or not owner_user_id.strip():
        raise ValueError("owner_user_id must not be blank")
    if owner_user_id != owner_user_id.strip():
        raise ValueError("owner_user_id must be canonical")
    if not isinstance(now, datetime) or now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("now must include a timezone")
    start, end = report_window(report_date)
    run_id = uuid.uuid4().hex
    timestamp = now.isoformat()
    conn.execute(
        "INSERT INTO daily_memorial_runs "
        "(id, owner_user_id, report_date, source_window_start, source_window_end, "
        "status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) "
        "ON CONFLICT(owner_user_id, report_date) DO NOTHING",
        (
            run_id,
            owner_user_id,
            report_date.isoformat(),
            start.isoformat(),
            end.isoformat(),
            RunStatus.PENDING.value,
            timestamp,
            timestamp,
        ),
    )
    row = conn.execute(
        "SELECT * FROM daily_memorial_runs WHERE owner_user_id = ? AND report_date = ?",
        (owner_user_id, report_date.isoformat()),
    ).fetchone()
    if row is None:
        raise sqlite3.DatabaseError("daily memorial run was not persisted")
    return _run_from_row(row)


def get_or_create_run(
    owner_user_id: str,
    report_date: date,
    *,
    now: datetime,
    db_path: Path | None = None,
) -> DailyMemorialRun:
    """Atomically return the single run for an owner and report date."""

    conn = db.get_connection(db_path)
    try:
        try:
            conn.execute("BEGIN IMMEDIATE")
            run = _get_or_create_run_in_transaction(
                conn, owner_user_id, report_date, now=now
            )
            conn.commit()
            return run
        except (ValueError, TypeError):
            conn.rollback()
            raise
        except sqlite3.Error as exc:
            conn.rollback()
            raise ShiguanStorageError("每日奏报存储暂时不可用") from exc
    finally:
        conn.close()


def _validated_fact_refs(conn: sqlite3.Connection, run: DailyMemorialRun) -> tuple[str, ...]:
    refs = run.fact_refs
    if not refs or any(not isinstance(ref, str) or not ref.strip() for ref in refs):
        raise DailyMemorialConflictError("每日奏报待审稿不可确认")
    if len(refs) != len(set(refs)):
        raise DailyMemorialConflictError("每日奏报待审稿不可确认")
    placeholders = ",".join("?" for _ in refs)
    count = conn.execute(
        "SELECT COUNT(DISTINCT fact_id) FROM daily_memorial_fact_snapshots "
        f"WHERE run_id = ? AND fact_id IN ({placeholders})",
        (run.id, *refs),
    ).fetchone()[0]
    if count != len(refs):
        raise DailyMemorialConflictError("每日奏报待审稿不可确认")
    return refs


def _expected_draft_from_checkpoint(
    conn: sqlite3.Connection, run: DailyMemorialRun
):
    """Rebuild Task 4's canonical draft from its terminal checkpoint."""

    from app.agents.ministries import MINISTRIES
    from app.daily_memorial_drafts.models import ChancellorDailyResult, StageKind
    from app.daily_memorial_drafts.workflow import (
        _aggregate_fingerprint,
        _load_run_and_facts,
        adapt_chancellor_result_to_draft,
    )

    checkpoint_rows = conn.execute(
        "SELECT input_fingerprint, output_json, fact_refs_json, status "
        "FROM daily_memorial_stage_results WHERE run_id = ? "
        "AND stage = 'CHANCELLOR' AND unit_key = 'chancellor'",
        (run.id,),
    ).fetchall()
    if len(checkpoint_rows) != 1:
        raise DailyMemorialConflictError("每日奏报待审稿不可确认")
    checkpoint = checkpoint_rows[0]
    if (
        checkpoint["status"] != "READY"
        or not isinstance(checkpoint["input_fingerprint"], str)
        or _SHA256.fullmatch(checkpoint["input_fingerprint"]) is None
    ):
        raise DailyMemorialConflictError("每日奏报待审稿不可确认")
    try:
        result = ChancellorDailyResult.model_validate_json(checkpoint["output_json"])
        checkpoint_refs = tuple(json.loads(checkpoint["fact_refs_json"]))
    except Exception as exc:
        raise DailyMemorialConflictError("每日奏报待审稿不可确认") from exc
    expected_start, expected_end = report_window(run.report_date)
    if (
        run.source_window_start != expected_start
        or run.source_window_end != expected_end
        or result.report_date != run.report_date
        or result.fact_cutoff != run.source_window_end.isoformat()
        or tuple(section.department for section in result.ministry_sections) != MINISTRIES
        or checkpoint_refs != tuple(result.fact_refs)
    ):
        raise DailyMemorialConflictError("每日奏报待审稿不可确认")
    ministry_rows = conn.execute(
        "SELECT * "
        "FROM daily_memorial_stage_results WHERE run_id = ? AND stage = 'MINISTRY'",
        (run.id,),
    ).fetchall()
    by_key = {row["unit_key"]: row for row in ministry_rows}
    if len(ministry_rows) != len(MINISTRIES) or set(by_key) != set(MINISTRIES):
        raise DailyMemorialConflictError("每日奏报待审稿不可确认")
    input_fingerprints: list[str] = []
    for department in MINISTRIES:
        ministry_row = by_key[department]
        fingerprint = ministry_row["input_fingerprint"]
        if (
            ministry_row["status"] != "READY"
            or not isinstance(fingerprint, str)
            or _SHA256.fullmatch(fingerprint) is None
        ):
            raise DailyMemorialConflictError("每日奏报待审稿不可确认")
        input_fingerprints.append(fingerprint)
    current_run_row, current_facts = _load_run_and_facts(conn, run.id)
    aggregate_fingerprint = _aggregate_fingerprint(
        StageKind.CHANCELLOR,
        "chancellor",
        current_run_row,
        current_facts,
        tuple(by_key[department] for department in MINISTRIES),
    )
    if checkpoint["input_fingerprint"] != aggregate_fingerprint:
        raise DailyMemorialConflictError("每日奏报待审稿已变更")
    return adapt_chancellor_result_to_draft(
        result,
        input_fingerprints=tuple(input_fingerprints),
    )


def _draft_from_run(conn: sqlite3.Connection, run: DailyMemorialRun) -> DailyMemorialDraft:
    if run.fingerprint is None or run.content is None or not run.content.strip():
        raise DailyMemorialStorageError("每日奏报存储暂时不可用")
    refs = _validated_fact_refs(conn, run)
    bureau_count = conn.execute(
        "SELECT COUNT(*) FROM daily_memorial_stage_results "
        "WHERE run_id = ? AND stage = 'BUREAU' AND status IN ('READY', 'NO_MATERIAL')",
        (run.id,),
    ).fetchone()[0]
    ministry_count = conn.execute(
        "SELECT COUNT(*) FROM daily_memorial_stage_results "
        "WHERE run_id = ? AND stage = 'MINISTRY' AND status = 'READY'",
        (run.id,),
    ).fetchone()[0]
    try:
        return DailyMemorialDraft(
            id=run.id,
            report_date=run.report_date,
            source_window_start=run.source_window_start,
            source_window_end=run.source_window_end,
            version=run.version,
            fingerprint=run.fingerprint,
            bureau_result_count=bureau_count,
            ministry_result_count=ministry_count,
            content=run.content,
            fact_refs=list(refs),
        )
    except Exception as exc:
        raise DailyMemorialStorageError("每日奏报存储暂时不可用") from exc


def get_latest_run(
    owner_user_id: str, *, db_path: Path | None = None
) -> DailyMemorialLatestResponse | None:
    """Return only the newest run owned by ``owner_user_id``."""

    conn = db.get_connection(db_path)
    try:
        try:
            row = conn.execute(
                "SELECT * FROM daily_memorial_runs WHERE owner_user_id = ? "
                "ORDER BY report_date DESC, created_at DESC, id ASC LIMIT 1",
                (owner_user_id,),
            ).fetchone()
            if row is None:
                return None
            run = _run_from_row(row)
            draft = (
                _draft_from_run(conn, run)
                if run.status in {RunStatus.READY_FOR_REVIEW, RunStatus.CONFIRMED}
                else None
            )
            return DailyMemorialLatestResponse(
                status=run.status,
                draft=draft,
                memorial_id=run.confirmed_memorial_id,
                failure_code=run.failure_code,
            )
        except DailyMemorialStorageError:
            raise
        except Exception as exc:
            raise DailyMemorialStorageError("每日奏报存储暂时不可用") from exc
    finally:
        conn.close()


def confirm_draft(
    draft_id: str,
    request: ConfirmDailyMemorialRequest,
    *,
    owner_user_id: str,
    now: datetime,
    db_path: Path | None = None,
) -> ConfirmDailyMemorialResponse:
    """Atomically turn one exact reviewed snapshot into one real MEMORIAL."""

    conn = db.get_connection(db_path)
    try:
        try:
            conn.execute("BEGIN IMMEDIATE")
            row = conn.execute(
                "SELECT * FROM daily_memorial_runs WHERE id = ? AND owner_user_id = ?",
                (draft_id, owner_user_id),
            ).fetchone()
            if row is None:
                raise DailyMemorialNotFoundError("每日奏报待审稿不存在")
            run = _run_from_row(row)
            if run.status is RunStatus.CONFIRMED:
                if (
                    run.version == request.version
                    and run.fingerprint == request.fingerprint
                    and run.confirmed_memorial_id is not None
                ):
                    conn.commit()
                    return ConfirmDailyMemorialResponse(
                        status=RunStatus.CONFIRMED,
                        draft_id=run.id,
                        memorial_id=run.confirmed_memorial_id,
                    )
                raise DailyMemorialConflictError("每日奏报待审稿已变更")
            if (
                run.status is not RunStatus.READY_FOR_REVIEW
                or run.content is None
                or not run.content.strip()
            ):
                raise DailyMemorialConflictError("每日奏报待审稿不可确认")
            expected_draft = _expected_draft_from_checkpoint(conn, run)
            if (
                run.version != 1
                or run.content != expected_draft.content
                or run.fact_refs != expected_draft.fact_refs
                or run.fingerprint != expected_draft.fingerprint
                or request.version != run.version
                or request.fingerprint != run.fingerprint
            ):
                raise DailyMemorialConflictError("每日奏报待审稿已变更")
            _validated_fact_refs(conn, run)
            archive_payload = ArchiveCreate(
                type="MEMORIAL",
                title=f"每日奏报（{run.report_date.isoformat()}）",
                content=run.content,
                matter_type="每日奏报",
                department="丞相",
            )
            if archive_payload.content != run.content:
                raise DailyMemorialConflictError("每日奏报待审稿不可确认")
            archive = shiguan_storage.insert_archive_in_transaction(
                conn,
                archive_payload,
                owner_user_id=owner_user_id,
            )
            updated = conn.execute(
                "UPDATE daily_memorial_runs SET status = 'CONFIRMED', "
                "confirmed_memorial_id = ?, confirmed_at = ?, updated_at = ? "
                "WHERE id = ? AND owner_user_id = ? AND status = 'READY_FOR_REVIEW' "
                "AND version = ? AND fingerprint = ?",
                (
                    archive.id,
                    now.isoformat(),
                    now.isoformat(),
                    run.id,
                    owner_user_id,
                    request.version,
                    request.fingerprint,
                ),
            )
            if updated.rowcount != 1:
                raise DailyMemorialConflictError("每日奏报待审稿已变更")
            conn.commit()
            return ConfirmDailyMemorialResponse(
                status=RunStatus.CONFIRMED,
                draft_id=run.id,
                memorial_id=archive.id,
            )
        except (DailyMemorialNotFoundError, DailyMemorialConflictError):
            conn.rollback()
            raise
        except Exception as exc:
            conn.rollback()
            raise DailyMemorialStorageError("每日奏报确认暂时不可用") from exc
    finally:
        conn.close()


__all__ = [
    "DailyMemorialConflictError",
    "DailyMemorialNotFoundError",
    "DailyMemorialRun",
    "DailyMemorialStorageError",
    "confirm_draft",
    "get_latest_run",
    "get_or_create_run",
    "report_window",
]
