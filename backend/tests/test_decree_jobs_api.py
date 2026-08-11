from __future__ import annotations

import sqlite3
from contextlib import closing
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import decree_jobs as decree_jobs_api
from app.api.auth import require_current_user
from app.decree_jobs.models import AcceptDecreeJob
from app.decree_jobs.storage import DecreeJobStore

NOW = datetime(2026, 8, 5, 12, 0, tzinfo=UTC)


def _accepted(store: DecreeJobStore) -> str:
    return store.accept(
        AcceptDecreeJob(
            owner_user_id="owner-a",
            idempotency_key="submission-1",
            request_hash="hash-1",
            draft_fingerprint="a" * 64,
            decree_text="请户部核查国库",
            approved_route_json='{"route_type":"single"}',
            deadline_at=NOW + timedelta(minutes=30),
        ),
        now=NOW,
    ).job.job_id


def _client(
    store: object,
    owner: str,
    *,
    raise_server_exceptions: bool = True,
) -> TestClient:
    app = FastAPI()
    app.include_router(decree_jobs_api.router)
    app.dependency_overrides[require_current_user] = lambda: SimpleNamespace(id=owner)
    app.dependency_overrides[decree_jobs_api.get_decree_job_store] = lambda: store
    return TestClient(app, raise_server_exceptions=raise_server_exceptions)


def _create_legacy_terminal_db(path) -> list[tuple[str, str, dict[str, str]]]:
    cases = [
        (
            "legacy-provider",
            "provider_timeout",
            {"code": "provider_failed", "stage": "execution", "category": "provider"},
            "FAILED",
            1,
        ),
        (
            "legacy-budget",
            "provider_budget_exceeded",
            {
                "code": "provider_budget_exceeded",
                "stage": "execution",
                "category": "budget",
            },
            "FAILED",
            1,
        ),
        (
            "legacy-deadline",
            "deadline_exceeded",
            {
                "code": "deadline_exceeded",
                "stage": "execution",
                "category": "deadline",
            },
            "FAILED",
            1,
        ),
        (
            "legacy-retry",
            "retry_exhausted",
            {
                "code": "retry_exhausted",
                "stage": "execution",
                "category": "retry",
            },
            "FAILED",
            2,
        ),
        (
            "legacy-private",
            "private-upstream-detail",
            {"code": "job_failed", "stage": "execution", "category": "internal"},
            "FAILED",
            1,
        ),
        (
            "legacy-cancel-queue",
            "cancelled",
            {"code": "cancelled", "stage": "queue", "category": "cancelled"},
            "CANCELLED",
            0,
        ),
        (
            "legacy-cancel-running",
            "cancelled",
            {
                "code": "cancelled",
                "stage": "execution",
                "category": "cancelled",
            },
            "CANCELLED",
            1,
        ),
    ]
    with closing(sqlite3.connect(path)) as connection:
        connection.executescript(
            """
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
            );
            """
        )
        for index, (job_id, error_code, _expected, state, attempt_count) in enumerate(
            cases, start=1
        ):
            connection.execute(
                """
                INSERT INTO decree_jobs (
                    job_id, owner_user_id, idempotency_key, request_hash,
                    draft_fingerprint, decree_text, approved_route_json, state,
                    attempt_count, error_code, deadline_at, created_at, updated_at
                ) VALUES (?, 'owner-a', ?, ?, ?, 'legacy decree', '{}', ?, ?, ?, ?, ?, ?)
                """,
                (
                    job_id,
                    f"legacy-key-{index}",
                    f"legacy-hash-{index}",
                    f"{index:064x}",
                    state,
                    attempt_count,
                    error_code,
                    (NOW + timedelta(minutes=30)).isoformat(),
                    NOW.isoformat(),
                    NOW.isoformat(),
                ),
            )
        connection.commit()
    return [(job_id, error_code, expected) for job_id, error_code, expected, _, _ in cases]


