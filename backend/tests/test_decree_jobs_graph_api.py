from __future__ import annotations

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import decree_jobs as decree_jobs_api
from app.api.auth import require_current_user
from app.decree_jobs import AcceptDecreeJob, DecreeJobStore
from app.long_task_graph.persistence import SQLiteGraphStore


def _client(store, owner="owner-a"):
    app = FastAPI()
    app.include_router(decree_jobs_api.router)
    app.dependency_overrides[require_current_user] = lambda: SimpleNamespace(id=owner)
    app.dependency_overrides[decree_jobs_api.get_decree_job_store] = lambda: store
    return TestClient(app)


def _job(store, owner="owner-a"):
    return store.accept(
        AcceptDecreeJob(
            owner_user_id=owner,
            idempotency_key=f"accept-{owner}",
            request_hash="request-hash",
            draft_fingerprint="b" * 64,
            decree_text="兵部销售作战",
            approved_route_json='{"department":"bingbu"}',
            deadline_at=datetime(2026, 10, 8, 13, 0, tzinfo=UTC) + timedelta(hours=1),
        )
    ).job


def test_graph_summary_is_owner_scoped_and_hides_state(tmp_path) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job = _job(store)
    graph = SQLiteGraphStore(store.db_path)
    graph.create_run(
        job.owner_user_id,
        graph_version="v1",
        initial_state={"secret": "customer"},
        run_id=f"decree-job:{job.job_id}",
    )
    client = _client(store)

    response = client.get(f"/api/v1/decree-jobs/{job.job_id}/graph")
    assert response.status_code == 200
    body = response.json()
    assert body["run_id"] == f"decree-job:{job.job_id}"
    assert "state" not in body
    assert "resume_token" not in body


def test_graph_summary_denies_other_owner_and_resume_validates_payload(tmp_path) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job = _job(store)
    graph = SQLiteGraphStore(store.db_path)
    waiting = graph.create_run(
        job.owner_user_id,
        graph_version="v1",
        initial_state={},
        run_id=f"decree-job:{job.job_id}",
    )
    waiting = graph.interrupt(
        job.job_id and waiting.run_id, job.owner_user_id, payload={"kind": "HUMAN_REVIEW"}
    )
    assert (
        _client(store, "owner-b").get(f"/api/v1/decree-jobs/{job.job_id}/graph").status_code == 404
    )
    response = _client(store).post(
        f"/api/v1/decree-jobs/{job.job_id}/graph/resume",
        json={"resume_token": waiting.resume_token, "expected_revision": waiting.revision},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "RUNNING"

    stale = _client(store).post(
        f"/api/v1/decree-jobs/{job.job_id}/graph/resume",
        json={"resume_token": waiting.resume_token, "expected_revision": waiting.revision},
    )
    assert stale.status_code == 409
