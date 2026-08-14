from __future__ import annotations

import json
import sqlite3
import threading
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest

from app.decree_jobs.models import AcceptDecreeJob, DecreeJob, DecreeJobState
from app.decree_jobs.storage import DecreeJobStore
from app.decree_jobs.worker import (
    DecreeJobControl,
    DecreeJobWorker,
    JobCancelled,
    PermanentJobError,
    TransientJobError,
)

NOW = datetime(2026, 8, 5, 12, 0, tzinfo=UTC)


def _accept(store: DecreeJobStore, *, suffix: str = "a") -> str:
    return store.accept(
        AcceptDecreeJob(
            owner_user_id="owner-a",
            idempotency_key=f"submission-{suffix}",
            request_hash=f"hash-{suffix}",
            draft_fingerprint=suffix * 64,
            decree_text="请户部核查国库",
            approved_route_json='{"route_type":"single"}',
            deadline_at=NOW + timedelta(minutes=30),
        ),
        now=NOW,
    ).job.job_id


class RecordingExecutor:
    def __init__(self) -> None:
        self.calls: list[str] = []

    def execute(self, job: DecreeJob, control: DecreeJobControl) -> str:
        self.calls.append("execute")
        control.record_provider_request()
        return '{"status":"ok"}'

    def archive(self, job: DecreeJob) -> str:
        self.calls.append("archive")
        return "reply-1"

    def publish(self, job: DecreeJob) -> None:
        self.calls.append("publish")


def test_worker_runs_one_job_through_durable_side_effect_stages(tmp_path) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job_id = _accept(store)
    executor = RecordingExecutor()
    worker = DecreeJobWorker(store, executor, worker_id="worker-a", clock=lambda: NOW)

    assert worker.run_once() is True

    completed = store.get_for_owner(job_id, "owner-a")
    assert completed.state is DecreeJobState.SUCCEEDED
    assert completed.result_json == '{"status":"ok"}'
    assert completed.reply_id == "reply-1"
    assert completed.provider_request_count == 1
    assert executor.calls == ["execute", "archive", "publish"]


def test_archival_checkpoint_finishes_after_cancel_and_deadline(tmp_path) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job_id = _accept(store)
    store.claim_next("dead-worker", now=NOW, lease_seconds=1)
    store.checkpoint_result(
        job_id, "dead-worker", result_json='{"status":"ok"}', now=NOW
    )
    store.begin_archiving(job_id, "dead-worker", now=NOW)
    store.request_cancel(job_id, "owner-a", now=NOW)
    executor = RecordingExecutor()
    worker = DecreeJobWorker(
        store,
        executor,
        worker_id="recovery-worker",
        clock=lambda: NOW + timedelta(minutes=31),
    )

    assert worker.run_once() is True
    assert store.get_for_owner(job_id, "owner-a").state is DecreeJobState.SUCCEEDED
    assert executor.calls == ["archive", "publish"]


def test_worker_retries_transient_execution_once_and_keeps_request_count(tmp_path) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job_id = _accept(store)

    class Flaky(RecordingExecutor):
        def execute(self, job: DecreeJob, control: DecreeJobControl) -> str:
            self.calls.append("execute")
            control.record_provider_request()
            if self.calls.count("execute") == 1:
                raise TransientJobError("provider_timeout")
            return '{"status":"ok"}'

    executor = Flaky()
    current = NOW
    worker = DecreeJobWorker(
        store, executor, worker_id="worker-a", clock=lambda: current
    )
    assert worker.run_once() is True
    retrying = store.get_for_owner(job_id, "owner-a")
    assert retrying.state is DecreeJobState.RETRY_WAIT
    assert retrying.provider_request_count == 1

    current = NOW + timedelta(seconds=5)
    assert worker.run_once() is True
    completed = store.get_for_owner(job_id, "owner-a")
    assert completed.state is DecreeJobState.SUCCEEDED
    assert completed.attempt_count == 2
    assert completed.provider_request_count == 2


def test_worker_honors_owner_cancel_at_model_stage_boundary(tmp_path) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job_id = _accept(store)

    class Cancelling(RecordingExecutor):
        def execute(self, job: DecreeJob, control: DecreeJobControl) -> str:
            self.calls.append("execute")
            store.request_cancel(job.job_id, job.owner_user_id, now=NOW)
            control.raise_if_cancelled()
            raise AssertionError("cancel boundary did not stop execution")

    executor = Cancelling()
    worker = DecreeJobWorker(store, executor, worker_id="worker-a", clock=lambda: NOW)

    assert worker.run_once() is True
    cancelled = store.get_for_owner(job_id, "owner-a")
    assert cancelled.state is DecreeJobState.CANCELLED
    assert executor.calls == ["execute"]


