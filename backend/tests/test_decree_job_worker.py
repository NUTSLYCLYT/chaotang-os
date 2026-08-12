from __future__ import annotations

from datetime import UTC, datetime, timedelta

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
