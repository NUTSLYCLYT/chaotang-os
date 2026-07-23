"""outbox worker（阶段2）。消费 decree_dispatcher.enqueue_dispatch 写入的事件。

见 docs/super-chancellor-routing-implementation-plan-2026-07-10.md 第6.7/14节。

worker 要求(方案原文)：幂等消费、指数退避重试、最大重试次数和死信状态、
单部门失败不丢失其他部门结果、超时后写入明确阻塞原因。本实现覆盖前三条
(幂等/重试上限/死信)；"单部门失败不丢其他部门结果"由 run_swarm_execution_loop
自身的质量门承接(不在本模块重复)；指数退避交给外部调度(process_pending_events
的调用方决定何时重跑 failed 事件)，本模块只负责单次尝试的状态流转。
"""

from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha1
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from src.db.models import OutboxEvent


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _make_id(prefix: str, *parts: object) -> str:
    seed = "|".join(str(p) for p in parts) or _now_iso()
    return f"{prefix}_{sha1(seed.encode('utf-8')).hexdigest()[:12]}"


_TASK_TERMINAL_STATUSES = frozenset(
    {"execution_failed", "archived", "rejected", "task_cancelled", "draft_cancelled"}
)


def _promote_task_to_execution_failed(db: "Session", task_id: str) -> None:
    """R0-REQ-018：硬重试上限打满(dead_letter)必须让人类可见层进入明确终态，
    不得停留在 "executing" 假装还在跑，也不得静默重试。此前只写
    OutboxEvent.status，DecisionTask.status 永远不知道重试已经打满。已经处于
    其他终态(比如已经 archived/reject/cancel 过)的任务不倒退回
    execution_failed——终态之间不互相覆盖。"""
    from src.db.models import DecisionTask

    task = db.query(DecisionTask).filter_by(id=task_id).first()
    if task is not None and task.status not in _TASK_TERMINAL_STATUSES:
        task.status = "execution_failed"
        task.updated_at = _now_iso()


def _task_source_label(db: "Session", task_id: str) -> str:
    from src.db.models import DecisionTask

    task = db.query(DecisionTask).filter_by(id=task_id).first()
    if task is None:
        return "FALLBACK"
    if task.source_label in {"LIVE_SWARM", "LIVE_ENGINE"}:
        return "LIVE"
    if task.source_label in {"LIVE", "MIXED", "FALLBACK", "DEMO"}:
        return task.source_label
    return "FALLBACK"


def _record_timeline(
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
    tenant_id: int | None,
) -> None:
    from src.chancellor.decree_status import record_timeline_event

    record_timeline_event(
        db,
        task_id=task_id,
        stage=stage,
        actor=actor,
        message=message,
        event_type=event_type,
        trace_id=trace_id,
        source_label=source_label,
        payload=payload,
        idempotency_key=idempotency_key,
        tenant_id=tenant_id,
    )


def _execute_direct(
    db: "Session",
    task_id: str,
    *,
    outbox_event_id: str,
    attempt: int,
    tenant_id: int | None,
) -> dict[str, Any]:
    """direct 模式：confirm-edict 同步内已经用 direct_receipt_for() 生成完整回执，
    outbox worker 只需要确认+记录时间线，不需要额外调用蜂群。"""
    from src.db.models import CourtReview, DecisionTask

    task = db.query(DecisionTask).filter_by(id=task_id).first()
    if task is None:
        raise ValueError(f"task_id 不存在: {task_id}")
    review = (
        db.query(CourtReview)
        .filter_by(task_id=task_id, review_status="direct_completed")
        .order_by(CourtReview.created_at.desc())
        .first()
    )
    if review is None or not review.memorial_json:
        raise ValueError(f"task_id={task_id} 缺少可核验的 direct 回执")
    from src.core_tenant_lineage import assert_known_tenant_lineage_consistent

    assert_known_tenant_lineage_consistent(
        context=f"direct_worker:{outbox_event_id}",
        task_tenant_id=task.tenant_id,
        outbox_tenant_id=tenant_id,
        review_tenant_id=review.tenant_id,
    )
    _record_timeline(
        db,
        task_id=task_id,
        stage="dispatched",
        actor="worker",
        message="direct 任务单已在下旨时生成完整回执，无需异步执行。",
        event_type="dispatch.receipt_only",
        trace_id=review.id,
        source_label=task.source_label,
        payload={
            "attempt": attempt,
            "outbox_event_id": outbox_event_id,
            "review_id": review.id,
        },
        idempotency_key=(f"dispatch.receipt_only:{outbox_event_id}:attempt:{attempt}"),
        tenant_id=tenant_id,
    )
    return {"mode": "direct", "task_status": task.status}


