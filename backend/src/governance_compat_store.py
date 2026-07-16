"""Minimal compatibility projection for governance bills on canonical DecisionTask."""

from __future__ import annotations

import json
from typing import Any

_DECISION_TYPE = "governance_compat_bill"


def _session():
    from src.db.engine import SessionLocal

    return SessionLocal()


def _decode(row) -> dict[str, Any]:
    payload = json.loads(row.draft_edict_json or "{}")
    payload.setdefault("id", row.id)
    payload.setdefault("command", row.raw_question)
    payload.setdefault("state", row.status)
    payload.setdefault("sourceLabel", row.source_label)
    return payload


def list_bills() -> list[dict[str, Any]]:
    from src.db.models import DecisionTask

    db = _session()
    try:
        rows = (
            db.query(DecisionTask)
            .filter_by(decision_type=_DECISION_TYPE)
            .order_by(DecisionTask.updated_at.desc())
            .all()
        )
        return [_decode(row) for row in rows]
    finally:
        db.close()


def get_bill(bill_id: str) -> dict[str, Any] | None:
    from src.db.models import DecisionTask

    db = _session()
    try:
        row = db.query(DecisionTask).filter_by(id=bill_id, decision_type=_DECISION_TYPE).first()
        return _decode(row) if row is not None else None
    finally:
        db.close()


def save_bill(bill: dict[str, Any], *, actor: str) -> dict[str, Any]:
    from src.decision_task_kernel import create_decision_task
    from src.db.models import DecisionTask

    db = _session()
    try:
        raw_question = str(
            bill.get("command") or bill.get("title") or "未命名案卷"
        )
        row = db.query(DecisionTask).filter_by(id=str(bill["id"])).first()
        if row is not None and row.decision_type != _DECISION_TYPE:
            raise RuntimeError(f"governance bill id collides with non-compat DecisionTask: {bill['id']}")
        if row is None:
            row = create_decision_task(
                db,
                task_id=str(bill["id"]),
                user_id=actor,
                raw_question=raw_question,
                refined_edict=None,
                decision_type=_DECISION_TYPE,
                status=str(bill.get("state") or "drafted"),
                source_label=str(bill.get("sourceLabel") or "FALLBACK"),
                risk_flags=[],
                known_facts=[],
                unknown_gaps=[],
                recommended_departments=[],
                draft_edict=bill,
                now=str(bill.get("createdAt") or bill.get("lastTransitionAt") or ""),
                tenant_id=None,
            )
        row.user_id = actor
        row.raw_question = raw_question
        row.decision_type = _DECISION_TYPE
        row.status = str(bill.get("state") or "drafted")
        row.source_label = str(bill.get("sourceLabel") or "FALLBACK")
        row.draft_edict_json = json.dumps(bill, ensure_ascii=False, sort_keys=True)
        row.updated_at = str(bill.get("lastTransitionAt") or row.updated_at)
        db.commit()
        return dict(bill)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