def test_worker_fails_closed_when_global_deadline_passes_during_execution(tmp_path) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job_id = _accept(store)
    current = NOW

    class Slow(RecordingExecutor):
        def execute(self, job: DecreeJob, control: DecreeJobControl) -> str:
            nonlocal current
            control.record_provider_request()
            current = NOW + timedelta(minutes=31)
            return '{"status":"ok"}'

    worker = DecreeJobWorker(
        store,
        Slow(),
        worker_id="worker-a",
        clock=lambda: current,
        lease_seconds=3600,
    )

    assert worker.run_once() is True
    failed = store.get_for_owner(job_id, "owner-a")
    assert failed.state is DecreeJobState.FAILED
    assert failed.error_code == "deadline_exceeded"
    assert failed.result_json is None


def test_permanent_archive_failure_is_terminal_not_reclaimed_forever(tmp_path) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job_id = _accept(store)

    class BrokenArchive(RecordingExecutor):
        def archive(self, job: DecreeJob) -> str:
            raise PermanentJobError("archive_rejected")

    worker = DecreeJobWorker(
        store, BrokenArchive(), worker_id="worker-a", clock=lambda: NOW
    )

    assert worker.run_once() is True
    failed = store.get_for_owner(job_id, "owner-a")
    assert failed.state is DecreeJobState.FAILED
    assert failed.error_code == "archive_rejected"
    assert worker.run_once() is False


def test_worker_persists_typed_failure_metadata_without_raw_detail(tmp_path) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job_id = _accept(store)

    class FormatFailure(RecordingExecutor):
        def execute(self, job: DecreeJob, control: DecreeJobControl) -> str:
            raise PermanentJobError(
                "format_unrecognized",
                stage="bureau_tool",
                category="format",
            )

    worker = DecreeJobWorker(
        store, FormatFailure(), worker_id="worker-a", clock=lambda: NOW
    )

    assert worker.run_once() is True
    failed = store.get_for_owner(job_id, "owner-a")
    assert (failed.error_stage, failed.error_category, failed.error_code) == (
        "bureau_tool",
        "format",
        "format_unrecognized",
    )


def test_cancel_exception_is_not_retried(tmp_path) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job_id = _accept(store)

    class Cancelled(RecordingExecutor):
        def execute(self, job: DecreeJob, control: DecreeJobControl) -> str:
            store.request_cancel(job.job_id, job.owner_user_id, now=NOW)
            control.raise_if_cancelled()
            raise JobCancelled

    worker = DecreeJobWorker(
        store, Cancelled(), worker_id="worker-a", clock=lambda: NOW
    )
    worker.run_once()
    assert store.get_for_owner(job_id, "owner-a").attempt_count == 1
    assert worker.run_once() is False


def test_worker_resumes_result_checkpoint_without_executing_model(tmp_path) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job_id = _accept(store)
    store.claim_next("dead-worker", now=NOW, lease_seconds=30)
    store.checkpoint_result(
        job_id, "dead-worker", result_json='{"status":"ok"}', now=NOW
    )
    executor = RecordingExecutor()
    worker = DecreeJobWorker(
        store,
        executor,
        worker_id="recovery-worker",
        clock=lambda: NOW + timedelta(seconds=31),
    )

    worker.run_once()

    assert store.get_for_owner(job_id, "owner-a").state is DecreeJobState.SUCCEEDED
    assert executor.calls == ["archive", "publish"]


