"""SQLite persistence for private, owner-scoped Grand Council cases."""

from __future__ import annotations

import hashlib
import json
import sqlite3
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.agents.ministries.prompts import MINISTRY_POSITIONINGS
from app.agents.runtime_skills.models import (
    AgentLayer,
    CouncilReport,
    MinistryReport,
)
from app.agents.runtime_skills.registry import (
    DownstreamSkillRegistryError,
    build_default_downstream_skill_registry,
    runtime_skill_definition_digest,
)
from app.agents.runtime_skills.roles.ministries import MINISTRY_SKILLS
from app.junjichu_cases.models import (
    JunjichuCase,
    JunjichuCaseOpenInput,
    JunjichuCaseStatus,
    JunjichuRuntimeReportRecord,
    JunjichuRuntimeReportSnapshot,
)

_DEFAULT_DB_PATH = Path(__file__).resolve().parents[2] / "data" / "junjichu_cases.sqlite3"
_STATUS_ORDER = {
    "MINISTRY_REVIEWING": 0,
    "COUNCIL_REVIEWING": 1,
    "CHANCELLOR_FINALIZING": 2,
}
_TERMINAL_STATUSES = frozenset({"ARCHIVED", "FAILED"})
_FIXED_FAILURE_REASON = "processing_failed"
_ALLOWED_FAILURE_STAGES = frozenset(
    {"route", "bureau", "ministry", "council", "finalize", "archive"}
)
_ALLOWED_FAILURE_CODES = frozenset(
    {
        "schema_invalid",
        "content_unsupported",
        "provider_unavailable",
        "state_invalid",
    }
)


def _sequence_is_prefix(candidate: list[Any], complete: list[Any]) -> bool:
    """Return whether a replayed checkpoint is an exact persisted prefix."""

    return len(candidate) <= len(complete) and complete[: len(candidate)] == candidate


class JunjichuCaseNotFoundError(LookupError):
    """Raised when a case is absent or belongs to a different owner."""


class JunjichuRuntimeReportError(RuntimeError):
    """Stable, redacted failure at the typed council report boundary."""


