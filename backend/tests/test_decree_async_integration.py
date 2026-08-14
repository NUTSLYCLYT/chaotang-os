from __future__ import annotations

import hashlib
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.agents.chancellor_draft.authority import ConsumedDraftAuthority
from app.agents.chancellor_draft.routing import (
    ApprovedDepartmentRoute,
    ApprovedRouteSnapshot,
)
from app.api import decrees
from app.api.auth import require_current_user
from app.api.decree_jobs import get_decree_job_store
from app.decree_jobs import AcceptDecreeJob, DecreeJobState, DecreeJobStore


def _route() -> ApprovedRouteSnapshot:
    return ApprovedRouteSnapshot(
        departments=(
            ApprovedDepartmentRoute(
                department="户部", required_bureaus=("预算司",)
            ),
        )
    )


def _app(store: DecreeJobStore, *, owner: str = "owner-a") -> FastAPI:
    app = FastAPI()
    app.include_router(decrees.router)
    decrees.register_chancellor_exception_handlers(app)
    app.dependency_overrides[require_current_user] = lambda: SimpleNamespace(id=owner)
    app.dependency_overrides[get_decree_job_store] = lambda: store
    return app


def _request(seed: bytes = b"draft", *, text: str = "请户部核查国库") -> dict:
    return {
        "decree_text": text,
        "draft_version": 1,
        "draft_fingerprint": hashlib.sha256(seed).hexdigest(),
    }


def test_post_accepts_persisted_job_without_execution_side_effects(
    tmp_path, monkeypatch
) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    events: list[str] = []
    authority = ConsumedDraftAuthority(_route(), None)
    monkeypatch.setattr(
        decrees.draft_authority_registry,
        "reserve_with_context",
        lambda **_kwargs: events.append("reserve") or authority,
    )
    monkeypatch.setattr(
        decrees.draft_authority_registry,
        "commit_reservation",
        lambda **_kwargs: events.append("commit") or True,
    )
    monkeypatch.setattr(
        decrees,
        "get_execution_chancellor_agent",
        lambda **_kwargs: (_ for _ in ()).throw(AssertionError("agent constructed")),
    )
    monkeypatch.setattr(
        decrees,
        "archive_chancellor_decree",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("archived")),
    )
    client = TestClient(_app(store))

    response = client.post(
        "/api/v1/decrees/chancellor",
        headers={"Idempotency-Key": "submission-1"},
        json=_request(),
    )

    assert response.status_code == 202
    body = response.json()
    assert response.headers["location"] == f"/api/v1/decree-jobs/{body['job_id']}"
    assert response.headers["retry-after"] == "1"
    assert body["state"] == "QUEUED"
    assert body["replayed"] is False
    assert events == ["reserve", "commit"]
    assert store.count() == 1


def test_post_replays_before_requiring_already_consumed_draft_authority(
    tmp_path, monkeypatch
) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    authority = ConsumedDraftAuthority(_route(), None)
    monkeypatch.setattr(
        decrees.draft_authority_registry,
        "reserve_with_context",
        lambda **_kwargs: authority,
    )
    monkeypatch.setattr(
        decrees.draft_authority_registry,
        "commit_reservation",
        lambda **_kwargs: True,
    )
    client = TestClient(_app(store))
    request = _request(b"draft-replay")
    headers = {"Idempotency-Key": "lost-response"}

    first = client.post("/api/v1/decrees/chancellor", headers=headers, json=request)
    monkeypatch.setattr(
        decrees.draft_authority_registry,
        "reserve_with_context",
        lambda **_kwargs: (_ for _ in ()).throw(AssertionError("authority re-read")),
    )
    replay = client.post("/api/v1/decrees/chancellor", headers=headers, json=request)

    assert first.status_code == replay.status_code == 202
    assert replay.json()["job_id"] == first.json()["job_id"]
    assert replay.json()["replayed"] is True
    assert store.count() == 1


