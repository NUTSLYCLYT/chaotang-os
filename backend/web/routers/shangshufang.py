"""上书房主循环 API.

P0 闭环：
GET  /api/shangshufang/home
POST /api/shangshufang/draft-edict
POST /api/shangshufang/confirm-edict
GET  /api/shangshufang/tasks/{task_id}/status
POST /api/shangshufang/tasks/{task_id}/decision
"""
from __future__ import annotations

import json
from typing import Any, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from web.deps import get_current_user
from web.routers._envelope import fail, ok
from web.schemas.auth import CurrentUser

from src.hubu_financial_reporting import build_shangshufang_finance_reporting_loop
from src.db.models import (
    AgentSkillRun,
    CourtLoopRun,
    CourtReview,
    DecisionTask,
    EmperorDecision,
    ShiguanArchive,
)
from src.shangshufang_loop import (
    draft_edict,
    draft_to_dict,
    evaluate_draft,
    home_payload,
    make_id,
    now_iso,
    review_memorial_for,
    routing_plan_for,
)
from src.swarm_execution_loop import run_swarm_execution_loop
from src.swarm_persistence import attach_swarm_result_to_review, persist_swarm_execution_result

router = APIRouter(prefix="/api/shangshufang", tags=["shangshufang"])

LOOP_ID = "shangshufang_intake_loop_v1"
SKILL_ID = "skill.chancellor.draft_edict"
SKILL_VERSION = "0.1.0"


class DraftEdictRequest(BaseModel):
    raw_question: str = Field(..., min_length=1, max_length=4000)
    attachments: list[dict[str, Any]] = []
    evidence_summary: dict[str, Any] | None = None
    archive_matches: list[dict[str, Any]] = []


class ConfirmEdictRequest(BaseModel):
    task_id: str
    confirmed: bool = True
    edited_edict: dict[str, Any] | None = None


class DecisionRequest(BaseModel):
    action: Literal["approve", "reject", "request_evidence", "archive"]
    reason: str = ""
    human_confirmed: bool = True


class FinanceReportingLoopRequest(BaseModel):
    command: str = Field(..., min_length=5, max_length=4000)
    mode: Literal["order", "secret"] = "order"
    fact_pack: dict[str, Any] | None = None


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def _loads(raw: str | None, default: Any) -> Any:
    if not raw:
        return default
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return default


def _user_id(user: CurrentUser) -> str:
    return str(user.user_id or user.username or user.tenant_slug or "anonymous")


