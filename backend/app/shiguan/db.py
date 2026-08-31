"""sqlite3 connection management for the 史馆 (Shiguan) domain.

Design notes:

- Python's standard library ``sqlite3`` is used directly -- no new
  production dependency (see ``docs/decisions/0015-shiguan-archive-persistence.md``).
- ``get_connection()`` opens a **short-lived connection per call**. There is
  no global connection singleton and no connection is ever reused across
  threads/requests; callers are responsible for closing the connection they
  receive (see ``app.shiguan.storage``, which always does so in a
  ``finally`` block).
- The default database path is resolved from this module's own file
  location (not the process working directory), mirroring the pattern used
  by ``app.langgraph_runtime.deepseek_env._DEFAULT_DOTENV_PATH``. Tests must
  monkeypatch the module-level ``_DEFAULT_DB_PATH`` attribute (not a
  captured default argument) to a ``tmp_path``-backed file so they never
  touch a real, shared runtime database file.
- Every call to ``get_connection()`` ensures the on-disk schema exists
  (``CREATE TABLE IF NOT EXISTS`` -- idempotent), so "first access to a
  given path auto-creates the schema" holds without needing a separate
  migration step.
"""

from __future__ import annotations

import hashlib
import sqlite3
import uuid
from pathlib import Path

from app.shiguan.errors import ShiguanStorageError

# backend/app/shiguan/db.py -> parents[2] == backend/
_DEFAULT_DB_PATH = Path(__file__).resolve().parents[2] / "data" / "shiguan.sqlite3"

_V2_SCHEMA_STATEMENTS = """
CREATE TABLE IF NOT EXISTS archives (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    matter_type TEXT NOT NULL,
    department TEXT NOT NULL,
    created_at TEXT NOT NULL,
    lessons_learned TEXT,
    pitfalls TEXT,
    source_kind TEXT,
    source_text TEXT,
    participating_departments TEXT,
    reply_process TEXT,
    reply_conclusion TEXT,
    reply_time TEXT,
    respondent TEXT,
    owner_user_id TEXT
);

CREATE TABLE IF NOT EXISTS archive_evidence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    archive_id TEXT NOT NULL,
    source TEXT NOT NULL,
    reality_label TEXT NOT NULL,
    note TEXT,
    FOREIGN KEY (archive_id) REFERENCES archives(id)
);

CREATE TABLE IF NOT EXISTS archive_relations (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    archive_id TEXT NOT NULL,
    related_id TEXT NOT NULL,
    UNIQUE (archive_id, related_id),
    FOREIGN KEY (archive_id) REFERENCES archives(id),
    FOREIGN KEY (related_id) REFERENCES archives(id)
);

CREATE TABLE IF NOT EXISTS archive_review_status (
    archive_id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    reviewed_at TEXT NOT NULL,
    note TEXT,
    FOREIGN KEY (archive_id) REFERENCES archives(id)
);
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_active_user
ON auth_sessions (id, user_id, expires_at)
WHERE revoked_at IS NULL;

PRAGMA user_version = 2;
"""

_AUTH_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_active_user
ON auth_sessions (id, user_id, expires_at)
WHERE revoked_at IS NULL;
"""

_EVIDENCE_REFERENCES_SCHEMA = """
CREATE TABLE archive_evidence_references (
    archive_id TEXT NOT NULL,
    ordinal INTEGER NOT NULL,
    evidence_id TEXT NOT NULL,
    pack_id TEXT NOT NULL,
    investigation_id TEXT NOT NULL,
    snapshot_json TEXT NOT NULL,
    snapshot_hash TEXT NOT NULL,
    PRIMARY KEY (archive_id, ordinal),
    UNIQUE (archive_id, evidence_id),
    FOREIGN KEY (archive_id) REFERENCES archives(id)
)
"""

_V3_SCHEMA_STATEMENTS = (
    _V2_SCHEMA_STATEMENTS.replace("PRAGMA user_version = 2;", "")
    + _EVIDENCE_REFERENCES_SCHEMA
    + ";\nPRAGMA user_version = 3;\n"
)

_DAILY_MEMORIAL_SCHEMA = """
CREATE TABLE daily_memorial_runs (
    id TEXT PRIMARY KEY,
    owner_user_id TEXT NOT NULL,
    report_date TEXT NOT NULL,
    source_window_start TEXT NOT NULL,
    source_window_end TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN (
        'PENDING', 'GENERATING', 'READY_FOR_REVIEW',
        'SKIPPED_NO_FACTS', 'FAILED', 'CONFIRMED'
    )),
    version INTEGER NOT NULL DEFAULT 0,
    fingerprint TEXT,
    content TEXT,
    fact_refs_json TEXT NOT NULL DEFAULT '[]',
    failure_code TEXT,
    confirmed_memorial_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    confirmed_at TEXT,
    UNIQUE (owner_user_id, report_date),
    FOREIGN KEY (owner_user_id) REFERENCES users(id),
    FOREIGN KEY (confirmed_memorial_id) REFERENCES archives(id)
);

CREATE TABLE daily_memorial_fact_snapshots (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    fact_id TEXT NOT NULL,
    snapshot_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (run_id, fact_id),
    FOREIGN KEY (run_id) REFERENCES daily_memorial_runs(id)
);

CREATE TABLE daily_memorial_stage_results (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    stage TEXT NOT NULL CHECK (stage IN ('BUREAU', 'MINISTRY', 'CHANCELLOR')),
    unit_key TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN (
        'PENDING', 'RUNNING', 'READY', 'NO_MATERIAL', 'RETRY_WAIT', 'FAILED'
    )),
    input_fingerprint TEXT,
    output_json TEXT NOT NULL DEFAULT 'null',
    fact_refs_json TEXT NOT NULL DEFAULT '[]',
    attempts INTEGER NOT NULL DEFAULT 0,
    failure_code TEXT,
    next_retry_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (run_id, stage, unit_key),
    FOREIGN KEY (run_id) REFERENCES daily_memorial_runs(id)
);
"""

_V5_SCHEMA_STATEMENTS = (
    _V3_SCHEMA_STATEMENTS.replace("PRAGMA user_version = 3;", "")
    + _DAILY_MEMORIAL_SCHEMA
    + "\n"
    + """