_DEPARTMENT_BY_MINISTRY_AGENT = {
    skill.agent_id: positioning.department
    for skill, positioning in zip(
        MINISTRY_SKILLS, MINISTRY_POSITIONINGS, strict=True
    )
}


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
            failure_stage TEXT,
            failure_code TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    columns = {
        row["name"]
        for row in connection.execute("PRAGMA table_info(junjichu_cases)").fetchall()
    }
    if "failure_stage" not in columns:
        connection.execute("ALTER TABLE junjichu_cases ADD COLUMN failure_stage TEXT")
    if "failure_code" not in columns:
        connection.execute("ALTER TABLE junjichu_cases ADD COLUMN failure_code TEXT")
    binding_columns = {
        "run_id": "TEXT",
        "decree_id": "TEXT",
        "draft_fingerprint": "TEXT",
        "route_digest": "TEXT",
    }
    for name, definition in binding_columns.items():
        if name not in columns:
            connection.execute(
                f"ALTER TABLE junjichu_cases ADD COLUMN {name} {definition}"
            )
    connection.executescript(
        """
        CREATE TRIGGER IF NOT EXISTS junjichu_case_execution_binding_immutable
        BEFORE UPDATE OF run_id, decree_id, draft_fingerprint, route_digest
        ON junjichu_cases
        WHEN OLD.run_id IS NOT NEW.run_id
          OR OLD.decree_id IS NOT NEW.decree_id
          OR OLD.draft_fingerprint IS NOT NEW.draft_fingerprint
          OR OLD.route_digest IS NOT NEW.route_digest
        BEGIN
            SELECT RAISE(ABORT, 'case execution binding is immutable');
        END;

        CREATE TRIGGER IF NOT EXISTS junjichu_case_terminal_immutable
        BEFORE UPDATE ON junjichu_cases
        WHEN OLD.status IN ('ARCHIVED', 'FAILED')
        BEGIN
            SELECT RAISE(ABORT, 'terminal case is immutable');
        END;

        CREATE TABLE IF NOT EXISTS junjichu_runtime_reports (
            case_id TEXT NOT NULL,
            owner_user_id TEXT NOT NULL,
            run_id TEXT NOT NULL,
            report_kind TEXT NOT NULL,
            position INTEGER NOT NULL,
            report_id TEXT NOT NULL,
            agent_id TEXT NOT NULL,
            skill_id TEXT NOT NULL,
            skill_version TEXT NOT NULL,
            skill_definition_digest TEXT NOT NULL,
            content_digest TEXT NOT NULL,
            canonical_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            PRIMARY KEY (case_id, report_kind, position),
            UNIQUE (case_id, report_id),
            FOREIGN KEY (case_id) REFERENCES junjichu_cases(id)
        );
        CREATE TRIGGER IF NOT EXISTS junjichu_runtime_reports_no_update
        BEFORE UPDATE ON junjichu_runtime_reports
        BEGIN
            SELECT RAISE(ABORT, 'runtime report is immutable');
        END;
        CREATE TRIGGER IF NOT EXISTS junjichu_runtime_reports_no_delete
        BEFORE DELETE ON junjichu_runtime_reports
        BEGIN
            SELECT RAISE(ABORT, 'runtime report is immutable');
        END;
        """
    )
    report_columns = {
        str(row[1])
        for row in connection.execute(
            "PRAGMA table_info(junjichu_runtime_reports)"
        ).fetchall()
    }
    if "skill_definition_digest" not in report_columns:
        # Existing report rows intentionally remain NULL and therefore fail
        # closed on reload; their historical definition cannot be reconstructed.
        connection.execute(
            "ALTER TABLE junjichu_runtime_reports "
            "ADD COLUMN skill_definition_digest TEXT"
        )
    connection.commit()
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
        run_id=row["run_id"],
        decree_id=row["decree_id"],
        draft_fingerprint=row["draft_fingerprint"],
        route_digest=row["route_digest"],
        completed_ministry_opinions=json.loads(
            row["completed_ministry_opinions_json"]
        ),
        council_verdict=row["council_verdict"],
        reply_id=row["reply_id"],
        failure_reason=row["failure_reason"],
        failure_stage=row["failure_stage"],
        failure_code=row["failure_code"],
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
    failure_stage: str | None = None,
    failure_code: str | None = None,
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
            council_verdict = ?, reply_id = ?, failure_reason = ?,
            failure_stage = ?, failure_code = ?, updated_at = ?
        WHERE id = ? AND owner_user_id = ?
        """,
        (
            status,
            _dump_json(next_path),
            _dump_json(next_opinions),
            next_verdict,
            reply_id,
            failure_reason,
            failure_stage,
            failure_code,
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
            "failure_stage": failure_stage,
            "failure_code": failure_code,
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

    connection = _connect(db_path)
    try:
        connection.execute("BEGIN IMMEDIATE")
        if case_input.run_id is not None:
            existing_rows = connection.execute(
                "SELECT * FROM junjichu_cases "
                "WHERE owner_user_id = ? AND run_id = ? ORDER BY created_at, id",
                (normalized_owner, case_input.run_id),
            ).fetchall()
            if len(existing_rows) > 1:
                connection.rollback()
                raise ValueError("case execution binding is not unique")
            if existing_rows:
                existing = _case_from_row(existing_rows[0])
                if existing.status in _TERMINAL_STATUSES:
                    connection.rollback()
                    raise ValueError("terminal case cannot be reopened")
                if not case_input.processing_path:
                    connection.rollback()
                    raise ValueError("case replay requires a processing path")
                if (
                    existing.decree_id != case_input.decree_id
                    or existing.draft_fingerprint != case_input.draft_fingerprint
                    or existing.route_digest != case_input.route_digest
                    or existing.decree_text != case_input.decree_text
                    or existing.departments != case_input.departments
                    or not _sequence_is_prefix(
                        case_input.processing_path, existing.processing_path
                    )
                ):
                    connection.rollback()
                    raise ValueError("case execution binding conflict")
                connection.commit()
                return existing
        now = _now_iso()
        case = JunjichuCase(
            id=str(uuid.uuid4()),
            owner_user_id=normalized_owner,
            decree_text=case_input.decree_text,
            departments=case_input.departments,
            status="MINISTRY_REVIEWING",
            processing_path=case_input.processing_path,
            run_id=case_input.run_id,
            decree_id=case_input.decree_id,
            draft_fingerprint=case_input.draft_fingerprint,
            route_digest=case_input.route_digest,
            created_at=now,
            updated_at=now,
        )
        connection.execute(
            """
            INSERT INTO junjichu_cases (
                id, owner_user_id, decree_text, departments_json, status,
                processing_path_json, completed_ministry_opinions_json,
                council_verdict, reply_id, failure_reason, failure_stage,
                failure_code, run_id, decree_id, draft_fingerprint,
                route_digest, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                None,
                None,
                case_input.run_id,
                case_input.decree_id,
                case_input.draft_fingerprint,
                case_input.route_digest,
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
        if _STATUS_ORDER[status] <= _STATUS_ORDER[case.status] and (
            (processing_path is not None and not processing_path)
            or (
                completed_ministry_opinions is not None
                and not completed_ministry_opinions
            )
        ):
            raise ValueError("checkpoint replay fields must not be empty")
        if _STATUS_ORDER[status] < _STATUS_ORDER[case.status]:
            has_replay_state = any(
                value is not None
                for value in (
                    processing_path,
                    completed_ministry_opinions,
                    council_verdict,
                )
            )
            if not has_replay_state or (
                processing_path is not None
                and not _sequence_is_prefix(processing_path, case.processing_path)
            ) or (
                completed_ministry_opinions is not None
                and not _sequence_is_prefix(
                    completed_ministry_opinions,
                    case.completed_ministry_opinions,
                )
            ) or (
                council_verdict is not None
                and council_verdict != case.council_verdict
            ):
                raise ValueError("status rollback is not allowed")
            return case
        if status == case.status == "CHANCELLOR_FINALIZING":
            if (
                processing_path is not None
                and processing_path != case.processing_path
            ) or (
                completed_ministry_opinions is not None
                and completed_ministry_opinions
                != case.completed_ministry_opinions
            ) or (
                council_verdict is not None
                and council_verdict != case.council_verdict
            ):
                raise ValueError("finalizing checkpoint replay conflict")
            return case
        if status == case.status:
            if status == "MINISTRY_REVIEWING":
                if processing_path is not None and not _sequence_is_prefix(
                    case.processing_path, processing_path
                ):
                    raise ValueError("same-status checkpoint conflict")
                if completed_ministry_opinions is not None and not _sequence_is_prefix(
                    case.completed_ministry_opinions,
                    completed_ministry_opinions,
                ):
                    raise ValueError("same-status checkpoint conflict")
                if (
                    council_verdict is not None
                    and council_verdict != case.council_verdict
                ):
                    raise ValueError("same-status checkpoint conflict")
            else:
                if (
                    processing_path is not None
                    and processing_path != case.processing_path
                ) or (
                    completed_ministry_opinions is not None
                    and completed_ministry_opinions
                    != case.completed_ministry_opinions
                ) or (
                    case.council_verdict is not None
                    and council_verdict is not None
                    and council_verdict != case.council_verdict
                ):
                    raise ValueError("same-status checkpoint conflict")
        elif _STATUS_ORDER[status] > _STATUS_ORDER[case.status]:
            if processing_path == []:
                processing_path = None
            if completed_ministry_opinions == []:
                completed_ministry_opinions = None
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


def validate_case_archive_preconditions(
    case: JunjichuCase,
    *,
    reply_id: str,
    expected_run_id: str | None = None,
    expected_decree_id: str | None = None,
    expected_draft_fingerprint: str | None = None,
    expected_route_digest: str | None = None,
    expected_departments: tuple[str, ...] | None = None,
    expected_council_verdict: str | None = None,
) -> None:
    """Fail closed unless one loaded case may bind the exact reply."""
    if not reply_id.strip():
        raise ValueError("reply_id must not be blank")
    expected_binding = (
        expected_run_id,
        expected_decree_id,
        expected_draft_fingerprint,
        expected_route_digest,
        expected_departments,
    )
    if any(value is not None for value in expected_binding) and any(
        value is None for value in expected_binding
    ):
        raise ValueError("expected case execution binding is incomplete")
    if expected_run_id is not None and (
        case.run_id != expected_run_id
        or case.decree_id != expected_decree_id
        or case.draft_fingerprint != expected_draft_fingerprint
        or case.route_digest != expected_route_digest
        or tuple(case.departments) != expected_departments
    ):
        raise ValueError("case execution binding mismatch")
    if case.status in _TERMINAL_STATUSES:
        if case.status == "ARCHIVED" and case.reply_id == reply_id.strip():
            return
        raise ValueError("terminal cases cannot be archived")
    if case.status != "CHANCELLOR_FINALIZING":
        raise ValueError("case must reach CHANCELLOR_FINALIZING before archive")
    if case.council_verdict is None or not case.council_verdict.strip():
        raise ValueError("council verdict is required before archive")
    if (
        expected_council_verdict is not None
        and case.council_verdict != expected_council_verdict
    ):
        raise ValueError("council verdict binding mismatch")


def archive_case(
    case_id: str,
    *,
    owner_user_id: str,
    reply_id: str,
    expected_run_id: str | None = None,
    expected_decree_id: str | None = None,
    expected_draft_fingerprint: str | None = None,
    expected_route_digest: str | None = None,
    expected_departments: tuple[str, ...] | None = None,
    expected_council_verdict: str | None = None,
    db_path: Path | None = None,
) -> JunjichuCase:
    """Attach the sole reply identifier and close a completed case."""

    connection = _connect(db_path)
    try:
        case = _get_owned_case(connection, case_id, owner_user_id)
        validate_case_archive_preconditions(
            case,
            reply_id=reply_id,
            expected_run_id=expected_run_id,
            expected_decree_id=expected_decree_id,
            expected_draft_fingerprint=expected_draft_fingerprint,
            expected_route_digest=expected_route_digest,
            expected_departments=expected_departments,
            expected_council_verdict=expected_council_verdict,
        )
        if case.status == "ARCHIVED":
            return case
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
    failure_stage: str = "route",
    failure_code: str = "state_invalid",
    db_path: Path | None = None,
) -> JunjichuCase:
    """Close a failed case while persisting only the fixed, safe reason."""

    del reason
    if (
        failure_stage not in _ALLOWED_FAILURE_STAGES
        or failure_code not in _ALLOWED_FAILURE_CODES
    ):
        failure_stage, failure_code = "route", "state_invalid"
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
            failure_stage=failure_stage,
            failure_code=failure_code,
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


