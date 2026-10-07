from __future__ import annotations

import hashlib
import json
import secrets
import shutil
import sqlite3
import tempfile
from contextlib import closing
from datetime import UTC, datetime, timedelta
from pathlib import Path

from .models import AcceptDecreeJob, AcceptedDecreeJob, DecreeJob, DecreeJobState

DEFAULT_DB_PATH = Path(__file__).resolve().parents[2] / "data" / "decree_jobs.sqlite3"
MAX_ATTEMPTS = 2


class DecreeJobStoreError(RuntimeError):
    pass


class IdempotencyConflict(DecreeJobStoreError):
    pass


class JobNotFound(DecreeJobStoreError):
    pass


class JobHistoryArchiveRejected(DecreeJobStoreError):
    pass


class LeaseConflict(DecreeJobStoreError):
    pass


class ProviderRequestLimitExceeded(DecreeJobStoreError):
    pass


class ClaimEvidenceCommitmentUnavailable(DecreeJobStoreError):
    """A future claim-evidence sidecar is present but is inert in B1."""


def _require_legacy_commitment(row: sqlite3.Row) -> None:
    if row["claim_evidence_commitment_json"] is not None:
        raise ClaimEvidenceCommitmentUnavailable("claim_evidence_commitment_unavailable")


def _iso(value: datetime) -> str:
    if value.tzinfo is None:
        raise ValueError("timestamps must be timezone-aware")
    return value.astimezone(UTC).isoformat()


def _datetime(value: str | None) -> datetime | None:
    return datetime.fromisoformat(value) if value is not None else None


