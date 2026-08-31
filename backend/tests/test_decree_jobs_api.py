from __future__ import annotations

import hashlib
import json
import sqlite3
from contextlib import closing
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from threading import Event, Thread
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.agents.chancellor_draft.authority import ConsumedDraftAuthority
from app.agents.chancellor_draft.routing import (
    ApprovedDepartmentRoute,
    ApprovedRouteSnapshot,
)
from app.api import decree_jobs as decree_jobs_api
from app.api import decrees
from app.api.auth import require_current_user
from app.api.decree_jobs import get_decree_job_store
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


def _commitment() -> str:
    digest = "sha256:" + "a" * 64
    return json.dumps(
        {
            "aggregate_digest": digest,
            "candidate_digest": digest,
            "control_ref": digest,
            "decision_digest": digest,
            "evidence_snapshot_digest": digest,
            "schema_version": "claim-evidence-job-commitment.v1",
            "state": "SIDECAR_EXPECTED",
        },
        sort_keys=True,
        separators=(",", ":"),
    )


def _spliced_commitment() -> str:
    return json.dumps(
        {
            "aggregate_digest": "sha256:" + "1" * 64,
            "candidate_digest": "sha256:" + "2" * 64,
            "control_ref": "sha256:" + "3" * 64,
            "decision_digest": "sha256:" + "4" * 64,
            "evidence_snapshot_digest": "sha256:" + "5" * 64,
            "schema_version": "claim-evidence-job-commitment.v1",
            "state": "SIDECAR_EXPECTED",
        },
        sort_keys=True,
        separators=(",", ":"),
    )


def _decree_client(
    store: DecreeJobStore,
    *,
    owner: str = "owner-a",
    raise_server_exceptions: bool = True,
) -> TestClient:
    app = FastAPI()
    app.include_router(decrees.router)
    decrees.register_chancellor_exception_handlers(app)
    app.dependency_overrides[require_current_user] = lambda: SimpleNamespace(id=owner)
    app.dependency_overrides[get_decree_job_store] = lambda: store
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
        connection.execute(DecreeJobStore._EARLIEST_SCHEMA_SQL)
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
    assert (
        cross_owner.json()
        == missing.json()
        == {
            "status": "error",
            "reason": "job_not_found",
        }
    )


def test_owner_can_cancel_queued_job_and_cross_owner_cannot(tmp_path) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job_id = _accepted(store)

    denied = _client(store, "owner-b").post(f"/api/v1/decree-jobs/{job_id}/cancel")
    cancelled = _client(store, "owner-a").post(f"/api/v1/decree-jobs/{job_id}/cancel")

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
        columns = {row[1] for row in connection.execute("PRAGMA table_info(decree_jobs)")}
        if {"error_stage", "error_category"}.issubset(columns):
            connection.execute(
                "UPDATE decree_jobs SET error_stage = NULL, error_category = NULL WHERE job_id = ?",
                (job_id,),
            )
            connection.commit()

    response = _client(DecreeJobStore(path), "owner-a").get(f"/api/v1/decree-jobs/{job_id}")

    assert response.status_code == 200
    assert response.json()["error"] == expected


def test_supported_legacy_terminal_rows_are_backfilled_and_remain_stable(
    tmp_path,
) -> None:
    path = tmp_path / "legacy-terminal-jobs.sqlite3"
    cases = _create_legacy_terminal_db(path)
    store = DecreeJobStore(path)
    client = _client(store, "owner-a")

    with closing(sqlite3.connect(path)) as connection:
        migrated = {
            row[0]: (row[1], row[2], row[3])
            for row in connection.execute(
                "SELECT job_id, error_stage, error_category, "
                "claim_evidence_commitment_json FROM decree_jobs"
            )
        }

    for job_id, raw_code, expected in cases:
        assert migrated[job_id] == (expected["stage"], expected["category"], None)
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


