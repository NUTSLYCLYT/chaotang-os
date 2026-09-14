"""Closed, owner-scoped SQLite persistence for Mingshuo project fact packs."""

from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

_DEFAULT_DB_PATH = Path(__file__).resolve().parents[2] / "data" / "mingshuo.sqlite3"
BUSY_TIMEOUT_MS = 5_000
USER_VERSION = 2

_SCHEMA = """
CREATE TABLE IF NOT EXISTS mingshuo_projects (
    project_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    owner_user_id TEXT NOT NULL,
    project_name TEXT NOT NULL,
    product_lines_json TEXT NOT NULL,
    markets_json TEXT NOT NULL,
    languages_json TEXT NOT NULL,
    current_revision INTEGER NOT NULL CHECK (current_revision BETWEEN 1 AND 64),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (tenant_id, owner_user_id, project_id)
);

CREATE TABLE IF NOT EXISTS mingshuo_requirement_revisions (
    requirements_revision_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    owner_user_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK (revision BETWEEN 1 AND 64),
    requirements_text TEXT NOT NULL,
    requirements_digest TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (tenant_id, owner_user_id, project_id, revision),
    UNIQUE (tenant_id, owner_user_id, project_id, requirements_revision_id),
    FOREIGN KEY (tenant_id, owner_user_id, project_id)
        REFERENCES mingshuo_projects (tenant_id, owner_user_id, project_id)
);

CREATE TABLE IF NOT EXISTS mingshuo_fact_pack_revisions (
    fact_pack_revision_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    owner_user_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    version INTEGER NOT NULL CHECK (version BETWEEN 1 AND 64),
    requirements_revision_id TEXT NOT NULL,
    canonical_bytes BLOB NOT NULL,
    fact_pack_digest TEXT NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('PASS','HOLD','BLOCK')),
    errors_json TEXT NOT NULL,
    hold_reasons_json TEXT NOT NULL,
    block_reasons_json TEXT NOT NULL,
    evidence_digest TEXT NOT NULL,
    fact_digest TEXT NOT NULL,
    claim_digest TEXT NOT NULL,
    evaluated_utc_day TEXT NOT NULL,
    evaluator_policy_version TEXT NOT NULL,
    schema_policy_version TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (tenant_id, owner_user_id, project_id, version),
    UNIQUE (tenant_id, owner_user_id, project_id, fact_pack_revision_id),
    FOREIGN KEY (tenant_id, owner_user_id, project_id, requirements_revision_id)
        REFERENCES mingshuo_requirement_revisions
            (tenant_id, owner_user_id, project_id, requirements_revision_id),
    FOREIGN KEY (tenant_id, owner_user_id, project_id)
        REFERENCES mingshuo_projects (tenant_id, owner_user_id, project_id)
);

CREATE TABLE IF NOT EXISTS mingshuo_draft_requests (
    draft_request_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    owner_user_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    request_key TEXT NOT NULL,
    request_fingerprint TEXT NOT NULL,
    fact_pack_version INTEGER NOT NULL,
    fact_pack_digest TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status = 'NON_AUTHORIZING'),
    created_at TEXT NOT NULL,
    UNIQUE (tenant_id, owner_user_id, request_key),
    UNIQUE (tenant_id, owner_user_id, project_id, draft_request_id),
    FOREIGN KEY (tenant_id, owner_user_id, project_id, fact_pack_version)
        REFERENCES mingshuo_fact_pack_revisions (tenant_id, owner_user_id, project_id, version),
    FOREIGN KEY (tenant_id, owner_user_id, project_id)
        REFERENCES mingshuo_projects (tenant_id, owner_user_id, project_id)
);

CREATE TABLE IF NOT EXISTS mingshuo_idempotency_keys (
    tenant_id TEXT NOT NULL,
    owner_user_id TEXT NOT NULL,
    request_key TEXT NOT NULL,
    operation TEXT NOT NULL,
    project_id TEXT NOT NULL,
    fact_pack_version INTEGER NOT NULL,
    fact_pack_digest TEXT NOT NULL,
    request_fingerprint TEXT NOT NULL,
    result_kind TEXT NOT NULL,
    result_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (tenant_id, owner_user_id, request_key),
    FOREIGN KEY (tenant_id, owner_user_id, project_id)
        REFERENCES mingshuo_projects (tenant_id, owner_user_id, project_id)
);

CREATE TABLE IF NOT EXISTS mingshuo_delivery_intents (
    draft_request_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    owner_user_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    fact_pack_version INTEGER NOT NULL CHECK (fact_pack_version BETWEEN 1 AND 64),
    fact_pack_digest TEXT NOT NULL,
    binding_json TEXT NOT NULL,
    binding_digest TEXT NOT NULL,
    cell_projection_digest TEXT NOT NULL,
    artifact_id TEXT NOT NULL,
    work_product_id TEXT NOT NULL,
    artifact_sha256 TEXT NOT NULL,
    work_product_digest TEXT NOT NULL,
    state TEXT NOT NULL CHECK (
        state IN ('PREPARED','ARTIFACT_PENDING','WORK_PRODUCT_BOUND')
    ),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (tenant_id, owner_user_id, project_id, draft_request_id),
    UNIQUE (artifact_id),
    UNIQUE (work_product_id),
    FOREIGN KEY (tenant_id, owner_user_id, project_id, draft_request_id)
        REFERENCES mingshuo_draft_requests
            (tenant_id, owner_user_id, project_id, draft_request_id),
    FOREIGN KEY (tenant_id, owner_user_id, project_id)
        REFERENCES mingshuo_projects (tenant_id, owner_user_id, project_id)
);

CREATE TRIGGER IF NOT EXISTS mingshuo_projects_no_delete
BEFORE DELETE ON mingshuo_projects
BEGIN SELECT RAISE(ABORT, 'immutable project'); END;

CREATE TRIGGER IF NOT EXISTS mingshuo_project_identity_guard_update
BEFORE UPDATE ON mingshuo_projects
WHEN NEW.project_id != OLD.project_id
  OR NEW.tenant_id != OLD.tenant_id
  OR NEW.owner_user_id != OLD.owner_user_id
  OR NEW.project_name != OLD.project_name
  OR NEW.product_lines_json != OLD.product_lines_json
  OR NEW.markets_json != OLD.markets_json
  OR NEW.languages_json != OLD.languages_json
  OR NEW.current_revision != OLD.current_revision + 1
  OR NEW.updated_at <= OLD.updated_at
BEGIN SELECT RAISE(ABORT, 'invalid project transition'); END;

CREATE TRIGGER IF NOT EXISTS mingshuo_requirement_revisions_no_update
BEFORE UPDATE ON mingshuo_requirement_revisions
BEGIN SELECT RAISE(ABORT, 'immutable requirement revision'); END;

CREATE TRIGGER IF NOT EXISTS mingshuo_requirement_revisions_no_delete
BEFORE DELETE ON mingshuo_requirement_revisions
BEGIN SELECT RAISE(ABORT, 'immutable requirement revision'); END;

CREATE TRIGGER IF NOT EXISTS mingshuo_fact_pack_revisions_no_update
BEFORE UPDATE ON mingshuo_fact_pack_revisions
BEGIN SELECT RAISE(ABORT, 'immutable fact pack revision'); END;

CREATE TRIGGER IF NOT EXISTS mingshuo_fact_pack_revisions_no_delete
BEFORE DELETE ON mingshuo_fact_pack_revisions
BEGIN SELECT RAISE(ABORT, 'immutable fact pack revision'); END;

CREATE TRIGGER IF NOT EXISTS mingshuo_draft_requests_no_update
BEFORE UPDATE ON mingshuo_draft_requests
BEGIN SELECT RAISE(ABORT, 'immutable draft request'); END;

CREATE TRIGGER IF NOT EXISTS mingshuo_draft_requests_no_delete
BEFORE DELETE ON mingshuo_draft_requests
BEGIN SELECT RAISE(ABORT, 'immutable draft request'); END;

CREATE TRIGGER IF NOT EXISTS mingshuo_idempotency_keys_no_update
BEFORE UPDATE ON mingshuo_idempotency_keys
BEGIN SELECT RAISE(ABORT, 'immutable idempotency key'); END;

CREATE TRIGGER IF NOT EXISTS mingshuo_idempotency_keys_no_delete
BEFORE DELETE ON mingshuo_idempotency_keys
BEGIN SELECT RAISE(ABORT, 'immutable idempotency key'); END;

CREATE TRIGGER IF NOT EXISTS mingshuo_delivery_intents_no_delete
BEFORE DELETE ON mingshuo_delivery_intents
BEGIN SELECT RAISE(ABORT, 'immutable delivery intent'); END;

CREATE TRIGGER IF NOT EXISTS mingshuo_delivery_intents_guard_update
BEFORE UPDATE ON mingshuo_delivery_intents
WHEN NEW.draft_request_id IS NOT OLD.draft_request_id
  OR NEW.tenant_id IS NOT OLD.tenant_id
  OR NEW.owner_user_id IS NOT OLD.owner_user_id
  OR NEW.project_id IS NOT OLD.project_id
  OR NEW.fact_pack_version IS NOT OLD.fact_pack_version
  OR NEW.fact_pack_digest IS NOT OLD.fact_pack_digest
  OR NEW.binding_json IS NOT OLD.binding_json
  OR NEW.binding_digest IS NOT OLD.binding_digest
  OR NEW.cell_projection_digest IS NOT OLD.cell_projection_digest
  OR NEW.artifact_id IS NOT OLD.artifact_id
  OR NEW.work_product_id IS NOT OLD.work_product_id
  OR NEW.artifact_sha256 IS NOT OLD.artifact_sha256
  OR NEW.work_product_digest IS NOT OLD.work_product_digest
  OR NEW.created_at IS NOT OLD.created_at
  OR NEW.updated_at <= OLD.updated_at
  OR NOT (
      (OLD.state = 'PREPARED' AND NEW.state = 'ARTIFACT_PENDING')
      OR (OLD.state = 'ARTIFACT_PENDING' AND NEW.state = 'WORK_PRODUCT_BOUND')
  )
BEGIN SELECT RAISE(ABORT, 'invalid delivery intent transition'); END;
"""