def test_persistent_executor_checkpoints_before_budget_exhausted_process_exit(
    tmp_path, monkeypatch
) -> None:
    import app.decree_jobs.executor as executor_module
    from app.decree_jobs.executor import PersistentDecreeJobExecutor
    from app.langgraph_runtime.provider_budget import get_provider_attempt_budget

    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    accepted = store.accept(
        AcceptDecreeJob(
            owner_user_id="owner-a",
            idempotency_key="budget-checkpoint-crash",
            request_hash="budget-checkpoint-hash",
            draft_fingerprint="c" * 64,
            decree_text="请户部核查国库",
            approved_route_json=json.dumps(
                {
                    "approved_route": {
                        "departments": [
                            {
                                "department": "户部",
                                "required_bureaus": ["预算司"],
                            }
                        ]
                    },
                    "accounting_context": None,
                }
            ),
            deadline_at=NOW + timedelta(minutes=30),
            provider_request_limit=8,
        ),
        now=NOW,
    ).job
    claimed = store.claim_next(
        "worker-before-exit", now=NOW, lease_seconds=1
    )
    assert claimed is not None
    execute_calls = 0

    def execute_decree(*_args, **_kwargs):
        nonlocal execute_calls
        execute_calls += 1
        budget = get_provider_attempt_budget()
        assert budget is not None
        for _ in range(8):
            budget.reserve()
        return SimpleNamespace(model_dump_json=lambda: '{"status":"ok"}')

    monkeypatch.setattr(executor_module, "execute_decree_now", execute_decree)
    control = DecreeJobControl(
        store,
        claimed,
        "worker-before-exit",
        lambda: NOW,
        threading.Event(),
    )

    assert PersistentDecreeJobExecutor().execute(claimed, control) == '{"status":"ok"}'
    checkpointed = store.get_for_owner(accepted.job_id, "owner-a")
    assert checkpointed.state is DecreeJobState.RESULT_READY
    assert checkpointed.provider_request_count == 8

    class RecoveryExecutor(RecordingExecutor):
        def execute(self, job: DecreeJob, control: DecreeJobControl) -> str:
            raise AssertionError("provider phase must not replay after durable checkpoint")

        def archive(self, job: DecreeJob) -> str:
            self.calls.append("archive")
            return job.job_id

        def publish(self, job: DecreeJob) -> str:
            self.calls.append("publish")
            assert job.result_json is not None
            return job.result_json

    recovery = RecoveryExecutor()
    worker = DecreeJobWorker(
        store,
        recovery,
        worker_id="worker-after-exit",
        clock=lambda: NOW + timedelta(seconds=2),
        lease_seconds=1,
    )

    assert worker.run_once() is True
    completed = store.get_for_owner(accepted.job_id, "owner-a")
    assert completed.state is DecreeJobState.SUCCEEDED
    assert completed.provider_request_count == 8
    assert execute_calls == 1
    assert recovery.calls == ["archive", "publish"]


def test_persistent_executor_honors_cancel_requested_during_model_execution(
    tmp_path, monkeypatch
) -> None:
    import app.decree_jobs.executor as executor_module
    from app.decree_jobs.executor import PersistentDecreeJobExecutor

    store = DecreeJobStore(tmp_path / "cancel-before-checkpoint.sqlite3")
    accepted = store.accept(
        AcceptDecreeJob(
            owner_user_id="owner-a",
            idempotency_key="cancel-before-result-checkpoint",
            request_hash="cancel-before-result-checkpoint-hash",
            draft_fingerprint="d" * 64,
            decree_text="请户部核查国库",
            approved_route_json=json.dumps(
                {
                    "approved_route": {
                        "departments": [
                            {"department": "户部", "required_bureaus": ["预算司"]}
                        ]
                    },
                    "accounting_context": None,
                }
            ),
            deadline_at=NOW + timedelta(minutes=30),
        ),
        now=NOW,
    ).job
    claimed = store.claim_next("worker-a", now=NOW, lease_seconds=30)
    assert claimed is not None

    def execute_decree(*_args, **_kwargs):
        store.request_cancel(accepted.job_id, "owner-a", now=NOW)
        return SimpleNamespace(model_dump_json=lambda: '{"status":"ok"}')

    monkeypatch.setattr(executor_module, "execute_decree_now", execute_decree)
    control = DecreeJobControl(
        store, claimed, "worker-a", lambda: NOW, threading.Event()
    )

    with pytest.raises(JobCancelled):
        PersistentDecreeJobExecutor().execute(claimed, control)

    cancelled = store.get_for_owner(accepted.job_id, "owner-a")
    assert cancelled.state is DecreeJobState.CANCELLED
    assert cancelled.result_json is None


