"""Owned DecisionTask accessors for business routes.

Routes should not repeat a lookup followed by an easy-to-forget ownership
check. This module is the migration point toward one structurally guarded read
boundary, complementing the single writer in ``decision_task_kernel``.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from src.db.models import DecisionTask


def get_owned_decision_task(
    db: Session, *, task_id: str, requester_id: str
) -> tuple[DecisionTask | None, str | None]:
    """Return a formal task only when it belongs to the requester."""
    decision = db.query(DecisionTask).filter_by(id=task_id).first()
    if decision is None:
        return None, "正式 DecisionTask 不存在"
    if decision.user_id != requester_id:
        return None, "无权访问他人的 DecisionTask"
    return decision, None