@pytest.mark.parametrize(
    ("code", "stage", "category"),
    [
        ("format_unrecognized", "bureau_tool", "format"),
        ("tool_unavailable", "bureau_tool", "tool"),
        ("source_not_found", "bureau_tool", "data"),
        ("validation_failed", "validation", "validation"),
        ("model_failed", "model", "model"),
        ("artifact_failed", "artifact", "artifact"),
    ],
)
def test_stable_failure_contract_is_returned_without_private_details(
    tmp_path, code: str, stage: str, category: str
) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job_id = _accepted(store)
    store.claim_next("worker-a", now=NOW)
    store.fail_attempt(
        job_id,
        "worker-a",
        error_code=code,
        error_stage=stage,
        error_category=category,
        transient=False,
        retry_at=NOW,
        now=NOW,
    )

    response = _client(store, "owner-a").get(f"/api/v1/decree-jobs/{job_id}")

    assert response.status_code == 200
    assert response.json()["error"] == {
        "code": code,
        "stage": stage,
        "category": category,
    }
    assert "C:\\private" not in response.text


def test_public_failure_stage_is_derived_from_code_not_private_storage(tmp_path) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job_id = _accepted(store)
    store.claim_next("worker-a", now=NOW)
    store.fail_attempt(
        job_id,
        "worker-a",
        error_code="format_unrecognized",
        error_stage="model",
        error_category="private-category",
        transient=False,
        retry_at=NOW,
        now=NOW,
    )

    response = _client(store, "owner-a").get(f"/api/v1/decree-jobs/{job_id}")

    assert response.json()["error"] == {
        "code": "format_unrecognized",
        "stage": "bureau_tool",
        "category": "format",
    }


@pytest.mark.parametrize("raw", [_commitment(), "{", _spliced_commitment()])
def test_accept_decree_fails_closed_before_authority_for_committed_sidecar(
    tmp_path, monkeypatch, raw: str
) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    request = {
        "decree_text": "请户部核查国库",
        "draft_version": 1,
        "draft_fingerprint": hashlib.sha256(b"p10-b1-boundary").hexdigest(),
    }
    payload = decrees.ChancellorDecreeRequest.model_validate(request)
    request_hash = decrees._canonical_request_hash(payload, "owner-a")
    accepted = store.accept(
        AcceptDecreeJob(
            owner_user_id="owner-a",
            idempotency_key="p10-b1-boundary",
            request_hash=request_hash,
            draft_fingerprint=request["draft_fingerprint"],
            decree_text=request["decree_text"],
            approved_route_json='{"route_type":"single"}',
            deadline_at=NOW + timedelta(minutes=30),
        ),
        now=NOW,
    )
    with closing(sqlite3.connect(store.db_path)) as connection:
        connection.execute(
            "UPDATE decree_jobs SET claim_evidence_commitment_json = ? WHERE job_id = ?",
            (raw, accepted.job.job_id),
        )
        connection.commit()
        before = connection.execute(
            "SELECT * FROM decree_jobs WHERE job_id = ?", (accepted.job.job_id,)
        ).fetchone()

    events: list[str] = []
    for method in (
        "reserve_with_context",
        "commit_reservation",
        "release_reservation",
        "restore_if_absent",
    ):
        monkeypatch.setattr(
            decrees.draft_authority_registry,
            method,
            lambda *args, _method=method, **kwargs: events.append(_method),
        )

    response = _decree_client(store, raise_server_exceptions=False).post(
        "/api/v1/decrees/chancellor",
        headers={"Idempotency-Key": "p10-b1-boundary"},
        json=request,
    )

    with closing(sqlite3.connect(store.db_path)) as connection:
        after = connection.execute(
            "SELECT * FROM decree_jobs WHERE job_id = ?", (accepted.job.job_id,)
        ).fetchone()

    assert response.status_code == 503
    assert response.json() == {"status": "error", "reason": "job_unavailable"}
    assert "claim-evidence-job-commitment" not in response.text
    assert "sha256:" not in response.text
    assert events == []
    assert before == after


