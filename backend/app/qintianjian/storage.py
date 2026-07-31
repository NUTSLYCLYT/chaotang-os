from __future__ import annotations

import hashlib
import json
import sqlite3
import uuid
from datetime import UTC, datetime
from pathlib import Path

from app.qintianjian.models import Forecast, ForecastReview, PendingTrigger

_DEFAULT_DB_PATH = Path(__file__).resolve().parents[2] / "data" / "qintianjian.sqlite3"


class IdempotencyConflictError(RuntimeError):
    pass


class ForecastClaimedError(RuntimeError):
    pass


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _connect() -> sqlite3.Connection:
    _DEFAULT_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(_DEFAULT_DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute(
        """CREATE TABLE IF NOT EXISTS forecasts (
        id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, idempotency_key TEXT NOT NULL,
        request_hash TEXT NOT NULL, state TEXT NOT NULL,
        payload_json TEXT NOT NULL, created_at TEXT NOT NULL,
        UNIQUE(owner_user_id, idempotency_key))"""
    )
    conn.execute(
        """CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY, forecast_id TEXT NOT NULL, owner_user_id TEXT NOT NULL,
        trigger_id TEXT NOT NULL, decision TEXT NOT NULL, observation TEXT NOT NULL,
        judgment_invalidated INTEGER NOT NULL, created_at TEXT NOT NULL)"""
    )
    forecast_columns = {
        row["name"] for row in conn.execute("PRAGMA table_info(forecasts)").fetchall()
    }
    if "request_hash" not in forecast_columns:
        conn.execute("ALTER TABLE forecasts ADD COLUMN request_hash TEXT NOT NULL DEFAULT ''")
    if "state" not in forecast_columns:
        conn.execute("ALTER TABLE forecasts ADD COLUMN state TEXT NOT NULL DEFAULT 'COMPLETED'")
    review_columns = {row["name"] for row in conn.execute("PRAGMA table_info(reviews)").fetchall()}
    if "trigger_id" not in review_columns:
        conn.execute("ALTER TABLE reviews ADD COLUMN trigger_id TEXT NOT NULL DEFAULT ''")
    if "observation" not in review_columns:
        conn.execute("ALTER TABLE reviews ADD COLUMN observation TEXT NOT NULL DEFAULT ''")
    if "judgment_invalidated" not in review_columns:
        conn.execute(
            "ALTER TABLE reviews ADD COLUMN judgment_invalidated INTEGER NOT NULL DEFAULT 0"
        )
    return conn


def _reviews(conn: sqlite3.Connection, forecast_id: str, owner: str) -> list[dict]:
    return [
        dict(row)
        for row in conn.execute(
            "SELECT id, forecast_id, trigger_id, decision, observation, "
            "judgment_invalidated, created_at FROM reviews "
            "WHERE forecast_id=? AND owner_user_id=? ORDER BY created_at,id",
            (forecast_id, owner),
        )
    ]


def _forecast(conn: sqlite3.Connection, row: sqlite3.Row, owner: str) -> Forecast:
    value = json.loads(row["payload_json"])
    reviews = _reviews(conn, row["id"], owner)
    reviewed_trigger_ids = {item["trigger_id"] for item in reviews}
    for item in value["triggers"]:
        if item["id"] in reviewed_trigger_ids:
            item["status"] = "REVIEWED"
    value["reviews"] = reviews
    return Forecast.model_validate(value)


def canonical_request_hash(value: dict) -> str:
    canonical = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()


def claim(owner: str, key: str, request_hash: str) -> Forecast | None:
    conn = _connect()
    try:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute(
            "SELECT * FROM forecasts WHERE owner_user_id=? AND idempotency_key=?",
            (owner, key),
        ).fetchone()
        if row:
            if row["request_hash"] != request_hash:
                raise IdempotencyConflictError
            if row["state"] == "CLAIMED":
                raise ForecastClaimedError
            return _forecast(conn, row, owner)
        conn.execute(
            "INSERT INTO forecasts "
            "(id,owner_user_id,idempotency_key,request_hash,state,payload_json,created_at) "
            "VALUES (?,?,?,?,?,?,?)",
            (str(uuid.uuid4()), owner, key, request_hash, "CLAIMED", "{}", _now()),
        )
        conn.commit()
        return None
    finally:
        conn.close()


def finalize(owner: str, key: str, request_hash: str, forecast: Forecast) -> Forecast:
    conn = _connect()
    try:
        conn.execute(
            "UPDATE forecasts SET id=?,state='COMPLETED',payload_json=?,created_at=? "
            "WHERE owner_user_id=? AND idempotency_key=? AND request_hash=? AND state='CLAIMED'",
            (
                forecast.id,
                json.dumps(forecast.model_dump(exclude={"reviews"}), ensure_ascii=False),
                forecast.created_at,
                owner,
                key,
                request_hash,
            ),
        )
        conn.commit()
        return forecast
    finally:
        conn.close()


def release_claim(owner: str, key: str, request_hash: str) -> None:
    conn = _connect()
    try:
        conn.execute(
            "DELETE FROM forecasts WHERE owner_user_id=? AND idempotency_key=? "
            "AND request_hash=? AND state='CLAIMED'",
            (owner, key, request_hash),
        )
        conn.commit()
    finally:
        conn.close()


def list_forecasts(owner: str) -> list[Forecast]:
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT * FROM forecasts WHERE owner_user_id=? AND state='COMPLETED' "
            "ORDER BY created_at DESC,id",
            (owner,),
        ).fetchall()
        return [_forecast(conn, row, owner) for row in rows]
    finally:
        conn.close()