def test_get_job_returns_safe_owner_scoped_queued_projection(tmp_path) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job_id = _accepted(store)

    response = _client(store, "owner-a").get(f"/api/v1/decree-jobs/{job_id}")

    assert response.status_code == 200
    assert response.json() == {
        "job_id": job_id,
        "state": "QUEUED",
        "stage": "QUEUED",
        "attempt_count": 0,
        "provider_request_count": 0,
        "cancel_requested": False,
        "result": None,
        "error": None,
        "created_at": NOW.isoformat().replace("+00:00", "Z"),
        "updated_at": NOW.isoformat().replace("+00:00", "Z"),
    }
    assert "decree_text" not in response.text
    assert "approved_route" not in response.text


def test_get_job_returns_404_for_cross_owner_and_unknown_id(tmp_path) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job_id = _accepted(store)
    client = _client(store, "owner-b")

    cross_owner = client.get(f"/api/v1/decree-jobs/{job_id}")
    missing = client.get("/api/v1/decree-jobs/unknown")

    assert cross_owner.status_code == missing.status_code == 404
    assert cross_owner.json() == missing.json() == {
        "status": "error",
        "reason": "job_not_found",
    }


def test_owner_can_cancel_queued_job_and_cross_owner_cannot(tmp_path) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job_id = _accepted(store)

    denied = _client(store, "owner-b").post(
        f"/api/v1/decree-jobs/{job_id}/cancel"
    )
    cancelled = _client(store, "owner-a").post(
        f"/api/v1/decree-jobs/{job_id}/cancel"
    )

    assert denied.status_code == 404
    assert cancelled.status_code == 200
    assert cancelled.json()["state"] == "CANCELLED"
    assert cancelled.json()["error"] == {
        "code": "cancelled",
        "stage": "queue",
        "category": "cancelled",
    }


@pytest.mark.parametrize(
    ("terminal", "expected"),
    [
        (
            "cancelled",
            {"code": "cancelled", "stage": "queue", "category": "cancelled"},
        ),
        (
            "failed",
            {
                "code": "provider_failed",
                "stage": "execution",
                "category": "provider",
            },
        ),
    ],
)
def test_legacy_terminal_error_with_null_typed_metadata_remains_readable(
    tmp_path, terminal: str, expected: dict[str, str]
) -> None:
    path = tmp_path / f"legacy-{terminal}.sqlite3"
    store = DecreeJobStore(path)
    job_id = _accepted(store)
    if terminal == "cancelled":
        store.request_cancel(job_id, "owner-a", now=NOW)
    else:
        store.claim_next("worker-a", now=NOW)
        store.fail_attempt(
            job_id,
            "worker-a",
            error_code="provider_timeout",
            transient=False,
            retry_at=NOW,
            now=NOW,
        )

    with closing(sqlite3.connect(path)) as connection:
        columns = {
            row[1] for row in connection.execute("PRAGMA table_info(decree_jobs)")
        }
        if {"error_stage", "error_category"}.issubset(columns):
            connection.execute(
                "UPDATE decree_jobs SET error_stage = NULL, error_category = NULL "
                "WHERE job_id = ?",
                (job_id,),
            )
            connection.commit()

    response = _client(DecreeJobStore(path), "owner-a").get(
        f"/api/v1/decree-jobs/{job_id}"
    )

    assert response.status_code == 200
    assert response.json()["error"] == expected


def test_legacy_terminal_rows_are_backfilled_and_remain_stable_on_cancel(
    tmp_path,
) -> None:
    path = tmp_path / "legacy-terminal-jobs.sqlite3"
    cases = _create_legacy_terminal_db(path)
    store = DecreeJobStore(path)
    client = _client(store, "owner-a")

    with closing(sqlite3.connect(path)) as connection:
        migrated = {
            row[0]: (row[1], row[2])
            for row in connection.execute(
                "SELECT job_id, error_stage, error_category FROM decree_jobs"
            )
        }

    for job_id, raw_code, expected in cases:
        assert migrated[job_id] == (expected["stage"], expected["category"])
        fetched = client.get(f"/api/v1/decree-jobs/{job_id}")
        cancelled = client.post(f"/api/v1/decree-jobs/{job_id}/cancel")

        assert fetched.status_code == cancelled.status_code == 200
        assert fetched.json()["error"] == cancelled.json()["error"] == expected
        if raw_code != expected["code"]:
            assert raw_code not in fetched.text
            assert raw_code not in cancelled.text


