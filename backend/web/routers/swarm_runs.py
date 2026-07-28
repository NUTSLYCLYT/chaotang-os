"""军机处后台蜂群产线 API.

蜂群不直接面对用户；这些端点供军机处 review_plan 调用、追踪和回放。
"""
from __future__ import annotations

import json
from typing import Any, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from src.chancellor.contracts import RouteDecisionV2
from src.chancellor.routing_service import legacy_route_dict
from src.db.models import (
    ChancellorRouteDecision,
    CourtReview,
    DecisionTask,
    SwarmQualityResult,
    SwarmRun,
    SwarmTaskRun,
)
from src.shangshufang_loop import (
    DraftEdict,
    chancellor_decide_route,
    direct_receipt_for,
    draft_edict,
    draft_to_dict,
    make_id,
    now_iso,
    routing_plan_for,
)
from src.swarm_execution_loop import run_swarm_execution_loop
from src.swarm_persistence import (
    attach_swarm_result_to_review,
    persist_swarm_execution_result,
)
from web.deps import get_current_user
from web.routers._envelope import fail, ok
from web.schemas.auth import CurrentUser

router = APIRouter(prefix="/api/swarm-runs", tags=["swarm-runs"])


class CreateSwarmRunRequest(BaseModel):
    task_id: str
    review_id: str | None = None
    mode: Literal["dry_run", "standard", "deep", "live_swarm"] = "standard"
    confirmed_edict: dict[str, Any] | None = None
    review_plan: dict[str, Any] | None = None
    trace_id: str | None = None


class SerialLoopRequest(BaseModel):
    """非军机处串行闭环请求:按部门名点名(默认锦衣卫→户部),不进军机处会审。"""

    task_id: str
    review_id: str | None = None
    mode: Literal["dry_run", "standard", "deep", "live_swarm"] = "standard"
    departments: list[str] = Field(default_factory=lambda: ["锦衣卫", "户部"])
    confirmed_edict: dict[str, Any] | None = None
    trace_id: str | None = None


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def _loads(raw: str | None, default: Any) -> Any:
    if not raw:
        return default
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return default


def _run_to_payload(row: SwarmRun) -> dict[str, Any]:
    return {
        "id": row.id,
        "task_id": row.task_id,
        "review_id": row.review_id,
        "mode": row.mode,
        "status": row.status,
        "source_label": row.source_label,
        "route_plan": _loads(row.route_plan_json, {}),
        "trace_id": row.trace_id,
        "started_at": row.started_at,
        "finished_at": row.finished_at,
        "error": row.error,
    }


class _NotOwner(Exception):
    """调用者不是该 task 的归属者。由 route 捕获后返回 fail(不泄露对方存在细节)。"""


def _owner_id(user: CurrentUser) -> str:
    return str(user.user_id or user.username or user.tenant_slug or "anonymous")


def _tenant_matches(row_tenant_id: int | None, requester_tenant_id: int | None) -> bool:
    return row_tenant_id is not None and requester_tenant_id is not None and row_tenant_id == requester_tenant_id


