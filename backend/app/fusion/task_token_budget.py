"""Task token reservations in the existing Fusion provider-budget database.

An adapter must obtain a trusted input-token upper bound for the exact payload,
reserve before network I/O, and enforce the granted output cap at the provider.
This module supplies durable accounting, not tokenization, permissions, or a
claim that the current native Codex adapter already meets those prerequisites.
"""

from __future__ import annotations

import re
import sqlite3
from contextlib import closing, contextmanager
from dataclasses import dataclass
from pathlib import Path

MAX_TASK_TOKENS = 50_000

_BUDGET_DDL = """CREATE TABLE task_token_budget_v1 (
    owner_id TEXT NOT NULL, task_id TEXT NOT NULL,
    cap INTEGER NOT NULL CHECK(cap BETWEEN 1 AND 50000),
    charged INTEGER NOT NULL DEFAULT 0 CHECK(charged >= 0),
    reserved INTEGER NOT NULL DEFAULT 0 CHECK(reserved >= 0),
    blocked_reason TEXT,
    PRIMARY KEY(owner_id, task_id))"""


def _schema_key(sql: str) -> str:
    return re.sub(
        r"\s+",
        "",
        sql.lower().replace('"', "").replace("IF NOT EXISTS", "").replace("if not exists", ""),
    )


def _initialize_budget_schema(db):
    current = db.execute(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='task_token_budget_v1'"
    ).fetchone()
    if current is None:
        db.execute(_BUDGET_DDL)
        return
    if _schema_key(current[0]) == _schema_key(_BUDGET_DDL):
        return
    if _schema_key(current[0]) != _schema_key(_BUDGET_DDL.replace("50000", "20000")):
        raise TaskTokenBudgetError("task_token_schema_unsupported")
    # Rebuild only the known old parent table. Keep each stored cap and every
    # reservation unchanged; do not rename the old table and rewrite its FKs.
    if db.execute(
        "SELECT 1 FROM sqlite_master WHERE tbl_name='task_token_budget_v1' "
        "AND type IN ('index','trigger') AND sql IS NOT NULL"
    ).fetchone():
        raise TaskTokenBudgetError("task_token_schema_unsupported")
    temporary = "task_token_budget_cap_migration"
    if db.execute("SELECT 1 FROM sqlite_master WHERE name=?", (temporary,)).fetchone():
        raise TaskTokenBudgetError("task_token_schema_unsupported")
    db.execute(_BUDGET_DDL.replace("task_token_budget_v1", temporary))
    db.execute(
        "INSERT INTO task_token_budget_cap_migration "
        "SELECT owner_id,task_id,cap,charged,reserved,blocked_reason FROM task_token_budget_v1"
    )
    db.execute("DROP TABLE task_token_budget_v1")
    db.execute("ALTER TABLE task_token_budget_cap_migration RENAME TO task_token_budget_v1")


class TaskTokenBudgetError(RuntimeError):
    """Stable error code only; never includes prompts, credentials or responses."""


@dataclass(frozen=True)
class TaskTokenSnapshot:
    limit_tokens: int
    charged_tokens: int
    reserved_tokens: int
    available_tokens: int
    blocked_reason: str | None


@dataclass(frozen=True)
class TokenReservation:
    owner_id: str
    task_id: str
    request_id: str
    attempt_id: str
    request_sha256: str
    input_tokens: int
    max_output_tokens: int


def _identity(value: str) -> str:
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}", value):
        raise ValueError("invalid_budget_identity")
    return value


def _digest(value: str) -> str:
    if not isinstance(value, str) or not re.fullmatch(r"[0-9a-f]{64}", value):
        raise ValueError("invalid_request_digest")
    return value


def _count(value: int, *, maximum: int, minimum: int = 0) -> int:
    if type(value) is not int or not minimum <= value <= maximum:
        raise ValueError("invalid_token_count")
    return value


