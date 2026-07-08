"""军机处后台蜂群产线 API.

蜂群不直接面对用户；这些端点供军机处 review_plan 调用、追踪和回放。
"""
from __future__ import annotations

import json
from typing import Any, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from web.deps import get_current_user
from web.routers._envelope import fail, ok
from web.schemas.auth import CurrentUser

from src.db.models import CourtReview, DecisionTask, SwarmQualityResult, SwarmRun, SwarmTaskRun
from src.shangshufang_loop import draft_edict, draft_to_dict, make_id, now_iso
from src.swarm_execution_loop import run_swarm_execution_loop
from src.swarm_persistence import attach_swarm_result_to_review, persist_swarm_execution_result

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


def _default_context(db, task_id: str, review_id: str | None) -> tuple[str, dict[str, Any], dict[str, Any]]:
    task = db.query(DecisionTask).filter_by(id=task_id).first()
    if task is None:
        raise ValueError("task_id 不存在")
    review = None
    if review_id:
        review = db.query(CourtReview).filter_by(id=review_id).first()
    if review is None:
        review = db.query(CourtReview).filter_by(task_id=task_id).order_by(CourtReview.created_at.desc()).first()
    actual_review_id = review.id if review is not None else make_id("review", task_id, "swarm")
    confirmed_edict = _loads(task.draft_edict_json, None)
    if not confirmed_edict:
        edict = draft_edict(task.raw_question, source_label=task.source_label)
        confirmed_edict = draft_to_dict(edict)
    review_plan = _loads(review.routing_plan_json, {}) if review is not None else {}
    return actual_review_id, confirmed_edict, review_plan


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
def create_swarm_run(_: CurrentUser = Depends(get_current_user), body: CreateSwarmRunRequest | None = None) -> dict:
    from src.db.engine import SessionLocal

    if body is None:
        return fail("请求体不能为空")
    db = SessionLocal()
    try:
        review_id, confirmed_edict, review_plan = _default_context(db, body.task_id, body.review_id)
        return _run_and_persist(
            db,
            {
                "task_id": body.task_id,
                "review_id": review_id,
                "mode": body.mode,
                "confirmed_edict": body.confirmed_edict or confirmed_edict,
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
def create_serial_loop(_: CurrentUser = Depends(get_current_user), body: SerialLoopRequest | None = None) -> dict:
    """非军机处串行闭环:锦衣卫采证 → 户部核算 → 丞相回奏(直呈上书房,不进军机处会审)。

    departments 默认[锦衣卫,户部];传单个部门即"单部门直办"。锦衣卫自动置首先采证,
    其真实核实情报喂给后续部门(见 swarm_execution_loop._run_departments_cross_referenced)。
    council=False:跳过多部门冲突合奏,回奏口吻直呈上书房。落库/回放与军机处产线一致。
    """
    from src.db.engine import SessionLocal

    if body is None:
        return fail("请求体不能为空")
    db = SessionLocal()
    try:
        review_id, confirmed_edict, review_plan = _default_context(db, body.task_id, body.review_id)
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
        return ok(_loads(quality.revised_output_json, {}))
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
    return create_swarm_run(user, body)
