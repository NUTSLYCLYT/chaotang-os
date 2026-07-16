"""Explicit adoption of a compatible, unversioned legacy primary database."""

from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path

import sqlalchemy as sa
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url

_ADOPT_CANDIDATES = (
    ("011_archive_outcome_events", frozenset()),
    ("010_final_memorial_quality_gate", frozenset({"archive_outcome_events"})),
)
_LATER_COLUMNS = {
    "decision_tasks": {"tenant_id"},
    "chancellor_route_decisions": {"tenant_id"},
    "outbox_events": {"tenant_id"},
    "decree_execution_events": {"tenant_id"},
    "court_reviews": {"tenant_id"},
    "final_memorials": {"tenant_id"},
    "emperor_decisions": {"tenant_id", "kind"},
    "shiguan_archives": {"tenant_id"},
}
_KNOWN_DECISION_ACTIONS = {
    "confirm_direct_task",
    "confirm_edict",
    "compat_court_dispatch",
    "adopt",
    "approve",
    "archive",
    "reject",
    "request_evidence",
    "recheck",
    "followup",
}


class AdoptionError(RuntimeError):
    """The target is not proven compatible and must not be stamped."""


@dataclass(frozen=True)
class AdoptionReport:
    compatible: bool
    adopt_revision: str
    mismatches: tuple[str, ...]


@dataclass(frozen=True)
class AdoptionResult:
    adopted_revision: str
    current_revision: str
    backup_path: str
    backup_sha256: str


def _required_columns(*, excluded_tables: frozenset[str]) -> dict[str, set[str]]:
    from src.db.models import Base

    required: dict[str, set[str]] = {}
    for table_name, table in Base.metadata.tables.items():
        if table_name in excluded_tables:
            continue
        columns = {column.name for column in table.columns}
        columns -= _LATER_COLUMNS.get(table_name, set())
        required[table_name] = columns
    return required


def inspect_unversioned_database(db_url: str) -> AdoptionReport:
    engine = create_engine(db_url)
    try:
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())
        if "alembic_version" in tables:
            return AdoptionReport(
                compatible=False,
                adopt_revision=_ADOPT_CANDIDATES[0][0],
                mismatches=("alembic_version already exists; use normal Alembic upgrade",),
            )

        shared_mismatches: list[str] = []
        if "emperor_decisions" in tables:
            with engine.connect() as connection:
                actions = {
                    str(row[0])
                    for row in connection.execute(
                        text("SELECT DISTINCT action FROM emperor_decisions WHERE action IS NOT NULL")
                    )
                }
            unknown = sorted(actions - _KNOWN_DECISION_ACTIONS)
            if unknown:
                shared_mismatches.append("emperor_decisions unknown actions: " + ", ".join(unknown))

        for table, later in _LATER_COLUMNS.items():
            if table not in tables or "tenant_id" not in later:
                continue
            tenant = next(
                (column for column in inspector.get_columns(table) if column["name"] == "tenant_id"),
                None,
            )
            if tenant is not None and (
                not isinstance(tenant.get("type"), sa.Integer)
                or not tenant.get("nullable", True)
                or tenant.get("default") is not None
            ):
                shared_mismatches.append(f"{table}.tenant_id is incompatible with migration 013")

        candidate_reports: list[tuple[str, list[str]]] = []
        for revision, excluded_tables in _ADOPT_CANDIDATES:
            mismatches = list(shared_mismatches)
            for table, required_columns in sorted(_required_columns(excluded_tables=excluded_tables).items()):
                if table not in tables:
                    mismatches.append(f"missing table: {table}")
                    continue
                actual_columns = {column["name"] for column in inspector.get_columns(table)}
                missing = sorted(required_columns - actual_columns)
                if missing:
                    mismatches.append(f"{table} missing columns: {', '.join(missing)}")
            candidate_reports.append((revision, mismatches))
            if not mismatches:
                return AdoptionReport(
                    compatible=True,
                    adopt_revision=revision,
                    mismatches=(),
                )
    finally:
        engine.dispose()
    revision, mismatches = candidate_reports[-1]
    return AdoptionReport(
        compatible=False,
        adopt_revision=revision,
        mismatches=tuple(mismatches),
    )


@contextmanager
def _database_url_environment(db_url: str):
    previous = os.environ.get("DB_URL")
    os.environ["DB_URL"] = db_url
    try:
        yield
    finally:
        if previous is None:
            os.environ.pop("DB_URL", None)
        else:
            os.environ["DB_URL"] = previous


def _backup_sqlite_database(db_url: str, backup_path: Path) -> tuple[str, str]:
    url = make_url(db_url)
    if url.get_backend_name() != "sqlite" or not url.database:
        raise AdoptionError("legacy adoption backup currently supports file-backed SQLite only")
    source = Path(url.database).resolve()
    destination = backup_path.resolve()
    if source == destination:
        raise AdoptionError("backup_path must differ from the source database")
    if destination.exists():
        raise AdoptionError(f"backup_path already exists and will not be overwritten: {destination}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(source) as source_db, sqlite3.connect(destination) as backup_db:
        source_db.backup(backup_db)
    digest = sha256()
    with destination.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return str(destination), digest.hexdigest()


def adopt_unversioned_database(
    db_url: str,
    *,
    alembic_ini: Path,
    backup_path: Path | None = None,
    apply: bool = False,
) -> AdoptionResult:
    report = inspect_unversioned_database(db_url)
    if not report.compatible:
        raise AdoptionError("legacy database is not compatible: " + "; ".join(report.mismatches))
    if not apply:
        raise AdoptionError("adoption is check-only unless apply=True is explicit")
    if backup_path is None:
        raise AdoptionError("backup_path is required before legacy database adoption")

    backup_location, backup_digest = _backup_sqlite_database(db_url, backup_path)

    try:
        from alembic.config import Config

        from alembic import command
    except ImportError as exc:  # pragma: no cover - operator environment failure
        raise AdoptionError("Alembic is required for legacy database adoption") from exc

    config = Config(str(alembic_ini))
    with _database_url_environment(db_url):
        command.stamp(config, report.adopt_revision)
        command.upgrade(config, "head")

    engine = create_engine(db_url)
    try:
        with engine.connect() as connection:
            current = connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
    finally:
        engine.dispose()
    return AdoptionResult(
        adopted_revision=report.adopt_revision,
        current_revision=str(current),
        backup_path=backup_location,
        backup_sha256=backup_digest,
    )
