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

from typing import TYPE_CHECKING, Any, cast

from src.chancellor.contracts import (
    DecreeExecutionStatusV1,
    DepartmentAssignment,
    RouteDecisionV2,
    TimelineEvent,
)

if TYPE_CHECKING:
    from sqlalchemy.orm import Session


_TENANT_FROM_TASK = object()
_REQUEST_ID_FROM_TASK = object()


def record_timeline_event(
    db: "Session",
    *,
    task_id: str,
    stage: str,
    actor: str,
    message: str,
    event_type: str = "timeline.note",
    trace_id: str | None = None,
    source_label: str = "FALLBACK",
    payload: dict[str, Any] | None = None,
    idempotency_key: str | None = None,
    tenant_id: int | None | object = _TENANT_FROM_TASK,
    request_id: str | None | object = _REQUEST_ID_FROM_TASK,
    release_id: str | None = None,
    model_version: str | None = None,
) -> str:
    """写一行 DecreeExecutionEvent。调用方负责 commit——本函数只 add，
    保持跟其余下旨记录同一事务，不单独提交产生不一致窗口。

    2026-07-11 生产实测发现的真实故障：event_id 原来只哈希
    task_id|stage|秒级时间戳，不含 actor/message/随机量——confirm-edict 写的
    chancellor "executing" 事件，和 dispatch_after_commit 几乎同一秒内触发的
    worker "executing" 事件会算出同一个 id，撞 UNIQUE 约束，
    直接把整个 outbox 事件炸成 failed(_execute_council 还没真正调蜂群就
    先死在这一行)，且没有自动重试——上书房从此卡在"蜂群执行中"占位态，
    实际上后端已经放弃处理。这里把 actor/message 和随机量都并入哈希，
    消除同秒同 stage 的确定性碰撞。"""
    import json
    import secrets
    from datetime import datetime, timezone
    from hashlib import sha1

    import sqlalchemy as sa

    from src.db.models import DecreeExecutionEvent

    if tenant_id is _TENANT_FROM_TASK:
        from src.core_tenant_lineage import tenant_id_for_task

        event_tenant_id = tenant_id_for_task(db, task_id)
    else:
        event_tenant_id = cast(int | None, tenant_id)

    if request_id is _REQUEST_ID_FROM_TASK:
        # R0-REQ-020：调用方不用逐个改传参，request_id 自动从 DecisionTask 带出。
        from src.db.models import DecisionTask

        event_request_id = db.query(DecisionTask.request_id).filter_by(id=task_id).scalar()
    else:
        event_request_id = cast("str | None", request_id)
    if release_id is None:
        import os

        release_id = os.environ.get("CHAOTANG_RELEASE_ID", "unknown")

    if source_label not in {"LIVE", "MIXED", "FALLBACK", "DEMO"}:
        raise ValueError(f"unsupported event source_label: {source_label}")
    payload_json = json.dumps(payload or {}, ensure_ascii=False, sort_keys=True, separators=(",", ":"))

    if idempotency_key:
        existing = db.query(DecreeExecutionEvent).filter_by(task_id=task_id, idempotency_key=idempotency_key).first()
        if existing is not None:
            from src.core_tenant_lineage import (
                assert_known_tenant_lineage_consistent,
                tenant_id_for_task,
            )

            assert_known_tenant_lineage_consistent(
                context=f"decree_event:{task_id}:{idempotency_key}",
                task_tenant_id=tenant_id_for_task(db, task_id),
                existing_tenant_id=existing.tenant_id,
                replay_tenant_id=event_tenant_id,
            )
            immutable = {
                "stage": stage,
                "actor": actor,
                "message": message,
                "event_type": event_type,
                "trace_id": trace_id,
                "source_label": source_label,
                "payload_json": payload_json,
            }
            bound = {key: getattr(existing, key) for key in immutable}
            if bound != immutable:
                raise ValueError("idempotency key already binds a different decree event payload")
            return existing.id

    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    nonce = secrets.token_hex(4)
    event_id = f"evt_{sha1(f'{task_id}|{stage}|{actor}|{message}|{now}|{nonce}'.encode()).hexdigest()[:12]}"
    # 2026-07-12(方案阶段4)：occurred_at 只精确到秒，同一秒内的多个事件排序不确定。
    # sequence 按 task_id 单调递增。SessionLocal 全局关闭了 autoflush(src/db/engine.py)，
    # 所以同一事务内此前 db.add 过、尚未 flush 的同任务事件，MAX 查询默认看不到——
    # 这里显式 flush 一次，保证同一事务内连续多次调用也不会算出重复的 sequence。
    db.flush()
    prev_max = db.query(sa.func.max(DecreeExecutionEvent.sequence)).filter_by(task_id=task_id).scalar()
    next_sequence = (prev_max or 0) + 1
    db.add(
        DecreeExecutionEvent(
            id=event_id,
            tenant_id=event_tenant_id,
            task_id=task_id,
            stage=stage,
            actor=actor,
            message=message,
            event_type=event_type,
            trace_id=trace_id,
            source_label=source_label,
            payload_json=payload_json,
            idempotency_key=idempotency_key,
            request_id=event_request_id,
            release_id=release_id,
            model_version=model_version,
            occurred_at=now,
            sequence=next_sequence,
        )
    )
    from src.migration_telemetry import record_canonical_chain_event_after_commit

    record_canonical_chain_event_after_commit(
        db,
        "decree_execution_event_written",
        caller_id="chancellor.record_timeline_event",
    )
    return event_id


