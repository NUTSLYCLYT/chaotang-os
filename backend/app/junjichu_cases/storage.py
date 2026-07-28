"""SQLite persistence for private, owner-scoped Grand Council cases."""

from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.junjichu_cases.models import (
    JunjichuCase,
    JunjichuCaseOpenInput,
    JunjichuCaseStatus,
)

_DEFAULT_DB_PATH = Path(__file__).resolve().parents[2] / "data" / "junjichu_cases.sqlite3"
_STATUS_ORDER = {
    "MINISTRY_REVIEWING": 0,
    "COUNCIL_REVIEWING": 1,
    "CHANCELLOR_FINALIZING": 2,
}
_TERMINAL_STATUSES = frozenset({"ARCHIVED", "FAILED"})
_FIXED_FAILURE_REASON = "processing_failed"


class JunjichuCaseNotFoundError(LookupError):
    """Raised when a case is absent or belongs to a different owner."""


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _resolve_db_path(db_path: Path | None) -> Path:
    return db_path if db_path is not None else _DEFAULT_DB_PATH


def _connect(db_path: Path | None) -> sqlite3.Connection:
    resolved = _resolve_db_path(db_path)
    resolved.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(resolved)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode = WAL")
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS junjichu_cases (
            id TEXT PRIMARY KEY,
            owner_user_id TEXT NOT NULL,
            decree_text TEXT NOT NULL,
            departments_json TEXT NOT NULL,
            status TEXT NOT NULL,
            processing_path_json TEXT NOT NULL,
            completed_ministry_opinions_json TEXT NOT NULL,
            council_verdict TEXT,
            reply_id TEXT,
            failure_reason TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    return connection


def _dump_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def _case_from_row(row: sqlite3.Row) -> JunjichuCase:
    return JunjichuCase(
        id=row["id"],
        owner_user_id=row["owner_user_id"],
        decree_text=row["decree_text"],
        departments=json.loads(row["departments_json"]),
        status=row["status"],
        processing_path=json.loads(row["processing_path_json"]),
        completed_ministry_opinions=json.loads(
            row["completed_ministry_opinions_json"]
        ),
        council_verdict=row["council_verdict"],
        reply_id=row["reply_id"],
        failure_reason=row["failure_reason"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _get_owned_case(
    connection: sqlite3.Connection, case_id: str, owner_user_id: str
) -> JunjichuCase:
    row = connection.execute(
        "SELECT * FROM junjichu_cases WHERE id = ? AND owner_user_id = ?",
        (case_id, owner_user_id),
    ).fetchone()
    if row is None:
        raise JunjichuCaseNotFoundError("case not found")
    return _case_from_row(row)


def _update_case(
    connection: sqlite3.Connection,
    case: JunjichuCase,
    *,
    status: JunjichuCaseStatus,
    processing_path: list[str] | None = None,
    completed_ministry_opinions: list[dict[str, Any]] | None = None,
    council_verdict: str | None = None,
    reply_id: str | None = None,
    failure_reason: str | None = None,
) -> JunjichuCase:
    updated_at = _now_iso()
    next_path = processing_path if processing_path is not None else case.processing_path
    next_opinions = (
        completed_ministry_opinions
        if completed_ministry_opinions is not None
        else case.completed_ministry_opinions
    )
    next_verdict = council_verdict if council_verdict is not None else case.council_verdict
    connection.execute(
        """
        UPDATE junjichu_cases
        SET status = ?, processing_path_json = ?, completed_ministry_opinions_json = ?,
            council_verdict = ?, reply_id = ?, failure_reason = ?, updated_at = ?
        WHERE id = ? AND owner_user_id = ?
        """,
        (
            status,
            _dump_json(next_path),
            _dump_json(next_opinions),
            next_verdict,
            reply_id,
            failure_reason,
            updated_at,
            case.id,
            case.owner_user_id,
        ),
    )
    return case.model_copy(
        update={
            "status": status,
            "processing_path": next_path,
            "completed_ministry_opinions": next_opinions,
            "council_verdict": next_verdict,
            "reply_id": reply_id,
            "failure_reason": failure_reason,
            "updated_at": updated_at,
        }
    )


def open_case(
    case_input: JunjichuCaseOpenInput,
    *,
    owner_user_id: str,
    db_path: Path | None = None,
) -> JunjichuCase:
    """Create a case only for a validated multi-department route."""

    if case_input.route_type != "multi":
        raise ValueError("only multi route cases may be opened")
    if len(case_input.departments) < 2:
        raise ValueError("multi route cases require at least two departments")
    normalized_owner = owner_user_id.strip()
    if not normalized_owner:
        raise ValueError("owner_user_id must not be blank")

    now = _now_iso()
    case = JunjichuCase(
        id=str(uuid.uuid4()),
        owner_user_id=normalized_owner,
        decree_text=case_input.decree_text,
        departments=case_input.departments,
        status="MINISTRY_REVIEWING",
        processing_path=case_input.processing_path,
        created_at=now,
        updated_at=now,
    )
    connection = _connect(db_path)
    try:
        connection.execute(
            """
            INSERT INTO junjichu_cases (
                id, owner_user_id, decree_text, departments_json, status,
                processing_path_json, completed_ministry_opinions_json,
                council_verdict, reply_id, failure_reason, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                case.id,
                case.owner_user_id,
                case.decree_text,
                _dump_json(case.departments),
                case.status,
                _dump_json(case.processing_path),
                _dump_json(case.completed_ministry_opinions),
                None,
                None,
                None,
                case.created_at,
                case.updated_at,
            ),
        )
        connection.commit()
        return case
    finally:
        connection.close()


def record_checkpoint(
    case_id: str,
    *,
    owner_user_id: str,
    status: JunjichuCaseStatus,
    processing_path: list[str] | None = None,
    completed_ministry_opinions: list[dict[str, Any]] | None = None,
    council_verdict: str | None = None,
    reply_id: str | None = None,
    db_path: Path | None = None,
) -> JunjichuCase:
    """Advance a non-terminal case without permitting status rollback."""

    if status in _TERMINAL_STATUSES:
        raise ValueError("terminal statuses require archive_case or fail_case")
    if reply_id is not None:
        raise ValueError("reply_id is only allowed when ARCHIVED")
    connection = _connect(db_path)
    try:
        case = _get_owned_case(connection, case_id, owner_user_id)
        if case.status in _TERMINAL_STATUSES:
            raise ValueError("terminal cases cannot be updated")
        if _STATUS_ORDER[status] < _STATUS_ORDER[case.status]:
            raise ValueError("status rollback is not allowed")
        updated = _update_case(
            connection,
            case,
            status=status,
            processing_path=processing_path,
            completed_ministry_opinions=completed_ministry_opinions,
            council_verdict=council_verdict,
        )
        connection.commit()
        return updated
    finally:
        connection.close()


def archive_case(
    case_id: str,
    *,
    owner_user_id: str,
    reply_id: str,
    db_path: Path | None = None,
) -> JunjichuCase:
    """Attach the sole reply identifier and close a completed case."""

    if not reply_id.strip():
        raise ValueError("reply_id must not be blank")
    connection = _connect(db_path)
    try:
        case = _get_owned_case(connection, case_id, owner_user_id)
        if case.status in _TERMINAL_STATUSES:
            raise ValueError("terminal cases cannot be archived")
        updated = _update_case(
            connection,
            case,
            status="ARCHIVED",
            reply_id=reply_id.strip(),
        )
        connection.commit()
        return updated
    finally:
        connection.close()


def fail_case(
    case_id: str,
    *,
    owner_user_id: str,
    reason: str = _FIXED_FAILURE_REASON,
    db_path: Path | None = None,
) -> JunjichuCase:
    """Close a failed case while persisting only the fixed, safe reason."""

    del reason
    connection = _connect(db_path)
    try:
        case = _get_owned_case(connection, case_id, owner_user_id)
        if case.status in _TERMINAL_STATUSES:
            raise ValueError("terminal cases cannot be failed")
        updated = _update_case(
            connection,
            case,
            status="FAILED",
            failure_reason=_FIXED_FAILURE_REASON,
        )
        connection.commit()
        return updated
    finally:
        connection.close()


def list_cases(
    *, owner_user_id: str, db_path: Path | None = None
) -> list[JunjichuCase]:
    """List only the current owner's cases, newest update first."""

    connection = _connect(db_path)
    try:
        rows = connection.execute(
            """
            SELECT * FROM junjichu_cases
            WHERE owner_user_id = ?
            ORDER BY updated_at DESC, id ASC
            """,
            (owner_user_id,),
        ).fetchall()
        return [_case_from_row(row) for row in rows]
    finally:
        connection.close()


def get_case(
    case_id: str, *, owner_user_id: str, db_path: Path | None = None
) -> JunjichuCase | None:
    """Return a case only when it belongs to the supplied owner."""

    connection = _connect(db_path)
    try:
        row = connection.execute(
            "SELECT * FROM junjichu_cases WHERE id = ? AND owner_user_id = ?",
            (case_id, owner_user_id),
        ).fetchone()
        return _case_from_row(row) if row is not None else None
    finally:
        connection.close()