CREATE TABLE archive_decisions (
    archive_id TEXT PRIMARY KEY,
    owner_user_id TEXT NOT NULL,
    actor_user_id TEXT NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN (
        'APPROVED', 'REJECTED', 'ADOPTED', 'RETURNED_FOR_RECONSIDERATION'
    )),
    decided_at TEXT NOT NULL,
    FOREIGN KEY (archive_id) REFERENCES archives(id)
);
PRAGMA user_version = 5;
"""
)

_V6_IDENTITY_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE tenants (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind = 'PERSONAL'),
    created_at TEXT NOT NULL
);

CREATE TABLE tenant_memberships (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    tenant_id TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role = 'OWNER'),
    created_at TEXT NOT NULL,
    revoked_at TEXT,
    UNIQUE (id, user_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE auth_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    membership_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (membership_id, user_id)
        REFERENCES tenant_memberships(id, user_id)
);

CREATE INDEX idx_auth_sessions_active_user
ON auth_sessions (user_id, id, expires_at);

CREATE INDEX idx_auth_sessions_membership_user
ON auth_sessions (membership_id, user_id);
"""

_V6_GOVERNANCE_SCHEMA = """
CREATE TABLE schema_migration_verification (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    status TEXT NOT NULL CHECK (status IN ('PENDING_VERIFICATION', 'VERIFIED')),
    verified_at TEXT,
    CHECK (
        (status = 'PENDING_VERIFICATION' AND verified_at IS NULL)
        OR (
            status = 'VERIFIED'
            AND verified_at IS NOT NULL
            AND length(trim(verified_at)) > 0
        )
    )
);

CREATE TRIGGER tenants_guard_insert
BEFORE INSERT ON tenants
WHEN EXISTS (SELECT 1 FROM tenants WHERE id = NEW.id)
BEGIN
    SELECT RAISE(ABORT, 'tenant identity already exists');
END;

CREATE TRIGGER tenants_guard_update
BEFORE UPDATE ON tenants
BEGIN
    SELECT RAISE(ABORT, 'tenant identity is immutable');
END;

CREATE TRIGGER tenants_no_delete
BEFORE DELETE ON tenants
BEGIN
    SELECT RAISE(ABORT, 'tenant identity cannot be deleted');
END;

CREATE TRIGGER tenant_memberships_guard_insert
BEFORE INSERT ON tenant_memberships
WHEN NEW.revoked_at IS NOT NULL
  OR EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE id = NEW.id OR user_id = NEW.user_id OR tenant_id = NEW.tenant_id
  )
BEGIN
    SELECT RAISE(ABORT, 'membership must be active when created');
END;

CREATE TRIGGER tenant_memberships_guard_update
BEFORE UPDATE ON tenant_memberships
WHEN NEW.id IS NOT OLD.id
  OR NEW.user_id IS NOT OLD.user_id
  OR NEW.tenant_id IS NOT OLD.tenant_id
  OR NEW.role IS NOT OLD.role
  OR NEW.created_at IS NOT OLD.created_at
  OR OLD.revoked_at IS NOT NULL
  OR NEW.revoked_at IS NULL
BEGIN
    SELECT RAISE(ABORT, 'membership is immutable and revocation is one-way');
END;

CREATE TRIGGER tenant_memberships_no_delete
BEFORE DELETE ON tenant_memberships
BEGIN
    SELECT RAISE(ABORT, 'membership cannot be deleted');
END;

CREATE TRIGGER auth_sessions_guard_insert
BEFORE INSERT ON auth_sessions
WHEN EXISTS (SELECT 1 FROM auth_sessions WHERE id = NEW.id)
BEGIN
    SELECT RAISE(ABORT, 'session identity already exists');
END;

CREATE TRIGGER auth_sessions_guard_update
BEFORE UPDATE ON auth_sessions
WHEN NEW.id IS NOT OLD.id
  OR NEW.user_id IS NOT OLD.user_id
  OR NEW.membership_id IS NOT OLD.membership_id
  OR NEW.created_at IS NOT OLD.created_at
  OR NEW.expires_at IS NOT OLD.expires_at
  OR (
      NEW.revoked_at IS NOT OLD.revoked_at
      AND NOT (OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL)
  )
BEGIN
    SELECT RAISE(ABORT, 'session identity is immutable and revocation is one-way');
END;

CREATE TRIGGER schema_migration_verification_guard_insert
BEFORE INSERT ON schema_migration_verification
WHEN NEW.id != 1 OR EXISTS (SELECT 1 FROM schema_migration_verification)
BEGIN
    SELECT RAISE(ABORT, 'migration verification is a singleton');
END;

CREATE TRIGGER schema_migration_verification_guard_update
BEFORE UPDATE ON schema_migration_verification
WHEN NEW.id IS NOT OLD.id
  OR OLD.status != 'PENDING_VERIFICATION'
  OR NEW.status != 'VERIFIED'
  OR OLD.verified_at IS NOT NULL
  OR NEW.verified_at IS NULL
BEGIN
    SELECT RAISE(ABORT, 'migration verification transition is invalid');
END;

CREATE TRIGGER schema_migration_verification_no_delete
BEFORE DELETE ON schema_migration_verification
BEGIN
    SELECT RAISE(ABORT, 'migration verification cannot be deleted');
END;
"""

_V6_SCHEMA_STATEMENTS = (
    _V5_SCHEMA_STATEMENTS.replace(_AUTH_SCHEMA, _V6_IDENTITY_SCHEMA)
    .replace("PRAGMA user_version = 5;", "")
    + _V6_GOVERNANCE_SCHEMA
    + """
INSERT INTO schema_migration_verification (id, status, verified_at)
VALUES (1, 'VERIFIED', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
PRAGMA user_version = 6;
"""
)