def _execute_council(
    db: "Session",
    task_id: str,
    *,
    outbox_event_id: str,
    attempt: int,
    tenant_id: int | None,
) -> dict[str, Any]:
    """council 模式：真正触发蜂群深挖。

    刻意不像 web/routers/shangshufang.py::_run_swarm_execution_loop_sync 那样
    强制 FENGQUN_LIVE_SWARM=0——那个包装是为了避免 HTTP 页面点击处理器同步等待
    开放式 LLM 调用超时；后台 worker 不受请求超时限制，应该允许真实 LLM 深挖，
    这正是"确认下旨快速返回，重活挪到后台"这条主链要解决的问题。
    """
    from src.db.models import CourtReview, DecisionTask
    from src.shangshufang_loop import draft_edict, draft_to_dict
    from src.swarm_execution_loop import run_swarm_execution_loop
    from src.swarm_persistence import (
        attach_swarm_result_to_review,
        persist_swarm_execution_result,
    )

    task = db.query(DecisionTask).filter_by(id=task_id).first()
    if task is None:
        raise ValueError(f"task_id 不存在: {task_id}")

    review = db.query(CourtReview).filter_by(task_id=task_id).order_by(CourtReview.created_at.desc()).first()
    if review is None:
        raise ValueError(f"task_id={task_id} 没有对应的 CourtReview，无法派单")
    from src.core_tenant_lineage import assert_known_tenant_lineage_consistent

    assert_known_tenant_lineage_consistent(
        context=f"council_worker:{outbox_event_id}",
        task_tenant_id=task.tenant_id,
        outbox_tenant_id=tenant_id,
        review_tenant_id=review.tenant_id,
    )

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
        event_type="dispatch.started",
        trace_id=review.id,
        source_label=task.source_label,
        payload={"review_id": review.id},
        idempotency_key=f"dispatch.started:{review.id}",
        tenant_id=tenant_id,
    )
    db.commit()

    # 单一事实源(阶段0任务0.2)：draft_edict 阶段已经算出 recommended_departments，
    # 这里必须直接把它传给 run_swarm_execution_loop 的部门覆盖入口——不传的话
    # run_swarm_execution_loop 内部会用 route_swarms() 自己重新扫一遍关键词，
    # 变成跟"记录的参与者"互不知道对方存在的第二套独立推断，两者平时凑巧一致，
    # 但没有任何机制保证。
    swarm_result = run_swarm_execution_loop(
        {
            "task_id": task.id,
            "review_id": review.id,
            "mode": "deep",
            "confirmed_edict": {**draft_payload, "source_label": task.source_label},
            "review_plan": routing_plan,
            "department_ids": draft_payload.get("recommended_departments"),
        }
    )
    persist_swarm_execution_result(db, swarm_result)
    attach_swarm_result_to_review(db, review.id, swarm_result)
    swarm_run_id = swarm_result["swarm_run"]["id"]
    swarm_source_label = str(swarm_result["swarm_run"].get("source_label") or "FALLBACK")
    from src.formal_memorial import FormalMemorialBlocked, formalize_memorial

    formal_memorial = None
    memorial_block_reason = None
    try:
        formal_memorial = formalize_memorial(
            db,
            task_id=task.id,
            review_id=review.id,
            swarm_result=swarm_result,
        )
    except FormalMemorialBlocked as exc:
        memorial_block_reason = str(exc)

    effective_quality_passed = formal_memorial is not None
    task.status = "awaiting_decision" if effective_quality_passed else "awaiting_evidence"
    task.updated_at = _now_iso()
    review.review_status = task.status
    review.updated_at = task.updated_at
    _record_timeline(
        db,
        task_id=task_id,
        stage="department_reporting",
        actor="worker",
        message=f"蜂群深挖完成，任务状态更新为 {task.status}。",
        event_type="reports.completed",
        trace_id=review.id,
        source_label=task.source_label,
        payload={
            "attempt": attempt,
            "outbox_event_id": outbox_event_id,
            "review_id": review.id,
            "swarm_run_id": swarm_run_id,
        },
        idempotency_key=(f"reports.completed:{outbox_event_id}:attempt:{attempt}"),
        tenant_id=tenant_id,
    )
    quality_result = swarm_result["quality_result"]
    blocking_reasons = list(quality_result.get("blocking_reasons", []))
    if memorial_block_reason and memorial_block_reason not in blocking_reasons:
        blocking_reasons.append(memorial_block_reason)
    _record_timeline(
        db,
        task_id=task_id,
        stage=("awaiting_emperor_decision" if effective_quality_passed else "awaiting_evidence"),
        actor="quality_gate",
        message=(
            "御史质量门通过，奏折可进入人工裁决。"
            if effective_quality_passed
            else "御史质量门阻断，必须补证后重新回奏。"
        ),
        event_type=("quality.passed" if effective_quality_passed else "quality.blocked"),
        trace_id=review.id,
        source_label=task.source_label,
        payload={
            "swarm_run_id": swarm_run_id,
            "raw_quality_passed": bool(quality_result.get("passed")),
            "passed": effective_quality_passed,
            "task_status": task.status,
            "blocking_reasons": blocking_reasons,
            "warnings": quality_result.get("warnings", []),
            "swarm_source_label": swarm_source_label,
        },
        idempotency_key=f"quality:{swarm_run_id}",
        tenant_id=tenant_id,
    )
    _record_timeline(
        db,
        task_id=task_id,
        stage=("awaiting_emperor_decision" if effective_quality_passed else "awaiting_evidence"),
        actor="junjichu",
        message=(
            "军机处已生成唯一正式奏折，等待皇上人工裁决。"
            if effective_quality_passed
            else f"候选奏折未晋升为正式奏折：{memorial_block_reason}。"
        ),
        event_type=("memorial.formalized" if effective_quality_passed else "memorial.blocked"),
        trace_id=review.id,
        source_label=task.source_label,
        payload={
            "swarm_run_id": swarm_run_id,
            "swarm_source_label": swarm_source_label,
            "formal_memorial_id": (formal_memorial.id if formal_memorial is not None else None),
            "blocking_reason": memorial_block_reason,
        },
        idempotency_key=f"memorial:{swarm_run_id}",
        tenant_id=tenant_id,
    )
    return {
        "mode": "council",
        "task_status": task.status,
        "swarm_run_id": swarm_run_id,
        "formal_memorial_id": (formal_memorial.id if formal_memorial is not None else None),
    }


