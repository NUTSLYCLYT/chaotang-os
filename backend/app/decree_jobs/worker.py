from __future__ import annotations

import sqlite3
import threading
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Protocol

from .models import DecreeJob, DecreeJobState
from .storage import DecreeJobStore, LeaseConflict


class JobControlAbort(BaseException):
    """Internal cooperative control flow that must cross provider wrappers."""


class JobCancelled(JobControlAbort):
    pass


class JobLeaseLost(JobControlAbort):
    pass


class JobDeadlineExceeded(JobControlAbort):
    pass


class TransientJobError(RuntimeError):
    def __init__(
        self, code: str, *, stage: str = "execution", category: str | None = None
    ) -> None:
        super().__init__(code)
        self.code = code
        self.stage = stage
        self.category = category or _failure_category(code)


class PermanentJobError(RuntimeError):
    def __init__(
        self, code: str, *, stage: str = "execution", category: str | None = None
    ) -> None:
        super().__init__(code)
        self.code = code
        self.stage = stage
        self.category = category or _failure_category(code)


def _failure_category(code: str) -> str:
    if code == "provider_budget_exceeded":
        return "budget"
    if code == "deadline_exceeded":
        return "deadline"
    if code.startswith("provider_"):
        return "provider"
    if code == "retry_exhausted":
        return "retry"
    if code == "model_output_invalid":
        return "retry"
    return "internal"


class DecreeJobExecutor(Protocol):
    def execute(self, job: DecreeJob, control: DecreeJobControl) -> str: ...

    def archive(self, job: DecreeJob) -> str: ...

    def publish(self, job: DecreeJob) -> str | None: ...


class DecreeJobControl:
    def __init__(
        self,
        store: DecreeJobStore,
        job: DecreeJob,
        worker_id: str,
        clock: Callable[[], datetime],
        lease_lost: threading.Event,
    ) -> None:
        self._store = store
        self._job = job
        self._worker_id = worker_id
        self._clock = clock
        self._lease_lost = lease_lost

    def record_provider_request(self, count: int = 1) -> None:
        if self._lease_lost.is_set():
            raise JobLeaseLost
        try:
            self._store.add_provider_requests(
                self._job.job_id,
                self._worker_id,
                count=count,
                now=self._clock(),
            )
        except LeaseConflict as exc:
            raise JobLeaseLost from exc

    def checkpoint_result(self, result_json: str) -> DecreeJob:
        """Persist the completed model phase before control returns to the worker."""

        checkpoint_now = self._clock()
        try:
            self.raise_if_cancelled(now=checkpoint_now)
        except (sqlite3.Error, OSError) as exc:
            raise TransientJobError("result_checkpoint_failed") from exc
        try:
            checkpointed = self._store.checkpoint_result(
                self._job.job_id,
                self._worker_id,
                result_json=result_json,
                now=checkpoint_now,
            )
            if checkpointed.state is DecreeJobState.CANCELLED:
                raise JobCancelled
            return checkpointed
        except LeaseConflict as exc:
            raise JobLeaseLost from exc
        except (sqlite3.Error, OSError) as exc:
            try:
                current = self._store.get_for_owner(
                    self._job.job_id, self._job.owner_user_id
                )
            except (sqlite3.Error, OSError):
                raise TransientJobError("result_checkpoint_failed") from exc
            if current.state is DecreeJobState.CANCELLED:
                raise JobCancelled from exc
            if current.lease_owner != self._worker_id:
                raise JobLeaseLost from exc
            if (
                current.state is DecreeJobState.RUNNING
                and current.cancel_requested
            ):
                try:
                    cancelled = self._store.cancel_at_boundary(
                        self._job.job_id,
                        self._worker_id,
                        now=checkpoint_now,
                    )
                except LeaseConflict as cancel_exc:
                    raise JobLeaseLost from cancel_exc
                except (sqlite3.Error, OSError) as cancel_exc:
                    raise TransientJobError(
                        "result_checkpoint_failed"
                    ) from cancel_exc
                if cancelled.state is DecreeJobState.CANCELLED:
                    raise JobCancelled from exc
            if (
                current.state is DecreeJobState.RESULT_READY
                and current.result_json == result_json
            ):
                return current
            raise TransientJobError("result_checkpoint_failed") from exc

    def raise_if_cancelled(self, *, now: datetime | None = None) -> None:
        boundary_now = now or self._clock()
        if self._lease_lost.is_set():
            raise JobLeaseLost
        if boundary_now >= self._job.deadline_at:
            raise JobDeadlineExceeded
        current = self._store.get_for_owner(
            self._job.job_id, self._job.owner_user_id
        )
        if not current.cancel_requested:
            return
        cancelled = self._store.cancel_at_boundary(
            self._job.job_id, self._worker_id, now=boundary_now
        )
        if cancelled.state is DecreeJobState.CANCELLED:
            raise JobCancelled