@pytest.mark.parametrize("raw", [_commitment(), "{", _spliced_commitment()])
def test_accept_decree_detects_same_draft_sidecar_before_new_transport_key_authority(
    tmp_path, monkeypatch, raw: str
) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    request = {
        "decree_text": "请户部核查国库",
        "draft_version": 1,
        "draft_fingerprint": hashlib.sha256(b"p10-b1-draft-boundary").hexdigest(),
    }
    payload = decrees.ChancellorDecreeRequest.model_validate(request)
    accepted = store.accept(
        AcceptDecreeJob(
            owner_user_id="owner-a",
            idempotency_key="original-key",
            request_hash=decrees._canonical_request_hash(payload, "owner-a"),
            draft_fingerprint=request["draft_fingerprint"],
            decree_text=request["decree_text"],
            approved_route_json='{"route_type":"single"}',
            deadline_at=NOW + timedelta(minutes=30),
        ),
        now=NOW,
    )
    with closing(sqlite3.connect(store.db_path)) as connection:
        connection.execute(
            "UPDATE decree_jobs SET claim_evidence_commitment_json = ? WHERE job_id = ?",
            (raw, accepted.job.job_id),
        )
        connection.commit()
        before = connection.execute(
            "SELECT * FROM decree_jobs WHERE job_id = ?", (accepted.job.job_id,)
        ).fetchone()

    events: list[str] = []
    for method in (
        "reserve_with_context",
        "commit_reservation",
        "release_reservation",
        "restore_if_absent",
    ):
        monkeypatch.setattr(
            decrees.draft_authority_registry,
            method,
            lambda *args, _method=method, **kwargs: events.append(_method),
        )

    response = _decree_client(store, raise_server_exceptions=False).post(
        "/api/v1/decrees/chancellor",
        headers={"Idempotency-Key": "different-key"},
        json=request,
    )

    with closing(sqlite3.connect(store.db_path)) as connection:
        after = connection.execute(
            "SELECT * FROM decree_jobs WHERE job_id = ?", (accepted.job.job_id,)
        ).fetchone()

    assert response.status_code == 503
    assert response.json() == {"status": "error", "reason": "job_unavailable"}
    assert events == []
    assert before == after


@pytest.mark.parametrize("raw", [_commitment(), "{", _spliced_commitment()])
def test_accept_decree_preserves_conflict_priority_and_cross_owner_privacy(
    tmp_path, monkeypatch, raw: str
) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    request = {
        "decree_text": "请户部核查国库",
        "draft_version": 1,
        "draft_fingerprint": hashlib.sha256(b"p10-b1-priority").hexdigest(),
    }
    payload = decrees.ChancellorDecreeRequest.model_validate(request)
    accepted = store.accept(
        AcceptDecreeJob(
            owner_user_id="owner-a",
            idempotency_key="priority-key",
            request_hash=decrees._canonical_request_hash(payload, "owner-a"),
            draft_fingerprint=request["draft_fingerprint"],
            decree_text=request["decree_text"],
            approved_route_json='{"route_type":"single"}',
            deadline_at=NOW + timedelta(minutes=30),
        ),
        now=NOW,
    )
    with closing(sqlite3.connect(store.db_path)) as connection:
        connection.execute(
            "UPDATE decree_jobs SET claim_evidence_commitment_json = ? WHERE job_id = ?",
            (raw, accepted.job.job_id),
        )
        connection.commit()

    events: list[str] = []
    monkeypatch.setattr(
        decrees.draft_authority_registry,
        "reserve_with_context",
        lambda **_kwargs: events.append("reserve"),
    )

    conflict = _decree_client(store, raise_server_exceptions=False).post(
        "/api/v1/decrees/chancellor",
        headers={"Idempotency-Key": "priority-key"},
        json={**request, "decree_text": "请户部核查另一份国库"},
    )
    cross_owner = _decree_client(store, owner="owner-b", raise_server_exceptions=False).post(
        "/api/v1/decrees/chancellor",
        headers={"Idempotency-Key": "priority-key"},
        json=request,
    )

    assert conflict.status_code == 409
    assert conflict.json()["reason"] == "idempotency_conflict"
    assert cross_owner.status_code == 409
    assert cross_owner.json()["reason"] == "draft_not_current"
    assert "job_unavailable" not in cross_owner.text
    assert events == ["reserve"]


