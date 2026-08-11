from __future__ import annotations

import secrets
import sqlite3
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


class LeaseConflict(DecreeJobStoreError):
    pass


class ProviderRequestLimitExceeded(DecreeJobStoreError):
    pass


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

    def _initialize(self) -> None:
        with closing(self._connect()) as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS decree_jobs (
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
            )
            columns = {
                str(row[1])
                for row in connection.execute("PRAGMA table_info(decree_jobs)").fetchall()
            }
            if "provider_request_limit" not in columns:
                connection.execute(
                    "ALTER TABLE decree_jobs ADD COLUMN provider_request_limit "
                    "INTEGER NOT NULL DEFAULT 8"
                )
            if "error_stage" not in columns:
                connection.execute("ALTER TABLE decree_jobs ADD COLUMN error_stage TEXT")
            if "error_category" not in columns:
                connection.execute("ALTER TABLE decree_jobs ADD COLUMN error_category TEXT")
            if "acceptance_committed" not in columns:
                connection.execute(
                    "ALTER TABLE decree_jobs ADD COLUMN acceptance_committed "
                    "INTEGER NOT NULL DEFAULT 1"
                )
            connection.execute(
                """
                UPDATE decree_jobs
                SET error_stage = CASE
                        WHEN error_stage IS NOT NULL THEN error_stage
                        WHEN state = 'CANCELLED' AND attempt_count = 0 THEN 'queue'
                        ELSE 'execution'
                    END,
                    error_category = CASE
                        WHEN error_category IS NOT NULL THEN error_category
                        WHEN state = 'CANCELLED' THEN 'cancelled'
                        WHEN error_code = 'provider_budget_exceeded' THEN 'budget'
                        WHEN error_code = 'deadline_exceeded' THEN 'deadline'
                        WHEN error_code = 'retry_exhausted' THEN 'retry'
                        WHEN error_code LIKE 'provider_%' THEN 'provider'
                        ELSE 'internal'
                    END
                WHERE state IN ('FAILED', 'CANCELLED')
                  AND (error_stage IS NULL OR error_category IS NULL)
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS decree_job_idempotency_keys (
                    owner_user_id TEXT NOT NULL,
                    idempotency_key TEXT NOT NULL,
                    request_hash TEXT NOT NULL,
                    job_id TEXT NOT NULL REFERENCES decree_jobs(job_id),
                    PRIMARY KEY(owner_user_id, idempotency_key)
                )
                """
            )
            connection.execute(
                """
                INSERT OR IGNORE INTO decree_job_idempotency_keys (
                    owner_user_id, idempotency_key, request_hash, job_id
                )
                SELECT owner_user_id, idempotency_key, request_hash, job_id
                FROM decree_jobs
                """
            )
            connection.commit()

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
        if command.provider_request_limit < 1 or command.provider_request_limit > 8:
            raise ValueError("provider_request_limit must be between 1 and 8")
        _iso(command.deadline_at)

    def accept(
        self, command: AcceptDecreeJob, *, now: datetime | None = None
    ) -> AcceptedDecreeJob:
        self._validate(command)
        accepted_at = now or datetime.now(UTC)
        timestamp = _iso(accepted_at)
        with closing(self._connect()) as connection:
            connection.execute("BEGIN IMMEDIATE")
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
                    connection.rollback()
                    raise IdempotencyConflict("idempotency_key_reused")
                if not bool(existing_key["acceptance_committed"]):
                    connection.execute(
                        "DELETE FROM decree_job_idempotency_keys WHERE job_id = ?",
                        (existing_key["job_id"],),
                    )
                    connection.execute(
                        "DELETE FROM decree_jobs WHERE job_id = ?",
                        (existing_key["job_id"],),
                    )
                else:
                    connection.commit()
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
                    connection.rollback()
                    raise IdempotencyConflict("draft_fingerprint_reused")
                if not bool(existing_draft["acceptance_committed"]):
                    connection.execute(
                        "DELETE FROM decree_job_idempotency_keys WHERE job_id = ?",
                        (existing_draft["job_id"],),
                    )
                    connection.execute(
                        "DELETE FROM decree_jobs WHERE job_id = ?",
                        (existing_draft["job_id"],),
                    )
                    existing_draft = None
            if existing_draft is not None:
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
                        existing_draft["job_id"],
                    ),
                )
                connection.commit()
                return AcceptedDecreeJob(self._job(existing_draft), replayed=True)
            job_id = secrets.token_hex(16)
            connection.execute(
                """
                INSERT INTO decree_jobs (
                    job_id, owner_user_id, idempotency_key, request_hash,
                    draft_fingerprint, decree_text, approved_route_json, state,
                    provider_request_limit, acceptance_committed,
                    deadline_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'QUEUED', ?, ?, ?, ?, ?)
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
            row = connection.execute(
                "SELECT * FROM decree_jobs WHERE job_id = ?", (job_id,)
            ).fetchone()
            connection.commit()
        assert row is not None
        return AcceptedDecreeJob(self._job(row), replayed=False)

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
                  AND jobs.acceptance_committed = 1
                """,
                (owner_user_id, idempotency_key),
            ).fetchone()
        if row is None:
            return None
        if row["request_hash"] != request_hash:
            raise IdempotencyConflict("idempotency_key_reused")
        return AcceptedDecreeJob(self._job(row), replayed=True)

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
            if bool(row["acceptance_committed"]):
                connection.commit()
                return AcceptedDecreeJob(self._job(row), replayed=True)
            cursor = connection.execute(
                """
                UPDATE decree_jobs
                SET acceptance_committed = 1, updated_at = ?
                WHERE job_id = ? AND owner_user_id = ?
                  AND acceptance_committed = 0 AND state = 'QUEUED'
                """,
                (timestamp, row["job_id"], owner_user_id),
            )
            if cursor.rowcount != 1:
                connection.rollback()
                raise DecreeJobStoreError("acceptance_recovery_failed")
            recovered = connection.execute(
                "SELECT * FROM decree_jobs WHERE job_id = ?", (row["job_id"],)
            ).fetchone()
            connection.commit()
        assert recovered is not None
        return AcceptedDecreeJob(self._job(recovered), replayed=True)

    def count(self) -> int:
        with closing(self._connect()) as connection:
            row = connection.execute("SELECT COUNT(*) AS count FROM decree_jobs").fetchone()
        assert row is not None
        return int(row["count"])

    def activate_acceptance(
        self, job_id: str, owner_user_id: str, *, now: datetime | None = None
    ) -> DecreeJob:
        timestamp = _iso(now or datetime.now(UTC))
        with closing(self._connect()) as connection:
            connection.execute("BEGIN IMMEDIATE")
            cursor = connection.execute(
                """
                UPDATE decree_jobs
                SET acceptance_committed = 1, updated_at = ?
                WHERE job_id = ? AND owner_user_id = ?
                  AND acceptance_committed = 0 AND state = 'QUEUED'
                """,
                (timestamp, job_id, owner_user_id),
            )
            if cursor.rowcount != 1:
                existing = connection.execute(
                    """
                    SELECT * FROM decree_jobs
                    WHERE job_id = ? AND owner_user_id = ?
                      AND acceptance_committed = 1 AND state = 'QUEUED'
                    """,
                    (job_id, owner_user_id),
                ).fetchone()
                if existing is None:
                    connection.rollback()
                    raise DecreeJobStoreError("acceptance_activation_failed")
                connection.commit()
                return self._job(existing)
            row = connection.execute(
                "SELECT * FROM decree_jobs WHERE job_id = ?", (job_id,)
            ).fetchone()
            connection.commit()
        assert row is not None
        return self._job(row)

    def abandon_acceptance(self, job_id: str, owner_user_id: str) -> None:
        """Remove an uncommitted acceptance that never acquired authority."""
        with closing(self._connect()) as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                """
                SELECT job_id FROM decree_jobs
                WHERE job_id = ? AND owner_user_id = ?
                  AND acceptance_committed = 0 AND state = 'QUEUED'
                """,
                (job_id, owner_user_id),
            ).fetchone()
            if row is None:
                connection.rollback()
                raise DecreeJobStoreError("acceptance_abandon_failed")
            connection.execute(
                "DELETE FROM decree_job_idempotency_keys WHERE job_id = ?", (job_id,)
            )
            connection.execute("DELETE FROM decree_jobs WHERE job_id = ?", (job_id,))
            connection.commit()

    def get_for_owner(self, job_id: str, owner_user_id: str) -> DecreeJob:
        with closing(self._connect()) as connection:
            row = connection.execute(
                "SELECT * FROM decree_jobs WHERE job_id = ? AND owner_user_id = ?",
                (job_id, owner_user_id),
            ).fetchone()
        if row is None:
            raise JobNotFound
        return self._job(row)

    def _owned_by_worker(
        self,
        connection: sqlite3.Connection,
        job_id: str,
        worker_id: str,
        *,
        now: datetime,
    ) -> sqlite3.Row:
        row = connection.execute(
            "SELECT * FROM decree_jobs WHERE job_id = ?", (job_id,)
        ).fetchone()
        if row is None:
            raise JobNotFound
        lease_expires_at = _datetime(row["lease_expires_at"])
        if (
            row["lease_owner"] != worker_id
            or lease_expires_at is None
            or lease_expires_at <= now
        ):
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
            connection.execute(
                """
                UPDATE decree_jobs
                SET state = 'FAILED', error_code = 'retry_exhausted',
                    error_stage = 'execution', error_category = 'retry',
                    lease_owner = NULL, lease_expires_at = NULL, updated_at = ?
                WHERE state = 'RUNNING' AND lease_expires_at <= ?
                  AND attempt_count >= ?
                """,
                (timestamp, timestamp, MAX_ATTEMPTS),
            )
            connection.execute(
                """
                UPDATE decree_jobs
                SET state = 'FAILED', error_code = 'deadline_exceeded',
                    error_stage = 'execution', error_category = 'deadline',
                    lease_owner = NULL, lease_expires_at = NULL, updated_at = ?
                WHERE state IN ('QUEUED', 'RETRY_WAIT', 'RUNNING', 'RESULT_READY')
                  AND deadline_at <= ?
                """,
                (timestamp, timestamp),
            )
            row = connection.execute(
                """
                SELECT * FROM decree_jobs
                WHERE (
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
                  )
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
                connection.execute(
                    """
                    UPDATE decree_jobs
                    SET lease_owner = ?, lease_expires_at = ?, updated_at = ?
                    WHERE job_id = ?
                    """,
                    (worker_id, lease_until, timestamp, row["job_id"]),
                )
            else:
                connection.execute(
                    """
                    UPDATE decree_jobs
                    SET state = 'RUNNING', attempt_count = attempt_count + 1,
                        lease_owner = ?, lease_expires_at = ?, retry_at = NULL,
                        error_code = NULL, error_stage = NULL,
                        error_category = NULL, updated_at = ?
                    WHERE job_id = ?
                    """,
                    (worker_id, lease_until, timestamp, row["job_id"]),
                )
            claimed = connection.execute(
                "SELECT * FROM decree_jobs WHERE job_id = ?", (row["job_id"],)
            ).fetchone()
            connection.commit()
        assert claimed is not None
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
            self._owned_by_worker(
                connection, job_id, worker_id, now=reserved_at
            )
            cursor = connection.execute(
                """
                UPDATE decree_jobs
                SET provider_request_count = provider_request_count + ?, updated_at = ?
                WHERE job_id = ?
                  AND provider_request_count + ? <= provider_request_limit
                """,
                (count, timestamp, job_id, count),
            )
            if cursor.rowcount != 1:
                connection.rollback()
                raise ProviderRequestLimitExceeded("provider_request_limit_exceeded")
            row = connection.execute(
                "SELECT * FROM decree_jobs WHERE job_id = ?", (job_id,)
            ).fetchone()
            connection.commit()
        assert row is not None
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
            cursor = connection.execute(
                """
                UPDATE decree_jobs
                SET lease_expires_at = ?, updated_at = ?
                WHERE job_id = ? AND lease_owner = ? AND lease_expires_at > ?
                  AND state IN ('RUNNING', 'RESULT_READY', 'ARCHIVING', 'PUBLISHING')
                """,
                (lease_until, timestamp, job_id, worker_id, timestamp),
            )
            if cursor.rowcount != 1:
                connection.rollback()
                raise LeaseConflict("job lease cannot be renewed")
            row = connection.execute(
                "SELECT * FROM decree_jobs WHERE job_id = ?", (job_id,)
            ).fetchone()
            connection.commit()
        assert row is not None
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
            row = self._owned_by_worker(
                connection, job_id, worker_id, now=failed_at
            )
            can_retry = (
                transient
                and int(row["attempt_count"]) < MAX_ATTEMPTS
                and failed_at < _datetime(row["deadline_at"])
            )
            state = DecreeJobState.RETRY_WAIT if can_retry else DecreeJobState.FAILED
            connection.execute(
                """
                UPDATE decree_jobs
                SET state = ?, error_code = ?, error_stage = ?, error_category = ?,
                    retry_at = ?,
                    lease_owner = NULL, lease_expires_at = NULL, updated_at = ?
                WHERE job_id = ?
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
            connection.commit()
        assert updated is not None
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
            state = DecreeJobState(row["state"])
            if state in {DecreeJobState.QUEUED, DecreeJobState.RETRY_WAIT}:
                connection.execute(
                    """
                    UPDATE decree_jobs
                    SET state = 'CANCELLED', error_code = 'cancelled',
                        error_stage = 'queue', error_category = 'cancelled',
                        lease_owner = NULL, lease_expires_at = NULL, updated_at = ?
                    WHERE job_id = ?
                    """,
                    (timestamp, job_id),
                )
            elif state is DecreeJobState.RUNNING:
                connection.execute(
                    "UPDATE decree_jobs SET cancel_requested = 1, updated_at = ? WHERE job_id = ?",
                    (timestamp, job_id),
                )
            updated = connection.execute(
                "SELECT * FROM decree_jobs WHERE job_id = ?", (job_id,)
            ).fetchone()
            connection.commit()
        assert updated is not None
        return self._job(updated)

    def cancel_at_boundary(
        self, job_id: str, worker_id: str, *, now: datetime | None = None
    ) -> DecreeJob:
        cancelled_at = now or datetime.now(UTC)
        timestamp = _iso(cancelled_at)
        with closing(self._connect()) as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = self._owned_by_worker(
                connection, job_id, worker_id, now=cancelled_at
            )
            if row["state"] == DecreeJobState.RUNNING.value and row["cancel_requested"]:
                connection.execute(
                    """
                    UPDATE decree_jobs
                    SET state = 'CANCELLED', error_code = 'cancelled',
                        error_stage = 'execution', error_category = 'cancelled',
                        lease_owner = NULL, lease_expires_at = NULL, updated_at = ?
                    WHERE job_id = ?
                    """,
                    (timestamp, job_id),
                )
            updated = connection.execute(
                "SELECT * FROM decree_jobs WHERE job_id = ?", (job_id,)
            ).fetchone()
            connection.commit()
        assert updated is not None
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
            current = self._owned_by_worker(
                connection, job_id, worker_id, now=now
            )
            if current["state"] != expected_state.value:
                connection.rollback()
                raise LeaseConflict(
                    f"expected {expected_state.value} before {state.value}"
                )
            connection.execute(
                """
                UPDATE decree_jobs
                SET state = ?, result_json = COALESCE(?, result_json),
                    reply_id = COALESCE(?, reply_id), cancel_requested = 0,
                    lease_owner = CASE WHEN ? THEN NULL ELSE lease_owner END,
                    lease_expires_at = CASE WHEN ? THEN NULL ELSE lease_expires_at END,
                    updated_at = ?
                WHERE job_id = ?
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
            connection.commit()
        assert row is not None
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
            row = self._owned_by_worker(
                connection, job_id, worker_id, now=released_at
            )
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
                connection.execute(
                    """
                    UPDATE decree_jobs
                    SET error_code = ?, error_stage = ?, error_category = ?,
                        lease_owner = NULL, lease_expires_at = ?,
                        updated_at = ?
                    WHERE job_id = ?
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
                connection.execute(
                    """
                    UPDATE decree_jobs
                    SET state = 'FAILED', error_code = ?, error_stage = ?,
                        error_category = ?, lease_owner = NULL,
                        lease_expires_at = NULL, updated_at = ?
                    WHERE job_id = ?
                    """,
                    (error_code, error_stage, error_category, _iso(released_at), job_id),
                )
            updated = connection.execute(
                "SELECT * FROM decree_jobs WHERE job_id = ?", (job_id,)
            ).fetchone()
            connection.commit()
        assert updated is not None
        return self._job(updated)
