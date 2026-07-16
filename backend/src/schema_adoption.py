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
from sqlalchemy.engine import URL, make_url

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
_KNOWN_DECISION_KINDS = {"edict_confirm", "compat_dispatch", "final_verdict"}
_IDENTITY_TABLES = {"tenants", "users", "invites"}
_EXPECTED_SERVER_DEFAULTS = {
    ("archive_outcome_events", "synthetic_flag"): "0",
    ("build_ledger_audit_events", "tenant_id"): "1",
    ("build_ledger_audit_events", "user_id"): "anonymous",
    ("build_ledger_entries", "tenant_id"): "1",
    ("build_ledger_entries", "user_id"): "anonymous",
    ("decree_execution_events", "sequence"): "0",
    ("decree_execution_events", "event_type"): "timeline.note",
    ("decree_execution_events", "source_label"): "fallback",
    ("decree_execution_events", "payload_json"): "{}",
    ("decrees", "tenant_id"): "1",
    ("decrees", "raw_command"): "",
    ("decrees", "ministers_json"): "[]",
    ("decrees", "groups_json"): "[]",
    ("decrees", "created_at"): "",
    ("departments", "tenant_id"): "1",
    ("departments", "created_at"): "",
    ("final_memorials", "status"): "ready_for_decision",
    ("jinyiwei_evidence", "tenant_id"): "1",
    ("jinyiwei_evidence", "source_label"): "fallback",
    ("jinyiwei_evidence", "sources_json"): "[]",
    ("jinyiwei_evidence", "dept_affinity_json"): "[]",
    ("jinyiwei_evidence", "created_at"): "",
    ("jinyiwei_evidence", "updated_at"): "",
    ("memorials", "tenant_id"): "1",
    ("memorials", "title"): "",
    ("memorials", "source_department"): "",
    ("memorials", "agent_code"): "",
    ("memorials", "priority"): "medium",
    ("memorials", "status"): "running",
    ("memorials", "summary"): "",
    ("memorials", "created_at"): "",
    ("memorials", "updated_at"): "",
    ("retrospectives", "tenant_id"): "1",
    ("retrospectives", "score"): "3",
    ("retrospectives", "successes_json"): "[]",
    ("retrospectives", "failures_json"): "[]",
    ("retrospectives", "lessons_json"): "[]",
    ("retrospectives", "authored_by"): "史官",
    ("retrospectives", "authored_at"): "",
    ("retrospectives", "synthetic"): "0",
    ("retrospectives", "outcome"): "pending",
    ("reviews", "tenant_id"): "1",
    ("reviews", "comment"): "",
    ("reviews", "reviewer_name"): "",
    ("reviews", "created_at"): "",
    ("tasks", "tenant_id"): "1",
    ("tasks", "status"): "running",
    ("tasks", "departments_json"): "[]",
    ("tasks", "completed_steps"): "0",
    ("tasks", "created_at"): "",
    ("tasks", "updated_at"): "",
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


def _sqlite_file_path(url: URL) -> Path | None:
    if url.get_backend_name() != "sqlite":
        return None
    database = url.database
    if not database or database == ":memory:" or url.query.get("mode") == "memory":
        return None
    if database.startswith("file:"):
        database = database.removeprefix("file:")
    return Path(database).expanduser()


def _normalize_default(value: object) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip()
    while normalized.startswith("(") and normalized.endswith(")"):
        normalized = normalized[1:-1].strip()
    if len(normalized) >= 2 and normalized[0] == normalized[-1] and normalized[0] in {"'", '"'}:
        normalized = normalized[1:-1]
    normalized = " ".join(normalized.lower().split())
    if normalized in {"datetime('now')", "now()"}:
        return "current_timestamp"
    return normalized


def _type_matches(actual: sa.types.TypeEngine, expected: sa.types.TypeEngine) -> bool:
    return isinstance(actual, expected._type_affinity)


def _unique_shapes(inspector: sa.Inspector, table_name: str) -> set[tuple[str, ...]]:
    shapes = {
        tuple(item.get("column_names") or ())
        for item in inspector.get_unique_constraints(table_name)
    }
    shapes.update(
        tuple(item.get("column_names") or ())
        for item in inspector.get_indexes(table_name)
        if item.get("unique")
    )
    return {shape for shape in shapes if shape}


def _expected_unique_shapes(table: sa.Table) -> set[tuple[str, ...]]:
    shapes = {
        tuple(column.name for column in constraint.columns)
        for constraint in table.constraints
        if isinstance(constraint, sa.UniqueConstraint)
    }
    shapes.update(
        tuple(column.name for column in index.columns)
        for index in table.indexes
        if index.unique
    )
    return shapes


def _normalize_check_sql(value: object) -> str:
    return " ".join(str(value).strip().lower().split())


def _normalized_fk_options(options: dict[str, object] | None) -> tuple[tuple[str, str], ...]:
    return tuple(
        sorted(
            (str(key), str(value).lower())
            for key, value in (options or {}).items()
            if value is not None
        )
    )


def _foreign_key_shapes(
    inspector: sa.Inspector,
    table_name: str,
) -> set[tuple[tuple[str, ...], str, tuple[str, ...], tuple[tuple[str, str], ...]]]:
    return {
        (
            tuple(item.get("constrained_columns") or ()),
            str(item.get("referred_table")),
            tuple(item.get("referred_columns") or ()),
            _normalized_fk_options(item.get("options")),
        )
        for item in inspector.get_foreign_keys(table_name)
    }


def _expected_foreign_key_shapes(
    table: sa.Table,
) -> set[tuple[tuple[str, ...], str, tuple[str, ...], tuple[tuple[str, str], ...]]]:
    shapes = set()
    for constraint in table.foreign_key_constraints:
        elements = tuple(constraint.elements)
        shapes.add(
            (
                tuple(element.parent.name for element in elements),
                elements[0].column.table.name,
                tuple(element.column.name for element in elements),
                _normalized_fk_options(
                    {
                        "ondelete": constraint.ondelete,
                        "onupdate": constraint.onupdate,
                        "deferrable": constraint.deferrable,
                        "initially": constraint.initially,
                        "match": constraint.match,
                    }
                ),
            )
        )
    return shapes


def _validate_table(
    inspector: sa.Inspector,
    table: sa.Table,
) -> list[str]:
    table_name = table.name
    errors: list[str] = []
    actual_columns = {item["name"]: item for item in inspector.get_columns(table_name)}
    expected_columns = {column.name: column for column in table.columns}
    required = set(expected_columns) - _LATER_COLUMNS.get(table_name, set())
    missing = sorted(required - set(actual_columns))
    unexpected = sorted(set(actual_columns) - set(expected_columns))
    if missing:
        errors.append(f"{table_name} missing columns: {', '.join(missing)}")
    if unexpected:
        errors.append(f"{table_name} unexpected columns: {', '.join(unexpected)}")
    for column_name in sorted(set(actual_columns) & set(expected_columns)):
        actual = actual_columns[column_name]
        expected = expected_columns[column_name]
        if not _type_matches(actual["type"], expected.type):
            errors.append(f"{table_name}.{column_name} has incompatible type")
        if bool(actual.get("nullable")) != bool(expected.nullable):
            errors.append(f"{table_name}.{column_name} has incompatible nullability")
        expected_default = _EXPECTED_SERVER_DEFAULTS.get((table_name, column_name))
        if column_name in _LATER_COLUMNS.get(table_name, set()):
            expected_default = None
        if _normalize_default(actual.get("default")) != expected_default:
            errors.append(f"{table_name}.{column_name} has incompatible server default")

    actual_pk = tuple(inspector.get_pk_constraint(table_name).get("constrained_columns") or ())
    expected_pk = tuple(column.name for column in table.primary_key.columns)
    if actual_pk != expected_pk:
        errors.append(f"{table_name} primary key mismatch: expected {expected_pk}, got {actual_pk}")

    actual_unique = _unique_shapes(inspector, table_name)
    expected_unique = _expected_unique_shapes(table)
    if actual_unique != expected_unique:
        errors.append(
            f"{table_name} unique constraints mismatch: expected {sorted(expected_unique)}, "
            f"got {sorted(actual_unique)}"
        )

    actual_indexes = {
        item["name"]: (tuple(item.get("column_names") or ()), bool(item.get("unique")))
        for item in inspector.get_indexes(table_name)
        if item.get("name")
    }
    expected_indexes = {
        index.name: (tuple(column.name for column in index.columns), bool(index.unique))
        for index in table.indexes
        if index.name
    }
    if actual_indexes != expected_indexes:
        for name in sorted(set(actual_indexes) | set(expected_indexes)):
            if actual_indexes.get(name) != expected_indexes.get(name):
                errors.append(
                    f"{table_name} index {name} mismatch: expected {expected_indexes.get(name)}, "
                    f"got {actual_indexes.get(name)}"
                )

    actual_checks = {
        (item.get("name"), _normalize_check_sql(item.get("sqltext")))
        for item in inspector.get_check_constraints(table_name)
    }
    expected_checks = {
        (constraint.name, _normalize_check_sql(constraint.sqltext))
        for constraint in table.constraints
        if isinstance(constraint, sa.CheckConstraint)
    }
    if table_name == "emperor_decisions" and "kind" not in actual_columns:
        expected_checks = set()
    if actual_checks != expected_checks:
        errors.append(
            f"{table_name} check constraints mismatch: "
            f"expected {sorted(expected_checks, key=repr)}, "
            f"got {sorted(actual_checks, key=repr)}"
        )

    actual_foreign_keys = _foreign_key_shapes(inspector, table_name)
    expected_foreign_keys = _expected_foreign_key_shapes(table)
    if actual_foreign_keys != expected_foreign_keys:
        errors.append(
            f"{table_name} foreign keys mismatch: "
            f"expected {sorted(expected_foreign_keys, key=repr)}, "
            f"got {sorted(actual_foreign_keys, key=repr)}"
        )
    return errors


def _identity_mismatches(inspector: sa.Inspector, tables: set[str]) -> list[str]:
    specs = {
        "tenants": {
            "columns": {"id", "name", "slug", "created_at"},
            "pk": ("id",),
            "unique": {("slug",)},
            "defaults": {"created_at": "current_timestamp"},
        },
        "users": {
            "columns": {"id", "username", "email", "password_hash", "tenant_id", "role", "display_name", "created_at"},
            "pk": ("id",),
            "unique": {("username",)},
            "defaults": {"email": "", "role": "user", "display_name": "", "created_at": "current_timestamp"},
        },
        "invites": {
            "columns": {"id", "code", "max_uses", "used_count", "expires_at", "created_at"},
            "pk": ("id",),
            "unique": {("code",)},
            "defaults": {"max_uses": "1", "used_count": "0", "created_at": "current_timestamp"},
        },
    }
    errors: list[str] = []
    for table_name, spec in specs.items():
        if table_name not in tables:
            continue
        columns = {item["name"]: item for item in inspector.get_columns(table_name)}
        expected_columns = set(spec["columns"])
        if table_name == "users" and "email" not in columns:
            expected_columns.remove("email")
        if set(columns) != expected_columns:
            errors.append(f"{table_name} identity columns mismatch")
            continue
        expected_types = {name: sa.Text() for name in expected_columns}
        for name in {"id", "tenant_id", "max_uses", "used_count"} & expected_columns:
            expected_types[name] = sa.Integer()
        nullable = {"email", "display_name", "expires_at"}
        for name, column in columns.items():
            if not _type_matches(column["type"], expected_types[name]):
                errors.append(f"{table_name}.{name} has incompatible type")
            if name != "id" and bool(column.get("nullable")) != (name in nullable):
                errors.append(f"{table_name}.{name} has incompatible nullability")
            expected_default = spec["defaults"].get(name)
            if _normalize_default(column.get("default")) != expected_default:
                errors.append(f"{table_name}.{name} has incompatible server default")
        actual_pk = tuple(inspector.get_pk_constraint(table_name).get("constrained_columns") or ())
        if actual_pk != spec["pk"]:
            errors.append(f"{table_name} primary key mismatch")
        if _unique_shapes(inspector, table_name) != spec["unique"]:
            errors.append(f"{table_name} unique constraints mismatch")
        foreign_keys = _foreign_key_shapes(inspector, table_name)
        expected_foreign_keys = (
            {(('tenant_id',), 'tenants', ('id',), ())}
            if table_name == "users"
            else set()
        )
        if foreign_keys != expected_foreign_keys:
            errors.append(f"{table_name} foreign keys mismatch")
        named_indexes = {
            item["name"] for item in inspector.get_indexes(table_name) if item.get("name")
        }
        if named_indexes:
            errors.append(f"{table_name} unexpected named indexes: {', '.join(sorted(named_indexes))}")
        if inspector.get_check_constraints(table_name):
            errors.append(f"{table_name} unexpected check constraints")
    return errors


def _metadata_tables() -> dict[str, sa.Table]:
    from src.db.models import Base

    return dict(Base.metadata.tables)


def inspect_unversioned_database(db_url: str) -> AdoptionReport:
    try:
        url = make_url(db_url)
    except (sa.exc.ArgumentError, TypeError, ValueError) as exc:
        raise AdoptionError("invalid database URL") from exc
    path = _sqlite_file_path(url)
    if url.get_backend_name() != "sqlite" or path is None:
        raise AdoptionError("legacy adoption requires a file-backed SQLite database")
    if not path.exists():
        raise AdoptionError(f"legacy SQLite database does not exist: {path}")
    try:
        engine = create_engine(db_url)
    except (sa.exc.ArgumentError, sa.exc.NoSuchModuleError) as exc:
        raise AdoptionError("invalid or unsupported database URL") from exc
    try:
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())
        if "alembic_version" in tables:
            return AdoptionReport(
                compatible=False,
                adopt_revision=_ADOPT_CANDIDATES[0][0],
                mismatches=("alembic_version already exists; use normal Alembic upgrade",),
            )

        metadata_tables = _metadata_tables()
        shared_mismatches: list[str] = []
        unknown_tables = sorted(tables - set(metadata_tables) - _IDENTITY_TABLES)
        if unknown_tables:
            shared_mismatches.append("unexpected tables: " + ", ".join(unknown_tables))
        shared_mismatches.extend(_identity_mismatches(inspector, tables))
        if "emperor_decisions" in tables:
            emperor_columns = {
                column["name"] for column in inspector.get_columns("emperor_decisions")
            }
            with engine.connect() as connection:
                actions = {
                    str(row[0])
                    for row in connection.execute(
                        text("SELECT DISTINCT action FROM emperor_decisions WHERE action IS NOT NULL")
                    )
                }
                kinds = (
                    {
                        row[0]
                        for row in connection.execute(
                            text("SELECT DISTINCT kind FROM emperor_decisions")
                        )
                    }
                    if "kind" in emperor_columns
                    else set()
                )
            unknown = sorted(actions - _KNOWN_DECISION_ACTIONS)
            if unknown:
                shared_mismatches.append("emperor_decisions unknown actions: " + ", ".join(unknown))
            unknown_kinds = sorted(
                "NULL" if kind is None else str(kind)
                for kind in kinds
                if kind not in _KNOWN_DECISION_KINDS
            )
            if unknown_kinds:
                shared_mismatches.append(
                    "emperor_decisions unknown kinds: " + ", ".join(unknown_kinds)
                )

        candidate_reports: list[tuple[str, list[str]]] = []
        for revision, excluded_tables in _ADOPT_CANDIDATES:
            mismatches = list(shared_mismatches)
            for table_name, table in sorted(metadata_tables.items()):
                if table_name not in tables:
                    if table_name not in excluded_tables:
                        mismatches.append(f"missing table: {table_name}")
                    continue
                mismatches.extend(_validate_table(inspector, table))
            candidate_reports.append((revision, mismatches))
            if not mismatches:
                return AdoptionReport(
                    compatible=True,
                    adopt_revision=revision,
                    mismatches=(),
                )
    except sa.exc.SQLAlchemyError as exc:
        raise AdoptionError("could not inspect legacy database") from exc
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
    source_path = _sqlite_file_path(url)
    if source_path is None:
        raise AdoptionError("legacy adoption backup currently supports file-backed SQLite only")
    source = source_path.resolve()
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