def get_forecast(owner: str, forecast_id: str) -> Forecast | None:
    conn = _connect()
    try:
        row = conn.execute(
            "SELECT * FROM forecasts WHERE id=? AND owner_user_id=? AND state='COMPLETED'",
            (forecast_id, owner),
        ).fetchone()
        return _forecast(conn, row, owner) if row else None
    finally:
        conn.close()


def append_review(
    owner: str,
    forecast_id: str,
    trigger_id: str,
    decision: str,
    observation: str,
    judgment_invalidated: bool,
) -> ForecastReview | None:
    conn = _connect()
    try:
        exists = conn.execute(
            "SELECT 1 FROM forecasts WHERE id=? AND owner_user_id=?",
            (forecast_id, owner),
        ).fetchone()
        if not exists:
            return None
        forecast_row = conn.execute(
            "SELECT * FROM forecasts WHERE id=? AND owner_user_id=? AND state='COMPLETED'",
            (forecast_id, owner),
        ).fetchone()
        forecast = _forecast(conn, forecast_row, owner)
        if trigger_id not in {item.id for item in forecast.triggers}:
            return None
        review = ForecastReview(
            id=str(uuid.uuid4()),
            forecast_id=forecast_id,
            trigger_id=trigger_id,
            decision=decision,
            observation=observation,
            judgment_invalidated=judgment_invalidated,
            created_at=_now(),
        )
        conn.execute(
            "INSERT INTO reviews "
            "(id,forecast_id,owner_user_id,trigger_id,decision,observation,"
            "judgment_invalidated,created_at) VALUES (?,?,?,?,?,?,?,?)",
            (
                review.id,
                forecast_id,
                owner,
                trigger_id,
                decision,
                observation,
                int(judgment_invalidated),
                review.created_at,
            ),
        )
        conn.commit()
        return review
    finally:
        conn.close()


def pending_triggers(owner: str) -> list[PendingTrigger]:
    now = datetime.now(UTC)
    result: list[PendingTrigger] = []
    for forecast in list_forecasts(owner):
        reviewed_trigger_ids = {item.trigger_id for item in forecast.reviews}
        for trigger in forecast.triggers:
            if trigger.id not in reviewed_trigger_ids:
                result.append(
                    PendingTrigger(
                        **trigger.model_dump(),
                        forecast_id=forecast.id,
                        forecast_summary=forecast.judgment,
                        is_due=datetime.fromisoformat(trigger.review_at) <= now,
                        subject=forecast.subject,
                        context_ref={
                            "kind": forecast.subject.kind,
                            "id": forecast.subject.id,
                        },
                    )
                )
    return result