_V7_OUTCOME_SCHEMA = """
CREATE TABLE outcome_events (
    event_id TEXT PRIMARY KEY CHECK (
        length(event_id) = 32 AND event_id NOT GLOB '*[^0-9a-f]*'
    ),
    tenant_id TEXT NOT NULL,
    owner_user_id TEXT NOT NULL,
    membership_id TEXT NOT NULL,
    actor_user_id TEXT NOT NULL,
    archive_id TEXT NOT NULL,
    event_kind TEXT NOT NULL CHECK (event_kind IN ('RECORDED', 'CORRECTED')),
    outcome TEXT NOT NULL CHECK (
        outcome IN ('ACHIEVED', 'PARTIAL', 'NOT_ACHIEVED', 'OBSERVING')
    ),
    source_type TEXT NOT NULL CHECK (source_type = 'OWNER_ATTESTATION'),
    source_auth_level TEXT NOT NULL CHECK (
        source_auth_level = 'AUTHENTICATED_OWNER_ASSERTION'
    ),
    occurred_at TEXT NOT NULL,
    recorded_at TEXT NOT NULL,
    idempotency_key TEXT NOT NULL CHECK (
        length(idempotency_key) BETWEEN 8 AND 128
        AND idempotency_key NOT GLOB '*[^A-Za-z0-9._:-]*'
    ),
    request_digest TEXT NOT NULL,
    archive_digest TEXT NOT NULL,
    decision_digest TEXT NOT NULL,
    evidence_bundle_digest TEXT NOT NULL,
    evidence_count INTEGER NOT NULL CHECK (evidence_count > 0),
    supersedes_event_id TEXT UNIQUE,
    event_digest TEXT NOT NULL UNIQUE,
    UNIQUE (tenant_id, owner_user_id, membership_id, idempotency_key),
    CHECK (supersedes_event_id IS NULL OR supersedes_event_id != event_id),
    CHECK (
        (event_kind = 'RECORDED' AND supersedes_event_id IS NULL)
        OR (event_kind = 'CORRECTED' AND supersedes_event_id IS NOT NULL)
    ),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (membership_id, owner_user_id)
        REFERENCES tenant_memberships(id, user_id),
    FOREIGN KEY (actor_user_id) REFERENCES users(id),
    FOREIGN KEY (archive_id) REFERENCES archives(id),
    FOREIGN KEY (supersedes_event_id) REFERENCES outcome_events(event_id)
);

CREATE INDEX idx_outcome_events_owner_page
ON outcome_events (tenant_id, owner_user_id, membership_id, recorded_at DESC, event_id ASC);

CREATE INDEX idx_outcome_events_archive_page
ON outcome_events (
    tenant_id, owner_user_id, membership_id, archive_id, recorded_at DESC, event_id ASC
);

CREATE TRIGGER outcome_events_guard_insert
BEFORE INSERT ON outcome_events
WHEN NOT EXISTS (
    SELECT 1 FROM tenant_memberships AS memberships
    JOIN tenants AS tenants ON tenants.id = memberships.tenant_id
    JOIN archives AS archives ON archives.id = NEW.archive_id
    JOIN archive_decisions AS decisions
      ON decisions.archive_id = archives.id
     AND decisions.owner_user_id = archives.owner_user_id
    WHERE memberships.id = NEW.membership_id
      AND memberships.user_id = NEW.owner_user_id
      AND memberships.tenant_id = NEW.tenant_id
      AND memberships.role = 'OWNER'
      AND memberships.revoked_at IS NULL
      AND tenants.kind = 'PERSONAL'
      AND archives.owner_user_id = NEW.owner_user_id
      AND archives.type = 'REPLY'
      AND decisions.decision = 'ADOPTED'
) OR (
    NEW.supersedes_event_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM outcome_events AS prior
        WHERE prior.event_id = NEW.supersedes_event_id
          AND prior.tenant_id = NEW.tenant_id
          AND prior.owner_user_id = NEW.owner_user_id
          AND prior.membership_id = NEW.membership_id
          AND prior.archive_id = NEW.archive_id
          AND NOT EXISTS (
              SELECT 1 FROM outcome_events AS successor
              WHERE successor.supersedes_event_id = prior.event_id
          )
    )
)
BEGIN
    SELECT RAISE(ABORT, 'outcome source or head is invalid');
END;

CREATE TRIGGER outcome_events_no_update
BEFORE UPDATE ON outcome_events
BEGIN
    SELECT RAISE(ABORT, 'outcome event is immutable');
END;

CREATE TRIGGER outcome_events_no_delete
BEFORE DELETE ON outcome_events
BEGIN
    SELECT RAISE(ABORT, 'outcome event cannot be deleted');
END;

CREATE TRIGGER archive_decisions_no_update
BEFORE UPDATE ON archive_decisions
BEGIN
    SELECT RAISE(ABORT, 'archive decision is immutable');
END;

CREATE TRIGGER archive_decisions_no_delete
BEFORE DELETE ON archive_decisions
BEGIN
    SELECT RAISE(ABORT, 'archive decision cannot be deleted');
END;
"""

_V7_SCHEMA_STATEMENTS = (
    _V6_SCHEMA_STATEMENTS.replace("PRAGMA user_version = 6;", "")
    + _V7_OUTCOME_SCHEMA
    + "\nPRAGMA user_version = 7;\n"
)

# Compatibility name for callers that only need the current fresh schema.
_SCHEMA_STATEMENTS = _V7_SCHEMA_STATEMENTS

_LEGACY_MIGRATION_ERROR = "史馆旧库无法迁移；请核对已确认档案对后重试"

_CURRENT_ARCHIVE_COLUMNS = {
    "source_kind": "TEXT",
    "source_text": "TEXT",
    "reply_process": "TEXT",
    "reply_conclusion": "TEXT",
    "reply_time": "TEXT",
    "respondent": "TEXT",
    "owner_user_id": "TEXT",
}


def _add_missing_archive_columns(connection: sqlite3.Connection) -> None:
    """Extend pre-existing archive tables without rewriting their records."""

    existing_columns = {
        row[1] for row in connection.execute("PRAGMA table_info(archives)")
    }
    for name, column_type in _CURRENT_ARCHIVE_COLUMNS.items():
        if name not in existing_columns:
            connection.execute(f"ALTER TABLE archives ADD COLUMN {name} {column_type}")


