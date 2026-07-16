"""Nullable tenant lineage helpers for the eight canonical decision-chain tables.

P4.5f records ownership provenance only.  It does not claim tenant isolation:
rows with no trustworthy upstream tenant remain NULL and are surfaced through
the quarantine projection below instead of being assigned to a default tenant.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import inspect
from sqlalchemy.orm import Session

from src.db.models import (
    ChancellorRouteDecision,
    CourtReview,
    DecisionTask,
    DecreeExecutionEvent,
    EmperorDecision,
    FinalMemorial,
    OutboxEvent,
    ShiguanArchive,
)

CORE_TENANT_LINEAGE_MODELS = (
    (DecisionTask, "id"),
    (ChancellorRouteDecision, "decision_id"),
    (OutboxEvent, "id"),
    (DecreeExecutionEvent, "id"),
    (CourtReview, "id"),
    (FinalMemorial, "id"),
    (EmperorDecision, "id"),
    (ShiguanArchive, "id"),
)


def tenant_id_for_task(db: Session, task_id: str) -> int | None:
    """Inherit lineage from the canonical task root; never resolve a default."""
    for pending in db.new:
        if isinstance(pending, DecisionTask) and pending.id == task_id:
            return pending.tenant_id
    if not inspect(db.connection()).has_table(DecisionTask.__tablename__):
        return None
    task = db.get(DecisionTask, task_id)
    return task.tenant_id if task is not None else None


def assert_no_tenant_lineage_conflict(db: Session, *, task_id: str, inherited_tenant_id: int | None) -> None:
    """Fail closed when two known lineage values disagree.

    A legacy NULL remains quarantinable and compatible.  It is not promoted to
    an owner here; only a conflict between two explicit values is rejected.
    """
    task_tenant_id = tenant_id_for_task(db, task_id)
    if task_tenant_id is not None and inherited_tenant_id is not None and task_tenant_id != inherited_tenant_id:
        raise RuntimeError(
            "tenant lineage conflict: "
            f"task_id={task_id} task_tenant_id={task_tenant_id} "
            f"inherited_tenant_id={inherited_tenant_id}"
        )


def list_tenant_lineage_quarantine(db: Session, *, task_id: str | None = None) -> list[dict[str, Any]]:
    """List visibly unowned core rows for audit/backfill planning."""
    quarantined: list[dict[str, Any]] = []
    for model, identity_field in CORE_TENANT_LINEAGE_MODELS:
        query = db.query(model).filter(model.tenant_id.is_(None))
        if task_id is not None:
            task_column = model.id if model is DecisionTask else model.task_id
            query = query.filter(task_column == task_id)
        for row in query.all():
            quarantined.append(
                {
                    "table": model.__tablename__,
                    "row_id": str(getattr(row, identity_field)),
                    "task_id": str(row.id if model is DecisionTask else row.task_id),
                    "reason": "tenant_context_unavailable",
                }
            )
    return quarantined