def _default_context(
    db,
    task_id: str,
    review_id: str | None,
    owner_id: str,
    requester_tenant_id: int | None,
) -> tuple[DecisionTask, CourtReview | None, dict[str, Any], dict[str, Any]]:
    # P0-B(2026-07-14):归属校验收口在此——create/serial/retry 都经这条唯一入口,
    # 一处 guard 挡住三个端点对他人 DecisionTask 的读取与蜂群发起。
    task = db.query(DecisionTask).filter_by(id=task_id).first()
    if task is None:
        raise ValueError("task_id 不存在")
    if task.user_id != owner_id or not _tenant_matches(task.tenant_id, requester_tenant_id):
        raise _NotOwner()
    review = None
    if review_id:
        review = db.query(CourtReview).filter_by(id=review_id).first()
        if review is None:
            raise ValueError("review_id 不存在")
        if (
            review.task_id != task.id
            or not _tenant_matches(review.tenant_id, requester_tenant_id)
            or (
                task.tenant_id is not None
                and review.tenant_id is not None
                and review.tenant_id != task.tenant_id
            )
        ):
            raise _NotOwner()
    if review is None:
        review = (
            db.query(CourtReview)
            .filter_by(task_id=task_id)
            .order_by(CourtReview.created_at.desc())
            .first()
        )
        if review is not None and (
            not _tenant_matches(review.tenant_id, requester_tenant_id)
            or (
                task.tenant_id is not None
                and review.tenant_id is not None
                and review.tenant_id != task.tenant_id
            )
        ):
            raise _NotOwner()
    confirmed_edict = _loads(task.draft_edict_json, None)
    if not confirmed_edict:
        edict = draft_edict(task.raw_question, source_label=task.source_label)
        confirmed_edict = draft_to_dict(edict)
    review_plan = _loads(review.routing_plan_json, {}) if review is not None else {}
    return task, review, confirmed_edict, review_plan


def _edict_from_confirmed(confirmed_edict: dict[str, Any]) -> DraftEdict:
    """confirmed_edict 是 draft_to_dict(DraftEdict) 形状(task.draft_edict_json 或客户端回传)；
    这里防御性补全缺字段,避免客户端传半个 dict 时构造失败。"""
    defaults: dict[str, Any] = {
        "original_question": "",
        "refined_edict": "",
        "decision_type": "",
        "known_facts": [],
        "unknown_gaps": [],
        "recommended_departments": [],
        "risk_flags": [],
        "expected_memorial_format": [],
        "emperor_confirmation_question": "",
        "source_label": "FALLBACK",
    }
    fields = DraftEdict.__dataclass_fields__.keys()
    payload = {key: confirmed_edict.get(key, defaults[key]) for key in fields}
    return DraftEdict(**payload)


def _resolve_chancellor_route(db, task_id: str, edict: DraftEdict) -> dict:
    """优先复用上书房下旨时已落盘、皇上已确认过的路由决策；查不到才现算一个。"""
    persisted = (
        db.query(ChancellorRouteDecision)
        .filter_by(task_id=task_id)
        .order_by(ChancellorRouteDecision.created_at.desc())
        .first()
    )
    if persisted is not None:
        return legacy_route_dict(RouteDecisionV2.model_validate_json(persisted.decision_json))
    return chancellor_decide_route(edict)


def _direct_swarm_short_circuit(
    db,
    body: "CreateSwarmRunRequest",
    review: CourtReview | None,
    edict: DraftEdict,
    route: dict,
) -> dict:
    """丞相判定为 direct 时跳过全量蜂群,写一条 degenerate SwarmRun 记录,复用上书房
    direct_receipt_for 的回执文案。不复制 CourtReview/CourtLoopRun/EmperorDecision 三件套——
    那是上书房下旨时的人工确认审计,军机处派蜂群按钮不是二次确认。"""
    routing_plan = routing_plan_for(edict, route)
    receipt = direct_receipt_for(edict, routing_plan)
    now = now_iso()
    review_id = review.id if review is not None else make_id("review", body.task_id, "swarm")
    run_id = make_id("swarmrun", body.task_id, review_id, now, "direct")
    db.add(
        SwarmRun(
            id=run_id,
            task_id=body.task_id,
            review_id=review_id,
            mode=body.mode,
            status="direct_completed",
            source_label=edict.source_label,
            route_plan_json=_json(routing_plan),
            trace_id=body.trace_id or review_id,
            started_at=now,
            finished_at=now,
            error=None,
        )
    )
    if review is not None:
        review.review_status = "direct_completed"
        review.updated_at = now
    db.commit()
    return ok(
        {
            "swarm_run": _run_to_payload(db.query(SwarmRun).filter_by(id=run_id).first()),
            "progress_url": f"/api/swarm-runs/{run_id}/progress",
            "brief_url": None,
            "brief": receipt.get("formatted_memorial"),
            "quality_result": {
                "status": "passed" if not edict.unknown_gaps else "warning",
                "blocking_reasons": [],
                "warnings": receipt.get("quality_gate", {}).get("reasons", []),
                "source_label": edict.source_label,
            },
            "direct_receipt": receipt,
            "route": route,
            "routing_plan": routing_plan,
        }
    )


