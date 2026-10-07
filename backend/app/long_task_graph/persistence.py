from __future__ import annotations

import hashlib
import json
import secrets
import sqlite3
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from .models import GraphEvent, GraphRunSnapshot, GraphRunStatus, state_digest


class GraphRunNotFound(LookupError):
    pass


class GraphResumeRejected(ValueError):
    pass


class SQLiteGraphStore:
    def __init__(self, db_path: str | Path) -> None:
        self.db_path = str(db_path)
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path, timeout=10, isolation_level=None)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA foreign_keys=ON")
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS graph_runs (
                    run_id TEXT PRIMARY KEY,
                    owner_user_id TEXT NOT NULL,
                    graph_version TEXT NOT NULL,
                    status TEXT NOT NULL,
                    state_json TEXT NOT NULL,
                    current_node TEXT NOT NULL,
                    revision INTEGER NOT NULL,
                    resume_token_digest TEXT,
                    resume_expires_at TEXT,
                    terminal_reason TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS graph_checkpoints (
                    run_id TEXT NOT NULL,
                    checkpoint_seq INTEGER NOT NULL,
                    owner_user_id TEXT NOT NULL,
                    node_name TEXT NOT NULL,
                    state_json TEXT NOT NULL,
                    state_digest TEXT NOT NULL,
                    idempotency_key TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    PRIMARY KEY (run_id, checkpoint_seq),
                    UNIQUE (run_id, idempotency_key),
                    FOREIGN KEY (run_id) REFERENCES graph_runs(run_id)
                );
                CREATE TABLE IF NOT EXISTS graph_events (
                    run_id TEXT NOT NULL,
                    sequence INTEGER NOT NULL,
                    owner_user_id TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    idempotency_key TEXT,
                    created_at TEXT NOT NULL,
                    PRIMARY KEY (run_id, sequence),
                    UNIQUE (run_id, idempotency_key),
                    FOREIGN KEY (run_id) REFERENCES graph_runs(run_id)
                );
                """
            )
            columns = {row["name"] for row in connection.execute("PRAGMA table_info(graph_runs)")}
            if "terminal_reason" not in columns:
                connection.execute("ALTER TABLE graph_runs ADD COLUMN terminal_reason TEXT")

    @staticmethod
    def _now() -> datetime:
        return datetime.now(UTC)

    @staticmethod
    def _iso(value: datetime) -> str:
        return value.astimezone(UTC).isoformat()

    @staticmethod
    def _parse(value: str) -> datetime:
        return datetime.fromisoformat(value)

    @staticmethod
    def _json(value: Any) -> str:
        return json.dumps(
            value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False
        )

    def _row(self, connection: sqlite3.Connection, run_id: str, owner_user_id: str) -> sqlite3.Row:
        row = connection.execute(
            "SELECT * FROM graph_runs WHERE run_id = ? AND owner_user_id = ?",
            (run_id, owner_user_id),
        ).fetchone()
        if row is None:
            raise GraphRunNotFound("graph run not found")
        return row

    def _snapshot(self, row: sqlite3.Row) -> GraphRunSnapshot:
        return GraphRunSnapshot(
            run_id=row["run_id"],
            owner_user_id=row["owner_user_id"],
            graph_version=row["graph_version"],
            status=GraphRunStatus(row["status"]),
            state=json.loads(row["state_json"]),
            current_node=row["current_node"],
            revision=row["revision"],
            terminal_reason=row["terminal_reason"],
            resume_token=None,
            updated_at=self._parse(row["updated_at"]),
        )

    def _event(
        self,
        connection: sqlite3.Connection,
        run_id: str,
        owner_user_id: str,
        event_type: str,
        payload: dict[str, Any],
        *,
        idempotency_key: str | None = None,
    ) -> GraphEvent:
        existing = None
        if idempotency_key is not None:
            existing = connection.execute(
                "SELECT * FROM graph_events WHERE run_id = ? AND idempotency_key = ?",
                (run_id, idempotency_key),
            ).fetchone()
        if existing is not None:
            return GraphEvent(
                run_id=run_id,
                sequence=existing["sequence"],
                event_type=existing["event_type"],
                payload=json.loads(existing["payload_json"]),
                created_at=self._parse(existing["created_at"]),
            )
        sequence = connection.execute(
            "SELECT COALESCE(MAX(sequence), 0) + 1 FROM graph_events WHERE run_id = ?",
            (run_id,),
        ).fetchone()[0]
        created = self._now()
        connection.execute(
            "INSERT INTO graph_events(run_id, sequence, owner_user_id, event_type, payload_json, idempotency_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",  # noqa: E501
            (
                run_id,
                sequence,
                owner_user_id,
                event_type,
                self._json(payload),
                idempotency_key,
                self._iso(created),
            ),
        )
        return GraphEvent(run_id, sequence, event_type, payload, created)

    def create_run(
        self,
        owner_user_id: str,
        *,
        graph_version: str,
        initial_state: dict[str, Any],
        start_node: str = "start",
        run_id: str | None = None,
    ) -> GraphRunSnapshot:
        if not owner_user_id.strip() or not graph_version.strip() or not start_node.strip():
            raise ValueError("owner, graph version and start node are required")
        run_id = run_id or secrets.token_urlsafe(18)
        now = self._now()
        state_json = self._json(initial_state)
        with self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            try:
                connection.execute(
                    "INSERT INTO graph_runs(run_id, owner_user_id, graph_version, status, state_json, current_node, revision, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",  # noqa: E501
                    (
                        run_id,
                        owner_user_id,
                        graph_version,
                        GraphRunStatus.RUNNING.value,
                        state_json,
                        start_node,
                        0,
                        self._iso(now),
                        self._iso(now),
                    ),
                )
                self._event(
                    connection,
                    run_id,
                    owner_user_id,
                    "RUN_CREATED",
                    {"graph_version": graph_version, "state_digest": state_digest(initial_state)},
                    idempotency_key="run-created",
                )
                row = self._row(connection, run_id, owner_user_id)
                connection.commit()
                return self._snapshot(row)
            except Exception:
                connection.rollback()
                raise

    def load_run(self, run_id: str, owner_user_id: str) -> GraphRunSnapshot:
        with self._connect() as connection:
            return self._snapshot(self._row(connection, run_id, owner_user_id))

    def append_checkpoint(
        self,
        run_id: str,
        owner_user_id: str,
        *,
        node_name: str,
        state: dict[str, Any],
        idempotency_key: str,
    ) -> GraphRunSnapshot:
        with self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = self._row(connection, run_id, owner_user_id)
            existing = connection.execute(
                "SELECT checkpoint_seq FROM graph_checkpoints WHERE run_id = ? AND idempotency_key = ?",  # noqa: E501
                (run_id, idempotency_key),
            ).fetchone()
            if existing is not None:
                connection.commit()
                return self._snapshot(row)
            checkpoint_seq = int(row["revision"]) + 1
            now = self._now()
            state_json = self._json(state)
            connection.execute(
                "INSERT INTO graph_checkpoints(run_id, checkpoint_seq, owner_user_id, node_name, state_json, state_digest, idempotency_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",  # noqa: E501
                (
                    run_id,
                    checkpoint_seq,
                    owner_user_id,
                    node_name,
                    state_json,
                    state_digest(state),
                    idempotency_key,
                    self._iso(now),
                ),
            )
            connection.execute(
                "UPDATE graph_runs SET state_json = ?, current_node = ?, revision = ?, updated_at = ? WHERE run_id = ? AND owner_user_id = ?",  # noqa: E501
                (state_json, node_name, checkpoint_seq, self._iso(now), run_id, owner_user_id),
            )
            self._event(
                connection,
                run_id,
                owner_user_id,
                "CHECKPOINT",
                {
                    "node": node_name,
                    "state_digest": state_digest(state),
                    "revision": checkpoint_seq,
                },
                idempotency_key=f"checkpoint:{idempotency_key}",
            )
            row = self._row(connection, run_id, owner_user_id)
            connection.commit()
            return self._snapshot(row)

    def interrupt(
        self,
        run_id: str,
        owner_user_id: str,
        *,
        payload: dict[str, Any],
        resume_ttl: timedelta = timedelta(days=7),
    ) -> GraphRunSnapshot:
        token = secrets.token_urlsafe(32)
        now = self._now()
        with self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = self._row(connection, run_id, owner_user_id)
            digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
            expires = now + resume_ttl
            connection.execute(
                "UPDATE graph_runs SET status = ?, resume_token_digest = ?, resume_expires_at = ?, updated_at = ? WHERE run_id = ? AND owner_user_id = ?",  # noqa: E501
                (
                    GraphRunStatus.WAITING_HUMAN.value,
                    digest,
                    self._iso(expires),
                    self._iso(now),
                    run_id,
                    owner_user_id,
                ),
            )
            self._event(
                connection,
                run_id,
                owner_user_id,
                "HUMAN_INTERRUPT",
                payload,
                idempotency_key=f"interrupt:{row['revision']}",
            )
            updated = self._row(connection, run_id, owner_user_id)
            connection.commit()
            snapshot = self._snapshot(updated)
            return GraphRunSnapshot(**{**snapshot.__dict__, "resume_token": token})

    def resume(
        self, run_id: str, owner_user_id: str, resume_token: str, expected_revision: int
    ) -> GraphRunSnapshot:
        now = self._now()
        with self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = self._row(connection, run_id, owner_user_id)
            if (
                row["status"] != GraphRunStatus.WAITING_HUMAN.value
                or row["revision"] != expected_revision
            ):
                raise GraphResumeRejected("resume revision or state is invalid")
            if row["resume_expires_at"] is None or self._parse(row["resume_expires_at"]) <= now:
                raise GraphResumeRejected("resume token expired")
            expected = row["resume_token_digest"] or ""
            if not secrets.compare_digest(
                expected, hashlib.sha256(resume_token.encode("utf-8")).hexdigest()
            ):
                raise GraphResumeRejected("resume token invalid")
            state = json.loads(row["state_json"])
            state["_resumed"] = True
            state_json = self._json(state)
            connection.execute(
                "UPDATE graph_runs SET status = ?, state_json = ?, resume_token_digest = NULL, resume_expires_at = NULL, updated_at = ? WHERE run_id = ? AND owner_user_id = ?",  # noqa: E501
                (GraphRunStatus.RUNNING.value, state_json, self._iso(now), run_id, owner_user_id),
            )
            self._event(
                connection,
                run_id,
                owner_user_id,
                "HUMAN_RESUMED",
                {"revision": expected_revision},
                idempotency_key=f"resume:{expected_revision}",
            )
            updated = self._row(connection, run_id, owner_user_id)
            connection.commit()
            return self._snapshot(updated)

    def mark_succeeded(self, run_id: str, owner_user_id: str) -> GraphRunSnapshot:
        with self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            self._row(connection, run_id, owner_user_id)
            now = self._now()
            connection.execute(
                "UPDATE graph_runs SET status = ?, updated_at = ? WHERE run_id = ? AND owner_user_id = ?",  # noqa: E501
                (GraphRunStatus.SUCCEEDED.value, self._iso(now), run_id, owner_user_id),
            )
            self._event(
                connection,
                run_id,
                owner_user_id,
                "RUN_SUCCEEDED",
                {},
                idempotency_key="run-succeeded",
            )
            row = self._row(connection, run_id, owner_user_id)
            connection.commit()
            return self._snapshot(row)

    def mark_failed(self, run_id: str, owner_user_id: str, *, reason: str) -> GraphRunSnapshot:
        if not reason.strip():
            raise ValueError("failure reason is required")
        with self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            self._row(connection, run_id, owner_user_id)
            now = self._now()
            connection.execute(
                "UPDATE graph_runs SET status = ?, terminal_reason = ?, updated_at = ? WHERE run_id = ? AND owner_user_id = ?",  # noqa: E501
                (
                    GraphRunStatus.FAILED.value,
                    reason,
                    self._iso(now),
                    run_id,
                    owner_user_id,
                ),
            )
            self._event(
                connection,
                run_id,
                owner_user_id,
                "RUN_FAILED",
                {"reason": reason},
                idempotency_key="run-failed",
            )
            row = self._row(connection, run_id, owner_user_id)
            connection.commit()
            return self._snapshot(row)

    def list_events(self, run_id: str, owner_user_id: str) -> list[GraphEvent]:
        with self._connect() as connection:
            self._row(connection, run_id, owner_user_id)
            rows = connection.execute(
                "SELECT * FROM graph_events WHERE run_id = ? AND owner_user_id = ? ORDER BY sequence",  # noqa: E501
                (run_id, owner_user_id),
            ).fetchall()
            return [
                GraphEvent(
                    row["run_id"],
                    row["sequence"],
                    row["event_type"],
                    json.loads(row["payload_json"]),
                    self._parse(row["created_at"]),
                )
                for row in rows
            ]