def get_connection(path: Path | None = None) -> sqlite3.Connection:
    """Open a new short-lived sqlite3 connection, ensuring schema exists.

    Args:
        path: Optional override path to the sqlite database file. Defaults
            to the module-level ``_DEFAULT_DB_PATH``, read at call time so
            tests can monkeypatch it.

    Returns:
        A new ``sqlite3.Connection`` with ``row_factory = sqlite3.Row`` and
        foreign keys enabled. The caller owns this connection and must
        close it.

    Raises:
        ShiguanStorageError: The database directory could not be created,
            or the connection/schema setup otherwise failed. The message is
            fixed and generic -- it never includes the underlying
            exception's ``str()`` or the resolved filesystem path.
    """

    target = path if path is not None else _DEFAULT_DB_PATH
    connection: sqlite3.Connection | None = None
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(target)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        has_schema = connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'archives'"
        ).fetchone()
        version = connection.execute("PRAGMA user_version").fetchone()[0]
        user_objects = connection.execute(
            "SELECT type, name FROM sqlite_master "
            "WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name"
        ).fetchall()
        if has_schema and version != 7:
            connection.close()
            raise ShiguanStorageError("史馆旧库需要显式迁移后才能使用")
        if not has_schema:
            if version != 0 or user_objects:
                raise ShiguanStorageError("史馆存储暂时不可用，请稍后再试")
            connection.execute("BEGIN IMMEDIATE")
            _execute_script_in_transaction(connection, _SCHEMA_STATEMENTS)
            _validate_v3_table(connection)
            _validate_v4_tables(connection)
            _validate_v5_table(connection)
            _validate_v7_schema(connection)
            _require_verified_migration(connection)
            if connection.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                raise ValueError("invalid fresh schema-v7 integrity")
        else:
            _validate_v3_table(connection)
            _validate_v4_tables(connection)
            _validate_v5_table(connection)
            _validate_v7_schema(connection)
            _require_verified_migration(connection)
        connection.commit()
    except ShiguanStorageError:
        if connection is not None:
            connection.close()
        raise
    except (OSError, sqlite3.Error, ValueError) as exc:
        if connection is not None:
            connection.close()
        raise ShiguanStorageError("史馆存储暂时不可用，请稍后再试") from exc
    return connection


def _validate_v3_table(connection: sqlite3.Connection) -> None:
    columns = {
        row[1]
        for row in connection.execute(
            "PRAGMA table_info(archive_evidence_references)"
        ).fetchall()
    }
    expected = {
        "archive_id",
        "ordinal",
        "evidence_id",
        "pack_id",
        "investigation_id",
        "snapshot_json",
        "snapshot_hash",
    }
    if columns != expected:
        raise ValueError("invalid archive evidence reference schema")


_V4_TABLE_COLUMNS = {
    "daily_memorial_runs": {
        "id", "owner_user_id", "report_date", "source_window_start",
        "source_window_end", "status", "version", "fingerprint", "content",
        "fact_refs_json", "failure_code", "confirmed_memorial_id", "created_at",
        "updated_at", "confirmed_at",
    },
    "daily_memorial_fact_snapshots": {
        "id", "run_id", "fact_id", "snapshot_json", "created_at",
    },
    "daily_memorial_stage_results": {
        "id", "run_id", "stage", "unit_key", "status", "input_fingerprint",
        "output_json", "fact_refs_json", "attempts", "failure_code",
        "next_retry_at", "created_at", "updated_at",
    },
}


def _validate_v4_tables(connection: sqlite3.Connection) -> None:
    for table, expected in _V4_TABLE_COLUMNS.items():
        columns = {
            row[1] for row in connection.execute(f"PRAGMA table_info({table})").fetchall()
        }
        if columns != expected:
            raise ValueError(f"invalid {table} schema")


def _validate_v5_table(connection: sqlite3.Connection) -> None:
    columns = {
        row[1]
        for row in connection.execute("PRAGMA table_info(archive_decisions)").fetchall()
    }
    if columns != {
        "archive_id",
        "owner_user_id",
        "actor_user_id",
        "decision",
        "decided_at",
    }:
        raise ValueError("invalid archive_decisions schema")


_V6_TRIGGER_NAMES = {
    "auth_sessions_guard_insert",
    "auth_sessions_guard_update",
    "schema_migration_verification_guard_insert",
    "schema_migration_verification_guard_update",
    "schema_migration_verification_no_delete",
    "tenant_memberships_guard_insert",
    "tenant_memberships_guard_update",
    "tenant_memberships_no_delete",
    "tenants_guard_insert",
    "tenants_guard_update",
    "tenants_no_delete",
}


def _table_columns(connection: sqlite3.Connection, table: str) -> tuple[str, ...]:
    return tuple(row[1] for row in connection.execute(f"PRAGMA table_info({table})"))


def _execute_script_in_transaction(
    connection: sqlite3.Connection, script: str
) -> None:
    """Execute complete SQLite statements without ``executescript``'s implicit commit."""

    statement = ""
    for line in script.splitlines(keepends=True):
        statement += line
        if sqlite3.complete_statement(statement):
            connection.execute(statement)
            statement = ""
    if statement.strip():
        raise ValueError("incomplete schema statement")


def _validate_v6_schema(connection: sqlite3.Connection) -> None:
    if _table_columns(connection, "tenants") != ("id", "kind", "created_at"):
        raise ValueError("invalid tenants schema")
    if _table_columns(connection, "tenant_memberships") != (
        "id",
        "user_id",
        "tenant_id",
        "role",
        "created_at",
        "revoked_at",
    ):
        raise ValueError("invalid tenant_memberships schema")
    if _table_columns(connection, "auth_sessions") != (
        "id",
        "user_id",
        "membership_id",
        "created_at",
        "expires_at",
        "revoked_at",
    ):
        raise ValueError("invalid auth_sessions schema")
    if _table_columns(connection, "schema_migration_verification") != (
        "id",
        "status",
        "verified_at",
    ):
        raise ValueError("invalid schema_migration_verification schema")
    trigger_names = {
        row[0]
        for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type='trigger'"
        ).fetchall()
    }
    if trigger_names != _V6_TRIGGER_NAMES:
        raise ValueError("invalid schema-v6 triggers")
    if connection.execute("PRAGMA foreign_key_check").fetchall():
        raise ValueError("invalid schema-v6 foreign keys")
    from app.operations.runtime_data_registry import (
        SHIGUAN_V6_PREDECESSOR,
        schema_contract_digest_connection,
    )

    digest = schema_contract_digest_connection(connection)
    if digest != SHIGUAN_V6_PREDECESSOR.schema_contract_digest:
        raise ValueError("invalid schema-v6 contract")


