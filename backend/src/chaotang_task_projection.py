"""Canonical read model for the legacy-shaped chaotang task endpoints."""

from __future__ import annotations

import json
from typing import Any


_TERMINAL_TASK_STATUSES = frozenset(
    {
        "awaiting_decision",
        "awaiting_evidence",
        "direct_completed",
        "archived",
        "rejected",
        "cancelled",
    }
)

_WIRE_STATUS = {
    "draft": "submitted",
    "awaiting_emperor_confirm": "submitted",
    "executing": "running",
    "reviewing": "running",
    "awaiting_decision": "report_ready",
    "awaiting_evidence": "report_ready",
    "direct_completed": "report_ready",
    "archived": "archived",
    "rejected": "failed",
    "cancelled": "failed",
}


class CanonicalTaskAccessDenied(LookupError):
    """The task exists, but the caller must not learn anything about it."""


def _loads(raw: str | None, default: Any) -> Any:
    if not raw:
        return default
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return default


def _summary(raw: str | None) -> str:
    output = _loads(raw, {})
    if isinstance(output, dict):
        for key in ("summary", "conclusion", "output", "text"):
            value = output.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()[:800]
    if isinstance(output, str):
        return output.strip()[:800]
    return ""


def _confidence(raw: str | None) -> float | None:
    try:
        return float(raw) if raw is not None else None
    except (TypeError, ValueError):
        return None


def _event_payload(row) -> dict[str, Any]:
    return {
        "eventType": row.event_type,
        "stage": row.stage,
        "message": row.message,
        "sequence": row.sequence,
        "sourceLabel": row.source_label,
    }


def _stream_event(row, task_id: str) -> dict[str, Any]:
    payload = _loads(row.payload_json, {})
    return {
        "type": "canonical.event",
        "taskId": task_id,
        "eventType": row.event_type,
        "stage": row.stage,
        "actor": row.actor,
        "message": row.message,
        "sequence": row.sequence,
        "occurredAt": row.occurred_at,
        "sourceLabel": row.source_label,
        "traceId": row.trace_id,
        "payload": payload if isinstance(payload, dict) else {},
    }


def _owned_task(db, task_id: str, owner_id: str):
    from src.db.models import DecisionTask

    task = db.query(DecisionTask).filter_by(id=task_id).first()
    if task is None:
        return None
    if task.user_id != owner_id:
        raise CanonicalTaskAccessDenied(task_id)
    return task


def _latest_run(db, task_id: str):
    from src.db.models import SwarmRun

    return (
        db.query(SwarmRun)
        .filter_by(task_id=task_id)
        .order_by(SwarmRun.started_at.desc())
        .first()
    )


def _execution_projection(db, task_id: str):
    from src.db.models import ChancellorRouteDecision
    from src.execution_state import derive_execution_state_from_db

    route = (
        db.query(ChancellorRouteDecision)
        .filter_by(task_id=task_id)
        .order_by(ChancellorRouteDecision.created_at.desc())
        .first()
    )
    if route is None:
        return None
    return derive_execution_state_from_db(
        db,
        task_id=task_id,
        decision_id=route.decision_id,
        mode=route.mode,
    )


def read_task_projection(task_id: str, owner_id: str) -> dict[str, Any] | None:
    """Project canonical task/run/events into the existing taskDetail shape."""
    from src.db.engine import SessionLocal
    from src.db.models import DecreeExecutionEvent, SwarmTaskRun

    db = SessionLocal()
    try:
        task = _owned_task(db, task_id, owner_id)
        if task is None:
            return None
        run = _latest_run(db, task_id)
        task_runs = (
            db.query(SwarmTaskRun).filter_by(swarm_run_id=run.id).all()
            if run is not None
            else []
        )
        events = (
            db.query(DecreeExecutionEvent)
            .filter_by(task_id=task_id)
            .order_by(DecreeExecutionEvent.sequence)
            .all()
        )
        execution = _execution_projection(db, task_id)

        result = (
            {
                "source": "canonical",
                "swarmRunId": run.id,
                "swarmStatus": run.status,
                "timeline": [_event_payload(event) for event in events],
            }
            if run is not None
            else {}
        )
        wire_status = _WIRE_STATUS.get(task.status, task.status)
        mode = run.mode if run is not None else "hybrid"
        run_id = run.id if run is not None else None

        council = [
            {
                "agentCode": item.swarm_id,
                "name": item.role,
                "opinion": _summary(item.output_json),
                "qualityScore": _confidence(item.confidence),
                "status": item.status,
            }
            for item in task_runs
        ]
        group_runs = [
            {
                "groupId": item.swarm_id,
                "name": item.role,
                "status": item.status,
                "subagents": [],
                "aggregateSummary": _summary(item.output_json),
            }
            for item in task_runs
        ]
        return {
            "task": {
                "id": task.id,
                "sourceLabel": run.source_label if run is not None else task.source_label,
                "title": task.refined_edict or task.raw_question[:80],
                "rawCommand": task.raw_question,
                "status": wire_status,
                "executionState": (
                    execution.execution_state if execution is not None else None
                ),
                "executionQuarantined": (
                    execution.quarantined if execution is not None else False
                ),
                "executionStateReason": (
                    execution.reason if execution is not None else None
                ),
                "mode": mode,
                "createdAt": task.created_at,
                "updatedAt": task.updated_at,
                "finalReportId": run_id,
                "result": result,
            },
            "council": council,
            "groupRuns": group_runs,
            "runId": run_id,
        }
    finally:
        db.close()


