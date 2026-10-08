from __future__ import annotations

import threading
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest

from app.decree_jobs import AcceptDecreeJob, DecreeJobStore
from app.decree_jobs.worker import DecreeJobControl
from app.long_task_graph.decree_jobs import DecreeJobGraphAdapter
from app.long_task_graph.graph import GraphDefinition, NodeResult
from app.long_task_graph.models import GraphRunStatus
from app.long_task_graph.persistence import GraphResumeRejected, GraphRunNotFound, SQLiteGraphStore

NOW = datetime(2026, 10, 8, 12, 0, tzinfo=UTC)


def _job(store: DecreeJobStore, owner: str = "owner-a"):
    return store.accept(
        AcceptDecreeJob(
            owner_user_id=owner,
            idempotency_key=f"accept-{owner}",
            request_hash="request-hash",
            draft_fingerprint="a" * 64,
            decree_text="请兵部推进重点客户作战",
            approved_route_json='{"department":"bingbu"}',
            deadline_at=NOW + timedelta(hours=1),
        ),
        now=NOW,
    ).job


def _definition() -> GraphDefinition:
    return GraphDefinition(
        start="start",
        terminal="done",
        nodes={
            "start": lambda state: NodeResult({**state, "started": True}, next_node="done"),
            "done": lambda state: NodeResult({**state, "done": True}),
        },
    )


def test_adapter_maps_one_decree_job_to_one_owner_scoped_run(tmp_path) -> None:
    jobs = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job = _job(jobs)
    adapter = DecreeJobGraphAdapter(jobs, _definition(), graph_version="bingbu-p2-v1")
    control = SimpleNamespace(raise_if_cancelled=lambda: None)

    first = adapter.advance(job, control)
    second = adapter.advance(job, control)

    assert first.run_id == second.run_id == f"decree-job:{job.job_id}"
    assert first.status is GraphRunStatus.SUCCEEDED
    assert second.revision == first.revision
    with pytest.raises(GraphRunNotFound):
        SQLiteGraphStore(jobs.db_path).load_run(first.run_id, "owner-b")


def test_adapter_uses_same_sqlite_file_and_rejects_lease_loss(tmp_path) -> None:
    jobs = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job = _job(jobs)
    adapter = DecreeJobGraphAdapter(jobs, _definition(), graph_version="bingbu-p2-v1")
    calls = []

    def cancelled():
        calls.append(True)
        raise RuntimeError("lease-lost")

    with pytest.raises(RuntimeError, match="lease-lost"):
        adapter.advance(job, SimpleNamespace(raise_if_cancelled=cancelled))
    assert calls == [True]


def test_worker_control_advances_graph_without_a_second_lease_loop(tmp_path) -> None:
    jobs = DecreeJobStore(tmp_path / "jobs.sqlite3")
    queued = _job(jobs)
    claimed = jobs.claim_next("worker-a", now=NOW, lease_seconds=90)
    assert claimed is not None
    control = DecreeJobControl(jobs, claimed, "worker-a", lambda: NOW, threading.Event())

    result = control.advance_graph(_definition(), graph_version="bingbu-p2-v1")

    assert result.run_id == f"decree-job:{queued.job_id}"
    assert result.status is GraphRunStatus.SUCCEEDED


def test_resume_requires_owner_revision_and_token(tmp_path) -> None:
    jobs = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job = _job(jobs)
    graph = SQLiteGraphStore(jobs.db_path)
    waiting = graph.create_run(
        job.owner_user_id,
        graph_version="bingbu-p2-v1",
        initial_state={},
        start_node="review",
        run_id=f"decree-job:{job.job_id}",
    )
    waiting = graph.interrupt(
        waiting.run_id,
        job.owner_user_id,
        payload={"kind": "HUMAN_REVIEW"},
    )
    adapter = DecreeJobGraphAdapter(jobs, _definition(), graph_version="bingbu-p2-v1")
    with pytest.raises(GraphResumeRejected):
        adapter.resume(job, "wrong", waiting.revision)
    resumed = adapter.resume(job, waiting.resume_token or "", waiting.revision)
    assert resumed.status is GraphRunStatus.RUNNING