def decide_post_review_status(quality_result: dict) -> str:
    """质量门通过则进入待裁决，否则打回补证。

    2026-07-12 复审发现：sync 路径(shangshufang_swarm_deepen)和 async 路径
    (outbox_worker._execute_council)此前各自独立写了一份完全相同的三元表达式，
    两处一旦有一边改了判断条件、另一边忘了同步，就会出现"同一份 quality_result
    在两条路径上判成不同状态"的漂移。收口成这一处，两条路径都改成调用它。"""
    return "awaiting_decision" if quality_result["passed"] else "awaiting_evidence"


# R0-REQ-022：direct 接单回执、worker ACK 或部分结果只能表示已受理/办理中；
# DELIVERED 只能由服务端完成公式派生。"direct_completed" 是 direct_receipt_for()
# 生成的回执状态，零质量门，不得映射成 "completed"（execution_state.py 早已把
# 同一路径正确判成 "receipt_only"，这里复用同一字面量，两层用词一致）。
# "archived" 是唯一需要先过 REQ-014 那道 FinalMemorial 质量/来源门才能到达的
# 状态，才是真正"已交付"，映射成 "delivered"（新字面量，跟 "receipt_only" 区分开）。
_STAGE_MAP: dict[str, str] = {
    "draft": "drafting",
    "awaiting_emperor_confirm": "awaiting_emperor_confirm",
    "draft_cancelled": "cancelled",
    "direct_completed": "receipt_only",
    "edict_recorded": "executing",
    "reviewing": "department_reporting",
    "awaiting_decision": "awaiting_emperor_decision",
    "awaiting_evidence": "awaiting_evidence",
    "rejected": "rejected",
    "archived": "delivered",
    "task_cancelled": "cancelled",
    "execution_failed": "execution_failed",
}

_NEXT_STAGE_MAP: dict[str, str | None] = {
    "drafting": "awaiting_emperor_confirm",
    "awaiting_emperor_confirm": "chancellor_routing",
    "executing": "department_reporting",
    "department_reporting": "awaiting_emperor_decision",
    "awaiting_emperor_decision": "delivered",
    "awaiting_evidence": "department_reporting",
    "receipt_only": None,
    "delivered": None,
    "rejected": None,
    "cancelled": None,
    "execution_failed": None,
}