def test_persistent_executor_rechecks_deadline_before_result_checkpoint(
    tmp_path, monkeypatch
) -> None:
    import app.decree_jobs.executor as executor_module
    from app.decree_jobs.executor import PersistentDecreeJobExecutor
    from app.decree_jobs.worker import JobDeadlineExceeded

    store = DecreeJobStore(tmp_path / "deadline-before-checkpoint.sqlite3")
    accepted = store.accept(
        AcceptDecreeJob(
            owner_user_id="owner-a",
            idempotency_key="deadline-before-result-checkpoint",
            request_hash="deadline-before-result-checkpoint-hash",
            draft_fingerprint="e" * 64,
            decree_text="请户部核查国库",
            approved_route_json=json.dumps(
                {
                    "approved_route": {
                        "departments": [
                            {"department": "户部", "required_bureaus": ["预算司"]}
                        ]
                    },
                    "accounting_context": None,
                }
            ),
            deadline_at=NOW + timedelta(seconds=5),
        ),
        now=NOW,
    ).job
    claimed = store.claim_next("worker-a", now=NOW, lease_seconds=30)
    assert claimed is not None
    clock = [NOW]

    def execute_decree(*_args, **_kwargs):
        clock[0] = NOW + timedelta(seconds=5)
        return SimpleNamespace(model_dump_json=lambda: '{"status":"ok"}')

    monkeypatch.setattr(executor_module, "execute_decree_now", execute_decree)
    control = DecreeJobControl(
        store, claimed, "worker-a", lambda: clock[0], threading.Event()
    )

    with pytest.raises(JobDeadlineExceeded):
        PersistentDecreeJobExecutor().execute(claimed, control)

    current = store.get_for_owner(accepted.job_id, "owner-a")
    assert current.state is DecreeJobState.RUNNING
    assert current.result_json is None


def test_result_checkpoint_sqlite_failure_is_transient_before_commit(
    tmp_path, monkeypatch
) -> None:
    store = DecreeJobStore(tmp_path / "checkpoint-precommit.sqlite3")
    job_id = _accept(store, suffix="p")
    claimed = store.claim_next("worker-a", now=NOW, lease_seconds=30)
    assert claimed is not None
    control = DecreeJobControl(
        store, claimed, "worker-a", lambda: NOW, threading.Event()
    )
    monkeypatch.setattr(
        store,
        "checkpoint_result",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            sqlite3.OperationalError("database is temporarily locked")
        ),
    )

    with pytest.raises(TransientJobError, match="result_checkpoint_failed"):
        control.checkpoint_result('{"status":"ok"}')

    assert store.get_for_owner(job_id, "owner-a").state is DecreeJobState.RUNNING


def test_result_checkpoint_maps_boundary_read_sqlite_failure_to_transient(
    tmp_path, monkeypatch
) -> None:
    store = DecreeJobStore(tmp_path / "boundary-read.sqlite3")
    _accept(store, suffix="r")
    claimed = store.claim_next("worker-a", now=NOW, lease_seconds=30)
    assert claimed is not None
    control = DecreeJobControl(
        store, claimed, "worker-a", lambda: NOW, threading.Event()
    )
    monkeypatch.setattr(
        store,
        "get_for_owner",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            sqlite3.OperationalError("boundary read unavailable")
        ),
    )

    with pytest.raises(TransientJobError, match="result_checkpoint_failed"):
        control.checkpoint_result('{"status":"ok"}')


def test_result_checkpoint_reconciles_sqlite_postcommit_ambiguity(
    tmp_path, monkeypatch
) -> None:
    store = DecreeJobStore(tmp_path / "checkpoint-postcommit.sqlite3")
    job_id = _accept(store, suffix="q")
    claimed = store.claim_next("worker-a", now=NOW, lease_seconds=30)
    assert claimed is not None
    control = DecreeJobControl(
        store, claimed, "worker-a", lambda: NOW, threading.Event()
    )
    original = store.checkpoint_result

    def commit_then_raise(*args, **kwargs):
        original(*args, **kwargs)
        raise sqlite3.OperationalError("commit acknowledgement lost")

    monkeypatch.setattr(store, "checkpoint_result", commit_then_raise)

    checkpointed = control.checkpoint_result('{"status":"ok"}')

    assert checkpointed.state is DecreeJobState.RESULT_READY
    assert checkpointed.result_json == '{"status":"ok"}'
    assert store.get_for_owner(job_id, "owner-a").state is DecreeJobState.RESULT_READY