def test_post_recovers_crash_after_authority_commit_without_new_authority(
    tmp_path, monkeypatch
) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    authority = ConsumedDraftAuthority(_route(), None)
    accepted_ids: list[str] = []
    original_accept = store.accept
    original_activate = store.activate_acceptance

    def record_accept(*args, **kwargs):
        accepted = original_accept(*args, **kwargs)
        accepted_ids.append(accepted.job.job_id)
        return accepted

    monkeypatch.setattr(store, "accept", record_accept)
    monkeypatch.setattr(
        decrees.draft_authority_registry,
        "reserve_with_context",
        lambda **_kwargs: authority,
    )
    monkeypatch.setattr(
        decrees.draft_authority_registry,
        "commit_reservation",
        lambda **_kwargs: True,
    )
    monkeypatch.setattr(
        store,
        "activate_acceptance",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(SystemExit("crash")),
    )
    request = _request(b"crash-recovery")
    headers = {"Idempotency-Key": "crashed-response"}

    with pytest.raises(SystemExit, match="crash"):
        decrees.accept_decree(
            decrees.ChancellorDecreeRequest.model_validate(request),
            SimpleNamespace(id="owner-a"),
            lambda: store,
            headers["Idempotency-Key"],
        )
    assert store.count() == 1
    assert accepted_ids

    monkeypatch.setattr(store, "activate_acceptance", original_activate)
    monkeypatch.setattr(
        decrees.draft_authority_registry,
        "reserve_with_context",
        lambda **_kwargs: (_ for _ in ()).throw(AssertionError("authority re-read")),
    )
    # Recovery crosses a fresh HTTP client boundary, matching a real process
    # restart while retaining only durable storage and committed authority.
    client = TestClient(_app(store))
    replay = client.post("/api/v1/decrees/chancellor", headers=headers, json=request)

    assert replay.status_code == 202
    assert replay.json()["job_id"] == accepted_ids[0]
    assert replay.json()["replayed"] is True
    assert store.count() == 1
    assert store.claim_next("worker-a") is not None


def test_precommit_crash_never_recovers_or_queues_uncommitted_authority(
    tmp_path, monkeypatch
) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    authority = ConsumedDraftAuthority(_route(), None)
    monkeypatch.setattr(
        decrees.draft_authority_registry,
        "reserve_with_context",
        lambda **_kwargs: authority,
    )
    monkeypatch.setattr(
        decrees.draft_authority_registry,
        "commit_reservation",
        lambda **_kwargs: (_ for _ in ()).throw(SystemExit("precommit crash")),
    )
    request = _request(b"precommit-crash")
    headers = {"Idempotency-Key": "precommit-crash"}

    with pytest.raises(SystemExit, match="precommit crash"):
        decrees.accept_decree(
            decrees.ChancellorDecreeRequest.model_validate(request),
            SimpleNamespace(id="owner-a"),
            lambda: store,
            headers["Idempotency-Key"],
        )

    assert store.count() == 1
    assert store.claim_next("worker-a") is None
    assert (
        store.lookup_replay(
            owner_user_id="owner-a",
            idempotency_key=headers["Idempotency-Key"],
            request_hash=decrees._canonical_request_hash(
                decrees.ChancellorDecreeRequest.model_validate(request),
                "owner-a",
            ),
        )
        is None
    )

    # A real process restart loses the process-local draft registry.  The
    # durable row alone must not be enough to recreate authority.
    monkeypatch.setattr(
        decrees.draft_authority_registry,
        "reserve_with_context",
        lambda **_kwargs: None,
    )
    replay = TestClient(_app(store)).post(
        "/api/v1/decrees/chancellor", headers=headers, json=request
    )

    assert replay.status_code == 409
    assert replay.json()["reason"] == "draft_not_current"
    assert store.claim_next("worker-a") is None


def test_postcommit_marker_error_preserves_recoverable_acceptance(
    tmp_path, monkeypatch
) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    authority = ConsumedDraftAuthority(_route(), None)
    original_mark = store.mark_authority_committed

    def commit_then_fail(*args, **kwargs):
        original_mark(*args, **kwargs)
        raise OSError("connection dropped after authority marker commit")

    monkeypatch.setattr(
        decrees.draft_authority_registry,
        "reserve_with_context",
        lambda **_kwargs: authority,
    )
    monkeypatch.setattr(
        decrees.draft_authority_registry,
        "commit_reservation",
        lambda **_kwargs: True,
    )
    monkeypatch.setattr(store, "mark_authority_committed", commit_then_fail)
    request = _request(b"postcommit-marker")
    headers = {"Idempotency-Key": "postcommit-marker"}

    response = TestClient(_app(store)).post(
        "/api/v1/decrees/chancellor", headers=headers, json=request
    )

    assert response.status_code == 502
    assert store.count() == 1
    assert store.claim_next("worker-a") is None

    monkeypatch.setattr(store, "mark_authority_committed", original_mark)
    monkeypatch.setattr(
        decrees.draft_authority_registry,
        "reserve_with_context",
        lambda **_kwargs: (_ for _ in ()).throw(AssertionError("authority re-read")),
    )
    replay = TestClient(_app(store)).post(
        "/api/v1/decrees/chancellor", headers=headers, json=request
    )

    assert replay.status_code == 202
    assert replay.json()["replayed"] is True
    assert store.claim_next("worker-a") is not None