def _claim_event(db: "Session", event_id: str) -> "OutboxEvent | None":
    """原子声明事件的处理权：UPDATE ... WHERE status IN (pending, failed) 一条语句
    完成"检查+转移状态"，用受影响行数(rowcount)判断是否抢到——不是读后判断再写，
    避免两个并发消费者(即时派单线程 + 手动 process_pending_events)同时读到
    同一个 pending 事件、都跳过状态检查、都真的执行一遍 _execute_council
    (独立审查 2026-07-10 发现的竞态)。SQLite 单文件锁本身能保证这条 UPDATE
    的原子性，不需要额外的 SELECT ... FOR UPDATE。"""
    from sqlalchemy import update

    from src.db.models import OutboxEvent

    now = _now_iso()
    result = db.execute(
        update(OutboxEvent)
        .where(
            OutboxEvent.id == event_id,
            OutboxEvent.status.in_(["pending", "failed"]),
        )
        .values(status="processing", updated_at=now)
    )
    db.commit()
    if result.rowcount == 0:
        return None
    return db.query(OutboxEvent).filter_by(id=event_id).first()


def process_event(db: "Session", event_id: str) -> dict[str, Any]:
    """消费单个 outbox 事件。幂等：completed/dead_letter 直接跳过，不重复执行；
    并发安全：用原子 claim 防止两个消费者同时执行同一事件。"""
    from src.db.models import OutboxEvent

    probe = db.query(OutboxEvent).filter_by(id=event_id).first()
    if probe is None:
        return {"status": "not_found", "event_id": event_id}
    if probe.status in {"completed", "dead_letter"}:
        return {"status": probe.status, "event_id": event_id, "skipped": True}
    if probe.status == "processing":
        return {"status": "processing", "event_id": event_id, "skipped": True}

    event = _claim_event(db, event_id)
    if event is None:
        # 没抢到：另一个消费者已经先一步把它转成 processing/completed 了。
        return {"status": "claimed_elsewhere", "event_id": event_id, "skipped": True}

    attempt = event.attempts + 1
    try:
        from src.core_tenant_lineage import assert_no_tenant_lineage_conflict

        assert_no_tenant_lineage_conflict(db, task_id=event.task_id, inherited_tenant_id=event.tenant_id)
        if event.event_type == "route.direct":
            result = _execute_direct(
                db,
                event.task_id,
                outbox_event_id=event.id,
                attempt=attempt,
                tenant_id=event.tenant_id,
            )
        elif event.event_type == "route.council":
            result = _execute_council(
                db,
                event.task_id,
                outbox_event_id=event.id,
                attempt=attempt,
                tenant_id=event.tenant_id,
            )
        else:
            raise ValueError(f"未知 event_type: {event.event_type}")

        event.status = "completed"
        event.last_error = None
        event.updated_at = _now_iso()
        db.commit()
        from src.migration_telemetry import record_canonical_chain_event

        record_canonical_chain_event("outbox_consumed", caller_id="outbox_worker.process_event")
        return {"status": "completed", "event_id": event_id, "result": result}
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        from src.core_tenant_lineage import TenantLineageConflict

        event = db.query(OutboxEvent).filter_by(id=event_id).first()
        error_type = type(exc).__name__
        if event is None:
            return {"status": "not_found", "event_id": event_id, "error": str(exc)}
        primary_error = str(exc)

        def apply_failure_state(target: "OutboxEvent", *, timeline_error: Exception | None = None) -> None:
            target.attempts = max(target.attempts, attempt)
            primary = primary_error
            if timeline_error is not None:
                primary += f"; failure_timeline_error={type(timeline_error).__name__}: {timeline_error}"
            target.last_error = primary
            target.status = "dead_letter" if target.attempts >= target.max_attempts else "failed"
            target.updated_at = _now_iso()

        apply_failure_state(event)
        if not isinstance(exc, TenantLineageConflict):
            try:
                _record_timeline(
                    db,
                    task_id=event.task_id,
                    stage="failed",
                    actor="worker",
                    message=f"第 {attempt} 次派单失败，详情已记录在 outbox。",
                    event_type="dispatch.failed",
                    trace_id=event.decision_id,
                    source_label=_task_source_label(db, event.task_id),
                    payload={
                        "attempt": attempt,
                        "error_type": error_type,
                        "outbox_event_id": event.id,
                        "outbox_status": event.status,
                    },
                    idempotency_key=f"dispatch.failed:{event.id}:attempt:{attempt}",
                    tenant_id=getattr(event, "tenant_id", None),
                )
            except Exception as timeline_exc:  # noqa: BLE001
                # The rich timeline is secondary evidence.  If its schema is
                # unavailable, roll back that write and still commit the
                # minimal outbox failure so the event is retryable/auditable.
                db.rollback()
                event = db.query(OutboxEvent).filter_by(id=event_id).first()
                if event is None:
                    return {"status": "not_found", "event_id": event_id, "error": str(exc)}
                apply_failure_state(event, timeline_error=timeline_exc)
        if event.status == "dead_letter":
            _promote_task_to_execution_failed(db, event.task_id)
        db.commit()
        return {"status": event.status, "event_id": event_id, "error": str(exc)}


