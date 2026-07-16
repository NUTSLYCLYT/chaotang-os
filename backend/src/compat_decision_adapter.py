"""Adapt legacy business ingress into the canonical DecisionTask fact.

Compatibility routes may keep their response shapes and short-lived execution
progress, but the durable business task must be created through the same kernel
as the Shangshufang decision loop.
"""

from __future__ import annotations

import importlib
from typing import Any

from sqlalchemy.orm import Session

from src.decision_task_kernel import create_decision_task
from src.shangshufang_loop import draft_edict, draft_to_dict, now_iso


def persist_compat_decision_task(
    *,
    task_id: str,
    user_id: str,
    command: str,
    source_label: str,
    compat_entrypoint: str,
    tenant_id: int | None,
) -> None:
    """Persist one unconfirmed DecisionTask for a legacy compatibility request."""
    db_engine = importlib.import_module("src.db.engine")
    db = db_engine.SessionLocal()
    try:
        add_compat_decision_task(
            db,
            task_id=task_id,
            user_id=user_id,
            command=command,
            source_label=source_label,
            compat_entrypoint=compat_entrypoint,
            tenant_id=tenant_id,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def add_compat_decision_task(
    db: Session,
    *,
    task_id: str,
    user_id: str,
    command: str,
    source_label: str,
    compat_entrypoint: str,
    tenant_id: int | None,
    status: str = "awaiting_emperor_confirm",
    draft_context: dict[str, Any] | None = None,
) -> None:
    """Add a compatibility DecisionTask to the caller-owned transaction."""
    edict = draft_edict(command, source_label=source_label)
    draft_payload = {
        **draft_to_dict(edict),
        "compat_entrypoint": compat_entrypoint,
        **(draft_context or {}),
    }
    now = now_iso()
    create_decision_task(
        db,
        task_id=task_id,
        user_id=user_id,
        raw_question=edict.original_question,
        refined_edict=edict.refined_edict,
        decision_type=edict.decision_type,
        status=status,
        source_label=source_label,
        risk_flags=edict.risk_flags,
        known_facts=edict.known_facts,
        unknown_gaps=edict.unknown_gaps,
        recommended_departments=edict.recommended_departments,
        draft_edict=draft_payload,
        now=now,
        tenant_id=tenant_id,
    )