def test_pending_recovery_rejects_changed_payload_and_is_owner_scoped(
    tmp_path, monkeypatch
) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    authority = ConsumedDraftAuthority(_route(), None)
    monkeypatch.setattr(
        decrees.draft_authority_registry,
        "reserve_with_context",
        lambda **_kwargs: authority,
    )
    monkeypatch.setattr(
        decrees.draft_authority_registry,
        "commit_reservation",
        lambda **_kwargs: True,
    )
    monkeypatch.setattr(
        store,
        "activate_acceptance",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(SystemExit("crash")),
    )
    headers = {"Idempotency-Key": "owner-key"}
    with pytest.raises(SystemExit):
        decrees.accept_decree(
            decrees.ChancellorDecreeRequest.model_validate(_request(b"owner-a")),
            SimpleNamespace(id="owner-a"),
            lambda: store,
            headers["Idempotency-Key"],
        )

    client_a = TestClient(_app(store, owner="owner-a"))
    wrong = client_a.post(
        "/api/v1/decrees/chancellor",
        headers=headers,
        json=_request(b"changed", text="changed payload"),
    )
    assert wrong.status_code == 409
    assert wrong.json()["reason"] == "idempotency_conflict"

    monkeypatch.setattr(
        decrees.draft_authority_registry,
        "reserve_with_context",
        lambda **_kwargs: None,
    )
    other_owner = TestClient(_app(store, owner="owner-b")).post(
        "/api/v1/decrees/chancellor",
        headers=headers,
        json=_request(b"owner-a"),
    )
    assert other_owner.status_code == 409
    assert other_owner.json()["reason"] == "draft_not_current"
    assert store.count() == 1


def test_activation_failure_preserves_committed_authority_for_recovery(
    tmp_path, monkeypatch
) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    authority = ConsumedDraftAuthority(_route(), None)
    restored: list[ConsumedDraftAuthority] = []
    monkeypatch.setattr(
        decrees.draft_authority_registry,
        "reserve_with_context",
        lambda **_kwargs: authority,
    )
    monkeypatch.setattr(
        decrees.draft_authority_registry,
        "commit_reservation",
        lambda **_kwargs: True,
    )
    monkeypatch.setattr(
        decrees.draft_authority_registry,
        "restore_if_absent",
        lambda **kwargs: restored.append(kwargs["consumed"]) or True,
    )
    monkeypatch.setattr(
        store,
        "activate_acceptance",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(OSError("disk unavailable")),
    )
    client = TestClient(_app(store))

    response = client.post(
        "/api/v1/decrees/chancellor",
        headers={"Idempotency-Key": "activation-failure"},
        json=_request(b"activation"),
    )

    assert response.status_code == 502
    assert store.count() == 1
    assert restored == []
    assert store.claim_next("worker-a") is None


def test_post_commit_activation_error_keeps_authority_consumed(
    tmp_path, monkeypatch
) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    authority = ConsumedDraftAuthority(_route(), None)
    restored: list[ConsumedDraftAuthority] = []
    original_activate = store.activate_acceptance

    def commit_then_fail(*args, **kwargs):
        original_activate(*args, **kwargs)
        raise OSError("connection dropped after commit")

    monkeypatch.setattr(
        decrees.draft_authority_registry,
        "reserve_with_context",
        lambda **_kwargs: authority,
    )
    monkeypatch.setattr(
        decrees.draft_authority_registry,
        "commit_reservation",
        lambda **_kwargs: True,
    )
    monkeypatch.setattr(
        decrees.draft_authority_registry,
        "restore_if_absent",
        lambda **kwargs: restored.append(kwargs["consumed"]) or True,
    )
    monkeypatch.setattr(store, "activate_acceptance", commit_then_fail)
    response = TestClient(_app(store)).post(
        "/api/v1/decrees/chancellor",
        headers={"Idempotency-Key": "post-commit-failure"},
        json=_request(b"post-commit-failure"),
    )

    assert response.status_code == 502
    assert restored == []
    assert store.count() == 1
    assert store.claim_next("worker-a") is not None