@pytest.mark.parametrize("release_mode", ["true", "false", "raise"])
def test_accept_decree_observes_late_sidecar_and_release_cannot_change_fixed_503(
    tmp_path, monkeypatch, release_mode: str
) -> None:
    store = DecreeJobStore(tmp_path / "late-sidecar.sqlite3")
    request = {
        "decree_text": "请户部核查国库",
        "draft_version": 1,
        "draft_fingerprint": hashlib.sha256(b"p10-b1-late-sidecar").hexdigest(),
    }
    payload = decrees.ChancellorDecreeRequest.model_validate(request)
    store.accept(
        AcceptDecreeJob(
            owner_user_id="owner-a",
            idempotency_key="original-key",
            request_hash=decrees._canonical_request_hash(payload, "owner-a"),
            draft_fingerprint=request["draft_fingerprint"],
            decree_text=request["decree_text"],
            approved_route_json='{"route_type":"single"}',
            deadline_at=NOW + timedelta(minutes=30),
            acceptance_committed=False,
        ),
        now=NOW,
    )
    writer_started = Event()
    writer_finished = Event()

    def late_writer() -> None:
        with closing(sqlite3.connect(store.db_path)) as connection:
            connection.execute("PRAGMA busy_timeout = 5000")
            writer_started.set()
            connection.execute(
                "UPDATE decree_jobs SET claim_evidence_commitment_json = ? "
                "WHERE owner_user_id = ? AND draft_fingerprint = ?",
                (_spliced_commitment(), "owner-a", request["draft_fingerprint"]),
            )
            connection.commit()
        writer_finished.set()

    events: list[str] = []
    route = ApprovedRouteSnapshot(
        departments=(ApprovedDepartmentRoute(department="户部", required_bureaus=("会计司",)),)
    )
    writer: Thread | None = None

    def reserve(**_kwargs) -> ConsumedDraftAuthority:
        nonlocal writer
        events.append("reserve")
        writer = Thread(target=late_writer)
        writer.start()
        assert writer_started.wait(timeout=1)
        assert writer_finished.wait(timeout=1)
        return ConsumedDraftAuthority(route, None)

    def release(**_kwargs) -> bool:
        events.append("release")
        if release_mode == "raise":
            raise RuntimeError("release_failed")
        return release_mode == "true"

    monkeypatch.setattr(decrees.draft_authority_registry, "reserve_with_context", reserve)
    monkeypatch.setattr(
        decrees.draft_authority_registry,
        "release_reservation",
        release,
    )
    monkeypatch.setattr(
        decrees.draft_authority_registry,
        "commit_reservation",
        lambda **_kwargs: events.append("commit") or True,
    )

    response = _decree_client(store, raise_server_exceptions=False).post(
        "/api/v1/decrees/chancellor",
        headers={"Idempotency-Key": "different-key"},
        json=request,
    )

    assert response.status_code == 503
    assert response.json() == {"status": "error", "reason": "job_unavailable"}
    assert events == ["reserve", "release"]
    assert writer is not None
    writer.join(timeout=2)
    assert writer_finished.is_set()
    with closing(sqlite3.connect(store.db_path)) as connection:
        assert connection.execute(
            "SELECT claim_evidence_commitment_json FROM decree_jobs "
            "WHERE owner_user_id = ? AND draft_fingerprint = ?",
            ("owner-a", request["draft_fingerprint"]),
        ).fetchone() == (_spliced_commitment(),)


