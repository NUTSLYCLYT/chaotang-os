"""outbox worker（阶段2）。消费 decree_dispatcher.enqueue_dispatch 写入的事件。

见 docs/super-chancellor-routing-implementation-plan-2026-07-10.md 第6.7/14节。

worker 要求(方案原文)：幂等消费、指数退避重试、最大重试次数和死信状态、
单部门失败不丢失其他部门结果、超时后写入明确阻塞原因。本实现覆盖前三条
(幂等/重试上限/死信)；"单部门失败不丢其他部门结果"由 run_swarm_execution_loop
自身的质量门承接(不在本模块重复)；指数退避交给外部调度(process_pending_events
的调用方决定何时重跑 failed 事件)，本模块只负责单次尝试的状态流转。
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from hashlib import sha1
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from sqlalchemy.orm import Session


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _make_id(prefix: str, *parts: object) -> str:
    seed = "|".join(str(p) for p in parts) or _now_iso()
    return f"{prefix}_{sha1(seed.encode('utf-8')).hexdigest()[:12]}"


def _record_timeline(
    db: "Session", *, task_id: str, stage: str, actor: str, message: str
) -> None:
    from src.chancellor.decree_status import record_timeline_event

    record_timeline_event(
        db, task_id=task_id, stage=stage, actor=actor, message=message
    )


def _execute_direct(db: "Session", task_id: str) -> dict[str, Any]:
    """direct 模式：confirm-edict 同步内已经用 direct_receipt_for() 生成完整回执，
    outbox worker 只需要确认+记录时间线，不需要额外调用蜂群。"""
    from src.db.models import DecisionTask

    task = db.query(DecisionTask).filter_by(id=task_id).first()
    if task is None:
        raise ValueError(f"task_id 不存在: {task_id}")
    _record_timeline(
        db,
        task_id=task_id,
        stage="dispatched",
        actor="worker",
        message="direct 任务单已在下旨时生成完整回执，无需异步执行。",
    )
    return {"mode": "direct", "task_status": task.status}


def _execute_council(db: "Session", task_id: str) -> dict[str, Any]:
    """council 模式：真正触发蜂群深挖。

    刻意不像 web/routers/shangshufang.py::_run_swarm_execution_loop_sync 那样
    强制 FENGQUN_LIVE_SWARM=0——那个包装是为了避免 HTTP 页面点击处理器同步等待
    开放式 LLM 调用超时；后台 worker 不受请求超时限制，应该允许真实 LLM 深挖，
    这正是"确认下旨快速返回，重活挪到后台"这条主链要解决的问题。
    """
    from src.db.models import CourtReview, DecisionTask
    from src.shangshufang_loop import draft_to_dict, draft_edict
    from src.swarm_execution_loop import run_swarm_execution_loop
    from src.swarm_persistence import (
        attach_swarm_result_to_review,
        persist_swarm_execution_result,
    )

    task = db.query(DecisionTask).filter_by(id=task_id).first()
    if task is None:
        raise ValueError(f"task_id 不存在: {task_id}")

    review = (
        db.query(CourtReview)
        .filter_by(task_id=task_id)
        .order_by(CourtReview.created_at.desc())
        .first()
    )
    if review is None:
        raise ValueError(f"task_id={task_id} 没有对应的 CourtReview，无法派单")

    import json

    routing_plan = json.loads(review.routing_plan_json or "{}")
    draft_payload = json.loads(task.draft_edict_json or "null") or draft_to_dict(
        draft_edict(task.raw_question, source_label=task.source_label)
    )

    _record_timeline(
        db,
        task_id=task_id,
        stage="executing",
        actor="worker",
        message="军机处开始异步派单，调用真实蜂群深挖。",
    )
    db.commit()

    swarm_result = run_swarm_execution_loop(
        {
            "task_id": task.id,
            "review_id": review.id,
            "mode": "deep",
            "confirmed_edict": {**draft_payload, "source_label": task.source_label},
            "review_plan": routing_plan,
        }
    )
    persist_swarm_execution_result(db, swarm_result)
    attach_swarm_result_to_review(db, review.id, swarm_result)
    task.status = (
        "awaiting_decision"
        if swarm_result["quality_result"]["passed"]
        else "awaiting_evidence"
    )
    task.updated_at = _now_iso()
    _record_timeline(
        db,
        task_id=task_id,
        stage="department_reporting",
        actor="worker",
        message=f"蜂群深挖完成，任务状态更新为 {task.status}。",
    )
    return {
        "mode": "council",
        "task_status": task.status,
        "swarm_run_id": swarm_result["swarm_run"]["id"],
    }


def process_event(db: "Session", event_id: str) -> dict[str, Any]:
    """消费单个 outbox 事件。幂等：completed/dead_letter 直接跳过，不重复执行。"""
    from src.db.models import OutboxEvent

    event = db.query(OutboxEvent).filter_by(id=event_id).first()
    if event is None:
        return {"status": "not_found", "event_id": event_id}
    if event.status in {"completed", "dead_letter"}:
        return {"status": event.status, "event_id": event_id, "skipped": True}

    event.status = "processing"
    event.updated_at = _now_iso()
    db.commit()

    try:
        if event.event_type == "route.direct":
            result = _execute_direct(db, event.task_id)
        elif event.event_type == "route.council":
            result = _execute_council(db, event.task_id)
        else:
            raise ValueError(f"未知 event_type: {event.event_type}")

        event.status = "completed"
        event.updated_at = _now_iso()
        db.commit()
        return {"status": "completed", "event_id": event_id, "result": result}
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        event = db.query(OutboxEvent).filter_by(id=event_id).first()
        event.attempts += 1
        event.last_error = str(exc)
        event.status = (
            "dead_letter" if event.attempts >= event.max_attempts else "failed"
        )
        event.updated_at = _now_iso()
        db.commit()
        return {"status": event.status, "event_id": event_id, "error": str(exc)}


def process_pending_events(db: "Session", *, limit: int = 10) -> list[dict[str, Any]]:
    """批处理入口：扫描 pending/failed(未达 max_attempts)事件逐个处理。

    供运维重试或未来定时调度调用；不是本次实现的自动触发路径(那条走
    decree_dispatcher.dispatch_after_commit 的即时线程)，这里是补漏用的。
    """
    from src.db.models import OutboxEvent

    candidates = (
        db.query(OutboxEvent)
        .filter(OutboxEvent.status.in_(["pending", "failed"]))
        .order_by(OutboxEvent.created_at)
        .limit(limit)
        .all()
    )
    results = []
    for event in candidates:
        if event.status == "failed" and event.attempts >= event.max_attempts:
            continue
        results.append(process_event(db, event.id))
    return results