def test_worker_survives_cancelled_checkpoint_sqlite_postcommit_ambiguity(
    tmp_path, monkeypatch
) -> None:
    import app.decree_jobs.executor as executor_module
    from app.decree_jobs.executor import PersistentDecreeJobExecutor

    store = DecreeJobStore(tmp_path / "cancel-checkpoint-postcommit.sqlite3")
    accepted = store.accept(
        AcceptDecreeJob(
            owner_user_id="owner-a",
            idempotency_key="cancel-checkpoint-postcommit",
            request_hash="cancel-checkpoint-postcommit-hash",
            draft_fingerprint="f" * 64,
            decree_text="请户部核查国库",
            approved_route_json=json.dumps(
                {
                    "approved_route": {
                        "departments": [
                            {"department": "户部", "required_bureaus": ["预算司"]}
                        ]
                    },
                    "accounting_context": None,
                }
            ),
            deadline_at=NOW + timedelta(minutes=30),
        ),
        now=NOW,
    ).job
    monkeypatch.setattr(
        executor_module,
        "execute_decree_now",
        lambda *_args, **_kwargs: SimpleNamespace(
            model_dump_json=lambda: '{"status":"ok"}'
        ),
    )
    original = store.checkpoint_result

    def cancel_commit_then_raise(*args, **kwargs):
        store.request_cancel(accepted.job_id, "owner-a", now=NOW)
        original(*args, **kwargs)
        raise sqlite3.OperationalError("cancel commit acknowledgement lost")

    monkeypatch.setattr(store, "checkpoint_result", cancel_commit_then_raise)
    worker = DecreeJobWorker(
        store,
        PersistentDecreeJobExecutor(),
        worker_id="worker-a",
        clock=lambda: NOW,
        lease_seconds=30,
    )

    assert worker.run_once() is True
    cancelled = store.get_for_owner(accepted.job_id, "owner-a")
    assert cancelled.state is DecreeJobState.CANCELLED
    assert cancelled.lease_owner is None
    assert cancelled.result_json is None


def test_worker_honors_late_cancel_when_checkpoint_fails_before_commit(
    tmp_path, monkeypatch
) -> None:
    import app.decree_jobs.executor as executor_module
    from app.decree_jobs.executor import PersistentDecreeJobExecutor

    store = DecreeJobStore(tmp_path / "cancel-checkpoint-precommit.sqlite3")
    accepted = store.accept(
        AcceptDecreeJob(
            owner_user_id="owner-a",
            idempotency_key="cancel-checkpoint-precommit",
            request_hash="cancel-checkpoint-precommit-hash",
            draft_fingerprint="1" * 64,
            decree_text="请户部核查国库",
            approved_route_json=json.dumps(
                {
                    "approved_route": {
                        "departments": [
                            {"department": "户部", "required_bureaus": ["预算司"]}
                        ]
                    },
                    "accounting_context": None,
                }
            ),
            deadline_at=NOW + timedelta(minutes=30),
        ),
        now=NOW,
    ).job
    monkeypatch.setattr(
        executor_module,
        "execute_decree_now",
        lambda *_args, **_kwargs: SimpleNamespace(
            model_dump_json=lambda: '{"status":"ok"}'
        ),
    )

    def cancel_then_fail(*_args, **_kwargs):
        store.request_cancel(accepted.job_id, "owner-a", now=NOW)
        raise sqlite3.OperationalError("checkpoint failed before commit")

    monkeypatch.setattr(store, "checkpoint_result", cancel_then_fail)
    worker = DecreeJobWorker(
        store,
        PersistentDecreeJobExecutor(),
        worker_id="worker-a",
        clock=lambda: NOW,
        lease_seconds=30,
    )

    assert worker.run_once() is True
    cancelled = store.get_for_owner(accepted.job_id, "owner-a")
    assert cancelled.state is DecreeJobState.CANCELLED
    assert cancelled.lease_owner is None
    assert cancelled.retry_at is None
    assert cancelled.result_json is None


