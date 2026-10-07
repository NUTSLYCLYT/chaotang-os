"""Deterministic graph state machine for durable Jinyiwei long tasks."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from app.jinyiwei.models import LongTaskRecord, LongTaskStatus

_TERMINAL = frozenset(
    {
        LongTaskStatus.COMPLETED,
        LongTaskStatus.PARTIAL,
        LongTaskStatus.BLOCKED,
        LongTaskStatus.FAILED,
        LongTaskStatus.CANCELLED,
    }
)
_EDGES: dict[LongTaskStatus, frozenset[LongTaskStatus]] = {
    LongTaskStatus.QUEUED: frozenset({LongTaskStatus.RUNNING, LongTaskStatus.CANCELLED}),
    LongTaskStatus.RUNNING: frozenset(
        {
            LongTaskStatus.WAITING_FOR_SOURCE,
            LongTaskStatus.WAITING_FOR_REVIEW,
            LongTaskStatus.PAUSED,
            LongTaskStatus.RETRYING,
            LongTaskStatus.COMPLETED,
            LongTaskStatus.PARTIAL,
            LongTaskStatus.BLOCKED,
            LongTaskStatus.FAILED,
            LongTaskStatus.CANCELLED,
        }
    ),
    LongTaskStatus.WAITING_FOR_SOURCE: frozenset(
        {
            LongTaskStatus.RUNNING,
            LongTaskStatus.PAUSED,
            LongTaskStatus.RETRYING,
            LongTaskStatus.CANCELLED,
        }
    ),
    LongTaskStatus.WAITING_FOR_REVIEW: frozenset(
        {
            LongTaskStatus.RUNNING,
            LongTaskStatus.PAUSED,
            LongTaskStatus.PARTIAL,
            LongTaskStatus.BLOCKED,
            LongTaskStatus.CANCELLED,
        }
    ),
    LongTaskStatus.PAUSED: frozenset({LongTaskStatus.RUNNING, LongTaskStatus.CANCELLED}),
    LongTaskStatus.RETRYING: frozenset(
        {
            LongTaskStatus.RUNNING,
            LongTaskStatus.RETRYING,
            LongTaskStatus.FAILED,
            LongTaskStatus.BLOCKED,
            LongTaskStatus.CANCELLED,
        }
    ),
}


def _now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


class LongTaskStateMachine:
    """Framework-free graph that can later be adapted to LangGraph."""

    def __init__(self) -> None:
        self._idempotent: dict[tuple[str, str], LongTaskRecord] = {}

    def create(
        self,
        investigation_id: str,
        *,
        owner_user_id: str,
        idempotency_key: str,
        max_attempts: int = 3,
        deadline_at: str | None = None,
        task_id: str | None = None,
    ) -> LongTaskRecord:
        key = (owner_user_id, idempotency_key)
        existing = self._idempotent.get(key)
        if existing is not None:
            if existing.investigation_id != investigation_id:
                raise ValueError("idempotency key belongs to another investigation")
            return existing
        now = _now()
        record = LongTaskRecord(
            task_id=task_id or f"task-{idempotency_key}",
            investigation_id=investigation_id,
            owner_user_id=owner_user_id,
            idempotency_key=idempotency_key,
            status=LongTaskStatus.QUEUED,
            checkpoint={},
            attempt_count=0,
            max_attempts=max_attempts,
            deadline_at=deadline_at or now,
            created_at=now,
            updated_at=now,
        )
        self._idempotent[key] = record
        return record

    def transition(
        self, task: LongTaskRecord, target: LongTaskStatus, *, error_code: str | None = None
    ) -> LongTaskRecord:
        if task.status in _TERMINAL:
            raise ValueError("terminal task cannot transition")
        if target not in _EDGES.get(task.status, frozenset()):
            raise ValueError(f"invalid transition: {task.status} -> {target}")
        attempt_count = task.attempt_count
        if target is LongTaskStatus.RETRYING:
            if attempt_count >= task.max_attempts:
                raise ValueError("retry limit exceeded")
            attempt_count += 1
        return task.model_copy(
            update={
                "status": target,
                "attempt_count": attempt_count,
                "cancel_requested": task.cancel_requested or target is LongTaskStatus.CANCELLED,
                "error_code": error_code,
                "version": task.version + 1,
                "updated_at": _now(),
            }
        )

    def checkpoint(self, task: LongTaskRecord, checkpoint: dict[str, Any]) -> LongTaskRecord:
        if task.status in _TERMINAL:
            raise ValueError("terminal task cannot checkpoint")
        return task.model_copy(
            update={"checkpoint": checkpoint, "version": task.version + 1, "updated_at": _now()}
        )


__all__ = ["LongTaskStateMachine"]