class TaskTokenBudget:
    """Owner + task budget shared by every attempt; no reset/refund-on-timeout."""

    def __init__(self, path: Path, *, owner_id: str, task_id: str, max_tokens: int | None = None):
        self.path = Path(path).resolve()
        self.owner_id = _identity(owner_id)
        self.task_id = _identity(task_id)
        requested_cap = (
            None if max_tokens is None else _count(max_tokens, minimum=1, maximum=MAX_TASK_TOKENS)
        )
        # SQLite requires foreign_keys OFF before BEGIN to replace a referenced
        # parent. Full migration + initialization commit atomically and run the
        # FK check before commit. All ordinary accounting uses FK enforcement.
        with self._transaction(foreign_keys=False) as db:
            _initialize_budget_schema(db)
            db.execute("""CREATE TABLE IF NOT EXISTS task_token_reservation_v1 (
                owner_id TEXT NOT NULL, task_id TEXT NOT NULL, request_id TEXT NOT NULL,
                attempt_id TEXT NOT NULL, request_sha256 TEXT NOT NULL,
                input_bound INTEGER NOT NULL, output_cap INTEGER NOT NULL,
                state TEXT NOT NULL CHECK(state IN ('reserved', 'unknown', 'settled')),
                actual_input INTEGER, actual_output INTEGER,
                PRIMARY KEY(owner_id, task_id, request_id),
                FOREIGN KEY(owner_id, task_id)
                    REFERENCES task_token_budget_v1(owner_id, task_id))""")
            db.execute(
                "INSERT OR IGNORE INTO task_token_budget_v1(owner_id,task_id,cap) VALUES(?,?,?)",
                (*self._scope, requested_cap or MAX_TASK_TOKENS),
            )
            stored_cap = self._row(db)["cap"]
            if requested_cap is not None and stored_cap != requested_cap:
                raise ValueError("existing task token cap is immutable")
            if db.execute("PRAGMA foreign_key_check").fetchone() is not None:
                raise TaskTokenBudgetError("task_token_schema_invalid")
            self.max_tokens = _count(stored_cap, minimum=1, maximum=MAX_TASK_TOKENS)

    @property
    def _scope(self):
        return self.owner_id, self.task_id

    @contextmanager
    def _transaction(self, *, foreign_keys=True):
        with closing(sqlite3.connect(self.path, timeout=15)) as db, db:
            db.row_factory = sqlite3.Row
            db.execute("PRAGMA foreign_keys=ON" if foreign_keys else "PRAGMA foreign_keys=OFF")
            db.execute("BEGIN IMMEDIATE")
            yield db

    def _row(self, db):
        row = db.execute(
            "SELECT * FROM task_token_budget_v1 WHERE owner_id=? AND task_id=?", self._scope
        ).fetchone()
        if row is None:
            raise TaskTokenBudgetError("task_token_budget_missing")
        return row

    def _snapshot(self, db):
        row = self._row(db)
        return TaskTokenSnapshot(
            limit_tokens=row["cap"],
            charged_tokens=row["charged"],
            reserved_tokens=row["reserved"],
            available_tokens=0
            if row["blocked_reason"]
            else max(0, row["cap"] - row["charged"] - row["reserved"]),
            blocked_reason=row["blocked_reason"],
        )

    def snapshot(self) -> TaskTokenSnapshot:
        with self._transaction() as db:
            return self._snapshot(db)

    def reserve_tokens(
        self,
        *,
        attempt_id: str,
        request_id: str,
        request_sha256: str,
        input_tokens: int,
        max_output_tokens: int,
    ) -> TokenReservation:
        """One grant authorizes accounting for one send, never a repeated send.

        Same-ID duplicates are rejected, including after restart. A transport
        retry needs a fresh reservation; unresolved sends retain their full hold.
        """
        grant = TokenReservation(
            owner_id=self.owner_id,
            task_id=self.task_id,
            request_id=_identity(request_id),
            attempt_id=_identity(attempt_id),
            request_sha256=_digest(request_sha256),
            input_tokens=_count(input_tokens, maximum=self.max_tokens),
            max_output_tokens=_count(max_output_tokens, minimum=1, maximum=self.max_tokens),
        )
        total = grant.input_tokens + grant.max_output_tokens
        with self._transaction() as db:
            row = self._row(db)
            if row["blocked_reason"]:
                raise TaskTokenBudgetError("task_token_budget_blocked")
            if db.execute(
                "SELECT 1 FROM task_token_reservation_v1 "
                "WHERE owner_id=? AND task_id=? AND request_id=?",
                (*self._scope, request_id),
            ).fetchone():
                raise TaskTokenBudgetError("reservation_already_exists")
            if row["charged"] + row["reserved"] + total > row["cap"]:
                raise TaskTokenBudgetError("task_token_budget_exhausted")
            db.execute(
                "INSERT INTO task_token_reservation_v1 VALUES(?,?,?,?,?,?,?,'reserved',NULL,NULL)",
                (
                    *self._scope,
                    request_id,
                    attempt_id,
                    request_sha256,
                    input_tokens,
                    max_output_tokens,
                ),
            )
            db.execute(
                "UPDATE task_token_budget_v1 SET reserved=reserved+? "
                "WHERE owner_id=? AND task_id=?",
                (total, *self._scope),
            )
        return grant

    def _reservation(self, db, request_id, request_sha256):
        row = db.execute(
            "SELECT * FROM task_token_reservation_v1 "
            "WHERE owner_id=? AND task_id=? AND request_id=?",
            (*self._scope, _identity(request_id)),
        ).fetchone()
        if row is None:
            raise TaskTokenBudgetError("reservation_not_found")
        if row["request_sha256"] != _digest(request_sha256):
            raise TaskTokenBudgetError("request_digest_mismatch")
        return row

    def mark_usage_unknown(self, *, request_id: str, request_sha256: str) -> TaskTokenSnapshot:
        """Timeout/cancel/connection loss never means zero tokens or a refund."""
        with self._transaction() as db:
            row = self._reservation(db, request_id, request_sha256)
            if row["state"] != "settled":
                db.execute(
                    "UPDATE task_token_reservation_v1 SET state='unknown' "
                    "WHERE owner_id=? AND task_id=? AND request_id=?",
                    (*self._scope, request_id),
                )
            return self._snapshot(db)

    def settle_tokens(
        self, *, request_id: str, request_sha256: str, input_tokens: int, output_tokens: int
    ) -> TaskTokenSnapshot:
        # Keep the original hold when usage is malformed. Do not release based
        # on coercion, rounding, a missing receipt or a provider error string.
        _count(input_tokens, maximum=1_000_000_000)
        _count(output_tokens, maximum=1_000_000_000)
        exceeded = False
        with self._transaction() as db:
            row = self._reservation(db, request_id, request_sha256)
            exceeded = input_tokens > row["input_bound"] or output_tokens > row["output_cap"]
            if row["state"] == "settled":
                if (row["actual_input"], row["actual_output"]) != (input_tokens, output_tokens):
                    raise TaskTokenBudgetError("usage_receipt_conflict")
            else:
                db.execute(
                    "UPDATE task_token_reservation_v1 "
                    "SET state='settled',actual_input=?,actual_output=? "
                    "WHERE owner_id=? AND task_id=? AND request_id=?",
                    (input_tokens, output_tokens, *self._scope, request_id),
                )
                db.execute(
                    "UPDATE task_token_budget_v1 SET reserved=reserved-?,charged=charged+?,"
                    "blocked_reason=COALESCE(blocked_reason,?) WHERE owner_id=? AND task_id=?",
                    (
                        row["input_bound"] + row["output_cap"],
                        input_tokens + output_tokens,
                        "provider_usage_exceeded_reservation" if exceeded else None,
                        *self._scope,
                    ),
                )
            snapshot = self._snapshot(db)
        # Commit the actual overrun before raising, so a caught error or restart
        # cannot erase the violation or reset available tokens.
        if exceeded:
            raise TaskTokenBudgetError("provider_usage_exceeded_reservation")
        return snapshot