def test_double_checkpoint_ambiguity_preserves_result_ready_without_model_replay(
    tmp_path, monkeypatch
) -> None:
    import app.decree_jobs.executor as executor_module
    from app.decree_jobs.executor import PersistentDecreeJobExecutor

    store = DecreeJobStore(tmp_path / "checkpoint-double-ambiguity.sqlite3")
    accepted = store.accept(
        AcceptDecreeJob(
            owner_user_id="owner-a",
            idempotency_key="checkpoint-double-ambiguity",
            request_hash="checkpoint-double-ambiguity-hash",
            draft_fingerprint="2" * 64,
            decree_text="请户部核查国库",
            approved_route_json=json.dumps(
                {
                    "approved_route": {
                        "departments": [
                            {"department": "户部", "required_bureaus": ["预算司"]}
                        ]
                    },
                    "accounting_context": None,
                }
            ),
            deadline_at=NOW + timedelta(minutes=30),
        ),
        now=NOW,
    ).job
    execute_calls = 0

    def execute_decree(*_args, **_kwargs):
        nonlocal execute_calls
        execute_calls += 1
        return SimpleNamespace(model_dump_json=lambda: '{"status":"ok"}')

    monkeypatch.setattr(executor_module, "execute_decree_now", execute_decree)
    original_checkpoint = store.checkpoint_result

    def commit_then_raise(*args, **kwargs):
        original_checkpoint(*args, **kwargs)
        raise sqlite3.OperationalError("checkpoint acknowledgement lost")

    monkeypatch.setattr(store, "checkpoint_result", commit_then_raise)
    original_get = store.get_for_owner
    reload_attempts = 0

    def fail_first_ambiguity_reload(*args, **kwargs):
        nonlocal reload_attempts
        reload_attempts += 1
        if reload_attempts == 3:
            raise sqlite3.OperationalError("first ambiguity reload unavailable")
        return original_get(*args, **kwargs)

    monkeypatch.setattr(store, "get_for_owner", fail_first_ambiguity_reload)
    first_worker = DecreeJobWorker(
        store,
        PersistentDecreeJobExecutor(),
        worker_id="worker-a",
        clock=lambda: NOW,
        lease_seconds=30,
    )

    assert first_worker.run_once() is True
    checkpointed = original_get(accepted.job_id, "owner-a")
    assert checkpointed.state is DecreeJobState.RESULT_READY
    assert checkpointed.result_json == '{"status":"ok"}'
    assert checkpointed.lease_owner is None

    class RecoveryExecutor(RecordingExecutor):
        def execute(self, job: DecreeJob, control: DecreeJobControl) -> str:
            raise AssertionError("durable RESULT_READY must not replay the model")

        def archive(self, job: DecreeJob) -> str:
            self.calls.append("archive")
            return job.job_id

        def publish(self, job: DecreeJob) -> str:
            self.calls.append("publish")
            assert job.result_json is not None
            return job.result_json

    recovery = RecoveryExecutor()
    recovery_worker = DecreeJobWorker(
        store,
        recovery,
        worker_id="worker-b",
        clock=lambda: NOW + timedelta(seconds=1),
        lease_seconds=30,
    )

    assert recovery_worker.run_once() is True
    completed = original_get(accepted.job_id, "owner-a")
    assert completed.state is DecreeJobState.SUCCEEDED
    assert execute_calls == 1
    assert recovery.calls == ["archive", "publish"]


def test_cancelled_double_checkpoint_ambiguity_does_not_kill_worker(
    tmp_path, monkeypatch
) -> None:
    import app.decree_jobs.executor as executor_module
    from app.decree_jobs.executor import PersistentDecreeJobExecutor

    store = DecreeJobStore(tmp_path / "cancel-double-ambiguity.sqlite3")
    accepted = store.accept(
        AcceptDecreeJob(
            owner_user_id="owner-a",
            idempotency_key="cancel-double-ambiguity",
            request_hash="cancel-double-ambiguity-hash",
            draft_fingerprint="3" * 64,
            decree_text="请户部核查国库",
            approved_route_json=json.dumps(
                {
                    "approved_route": {
                        "departments": [
                            {"department": "户部", "required_bureaus": ["预算司"]}
                        ]
                    },
                    "accounting_context": None,
                }
            ),
            deadline_at=NOW + timedelta(minutes=30),
        ),
        now=NOW,
    ).job
    monkeypatch.setattr(
        executor_module,
        "execute_decree_now",
        lambda *_args, **_kwargs: SimpleNamespace(
            model_dump_json=lambda: '{"status":"ok"}'
        ),
    )
    original_checkpoint = store.checkpoint_result

    def cancel_commit_then_raise(*args, **kwargs):
        store.request_cancel(accepted.job_id, "owner-a", now=NOW)
        original_checkpoint(*args, **kwargs)
        raise sqlite3.OperationalError("cancel checkpoint acknowledgement lost")

    monkeypatch.setattr(store, "checkpoint_result", cancel_commit_then_raise)
    original_get = store.get_for_owner
    reload_attempts = 0

    def fail_cancel_ambiguity_reload(*args, **kwargs):
        nonlocal reload_attempts
        reload_attempts += 1
        if reload_attempts == 3:
            raise sqlite3.OperationalError("cancel ambiguity reload unavailable")
        return original_get(*args, **kwargs)

    monkeypatch.setattr(store, "get_for_owner", fail_cancel_ambiguity_reload)
    worker = DecreeJobWorker(
        store,
        PersistentDecreeJobExecutor(),
        worker_id="worker-a",
        clock=lambda: NOW,
        lease_seconds=30,
    )

    assert worker.run_once() is True
    cancelled = original_get(accepted.job_id, "owner-a")
    assert cancelled.state is DecreeJobState.CANCELLED
    assert cancelled.lease_owner is None
    assert cancelled.result_json is None

    monkeypatch.setattr(store, "checkpoint_result", original_checkpoint)
    monkeypatch.setattr(store, "get_for_owner", original_get)
    next_job_id = _accept(store, suffix="s")
    next_executor = RecordingExecutor()
    worker.executor = next_executor

    assert worker.run_once() is True
    assert store.get_for_owner(next_job_id, "owner-a").state is DecreeJobState.SUCCEEDED
    assert next_executor.calls == ["execute", "archive", "publish"]