def test_cancel_fails_closed_when_store_returns_malformed_terminal_error(
    tmp_path,
) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job_id = _accepted(store)
    cancelled = store.request_cancel(job_id, "owner-a", now=NOW)
    malformed = replace(cancelled, error_stage="private-worker-stage")

    fake_store = SimpleNamespace(request_cancel=lambda *_args, **_kwargs: malformed)
    response = _client(
        fake_store,
        "owner-a",
        raise_server_exceptions=False,
    ).post(f"/api/v1/decree-jobs/{job_id}/cancel")

    assert response.status_code == 503
    assert response.json() == {"status": "error", "reason": "job_unavailable"}
    assert "private-worker-stage" not in response.text


@pytest.mark.parametrize("source", ["persisted", "fake_store"])
@pytest.mark.parametrize(
    "raw_code",
    [r"provider_C:\secret\token", "provider_future_private_detail"],
)
def test_unknown_provider_prefixed_error_codes_are_not_publicly_classified(
    tmp_path, source: str, raw_code: str
) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job_id = _accepted(store)
    store.claim_next("worker-a", now=NOW)
    terminal = store.fail_attempt(
        job_id,
        "worker-a",
        error_code=raw_code,
        transient=False,
        retry_at=NOW,
        now=NOW,
    )
    exposed_store = store
    if source == "fake_store":
        exposed_store = SimpleNamespace(
            get_for_owner=lambda *_args, **_kwargs: terminal,
            request_cancel=lambda *_args, **_kwargs: terminal,
        )
    client = _client(exposed_store, "owner-a")

    fetched = client.get(f"/api/v1/decree-jobs/{job_id}")
    cancelled = client.post(f"/api/v1/decree-jobs/{job_id}/cancel")

    expected = {
        "code": "job_failed",
        "stage": "execution",
        "category": "internal",
    }
    assert fetched.status_code == cancelled.status_code == 200
    assert fetched.json()["error"] == cancelled.json()["error"] == expected
    assert raw_code not in fetched.text
    assert raw_code not in cancelled.text
    assert "provider_failed" not in fetched.text
    assert "provider_failed" not in cancelled.text


def test_success_result_is_returned_only_after_terminal_completion(tmp_path) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job_id = _accepted(store)
    store.claim_next("worker-a", now=NOW)
    store.checkpoint_result(
        job_id,
        "worker-a",
        result_json='{"status":"ok","artifacts":[]}',
        now=NOW,
    )
    running = _client(store, "owner-a").get(
        f"/api/v1/decree-jobs/{job_id}"
    )
    assert running.json()["state"] == "RUNNING"
    assert running.json()["stage"] == "RESULT_READY"
    assert running.json()["result"] is None

    store.begin_archiving(job_id, "worker-a", now=NOW)
    store.begin_publishing(
        job_id, "worker-a", reply_id="reply-1", now=NOW
    )
    store.complete(job_id, "worker-a", now=NOW)
    completed = _client(store, "owner-a").get(
        f"/api/v1/decree-jobs/{job_id}"
    )
    assert completed.json()["state"] == "SUCCEEDED"
    assert completed.json()["result"] == {"status": "ok", "artifacts": []}


def test_main_application_mounts_status_and_cancel_routes() -> None:
    from app.main import app

    paths = app.openapi()["paths"]
    assert "get" in paths["/api/v1/decree-jobs/{job_id}"]
    assert "post" in paths["/api/v1/decree-jobs/{job_id}/cancel"]