_V7_TRIGGER_NAMES = _V6_TRIGGER_NAMES | {
    "archive_decisions_no_delete",
    "archive_decisions_no_update",
    "outcome_events_guard_insert",
    "outcome_events_no_delete",
    "outcome_events_no_update",
}


def _validate_v7_schema(
    connection: sqlite3.Connection, *, check_registry: bool = True
) -> None:
    if connection.execute("PRAGMA user_version").fetchone()[0] != 7:
        raise ValueError("invalid schema-v7 version")
    if _table_columns(connection, "outcome_events") != (
        "event_id",
        "tenant_id",
        "owner_user_id",
        "membership_id",
        "actor_user_id",
        "archive_id",
        "event_kind",
        "outcome",
        "source_type",
        "source_auth_level",
        "occurred_at",
        "recorded_at",
        "idempotency_key",
        "request_digest",
        "archive_digest",
        "decision_digest",
        "evidence_bundle_digest",
        "evidence_count",
        "supersedes_event_id",
        "event_digest",
    ):
        raise ValueError("invalid outcome_events schema")
    trigger_names = {
        row[0]
        for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type='trigger'"
        ).fetchall()
    }
    if trigger_names != _V7_TRIGGER_NAMES:
        raise ValueError("invalid schema-v7 triggers")
    if connection.execute("PRAGMA foreign_key_check").fetchall():
        raise ValueError("invalid schema-v7 foreign keys")
    if check_registry:
        from app.operations.runtime_data_registry import (
            RUNTIME_DATA_ENTRIES,
            schema_contract_digest_connection,
        )

        current = next(
            entry for entry in RUNTIME_DATA_ENTRIES if entry.name == "shiguan.sqlite3"
        )
        digest = schema_contract_digest_connection(connection)
        if current.user_version != 7 or digest != current.schema_contract_digest:
            raise ValueError("invalid schema-v7 contract")


def _require_verified_migration(connection: sqlite3.Connection) -> None:
    from app.operations.runtime_data_registry import is_verified_migration_state

    rows = connection.execute(
        "SELECT id, status, verified_at FROM schema_migration_verification"
    ).fetchall()
    if not is_verified_migration_state(rows):
        raise ShiguanStorageError("史馆迁移验证尚未完成")


def _validate_v5_predecessor(connection: sqlite3.Connection) -> str:
    from app.operations.runtime_data_registry import (
        SHIGUAN_V5_PREDECESSORS,
        schema_contract_digest_connection,
    )

    if connection.execute("PRAGMA user_version").fetchone()[0] != 5:
        raise ValueError("not a schema-v5 database")
    if connection.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
        raise ValueError("invalid schema-v5 integrity")
    if connection.execute("PRAGMA foreign_key_check").fetchall():
        raise ValueError("invalid schema-v5 foreign keys")
    digest = schema_contract_digest_connection(connection)
    accepted_digests = {
        predecessor.schema_contract_digest for predecessor in SHIGUAN_V5_PREDECESSORS
    }
    if digest not in accepted_digests:
        raise ValueError("invalid schema-v5 predecessor")
    return digest


def _create_canonical_v2_core_tables(connection: sqlite3.Connection) -> None:
    required = {
        "archives",
        "archive_evidence",
        "archive_relations",
        "archive_review_status",
    }
    created: set[str] = set()
    statement = ""
    for line in _V2_SCHEMA_STATEMENTS.splitlines(keepends=True):
        statement += line
        if not sqlite3.complete_statement(statement):
            continue
        normalized = statement.strip()
        for table in required - created:
            if normalized.startswith(f"CREATE TABLE IF NOT EXISTS {table} "):
                connection.execute(statement)
                created.add(table)
                break
        statement = ""
        if created == required:
            return
    raise ValueError("canonical v2 core schema is incomplete")


def _normalize_historical_v5_core_schema(connection: sqlite3.Connection) -> None:
    """Converge the one allowlisted historical v5 layout to canonical SQL."""

    suffix = "__historical_v5"
    sequence_rows = dict(
        connection.execute(
            "SELECT name, seq FROM sqlite_sequence "
            "WHERE name IN ('archive_evidence', 'archive_relations')"
        ).fetchall()
    )
    connection.execute("PRAGMA legacy_alter_table = ON")
    try:
        for table in (
            "archive_evidence",
            "archive_relations",
            "archive_review_status",
            "archives",
        ):
            connection.execute(f'ALTER TABLE "{table}" RENAME TO "{table}{suffix}"')
        _create_canonical_v2_core_tables(connection)
        connection.execute(
            "INSERT INTO archives "
            "(id,type,title,content,matter_type,department,created_at,lessons_learned,"
            "pitfalls,source_kind,source_text,participating_departments,reply_process,"
            "reply_conclusion,reply_time,respondent,owner_user_id) "
            f"SELECT id,type,title,content,matter_type,department,created_at,"
            "lessons_learned,pitfalls,source_kind,source_text,participating_departments,"
            "reply_process,reply_conclusion,reply_time,respondent,owner_user_id "
            f'FROM "archives{suffix}"'
        )
        connection.execute(
            "INSERT INTO archive_evidence (id,archive_id,source,reality_label,note) "
            f'SELECT id,archive_id,source,reality_label,note FROM "archive_evidence{suffix}"'
        )
        connection.execute(
            "INSERT INTO archive_relations (seq,archive_id,related_id) "
            f'SELECT seq,archive_id,related_id FROM "archive_relations{suffix}"'
        )
        connection.execute(
            "INSERT INTO archive_review_status (archive_id,status,reviewed_at,note) "
            f'SELECT archive_id,status,reviewed_at,note FROM "archive_review_status{suffix}"'
        )
        for table in (
            "archive_evidence",
            "archive_relations",
            "archive_review_status",
            "archives",
        ):
            connection.execute(f'DROP TABLE "{table}{suffix}"')
        for table, sequence in sequence_rows.items():
            connection.execute("DELETE FROM sqlite_sequence WHERE name = ?", (table,))
            connection.execute(
                "INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)",
                (table, sequence),
            )
    finally:
        connection.execute("PRAGMA legacy_alter_table = OFF")


