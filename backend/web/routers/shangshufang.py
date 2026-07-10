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
import os
from typing import Any, Literal

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from web.deps import get_current_user
from web.routers._envelope import fail, ok
from web.schemas.auth import CurrentUser
from web.schemas.swarm import SwarmRunRequest

from src.finance_intel_loop_contract import build_finance_intel_session
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
    chancellor_decide_route,
    direct_receipt_for,
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
from src.swarm_orchestrator import SESSIONS_DIR

router = APIRouter(prefix="/api/shangshufang", tags=["shangshufang"])

LOOP_ID = "shangshufang_intake_loop_v1"
SKILL_ID = "skill.chancellor.draft_edict"
SKILL_VERSION = "0.1.0"
_IM_MESSAGES: list[dict[str, Any]] = []
_POLISH_FORBIDDEN_WORDS = ("军机处", "会审", "六部", "蜂群", "任务单", "立案")


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
    action: Literal["approve", "archive", "adopt", "reject", "request_evidence", "recheck", "followup"]
    reason: str = ""
    human_confirmed: bool = True
    human_confirmation_note: str | None = None
    followup_question: str | None = None


class FinanceReportingLoopRequest(BaseModel):
    command: str = Field(..., min_length=5, max_length=4000)
    mode: Literal["order", "secret"] = "order"
    fact_pack: dict[str, Any] | None = None


class PackSwarmLoopRequest(BaseModel):
    command: str = Field(..., min_length=1, max_length=8000)
    mode: Literal["order", "secret"] = "order"
    source_urls: list[str] = []


class FinanceIntelLoopCompleteRequest(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=12)
    market: str = "US"
    question: str = Field(..., min_length=1, max_length=4000)
    edictMode: Literal["public", "secret"] = "public"
    executionType: str = "create_watchlist"
    sourceUrls: list[str] = []


class PolishEdictRequest(BaseModel):
    raw_question: str = Field(..., min_length=1, max_length=4000)
    mode: Literal["order", "secret"] = "order"


def _rule_polish_edict_text(raw_question: str, mode: str) -> str:
    raw = " ".join(raw_question.strip().split())
    if not raw:
        raise ValueError("raw_question 不能为空")
    if raw[-1] not in "。！？.!?":
        raw = f"{raw}。"
    if mode == "secret":
        return raw if raw.startswith("密") else f"密请{raw}"
    return raw if raw.startswith(("请", "准", "令", "安排", "推进")) else f"请{raw}"


def _clean_llm_polish_output(text: str, original: str) -> str | None:
    cleaned = str(text or "").strip().strip("`\"' \n\r\t")
    if not cleaned:
        return None
    if "\n" in cleaned:
        cleaned = " ".join(part.strip() for part in cleaned.splitlines() if part.strip())
    if len(cleaned) > max(800, len(original) * 4):
        return None
    for word in _POLISH_FORBIDDEN_WORDS:
        if word in cleaned and word not in original:
            return None
    return cleaned


def _llm_polish_edict_text(raw_question: str, mode: str) -> str | None:
    try:
        from src.model_adapter import ModelAdapter
        from src.provider import active_fallback_models, get_provider_env

        provider = get_provider_env()
        api_base = provider.get("api_base")
        api_key = provider.get("api_key")
        model = provider.get("model")
        if not (api_base and model):
            return None
        if not api_key and "localhost" not in api_base and "127.0.0.1" not in api_base:
            return None

        tone = "密旨口吻，克制、明确、不可外泄" if mode == "secret" else "正式口吻，清楚、简洁、可执行"
        adapter = ModelAdapter(
            model=model,
            api_base=api_base,
            api_key=api_key,
            merge_system_to_user=bool(provider.get("merge_system_to_user", False)),
            temperature=0.2,
            max_tokens=260,
        )
        result = adapter.call(
            system_prompt=(
                "你只负责中文文字润色。只改写用户给出的原句，使其更正式、更顺畅。"
                "不得新增事实、不得新增部门、不得新增流程、不得提到军机处、会审、六部、蜂群、立案或任务单。"
                "只输出润色后的正文，不要解释，不要标题，不要引号。"
            ),
            user_prompt=f"润色口吻：{tone}\n原文：{raw_question}",
            fallback_models=active_fallback_models(),
            skip_budget=True,
        )
        if result.get("status") != "success":
            return None
        return _clean_llm_polish_output(str(result.get("output") or ""), raw_question)
    except Exception:
        return None


class ChancellorChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)


class ImMessagePayload(BaseModel):
    id: str | None = None
    clientId: str | None = None
    role: Literal["user", "assistant"]
    label: str = ""
    text: str = ""
    time: str | None = None
    mode: Literal["ask", "order", "secret"] | None = None
    sessionId: str | None = None


class ImPersistRequest(BaseModel):
    message: ImMessagePayload


class EdictReturnRequest(BaseModel):
    taskId: str
    jiqunTaskId: str | None = None
    sessionId: str | None = None
    mode: str | None = None
    command: str | None = None
    edictView: dict[str, Any] | None = None
    finalOutputs: list[dict[str, Any]] = []


class FinanceStatusMemorialRequest(BaseModel):
    command: str = Field(..., min_length=1, max_length=4000)
    mode: Literal["order", "secret"] = "order"


class ResearchBudgetLoopRequest(BaseModel):
    sacredEdict: str = Field(..., min_length=1, max_length=4000)
    department: str = "研发部"
    owner: str = ""
    budgetPeriod: str = ""
    purpose: str = ""
    requestedAmount: float = 0
    currency: str = "CNY"
    riskThresholdAmount: float = 500000
    lineItems: list[dict[str, Any]] = []
    evidenceRefs: list[dict[str, Any]] = []


class BriefDecisionAdvanceRequest(BaseModel):
    decision: str
    reason: str = ""
    executionType: str | None = None
    manualConfirmation: bool = False


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


def _latest_review(db, task_id: str) -> CourtReview | None:
    return (
        db.query(CourtReview)
        .filter_by(task_id=task_id)
        .order_by(CourtReview.created_at.desc())
        .first()
    )