def test_accept_decree_preserves_pending_intent_when_authority_marker_fails_before_write(
    tmp_path, monkeypatch
) -> None:
    store = DecreeJobStore(tmp_path / "pre-marker-failure.sqlite3")
    request = {
        "decree_text": "请户部核查国库",
        "draft_version": 1,
        "draft_fingerprint": hashlib.sha256(b"p10-b1-pre-marker-failure").hexdigest(),
    }
    route = ApprovedRouteSnapshot(
        departments=(ApprovedDepartmentRoute(department="户部", required_bureaus=("会计司",)),)
    )
    events: list[str] = []
    monkeypatch.setattr(
        decrees.draft_authority_registry,
        "reserve_with_context",
        lambda **_kwargs: events.append("reserve") or ConsumedDraftAuthority(route, None),
    )
    monkeypatch.setattr(
        decrees.draft_authority_registry,
        "commit_reservation",
        lambda **_kwargs: events.append("commit") or True,
    )
    monkeypatch.setattr(
        decrees.draft_authority_registry,
        "release_reservation",
        lambda **_kwargs: events.append("release") or True,
    )
    monkeypatch.setattr(
        store,
        "mark_authority_committed",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(OSError("marker_write_failed")),
    )

    response = _decree_client(store, raise_server_exceptions=False).post(
        "/api/v1/decrees/chancellor",
        headers={"Idempotency-Key": "pre-marker-failure"},
        json=request,
    )

    assert response.status_code == 502
    assert events == ["reserve", "commit"]
    with closing(sqlite3.connect(store.db_path)) as connection:
        pending = connection.execute(
            "SELECT authority_committed, acceptance_committed, "
            "claim_evidence_commitment_json FROM decree_jobs"
        ).fetchone()
        mapping_count = connection.execute(
            "SELECT COUNT(*) FROM decree_job_idempotency_keys"
        ).fetchone()[0]
    assert pending == (0, 0, None)
    assert mapping_count == 1
    assert store.claim_next("worker-a", now=NOW) is None


@pytest.mark.parametrize("boundary", ["marker", "activation"])
def test_accept_decree_late_commitment_boundary_is_fixed_503_without_cleanup(
    tmp_path, monkeypatch, boundary: str
) -> None:
    store = DecreeJobStore(tmp_path / f"late-{boundary}-commitment.sqlite3")
    request = {
        "decree_text": "请户部核查国库",
        "draft_version": 1,
        "draft_fingerprint": hashlib.sha256(f"p10-b1-{boundary}".encode()).hexdigest(),
    }
    route = ApprovedRouteSnapshot(
        departments=(ApprovedDepartmentRoute(department="户部", required_bureaus=("会计司",)),)
    )
    events: list[str] = []
    monkeypatch.setattr(
        decrees.draft_authority_registry,
        "reserve_with_context",
        lambda **_kwargs: events.append("reserve") or ConsumedDraftAuthority(route, None),
    )
    monkeypatch.setattr(
        decrees.draft_authority_registry,
        "commit_reservation",
        lambda **_kwargs: events.append("commit") or True,
    )
    monkeypatch.setattr(
        decrees.draft_authority_registry,
        "release_reservation",
        lambda **_kwargs: events.append("release") or True,
    )
    monkeypatch.setattr(
        decrees.draft_authority_registry,
        "restore_if_absent",
        lambda **_kwargs: events.append("restore") or True,
    )
    original = (
        store.mark_authority_committed
        if boundary == "marker"
        else store.activate_acceptance
    )

    def inject_then_call(job_id: str, owner_user_id: str):
        with closing(sqlite3.connect(store.db_path)) as connection:
            connection.execute(
                "UPDATE decree_jobs SET claim_evidence_commitment_json = ? WHERE job_id = ?",
                (_spliced_commitment(), job_id),
            )
            connection.commit()
        return original(job_id, owner_user_id)

    monkeypatch.setattr(
        store,
        "mark_authority_committed" if boundary == "marker" else "activate_acceptance",
        inject_then_call,
    )

    response = _decree_client(store, raise_server_exceptions=False).post(
        "/api/v1/decrees/chancellor",
        headers={"Idempotency-Key": f"late-{boundary}"},
        json=request,
    )

    assert response.status_code == 503
    assert response.json() == {"status": "error", "reason": "job_unavailable"}
    assert events == ["reserve", "commit"]
    expected_authority = 0 if boundary == "marker" else 1
    with closing(sqlite3.connect(store.db_path)) as connection:
        row = connection.execute(
            "SELECT authority_committed, acceptance_committed, "
            "claim_evidence_commitment_json FROM decree_jobs"
        ).fetchone()
    assert row == (expected_authority, 0, _spliced_commitment())
    assert store.claim_next("worker-a", now=NOW) is None