def _task_to_payload(row: DecisionTask) -> dict:
    return {
        "task_id": row.id,
        "status": row.status,
        "raw_question": row.raw_question,
        "draft_edict": _loads(row.draft_edict_json, None),
        "source_label": row.source_label,
        "risk_flags": _loads(row.risk_flags_json, []),
        "known_facts": _loads(row.known_facts_json, []),
        "unknown_gaps": _loads(row.unknown_gaps_json, []),
        "recommended_departments": _loads(row.recommended_departments_json, []),
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


@router.get("/home")
def shangshufang_home(user: CurrentUser = Depends(get_current_user)) -> dict:
    from src.db.engine import SessionLocal

    db = SessionLocal()
    try:
        payload = home_payload()
        pending = (
            db.query(DecisionTask)
            .filter(DecisionTask.status.in_(["awaiting_emperor_confirm", "awaiting_decision"]))
            .order_by(DecisionTask.updated_at.desc())
            .limit(10)
            .all()
        )
        reviewing = (
            db.query(DecisionTask)
            .filter(DecisionTask.status.in_(["reviewing", "awaiting_evidence"]))
            .order_by(DecisionTask.updated_at.desc())
            .limit(10)
            .all()
        )
        payload["pending_decisions"] = [_task_to_payload(row) for row in pending]
        payload["pending_evidence_tasks"] = [_task_to_payload(row) for row in reviewing]
        if pending:
            top = pending[0]
            payload["source_label"] = top.source_label
            payload["today_issue"] = {
                "title": (top.refined_edict or top.raw_question)[:80],
                "why_now": "该事项已完成丞相拟旨，正在等待皇上确认。",
                "urgency": "高" if "需人工确认" in _loads(top.risk_flags_json, []) else "中",
                "recommended_action": "立即处理",
                "evidence_basis": _loads(top.known_facts_json, []),
                "missing_evidence": _loads(top.unknown_gaps_json, []),
            }
        return ok(payload)
    finally:
        db.close()


@router.post("/finance-reporting-loop")
def shangshufang_finance_reporting_loop(
    body: FinanceReportingLoopRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    try:
        _user_id(user)
        return ok(
            build_shangshufang_finance_reporting_loop(
                command=body.command,
                mode=body.mode,
                fact_pack=body.fact_pack,
            )
        )
    except ValueError as exc:
        return fail(str(exc))


@router.post("/draft-edict")
def shangshufang_draft_edict(
    body: DraftEdictRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    from src.db.engine import SessionLocal

    db = SessionLocal()
    task_id = make_id("task", body.raw_question, _user_id(user), now_iso())
    run_id = make_id("loop", task_id, LOOP_ID)
    skill_run_id = make_id("skill", task_id, SKILL_ID)
    try:
        evidence_summary = body.evidence_summary or {}
        if body.attachments and not evidence_summary.get("user_evidence"):
            evidence_summary = {
                **evidence_summary,
                "user_evidence": True,
                "attachment_count": len(body.attachments),
                "attachment_names": [
                    str(item.get("name") or item.get("filename") or "未命名附件")
                    for item in body.attachments
                ],
            }
        edict = draft_edict(
            body.raw_question,
            evidence_summary=evidence_summary,
            archive_matches=body.archive_matches,
        )
        edict_payload = draft_to_dict(edict)
        eval_result = evaluate_draft(edict)
        now = now_iso()

        db.add(
            DecisionTask(
                id=task_id,
                user_id=_user_id(user),
                raw_question=edict.original_question,
                refined_edict=edict.refined_edict,
                decision_type=edict.decision_type,
                status="awaiting_emperor_confirm",
                source_label=edict.source_label,
                risk_flags_json=_json(edict.risk_flags),
                known_facts_json=_json(edict.known_facts),
                unknown_gaps_json=_json(edict.unknown_gaps),
                recommended_departments_json=_json(edict.recommended_departments),
                draft_edict_json=_json(edict_payload),
                created_at=now,
                updated_at=now,
            )
        )
        db.add(
            CourtLoopRun(
                id=run_id,
                task_id=task_id,
                loop_id=LOOP_ID,
                status="awaiting_emperor_confirm",
                input_json=_json(body.model_dump()),
                output_json=_json({"draft_edict": edict_payload, "eval_result": eval_result}),
                trace_id=run_id,
                created_at=now,
                updated_at=now,
            )
        )
        db.add(
            AgentSkillRun(
                id=skill_run_id,
                task_id=task_id,
                skill_id=SKILL_ID,
                skill_version=SKILL_VERSION,
                input_json=_json({"raw_question": body.raw_question}),
                output_json=_json(edict_payload),
                source_label=edict.source_label,
                eval_score=float(eval_result["score"]),
                created_at=now,
            )
        )
        db.commit()
        return ok(
            {
                "task_id": task_id,
                "status": "awaiting_emperor_confirm",
                "draft_edict": edict_payload,
                "eval_result": eval_result,
                "trace_id": run_id,
            }
        )
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        return fail(str(exc), {"task_id": task_id, "status": "failed_with_recovery", "source_label": "FALLBACK"})
    finally:
        db.close()


@router.post("/confirm-edict")
def shangshufang_confirm_edict(
    body: ConfirmEdictRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    from src.db.engine import SessionLocal

    db = SessionLocal()
    try:
        task = db.query(DecisionTask).filter_by(id=body.task_id).first()
        if task is None:
            db.rollback()
            return fail("task_id 不存在")
        if not body.confirmed:
            task.status = "draft_cancelled"
            task.updated_at = now_iso()
            db.commit()
            return ok({"task_id": task.id, "status": task.status, "message": "拟旨已取消"})

        draft_payload = body.edited_edict or _loads(task.draft_edict_json, {})
        edict_for_review = draft_edict(task.raw_question, source_label=task.source_label)
        routing_plan = routing_plan_for(edict_for_review)
        memorial = review_memorial_for(edict_for_review, routing_plan)
        now = now_iso()
        review_id = make_id("review", task.id, "junjichu")
        task.status = "awaiting_decision"
        task.updated_at = now
        db.add(
            CourtReview(
                id=review_id,
                task_id=task.id,
                routing_plan_json=_json(routing_plan),
                review_status="awaiting_decision",
                ministry_outputs_json=_json(memorial["ministry_outputs"]),
                conflict_summary_json=_json(memorial["conflict_summary"]),
                memorial_json=_json({**memorial, "draft_edict": draft_payload}),
                created_at=now,
                updated_at=now,
            )
        )
        db.add(
            CourtLoopRun(
                id=make_id("loop", task.id, "confirm", now),
                task_id=task.id,
                loop_id=LOOP_ID,
                status="awaiting_decision",
                input_json=_json(body.model_dump()),
                output_json=_json({"routing_plan": routing_plan, "review_id": review_id, "memorial": memorial}),
                trace_id=review_id,
                created_at=now,
                updated_at=now,
            )
        )
        swarm_result = run_swarm_execution_loop(
            {
                "task_id": task.id,
                "review_id": review_id,
                "mode": "standard",
                "confirmed_edict": {**draft_payload, "source_label": task.source_label},
                "review_plan": routing_plan,
            }
        )
        persist_swarm_execution_result(db, swarm_result)
        attach_swarm_result_to_review(db, review_id, swarm_result)
        db.add(
            EmperorDecision(
                id=make_id("decision", task.id, "confirm", now),
                task_id=task.id,
                action="confirm_edict",
                reason="皇上确认发起军机处会审",
                human_confirmed=True,
                confirmation_record_json=_json(
                    {"user_id": _user_id(user), "confirmed_at": now, "edited": body.edited_edict is not None}
                ),
                created_at=now,
            )
        )
        db.commit()
        return ok(
            {
                "task_id": task.id,
                "status": "awaiting_decision",
                "message": "已下发军机处，并形成第一版会审回奏，待皇上裁决。",
                "review_id": review_id,
                "routing_plan": routing_plan,
                "memorial": _loads(db.query(CourtReview).filter_by(id=review_id).first().memorial_json, memorial),
                "swarm_run": swarm_result["swarm_run"],
                "review_status_url": f"/api/shangshufang/tasks/{task.id}/status",
            }
        )
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        return fail(str(exc))
    finally:
        db.close()


@router.get("/tasks/{task_id}/status")
def shangshufang_task_status(task_id: str, _: CurrentUser = Depends(get_current_user)) -> dict:
    from src.db.engine import SessionLocal

    db = SessionLocal()
    try:
        task = db.query(DecisionTask).filter_by(id=task_id).first()
        if task is None:
            return fail("task_id 不存在")
        review = (
            db.query(CourtReview)
            .filter_by(task_id=task_id)
            .order_by(CourtReview.created_at.desc())
            .first()
        )
        return ok(
            {
                "task": _task_to_payload(task),
                "review": None
                if review is None
                else {
                    "review_id": review.id,
                    "review_status": review.review_status,
                    "routing_plan": _loads(review.routing_plan_json, {}),
                    "ministry_outputs": _loads(review.ministry_outputs_json, []),
                    "conflict_summary": _loads(review.conflict_summary_json, []),
                    "memorial": _loads(review.memorial_json, None),
                    "created_at": review.created_at,
                    "updated_at": review.updated_at,
                },
            }
        )
    finally:
        db.close()


@router.post("/tasks/{task_id}/decision")
def shangshufang_task_decision(
    task_id: str,
    body: DecisionRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    from src.db.engine import SessionLocal

    db = SessionLocal()
    try:
        task = db.query(DecisionTask).filter_by(id=task_id).first()
        if task is None:
            return fail("task_id 不存在")
        now = now_iso()
        decision = EmperorDecision(
            id=make_id("decision", task_id, body.action, now),
            task_id=task_id,
            action=body.action,
            reason=body.reason,
            human_confirmed=body.human_confirmed,
            confirmation_record_json=_json({"user_id": _user_id(user), "at": now}),
            created_at=now,
        )
        db.add(decision)
        review = (
            db.query(CourtReview)
            .filter_by(task_id=task_id)
            .order_by(CourtReview.created_at.desc())
            .first()
        )
        final_memorial = _loads(review.memorial_json, None) if review is not None else None
        if body.action == "archive":
            task.status = "archived"
            db.add(
                ShiguanArchive(
                    id=make_id("archive", task_id, now),
                    task_id=task_id,
                    raw_question=task.raw_question,
                    refined_edict=task.refined_edict or "",
                    final_memorial_json=_json(final_memorial),
                    emperor_decision_json=_json({"action": body.action, "reason": body.reason}),
                    evidence_chain_json=_json(_loads(task.known_facts_json, [])),
                    source_label=task.source_label,
                    synthetic_flag=task.source_label in {"FALLBACK", "DEMO"},
                    created_at=now,
                )
            )
        elif body.action == "request_evidence":
            task.status = "awaiting_evidence"
        else:
            task.status = "awaiting_decision"
        task.updated_at = now
        db.commit()
        return ok({"task_id": task_id, "status": task.status, "decision_id": decision.id})
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        return fail(str(exc))
    finally:
        db.close()