class DecreeJobStore:
    def __init__(self, db_path: Path = DEFAULT_DB_PATH) -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path, timeout=5)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA journal_mode = WAL")
        connection.execute("PRAGMA busy_timeout = 5000")
        return connection

    def _connect_for_initialization(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path, timeout=5)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA busy_timeout = 5000")
        return connection

    _EARLIEST_SCHEMA_SQL = """
CREATE TABLE decree_jobs (
    job_id TEXT PRIMARY KEY,
    owner_user_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    draft_fingerprint TEXT NOT NULL,
    decree_text TEXT NOT NULL,
    approved_route_json TEXT NOT NULL,
    state TEXT NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    provider_request_count INTEGER NOT NULL DEFAULT 0,
    cancel_requested INTEGER NOT NULL DEFAULT 0,
    result_json TEXT,
    reply_id TEXT,
    error_code TEXT,
    deadline_at TEXT NOT NULL,
    retry_at TEXT,
    lease_owner TEXT,
    lease_expires_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(owner_user_id, idempotency_key),
    UNIQUE(owner_user_id, draft_fingerprint)
)
"""
    _PRE_AUTHORITY_SCHEMA_SQL = """
CREATE TABLE decree_jobs (
    job_id TEXT PRIMARY KEY,
    owner_user_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    draft_fingerprint TEXT NOT NULL,
    decree_text TEXT NOT NULL,
    approved_route_json TEXT NOT NULL,
    state TEXT NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    provider_request_count INTEGER NOT NULL DEFAULT 0,
    provider_request_limit INTEGER NOT NULL DEFAULT 8,
    cancel_requested INTEGER NOT NULL DEFAULT 0,
    result_json TEXT,
    reply_id TEXT,
    error_code TEXT,
    error_stage TEXT,
    error_category TEXT,
    acceptance_committed INTEGER NOT NULL DEFAULT 1,
    deadline_at TEXT NOT NULL,
    retry_at TEXT,
    lease_owner TEXT,
    lease_expires_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(owner_user_id, idempotency_key),
    UNIQUE(owner_user_id, draft_fingerprint)
)
"""
    _FRESH_SCHEMA = "sha256:0c346e52fa80d30e8948d709d7e83d84389c51ec195a866f44bd874fb414fb51"
    _EXACT_NEW_SCHEMA = "sha256:8b38c49b719aa2a758ba037eb436d6fdf97db50e0a4b8cabd874b1a20f3059c2"
    _HISTORY_SCHEMA = "sha256:9786efdbe7fe9df671ac4e7af03b6371f6d568c03e5c39c88a77c47986ae2eb6"
    # A real decree execution adds the two fixed task-token budget tables to
    # this database. Keep their combined schema identity explicit so restart
    # recovery accepts this known state without accepting arbitrary drift.
    _HISTORY_WITH_TASK_BUDGET_SCHEMA = (
        "sha256:e5ab48cea44661db2ed0f53b7d9bcfdc8badf6932a3571d77946469ee10959a4"
    )
    _EXACT_OLD_SCHEMA = "sha256:aa2938733179612f5d4decd4f5e363be7dafaee5d38128273fef9f24eea3f027"
    _EARLIEST_SCHEMA = "sha256:8632c03d798b1a3ac0e5e2774d8d64c4af7d1c734b0b95b2d2d3465b9b3e1124"
    _PRE_AUTHORITY_SCHEMA = (
        "sha256:dbfd9074ca92d0538f97e63320360bff1ba38d634afa892e0bf5cb00d8d5cffc"
    )
    _TEMP_PARENT = "__ct_p10b1_decree_jobs_old"
    _TEMP_CHILD = "__ct_p10b1_decree_job_idempotency_keys_old"

    @staticmethod
    def _quoted(name: str) -> str:
        return '"' + name.replace('"', '""') + '"'

    @classmethod
    def _schema_record(cls, connection: sqlite3.Connection) -> dict[str, object]:
        object_rows = connection.execute(
            "SELECT type, name, tbl_name, sql FROM sqlite_schema "
            "WHERE name NOT LIKE 'sqlite_%' "
            "ORDER BY type COLLATE BINARY, name COLLATE BINARY"
        ).fetchall()
        objects = [
            {
                "type": str(row[0]),
                "name": str(row[1]),
                "tableName": str(row[2]),
                "sql": str(row[3]).replace("\r\n", "\n").replace("\r", "\n").strip(),
            }
            for row in object_rows
        ]
        tables = sorted(
            (str(row[1]) for row in object_rows if row[0] == "table"),
            key=lambda value: value.encode("utf-8"),
        )
        table_xinfo: dict[str, object] = {}
        foreign_keys: dict[str, object] = {}
        indexes: dict[str, object] = {}
        for table in tables:
            quoted_table = cls._quoted(table)
            table_xinfo[table] = [
                {
                    "cid": int(row[0]),
                    "name": str(row[1]),
                    "type": str(row[2]),
                    "notNull": int(row[3]),
                    "defaultValue": row[4],
                    "pk": int(row[5]),
                    "hidden": int(row[6]),
                }
                for row in sorted(
                    connection.execute(f"PRAGMA main.table_xinfo({quoted_table})").fetchall(),
                    key=lambda row: int(row[0]),
                )
            ]
            foreign_keys[table] = [
                {
                    "id": int(row[0]),
                    "seq": int(row[1]),
                    "table": str(row[2]),
                    "from": str(row[3]),
                    "to": str(row[4]),
                    "onUpdate": str(row[5]),
                    "onDelete": str(row[6]),
                    "match": str(row[7]),
                }
                for row in sorted(
                    connection.execute(f"PRAGMA main.foreign_key_list({quoted_table})").fetchall(),
                    key=lambda row: (int(row[0]), int(row[1])),
                )
            ]
            table_indexes = []
            for row in connection.execute(f"PRAGMA main.index_list({quoted_table})"):
                name = str(row[1])
                quoted_index = cls._quoted(name)
                xinfo = [
                    {
                        "seqno": int(item[0]),
                        "cid": int(item[1]),
                        "name": None if item[2] is None else str(item[2]),
                        "desc": int(item[3]),
                        "coll": None if item[4] is None else str(item[4]),
                        "key": int(item[5]),
                    }
                    for item in sorted(
                        connection.execute(f"PRAGMA main.index_xinfo({quoted_index})").fetchall(),
                        key=lambda item: int(item[0]),
                    )
                ]
                table_indexes.append(
                    {
                        "seq": int(row[0]),
                        "name": name,
                        "unique": int(row[2]),
                        "origin": str(row[3]),
                        "partial": int(row[4]),
                        "xinfo": xinfo,
                    }
                )
            indexes[table] = sorted(
                table_indexes,
                key=lambda item: (str(item["name"]).encode("utf-8"), int(item["seq"])),
            )
        return {
            "applicationId": int(connection.execute("PRAGMA application_id").fetchone()[0]),
            "foreignKeys": foreign_keys,
            "indexes": indexes,
            "objects": objects,
            "tableXinfo": table_xinfo,
            "userVersion": int(connection.execute("PRAGMA user_version").fetchone()[0]),
        }

    @classmethod
    def _schema_digest(cls, connection: sqlite3.Connection) -> str:
        canonical = json.dumps(
            cls._schema_record(connection),
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
        return "sha256:" + hashlib.sha256(canonical).hexdigest()

    @staticmethod
    def _file_fingerprint(path: Path) -> tuple[int, int, int, str]:
        stat = path.stat()
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        return stat.st_size, stat.st_mtime_ns, stat.st_ino, digest

    def _source_snapshot(self) -> dict[str, tuple[int, int, int, str]]:
        candidates = [
            self.db_path,
            Path(f"{self.db_path}-wal"),
            Path(f"{self.db_path}-shm"),
            Path(f"{self.db_path}-journal"),
        ]
        return {
            path.name: self._file_fingerprint(path)
            for path in candidates
            if path.exists()
        }

    def _probe_schema_identity(self) -> str:
        first = self._source_snapshot()
        if self.db_path.name not in first:
            if first:
                raise DecreeJobStoreError("decree_job_schema_unrecognized")
            return self._FRESH_SCHEMA
        with tempfile.TemporaryDirectory(
            prefix="p10b1-schema-probe-", dir=tempfile.gettempdir()
        ) as root:
            probe_root = Path(root)
            for basename in first:
                shutil.copyfile(self.db_path.parent / basename, probe_root / basename)
            second = self._source_snapshot()
            copied = {
                basename: self._file_fingerprint(probe_root / basename)
                for basename in first
            }
            if first != second or any(
                copied[name][0] != first[name][0] or copied[name][3] != first[name][3]
                for name in first
            ):
                raise DecreeJobStoreError("decree_job_schema_unrecognized")
            with closing(sqlite3.connect(probe_root / self.db_path.name)) as connection:
                connection.row_factory = sqlite3.Row
                return self._schema_digest(connection)

    @staticmethod
    def _create_canonical_schema(connection: sqlite3.Connection) -> None:
        connection.execute(
            """
                CREATE TABLE main.decree_jobs (
                    job_id TEXT PRIMARY KEY,
                    owner_user_id TEXT NOT NULL,
                    idempotency_key TEXT NOT NULL,
                    request_hash TEXT NOT NULL,
                    draft_fingerprint TEXT NOT NULL,
                    decree_text TEXT NOT NULL,
                    approved_route_json TEXT NOT NULL,
                    state TEXT NOT NULL,
                    attempt_count INTEGER NOT NULL DEFAULT 0,
                    provider_request_count INTEGER NOT NULL DEFAULT 0,
                    provider_request_limit INTEGER NOT NULL DEFAULT 8,
                    cancel_requested INTEGER NOT NULL DEFAULT 0,
                    result_json TEXT,
                    reply_id TEXT,
                    error_code TEXT,
                    error_stage TEXT,
                    error_category TEXT,
                    authority_committed INTEGER NOT NULL DEFAULT 1,
                    acceptance_committed INTEGER NOT NULL DEFAULT 1,
                    deadline_at TEXT NOT NULL,
                    retry_at TEXT,
                    lease_owner TEXT,
                    lease_expires_at TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    claim_evidence_commitment_json TEXT,
                    UNIQUE(owner_user_id, idempotency_key),
                    UNIQUE(owner_user_id, draft_fingerprint)
                )
                """
        )
        connection.execute(
            """
                CREATE TABLE main.decree_job_idempotency_keys (
                    owner_user_id TEXT NOT NULL,
                    idempotency_key TEXT NOT NULL,
                    request_hash TEXT NOT NULL,
                    job_id TEXT NOT NULL REFERENCES decree_jobs(job_id),
                    PRIMARY KEY(owner_user_id, idempotency_key)
                )
                """
        )

    @staticmethod
    def _create_history_schema(connection: sqlite3.Connection) -> None:
        connection.execute(
            """
                CREATE TABLE main.decree_job_history_annotations (
                    job_id TEXT PRIMARY KEY REFERENCES decree_jobs(job_id),
                    archived INTEGER NOT NULL CHECK (archived IN (0, 1)),
                    updated_at TEXT NOT NULL
                )
                """
        )

    @staticmethod
    def _canonical_rows(rows: list[sqlite3.Row] | list[tuple[object, ...]]) -> bytes:
        def value(item: object) -> object:
            if isinstance(item, bytes):
                return {"blob": item.hex()}
            if item is None or isinstance(item, (str, int, float)):
                return item
            return {"type": type(item).__name__, "value": str(item)}

        return json.dumps(
            [[value(item) for item in row] for row in rows],
            ensure_ascii=False,
            separators=(",", ":"),
        ).encode("utf-8")

    @classmethod
    def _reserved_names_absent(cls, connection: sqlite3.Connection) -> bool:
        names = (cls._TEMP_PARENT, cls._TEMP_CHILD)
        for schema in ("main.sqlite_schema", "sqlite_temp_schema"):
            count = connection.execute(
                f"SELECT COUNT(*) FROM {schema} WHERE name IN (?, ?)", names
            ).fetchone()[0]
            if count:
                return False
        return True

    @classmethod
    def _assert_canonical_new(cls, connection: sqlite3.Connection) -> None:
        if cls._schema_digest(connection) != cls._EXACT_NEW_SCHEMA:
            raise DecreeJobStoreError("decree_job_schema_migration_failed")
        if connection.execute("PRAGMA main.foreign_key_check").fetchall():
            raise DecreeJobStoreError("decree_job_schema_migration_failed")
        if not cls._reserved_names_absent(connection):
            raise DecreeJobStoreError("decree_job_schema_migration_failed")

    @classmethod
    def _migrate_exact_old(cls, connection: sqlite3.Connection) -> None:
        if not cls._reserved_names_absent(connection):
            raise DecreeJobStoreError("decree_job_schema_unrecognized")
        old_columns = [
            str(row[1]) for row in connection.execute("PRAGMA main.table_xinfo(decree_jobs)")
        ]
        projection = ", ".join(cls._quoted(column) for column in old_columns)
        before_parent = cls._canonical_rows(
            connection.execute(
                f"SELECT {projection} FROM main.decree_jobs ORDER BY job_id COLLATE BINARY"
            ).fetchall()
        )
        before_child = cls._canonical_rows(
            connection.execute(
                "SELECT * FROM main.decree_job_idempotency_keys "
                "ORDER BY owner_user_id COLLATE BINARY, idempotency_key COLLATE BINARY"
            ).fetchall()
        )
        connection.execute(
            f"ALTER TABLE main.decree_job_idempotency_keys RENAME TO {cls._TEMP_CHILD}"
        )
        connection.execute(f"ALTER TABLE main.decree_jobs RENAME TO {cls._TEMP_PARENT}")
        foreign_key = connection.execute(
            f"PRAGMA main.foreign_key_list({cls._quoted(cls._TEMP_CHILD)})"
        ).fetchall()
        if len(foreign_key) != 1 or foreign_key[0][2] != cls._TEMP_PARENT:
            raise DecreeJobStoreError("decree_job_schema_migration_failed")
        cls._create_canonical_schema(connection)
        connection.execute(
            f"INSERT INTO main.decree_jobs ({projection}, claim_evidence_commitment_json) "
            f"SELECT {projection}, NULL FROM main.{cls._TEMP_PARENT}"
        )
        connection.execute(
            "INSERT INTO main.decree_job_idempotency_keys "
            "(owner_user_id, idempotency_key, request_hash, job_id) "
            "SELECT owner_user_id, idempotency_key, request_hash, job_id "
            f"FROM main.{cls._TEMP_CHILD}"
        )
        new_foreign_key = connection.execute(
            "PRAGMA main.foreign_key_list(decree_job_idempotency_keys)"
        ).fetchall()
        if len(new_foreign_key) != 1 or new_foreign_key[0][2] != "decree_jobs":
            raise DecreeJobStoreError("decree_job_schema_migration_failed")
        connection.execute(f"DROP TABLE main.{cls._TEMP_CHILD}")
        connection.execute(f"DROP TABLE main.{cls._TEMP_PARENT}")
        after_parent = cls._canonical_rows(
            connection.execute(
                f"SELECT {projection} FROM main.decree_jobs ORDER BY job_id COLLATE BINARY"
            ).fetchall()
        )
        after_child = cls._canonical_rows(
            connection.execute(
                "SELECT * FROM main.decree_job_idempotency_keys "
                "ORDER BY owner_user_id COLLATE BINARY, idempotency_key COLLATE BINARY"
            ).fetchall()
        )
        non_null = connection.execute(
            "SELECT COUNT(*) FROM main.decree_jobs "
            "WHERE claim_evidence_commitment_json IS NOT NULL"
        ).fetchone()[0]
        if (before_parent, before_child, non_null) != (after_parent, after_child, 0):
            raise DecreeJobStoreError("decree_job_schema_migration_failed")

    @classmethod
    def _migrate_parent_only(
        cls, connection: sqlite3.Connection, *, earliest: bool
    ) -> None:
        if not cls._reserved_names_absent(connection):
            raise DecreeJobStoreError("decree_job_schema_unrecognized")
        old_columns = [
            str(row[1]) for row in connection.execute("PRAGMA main.table_xinfo(decree_jobs)")
        ]
        old_projection = ", ".join(cls._quoted(column) for column in old_columns)
        preserved_columns = [
            column
            for column in old_columns
            if earliest or column not in {"error_stage", "error_category"}
        ]
        preserved_projection = ", ".join(
            cls._quoted(column) for column in preserved_columns
        )
        before = connection.execute(
            f"SELECT {old_projection} FROM main.decree_jobs ORDER BY job_id COLLATE BINARY"
        ).fetchall()
        before_bytes = cls._canonical_rows(
            connection.execute(
                f"SELECT {preserved_projection} FROM main.decree_jobs "
                "ORDER BY job_id COLLATE BINARY"
            ).fetchall()
        )
        expected_mapping = sorted(
            (
                str(row["owner_user_id"]),
                str(row["idempotency_key"]),
                str(row["request_hash"]),
                str(row["job_id"]),
            )
            for row in before
        )

        def expected_stage(row: sqlite3.Row) -> str | None:
            if not earliest and row["error_stage"] is not None:
                return str(row["error_stage"])
            if row["state"] == "CANCELLED" and int(row["attempt_count"]) == 0:
                return "queue"
            if row["state"] in {"FAILED", "CANCELLED"}:
                return "execution"
            return None

        def expected_category(row: sqlite3.Row) -> str | None:
            if not earliest and row["error_category"] is not None:
                return str(row["error_category"])
            if row["state"] not in {"FAILED", "CANCELLED"}:
                return None
            if row["state"] == "CANCELLED":
                return "cancelled"
            categories = {
                "provider_budget_exceeded": "budget",
                "deadline_exceeded": "deadline",
                "retry_exhausted": "retry",
            }
            if row["error_code"] in categories:
                return categories[str(row["error_code"])]
            if str(row["error_code"] or "").startswith("provider_"):
                return "provider"
            if row["state"] == "FAILED":
                return "internal"
            return None

        expected_markers = [
            (
                str(row["job_id"]),
                1 if earliest else int(bool(row["acceptance_committed"])),
                1 if earliest else int(row["acceptance_committed"]),
                expected_stage(row),
                expected_category(row),
                None,
            )
            for row in before
        ]
        connection.execute(f"ALTER TABLE main.decree_jobs RENAME TO {cls._TEMP_PARENT}")
        cls._create_canonical_schema(connection)
        error_stage = (
            "CASE WHEN state = 'CANCELLED' AND attempt_count = 0 THEN 'queue' "
            "WHEN state IN ('FAILED', 'CANCELLED') THEN 'execution' ELSE NULL END"
            if earliest
            else "CASE WHEN error_stage IS NOT NULL THEN error_stage "
            "WHEN state = 'CANCELLED' AND attempt_count = 0 THEN 'queue' "
            "WHEN state IN ('FAILED', 'CANCELLED') THEN 'execution' ELSE NULL END"
        )
        error_category = (
            "CASE WHEN state NOT IN ('FAILED', 'CANCELLED') THEN NULL "
            "WHEN state = 'CANCELLED' THEN 'cancelled' "
            "WHEN error_code = 'provider_budget_exceeded' THEN 'budget' "
            "WHEN error_code = 'deadline_exceeded' THEN 'deadline' "
            "WHEN error_code = 'retry_exhausted' THEN 'retry' "
            "WHEN error_code LIKE 'provider_%' THEN 'provider' "
            "WHEN state = 'FAILED' THEN 'internal' ELSE NULL END"
            if earliest
            else "CASE WHEN error_category IS NOT NULL THEN error_category "
            "WHEN state NOT IN ('FAILED', 'CANCELLED') THEN NULL "
            "WHEN state = 'CANCELLED' THEN 'cancelled' "
            "WHEN error_code = 'provider_budget_exceeded' THEN 'budget' "
            "WHEN error_code = 'deadline_exceeded' THEN 'deadline' "
            "WHEN error_code = 'retry_exhausted' THEN 'retry' "
            "WHEN error_code LIKE 'provider_%' THEN 'provider' "
            "WHEN state = 'FAILED' THEN 'internal' ELSE NULL END"
        )
        provider_limit = "8" if earliest else "provider_request_limit"
        authority = "1" if earliest else "CASE WHEN acceptance_committed = 1 THEN 1 ELSE 0 END"
        acceptance = "1" if earliest else "acceptance_committed"
        connection.execute(
            f"""
                INSERT INTO main.decree_jobs (
                    job_id, owner_user_id, idempotency_key, request_hash,
                    draft_fingerprint, decree_text, approved_route_json,
                    state, attempt_count, provider_request_count,
                    provider_request_limit, cancel_requested, result_json,
                    reply_id, error_code, error_stage, error_category,
                    authority_committed, acceptance_committed, deadline_at,
                    retry_at, lease_owner, lease_expires_at, created_at,
                    updated_at, claim_evidence_commitment_json
                )
                SELECT
                    job_id, owner_user_id, idempotency_key, request_hash,
                    draft_fingerprint, decree_text, approved_route_json,
                    state, attempt_count, provider_request_count,
                    {provider_limit}, cancel_requested, result_json,
                    reply_id, error_code, {error_stage}, {error_category},
                    {authority}, {acceptance}, deadline_at, retry_at,
                    lease_owner, lease_expires_at, created_at, updated_at, NULL
                FROM main.{cls._TEMP_PARENT}
                """
        )
        connection.execute(
            "INSERT INTO main.decree_job_idempotency_keys "
            "(owner_user_id, idempotency_key, request_hash, job_id) "
            "SELECT owner_user_id, idempotency_key, request_hash, job_id FROM main.decree_jobs"
        )
        connection.execute(f"DROP TABLE main.{cls._TEMP_PARENT}")
        after_bytes = cls._canonical_rows(
            connection.execute(
                f"SELECT {preserved_projection} FROM main.decree_jobs "
                "ORDER BY job_id COLLATE BINARY"
            ).fetchall()
        )
        actual_mapping = connection.execute(
            "SELECT owner_user_id, idempotency_key, request_hash, job_id "
            "FROM main.decree_job_idempotency_keys "
            "ORDER BY owner_user_id COLLATE BINARY, idempotency_key COLLATE BINARY"
        ).fetchall()
        actual_markers = connection.execute(
            "SELECT job_id, authority_committed, acceptance_committed, "
            "error_stage, error_category, claim_evidence_commitment_json "
            "FROM main.decree_jobs ORDER BY job_id COLLATE BINARY"
        ).fetchall()
        if (
            after_bytes != before_bytes
            or cls._canonical_rows(actual_mapping)
            != cls._canonical_rows([tuple(row) for row in expected_mapping])
            or cls._canonical_rows(actual_markers)
            != cls._canonical_rows([tuple(row) for row in expected_markers])
        ):
            raise DecreeJobStoreError("decree_job_schema_migration_failed")

    def _initialize(self) -> None:
        probe = self._probe_schema_identity()
        history_schemas = {self._HISTORY_SCHEMA, self._HISTORY_WITH_TASK_BUDGET_SCHEMA}
        allowed = {
            self._FRESH_SCHEMA,
            self._HISTORY_SCHEMA,
            self._HISTORY_WITH_TASK_BUDGET_SCHEMA,
            self._EXACT_NEW_SCHEMA,
            self._EXACT_OLD_SCHEMA,
            self._EARLIEST_SCHEMA,
            self._PRE_AUTHORITY_SCHEMA,
        }
        if probe not in allowed:
            raise DecreeJobStoreError("decree_job_schema_unrecognized")
        if probe in history_schemas:
            return
        with closing(self._connect_for_initialization()) as connection:
            connection.execute("PRAGMA foreign_keys = ON")
            connection.execute("PRAGMA legacy_alter_table = OFF")
            if connection.execute("PRAGMA foreign_keys").fetchone()[0] != 1:
                raise DecreeJobStoreError("decree_job_schema_migration_failed")
            if connection.execute("PRAGMA legacy_alter_table").fetchone()[0] != 0:
                raise DecreeJobStoreError("decree_job_schema_migration_failed")
            connection.execute("BEGIN IMMEDIATE")
            try:
                locked = self._schema_digest(connection)
                if locked not in allowed:
                    raise DecreeJobStoreError("decree_job_schema_unrecognized")
                if locked in history_schemas:
                    connection.commit()
                    return
                if locked == self._FRESH_SCHEMA:
                    self._create_canonical_schema(connection)
                elif locked == self._EXACT_OLD_SCHEMA:
                    self._migrate_exact_old(connection)
                elif locked == self._EARLIEST_SCHEMA:
                    self._migrate_parent_only(connection, earliest=True)
                elif locked == self._PRE_AUTHORITY_SCHEMA:
                    self._migrate_parent_only(connection, earliest=False)
                if locked != self._HISTORY_SCHEMA:
                    self._assert_canonical_new(connection)
                    self._create_history_schema(connection)
                if self._schema_digest(connection) != self._HISTORY_SCHEMA:
                    raise DecreeJobStoreError("decree_job_schema_migration_failed")
                if connection.execute("PRAGMA main.foreign_key_check").fetchall():
                    raise DecreeJobStoreError("decree_job_schema_migration_failed")
                connection.commit()
            except Exception:
                connection.rollback()
                raise

    @staticmethod
    def _job(row: sqlite3.Row) -> DecreeJob:
        return DecreeJob(
            job_id=str(row["job_id"]),
            owner_user_id=str(row["owner_user_id"]),
            idempotency_key=str(row["idempotency_key"]),
            request_hash=str(row["request_hash"]),
            draft_fingerprint=str(row["draft_fingerprint"]),
            decree_text=str(row["decree_text"]),
            approved_route_json=str(row["approved_route_json"]),
            state=DecreeJobState(row["state"]),
            attempt_count=int(row["attempt_count"]),
            provider_request_count=int(row["provider_request_count"]),
            cancel_requested=bool(row["cancel_requested"]),
            result_json=row["result_json"],
            reply_id=row["reply_id"],
            error_code=row["error_code"],
            deadline_at=_datetime(row["deadline_at"]),  # type: ignore[arg-type]
            retry_at=_datetime(row["retry_at"]),
            lease_owner=row["lease_owner"],
            lease_expires_at=_datetime(row["lease_expires_at"]),
            created_at=_datetime(row["created_at"]),  # type: ignore[arg-type]
            updated_at=_datetime(row["updated_at"]),  # type: ignore[arg-type]
            provider_request_limit=int(row["provider_request_limit"]),
            error_stage=row["error_stage"],
            error_category=row["error_category"],
            claim_evidence_commitment_json=row["claim_evidence_commitment_json"],
        )

    @staticmethod
    def _validate(command: AcceptDecreeJob) -> None:
        values = (
            command.owner_user_id,
            command.idempotency_key,
            command.request_hash,
            command.draft_fingerprint,
            command.decree_text,
            command.approved_route_json,
        )
        if any(not value.strip() for value in values):
            raise ValueError("decree job acceptance fields must be non-empty")
        if len(command.idempotency_key) > 128:
            raise ValueError("idempotency_key is too long")
        if len(command.draft_fingerprint) != 64:
            raise ValueError("draft_fingerprint must be a SHA-256 value")
        if command.provider_request_limit < 1 or command.provider_request_limit > 256:
            raise ValueError("provider_request_limit must be between 1 and 256")
        _iso(command.deadline_at)

    def _accept_in_connection(
        self,
        connection: sqlite3.Connection,
        command: AcceptDecreeJob,
        *,
        now: datetime | None = None,
    ) -> AcceptedDecreeJob:
        self._validate(command)
        accepted_at = now or datetime.now(UTC)
        timestamp = _iso(accepted_at)
        existing_key = connection.execute(
            """
                SELECT jobs.* FROM decree_job_idempotency_keys AS keys
                JOIN decree_jobs AS jobs ON jobs.job_id = keys.job_id
                WHERE keys.owner_user_id = ? AND keys.idempotency_key = ?
                """,
            (command.owner_user_id, command.idempotency_key),
        ).fetchone()
        if existing_key is not None:
            if existing_key["request_hash"] != command.request_hash:
                raise IdempotencyConflict("idempotency_key_reused")
            _require_legacy_commitment(existing_key)
            if not bool(existing_key["acceptance_committed"]):
                if bool(existing_key["authority_committed"]):
                    cursor = connection.execute(
                        "UPDATE decree_jobs SET acceptance_committed = 1, "
                        "updated_at = ? WHERE job_id = ? "
                        "AND claim_evidence_commitment_json IS NULL",
                        (timestamp, existing_key["job_id"]),
                    )
                    if cursor.rowcount != 1:
                        raise ClaimEvidenceCommitmentUnavailable(
                            "claim_evidence_commitment_unavailable"
                        )
                    recovered = connection.execute(
                        "SELECT * FROM decree_jobs WHERE job_id = ?",
                        (existing_key["job_id"],),
                    ).fetchone()
                    assert recovered is not None
                    _require_legacy_commitment(recovered)
                    return AcceptedDecreeJob(self._job(recovered), replayed=True)
                mapping = connection.execute(
                    "DELETE FROM decree_job_idempotency_keys WHERE job_id = ? "
                    "AND EXISTS (SELECT 1 FROM decree_jobs WHERE job_id = ? "
                    "AND claim_evidence_commitment_json IS NULL)",
                    (existing_key["job_id"], existing_key["job_id"]),
                )
                deleted = connection.execute(
                    "DELETE FROM decree_jobs WHERE job_id = ? "
                    "AND claim_evidence_commitment_json IS NULL",
                    (existing_key["job_id"],),
                )
                if mapping.rowcount != 1 or deleted.rowcount != 1:
                    raise ClaimEvidenceCommitmentUnavailable(
                        "claim_evidence_commitment_unavailable"
                    )
            else:
                return AcceptedDecreeJob(self._job(existing_key), replayed=True)
        existing_draft = connection.execute(
            """
                SELECT * FROM decree_jobs
                WHERE owner_user_id = ? AND draft_fingerprint = ?
                """,
            (command.owner_user_id, command.draft_fingerprint),
        ).fetchone()
        if existing_draft is not None:
            if existing_draft["request_hash"] != command.request_hash:
                raise IdempotencyConflict("draft_fingerprint_reused")
            _require_legacy_commitment(existing_draft)
            if not bool(existing_draft["acceptance_committed"]):
                if bool(existing_draft["authority_committed"]):
                    cursor = connection.execute(
                        "UPDATE decree_jobs SET acceptance_committed = 1, "
                        "updated_at = ? WHERE job_id = ? "
                        "AND claim_evidence_commitment_json IS NULL",
                        (timestamp, existing_draft["job_id"]),
                    )
                    if cursor.rowcount != 1:
                        raise ClaimEvidenceCommitmentUnavailable(
                            "claim_evidence_commitment_unavailable"
                        )
                    existing_draft = connection.execute(
                        "SELECT * FROM decree_jobs WHERE job_id = ?",
                        (existing_draft["job_id"],),
                    ).fetchone()
                    assert existing_draft is not None
                    _require_legacy_commitment(existing_draft)
                else:
                    mapping = connection.execute(
                        "DELETE FROM decree_job_idempotency_keys WHERE job_id = ? "
                        "AND EXISTS (SELECT 1 FROM decree_jobs WHERE job_id = ? "
                        "AND claim_evidence_commitment_json IS NULL)",
                        (existing_draft["job_id"], existing_draft["job_id"]),
                    )
                    deleted = connection.execute(
                        "DELETE FROM decree_jobs WHERE job_id = ? "
                        "AND claim_evidence_commitment_json IS NULL",
                        (existing_draft["job_id"],),
                    )
                    if mapping.rowcount != 1 or deleted.rowcount != 1:
                        raise ClaimEvidenceCommitmentUnavailable(
                            "claim_evidence_commitment_unavailable"
                        )
                    existing_draft = None
        if existing_draft is not None:
            cursor = connection.execute(
                """
                    INSERT INTO decree_job_idempotency_keys (
                        owner_user_id, idempotency_key, request_hash, job_id
                    ) SELECT ?, ?, ?, job_id FROM decree_jobs
                    WHERE job_id = ? AND claim_evidence_commitment_json IS NULL
                    """,
                (
                    command.owner_user_id,
                    command.idempotency_key,
                    command.request_hash,
                    existing_draft["job_id"],
                ),
            )
            if cursor.rowcount != 1:
                raise ClaimEvidenceCommitmentUnavailable("claim_evidence_commitment_unavailable")
            return AcceptedDecreeJob(self._job(existing_draft), replayed=True)
        job_id = secrets.token_hex(16)
        connection.execute(
            """
                INSERT INTO decree_jobs (
                    job_id, owner_user_id, idempotency_key, request_hash,
                    draft_fingerprint, decree_text, approved_route_json, state,
                    provider_request_limit, authority_committed,
                    acceptance_committed,
                    claim_evidence_commitment_json,
                    deadline_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'QUEUED', ?, ?, ?, NULL, ?, ?, ?)
                """,
            (
                job_id,
                command.owner_user_id,
                command.idempotency_key,
                command.request_hash,
                command.draft_fingerprint,
                command.decree_text,
                command.approved_route_json,
                command.provider_request_limit,
                int(command.acceptance_committed),
                int(command.acceptance_committed),
                _iso(command.deadline_at),
                timestamp,
                timestamp,
            ),
        )
        connection.execute(
            """
                INSERT INTO decree_job_idempotency_keys (
                    owner_user_id, idempotency_key, request_hash, job_id
                ) VALUES (?, ?, ?, ?)
                """,
            (
                command.owner_user_id,
                command.idempotency_key,
                command.request_hash,
                job_id,
            ),
        )
        row = connection.execute("SELECT * FROM decree_jobs WHERE job_id = ?", (job_id,)).fetchone()
        assert row is not None
        return AcceptedDecreeJob(self._job(row), replayed=False)

    def accept(self, command: AcceptDecreeJob, *, now: datetime | None = None) -> AcceptedDecreeJob:
        with closing(self._connect()) as connection:
            connection.execute("BEGIN IMMEDIATE")
            try:
                accepted = self._accept_in_connection(connection, command, now=now)
                connection.commit()
                return accepted
            except Exception:
                connection.rollback()
                raise

    def _preflight_acceptance_in_connection(
        self,
        connection: sqlite3.Connection,
        *,
        owner_user_id: str,
        idempotency_key: str,
        request_hash: str,
        draft_fingerprint: str,
    ) -> None:
        by_key = connection.execute(
            """
            SELECT jobs.* FROM decree_job_idempotency_keys AS keys
            JOIN decree_jobs AS jobs ON jobs.job_id = keys.job_id
            WHERE keys.owner_user_id = ? AND keys.idempotency_key = ?
            """,
            (owner_user_id, idempotency_key),
        ).fetchone()
        if by_key is not None:
            if by_key["request_hash"] != request_hash:
                raise IdempotencyConflict("idempotency_key_reused")
            _require_legacy_commitment(by_key)
            return
        by_draft = connection.execute(
            """
            SELECT * FROM decree_jobs
            WHERE owner_user_id = ? AND draft_fingerprint = ?
            """,
            (owner_user_id, draft_fingerprint),
        ).fetchone()
        if by_draft is None:
            return
        if by_draft["request_hash"] != request_hash:
            raise IdempotencyConflict("draft_fingerprint_reused")
        _require_legacy_commitment(by_draft)

    def lookup_replay(
        self,
        *,
        owner_user_id: str,
        idempotency_key: str,
        request_hash: str,
    ) -> AcceptedDecreeJob | None:
        """Return a committed idempotent acceptance without consuming authority."""
        with closing(self._connect()) as connection:
            row = connection.execute(
                """
                SELECT jobs.* FROM decree_job_idempotency_keys AS keys
                JOIN decree_jobs AS jobs ON jobs.job_id = keys.job_id
                WHERE keys.owner_user_id = ? AND keys.idempotency_key = ?
                """,
                (owner_user_id, idempotency_key),
            ).fetchone()
        if row is None:
            return None
        if row["request_hash"] != request_hash:
            raise IdempotencyConflict("idempotency_key_reused")
        _require_legacy_commitment(row)
        if not bool(row["acceptance_committed"]):
            return None
        return AcceptedDecreeJob(self._job(row), replayed=True)

    def preflight_acceptance(
        self,
        *,
        owner_user_id: str,
        idempotency_key: str,
        request_hash: str,
        draft_fingerprint: str,
    ) -> None:
        """Detect future sidecars and conflicts before one-time authority reserve."""

        with closing(self._connect()) as connection:
            self._preflight_acceptance_in_connection(
                connection,
                owner_user_id=owner_user_id,
                idempotency_key=idempotency_key,
                request_hash=request_hash,
                draft_fingerprint=draft_fingerprint,
            )

    def recover_acceptance(
        self,
        *,
        owner_user_id: str,
        idempotency_key: str,
        request_hash: str,
        now: datetime | None = None,
    ) -> AcceptedDecreeJob | None:
        """Commit or replay the durable handoff left after authority commit."""
        timestamp = _iso(now or datetime.now(UTC))
        with closing(self._connect()) as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                """
                SELECT jobs.* FROM decree_job_idempotency_keys AS keys
                JOIN decree_jobs AS jobs ON jobs.job_id = keys.job_id
                WHERE keys.owner_user_id = ? AND keys.idempotency_key = ?
                """,
                (owner_user_id, idempotency_key),
            ).fetchone()
            if row is None:
                connection.rollback()
                return None
            if row["request_hash"] != request_hash:
                connection.rollback()
                raise IdempotencyConflict("idempotency_key_reused")
            _require_legacy_commitment(row)
            if bool(row["acceptance_committed"]):
                connection.commit()
                return AcceptedDecreeJob(self._job(row), replayed=True)
            if not bool(row["authority_committed"]):
                connection.rollback()
                return None
            cursor = connection.execute(
                """
                UPDATE decree_jobs
                SET acceptance_committed = 1, updated_at = ?
                WHERE job_id = ? AND owner_user_id = ?
                  AND acceptance_committed = 0 AND state = 'QUEUED'
                  AND claim_evidence_commitment_json IS NULL
                """,
                (timestamp, row["job_id"], owner_user_id),
            )
            if cursor.rowcount != 1:
                connection.rollback()
                raise DecreeJobStoreError("acceptance_recovery_failed")
            recovered = connection.execute(
                "SELECT * FROM decree_jobs WHERE job_id = ?", (row["job_id"],)
            ).fetchone()
            assert recovered is not None
            _require_legacy_commitment(recovered)
            connection.commit()
        return AcceptedDecreeJob(self._job(recovered), replayed=True)

    def count(self) -> int:
        with closing(self._connect()) as connection:
            row = connection.execute("SELECT COUNT(*) AS count FROM decree_jobs").fetchone()
        assert row is not None
        return int(row["count"])

    def _mark_authority_committed_in_connection(
        self,
        connection: sqlite3.Connection,
        job_id: str,
        owner_user_id: str,
        *,
        now: datetime | None = None,
    ) -> DecreeJob:
        timestamp = _iso(now or datetime.now(UTC))
        cursor = connection.execute(
            """
            UPDATE decree_jobs
            SET authority_committed = 1, updated_at = ?
            WHERE job_id = ? AND owner_user_id = ?
              AND authority_committed = 0
              AND acceptance_committed = 0 AND state = 'QUEUED'
              AND claim_evidence_commitment_json IS NULL
            """,
            (timestamp, job_id, owner_user_id),
        )
        if cursor.rowcount != 1:
            existing = connection.execute(
                """
                SELECT * FROM decree_jobs
                WHERE job_id = ? AND owner_user_id = ?
                """,
                (job_id, owner_user_id),
            ).fetchone()
            if existing is not None:
                _require_legacy_commitment(existing)
            if (
                existing is None
                or not bool(existing["authority_committed"])
                or bool(existing["acceptance_committed"])
                or existing["state"] != DecreeJobState.QUEUED.value
            ):
                raise DecreeJobStoreError("authority_commit_marker_failed")
            return self._job(existing)
        row = connection.execute("SELECT * FROM decree_jobs WHERE job_id = ?", (job_id,)).fetchone()
        assert row is not None
        _require_legacy_commitment(row)
        return self._job(row)

    def mark_authority_committed(
        self, job_id: str, owner_user_id: str, *, now: datetime | None = None
    ) -> DecreeJob:
        """Persist the one-time draft authority commit before activation."""

        with closing(self._connect()) as connection:
            connection.execute("BEGIN IMMEDIATE")
            try:
                job = self._mark_authority_committed_in_connection(
                    connection, job_id, owner_user_id, now=now
                )
                connection.commit()
                return job
            except Exception:
                connection.rollback()
                raise

    def _activate_acceptance_in_connection(
        self,
        connection: sqlite3.Connection,
        job_id: str,
        owner_user_id: str,
        *,
        now: datetime | None = None,
    ) -> DecreeJob:
        timestamp = _iso(now or datetime.now(UTC))
        cursor = connection.execute(
            """
            UPDATE decree_jobs
            SET acceptance_committed = 1, updated_at = ?
            WHERE job_id = ? AND owner_user_id = ?
              AND authority_committed = 1
              AND acceptance_committed = 0 AND state = 'QUEUED'
              AND claim_evidence_commitment_json IS NULL
            """,
            (timestamp, job_id, owner_user_id),
        )
        if cursor.rowcount != 1:
            existing = connection.execute(
                """
                SELECT * FROM decree_jobs
                WHERE job_id = ? AND owner_user_id = ?
                """,
                (job_id, owner_user_id),
            ).fetchone()
            if existing is not None:
                _require_legacy_commitment(existing)
            if (
                existing is None
                or not bool(existing["authority_committed"])
                or not bool(existing["acceptance_committed"])
                or existing["state"] != DecreeJobState.QUEUED.value
            ):
                raise DecreeJobStoreError("acceptance_activation_failed")
            return self._job(existing)
        row = connection.execute("SELECT * FROM decree_jobs WHERE job_id = ?", (job_id,)).fetchone()
        assert row is not None
        _require_legacy_commitment(row)
        return self._job(row)

    def activate_acceptance(
        self, job_id: str, owner_user_id: str, *, now: datetime | None = None
    ) -> DecreeJob:
        with closing(self._connect()) as connection:
            connection.execute("BEGIN IMMEDIATE")
            try:
                job = self._activate_acceptance_in_connection(
                    connection, job_id, owner_user_id, now=now
                )
                connection.commit()
                return job
            except Exception:
                connection.rollback()
                raise

    def _abandon_acceptance_in_connection(
        self,
        connection: sqlite3.Connection,
        job_id: str,
        owner_user_id: str,
    ) -> None:
        row = connection.execute(
            """
                SELECT * FROM decree_jobs
                WHERE job_id = ? AND owner_user_id = ?
                """,
            (job_id, owner_user_id),
        ).fetchone()
        if row is None:
            raise DecreeJobStoreError("acceptance_abandon_failed")
        _require_legacy_commitment(row)
        if (
            bool(row["authority_committed"])
            or bool(row["acceptance_committed"])
            or row["state"] != DecreeJobState.QUEUED.value
        ):
            raise DecreeJobStoreError("acceptance_abandon_failed")
        mapping = connection.execute(
            "DELETE FROM decree_job_idempotency_keys WHERE job_id = ? "
            "AND EXISTS (SELECT 1 FROM decree_jobs WHERE job_id = ? "
            "AND claim_evidence_commitment_json IS NULL)",
            (job_id, job_id),
        )
        deleted = connection.execute(
            "DELETE FROM decree_jobs WHERE job_id = ? AND claim_evidence_commitment_json IS NULL",
            (job_id,),
        )
        if mapping.rowcount != 1 or deleted.rowcount != 1:
            raise ClaimEvidenceCommitmentUnavailable("claim_evidence_commitment_unavailable")

    def abandon_acceptance(self, job_id: str, owner_user_id: str) -> None:
        """Remove an uncommitted acceptance that never acquired authority."""
        with closing(self._connect()) as connection:
            connection.execute("BEGIN IMMEDIATE")
            try:
                self._abandon_acceptance_in_connection(connection, job_id, owner_user_id)
                connection.commit()
            except Exception:
                connection.rollback()
                raise

    def list_for_owner(
        self, owner_user_id: str, *, limit: int = 50, offset: int = 0,
        q: str = "", archived: str = "active",
    ) -> tuple[list[tuple[DecreeJob, bool]], int]:
        if (type(limit) is not int or not 1 <= limit <= 100
                or type(offset) is not int or not 0 <= offset <= 1_000_000
                or not isinstance(q, str) or len(q) > 500
                or archived not in {"active", "archived", "all"}):
            raise ValueError("invalid job history query")
        clauses = ["jobs.owner_user_id = ?"]
        parameters: list[object] = [owner_user_id]
        if archived != "all":
            clauses.append("COALESCE(history.archived, 0) = ?")
            parameters.append(int(archived == "archived"))
        if q.strip():
            # instr performs literal substring search: %, _ and backslash are not patterns.
            clauses.append("instr(jobs.decree_text, ?) > 0")
            parameters.append(q.strip())
        source = (
            " FROM decree_jobs AS jobs LEFT JOIN decree_job_history_annotations AS history "
            "ON history.job_id = jobs.job_id WHERE " + " AND ".join(clauses)
        )
        with closing(self._connect()) as connection:
            connection.execute("BEGIN")
            total = int(connection.execute("SELECT COUNT(*)" + source, parameters).fetchone()[0])
            rows = connection.execute(
                "SELECT jobs.*, COALESCE(history.archived, 0) AS history_archived" + source
                + " ORDER BY jobs.created_at DESC, jobs.job_id DESC LIMIT ? OFFSET ?",
                [*parameters, limit, offset],
            ).fetchall()
            for row in rows:
                _require_legacy_commitment(row)
            return [(self._job(row), bool(row["history_archived"])) for row in rows], total

    @staticmethod
    def _history_annotation(connection: sqlite3.Connection, job_id: str) -> dict[str, object]:
        row = connection.execute(
            "SELECT archived, updated_at FROM decree_job_history_annotations WHERE job_id = ?",
            (job_id,),
        ).fetchone()
        return {"job_id": job_id, "history_archived": bool(row["archived"]) if row else False,
                "updated_at": row["updated_at"] if row else None}

    def get_history_annotation(self, job_id: str, owner_user_id: str) -> dict[str, object]:
        with closing(self._connect()) as connection:
            connection.execute("BEGIN")
            row = connection.execute(
                "SELECT * FROM decree_jobs WHERE job_id = ? AND owner_user_id = ?",
                (job_id, owner_user_id),
            ).fetchone()
            if row is None:
                raise JobNotFound
            _require_legacy_commitment(row)
            return self._history_annotation(connection, job_id)

    def set_history_annotation(
        self, job_id: str, owner_user_id: str, archived: bool, *, now: datetime | None = None,
    ) -> dict[str, object]:
        if type(archived) is not bool:
            raise ValueError("archived must be a boolean")
        with closing(self._connect()) as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                "SELECT * FROM decree_jobs WHERE job_id = ? AND owner_user_id = ?",
                (job_id, owner_user_id),
            ).fetchone()
            if row is None:
                raise JobNotFound
            _require_legacy_commitment(row)
            if row["state"] not in {"SUCCEEDED", "FAILED", "CANCELLED"}:
                raise JobHistoryArchiveRejected("job_history_archive_rejected")
            current = self._history_annotation(connection, job_id)
            if current["history_archived"] == archived:
                return current
            connection.execute(
                "INSERT INTO decree_job_history_annotations (job_id, archived, updated_at) "
                "VALUES (?, ?, ?) ON CONFLICT(job_id) DO UPDATE SET "
                "archived = excluded.archived, updated_at = excluded.updated_at",
                (job_id, int(archived), _iso(now or datetime.now(UTC))),
            )
            result = self._history_annotation(connection, job_id)
            connection.commit()
            return result

    def get_for_owner(self, job_id: str, owner_user_id: str) -> DecreeJob:
        with closing(self._connect()) as connection:
            row = connection.execute(
                "SELECT * FROM decree_jobs WHERE job_id = ? AND owner_user_id = ?",
                (job_id, owner_user_id),
            ).fetchone()
        if row is None:
            raise JobNotFound
        _require_legacy_commitment(row)
        return self._job(row)

    def resolve_budget_root(self, job_id: str, owner_user_id: str) -> str:
        """Return the immutable token-budget root for an owned active job.

        The current decree schema has no retry-child lineage.  Until that
        lineage is introduced with its own migration and tests, the accepted
        job itself is the only valid root.  This fail-closed seam prevents a
        caller from minting a budget for an unknown, uncommitted or foreign
        job while keeping the existing task ledger API usable.
        """

        with closing(self._connect()) as connection:
            row = connection.execute(
                "SELECT job_id, authority_committed, acceptance_committed, "
                "claim_evidence_commitment_json FROM decree_jobs "
                "WHERE job_id = ? AND owner_user_id = ?",
                (job_id, owner_user_id),
            ).fetchone()
        if row is None:
            raise JobNotFound
        if row["claim_evidence_commitment_json"] is not None:
            raise ClaimEvidenceCommitmentUnavailable(
                "claim_evidence_commitment_unavailable"
            )
        if not bool(row["authority_committed"]) or not bool(row["acceptance_committed"]):
            raise DecreeJobStoreError("budget_root_not_committed")
        return str(row["job_id"])

    def _owned_by_worker(
        self,
        connection: sqlite3.Connection,
        job_id: str,
        worker_id: str,
        *,
        now: datetime,
    ) -> sqlite3.Row:
        row = connection.execute("SELECT * FROM decree_jobs WHERE job_id = ?", (job_id,)).fetchone()
        if row is None:
            raise JobNotFound
        _require_legacy_commitment(row)
        lease_expires_at = _datetime(row["lease_expires_at"])
        if row["lease_owner"] != worker_id or lease_expires_at is None or lease_expires_at <= now:
            raise LeaseConflict("job lease is not owned by worker")
        return row

    def claim_next(
        self,
        worker_id: str,
        *,
        now: datetime | None = None,
        lease_seconds: int = 90,
    ) -> DecreeJob | None:
        if not worker_id.strip() or lease_seconds < 1:
            raise ValueError("worker_id and a positive lease are required")
        claimed_at = now or datetime.now(UTC)
        timestamp = _iso(claimed_at)
        lease_until = _iso(claimed_at + timedelta(seconds=lease_seconds))
        with closing(self._connect()) as connection:
            connection.execute("BEGIN IMMEDIATE")
            retry_sweep = connection.execute(
                """
                UPDATE decree_jobs
                SET state = 'FAILED', error_code = 'retry_exhausted',
                    error_stage = 'execution', error_category = 'retry',
                    lease_owner = NULL, lease_expires_at = NULL, updated_at = ?
                WHERE state = 'RUNNING' AND lease_expires_at <= ?
                  AND attempt_count >= ?
                  AND claim_evidence_commitment_json IS NULL
                """,
                (timestamp, timestamp, MAX_ATTEMPTS),
            )
            deadline_sweep = connection.execute(
                """
                UPDATE decree_jobs
                SET state = 'FAILED', error_code = 'deadline_exceeded',
                    error_stage = 'execution', error_category = 'deadline',
                    lease_owner = NULL, lease_expires_at = NULL, updated_at = ?
                WHERE state IN ('QUEUED', 'RETRY_WAIT', 'RUNNING', 'RESULT_READY')
                  AND deadline_at <= ?
                  AND claim_evidence_commitment_json IS NULL
                """,
                (timestamp, timestamp),
            )
            if retry_sweep.rowcount < 0 or deadline_sweep.rowcount < 0:
                connection.rollback()
                raise DecreeJobStoreError("decree_job_sweep_count_unavailable")
            row = connection.execute(
                """
                SELECT * FROM decree_jobs
                WHERE claim_evidence_commitment_json IS NULL AND ((
                    acceptance_committed = 1
                    AND cancel_requested = 0 AND attempt_count < ?
                    AND deadline_at > ?
                    AND (
                        state = 'QUEUED'
                        OR (state = 'RETRY_WAIT' AND retry_at <= ?)
                        OR (state = 'RUNNING' AND lease_expires_at <= ?)
                    )
                  ) OR (
                    state IN ('RESULT_READY', 'ARCHIVING', 'PUBLISHING')
                    AND lease_expires_at <= ?
                  ))
                ORDER BY created_at, job_id
                LIMIT 1
                """,
                (MAX_ATTEMPTS, timestamp, timestamp, timestamp, timestamp),
            ).fetchone()
            if row is None:
                connection.commit()
                return None
            if row["state"] in {
                DecreeJobState.RESULT_READY.value,
                DecreeJobState.ARCHIVING.value,
                DecreeJobState.PUBLISHING.value,
            }:
                cursor = connection.execute(
                    """
                    UPDATE decree_jobs
                    SET lease_owner = ?, lease_expires_at = ?, updated_at = ?
                    WHERE job_id = ? AND claim_evidence_commitment_json IS NULL
                    """,
                    (worker_id, lease_until, timestamp, row["job_id"]),
                )
            else:
                cursor = connection.execute(
                    """
                    UPDATE decree_jobs
                    SET state = 'RUNNING', attempt_count = attempt_count + 1,
                        lease_owner = ?, lease_expires_at = ?, retry_at = NULL,
                        error_code = NULL, error_stage = NULL,
                        error_category = NULL, updated_at = ?
                    WHERE job_id = ? AND claim_evidence_commitment_json IS NULL
                    """,
                    (worker_id, lease_until, timestamp, row["job_id"]),
                )
            if cursor.rowcount != 1:
                connection.rollback()
                raise ClaimEvidenceCommitmentUnavailable("claim_evidence_commitment_unavailable")
            claimed = connection.execute(
                "SELECT * FROM decree_jobs WHERE job_id = ?", (row["job_id"],)
            ).fetchone()
            assert claimed is not None
            _require_legacy_commitment(claimed)
            connection.commit()
        return self._job(claimed)

    def add_provider_requests(
        self,
        job_id: str,
        worker_id: str,
        *,
        count: int,
        now: datetime | None = None,
    ) -> DecreeJob:
        if count < 1:
            raise ValueError("count must be positive")
        reserved_at = now or datetime.now(UTC)
        timestamp = _iso(reserved_at)
        with closing(self._connect()) as connection:
            connection.execute("BEGIN IMMEDIATE")
            self._owned_by_worker(connection, job_id, worker_id, now=reserved_at)
            cursor = connection.execute(
                """
                UPDATE decree_jobs
                SET provider_request_count = provider_request_count + ?, updated_at = ?
                WHERE job_id = ?
                  AND provider_request_count + ? <= provider_request_limit
                  AND claim_evidence_commitment_json IS NULL
                """,
                (count, timestamp, job_id, count),
            )
            if cursor.rowcount != 1:
                connection.rollback()
                raise ProviderRequestLimitExceeded("provider_request_limit_exceeded")
            row = connection.execute(
                "SELECT * FROM decree_jobs WHERE job_id = ?", (job_id,)
            ).fetchone()
            assert row is not None
            _require_legacy_commitment(row)
            connection.commit()
        return self._job(row)

    def renew_lease(
        self,
        job_id: str,
        worker_id: str,
        *,
        now: datetime | None = None,
        lease_seconds: int = 90,
    ) -> DecreeJob:
        if lease_seconds < 1:
            raise ValueError("lease_seconds must be positive")
        renewed_at = now or datetime.now(UTC)
        timestamp = _iso(renewed_at)
        lease_until = _iso(renewed_at + timedelta(seconds=lease_seconds))
        with closing(self._connect()) as connection:
            connection.execute("BEGIN IMMEDIATE")
            self._owned_by_worker(connection, job_id, worker_id, now=renewed_at)
            cursor = connection.execute(
                """
                UPDATE decree_jobs
                SET lease_expires_at = ?, updated_at = ?
                WHERE job_id = ? AND lease_owner = ? AND lease_expires_at > ?
                  AND state IN ('RUNNING', 'RESULT_READY', 'ARCHIVING', 'PUBLISHING')
                  AND claim_evidence_commitment_json IS NULL
                """,
                (lease_until, timestamp, job_id, worker_id, timestamp),
            )
            if cursor.rowcount != 1:
                connection.rollback()
                raise LeaseConflict("job lease cannot be renewed")
            row = connection.execute(
                "SELECT * FROM decree_jobs WHERE job_id = ?", (job_id,)
            ).fetchone()
            assert row is not None
            _require_legacy_commitment(row)
            connection.commit()
        return self._job(row)

    def fail_attempt(
        self,
        job_id: str,
        worker_id: str,
        *,
        error_code: str,
        error_stage: str = "execution",
        error_category: str = "internal",
        transient: bool,
        retry_at: datetime,
        now: datetime | None = None,
    ) -> DecreeJob:
        failed_at = now or datetime.now(UTC)
        timestamp = _iso(failed_at)
        with closing(self._connect()) as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = self._owned_by_worker(connection, job_id, worker_id, now=failed_at)
            if row["cancel_requested"]:
                cursor = connection.execute(
                    """
                    UPDATE decree_jobs
                    SET state = 'CANCELLED', error_code = 'cancelled',
                        error_stage = 'execution', error_category = 'cancelled',
                        retry_at = NULL, lease_owner = NULL,
                        lease_expires_at = NULL, updated_at = ?
                    WHERE job_id = ? AND claim_evidence_commitment_json IS NULL
                    """,
                    (timestamp, job_id),
                )
                updated = connection.execute(
                    "SELECT * FROM decree_jobs WHERE job_id = ?", (job_id,)
                ).fetchone()
                if cursor.rowcount != 1 or updated is None:
                    connection.rollback()
                    raise ClaimEvidenceCommitmentUnavailable(
                        "claim_evidence_commitment_unavailable"
                    )
                _require_legacy_commitment(updated)
                connection.commit()
                return self._job(updated)
            if row["state"] in {
                DecreeJobState.RESULT_READY.value,
                DecreeJobState.ARCHIVING.value,
                DecreeJobState.PUBLISHING.value,
            }:
                cursor = connection.execute(
                    """
                    UPDATE decree_jobs
                    SET lease_owner = NULL, lease_expires_at = ?, updated_at = ?
                    WHERE job_id = ? AND claim_evidence_commitment_json IS NULL
                    """,
                    (timestamp, timestamp, job_id),
                )
                updated = connection.execute(
                    "SELECT * FROM decree_jobs WHERE job_id = ?", (job_id,)
                ).fetchone()
                if cursor.rowcount != 1 or updated is None:
                    connection.rollback()
                    raise ClaimEvidenceCommitmentUnavailable(
                        "claim_evidence_commitment_unavailable"
                    )
                _require_legacy_commitment(updated)
                connection.commit()
                return self._job(updated)
            if row["state"] != DecreeJobState.RUNNING.value:
                connection.rollback()
                raise LeaseConflict("only a running model phase can fail an attempt")
            can_retry = (
                transient
                and int(row["attempt_count"]) < MAX_ATTEMPTS
                and failed_at < _datetime(row["deadline_at"])
            )
            state = DecreeJobState.RETRY_WAIT if can_retry else DecreeJobState.FAILED
            cursor = connection.execute(
                """
                UPDATE decree_jobs
                SET state = ?, error_code = ?, error_stage = ?, error_category = ?,
                    retry_at = ?,
                    lease_owner = NULL, lease_expires_at = NULL, updated_at = ?
                WHERE job_id = ? AND claim_evidence_commitment_json IS NULL
                """,
                (
                    state.value,
                    error_code,
                    error_stage,
                    error_category,
                    _iso(retry_at) if can_retry else None,
                    timestamp,
                    job_id,
                ),
            )
            updated = connection.execute(
                "SELECT * FROM decree_jobs WHERE job_id = ?", (job_id,)
            ).fetchone()
            if cursor.rowcount != 1 or updated is None:
                connection.rollback()
                raise ClaimEvidenceCommitmentUnavailable("claim_evidence_commitment_unavailable")
            _require_legacy_commitment(updated)
            connection.commit()
        return self._job(updated)

    def request_cancel(
        self, job_id: str, owner_user_id: str, *, now: datetime | None = None
    ) -> DecreeJob:
        timestamp = _iso(now or datetime.now(UTC))
        with closing(self._connect()) as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                "SELECT * FROM decree_jobs WHERE job_id = ? AND owner_user_id = ?",
                (job_id, owner_user_id),
            ).fetchone()
            if row is None:
                connection.rollback()
                raise JobNotFound
            _require_legacy_commitment(row)
            state = DecreeJobState(row["state"])
            cursor = None
            if state in {DecreeJobState.QUEUED, DecreeJobState.RETRY_WAIT}:
                cursor = connection.execute(
                    """
                    UPDATE decree_jobs
                    SET state = 'CANCELLED', error_code = 'cancelled',
                        error_stage = 'queue', error_category = 'cancelled',
                        lease_owner = NULL, lease_expires_at = NULL, updated_at = ?
                    WHERE job_id = ? AND claim_evidence_commitment_json IS NULL
                    """,
                    (timestamp, job_id),
                )
            elif state is DecreeJobState.RUNNING:
                cursor = connection.execute(
                    "UPDATE decree_jobs SET cancel_requested = 1, updated_at = ? "
                    "WHERE job_id = ? AND claim_evidence_commitment_json IS NULL",
                    (timestamp, job_id),
                )
            if cursor is not None and cursor.rowcount != 1:
                connection.rollback()
                raise ClaimEvidenceCommitmentUnavailable("claim_evidence_commitment_unavailable")
            updated = connection.execute(
                "SELECT * FROM decree_jobs WHERE job_id = ?", (job_id,)
            ).fetchone()
            assert updated is not None
            _require_legacy_commitment(updated)
            connection.commit()
        return self._job(updated)

    def cancel_at_boundary(
        self, job_id: str, worker_id: str, *, now: datetime | None = None
    ) -> DecreeJob:
        cancelled_at = now or datetime.now(UTC)
        timestamp = _iso(cancelled_at)
        with closing(self._connect()) as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = self._owned_by_worker(connection, job_id, worker_id, now=cancelled_at)
            cursor = None
            if row["state"] == DecreeJobState.RUNNING.value and row["cancel_requested"]:
                cursor = connection.execute(
                    """
                    UPDATE decree_jobs
                    SET state = 'CANCELLED', error_code = 'cancelled',
                        error_stage = 'execution', error_category = 'cancelled',
                        lease_owner = NULL, lease_expires_at = NULL, updated_at = ?
                    WHERE job_id = ? AND claim_evidence_commitment_json IS NULL
                    """,
                    (timestamp, job_id),
                )
            if cursor is not None and cursor.rowcount != 1:
                connection.rollback()
                raise ClaimEvidenceCommitmentUnavailable("claim_evidence_commitment_unavailable")
            updated = connection.execute(
                "SELECT * FROM decree_jobs WHERE job_id = ?", (job_id,)
            ).fetchone()
            assert updated is not None
            _require_legacy_commitment(updated)
            connection.commit()
        return self._job(updated)

    def _checkpoint(
        self,
        job_id: str,
        worker_id: str,
        state: DecreeJobState,
        *,
        expected_state: DecreeJobState,
        now: datetime,
        result_json: str | None = None,
        reply_id: str | None = None,
        release_lease: bool = False,
    ) -> DecreeJob:
        with closing(self._connect()) as connection:
            connection.execute("BEGIN IMMEDIATE")
            current = self._owned_by_worker(connection, job_id, worker_id, now=now)
            if current["state"] != expected_state.value:
                connection.rollback()
                raise LeaseConflict(f"expected {expected_state.value} before {state.value}")
            if expected_state is DecreeJobState.RUNNING and current["cancel_requested"]:
                cursor = connection.execute(
                    """
                    UPDATE decree_jobs
                    SET state = 'CANCELLED', error_code = 'cancelled',
                        error_stage = 'execution', error_category = 'cancelled',
                        lease_owner = NULL, lease_expires_at = NULL, updated_at = ?
                    WHERE job_id = ? AND claim_evidence_commitment_json IS NULL
                    """,
                    (_iso(now), job_id),
                )
                row = connection.execute(
                    "SELECT * FROM decree_jobs WHERE job_id = ?", (job_id,)
                ).fetchone()
                if cursor.rowcount != 1 or row is None:
                    connection.rollback()
                    raise ClaimEvidenceCommitmentUnavailable(
                        "claim_evidence_commitment_unavailable"
                    )
                _require_legacy_commitment(row)
                connection.commit()
                return self._job(row)
            cursor = connection.execute(
                """
                UPDATE decree_jobs
                SET state = ?, result_json = COALESCE(?, result_json),
                    reply_id = COALESCE(?, reply_id), cancel_requested = 0,
                    lease_owner = CASE WHEN ? THEN NULL ELSE lease_owner END,
                    lease_expires_at = CASE WHEN ? THEN NULL ELSE lease_expires_at END,
                    updated_at = ?
                WHERE job_id = ? AND claim_evidence_commitment_json IS NULL
                """,
                (
                    state.value,
                    result_json,
                    reply_id,
                    release_lease,
                    release_lease,
                    _iso(now),
                    job_id,
                ),
            )
            row = connection.execute(
                "SELECT * FROM decree_jobs WHERE job_id = ?", (job_id,)
            ).fetchone()
            if cursor.rowcount != 1 or row is None:
                connection.rollback()
                raise ClaimEvidenceCommitmentUnavailable("claim_evidence_commitment_unavailable")
            _require_legacy_commitment(row)
            connection.commit()
        return self._job(row)

    def checkpoint_result(
        self,
        job_id: str,
        worker_id: str,
        *,
        result_json: str,
        now: datetime | None = None,
    ) -> DecreeJob:
        if not result_json.strip():
            raise ValueError("result_json is required")
        return self._checkpoint(
            job_id,
            worker_id,
            DecreeJobState.RESULT_READY,
            expected_state=DecreeJobState.RUNNING,
            now=now or datetime.now(UTC),
            result_json=result_json,
        )

    def begin_archiving(
        self, job_id: str, worker_id: str, *, now: datetime | None = None
    ) -> DecreeJob:
        return self._checkpoint(
            job_id,
            worker_id,
            DecreeJobState.ARCHIVING,
            expected_state=DecreeJobState.RESULT_READY,
            now=now or datetime.now(UTC),
        )

    def begin_publishing(
        self,
        job_id: str,
        worker_id: str,
        *,
        reply_id: str,
        now: datetime | None = None,
    ) -> DecreeJob:
        if not reply_id.strip():
            raise ValueError("reply_id is required")
        return self._checkpoint(
            job_id,
            worker_id,
            DecreeJobState.PUBLISHING,
            expected_state=DecreeJobState.ARCHIVING,
            now=now or datetime.now(UTC),
            reply_id=reply_id,
        )

    def complete(
        self,
        job_id: str,
        worker_id: str,
        *,
        result_json: str | None = None,
        now: datetime | None = None,
    ) -> DecreeJob:
        completed = self._checkpoint(
            job_id,
            worker_id,
            DecreeJobState.SUCCEEDED,
            expected_state=DecreeJobState.PUBLISHING,
            now=now or datetime.now(UTC),
            result_json=result_json,
            release_lease=True,
        )
        return completed

    def release_checkpoint(
        self,
        job_id: str,
        worker_id: str,
        *,
        error_code: str,
        now: datetime | None = None,
    ) -> DecreeJob:
        return self.fail_checkpoint(
            job_id,
            worker_id,
            error_code=error_code,
            transient=True,
            now=now,
        )

    def fail_checkpoint(
        self,
        job_id: str,
        worker_id: str,
        *,
        error_code: str,
        error_stage: str = "side_effect",
        error_category: str = "internal",
        transient: bool,
        now: datetime | None = None,
    ) -> DecreeJob:
        released_at = now or datetime.now(UTC)
        with closing(self._connect()) as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = self._owned_by_worker(connection, job_id, worker_id, now=released_at)
            if row["state"] not in {
                DecreeJobState.RESULT_READY.value,
                DecreeJobState.ARCHIVING.value,
                DecreeJobState.PUBLISHING.value,
            }:
                connection.rollback()
                raise LeaseConflict("only a side-effect checkpoint can be released")
            can_retry = (
                transient
                and row["error_code"] is None
                and released_at < _datetime(row["deadline_at"])
            )
            if can_retry:
                cursor = connection.execute(
                    """
                    UPDATE decree_jobs
                    SET error_code = ?, error_stage = ?, error_category = ?,
                        lease_owner = NULL, lease_expires_at = ?,
                        updated_at = ?
                    WHERE job_id = ? AND claim_evidence_commitment_json IS NULL
                    """,
                    (
                        error_code,
                        error_stage,
                        error_category,
                        _iso(released_at),
                        _iso(released_at),
                        job_id,
                    ),
                )
            else:
                cursor = connection.execute(
                    """
                    UPDATE decree_jobs
                    SET state = 'FAILED', error_code = ?, error_stage = ?,
                        error_category = ?, lease_owner = NULL,
                        lease_expires_at = NULL, updated_at = ?
                    WHERE job_id = ? AND claim_evidence_commitment_json IS NULL
                    """,
                    (error_code, error_stage, error_category, _iso(released_at), job_id),
                )
            updated = connection.execute(
                "SELECT * FROM decree_jobs WHERE job_id = ?", (job_id,)
            ).fetchone()
            if cursor.rowcount != 1 or updated is None:
                connection.rollback()
                raise ClaimEvidenceCommitmentUnavailable("claim_evidence_commitment_unavailable")
            _require_legacy_commitment(updated)
            connection.commit()
        return self._job(updated)
