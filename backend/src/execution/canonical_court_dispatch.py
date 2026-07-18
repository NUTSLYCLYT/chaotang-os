"""Canonical outbox adapter for legacy endpoints that dispatch court work."""

from __future__ import annotations

import json
from dataclasses import replace
from typing import Any


_CANONICAL_DEPARTMENT_BY_MINISTER = {
    "hu_bu": "户部",
    "li_bu": "吏部",
    "xing_bu": "刑部",
    "gong_bu": "工部",
    "li_bu_rites": "礼部",
    "bing_bu": "兵部",
    "jin_yi_wei": "锦衣卫",
}


class UnsupportedCanonicalConstraints(ValueError):
    """The compatibility request contains a constraint canonical cannot honor."""


def build_compat_dispatch_constraints(
    *,
    intent: str,
    task_type: str,
    ministers: list[str],
    groups: list[str],
    budget: dict[str, Any] | None,
    stakes: str,
    mode: str | None,
) -> dict[str, Any]:
    """Normalize legacy hints, rejecting every hard constraint we cannot enforce."""
    unsupported: list[str] = []
    for key, value in (budget or {}).items():
        if value is not None:
            unsupported.append(f"budget.{key}")
    if stakes != "low":
        unsupported.append(f"stakes={stakes}")
    if mode not in (None, "live"):
        unsupported.append(f"mode={mode}")

    from src.manor_groups import load_manor_groups

    known_groups = {group.id: group for group in load_manor_groups()}
    requested_ministers = list(ministers)
    for group_id in groups:
        group = known_groups.get(group_id)
        if group is None:
            unsupported.append(f"group={group_id}")
            continue
        requested_ministers.extend(group.ministers)

    departments: list[str] = []
    unsupported_ministers: list[str] = []
    for minister in requested_ministers:
        department = _CANONICAL_DEPARTMENT_BY_MINISTER.get(minister)
        if department is None:
            if minister not in unsupported_ministers:
                unsupported_ministers.append(minister)
            continue
        if department not in departments:
            departments.append(department)
    unsupported.extend(
        f"minister={minister}" for minister in unsupported_ministers
    )
    if unsupported:
        raise UnsupportedCanonicalConstraints(
            "canonical_constraints_unsupported: " + ",".join(unsupported)
        )
    return {
        "intent": intent,
        "taskType": task_type,
        "ministers": list(ministers),
        "groups": list(groups),
        "appliedDepartments": departments,
        "stakes": stakes,
        "mode": mode or "live",
    }


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def dispatch_compat_court_task(
    *,
    task_id: str,
    user_id: str,
    command: str,
    compat_entrypoint: str,
    tenant_id: int | None,
    constraints: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Persist one canonical routing decision and enqueue its durable execution.

    The caller keeps its legacy response envelope. This adapter owns only the
    canonical transaction and returns identifiers/status for that envelope.
    """
    from src.chancellor.decree_status import record_timeline_event
    from src.chancellor.routing_service import (
        chancellor_routing_service,
        legacy_route_dict,
    )
    from src.compat_decision_adapter import add_compat_decision_task
    from src.db.engine import SessionLocal
    from src.db.models import CourtReview, DecisionTask, EmperorDecision
    from src.emperor_decision_kind import emperor_decision_kind
    from src.execution import decree_dispatcher
    from src.shangshufang_loop import (
        direct_receipt_for,
        draft_edict,
        make_id,
        now_iso,
        review_memorial_for,
        routing_plan_for,
    )

    db = SessionLocal()
    outbox_event_id: str | None = None
    receipt: dict[str, Any] | None = None
    try:
        routing_departments = list(
            (constraints or {}).get("appliedDepartments") or []
        )
        draft_context: dict[str, Any] = {
            "human_confirmed": True,
            "compat_constraints": constraints or {},
        }
        if routing_departments:
            draft_context["recommended_departments"] = routing_departments
        add_compat_decision_task(
            db,
            task_id=task_id,
            user_id=user_id,
            command=command,
            source_label="MIXED",
            compat_entrypoint=compat_entrypoint,
            tenant_id=tenant_id,
            status="executing",
            draft_context=draft_context,
        )
        db.flush()
        task = db.get(DecisionTask, task_id)
        if task is None:
            raise RuntimeError(f"canonical DecisionTask not created: {task_id}")
        if routing_departments:
            task.recommended_departments_json = _json(routing_departments)

        route_decision = chancellor_routing_service.decide(
            db,
            task_id=task_id,
            confirmed_edict_text=command,
            idempotency_key=f"{compat_entrypoint}:{task_id}",
            source_label=task.source_label,
            department_override=routing_departments or None,
        )
        if "门下省封驳" in route_decision.risk_flags:
            # 门下省封驳：不得进入军机处派单(menxia_veto.py docstring)。只认
            # "门下省封驳"这个专属 riskFlag,不认宽泛的 human_confirmation_required
            # ——那个 flag 还有别的合法触发源,拿来当封驳信号会连正常任务一起挡住。
            #
            # review_id/outbox_event_id 不能留 None:调用方(chaotang.py/direct.py)
            # 把整个 receipt 存下来供前端轮询用,review_id=None 会让轮询链路断掉。
            # 这里落一条真实 CourtReview(状态 menxia_veto_pending，诚实标"被拦住"，
            # 不冒充派单已完成),outbox_event_id 保持 None——这是唯一诚实的值，
            # 确实没有排队执行任何东西。routing_plan_for 是纯函数、不触发真实
            # 派单，可以放心调用；memorial 手写占位，不借 direct_receipt_for/
            # review_memorial_for(那两个会触发真实部门任务，正是封驳要拦住的东西)。
            route = legacy_route_dict(route_decision)
            edict = draft_edict(command, source_label=task.source_label)
            if routing_departments:
                edict = replace(edict, recommended_departments=routing_departments)
            routing_plan = routing_plan_for(edict, route)
            memorial = {
                # 不是"军机处会审回奏"——封驳发生在任何部门会审之前，这份
                # title 曾经暗示军机处已经召集部门产出结论，是编造(2026-07-18)。
                "title": "门下省封驳纪要",
                "verdict": "已封驳",
                "summary": route_decision.reason_summary or "门下省封驳，需人工确认后才能派单。",
                "ministry_outputs": [],
                "conflict_summary": [
                    {
                        "type": "human_signoff",
                        "summary": route_decision.reason_summary or "",
                        "source_label": route_decision.source_label,
                    }
                ],
                "evidence_gaps": [],
                "risk_flags": route_decision.risk_flags,
                # 空数组,不是省略:ShangshufangReviewMemorial.decision_options
                # 是必填字段,前端 buildView 无条件 .filter() 它,漏了会在渲染
                # 时直接崩(2026-07-18 审计发现)。不填假的"覆盖封驳"之类的
                # 选项——那类动作现在没有真实后端处理器,放出会是骗人的按钮。
                "decision_options": [],
                "next_best_action": "await_human_signoff",
                "source_label": route_decision.source_label,
                "quality_gate": {
                    # 前端 explicitGate()(canonical-read-model.ts)只读
                    # quality_gate.passed 这个严格布尔值来判定 overallSignal/
                    # isBlocked,不读 status 这个字符串——只填 status 不填
                    # passed，前端会判成 overallSignal='GRAY'(未知)而不是
                    # 'RED'(阻断)，LIVE 模式渲染整段绕过封驳文案(2026-07-18
                    # 审计发现)。
                    "passed": False,
                    "status": "blocked",
                    "reasons": route_decision.risk_flags,
                    "blocking_issues": route_decision.risk_flags,
                    "human_signoff_required": True,
                },
            }
            now = now_iso()
            review_id = make_id("review", task_id, "compat-menxia-veto")
            task.status = "menxia_veto_pending"
            task.updated_at = now
            db.add(
                CourtReview(
                    id=review_id,
                    tenant_id=task.tenant_id,
                    task_id=task_id,
                    routing_plan_json=_json(routing_plan),
                    review_status="menxia_veto_pending",
                    ministry_outputs_json=_json(memorial["ministry_outputs"]),
                    conflict_summary_json=_json(memorial["conflict_summary"]),
                    memorial_json=_json(memorial),
                    created_at=now,
                    updated_at=now,
                )
            )
            db.commit()
            return {
                "task_id": task_id,
                "status": task.status,
                "review_id": review_id,
                "route_decision_id": route_decision.decision_id,
                "outbox_event_id": None,
                "review_status_url": f"/api/shangshufang/tasks/{task_id}/status",
                "source_label": route_decision.source_label,
                "message": route_decision.reason_summary or "门下省封驳，需人工确认后才能派单。",
            }
        route = legacy_route_dict(route_decision)
        edict = draft_edict(command, source_label=task.source_label)
        if routing_departments:
            edict = replace(edict, recommended_departments=routing_departments)
        routing_plan = routing_plan_for(edict, route)
        is_direct = route_decision.mode == "direct"
        memorial = (
            direct_receipt_for(edict, routing_plan)
            if is_direct
            else review_memorial_for(edict, routing_plan)
        )
        now = now_iso()
        review_id = make_id(
            "review", task_id, "compat-direct" if is_direct else "compat-council"
        )
        status = "direct_completed" if is_direct else "edict_recorded"
        task.status = status
        task.updated_at = now
        db.add(
            CourtReview(
                id=review_id,
                tenant_id=task.tenant_id,
                task_id=task_id,
                routing_plan_json=_json(routing_plan),
                review_status=status,
                ministry_outputs_json=_json(memorial["ministry_outputs"]),
                conflict_summary_json=_json(memorial["conflict_summary"]),
                memorial_json=_json(memorial),
                created_at=now,
                updated_at=now,
            )
        )
        db.add(
            EmperorDecision(
                id=make_id("decision", task_id, compat_entrypoint, now),
                tenant_id=task.tenant_id,
                task_id=task_id,
                action="compat_court_dispatch",
                kind=emperor_decision_kind("compat_court_dispatch"),
                reason=f"用户通过 {compat_entrypoint} 明确发起朝堂派单",
                human_confirmed=True,
                confirmation_record_json=_json(
                    {
                        "user_id": user_id,
                        "confirmed_at": now,
                        "compat_entrypoint": compat_entrypoint,
                    }
                ),
                created_at=now,
            )
        )
        record_timeline_event(
            db,
            task_id=task_id,
            stage="chancellor_routing",
            actor="chancellor",
            message=route_decision.reason_summary or "丞相完成兼容入口路由。",
            event_type="routing.decided",
            trace_id=review_id,
            source_label=route_decision.source_label,
            payload={
                "decision_id": route_decision.decision_id,
                "mode": route_decision.mode,
                "participants": [
                    participant.department
                    for participant in route_decision.participants
                ],
            },
            idempotency_key=f"routing.decided:{route_decision.decision_id}",
        )
        outbox_event_id = decree_dispatcher.enqueue_dispatch(
            db,
            task_id=task_id,
            decision_id=route_decision.decision_id,
            event_type="route.direct" if is_direct else "route.council",
        )
        record_timeline_event(
            db,
            task_id=task_id,
            stage="completed" if is_direct else "executing",
            actor="chancellor",
            message="兼容入口派单已进入可靠 outbox。",
            event_type="dispatch.queued",
            trace_id=review_id,
            source_label=route_decision.source_label,
            payload={
                "decision_id": route_decision.decision_id,
                "review_id": review_id,
                "outbox_event_id": outbox_event_id,
            },
            idempotency_key=f"dispatch.queued:{outbox_event_id}",
        )
        receipt = {
            "task_id": task_id,
            "status": status,
            "review_id": review_id,
            "route_decision_id": route_decision.decision_id,
            "outbox_event_id": outbox_event_id,
            "review_status_url": f"/api/shangshufang/tasks/{task_id}/status",
            "source_label": route_decision.source_label,
        }
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    if outbox_event_id is None or receipt is None:
        raise RuntimeError("canonical outbox event was not created")
    decree_dispatcher.dispatch_after_commit(outbox_event_id)
    return receipt