def _run_and_persist(db, params: dict[str, Any], review_id: str) -> dict:
    """跑一轮蜂群产线 + 落库 + 挂到 review。军机处/串行两条路径共用,避免复制持久化块。"""
    result = run_swarm_execution_loop(params)
    persist_swarm_execution_result(db, result)
    attach_swarm_result_to_review(db, review_id, result)
    db.commit()
    return ok(
        {
            "swarm_run": result["swarm_run"],
            "progress_url": f"/api/swarm-runs/{result['swarm_run']['id']}/progress",
            "brief_url": f"/api/swarm-runs/{result['swarm_run']['id']}/brief",
            "brief": result["brief"],
            "quality_result": result["quality_result"],
        }
    )


@router.post("")
def create_swarm_run(user: CurrentUser = Depends(get_current_user), body: CreateSwarmRunRequest | None = None) -> dict:
    from src.db.engine import SessionLocal
    from src.decision_task_access import lock_decision_task

    if body is None:
        return fail("请求体不能为空")
    db = SessionLocal()
    try:
        try:
            lock_decision_task(db, body.task_id)
            task, review, confirmed_edict, review_plan = _default_context(
                db,
                body.task_id,
                body.review_id,
                _owner_id(user),
                user.tenant_id,
            )
        except _NotOwner:
            return fail("无权操作该任务")
        resolved_edict = body.confirmed_edict or confirmed_edict
        edict = _edict_from_confirmed(resolved_edict)
        route = _resolve_chancellor_route(db, body.task_id, edict)
        if body.mode != "live_swarm" and route.get("mode") == "direct":
            return _direct_swarm_short_circuit(db, body, review, edict, route)
        review_id = review.id if review is not None else make_id("review", task.id, "swarm")
        return _run_and_persist(
            db,
            {
                "task_id": body.task_id,
                "review_id": review_id,
                "mode": body.mode,
                "confirmed_edict": resolved_edict,
                "review_plan": body.review_plan or review_plan,
                "trace_id": body.trace_id,
            },
            review_id,
        )
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        return fail(str(exc), {"source_label": "FALLBACK"})
    finally:
        db.close()


@router.post("/serial")
def create_serial_loop(user: CurrentUser = Depends(get_current_user), body: SerialLoopRequest | None = None) -> dict:
    """非军机处串行闭环:锦衣卫采证 → 户部核算 → 丞相回奏(直呈上书房,不进军机处会审)。

    departments 默认[锦衣卫,户部];传单个部门即"单部门直办"。锦衣卫自动置首先采证,
    其真实核实情报喂给后续部门(见 swarm_execution_loop._run_departments_cross_referenced)。
    council=False:跳过多部门冲突合奏,回奏口吻直呈上书房。落库/回放与军机处产线一致。
    """
    from src.db.engine import SessionLocal
    from src.decision_task_access import lock_decision_task

    if body is None:
        return fail("请求体不能为空")
    db = SessionLocal()
    try:
        try:
            lock_decision_task(db, body.task_id)
            task, review, confirmed_edict, review_plan = _default_context(
                db,
                body.task_id,
                body.review_id,
                _owner_id(user),
                user.tenant_id,
            )
        except _NotOwner:
            return fail("无权操作该任务")
        review_id = review.id if review is not None else make_id("review", task.id, "swarm")
        return _run_and_persist(
            db,
            {
                "task_id": body.task_id,
                "review_id": review_id,
                "mode": body.mode,
                "confirmed_edict": body.confirmed_edict or confirmed_edict,
                "review_plan": review_plan,
                "trace_id": body.trace_id,
                "council": False,
                "department_ids": body.departments,
            },
            review_id,
        )
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        return fail(str(exc), {"source_label": "FALLBACK"})
    finally:
        db.close()