def test_worker_executes_archives_and_publishes_one_owner_reply(
    tmp_path, monkeypatch
) -> None:
    import app.decree_jobs.executor as executor_module
    from app.api.decrees import (
        BureauOpinionResponse,
        ChancellorDecreeResponse,
        DeliveryKind,
        MinistryOpinionResponse,
        PreparedDecreeExecution,
    )
    from app.decree_jobs.executor import PersistentDecreeJobExecutor
    from app.decree_jobs.worker import DecreeJobWorker
    from app.shiguan.archive_decree import archive_chancellor_decree
    from app.shiguan.storage import list_archives

    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    authority = ConsumedDraftAuthority(_route(), None)
    fingerprint = hashlib.sha256(b"worker-integration").hexdigest()
    accepted = store.accept(
        AcceptDecreeJob(
            owner_user_id="owner-a",
            idempotency_key="worker-integration",
            request_hash="request-hash",
            draft_fingerprint=fingerprint,
            decree_text="请户部核查国库",
            approved_route_json=decrees._authority_snapshot(authority),
            deadline_at=datetime.now(UTC) + timedelta(minutes=30),
        )
    ).job
    response = ChancellorDecreeResponse(
        status="ok",
        chancellor="丞相",
        route_type="single",
        rationale="交户部办理",
        processing_path=["上书房", "丞相（首次分流）", "户部", "丞相（最终汇总）"],
        departments=["户部"],
        ministry_opinions=[
            MinistryOpinionResponse(
                department="户部",
                bureau_opinions=[
                    BureauOpinionResponse(bureau="预算司", opinion="已核验")
                ],
                opinion="准予办理",
            )
        ],
        council_verdict=None,
        final_verdict="准奏",
        recommendations=["建议一", "建议二", "建议三"],
        delivery_kind=DeliveryKind.NONE,
    )
    prepared = PreparedDecreeExecution(
        response=response,
        internal_result={
            "approved_route": _route(),
            "draft_version": 1,
            "draft_fingerprint": fingerprint,
            "runtime_audit": None,
        },
    )
    executions: list[str] = []
    monkeypatch.setattr(
        executor_module,
        "execute_decree_now",
        lambda *_args, **_kwargs: executions.append("execute") or prepared,
    )
    shiguan_path = tmp_path / "shiguan.sqlite3"
    monkeypatch.setattr(
        executor_module,
        "archive_chancellor_decree",
        lambda *args, **kwargs: archive_chancellor_decree(
            *args, **kwargs, shiguan_db_path=shiguan_path
        ),
    )
    worker = DecreeJobWorker(
        store,
        PersistentDecreeJobExecutor(),
        worker_id="worker-a",
        lease_seconds=3600,
    )

    assert worker.run_once() is True
    assert worker.run_once() is False

    completed = store.get_for_owner(accepted.job_id, "owner-a")
    assert completed.state is DecreeJobState.SUCCEEDED
    assert completed.reply_id == accepted.job_id
    assert executions == ["execute"]
    replies = list_archives(
        type="REPLY", owner_user_id="owner-a", db_path=shiguan_path
    )
    assert len(replies) == 1
    assert replies[0].id == accepted.job_id


def test_application_lifespan_starts_and_stops_exactly_one_worker_by_default(
    monkeypatch,
) -> None:
    import app.main as main

    events: list[str] = []

    class FakeWorker:
        def __init__(self, *_args, **_kwargs) -> None:
            events.append("constructed")

        def start(self) -> None:
            events.append("started")

        def stop(self) -> None:
            events.append("stopped")

    monkeypatch.delenv("CHAOTANG_DECREE_JOB_WORKER_ENABLED", raising=False)
    monkeypatch.setattr(main, "DecreeJobWorker", FakeWorker)
    monkeypatch.setattr(main, "get_decree_job_store", lambda: object())
    monkeypatch.setattr(main, "PersistentDecreeJobExecutor", lambda: object())

    with TestClient(main.app):
        assert events == ["constructed", "started"]
    assert events == ["constructed", "started", "stopped"]
