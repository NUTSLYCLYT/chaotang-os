"""P2 migration counters using the existing metrics and production-event sinks."""

from __future__ import annotations

import os

from sqlalchemy import event
from sqlalchemy.orm import Session

from src.observability import metrics_exporter

_CANONICAL_STAGES = (
    "outbox_consumed",
    "decree_execution_event_written",
    "final_memorial_promoted",
)
_PENDING_SESSION_KEY = "p2_canonical_chain_events_after_commit"


def ensure_migration_metric_series() -> None:
    for stage in _CANONICAL_STAGES:
        metrics_exporter.inc_counter(
            "canonical_chain_events_total",
            value=0,
            labels={"stage": stage, "status": "completed"},
        )


def _record_event(event_type: str, **fields: str) -> None:
    if os.environ.get("FENGQUN_TEST_DB_GUARD") == "1":
        return
    try:
        from src.production_events import record_event

        record_event(event_type, **fields)
    except Exception:
        pass


def record_canonical_chain_event(stage: str, *, status: str = "completed", caller_id: str) -> None:
    metrics_exporter.inc_counter(
        "canonical_chain_events_total",
        labels={"stage": stage, "status": status},
    )
    _record_event("canonical_chain_event", stage=stage, status=status, caller_id=caller_id)


def record_canonical_chain_event_after_commit(db: Session, stage: str, *, caller_id: str) -> None:
    """Queue a fact counter on the transaction; rollback discards it."""
    pending = db.info.setdefault(_PENDING_SESSION_KEY, [])
    pending.append((stage, caller_id))


@event.listens_for(Session, "after_commit")
def _flush_committed_canonical_events(db: Session) -> None:
    for stage, caller_id in db.info.pop(_PENDING_SESSION_KEY, []):
        record_canonical_chain_event(stage, caller_id=caller_id)


@event.listens_for(Session, "after_rollback")
def _discard_rolled_back_canonical_events(db: Session) -> None:
    db.info.pop(_PENDING_SESSION_KEY, None)


def record_legacy_writer_call(*, operation: str, caller_id: str, outcome: str) -> None:
    metrics_exporter.inc_counter(
        "legacy_writer_calls_total",
        labels={"operation": operation, "caller_id": caller_id, "outcome": outcome},
    )
    _record_event(
        "legacy_writer_call",
        operation=operation,
        caller_id=caller_id,
        status=outcome,
    )


def record_legacy_endpoint_call(*, endpoint: str, caller_id: str, operation: str) -> None:
    metrics_exporter.inc_counter(
        "legacy_endpoint_calls_total",
        labels={"endpoint": endpoint, "caller_id": caller_id, "operation": operation},
    )
    _record_event(
        "legacy_endpoint_call",
        endpoint=endpoint,
        caller_id=caller_id,
        operation=operation,
        status="observed",
    )


ensure_migration_metric_series()