def read_memorial_decision_projection(
    memorial_id: str, owner_id: str
) -> dict[str, Any] | None:
    """Project the latest formal decision for one legacy memorial/run id."""
    from src.db.engine import SessionLocal
    from src.db.models import EmperorDecision
    from src.decision_task_access import resolve_memorial_task_id

    db = SessionLocal()
    try:
        task_id, _ = resolve_memorial_task_id(db, memorial_id=memorial_id)
        if task_id is None:
            return None
        task = _owned_task(db, task_id, owner_id)
        if task is None:
            return None
        decision = (
            db.query(EmperorDecision)
            .filter_by(task_id=task_id)
            .order_by(EmperorDecision.created_at.desc())
            .first()
        )
        if decision is None:
            return None
        action = {
            "approve": "approve",
            "reject": "reject",
            "request_evidence": "inquire",
        }.get(decision.action, decision.action)
        status = {
            "archived": "archived",
            "rejected": "rejected",
            "awaiting_evidence": "pending",
        }.get(task.status, _WIRE_STATUS.get(task.status, task.status))
        confirmation = _loads(decision.confirmation_record_json, {})
        reviewer = (
            str(confirmation.get("user_id", "皇上"))
            if isinstance(confirmation, dict)
            else "皇上"
        )
        return {
            "status": status,
            "review": {
                "id": decision.id,
                "memorialId": memorial_id,
                "action": action,
                "comment": decision.reason or "",
                "reviewer": reviewer,
                "createdAt": decision.created_at,
                "sourceLabel": "canonical",
            },
        }
    finally:
        db.close()


def read_stream_snapshot(
    task_id: str, owner_id: str, *, after_sequence: int = 0
) -> dict[str, Any] | None:
    """Read an ordered event batch plus the current canonical task snapshot."""
    from src.db.engine import SessionLocal
    from src.db.models import DecreeExecutionEvent

    db = SessionLocal()
    try:
        task = _owned_task(db, task_id, owner_id)
        if task is None:
            return None
        run = _latest_run(db, task_id)
        execution = _execution_projection(db, task_id)
        events = (
            db.query(DecreeExecutionEvent)
            .filter(
                DecreeExecutionEvent.task_id == task_id,
                DecreeExecutionEvent.sequence > after_sequence,
            )
            .order_by(DecreeExecutionEvent.sequence)
            .all()
        )
        wire_status = _WIRE_STATUS.get(task.status, task.status)
        terminal = (
            execution.terminal
            if execution is not None
            else task.status in _TERMINAL_TASK_STATUSES
        )
        return {
            "events": [_stream_event(event, task_id) for event in events],
            "snapshot": {
                "type": "canonical.snapshot",
                "taskId": task_id,
                "status": wire_status,
                "executionState": (
                    execution.execution_state if execution is not None else None
                ),
                "executionQuarantined": (
                    execution.quarantined if execution is not None else False
                ),
                "executionStateReason": (
                    execution.reason if execution is not None else None
                ),
                "terminal": terminal,
                "runId": run.id if run is not None else None,
                "sourceLabel": (
                    run.source_label if run is not None else task.source_label
                ),
                "error": run.error if run is not None else None,
            },
        }
    finally:
        db.close()