def _content_digest_value(value: object) -> bytes:
    if value is None:
        return b"null"
    if isinstance(value, bytes):
        return b"bytes:" + value
    if isinstance(value, str):
        return b"text:" + value.encode("utf-8")
    if isinstance(value, int):
        return f"int:{value}".encode("ascii")
    if isinstance(value, float):
        return f"float:{value.hex()}".encode("ascii")
    raise TypeError(f"unsupported SQLite value: {type(value).__name__}")


def _legacy_content_snapshot(
    connection: sqlite3.Connection,
) -> dict[str, tuple[int, str]]:
    """Stream stable row counts and digests for every schema-v5 data table."""

    from app.operations.runtime_data_registry import SHIGUAN_V5_PREDECESSOR

    snapshot: dict[str, tuple[int, str]] = {}
    for table in SHIGUAN_V5_PREDECESSOR.required_tables:
        table_info = connection.execute(f'PRAGMA table_info("{table}")').fetchall()
        columns = tuple(row[1] for row in table_info)
        primary_key = tuple(
            column
            for _, column in sorted(
                (row[5], row[1]) for row in table_info if row[5]
            )
        )
        if not primary_key:
            raise ValueError(f"schema-v5 table has no primary key: {table}")
        projection = tuple(sorted(columns))
        if table == "auth_sessions" and "membership_id" in columns:
            projection = tuple(
                column for column in projection if column != "membership_id"
            )
        quoted_columns = ", ".join(f'"{column}"' for column in projection)
        order_by = ", ".join(f'"{column}"' for column in primary_key)
        cursor = connection.execute(
            f'SELECT {quoted_columns} FROM "{table}" ORDER BY {order_by}'
        )
        digest = hashlib.sha256()
        row_count = 0
        while rows := cursor.fetchmany(512):
            for row in rows:
                row_count += 1
                digest.update(len(row).to_bytes(4, "big"))
                for value in row:
                    encoded = _content_digest_value(value)
                    digest.update(len(encoded).to_bytes(8, "big"))
                    digest.update(encoded)
        snapshot[table] = (row_count, f"sha256:{digest.hexdigest()}")
    return snapshot


def _v6_content_snapshot(
    connection: sqlite3.Connection,
) -> dict[str, tuple[int, str]]:
    """Freeze canonical v6 business bytes with the existing typed framing."""

    from app.operations.runtime_data_registry import SHIGUAN_V6_PREDECESSOR

    snapshot: dict[str, tuple[int, str]] = {}
    for table in SHIGUAN_V6_PREDECESSOR.required_tables:
        if table == "schema_migration_verification":
            continue
        table_info = connection.execute(f'PRAGMA table_info("{table}")').fetchall()
        columns = tuple(row[1] for row in table_info)
        primary_key = tuple(
            column
            for _, column in sorted(
                (row[5], row[1]) for row in table_info if row[5]
            )
        )
        if not primary_key:
            raise ValueError(f"schema-v6 table has no primary key: {table}")
        projection = tuple(sorted(columns))
        quoted_columns = ", ".join(f'"{column}"' for column in projection)
        order_by = ", ".join(f'"{column}"' for column in primary_key)
        cursor = connection.execute(
            f'SELECT {quoted_columns} FROM "{table}" ORDER BY {order_by}'
        )
        digest = hashlib.sha256()
        row_count = 0
        while rows := cursor.fetchmany(512):
            for row in rows:
                row_count += 1
                digest.update(len(row).to_bytes(4, "big"))
                for value in row:
                    encoded = _content_digest_value(value)
                    digest.update(len(encoded).to_bytes(8, "big"))
                    digest.update(encoded)
        snapshot[table] = (row_count, f"sha256:{digest.hexdigest()}")
    return snapshot


def _migrate_v6_to_v7_connection(connection: sqlite3.Connection) -> None:
    """Apply v7 on a verified canonical-v6 transaction, leaving it pending."""

    _validate_v6_schema(connection)
    _require_verified_migration(connection)
    content_before = _v6_content_snapshot(connection)
    guard_row = connection.execute(
        "SELECT sql FROM sqlite_master WHERE type='trigger' "
        "AND name='schema_migration_verification_guard_update'"
    ).fetchone()
    if guard_row is None or not isinstance(guard_row[0], str):
        raise ValueError("missing schema-v6 migration guard")
    connection.execute("DROP TRIGGER schema_migration_verification_guard_update")
    connection.execute(
        "UPDATE schema_migration_verification "
        "SET status='PENDING_VERIFICATION', verified_at=NULL WHERE id=1"
    )
    connection.execute(guard_row[0])
    _execute_script_in_transaction(connection, _V7_OUTCOME_SCHEMA)
    connection.execute("PRAGMA user_version = 7")
    _validate_v7_schema(connection)
    if _v6_content_snapshot(connection) != content_before:
        raise ValueError("schema-v6 content changed during v7 migration")
    if connection.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
        raise ValueError("invalid schema-v7 integrity")


def migrate_v6_to_v7(path: Path) -> None:
    """Atomically add Outcome storage, leaving post-commit verification pending."""

    connection: sqlite3.Connection | None = None
    try:
        connection = sqlite3.connect(path)
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("BEGIN IMMEDIATE")
        _migrate_v6_to_v7_connection(connection)
        connection.commit()
    except (OSError, sqlite3.Error, ValueError, ShiguanStorageError) as exc:
        if connection is not None:
            connection.rollback()
        raise ShiguanStorageError("史馆 v6 到 v7 无法迁移") from exc
    finally:
        if connection is not None:
            connection.close()


def _validate_v5_identity_namespace(connection: sqlite3.Connection) -> None:
    """Reject only identifiers that resolve to more than one legacy user."""

    owners: dict[str, str] = {}
    rows = connection.execute(
        "SELECT id, username, email FROM users ORDER BY id"
    ).fetchall()
    for user_id, username, email in rows:
        if not isinstance(user_id, str) or not user_id:
            raise ValueError("schema-v5 user identity is invalid")
        for identifier in (username, email):
            if not isinstance(identifier, str) or not (key := identifier.strip().casefold()):
                raise ValueError("schema-v5 user identity is invalid")
            previous_user_id = owners.setdefault(key, user_id)
            if previous_user_id != user_id:
                raise ValueError("schema-v5 identity namespace is ambiguous")


