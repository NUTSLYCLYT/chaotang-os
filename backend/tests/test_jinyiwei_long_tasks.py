from __future__ import annotations

from pathlib import Path

import pytest

from app.jinyiwei import storage
from app.jinyiwei.long_tasks import LongTaskStateMachine
from app.jinyiwei.models import LongTaskStatus

# ruff: noqa: E501


def test_long_task_state_machine_enforces_pause_resume_retry_cancel() -> None:
    machine = LongTaskStateMachine()
    task = machine.create("task-1", owner_user_id="owner-a", idempotency_key="same", max_attempts=2)
    assert task.status is LongTaskStatus.QUEUED
    task = machine.transition(task, LongTaskStatus.RUNNING)
    task = machine.checkpoint(task, {"source_index": 1})
    task = machine.transition(task, LongTaskStatus.PAUSED)
    task = machine.transition(task, LongTaskStatus.RUNNING)
    task = machine.transition(task, LongTaskStatus.RETRYING)
    assert task.attempt_count == 1
    task = machine.transition(task, LongTaskStatus.CANCELLED)
    assert task.cancel_requested is True


def test_long_task_state_machine_rejects_terminal_transition_and_retry_overflow() -> None:
    machine = LongTaskStateMachine()
    task = machine.create("task-2", owner_user_id="owner-a", idempotency_key="same", max_attempts=1)
    task = machine.transition(task, LongTaskStatus.RUNNING)
    task = machine.transition(task, LongTaskStatus.RETRYING)
    with pytest.raises(ValueError, match="retry limit"):
        machine.transition(task, LongTaskStatus.RETRYING)
    task = machine.transition(task, LongTaskStatus.FAILED)
    with pytest.raises(ValueError, match="terminal"):
        machine.transition(task, LongTaskStatus.RUNNING)


def test_long_task_storage_is_idempotent_and_owner_scoped(tmp_path: Path) -> None:
    path = tmp_path / "tasks.sqlite3"
    first = storage.create_long_task(
        "investigation-1",
        owner_user_id="owner-a",
        idempotency_key="idem-1",
        max_attempts=3,
        deadline_at="2026-07-20T08:00:00Z",
        db_path=path,
    )
    second = storage.create_long_task(
        "investigation-1",
        owner_user_id="owner-a",
        idempotency_key="idem-1",
        max_attempts=3,
        deadline_at="2026-07-20T08:00:00Z",
        db_path=path,
    )
    assert first == second
    assert storage.get_long_task(first.task_id, owner_user_id="owner-a", db_path=path) == first
    with pytest.raises(storage.InvestigationNotFoundError):
        storage.get_long_task(first.task_id, owner_user_id="owner-b", db_path=path)