def _canonical_runtime_report(report: MinistryReport | CouncilReport) -> str:
    return _dump_json(report.model_dump(mode="json"))


def _runtime_report_digest(report: MinistryReport | CouncilReport) -> str:
    return hashlib.sha256(_canonical_runtime_report(report).encode("utf-8")).hexdigest()


def _runtime_report_is_semantic_replay(
    persisted: MinistryReport | CouncilReport,
    candidate: MinistryReport | CouncilReport,
) -> bool:
    """Treat the first persisted timestamp as storage metadata during retry."""

    return type(persisted) is type(candidate) and persisted.model_dump(
        exclude={"created_at"}
    ) == candidate.model_dump(exclude={"created_at"})


def _bound_case_for_runtime_reports(
    connection: sqlite3.Connection,
    *,
    case_id: str,
    owner_user_id: str,
    run_id: str,
) -> JunjichuCase:
    try:
        case = _get_owned_case(connection, case_id, owner_user_id)
    except JunjichuCaseNotFoundError as exc:
        raise JunjichuRuntimeReportError(
            "record_not_found_or_not_authorized"
        ) from exc
    if case.run_id is None or case.decree_id is None:
        raise JunjichuRuntimeReportError("case_execution_binding_unavailable")
    if case.draft_fingerprint is None or case.route_digest is None:
        raise JunjichuRuntimeReportError("case_execution_binding_unavailable")
    if case.run_id != run_id or case.decree_id != run_id:
        raise JunjichuRuntimeReportError("record_not_found_or_not_authorized")
    return case