def _migrate_v5_to_v6_connection(connection: sqlite3.Connection) -> None:
    """Apply v6 on a caller-owned schema-v5 transaction without committing."""

    predecessor_digest = _validate_v5_predecessor(connection)
    _validate_v5_identity_namespace(connection)
    from app.operations.runtime_data_registry import SHIGUAN_V5_PREDECESSOR

    legacy_before = _legacy_content_snapshot(connection)
    if predecessor_digest != SHIGUAN_V5_PREDECESSOR.schema_contract_digest:
        _normalize_historical_v5_core_schema(connection)
    connection.execute(
        """CREATE TABLE tenants (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind = 'PERSONAL'),
    created_at TEXT NOT NULL
)"""
    )
    connection.execute(
        """CREATE TABLE tenant_memberships (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    tenant_id TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role = 'OWNER'),
    created_at TEXT NOT NULL,
    revoked_at TEXT,
    UNIQUE (id, user_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
)"""
    )
    for user_id, created_at in connection.execute(
        "SELECT id, created_at FROM users ORDER BY id"
    ).fetchall():
        tenant_id = str(uuid.uuid4())
        membership_id = str(uuid.uuid4())
        connection.execute(
            "INSERT INTO tenants VALUES (?, 'PERSONAL', ?)",
            (tenant_id, created_at),
        )
        connection.execute(
            "INSERT INTO tenant_memberships VALUES (?, ?, ?, 'OWNER', ?, NULL)",
            (membership_id, user_id, tenant_id, created_at),
        )

    connection.execute("DROP INDEX idx_auth_sessions_active_user")
    connection.execute("ALTER TABLE auth_sessions RENAME TO auth_sessions_v5")
    connection.execute(
        """CREATE TABLE auth_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    membership_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (membership_id, user_id)
        REFERENCES tenant_memberships(id, user_id)
)"""
    )
    connection.execute(
        "INSERT INTO auth_sessions "
        "(id, user_id, membership_id, created_at, expires_at, revoked_at) "
        "SELECT sessions.id, sessions.user_id, memberships.id, sessions.created_at, "
        "sessions.expires_at, sessions.revoked_at FROM auth_sessions_v5 AS sessions "
        "JOIN tenant_memberships AS memberships ON memberships.user_id = sessions.user_id"
    )
    connection.execute("DROP TABLE auth_sessions_v5")
    connection.execute(
        """CREATE INDEX idx_auth_sessions_active_user
ON auth_sessions (user_id, id, expires_at)"""
    )
    connection.execute(
        """CREATE INDEX idx_auth_sessions_membership_user
ON auth_sessions (membership_id, user_id)"""
    )
    _execute_script_in_transaction(connection, _V6_GOVERNANCE_SCHEMA)
    connection.execute(
        "INSERT INTO schema_migration_verification (id, status, verified_at) "
        "VALUES (1, 'PENDING_VERIFICATION', NULL)"
    )
    connection.execute("PRAGMA user_version = 6")
    _validate_v6_schema(connection)
    if _legacy_content_snapshot(connection) != legacy_before:
        raise ValueError("schema-v5 content changed during migration")
    user_count = connection.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    tenant_count = connection.execute("SELECT COUNT(*) FROM tenants").fetchone()[0]
    membership_count = connection.execute(
        "SELECT COUNT(*) FROM tenant_memberships"
    ).fetchone()[0]
    unbound_sessions = connection.execute(
        "SELECT COUNT(*) FROM auth_sessions AS sessions "
        "LEFT JOIN tenant_memberships AS memberships "
        "ON memberships.id = sessions.membership_id "
        "AND memberships.user_id = sessions.user_id WHERE memberships.id IS NULL"
    ).fetchone()[0]
    if user_count != tenant_count or user_count != membership_count or unbound_sessions:
        raise ValueError("schema-v6 principal backfill is incomplete")
    if connection.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
        raise ValueError("invalid schema-v6 integrity")


def migrate_v5_to_v6(path: Path) -> None:
    """Atomically backfill personal principals, leaving verification pending."""

    connection: sqlite3.Connection | None = None
    try:
        connection = sqlite3.connect(path)
        connection.execute("PRAGMA foreign_keys = OFF")
        connection.execute("BEGIN IMMEDIATE")
        _migrate_v5_to_v6_connection(connection)
        connection.commit()
    except (OSError, sqlite3.Error, ValueError) as exc:
        if connection is not None:
            connection.rollback()
        raise ShiguanStorageError("史馆 v5 到 v6 无法迁移") from exc
    finally:
        if connection is not None:
            connection.close()


def migrate_v4_to_v5(path: Path) -> None:
    """Atomically add immutable archive decisions to a schema-v4 database."""

    connection: sqlite3.Connection | None = None
    try:
        connection = sqlite3.connect(path)
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("BEGIN IMMEDIATE")
        version = connection.execute("PRAGMA user_version").fetchone()[0]
        has_schema = connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='archives'"
        ).fetchone()
        if version != 4 or has_schema is None:
            raise ValueError("not a schema-v4 database")
        _validate_v3_table(connection)
        _validate_v4_tables(connection)
        connection.execute(
            """
CREATE TABLE archive_decisions (
    archive_id TEXT PRIMARY KEY,
    owner_user_id TEXT NOT NULL,
    actor_user_id TEXT NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN (
        'APPROVED', 'REJECTED', 'ADOPTED', 'RETURNED_FOR_RECONSIDERATION'
    )),
    decided_at TEXT NOT NULL,
    FOREIGN KEY (archive_id) REFERENCES archives(id)
)
            """
        )
        _validate_v5_table(connection)
        connection.execute("PRAGMA user_version = 5")
        connection.commit()
    except (OSError, sqlite3.Error, ValueError) as exc:
        if connection is not None:
            connection.rollback()
        raise ShiguanStorageError("史馆 v4 到 v5 无法迁移") from exc
    finally:
        if connection is not None:
            connection.close()