class DecreeJobWorker:
    def __init__(
        self,
        store: DecreeJobStore,
        executor: DecreeJobExecutor,
        *,
        worker_id: str,
        clock: Callable[[], datetime] | None = None,
        lease_seconds: int = 90,
        retry_delay_seconds: int = 5,
        poll_seconds: float = 0.5,
    ) -> None:
        self.store = store
        self.executor = executor
        self.worker_id = worker_id
        self.clock = clock or (lambda: datetime.now(UTC))
        self.lease_seconds = lease_seconds
        self.retry_delay_seconds = retry_delay_seconds
        self.poll_seconds = poll_seconds
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def _start_heartbeat(
        self, job_id: str
    ) -> tuple[threading.Event, threading.Event, threading.Thread]:
        stopped = threading.Event()
        lease_lost = threading.Event()
        interval = max(min(self.lease_seconds / 3, 30), 0.1)

        def renew() -> None:
            while not stopped.wait(interval):
                try:
                    self.store.renew_lease(
                        job_id,
                        self.worker_id,
                        now=self.clock(),
                        lease_seconds=self.lease_seconds,
                    )
                except (LeaseConflict, sqlite3.Error, OSError):
                    lease_lost.set()
                    return

        thread = threading.Thread(
            target=renew,
            name=f"decree-job-lease-{self.worker_id}",
            daemon=True,
        )
        thread.start()
        return stopped, lease_lost, thread

    def _record_failure(
        self,
        job: DecreeJob,
        *,
        model_phase: bool,
        error_code: str,
        error_stage: str,
        error_category: str,
        transient: bool,
    ) -> None:
        failure_now = self.clock()
        try:
            if model_phase:
                self.store.fail_attempt(
                    job.job_id,
                    self.worker_id,
                    error_code=error_code,
                    error_stage=error_stage,
                    error_category=error_category,
                    transient=transient,
                    retry_at=(
                        failure_now + timedelta(seconds=self.retry_delay_seconds)
                        if transient
                        else failure_now
                    ),
                    now=failure_now,
                )
            else:
                self.store.fail_checkpoint(
                    job.job_id,
                    self.worker_id,
                    error_code=error_code,
                    error_stage=error_stage,
                    error_category=error_category,
                    transient=transient,
                    now=failure_now,
                )
        except (LeaseConflict, sqlite3.Error, OSError):
            # A concurrent/ambiguous durable transition owns the truth. The next
            # poll reloads it; a secondary error must never kill the worker loop.
            return

    def run_once(self) -> bool:
        now = self.clock()
        job = self.store.claim_next(
            self.worker_id, now=now, lease_seconds=self.lease_seconds
        )
        if job is None:
            return False
        heartbeat_stop, lease_lost, heartbeat = self._start_heartbeat(job.job_id)
        control = DecreeJobControl(
            self.store, job, self.worker_id, self.clock, lease_lost
        )
        model_phase = job.state is DecreeJobState.RUNNING
        try:
            if job.state is DecreeJobState.RUNNING:
                control.raise_if_cancelled()
                result_json = self.executor.execute(job, control)
                current = self.store.get_for_owner(job.job_id, job.owner_user_id)
                if current.state is DecreeJobState.RUNNING:
                    control.raise_if_cancelled()
                    job = control.checkpoint_result(result_json)
                elif (
                    current.state is DecreeJobState.RESULT_READY
                    and current.result_json == result_json
                    and current.lease_owner == self.worker_id
                ):
                    job = current
                else:
                    raise JobLeaseLost
                model_phase = False
            if job.state is DecreeJobState.RESULT_READY:
                control.raise_if_cancelled()
                job = self.store.begin_archiving(
                    job.job_id, self.worker_id, now=self.clock()
                )
            if job.state is DecreeJobState.ARCHIVING:
                reply_id = self.executor.archive(job)
                job = self.store.begin_publishing(
                    job.job_id,
                    self.worker_id,
                    reply_id=reply_id,
                    now=self.clock(),
                )
            if job.state is DecreeJobState.PUBLISHING:
                final_result_json = self.executor.publish(job)
                self.store.complete(
                    job.job_id,
                    self.worker_id,
                    result_json=final_result_json,
                    now=self.clock(),
                )
            return True
        except JobCancelled:
            return True
        except JobLeaseLost:
            return True
        except JobDeadlineExceeded:
            self._record_failure(
                job,
                model_phase=True,
                error_code="deadline_exceeded",
                error_stage="execution",
                error_category="deadline",
                transient=False,
            )
            return True
        except TransientJobError as exc:
            self._record_failure(
                job,
                model_phase=model_phase,
                error_code=exc.code,
                error_stage=exc.stage,
                error_category=exc.category,
                transient=True,
            )
            return True
        except PermanentJobError as exc:
            self._record_failure(
                job,
                model_phase=model_phase,
                error_code=exc.code,
                error_stage=exc.stage,
                error_category=exc.category,
                transient=False,
            )
            return True
        except Exception:
            self._record_failure(
                job,
                model_phase=model_phase,
                error_code="execution_failed" if model_phase else "side_effect_failed",
                error_stage="execution" if model_phase else "side_effect",
                error_category="internal",
                transient=not model_phase,
            )
            return True
        finally:
            heartbeat_stop.set()
            heartbeat.join(timeout=1)

    def _run(self) -> None:
        while not self._stop.is_set():
            try:
                worked = self.run_once()
            except (sqlite3.Error, OSError):
                worked = False
            if not worked:
                self._stop.wait(self.poll_seconds)

    def start(self) -> None:
        if self._thread is not None and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(
            target=self._run,
            name=f"decree-job-{self.worker_id}",
            daemon=True,
        )
        self._thread.start()

    def is_alive(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    def stop(self, timeout: float = 5) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=timeout)
