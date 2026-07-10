"""状态接口装配（阶段2b）。

见 docs/super-chancellor-routing-implementation-plan-2026-07-10.md 第6.7/10.3节：
状态接口要能回答"圣旨当前在哪里、谁在处理、为什么阻塞、下一步是什么"。

映射说明（诚实标注，不是精确双向状态机）：现有 DecisionTask.status 是一套
历史上逐步长出来的状态值(draft/awaiting_emperor_confirm/edict_recorded/...)，
本方案第8节画的理想状态机(drafting→...→completed)是目标态，两者之间没有
一一对应的正式定义。下面的映射是"用现有状态值尽量回答契约要求的问题"，
不是声称已经实现了方案第8节的完整状态机——那需要阶段2的后续迭代把
DecisionTask.status 本身重新定义到方案状态机词表上。
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from src.chancellor.contracts import (
    DecreeExecutionStatusV1,
    DepartmentAssignment,
    RouteDecisionV2,
    TimelineEvent,
)

if TYPE_CHECKING:
    from sqlalchemy.orm import Session


def record_timeline_event(
    db: "Session", *, task_id: str, stage: str, actor: str, message: str
) -> None:
    """写一行 DecreeExecutionEvent。调用方负责 commit——本函数只 add，
    保持跟其余下旨记录同一事务，不单独提交产生不一致窗口。"""
    from datetime import datetime, timezone
    from hashlib import sha1

    from src.db.models import DecreeExecutionEvent

    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    event_id = f"evt_{sha1(f'{task_id}|{stage}|{now}'.encode()).hexdigest()[:12]}"
    db.add(
        DecreeExecutionEvent(
            id=event_id,
            task_id=task_id,
            stage=stage,
            actor=actor,
            message=message,
            occurred_at=now,
        )
    )


_STAGE_MAP: dict[str, str] = {
    "draft": "drafting",
    "awaiting_emperor_confirm": "awaiting_emperor_confirm",
    "draft_cancelled": "cancelled",
    "direct_completed": "completed",
    "edict_recorded": "executing",
    "reviewing": "department_reporting",
    "awaiting_decision": "awaiting_emperor_decision",
    "awaiting_evidence": "awaiting_evidence",
    "rejected": "rejected",
    "archived": "completed",
}

_NEXT_STAGE_MAP: dict[str, str | None] = {
    "drafting": "awaiting_emperor_confirm",
    "awaiting_emperor_confirm": "chancellor_routing",
    "executing": "department_reporting",
    "department_reporting": "awaiting_emperor_decision",
    "awaiting_emperor_decision": "completed",
    "awaiting_evidence": "department_reporting",
    "completed": None,
    "rejected": None,
    "cancelled": None,
}

_OWNER_MAP: dict[str, str] = {
    "drafting": "皇上",
    "awaiting_emperor_confirm": "皇上",
    "executing": "军机处",
    "department_reporting": "军机处",
    "awaiting_emperor_decision": "皇上",
    "awaiting_evidence": "皇上",
    "completed": "已完结",
    "rejected": "已驳回",
    "cancelled": "已取消",
}


def build_decree_execution_status(
    db: "Session", task_id: str
) -> DecreeExecutionStatusV1 | None:
    """返回 None 表示 task 尚未下旨确认(没有 ChancellorRouteDecision)——
    这种情况下"执行状态"这个概念本身还不存在，不伪造一个占位路由快照。"""
    from src.db.models import ChancellorRouteDecision, DecisionTask

    task = db.query(DecisionTask).filter_by(id=task_id).first()
    if task is None:
        return None

    latest_decision_row = (
        db.query(ChancellorRouteDecision)
        .filter_by(task_id=task_id)
        .order_by(ChancellorRouteDecision.created_at.desc())
        .first()
    )
    if latest_decision_row is None:
        return None

    route_decision = RouteDecisionV2.model_validate_json(
        latest_decision_row.decision_json
    )

    stage = _STAGE_MAP.get(task.status, task.status)
    departments = [
        DepartmentAssignment(
            department=p.department,
            agent_id=p.agent_id,
            status=_department_status_for(stage, index),
            latest_message=p.reason,
            started_at=None,
            completed_at=None,
        )
        for index, p in enumerate(route_decision.participants)
    ]

    blocked_reason = None
    if stage == "awaiting_evidence":
        gaps = route_decision.evidence_gaps
        blocked_reason = (
            f"证据不足：{'、'.join(gaps[:3])}" if gaps else "证据不足，需要补充材料"
        )

    timeline = _load_timeline(db, task_id)
    latest_message = timeline[-1].message if timeline else f"任务状态：{task.status}"

    return DecreeExecutionStatusV1(
        task_id=task_id,
        current_stage=stage,
        current_owner=_OWNER_MAP.get(stage, "军机处"),
        latest_message=latest_message,
        next_stage=_NEXT_STAGE_MAP.get(stage),
        blocked_reason=blocked_reason,
        route_decision=route_decision,
        departments=departments,
        timeline=timeline,
    )


def _department_status_for(stage: str, index: int) -> str:
    if stage == "completed":
        return "reported"
    if stage in {"department_reporting", "awaiting_emperor_decision"}:
        return "executing" if index == 0 else "reported"
    if stage == "executing":
        return "executing"
    return "planned"


def _load_timeline(db: "Session", task_id: str) -> list[TimelineEvent]:
    from src.db.models import DecreeExecutionEvent

    rows = (
        db.query(DecreeExecutionEvent)
        .filter_by(task_id=task_id)
        .order_by(DecreeExecutionEvent.occurred_at)
        .all()
    )
    return [
        TimelineEvent(
            event_id=row.id,
            stage=row.stage,
            actor=row.actor,
            message=row.message,
            occurred_at=row.occurred_at,
        )
        for row in rows
    ]