@pytest.mark.parametrize("raw", [_commitment(), "{", "null", _spliced_commitment()])
def test_owner_job_api_hides_and_never_mutates_future_commitment(tmp_path, raw: str) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job_id = _accepted(store)
    with closing(sqlite3.connect(store.db_path)) as connection:
        connection.execute(
            "UPDATE decree_jobs SET claim_evidence_commitment_json = ? WHERE job_id = ?",
            (raw, job_id),
        )
        connection.commit()
        before_jobs = connection.execute("SELECT * FROM decree_jobs ORDER BY job_id").fetchall()
        before_keys = connection.execute(
            "SELECT * FROM decree_job_idempotency_keys ORDER BY owner_user_id, idempotency_key"
        ).fetchall()

    owner = _client(store, "owner-a", raise_server_exceptions=False)
    denied = _client(store, "owner-b", raise_server_exceptions=False)
    fetched = owner.get(f"/api/v1/decree-jobs/{job_id}")
    cancelled = owner.post(f"/api/v1/decree-jobs/{job_id}/cancel")
    cross_owner = denied.get(f"/api/v1/decree-jobs/{job_id}")
    missing = denied.get("/api/v1/decree-jobs/unknown")

    with closing(sqlite3.connect(store.db_path)) as connection:
        after_jobs = connection.execute("SELECT * FROM decree_jobs ORDER BY job_id").fetchall()
        after_keys = connection.execute(
            "SELECT * FROM decree_job_idempotency_keys ORDER BY owner_user_id, idempotency_key"
        ).fetchall()

    assert fetched.status_code == cancelled.status_code == 503
    assert (
        fetched.json()
        == cancelled.json()
        == {
            "status": "error",
            "reason": "job_unavailable",
        }
    )
    assert "claim-evidence-job-commitment" not in fetched.text
    assert "claim-evidence-job-commitment" not in cancelled.text
    assert cross_owner.status_code == missing.status_code == 404
    assert cross_owner.content == missing.content
    assert (before_jobs, before_keys) == (after_jobs, after_keys)


def test_legacy_accounting_source_failure_has_canonical_public_mapping(tmp_path) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job_id = _accepted(store)
    store.claim_next("worker-a", now=NOW)
    store.fail_attempt(
        job_id,
        "worker-a",
        error_code="accounting_source_unavailable",
        error_stage="private-stage",
        error_category="private-category",
        transient=False,
        retry_at=NOW,
        now=NOW,
    )

    response = _client(store, "owner-a").get(f"/api/v1/decree-jobs/{job_id}")

    assert response.json()["error"] == {
        "code": "accounting_source_unavailable",
        "stage": "bureau_tool",
        "category": "data",
    }


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
    running = _client(store, "owner-a").get(f"/api/v1/decree-jobs/{job_id}")
    assert running.json()["state"] == "RUNNING"
    assert running.json()["stage"] == "RESULT_READY"
    assert running.json()["result"] is None

    store.begin_archiving(job_id, "worker-a", now=NOW)
    store.begin_publishing(job_id, "worker-a", reply_id="reply-1", now=NOW)
    store.complete(job_id, "worker-a", now=NOW)
    completed = _client(store, "owner-a").get(f"/api/v1/decree-jobs/{job_id}")
    assert completed.json()["state"] == "SUCCEEDED"
    assert completed.json()["result"] == {"status": "ok", "artifacts": []}


def test_main_application_mounts_status_and_cancel_routes() -> None:
    from app.main import app

    paths = app.openapi()["paths"]
    assert "get" in paths["/api/v1/decree-jobs/{job_id}"]
    assert "post" in paths["/api/v1/decree-jobs/{job_id}/cancel"]