_OWNER_MAP: dict[str, str] = {
    "drafting": "皇上",
    "awaiting_emperor_confirm": "皇上",
    "executing": "军机处",
    "department_reporting": "军机处",
    "awaiting_emperor_decision": "皇上",
    "awaiting_evidence": "皇上",
    "receipt_only": "承办方",
    "delivered": "已完结",
    "rejected": "已驳回",
    "cancelled": "已取消",
    "execution_failed": "人工",
}


def build_decree_execution_status(db: "Session", task_id: str) -> DecreeExecutionStatusV1 | None:
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

    route_decision = RouteDecisionV2.model_validate_json(latest_decision_row.decision_json)

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
        blocked_reason = f"证据不足：{'、'.join(gaps[:3])}" if gaps else "证据不足，需要补充材料"
    elif stage == "execution_failed":
        # R0-REQ-018：硬重试上限打满后必须给出明确终态和人工接管理由，不得停留
        # 在 "executing" 假装还在跑，也不得静默重试。last_error 来自把 task 推
        # 进 execution_failed 的那个 OutboxEvent(outbox_worker.py::apply_failure_state)。
        from src.db.models import OutboxEvent

        dead_letter_event = (
            db.query(OutboxEvent)
            .filter_by(task_id=task_id, status="dead_letter")
            .order_by(OutboxEvent.created_at.desc())
            .first()
        )
        detail = dead_letter_event.last_error if dead_letter_event else None
        blocked_reason = (
            f"执行失败，已达最大重试次数，需人工介入：{detail}"
            if detail
            else "执行失败，已达最大重试次数，需人工介入"
        )

    timeline = _load_timeline(db, task_id)
    latest_message = timeline[-1].message if timeline else f"任务状态：{task.status}"
    from src.execution_state import derive_execution_state_from_db

    execution = derive_execution_state_from_db(
        db,
        task_id=task_id,
        decision_id=latest_decision_row.decision_id,
        mode=route_decision.mode,
    )
    if execution.quarantined and blocked_reason is None:
        blocked_reason = execution.reason

    return DecreeExecutionStatusV1(
        task_id=task_id,
        request_id=task.request_id,
        execution_state=execution.execution_state,
        execution_quarantined=execution.quarantined,
        execution_state_reason=execution.reason,
        execution_attempt=execution.selected_attempt,
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
    """独立审查发现(2026-07-10)：此前按 index==0 区分"第一个部门在执行、其余已
    汇报"，但 _execute_council() 是单次黑箱调用，跑完才会把 task.status 推进到
    awaiting_decision——到那一步时全部部门都已经跑完，不存在"部分汇报"；而
    reviewing(department_reporting)阶段是刚派单、真实调用还没跑，也不存在
    "部分已汇报"。这里改成按 stage 统一给同一个 status，不编造实际不存在的
    逐部门进度粒度。index 参数保留只是为了不改调用签名，当前未使用。"""
    del index
    if stage in {"delivered", "awaiting_emperor_decision"}:
        return "reported"
    if stage in {"executing", "department_reporting"}:
        return "executing"
    return "planned"


def _load_timeline(db: "Session", task_id: str) -> list[TimelineEvent]:
    import json

    from src.db.models import DecreeExecutionEvent

    rows = db.query(DecreeExecutionEvent).filter_by(task_id=task_id).order_by(DecreeExecutionEvent.sequence).all()
    return [
        TimelineEvent(
            event_id=row.id,
            stage=row.stage,
            actor=row.actor,
            message=row.message,
            occurred_at=row.occurred_at,
            sequence=row.sequence,
            event_type=row.event_type,
            trace_id=row.trace_id,
            source_label=row.source_label,
            payload=json.loads(row.payload_json or "{}"),
            release_id=row.release_id,
            model_version=row.model_version,
        )
        for row in rows
    ]