def test_worker_replays_exact_council_execution_after_precheckpoint_crash(
    tmp_path, monkeypatch
) -> None:
    from app.agents.runtime_skills.models import (
        CouncilReport,
        EvidenceSufficiency,
        MinistryReport,
        ReportStatus,
    )
    from app.api.decrees import _StorageCaseLifecycleObserver
    from app.junjichu_cases import storage as case_storage

    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    accepted = store.accept(
        AcceptDecreeJob(
            owner_user_id="owner-a",
            idempotency_key="council-precheckpoint-crash",
            request_hash="council-request-hash",
            draft_fingerprint="a" * 64,
            decree_text="请户部、刑部会审",
            approved_route_json='{"route_type":"multi"}',
            deadline_at=NOW + timedelta(minutes=30),
        ),
        now=NOW,
    ).job
    case_path = tmp_path / "cases.sqlite3"

    def ministry_report(department: str, job_id: str) -> MinistryReport:
        slug, skill_id = {
            "户部": ("hubu", "synthesize-finance-governance"),
            "刑部": ("xingbu", "synthesize-risk-governance"),
        }[department]
        return MinistryReport(
            report_id=f"ministry-report:{job_id}:{slug}",
            request_id=f"request:{job_id}",
            agent_id=f"ministry-{slug}",
            skill_id=skill_id,
            skill_version="1.0.0",
            subject=department,
            executive_summary=f"{department}已完成受控复核",
            input_refs=(f"bureau-report:{slug}",),
            evidence_refs=(f"evidence:{slug}",),
            audit_refs=(f"audit:{slug}",),
            data_gaps=(),
            evidence_sufficiency=EvidenceSufficiency.SUFFICIENT,
            status=ReportStatus.COMPLETED,
            selected_bureaus=("测试司",),
            selection_reasons=("approved route",),
            bureau_report_refs=(f"bureau-report:{slug}",),
            shared_findings=(f"{department} finding",),
            conflicts=(),
            cross_bureau_impacts=(),
            ministry_position=(f"{department} position",),
            unresolved_items=(),
            created_at=datetime.now(UTC),
        )

    class DurableCouncilExecutor(RecordingExecutor):
        def __init__(self) -> None:
            super().__init__()
            self.case_id: str | None = None

        def execute(self, job: DecreeJob, control: DecreeJobControl) -> str:
            self.calls.append("execute")
            observer = _StorageCaseLifecycleObserver(
                job.owner_user_id,
                run_id=job.job_id,
                draft_fingerprint=job.draft_fingerprint,
                route_digest="b" * 64,
                approved_departments=("户部", "刑部"),
                db_path=case_path,
            )
            observer.open_case(
                decree_text=job.decree_text,
                departments=["户部", "刑部"],
                processing_path=["上书房", "丞相（首次分流）"],
            )
            reports = tuple(
                ministry_report(department, job.job_id)
                for department in ("户部", "刑部")
            )
            for report in reports:
                observer.record_ministry_opinion(
                    {
                        "department": report.subject,
                        "opinion": report.ministry_position[0],
                    }
                )
                observer.record_ministry_report(report)
            observer.record_checkpoint(
                status="COUNCIL_REVIEWING",
                processing_path=["上书房", "丞相（首次分流）", "军机处（会审）"],
                council_verdict="两部证据链一致",
            )
            observer.record_council_report(
                CouncilReport(
                    report_id=f"council-report:{job.job_id}",
                    request_id=f"request:{job.job_id}",
                    agent_id="junjichu",
                    skill_id="conduct-joint-ministry-review",
                    skill_version="1.0.0",
                    subject="跨部会审",
                    executive_summary="军机处完成确定性合议",
                    input_refs=tuple(report.report_id for report in reports),
                    evidence_refs=tuple(
                        ref for report in reports for ref in report.evidence_refs
                    ),
                    audit_refs=tuple(
                        ref for report in reports for ref in report.audit_refs
                    ),
                    data_gaps=(),
                    evidence_sufficiency=EvidenceSufficiency.SUFFICIENT,
                    status=ReportStatus.COMPLETED,
                    participating_ministries=("户部", "刑部"),
                    review_order=("户部", "刑部"),
                    ministry_report_refs=tuple(report.report_id for report in reports),
                    consensus=("两部证据链一致",),
                    disagreements=(),
                    cross_ministry_dependencies=(),
                    joint_options=("保持只读预览",),
                    matters_for_chancellor_decision=(),
                    created_at=datetime.now(UTC),
                )
            )
            observer.record_checkpoint(
                status="CHANCELLOR_FINALIZING",
                processing_path=[
                    "上书房",
                    "丞相（首次分流）",
                    "军机处（会审）",
                    "丞相（最终汇总）",
                ],
            )
            self.case_id = observer.case_id
            return '{"status":"ok"}'

        def archive(self, job: DecreeJob) -> str:
            self.calls.append("archive")
            assert self.case_id is not None
            case_storage.archive_case(
                self.case_id,
                owner_user_id=job.owner_user_id,
                reply_id=job.job_id,
                db_path=case_path,
            )
            return job.job_id

        def publish(self, job: DecreeJob) -> str:
            self.calls.append("publish")
            assert job.result_json is not None
            return job.result_json

    executor = DurableCouncilExecutor()
    original_checkpoint = store.checkpoint_result
    monkeypatch.setattr(
        store,
        "checkpoint_result",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            SystemExit("crash before result checkpoint")
        ),
    )
    first_worker = DecreeJobWorker(
        store,
        executor,
        worker_id="worker-before-crash",
        clock=lambda: NOW,
        lease_seconds=1,
    )

    with pytest.raises(SystemExit, match="before result checkpoint"):
        first_worker.run_once()

    monkeypatch.setattr(store, "checkpoint_result", original_checkpoint)
    recovery_worker = DecreeJobWorker(
        store,
        executor,
        worker_id="worker-after-crash",
        clock=lambda: NOW + timedelta(seconds=2),
        lease_seconds=1,
    )

    assert recovery_worker.run_once() is True
    completed = store.get_for_owner(accepted.job_id, "owner-a")
    assert completed.state is DecreeJobState.SUCCEEDED
    assert executor.calls == ["execute", "execute", "archive", "publish"]
    cases = case_storage.list_cases(owner_user_id="owner-a", db_path=case_path)
    assert len(cases) == 1
    assert cases[0].status == "ARCHIVED"
    snapshot = case_storage.get_runtime_report_snapshot(
        cases[0].id,
        owner_user_id="owner-a",
        run_id=accepted.job_id,
        db_path=case_path,
    )
    assert len(snapshot.ministry_records) == 2
    assert snapshot.council_record is not None


def test_worker_resumes_archiving_and_publishing_checkpoints(tmp_path) -> None:
    for suffix, checkpoint, expected in (
        ("b", "archive", ["archive", "publish"]),
        ("c", "publish", ["publish"]),
    ):
        store = DecreeJobStore(tmp_path / f"{suffix}.sqlite3")
        job_id = _accept(store, suffix=suffix)
        store.claim_next("dead-worker", now=NOW, lease_seconds=30)
        store.checkpoint_result(
            job_id, "dead-worker", result_json='{"status":"ok"}', now=NOW
        )
        store.begin_archiving(job_id, "dead-worker", now=NOW)
        if checkpoint == "publish":
            store.begin_publishing(
                job_id, "dead-worker", reply_id="reply-1", now=NOW
            )
        executor = RecordingExecutor()
        worker = DecreeJobWorker(
            store,
            executor,
            worker_id="recovery-worker",
            clock=lambda: NOW + timedelta(seconds=31),
        )

        worker.run_once()

        assert store.get_for_owner(job_id, "owner-a").state is DecreeJobState.SUCCEEDED
        assert executor.calls == expected