class MingshuoStorageError(RuntimeError):
    """A storage or integrity operation failed without exposing internals."""


class MingshuoConflictError(RuntimeError):
    """A state or idempotency contract conflict occurred."""


class MingshuoNotFoundError(RuntimeError):
    """The owner-scoped project identity was not found."""


def _connect(path: Path | None = None) -> sqlite3.Connection:
    resolved = path if path is not None else _DEFAULT_DB_PATH
    resolved.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(
        resolved,
        timeout=BUSY_TIMEOUT_MS / 1_000,
        isolation_level=None,
        check_same_thread=False,
    )
    connection.row_factory = sqlite3.Row
    try:
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute(f"PRAGMA busy_timeout = {BUSY_TIMEOUT_MS}")
        connection.execute("PRAGMA journal_mode = WAL")
        connection.execute("PRAGMA synchronous = FULL")
        version = int(connection.execute("PRAGMA user_version").fetchone()[0])
        existing_tables = {
            str(row[0])
            for row in connection.execute(
                "SELECT name FROM sqlite_master "
                "WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            )
        }
        if version not in {0, 1, USER_VERSION} or (version == 0 and existing_tables):
            raise MingshuoStorageError("unsupported schema")
        connection.executescript(_SCHEMA)
        connection.execute(f"PRAGMA user_version = {USER_VERSION}")
    except Exception:
        connection.close()
        raise
    return connection


def initialize_database(path: Path | None = None) -> None:
    connection = _connect(path)
    connection.close()


@contextmanager
def write_transaction(path: Path | None = None) -> Iterator[sqlite3.Connection]:
    connection = _connect(path)
    try:
        connection.execute("BEGIN IMMEDIATE")
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


@contextmanager
def read_connection(path: Path | None = None) -> Iterator[sqlite3.Connection]:
    connection = _connect(path)
    try:
        connection.execute("PRAGMA query_only = ON")
        yield connection
    finally:
        connection.close()


def count_rows(table: str, path: Path | None = None) -> int:
    allowed = {
        "mingshuo_projects",
        "mingshuo_requirement_revisions",
        "mingshuo_fact_pack_revisions",
        "mingshuo_draft_requests",
        "mingshuo_idempotency_keys",
        "mingshuo_delivery_intents",
    }
    if table not in allowed:
        raise ValueError("unknown table")
    with read_connection(path) as connection:
        return int(connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0])


__all__ = [
    "MingshuoConflictError",
    "MingshuoNotFoundError",
    "MingshuoStorageError",
    "count_rows",
    "initialize_database",
    "read_connection",
    "write_transaction",
]