@router.get("/{swarm_run_id}")
def get_swarm_run(swarm_run_id: str, _: CurrentUser = Depends(get_current_user)) -> dict:
    from src.db.engine import SessionLocal

    db = SessionLocal()
    try:
        run = db.query(SwarmRun).filter_by(id=swarm_run_id).first()
        if run is None:
            return fail("swarm_run_id 不存在")
        tasks = db.query(SwarmTaskRun).filter_by(swarm_run_id=swarm_run_id).all()
        quality = db.query(SwarmQualityResult).filter_by(swarm_run_id=swarm_run_id).order_by(SwarmQualityResult.created_at.desc()).first()
        return ok(
            {
                "swarm_run": _run_to_payload(run),
                "task_runs": [
                    {
                        "id": item.id,
                        "swarm_id": item.swarm_id,
                        "role": item.role,
                        "status": item.status,
                        "output": _loads(item.output_json, None),
                        "source_label": item.source_label,
                        "confidence": item.confidence,
                    }
                    for item in tasks
                ],
                "quality_result": None
                if quality is None
                else {
                    "passed": quality.passed,
                    "blocking_reasons": _loads(quality.blocking_reasons_json, []),
                    "warnings": _loads(quality.warnings_json, []),
                    "revised_output": _loads(quality.revised_output_json, None),
                },
            }
        )
    finally:
        db.close()


@router.get("/{swarm_run_id}/progress")
def get_swarm_run_progress(swarm_run_id: str, _: CurrentUser = Depends(get_current_user)) -> dict:
    from src.db.engine import SessionLocal

    db = SessionLocal()
    try:
        run = db.query(SwarmRun).filter_by(id=swarm_run_id).first()
        if run is None:
            return fail("swarm_run_id 不存在")
        tasks = db.query(SwarmTaskRun).filter_by(swarm_run_id=swarm_run_id).all()
        done = sum(1 for item in tasks if item.status == "completed")
        return ok(
            {
                "status": run.status,
                "source_label": run.source_label,
                "total": len(tasks),
                "completed": done,
                "items": [
                    {
                        "swarm_id": item.swarm_id,
                        "role": item.role,
                        "status": item.status,
                        "user_facing_activity": f"{item.role}已完成后台专业审查" if item.status == "completed" else f"{item.role}正在审查",
                    }
                    for item in tasks
                ],
            }
        )
    finally:
        db.close()


@router.get("/{swarm_run_id}/brief")
def get_swarm_run_brief(swarm_run_id: str, _: CurrentUser = Depends(get_current_user)) -> dict:
    from src.db.engine import SessionLocal

    db = SessionLocal()
    try:
        quality = db.query(SwarmQualityResult).filter_by(swarm_run_id=swarm_run_id).order_by(SwarmQualityResult.created_at.desc()).first()
        if quality is None:
            return fail("swarm_run_id 不存在或尚无质门结果")
        payload = _loads(quality.revised_output_json, {})
        if isinstance(payload, dict):
            payload.setdefault("source_label", "LIVE_SWARM")
        return ok(payload)
    finally:
        db.close()


@router.post("/{swarm_run_id}/retry")
def retry_swarm_run(swarm_run_id: str, user: CurrentUser = Depends(get_current_user)) -> dict:
    from src.db.engine import SessionLocal

    db = SessionLocal()
    try:
        run = db.query(SwarmRun).filter_by(id=swarm_run_id).first()
        if run is None:
            return fail("swarm_run_id 不存在")
        body = CreateSwarmRunRequest(task_id=run.task_id, review_id=run.review_id, mode=run.mode)  # type: ignore[arg-type]
    finally:
        db.close()
    result = create_swarm_run(user, body)
    if isinstance(result, dict):
        data = result.get("data")
        if isinstance(data, dict):
            data.setdefault("source_label", "LIVE_SWARM")
    return result
