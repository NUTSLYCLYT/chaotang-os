"""DecisionTask 的唯一运行时创建入口。

业务路由只能提交已经判定好的 workflow profile 字段；ORM 构造、身份底线和
JSON 序列化由本模块统一掌握，避免正式下旨与专用流程形成多套任务事实。
"""

from __future__ import annotations

import json
from hashlib import sha1
from typing import TYPE_CHECKING, Any

from sqlalchemy.orm import Session

from src.db.models import DecisionTask

if TYPE_CHECKING:
    from src.contracts.mission_contract import ContractIntakeV1


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def _make_request_id(task_id: str, now: str) -> str:
    """R0-REQ-020：任务创建时生成一次、全生命周期不变的请求身份。"""
    return f"req_{sha1(f'{task_id}|{now}'.encode()).hexdigest()[:12]}"


def create_decision_task(
    db: Session,
    *,
    task_id: str,
    user_id: str,
    raw_question: str,
    refined_edict: str | None,
    decision_type: str | None,
    status: str,
    source_label: str,
    risk_flags: list[Any],
    known_facts: list[Any],
    unknown_gaps: list[Any],
    recommended_departments: list[Any],
    draft_edict: dict[str, Any] | None,
    now: str,
    tenant_id: int | None,
    contract_scope: ContractIntakeV1 | None = None,
) -> DecisionTask:
    """构造并登记一条正式 DecisionTask；事务提交仍由调用方统一控制。"""
    if not task_id.strip():
        raise ValueError("decision task id is required")
    if not user_id.strip():
        raise ValueError("decision task requires an owner")
    if not raw_question.strip():
        raise ValueError("decision task raw question is required")
    if not status.strip() or not source_label.strip():
        raise ValueError("decision task status and source label are required")

    task = DecisionTask(
        id=task_id,
        tenant_id=tenant_id,
        user_id=user_id,
        request_id=_make_request_id(task_id, now),
        raw_question=raw_question,
        refined_edict=refined_edict,
        decision_type=decision_type,
        status=status,
        source_label=source_label,
        risk_flags_json=_json(risk_flags),
        known_facts_json=_json(known_facts),
        unknown_gaps_json=_json(unknown_gaps),
        recommended_departments_json=_json(recommended_departments),
        draft_edict_json=_json(draft_edict) if draft_edict is not None else None,
        contract_scope_json=(
            _json(contract_scope.model_dump(mode="json"))
            if contract_scope is not None
            else None
        ),
        created_at=now,
        updated_at=now,
    )
    db.add(task)
    return task