def _runtime_report_record_from_row(
    row: sqlite3.Row,
) -> JunjichuRuntimeReportRecord:
    try:
        report_kind = row["report_kind"]
        report_type = MinistryReport if report_kind == "ministry" else CouncilReport
        if report_kind not in {"ministry", "council"}:
            raise ValueError("invalid report kind")
        report = report_type.model_validate_json(row["canonical_json"])
        stored_at = datetime.fromisoformat(row["created_at"])
        if stored_at.utcoffset() is None:
            raise ValueError("runtime report timestamp must be timezone-aware")
        if (
            _canonical_runtime_report(report) != row["canonical_json"]
            or _runtime_report_digest(report) != row["content_digest"]
            or report.report_id != row["report_id"]
            or report.agent_id != row["agent_id"]
            or report.skill_id != row["skill_id"]
            or report.skill_version != row["skill_version"]
            or report.created_at.astimezone(UTC) != stored_at.astimezone(UTC)
        ):
            raise ValueError("runtime report row metadata drift")
        return JunjichuRuntimeReportRecord(
            case_id=row["case_id"],
            owner_user_id=row["owner_user_id"],
            run_id=row["run_id"],
            report_kind=report_kind,
            position=row["position"],
            report_id=row["report_id"],
            content_digest=row["content_digest"],
            skill_definition_digest=row["skill_definition_digest"],
            report=report,
            created_at=stored_at,
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise JunjichuRuntimeReportError(
            "runtime_report_store_unavailable"
        ) from exc


def _existing_report_record(
    connection: sqlite3.Connection,
    *,
    case_id: str,
    report_id: str,
) -> JunjichuRuntimeReportRecord | None:
    row = connection.execute(
        "SELECT * FROM junjichu_runtime_reports "
        "WHERE case_id = ? AND report_id = ?",
        (case_id, report_id),
    ).fetchone()
    return None if row is None else _runtime_report_record_from_row(row)


def _require_record_scope(
    record: JunjichuRuntimeReportRecord,
    case: JunjichuCase,
) -> None:
    if (
        record.case_id != case.id
        or record.owner_user_id != case.owner_user_id
        or record.run_id != case.run_id
    ):
        raise JunjichuRuntimeReportError("runtime_report_store_unavailable")
    if record.report_kind == "council":
        if record.position != 0:
            raise JunjichuRuntimeReportError("runtime_report_store_unavailable")
        return
    try:
        department = _DEPARTMENT_BY_MINISTRY_AGENT[record.report.agent_id]
        expected_position = case.departments.index(department)
    except (KeyError, ValueError) as exc:
        raise JunjichuRuntimeReportError(
            "runtime_report_store_unavailable"
        ) from exc
    if record.position != expected_position:
        raise JunjichuRuntimeReportError("runtime_report_store_unavailable")


def _insert_runtime_report(
    connection: sqlite3.Connection,
    *,
    case: JunjichuCase,
    report_kind: str,
    position: int,
    report: MinistryReport | CouncilReport,
) -> JunjichuRuntimeReportRecord:
    canonical = _canonical_runtime_report(report)
    content_digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    try:
        skill = build_default_downstream_skill_registry().get_by_agent(report.agent_id)
    except DownstreamSkillRegistryError as exc:
        raise JunjichuRuntimeReportError("runtime_report_skill_unavailable") from exc
    definition_digest = runtime_skill_definition_digest(skill)
    existing = _existing_report_record(
        connection, case_id=case.id, report_id=report.report_id
    )
    if existing is not None:
        _require_record_scope(existing, case)
        if (
            existing.report_kind != report_kind
            or existing.position != position
            or existing.skill_definition_digest != definition_digest
            or not _runtime_report_is_semantic_replay(existing.report, report)
        ):
            raise JunjichuRuntimeReportError("runtime_report_conflict")
        return existing
    try:
        connection.execute(
            """
            INSERT INTO junjichu_runtime_reports (
                case_id, owner_user_id, run_id, report_kind, position,
                report_id, agent_id, skill_id, skill_version,
                skill_definition_digest, content_digest, canonical_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                case.id,
                case.owner_user_id,
                case.run_id,
                report_kind,
                position,
                report.report_id,
                report.agent_id,
                report.skill_id,
                report.skill_version,
                definition_digest,
                content_digest,
                canonical,
                report.created_at.astimezone(UTC).isoformat(),
            ),
        )
    except sqlite3.IntegrityError as exc:
        raise JunjichuRuntimeReportError("runtime_report_conflict") from exc
    row = connection.execute(
        "SELECT * FROM junjichu_runtime_reports "
        "WHERE case_id = ? AND report_id = ?",
        (case.id, report.report_id),
    ).fetchone()
    if row is None:
        raise JunjichuRuntimeReportError("runtime_report_store_unavailable")
    return _runtime_report_record_from_row(row)


def _validate_ministry_report(report: MinistryReport) -> str:
    try:
        skill = build_default_downstream_skill_registry().get_by_agent(report.agent_id)
        department = _DEPARTMENT_BY_MINISTRY_AGENT[report.agent_id]
    except (DownstreamSkillRegistryError, KeyError) as exc:
        raise JunjichuRuntimeReportError("unknown_ministry_report") from exc
    if (
        skill.layer is not AgentLayer.MINISTRY
        or report.skill_id != skill.skill_id
        or report.skill_version != skill.version
    ):
        raise JunjichuRuntimeReportError("ministry_report_skill_binding_mismatch")
    return department


def append_runtime_ministry_report(
    case_id: str,
    *,
    owner_user_id: str,
    run_id: str,
    report: MinistryReport,
    db_path: Path | None = None,
) -> JunjichuRuntimeReportRecord:
    """Append one exact, registry-bound ministry report in approved case order."""

    if not isinstance(report, MinistryReport):
        raise TypeError("report must be MinistryReport")
    connection = _connect(db_path)
    try:
        connection.execute("BEGIN IMMEDIATE")
        case = _bound_case_for_runtime_reports(
            connection,
            case_id=case_id,
            owner_user_id=owner_user_id,
            run_id=run_id,
        )
        if case.status in _TERMINAL_STATUSES:
            raise JunjichuRuntimeReportError("case_lifecycle_mismatch")
        department = _validate_ministry_report(report)
        existing = _existing_report_record(
            connection, case_id=case.id, report_id=report.report_id
        )
        if existing is not None:
            _require_record_scope(existing, case)
            position = existing.position
        else:
            if case.status != "MINISTRY_REVIEWING":
                raise JunjichuRuntimeReportError("case_lifecycle_mismatch")
            position = connection.execute(
                "SELECT COUNT(*) FROM junjichu_runtime_reports "
                "WHERE case_id = ? AND report_kind = 'ministry'",
                (case.id,),
            ).fetchone()[0]
        if position >= len(case.departments) or case.departments[position] != department:
            raise JunjichuRuntimeReportError("ministry_report_order_mismatch")
        record = _insert_runtime_report(
            connection,
            case=case,
            report_kind="ministry",
            position=position,
            report=report,
        )
        connection.commit()
        return record
    except JunjichuRuntimeReportError:
        connection.rollback()
        raise
    except sqlite3.Error as exc:
        connection.rollback()
        raise JunjichuRuntimeReportError(
            "runtime_report_store_unavailable"
        ) from exc
    finally:
        connection.close()


def append_runtime_council_report(
    case_id: str,
    *,
    owner_user_id: str,
    run_id: str,
    report: CouncilReport,
    db_path: Path | None = None,
) -> JunjichuRuntimeReportRecord:
    """Append one exact council report after all ordered ministry reports."""

    if not isinstance(report, CouncilReport):
        raise TypeError("report must be CouncilReport")
    connection = _connect(db_path)
    try:
        connection.execute("BEGIN IMMEDIATE")
        case = _bound_case_for_runtime_reports(
            connection,
            case_id=case_id,
            owner_user_id=owner_user_id,
            run_id=run_id,
        )
        if case.status in _TERMINAL_STATUSES:
            raise JunjichuRuntimeReportError("case_lifecycle_mismatch")
        try:
            skill = build_default_downstream_skill_registry().get_by_agent(
                report.agent_id
            )
        except DownstreamSkillRegistryError as exc:
            raise JunjichuRuntimeReportError("unknown_council_report") from exc
        if (
            skill.layer is not AgentLayer.COUNCIL
            or report.skill_id != skill.skill_id
            or report.skill_version != skill.version
        ):
            raise JunjichuRuntimeReportError("council_report_skill_binding_mismatch")
        existing = _existing_report_record(
            connection, case_id=case.id, report_id=report.report_id
        )
        if existing is not None:
            _require_record_scope(existing, case)
        if existing is None and case.status not in {
            "MINISTRY_REVIEWING",
            "COUNCIL_REVIEWING",
        }:
            raise JunjichuRuntimeReportError("case_lifecycle_mismatch")
        rows = connection.execute(
            "SELECT * FROM junjichu_runtime_reports "
            "WHERE case_id = ? AND report_kind = 'ministry' ORDER BY position",
            (case.id,),
        ).fetchall()
        ministry_records = tuple(_runtime_report_record_from_row(row) for row in rows)
        for ministry_record in ministry_records:
            _require_record_scope(ministry_record, case)
        report_ids = tuple(item.report_id for item in ministry_records)
        if (
            len(ministry_records) != len(case.departments)
            or report.participating_ministries != tuple(case.departments)
            or report.review_order != tuple(case.departments)
            or report.ministry_report_refs != report_ids
        ):
            raise JunjichuRuntimeReportError("council_report_set_mismatch")
        record = _insert_runtime_report(
            connection,
            case=case,
            report_kind="council",
            position=0,
            report=report,
        )
        connection.commit()
        return record
    except JunjichuRuntimeReportError:
        connection.rollback()
        raise
    except sqlite3.Error as exc:
        connection.rollback()
        raise JunjichuRuntimeReportError(
            "runtime_report_store_unavailable"
        ) from exc
    finally:
        connection.close()


def get_runtime_report_snapshot(
    case_id: str,
    *,
    owner_user_id: str,
    run_id: str,
    db_path: Path | None = None,
) -> JunjichuRuntimeReportSnapshot:
    """Reload the immutable typed report set for one owner/run/case."""

    connection = _connect(db_path)
    try:
        case = _bound_case_for_runtime_reports(
            connection,
            case_id=case_id,
            owner_user_id=owner_user_id,
            run_id=run_id,
        )
        rows = connection.execute(
            "SELECT * FROM junjichu_runtime_reports "
            "WHERE case_id = ? ORDER BY report_kind DESC, position",
            (case.id,),
        ).fetchall()
        records = tuple(_runtime_report_record_from_row(row) for row in rows)
        for record in records:
            _require_record_scope(record, case)
        ministry_records = tuple(
            item for item in records if item.report_kind == "ministry"
        )
        council_records = tuple(
            item for item in records if item.report_kind == "council"
        )
        if len(council_records) > 1:
            raise JunjichuRuntimeReportError("runtime_report_store_unavailable")
        return JunjichuRuntimeReportSnapshot(
            case_id=case.id,
            owner_user_id=case.owner_user_id,
            run_id=case.run_id,
            decree_id=case.decree_id,
            draft_fingerprint=case.draft_fingerprint,
            route_digest=case.route_digest,
            departments=tuple(case.departments),
            case_status=case.status,
            receipt_ref=case.reply_id,
            ministry_records=ministry_records,
            council_record=council_records[0] if council_records else None,
        )
    except JunjichuRuntimeReportError:
        raise
    except sqlite3.Error as exc:
        raise JunjichuRuntimeReportError(
            "runtime_report_store_unavailable"
        ) from exc
    finally:
        connection.close()