def _direct_swarm_skip_payload(
    *,
    task: DecisionTask,
    review: CourtReview,
    memorial: dict[str, Any],
    routing_plan: dict[str, Any],
) -> dict[str, Any]:
    summary = memorial.get("summary", "简单任务单无需蜂群深研。")
    findings = memorial.get("evidence_gaps", [])
    return {
        "task_id": task.id,
        "status": task.status,
        "source_label": task.source_label,
        "adapter_result": {
            "adapter_id": "jiqun",
            "ok": True,
            "external_task_id": task.id,
            "external_session_id": review.id,
            "trace_id": review.id,
            "status": "skipped_direct_route",
            "findings": findings,
            "missing_capabilities": [],
            "user_visible_summary": summary,
            "source_label": task.source_label,
        },
        "swarm_trace_summary": {
            "schema_version": "SwarmTraceV1",
            "task_id": task.id,
            "trace_id": review.id,
            "mode": "not_required",
            "status": "skipped_direct_route",
            "requested_bundles": [],
            "departments": routing_plan.get("ministry_candidates", []),
            "findings": findings,
            "missing_capabilities": [],
            "user_visible_summary": summary,
            "source_label": task.source_label,
        },
        "memorial": memorial,
        "routing_plan": routing_plan,
        "route": routing_plan.get("route"),
    }


def _chancellor_fallback_reply(message: str) -> str:
    edict = draft_edict(message)
    route = chancellor_decide_route(edict)
    next_step = (
        f"此事可先交由{route.get('targetDepartment', '承办方')}直接办一版。"
        if route.get("mode") == "direct"
        else "此事风险或缺口较多，若要执行，应先转军机处会审。"
    )
    gaps = f"缺口：{'、'.join(edict.unknown_gaps[:3])}。" if edict.unknown_gaps else "当前未识别到必须阻断初判的证据缺口。"
    risks = f"风险：{'、'.join(edict.risk_flags[:3])}。" if edict.risk_flags else "未命中高风险标记。"
    return f"臣先按丞相单 Agent 初判：{next_step}\n\n{gaps}\n{risks}\n\n若陛下要正式推进，请再下旨；若只是讨论，可继续追问臣一个具体点。"


def _call_chancellor_agent(message: str) -> tuple[str, str]:
    system_prompt = (
        "你是朝堂 OS 的丞相单 Agent，只回答皇上的咨询，不召集军机处，不调用六部会审。"
        "你的职责是把问题压成老板能判断的下一步：目标、证据缺口、风险、建议动作。"
        "必须诚实说明不确定性；不得伪装实时数据；不得替皇上自动执行。"
        "用中文，简洁，最多 5 段。"
    )
    try:
        import os

        from src.model_adapter import ModelAdapter
        from src.provider import active_fallback_models, get_active_provider

        provider = get_active_provider() or {}
        api_key = os.environ.get(provider.get("api_key_env", "DEEPSEEK_API_KEY"), "")
        api_base = str(provider.get("api_base", ""))
        if not api_key and "localhost" not in api_base and "127.0.0.1" not in api_base:
            return _chancellor_fallback_reply(message), "FALLBACK"
        adapter = ModelAdapter(
            model=provider.get("default_model", "openai/deepseek-chat"),
            api_base=api_base,
            api_key=api_key,
            temperature=0.2,
        )
        result = adapter.call(
            system_prompt,
            message[:4000],
            skip_budget=True,
            fallback_models=active_fallback_models(),
        )
        if result.get("status") == "success" and str(result.get("output") or "").strip():
            return str(result["output"]).strip(), "LIVE"
    except Exception:
        pass
    return _chancellor_fallback_reply(message), "FALLBACK"


def _archive_task(
    db,
    *,
    task: DecisionTask,
    action: str,
    reason: str,
    final_memorial: dict[str, Any] | None,
    now: str,
) -> dict[str, Any]:
    archive_id = make_id("archive", task.id, action, now)
    archive = ShiguanArchive(
        id=archive_id,
        task_id=task.id,
        raw_question=task.raw_question,
        refined_edict=task.refined_edict or "",
        final_memorial_json=_json(final_memorial),
        emperor_decision_json=_json({"action": action, "reason": reason}),
        evidence_chain_json=_json(_loads(task.known_facts_json, [])),
        source_label=task.source_label,
        synthetic_flag=task.source_label in {"FALLBACK", "DEMO"},
        created_at=now,
    )
    db.add(archive)
    task.status = "archived"
    return {
        "archive_id": archive_id,
        "task_id": task.id,
        "created_at": now,
        "source_label": task.source_label,
    }


def _review_payload(review: CourtReview | None) -> dict[str, Any] | None:
    if review is None:
        return None
    return {
        "review_id": review.id,
        "review_status": review.review_status,
        "routing_plan": _loads(review.routing_plan_json, {}),
        "ministry_outputs": _loads(review.ministry_outputs_json, []),
        "conflict_summary": _loads(review.conflict_summary_json, []),
        "memorial": _loads(review.memorial_json, None),
        "created_at": review.created_at,
        "updated_at": review.updated_at,
    }


def _timeline_item(key: str, label: str, done: bool = True) -> dict[str, str]:
    return {"key": key, "label": label, "status": "done" if done else "blocked"}