def migrate_v3_to_v4(path: Path) -> None:
    """Atomically add daily memorial persistence to a schema-v3 database."""

    connection: sqlite3.Connection | None = None
    try:
        connection = sqlite3.connect(path)
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("BEGIN IMMEDIATE")
        version = connection.execute("PRAGMA user_version").fetchone()[0]
        has_schema = connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='archives'"
        ).fetchone()
        if version != 3 or has_schema is None:
            raise ValueError("not a schema-v3 database")
        _validate_v3_table(connection)
        for statement in _DAILY_MEMORIAL_SCHEMA.split(";"):
            if statement.strip():
                connection.execute(statement)
        _validate_v4_tables(connection)
        connection.execute("PRAGMA user_version = 4")
        connection.commit()
    except (OSError, sqlite3.Error, ValueError) as exc:
        if connection is not None:
            connection.rollback()
        raise ShiguanStorageError("史馆 v3 到 v4 无法迁移") from exc
    finally:
        if connection is not None:
            connection.close()


def migrate_v2_to_v3(path: Path) -> None:
    """Atomically add immutable evidence-reference snapshots to a v2 database."""

    connection: sqlite3.Connection | None = None
    try:
        connection = sqlite3.connect(path)
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("BEGIN IMMEDIATE")
        version = connection.execute("PRAGMA user_version").fetchone()[0]
        has_schema = connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='archives'"
        ).fetchone()
        if version != 2 or has_schema is None:
            raise ValueError("not a schema-v2 database")
        _add_missing_archive_columns(connection)
        for statement in _AUTH_SCHEMA.split(";"):
            if statement.strip():
                connection.execute(statement)
        connection.execute(_EVIDENCE_REFERENCES_SCHEMA)
        _validate_v3_table(connection)
        connection.execute("PRAGMA user_version = 3")
        connection.commit()
    except (OSError, sqlite3.Error, ValueError) as exc:
        if connection is not None:
            connection.rollback()
        raise ShiguanStorageError("史馆 v2 到 v3 无法迁移") from exc
    finally:
        if connection is not None:
            connection.close()


def migrate_v1_to_v2(path: Path, *, confirmed_pairs: dict[str, str]) -> None:
    """Explicitly migrate confirmed generated MEMORIAL+DECISION pairs.

    No relationship is inferred. Every legacy DECISION must appear in
    ``confirmed_pairs`` and its mapped MEMORIAL must be its sole relation,
    be unshared, and exist as a MEMORIAL. Any mismatch rolls back the whole
    migration.
    """

    connection: sqlite3.Connection | None = None
    try:
        connection = sqlite3.connect(path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("BEGIN IMMEDIATE")

        version = connection.execute("PRAGMA user_version").fetchone()[0]
        has_schema = connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'archives'"
        ).fetchone()
        if not has_schema or version not in (0, 1):
            raise ValueError("not a supported v1 database")

        type_rows = connection.execute("SELECT DISTINCT type FROM archives").fetchall()
        archive_types = {row["type"] for row in type_rows}
        if not archive_types <= {"MEMORIAL", "DECISION"}:
            raise ValueError("unsupported legacy archive type")

        decision_ids = {
            row["id"]
            for row in connection.execute(
                "SELECT id FROM archives WHERE type = 'DECISION'"
            ).fetchall()
        }
        if set(confirmed_pairs) != decision_ids:
            raise ValueError("every decision requires explicit confirmation")
        if len(set(confirmed_pairs.values())) != len(confirmed_pairs):
            raise ValueError("a memorial cannot be shared")

        source_text_by_decision: dict[str, str] = {}
        for decision_id, memorial_id in confirmed_pairs.items():
            relation_rows = connection.execute(
                "SELECT related_id FROM archive_relations WHERE archive_id = ?",
                (decision_id,),
            ).fetchall()
            if [row["related_id"] for row in relation_rows] != [memorial_id]:
                raise ValueError("confirmed pair does not match its sole relation")
            memorial = connection.execute(
                "SELECT type, content FROM archives WHERE id = ?", (memorial_id,)
            ).fetchone()
            if memorial is None or memorial["type"] != "MEMORIAL":
                raise ValueError("confirmed source is not a memorial")
            reference_count = connection.execute(
                "SELECT COUNT(*) FROM archive_relations WHERE related_id = ?",
                (memorial_id,),
            ).fetchone()[0]
            outgoing_count = connection.execute(
                "SELECT COUNT(*) FROM archive_relations WHERE archive_id = ?",
                (memorial_id,),
            ).fetchone()[0]
            if reference_count != 1 or outgoing_count != 0:
                raise ValueError("confirmed memorial has ambiguous relations")
            source_text_by_decision[decision_id] = memorial["content"]

        connection.execute("ALTER TABLE archives ADD COLUMN source_kind TEXT")
        connection.execute("ALTER TABLE archives ADD COLUMN source_text TEXT")
        connection.execute("ALTER TABLE archives RENAME COLUMN decision_process TO reply_process")
        connection.execute(
            "ALTER TABLE archives RENAME COLUMN decision_conclusion TO reply_conclusion"
        )
        connection.execute("ALTER TABLE archives RENAME COLUMN decision_time TO reply_time")
        connection.execute("ALTER TABLE archives RENAME COLUMN responsible_owner TO respondent")

        for decision_id, memorial_id in confirmed_pairs.items():
            connection.execute(
                "UPDATE archives SET type = 'REPLY', source_kind = 'DECREE', source_text = ? "
                "WHERE id = ?",
                (source_text_by_decision[decision_id], decision_id),
            )
            connection.execute(
                "DELETE FROM archive_evidence WHERE archive_id = ?", (memorial_id,)
            )
            connection.execute(
                "DELETE FROM archive_review_status WHERE archive_id = ?", (memorial_id,)
            )
            connection.execute(
                "DELETE FROM archive_relations WHERE archive_id = ? OR related_id = ?",
                (memorial_id, memorial_id),
            )
            connection.execute("DELETE FROM archives WHERE id = ?", (memorial_id,))

        connection.execute("PRAGMA user_version = 2")
        connection.commit()
    except (OSError, sqlite3.Error, ValueError) as exc:
        if connection is not None:
            connection.rollback()
        raise ShiguanStorageError(_LEGACY_MIGRATION_ERROR) from exc
    finally:
        if connection is not None:
            connection.close()