_STALE_PROCESSING_SECONDS = 15 * 60  # 15分钟：council 真实LLM调用量级的宽松上限
_PROCESS_STARTED_AT = _now_iso()


def _reap_stale_processing_events(db: "Session") -> int:
    """独立审查发现(2026-07-10)：worker 进程崩溃/被杀时(_execute_council 是真实、
    无超时的LLM/蜂群调用，最容易撞上)，事件永远卡在 processing——process_pending_events
    之前只扫 pending/failed，永远捞不回卡死的事件。这里把 updated_at 超过阈值、
    仍是 processing 的事件重置为 failed(计入一次 attempts)，让它能被下面的批处理
    重新捞起来，不需要人工介入清库。"""
    from datetime import datetime, timedelta, timezone

    from src.core_tenant_lineage import (
        TenantLineageConflict,
        assert_no_tenant_lineage_conflict,
    )
    from src.db.models import OutboxEvent

    cutoff = (datetime.now(timezone.utc) - timedelta(seconds=_STALE_PROCESSING_SECONDS)).isoformat(timespec="seconds")
    stale = (
        db.query(OutboxEvent)
        .filter(
            OutboxEvent.status == "processing",
            OutboxEvent.updated_at < cutoff,
            # A slow operation claimed by this live process is not abandoned.
            # Without a persisted heartbeat, reclaiming it would execute the
            # decree twice.  Crash residue becomes eligible after the next
            # process start, when its timestamp is older than this boundary.
            OutboxEvent.updated_at < _PROCESS_STARTED_AT,
        )
        .all()
    )
    for event in stale:
        attempt = event.attempts + 1
        event.attempts = attempt
        event.last_error = "重置：processing 状态超过 15 分钟未完成，视为卡死"
        event.status = "dead_letter" if event.attempts >= event.max_attempts else "failed"
        event.updated_at = _now_iso()
        if event.status == "dead_letter":
            _promote_task_to_execution_failed(db, event.task_id)
        try:
            assert_no_tenant_lineage_conflict(db, task_id=event.task_id, inherited_tenant_id=event.tenant_id)
        except TenantLineageConflict as exc:
            event.last_error = str(exc)
            db.commit()
            continue
        # Persist the retryable state before writing secondary timeline evidence.
        # A broken audit writer must not roll the event back to "processing".
        db.commit()
        try:
            _record_timeline(
                db,
                task_id=event.task_id,
                stage="failed",
                actor="worker_reaper",
                message=f"第 {attempt} 次派单超时，processing 已由回收器重置。",
                event_type="dispatch.failed",
                trace_id=event.decision_id,
                source_label=_task_source_label(db, event.task_id),
                payload={
                    "attempt": attempt,
                    "error_type": "StaleProcessingTimeout",
                    "outbox_event_id": event.id,
                    "outbox_status": event.status,
                },
                idempotency_key=f"dispatch.failed:{event.id}:attempt:{attempt}",
                tenant_id=event.tenant_id,
            )
            db.commit()
        except Exception as timeline_exc:  # noqa: BLE001
            db.rollback()
            persisted = db.query(OutboxEvent).filter_by(id=event.id).one()
            persisted.last_error = (
                f"{persisted.last_error}; failure_timeline_error={type(timeline_exc).__name__}: {timeline_exc}"
            )
            db.commit()
    return len(stale)


def process_pending_events(db: "Session", *, limit: int = 10) -> list[dict[str, Any]]:
    """批处理入口：先捞回卡死的 processing 事件，再扫描 pending/failed(未达
    max_attempts)事件逐个处理。

    供运维重试或未来定时调度调用；不是本次实现的自动触发路径(那条走
    decree_dispatcher.dispatch_after_commit 的即时线程)，这里是补漏用的。
    """
    from src.db.models import OutboxEvent

    _reap_stale_processing_events(db)

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