def _write_swarm_session(session_id: str, payload: dict[str, Any]) -> None:
    SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
    path = SESSIONS_DIR / f"{session_id}.json"
    tmp = path.with_suffix(f".{os.getpid()}.tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, path)


def _finance_case_from_task(task: DecisionTask, review: CourtReview | None = None) -> dict[str, Any]:
    question = task.raw_question
    brief_id = review.id if review is not None else make_id("brief", task.id)
    amount = 0
    currency = "CNY"
    line_items: list[dict[str, Any]] = []
    memorial = _loads(review.memorial_json, {}) if review is not None else {}
    budget = memorial.get("budget") if isinstance(memorial, dict) else None
    if isinstance(budget, dict):
        amount = float(budget.get("requestedAmount") or 0)
        currency = str(budget.get("currency") or "CNY")
        line_items = [item for item in budget.get("lineItems") or [] if isinstance(item, dict)]
    missing = _loads(task.unknown_gaps_json, [])
    budget_brief = {
        "budgetKind": "research_department_budget",
        "requestedAmount": amount,
        "currency": currency,
        "lineItems": line_items,
        "missingEvidence": missing,
        "evidenceCompleteness": 0 if missing else 100,
        "riskGate": {
            "manualConfirmationRequired": amount >= 500000,
            "reasons": ["large_budget_requires_manual_confirmation"] if amount >= 500000 else [],
        },
        "decisionOptions": ["issue_decree", "request_more_evidence", "request_review", "reject"],
    }
    return {
        "taskId": task.id,
        "stage": "awaiting_authorized_decision" if task.status in {"awaiting_decision", "reviewing"} else task.status,
        "task": {"rawCommand": task.raw_question, "result": memorial if isinstance(memorial, dict) else {}},
        "issue": {
            "id": make_id("issue", task.id),
            "title": (task.refined_edict or question)[:80],
            "question": question,
            "intent": task.decision_type or "shangshufang_decision",
        },
        "evidencePacks": [{"id": make_id("pack", task.id), "pack": budget_brief}],
        "memorials": [{"id": review.id if review is not None else make_id("memorial", task.id), "memorial": budget_brief}],
        "decisionBrief": {"id": brief_id, "status": "awaiting_authorized_decision", "brief": budget_brief},
        "instruction": None,
    }


def _finance_status_view(command: str, mode: str, source_label: str = "FALLBACK") -> dict[str, Any]:
    now = now_iso()
    return {
        "id": make_id("finance-status", command, now),
        "title": "户部财务状况回奏",
        "subtitle": "后端已生成即时财务状态回奏；缺少实时财务库时按 FALLBACK 标源。",
        "question": command,
        "meta": {
            "reporter": "上书房 / 户部",
            "priority": "high",
            "badges": [
                {"label": "密旨" if mode == "secret" else "圣旨", "tone": "red" if mode == "secret" else "amber"},
                {"label": source_label, "tone": "red" if source_label == "FALLBACK" else "green"},
            ],
        },
        "rows": [
            {"label": "所问", "body": command},
            {"label": "户部", "body": "当前 FastAPI 后端未接入实时财务总账；本回奏只列接口闭环状态与缺证边界。"},
            {"label": "证据", "body": "需补齐：现金余额、应收应付、预算执行、审计异常、来源时间戳。"},
            {"label": "后令", "body": "请户部补齐财务事实包后再进入准奏或归档。"},
            {"label": "来源", "body": f"source_label={source_label}; generated_at={now}"},
        ],
        "seal": "secret" if mode == "secret" else "imperial",
    }


def _run_swarm_execution_loop_sync(params: dict[str, Any]) -> dict[str, Any]:
    """Run the page-facing sync loop without generic live LLM calls.

    Real department engines still participate when they have deterministic
    inputs. The expensive open-ended LLM branch belongs in async swarm sessions,
    not in Shangshufang page click handlers.
    """
    old = os.environ.get("FENGQUN_LIVE_SWARM")
    os.environ["FENGQUN_LIVE_SWARM"] = "0"
    try:
        return run_swarm_execution_loop(params)
    finally:
        if old is None:
            os.environ.pop("FENGQUN_LIVE_SWARM", None)
        else:
            os.environ["FENGQUN_LIVE_SWARM"] = old


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


@router.post("/chancellor-chat")
def shangshufang_chancellor_chat(body: ChancellorChatRequest) -> StreamingResponse:
    message = body.message.strip()

    def events():
        text, source_label = _call_chancellor_agent(message)
        yield f"data: {json.dumps({'token': text, 'sourceLabel': source_label, 'agent': 'chancellor'}, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(events(), media_type="text/event-stream")


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
        route = chancellor_decide_route(edict)
        edict_payload = {**draft_to_dict(edict), "route": route}
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
                output_json=_json({"draft_edict": edict_payload, "route": route, "eval_result": eval_result}),
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
                "route": route,
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
        route = draft_payload.get("route") if isinstance(draft_payload, dict) else None
        if not isinstance(route, dict):
            route = chancellor_decide_route(edict_for_review)
        routing_plan = routing_plan_for(edict_for_review, route)
        now = now_iso()

        if route.get("mode") == "direct":
            memorial = direct_receipt_for(edict_for_review, routing_plan)
            review_id = make_id("review", task.id, "direct")
            task.status = "direct_completed"
            task.updated_at = now
            db.add(
                CourtReview(
                    id=review_id,
                    task_id=task.id,
                    routing_plan_json=_json(routing_plan),
                    review_status="direct_completed",
                    ministry_outputs_json=_json(memorial["ministry_outputs"]),
                    conflict_summary_json=_json(memorial["conflict_summary"]),
                    memorial_json=_json({**memorial, "draft_edict": draft_payload}),
                    created_at=now,
                    updated_at=now,
                )
            )
            db.add(
                CourtLoopRun(
                    id=make_id("loop", task.id, "confirm-direct", now),
                    task_id=task.id,
                    loop_id=LOOP_ID,
                    status="direct_completed",
                    input_json=_json(body.model_dump()),
                    output_json=_json({"routing_plan": routing_plan, "review_id": review_id, "memorial": memorial, "route": route}),
                    trace_id=review_id,
                    created_at=now,
                    updated_at=now,
                )
            )
            db.add(
                EmperorDecision(
                    id=make_id("decision", task.id, "confirm-direct", now),
                    task_id=task.id,
                    action="confirm_direct_task",
                    reason="皇上确认简单任务单，由丞相判定直接承办",
                    human_confirmed=True,
                    confirmation_record_json=_json(
                        {"user_id": _user_id(user), "confirmed_at": now, "edited": body.edited_edict is not None, "route": route}
                    ),
                    created_at=now,
                )
            )
            db.commit()
            return ok(
                {
                    "task_id": task.id,
                    "status": "direct_completed",
                    "message": f"丞相判定为简单任务单，已交由{route.get('targetDepartment', '承办方')}直接承办。",
                    "review_id": review_id,
                    "routing_plan": routing_plan,
                    "memorial": _loads(db.query(CourtReview).filter_by(id=review_id).first().memorial_json, memorial),
                    "route": route,
                    "direct_receipt": memorial,
                    "review_status_url": f"/api/shangshufang/tasks/{task.id}/status",
                }
            )

        memorial = review_memorial_for(edict_for_review, routing_plan)
        review_id = make_id("review", task.id, "junjichu")
        task.status = "edict_recorded"
        task.updated_at = now
        db.add(
            CourtReview(
                id=review_id,
                task_id=task.id,
                routing_plan_json=_json(routing_plan),
                review_status="edict_recorded",
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
                status="edict_recorded",
                input_json=_json(body.model_dump()),
                output_json=_json(
                    {
                        "routing_plan": routing_plan,
                        "review_id": review_id,
                        "memorial": memorial,
                        "decree_recorded": True,
                        "next_action": "await_async_memorial",
                    }
                ),
                trace_id=review_id,
                created_at=now,
                updated_at=now,
            )
        )
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
                "status": "edict_recorded",
                "message": "圣旨已登记，下旨记录已生成；回奏不在本次请求内同步等待。",
                "review_id": review_id,
                "routing_plan": routing_plan,
                "memorial": _loads(db.query(CourtReview).filter_by(id=review_id).first().memorial_json, memorial),
                "route": route,
                "decree_record": {
                    "task_id": task.id,
                    "review_id": review_id,
                    "status": "edict_recorded",
                    "recorded_at": now,
                    "source_label": task.source_label,
                },
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
                "sourceLabel": "LIVE",
                "task": _task_to_payload(task),
                "review": _review_payload(review),
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
        archive_record = None
        if body.action in {"adopt", "approve", "archive"}:
            archive_record = _archive_task(
                db,
                task=task,
                action=body.action,
                reason=body.reason,
                final_memorial=final_memorial,
                now=now,
            )
            if review is not None:
                review.review_status = "archived"
                review.updated_at = now
        elif body.action in {"request_evidence", "followup"}:
            task.status = "awaiting_evidence"
            if review is not None:
                review.review_status = "awaiting_evidence"
                review.updated_at = now
        elif body.action == "recheck":
            task.status = "reviewing"
            if review is not None:
                review.review_status = "reviewing"
                review.updated_at = now
        elif body.action == "reject":
            task.status = "rejected"
            if review is not None:
                review.review_status = "rejected"
                review.updated_at = now
        else:
            task.status = "awaiting_decision"
        task.updated_at = now
        db.add(
            CourtLoopRun(
                id=make_id("loop", task.id, "decision", body.action, now),
                task_id=task.id,
                loop_id=LOOP_ID,
                status=task.status,
                input_json=_json(body.model_dump()),
                output_json=_json(
                    {
                        "decision_id": decision.id,
                        "archive_record": archive_record,
                        "review_status": review.review_status if review is not None else None,
                    }
                ),
                trace_id=decision.id,
                created_at=now,
                updated_at=now,
            )
        )
        db.commit()
        return ok(
            {
                "task_id": task_id,
                "sourceLabel": "LIVE",
                "status": task.status,
                "decision_id": decision.id,
                "archive_record": archive_record,
            }
        )
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        return fail(str(exc))
    finally:
        db.close()


@router.post("/tasks/{task_id}/swarm-deepen")
def shangshufang_swarm_deepen(task_id: str, user: CurrentUser = Depends(get_current_user)) -> dict:
    from src.db.engine import SessionLocal

    db = SessionLocal()
    try:
        task = db.query(DecisionTask).filter_by(id=task_id).first()
        if task is None:
            return fail("task_id 不存在")
        review = _latest_review(db, task_id)
        if review is None:
            edict = draft_edict(task.raw_question, source_label=task.source_label)
            routing_plan = routing_plan_for(edict)
            if routing_plan.get("route", {}).get("mode") == "direct":
                memorial = direct_receipt_for(edict, routing_plan)
                now = now_iso()
                review = CourtReview(
                    id=make_id("review", task.id, "swarm-deepen-direct", now),
                    task_id=task.id,
                    routing_plan_json=_json(routing_plan),
                    review_status="direct_completed",
                    ministry_outputs_json=_json(memorial["ministry_outputs"]),
                    conflict_summary_json=_json(memorial["conflict_summary"]),
                    memorial_json=_json(memorial),
                    created_at=now,
                    updated_at=now,
                )
                db.add(review)
                task.status = "direct_completed"
                task.updated_at = now
                db.commit()
                return ok(
                    _direct_swarm_skip_payload(
                        task=task,
                        review=review,
                        memorial=memorial,
                        routing_plan=routing_plan,
                    )
                )
            memorial = review_memorial_for(edict, routing_plan)
            now = now_iso()
            review = CourtReview(
                id=make_id("review", task.id, "swarm-deepen", now),
                task_id=task.id,
                routing_plan_json=_json(routing_plan),
                review_status="reviewing",
                ministry_outputs_json=_json(memorial["ministry_outputs"]),
                conflict_summary_json=_json(memorial["conflict_summary"]),
                memorial_json=_json(memorial),
                created_at=now,
                updated_at=now,
            )
            db.add(review)
            db.flush()
        draft_payload = _loads(task.draft_edict_json, {}) or draft_to_dict(draft_edict(task.raw_question, source_label=task.source_label))
        routing_plan = _loads(review.routing_plan_json, {})
        if routing_plan.get("route", {}).get("mode") == "direct":
            memorial = _loads(review.memorial_json, {})
            task.status = "direct_completed"
            task.updated_at = now_iso()
            db.commit()
            return ok(
                _direct_swarm_skip_payload(
                    task=task,
                    review=review,
                    memorial=memorial,
                    routing_plan=routing_plan,
                )
            )
        swarm_result = _run_swarm_execution_loop_sync(
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
        task.status = "awaiting_decision" if swarm_result["quality_result"]["passed"] else "awaiting_evidence"
        task.updated_at = now_iso()
        db.commit()
        db.refresh(review)
        memorial = _loads(review.memorial_json, {})
        route = swarm_result["swarm_run"]["route_plan"]
        selected = [item["swarm_id"] for item in route.get("selected_swarms", [])]
        return ok(
            {
                "task_id": task.id,
                "status": task.status,
                "source_label": swarm_result["swarm_run"]["source_label"],
                "adapter_result": {
                    "adapter_id": "jiqun",
                    "ok": swarm_result["quality_result"]["passed"],
                    "external_task_id": task.id,
                    "external_session_id": swarm_result["swarm_run"]["id"],
                    "trace_id": swarm_result["swarm_run"]["trace_id"] or swarm_result["swarm_run"]["id"],
                    "status": swarm_result["swarm_run"]["status"],
                    "findings": memorial.get("evidence_gaps", []),
                    "missing_capabilities": swarm_result["quality_result"].get("blocking_reasons", []),
                    "user_visible_summary": memorial.get("summary", "蜂群深挖已完成。"),
                    "source_label": swarm_result["swarm_run"]["source_label"],
                },
                "swarm_trace_summary": {
                    "schema_version": "SwarmTraceV1",
                    "task_id": task.id,
                    "trace_id": swarm_result["swarm_run"]["id"],
                    "mode": "live_adapter",
                    "status": swarm_result["swarm_run"]["status"],
                    "requested_bundles": selected,
                    "departments": selected,
                    "findings": memorial.get("evidence_gaps", []),
                    "missing_capabilities": swarm_result["quality_result"].get("blocking_reasons", []),
                    "user_visible_summary": memorial.get("summary", "蜂群深挖已完成。"),
                    "source_label": swarm_result["swarm_run"]["source_label"],
                },
                "memorial": memorial,
                "routing_plan": routing_plan,
            }
        )
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        return fail(str(exc))
    finally:
        db.close()


@router.post("/pack-swarm-loop")
def shangshufang_pack_swarm_loop(
    body: PackSwarmLoopRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    from src.db.engine import SessionLocal

    db = SessionLocal()
    task_id = make_id("packtask", body.command, _user_id(user), now_iso())
    now = now_iso()
    try:
        source_label = "MIXED" if body.source_urls else "FALLBACK"
        edict = draft_edict(
            body.command,
            evidence_summary={"live": bool(body.source_urls), "source_urls": body.source_urls},
            source_label=source_label,
        )
        edict_payload = draft_to_dict(edict)
        routing_plan = routing_plan_for(edict)
        review_id = make_id("review", task_id, "pack-swarm-loop", now)
        memorial = review_memorial_for(edict, routing_plan)
        db.add(
            DecisionTask(
                id=task_id,
                user_id=_user_id(user),
                raw_question=edict.original_question,
                refined_edict=edict.refined_edict,
                decision_type="PACK 蜂群协同评估",
                status="awaiting_evidence",
                source_label=source_label,
                risk_flags_json=_json(edict.risk_flags),
                known_facts_json=_json(edict.known_facts),
                unknown_gaps_json=_json(edict.unknown_gaps),
                recommended_departments_json=_json(["锦衣卫", "户部", "工部", "刑部"]),
                draft_edict_json=_json(edict_payload),
                created_at=now,
                updated_at=now,
            )
        )
        db.add(
            CourtReview(
                id=review_id,
                task_id=task_id,
                routing_plan_json=_json(routing_plan),
                review_status="awaiting_evidence",
                ministry_outputs_json=_json(memorial["ministry_outputs"]),
                conflict_summary_json=_json(memorial["conflict_summary"]),
                memorial_json=_json(memorial),
                created_at=now,
                updated_at=now,
            )
        )
        swarm_result = _run_swarm_execution_loop_sync(
            {
                "task_id": task_id,
                "review_id": review_id,
                "mode": body.mode,
                "confirmed_edict": {**edict_payload, "source_label": source_label},
                "review_plan": routing_plan,
                "department_ids": ["锦衣卫", "户部", "工部", "刑部"],
            }
        )
        persist_swarm_execution_result(db, swarm_result)
        attach_swarm_result_to_review(db, review_id, swarm_result)
        db.commit()
        collection_checklist = [
            "客户需求与应用场景",
            "电芯/电池包规格与BOM",
            "供应商报价与交付周期",
            "测试标准、质保与售后边界",
            "竞品价格与市场样本",
        ]
        missing = [] if body.source_urls else ["客户样本来源", "BOM/报价来源", "测试报告来源"]
        adapter_ok = bool(body.source_urls) and swarm_result["quality_result"]["passed"]
        return ok(
            {
                "schema_version": "PackSwarmLoopV1",
                "task_id": task_id,
                "loop_trace_id": swarm_result["swarm_run"]["id"],
                "mode": body.mode,
                "command": body.command,
                "entry_swarm": "pack_rd",
                "source_label": "MIXED" if adapter_ok else "FALLBACK",
                "departments": [
                    {"id": "jinyiwei", "label": "锦衣卫", "role": "采集客户、竞品、报价和来源证据"},
                    {"id": "hu_bu", "label": "户部", "role": "预算、成本、ROI 和付款风险"},
                    {"id": "gong_bu", "label": "工部", "role": "PACK 技术方案、BOM、测试和交付"},
                    {"id": "xing_bu", "label": "刑部", "role": "合同、责任边界和对外承诺"},
                ],
                "collection_checklist": collection_checklist,
                "data_schema": ["customer_profile", "pack_spec", "bom", "supplier_quote", "test_report", "after_sales_scope"],
                "scoring_rubric": ["证据完整度", "成本可信度", "技术可交付性", "合同风险", "战略优先级"],
                "validation_methods": ["来源链接核验", "报价交叉验证", "BOM 复算", "测试报告复核", "人工裁决确认"],
                "evidence_bound_run": {
                    "schema_version": "EvidenceBoundSwarmRunV1",
                    "entry_swarm": "pack_rd",
                    "task_input": body.command,
                    "intelligence_pack_id": make_id("pack", task_id),
                    "intelligence_pack": {
                        "schema_version": "PackIntelligencePackV1",
                        "packId": make_id("pack", task_id),
                        "sourceLabel": "MIXED" if body.source_urls else "FALLBACK",
                        "sourceUrls": body.source_urls,
                        "facts": edict.known_facts,
                        "missingEvidence": missing,
                        "qualityGates": ["source_urls_present", "bom_quote_traceable", "human_decision_required"],
                    },
                    "evidence_refs": body.source_urls,
                    "missing_evidence": missing,
                    "forbidden_outputs": ["external_commitment", "payment_instruction", "binding_quote"],
                    "source_label": "MIXED" if body.source_urls else "FALLBACK",
                },
                "adapter_result": {
                    "adapter_id": "jiqun",
                    "ok": adapter_ok,
                    "external_task_id": task_id,
                    "external_session_id": swarm_result["swarm_run"]["id"],
                    "trace_id": swarm_result["swarm_run"]["id"],
                    "status": swarm_result["swarm_run"]["status"],
                    "findings": swarm_result["brief"].get("missing_evidence", []),
                    "missing_capabilities": [] if adapter_ok else missing,
                    "user_visible_summary": swarm_result["brief"].get("executive_summary", "PACK 蜂群协同评估已生成。"),
                    "source_label": "MIXED" if body.source_urls else "FALLBACK",
                },
                "swarm_trace_summary": {
                    "schema_version": "SwarmTraceV1",
                    "task_id": task_id,
                    "trace_id": swarm_result["swarm_run"]["id"],
                    "mode": "live_adapter",
                    "status": swarm_result["swarm_run"]["status"],
                    "requested_bundles": ["pack_rd", "jinyiwei", "hu_bu", "gong_bu"],
                    "departments": ["锦衣卫", "户部", "工部", "刑部"],
                    "findings": swarm_result["brief"].get("missing_evidence", []),
                    "missing_capabilities": [] if adapter_ok else missing,
                    "user_visible_summary": swarm_result["brief"].get("executive_summary", "PACK 蜂群协同评估已生成。"),
                    "source_label": "MIXED" if body.source_urls else "FALLBACK",
                },
                "human_intervention_required": bool(missing) or not adapter_ok,
                "hubu_budget_project": {
                    "id": make_id("budget", task_id),
                    "title": "PACK 蜂群建设预算",
                    "status": "awaiting_evidence" if missing else "ready_for_review",
                    "requested_budget": "待户部按 BOM/报价核算",
                    "estimated_roi": "待补证",
                    "priority": "high",
                    "risk_level": "high" if missing else "medium",
                },
                "final_recommendation": "先补齐锦衣卫采集清单与 BOM/报价来源，再进入户部核算和工部评审。" if missing else "可进入建设评审，但仍需人工裁决确认。",
                "timeline": [
                    {"stage": "上书房立案", "status": "done", "summary": f"task={task_id}"},
                    {"stage": "锦衣卫采集", "status": "blocked" if missing else "done", "summary": "来源证据待补齐" if missing else "来源已挂载"},
                    {"stage": "户部预算", "status": "blocked" if missing else "done", "summary": "等待 BOM/报价" if missing else "可核算预算"},
                    {"stage": "工部方案", "status": "done", "summary": "已形成评审口径"},
                    {"stage": "上书房裁决", "status": "blocked" if missing else "done", "summary": "需人工确认" if missing else "等待裁决"},
                ],
            }
        )
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        return fail(str(exc))
    finally:
        db.close()


@router.post("/finance-intel-loop/complete")
def shangshufang_finance_intel_loop_complete(
    body: FinanceIntelLoopCompleteRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    from src.db.engine import SessionLocal

    db = SessionLocal()
    now = now_iso()
    task_id = make_id("finance", body.ticker.upper(), body.question, _user_id(user), now)
    session_id = make_id("session", "finance-intel", task_id, now)
    question = body.question
    source_urls = body.sourceUrls or []
    try:
        request = SwarmRunRequest(
            task_input=question,
            entry_swarm="finance",
            courtos_task_id=task_id,
            courtos_user_id=_user_id(user),
            courtos_edict_mode=body.edictMode,
            intelligence_pack_id=make_id("intelpack", task_id),
            intelligence_pack={"ticker": body.ticker.upper(), "market": body.market, "sourceUrls": source_urls},
            evidence_refs=source_urls,
            missing_evidence=[] if source_urls else [],
            forbidden_outputs=["trade_recommendation", "payment_instruction", "external_commitment"],
            source_label="LIVE" if source_urls else "FALLBACK",
            evidence_bound_run={
                "ticker": body.ticker.upper(),
                "market": body.market,
                "mode": body.edictMode,
                "source_label": "LIVE" if source_urls else "FALLBACK",
                "sourceUrls": source_urls,
            },
        )
        session = build_finance_intel_session(session_id=session_id, task_input=question, body=request)
        _write_swarm_session(session_id, session)
        loop = session.get("finance_intel_loop") or {}
        generated_urls = [str(url) for url in loop.get("sourceUrls") or []]
        evidence_complete = bool(generated_urls) and not (loop.get("qualityGate") or {}).get("checks", {}).get("missing_evidence_clear") is False
        edict = draft_edict(question, evidence_summary={"live": bool(generated_urls)}, source_label="LIVE" if generated_urls else "FALLBACK")
        edict_payload = draft_to_dict(edict)
        review_id = make_id("brief", task_id, "finance-intel")
        brief = {
            "title": f"{body.ticker.upper()} finance-intel-loop brief",
            "verdict": "awaiting_authorized_decision" if evidence_complete else "needs_evidence",
            "summary": (loop.get("memorial") or {}).get("summary", "户部已生成 finance-intel-loop 奏折。"),
            "sourceUrls": generated_urls,
            "budgetKind": "finance_intel_loop",
            "decisionOptions": ["issue_decree", "request_more_evidence", "request_review", "reject"],
            "riskGate": {"manualConfirmationRequired": True, "reasons": ["finance_decision_requires_authorized_human_review"]},
        }
        db.add(
            DecisionTask(
                id=task_id,
                user_id=_user_id(user),
                raw_question=question,
                refined_edict=edict.refined_edict,
                decision_type="finance_intel_loop",
                status="awaiting_decision" if evidence_complete else "awaiting_evidence",
                source_label="LIVE" if generated_urls else "FALLBACK",
                risk_flags_json=_json(["需人工确认", "投资建议边界"]),
                known_facts_json=_json([f"ticker={body.ticker.upper()}", *generated_urls]),
                unknown_gaps_json=_json([] if evidence_complete else ["SEC 官方来源链接"]),
                recommended_departments_json=_json(["锦衣卫", "户部", "上书房"]),
                draft_edict_json=_json(edict_payload),
                created_at=now,
                updated_at=now,
            )
        )
        db.add(
            CourtReview(
                id=review_id,
                task_id=task_id,
                routing_plan_json=_json({"ministry_candidates": ["锦衣卫", "户部", "上书房"], "source_label": "LIVE" if generated_urls else "FALLBACK"}),
                review_status="awaiting_decision" if evidence_complete else "awaiting_evidence",
                ministry_outputs_json=_json([loop.get("memorial") or {}]),
                conflict_summary_json=_json([]),
                memorial_json=_json({"decisionBrief": brief, "finance_intel_loop": loop, "source_label": "LIVE_SWARM"}),
                created_at=now,
                updated_at=now,
            )
        )
        db.commit()
        if evidence_complete:
            stage = "awaiting_authorized_decision"
            awaiting_decision = True
            done = False
        else:
            stage = "awaiting_jinyiwei_evidence"
            awaiting_decision = False
            done = False
        return ok(
            {
                "done": done,
                "stage": stage,
                "awaitingDecision": awaiting_decision,
                "edictMode": body.edictMode,
                "issueId": make_id("issue", task_id),
                "taskId": task_id,
                "signalId": None,
                "routeId": make_id("route", task_id),
                "sessionId": session_id,
                "memorialId": make_id("memorial", task_id),
                "briefId": review_id,
                "instructionId": None,
                "executionRunId": None,
                "archiveId": None,
                "sourceUrls": generated_urls,
                "timeline": [
                    _timeline_item("issue", "上书房立案"),
                    _timeline_item("intel", "锦衣卫取证", bool(generated_urls)),
                    _timeline_item("hubu", "户部测算奏折", evidence_complete),
                    _timeline_item("decision", "上书房裁决", awaiting_decision),
                    _timeline_item("return", "回上书房复命", False),
                    _timeline_item("archive", "史馆归档", False),
                ],
            }
        )
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        return fail(str(exc))
    finally:
        db.close()


@router.get("/finance-intel-loop/cases/{task_id}")
def shangshufang_finance_intel_loop_case(task_id: str, _: CurrentUser = Depends(get_current_user)) -> dict:
    from src.db.engine import SessionLocal

    db = SessionLocal()
    try:
        task = db.query(DecisionTask).filter_by(id=task_id).first()
        if task is None:
            return fail("task_id 不存在")
        return ok(_finance_case_from_task(task, _latest_review(db, task_id)))
    finally:
        db.close()


@router.post("/briefs/{brief_id}/decision")
def shangshufang_brief_decision(
    brief_id: str,
    body: BriefDecisionAdvanceRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    return shangshufang_brief_decision_advance(brief_id, body, user)


@router.post("/briefs/{brief_id}/decision/advance")
def shangshufang_brief_decision_advance(
    brief_id: str,
    body: BriefDecisionAdvanceRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    from src.db.engine import SessionLocal

    db = SessionLocal()
    try:
        review = db.query(CourtReview).filter_by(id=brief_id).first()
        if review is None:
            return fail("brief_id 不存在")
        task = db.query(DecisionTask).filter_by(id=review.task_id).first()
        if task is None:
            return fail("task_id 不存在")
        mapping = {
            "issue_decree": "adopt",
            "request_more_evidence": "request_evidence",
            "request_review": "recheck",
            "reject": "reject",
        }
        action = mapping.get(body.decision, "request_evidence")
        now = now_iso()
        decision = EmperorDecision(
            id=make_id("decision", task.id, action, now),
            task_id=task.id,
            action=action,
            reason=body.reason,
            human_confirmed=bool(body.manualConfirmation),
            confirmation_record_json=_json({"user_id": _user_id(user), "brief_id": brief_id, "at": now, "execution_type": body.executionType}),
            created_at=now,
        )
        db.add(decision)
        final_memorial = _loads(review.memorial_json, None)
        archive_record = None
        if action == "adopt":
            archive_record = _archive_task(db, task=task, action=action, reason=body.reason, final_memorial=final_memorial, now=now)
            review.review_status = "archived"
        elif action == "request_evidence":
            task.status = "awaiting_evidence"
            review.review_status = "awaiting_evidence"
        elif action == "recheck":
            task.status = "reviewing"
            review.review_status = "reviewing"
        else:
            task.status = "rejected"
            review.review_status = "rejected"
        task.updated_at = now
        review.updated_at = now
        db.commit()
        return ok({"task_id": task.id, "sourceLabel": "LIVE", "status": task.status, "decision_id": decision.id, "archive_record": archive_record})
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        return fail(str(exc))
    finally:
        db.close()


@router.post("/polish-edict")
def shangshufang_polish_edict(
    body: PolishEdictRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    try:
        polished = _llm_polish_edict_text(body.raw_question, body.mode)
        source_label = "LIVE" if polished else "FALLBACK"
        fallback_used = polished is None
        if polished is None:
            polished = _rule_polish_edict_text(body.raw_question, body.mode)
        return ok(
            {
                "mode": body.mode,
                "original_question": body.raw_question,
                "polished_edict": polished,
                "source_label": source_label,
                "audit_id": make_id("polish", body.raw_question, _user_id(user), now_iso()),
                "fallback_used": fallback_used,
                "read_only_reason": None,
            }
        )
    except Exception as exc:  # noqa: BLE001
        return fail(str(exc))


@router.get("/im")
def shangshufang_im_list(
    mode: str = "order",
    limit: int = 50,
    sessionId: str | None = None,
    _: CurrentUser = Depends(get_current_user),
) -> dict:
    filtered = [
        msg
        for msg in _IM_MESSAGES
        if msg.get("mode") == mode and (sessionId is None or msg.get("sessionId") == sessionId)
    ]
    return ok({"messages": filtered[-max(1, min(limit, 200)):]} )


@router.post("/im")
def shangshufang_im_persist(
    body: ImPersistRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    created = now_iso()
    msg = body.message.model_dump()
    message = {
        "id": msg.get("id") or msg.get("clientId") or make_id("im", msg.get("text", ""), created),
        "role": msg["role"],
        "label": msg.get("label") or ("陛下" if msg["role"] == "user" else "上书房"),
        "text": msg.get("text") or "",
        "time": msg.get("time") or created[11:16],
        "createdAt": created,
        "mode": msg.get("mode") or "order",
        "sessionId": msg.get("sessionId") or "default",
        "userId": _user_id(user),
        "source_label": "FALLBACK",
    }
    _IM_MESSAGES.append(message)
    del _IM_MESSAGES[:-500]
    return ok({"message": message})


@router.post("/edict-return")
def shangshufang_edict_return(
    body: EdictReturnRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    from src.db.engine import SessionLocal

    db = SessionLocal()
    try:
        task = db.query(DecisionTask).filter_by(id=body.taskId).first()
        if task is None:
            return fail("task_id 不存在")
        review = _latest_review(db, body.taskId)
        now = now_iso()
        return_payload = {
            "taskId": body.taskId,
            "jiqunTaskId": body.jiqunTaskId,
            "sessionId": body.sessionId,
            "mode": body.mode,
            "command": body.command,
            "edictView": body.edictView,
            "finalOutputs": body.finalOutputs,
            "returnedAt": now,
            "sourceLabel": task.source_label,
        }
        if review is not None:
            memorial = _loads(review.memorial_json, {}) or {}
            memorial["edict_return"] = return_payload
            review.memorial_json = _json(memorial)
            review.updated_at = now
        db.add(
            CourtLoopRun(
                id=make_id("loop", body.taskId, "edict-return", now),
                task_id=body.taskId,
                loop_id=LOOP_ID,
                status="edict_returned",
                input_json=_json(body.model_dump()),
                output_json=_json(return_payload),
                trace_id=body.sessionId or body.jiqunTaskId or body.taskId,
                created_at=now,
                updated_at=now,
            )
        )
        task.updated_at = now
        db.commit()
        return ok(return_payload)
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        return fail(str(exc))
    finally:
        db.close()


@router.post("/finance-status-memorial")
def shangshufang_finance_status_memorial(
    body: FinanceStatusMemorialRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    _user_id(user)
    return ok({"done": True, "sourceLabel": "FALLBACK", "view": _finance_status_view(body.command, body.mode)})


@router.post("/research-budget-loop")
def shangshufang_research_budget_loop(
    body: ResearchBudgetLoopRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    from src.db.engine import SessionLocal

    db = SessionLocal()
    now = now_iso()
    task_id = make_id("budget", body.sacredEdict, _user_id(user), now)
    review_id = make_id("brief", task_id, "research-budget")
    try:
        evidence_names = [str(item.get("label") or item.get("id") or "证据") for item in body.evidenceRefs]
        missing = [] if body.evidenceRefs else ["预算依据", "历史支出", "供应商报价"]
        if body.requestedAmount >= body.riskThresholdAmount:
            missing.append("大额预算人工确认")
        budget_brief = {
            "budgetKind": "research_department_budget",
            "requestedAmount": body.requestedAmount,
            "currency": body.currency,
            "lineItems": body.lineItems,
            "missingEvidence": missing,
            "evidenceSummary": {"evidenceRefs": evidence_names, "missingEvidence": missing},
            "evidenceCompleteness": max(0, 100 - len(missing) * 25),
            "riskGate": {
                "manualConfirmationRequired": body.requestedAmount >= body.riskThresholdAmount,
                "reasons": ["large_budget_requires_manual_confirmation"] if body.requestedAmount >= body.riskThresholdAmount else [],
            },
            "decisionOptions": ["issue_decree", "request_more_evidence", "request_review", "reject"],
        }
        db.add(
            DecisionTask(
                id=task_id,
                user_id=_user_id(user),
                raw_question=body.sacredEdict,
                refined_edict=f"请户部承办{body.department}{body.budgetPeriod}预算：{body.purpose}",
                decision_type="research_department_budget",
                status="awaiting_decision",
                source_label="MIXED" if body.evidenceRefs else "FALLBACK",
                risk_flags_json=_json(["大额预算人工确认"] if body.requestedAmount >= body.riskThresholdAmount else []),
                known_facts_json=_json([f"department={body.department}", f"owner={body.owner}", *evidence_names]),
                unknown_gaps_json=_json(missing),
                recommended_departments_json=_json(["户部", "锦衣卫", "上书房"]),
                draft_edict_json=_json({"original_question": body.sacredEdict, "refined_edict": f"请户部承办{body.department}{body.budgetPeriod}预算：{body.purpose}", "source_label": "MIXED" if body.evidenceRefs else "FALLBACK"}),
                created_at=now,
                updated_at=now,
            )
        )
        db.add(
            CourtReview(
                id=review_id,
                task_id=task_id,
                routing_plan_json=_json({"ministry_candidates": ["户部", "锦衣卫", "上书房"], "source_label": "MIXED" if body.evidenceRefs else "FALLBACK"}),
                review_status="awaiting_decision",
                ministry_outputs_json=_json([budget_brief]),
                conflict_summary_json=_json([]),
                memorial_json=_json({"budget": body.model_dump(), "decisionBrief": budget_brief, "source_label": "MIXED" if body.evidenceRefs else "FALLBACK"}),
                created_at=now,
                updated_at=now,
            )
        )
        db.commit()
        return ok(_finance_case_from_task(db.query(DecisionTask).filter_by(id=task_id).first(), db.query(CourtReview).filter_by(id=review_id).first()))
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        return fail(str(exc))
    finally:
        db.close()
