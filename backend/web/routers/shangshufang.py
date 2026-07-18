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

from src.chancellor.contracts import RouteDecisionV2
from src.chancellor.decree_status import (
    build_decree_execution_status,
    decide_post_review_status,
    record_timeline_event,
)
from src.chancellor.routing_service import chancellor_routing_service, legacy_route_dict
from src.db.models import (
    AgentSkillRun,
    ChancellorRouteDecision,
    CourtLoopRun,
    CourtReview,
    DecisionTask,
    EmperorDecision,
    FinalMemorial,
    ShiguanArchive,
)
from src.decision_task_kernel import create_decision_task
from src.emperor_decision_kind import emperor_decision_kind
from src.execution.decree_dispatcher import dispatch_after_commit, enqueue_dispatch
from src.finance_intel_loop_contract import build_finance_intel_session
from src.hubu_financial_reporting import build_shangshufang_finance_reporting_loop
from src.shangshufang_loop import (
    chancellor_decide_route,
    direct_receipt_for,
    draft_edict,
    draft_to_dict,
    evaluate_draft,
    format_memorial_sections,
    home_payload,
    make_id,
    now_iso,
    review_memorial_for,
    routing_plan_for,
)
from src.swarm_execution_loop import page_sync_scope, run_swarm_execution_loop
from src.swarm_orchestrator import SESSIONS_DIR
from src.swarm_persistence import (
    attach_swarm_result_to_review,
    persist_swarm_execution_result,
)
from web.deps import get_current_user
from web.routers._envelope import fail, ok
from web.schemas.auth import CurrentUser
from web.schemas.swarm import SwarmRunRequest

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
    # 方案7.2节：路由必须依据这份最终确认正文，不是 edited_edict 里内嵌的
    # refined_edict(那是丞相生成的元描述模板，含"请军机处组织XX参审"字样，
    # 重新解析会自我污染出多余部门命中)。未传时退回 task.raw_question。
    confirmed_edict_text: str | None = None
    idempotency_key: str | None = None


class DecisionRequest(BaseModel):
    action: Literal[
        "approve",
        "archive",
        "adopt",
        "reject",
        "request_evidence",
        "recheck",
        "followup",
    ]
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
        cleaned = " ".join(
            part.strip() for part in cleaned.splitlines() if part.strip()
        )
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

        tone = (
            "密旨口吻，克制、明确、不可外泄"
            if mode == "secret"
            else "正式口吻，清楚、简洁、可执行"
        )
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


def _task_to_payload(
    row: DecisionTask,
    review: "CourtReview | None" = None,
    formal: "FinalMemorial | None" = None,
) -> dict:
    """独立复审(2026-07-11)发现: /home 的任务摘要只有 draft_edict(下旨前的丞相
    拟旨),从不带真实回奏——上书房首页"建议"栏因此永远显示下旨前的草拟文字，
    即使任务早已跑完真实六部会审(awaiting_decision/reviewing/awaiting_evidence)。
    传入 review 时附上最新 CourtReview 的精简摘要，调用方(useShangshufangBriefing)
    优先用它而不是 draft_edict.refined_edict。调用方负责批量取 review，避免
    在列表推导里逐行查询(N+1)。"""
    latest_memorial: dict[str, Any] | None = None
    if formal is not None or review is not None:
        memorial = _loads(
            formal.memorial_json if formal is not None else review.memorial_json,
            {},
        )
        if memorial:
            latest_memorial = {
                "verdict": memorial.get("verdict"),
                "summary": memorial.get("summary"),
                "source_label": (
                    (
                        "LIVE"
                        if formal.source_label == "LIVE_ENGINE"
                        else formal.source_label
                    )
                    if formal is not None
                    else memorial.get("source_label")
                ),
                "ministry_outputs": memorial.get("ministry_outputs", []),
                "formal_memorial_id": formal.id if formal is not None else None,
            }
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
        "latest_memorial": latest_memorial,
    }


def _latest_review(db, task_id: str) -> CourtReview | None:
    return (
        db.query(CourtReview)
        .filter_by(task_id=task_id)
        .order_by(CourtReview.created_at.desc())
        .first()
    )


def _latest_reviews_by_task(db, task_ids: list[str]) -> dict[str, CourtReview]:
    """批量取每个 task_id 的最新一条 CourtReview，避免逐行查询(N+1)。"""
    if not task_ids:
        return {}
    rows = (
        db.query(CourtReview)
        .filter(CourtReview.task_id.in_(task_ids))
        .order_by(CourtReview.task_id, CourtReview.created_at.desc())
        .all()
    )
    latest: dict[str, CourtReview] = {}
    for row in rows:
        latest.setdefault(row.task_id, row)
    return latest


def _final_memorials_by_task(db, task_ids: list[str]) -> dict[str, FinalMemorial]:
    if not task_ids:
        return {}
    return {
        row.task_id: row
        for row in db.query(FinalMemorial)
        .filter(FinalMemorial.task_id.in_(task_ids))
        .all()
    }


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
    gaps = (
        f"缺口：{'、'.join(edict.unknown_gaps[:3])}。"
        if edict.unknown_gaps
        else "当前未识别到必须阻断初判的证据缺口。"
    )
    risks = (
        f"风险：{'、'.join(edict.risk_flags[:3])}。"
        if edict.risk_flags
        else "未命中高风险标记。"
    )
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
        if (
            result.get("status") == "success"
            and str(result.get("output") or "").strip()
        ):
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
    source_label: str,
    now: str,
) -> dict[str, Any]:
    archive_id = make_id("archive", task.id, action, now)
    archive = ShiguanArchive(
        id=archive_id,
        tenant_id=task.tenant_id,
        task_id=task.id,
        raw_question=task.raw_question,
        refined_edict=task.refined_edict or "",
        final_memorial_json=_json(final_memorial),
        emperor_decision_json=_json({"action": action, "reason": reason}),
        evidence_chain_json=_json(_loads(task.known_facts_json, [])),
        source_label=source_label,
        synthetic_flag=source_label in {"FALLBACK", "DEMO"},
        created_at=now,
    )
    db.add(archive)
    task.status = "archived"
    return {
        "archive_id": archive_id,
        "task_id": task.id,
        "created_at": now,
        "source_label": source_label,
    }


def apply_task_decision(
    db,
    *,
    task: "DecisionTask",
    review: "CourtReview | None",
    action: str,
    reason: str | None,
    human_confirmed: bool,
    now: str,
) -> dict[str, Any] | None:
    """收口 adopt/request_evidence/recheck/reject 四类裁决动作的状态转移。

    2026-07-12 复审发现：shangshufang_task_decision 和
    shangshufang_brief_decision_advance 此前各自独立写了一份几乎逐字重复的
    分支——两处一旦改动不同步，就会出现"同一个 action 在两个入口算出不同
    task.status/review_status"的漂移。这里收口成唯一实现。不放进
    decree_status.py 是因为需要调用同文件的 _archive_task，放过去会和该
    模块互相 import 成环。

    2026-07-12 Codex 停止前审查纠正：第一版要求调用方先把自己的 action 词表
    (比如 "approve"/"archive" 这类别名)归一化成 canonical "adopt" 再传进来——
    这会导致 _archive_task 写进 ShiguanArchive.emperor_decision_json 的
    action 字段恒为 "adopt"，丢失史馆归档里"陛下当时具体点的是哪个按钮"这个
    信息(原实现是把 body.action 原样传给 _archive_task，"approve"/"archive"
    这类别名会原样留在归档记录里)。改为在这个函数内部直接认所有别名，调用方
    传原始 action 字符串即可，_archive_task 拿到的还是调用方传入时的原始
    字面量，不做归一化，历史归档记录不再失真。"""
    archive_record: dict[str, Any] | None = None
    if action in {"adopt", "approve", "archive"}:
        from src.db.models import FinalMemorial

        if not human_confirmed:
            raise ValueError("正式奏折必须经过皇上人工确认后才能裁决归档")
        formal = db.query(FinalMemorial).filter_by(task_id=task.id).first()
        if formal is None or formal.status != "ready_for_decision":
            raise ValueError("正式奏折尚未通过质量与来源门，禁止裁决归档")
        final_memorial = _loads(formal.memorial_json, None)
        archive_record = _archive_task(
            db,
            task=task,
            action=action,
            reason=reason or "",
            final_memorial=final_memorial,
            source_label=formal.source_label,
            now=now,
        )
        formal.status = "archived"
        if review is not None:
            review.review_status = "archived"
            review.updated_at = now
    elif action in {"request_evidence", "followup"}:
        task.status = "awaiting_evidence"
        if review is not None:
            review.review_status = "awaiting_evidence"
            review.updated_at = now
    elif action == "recheck":
        task.status = "reviewing"
        if review is not None:
            review.review_status = "reviewing"
            review.updated_at = now
    elif action == "reject":
        task.status = "rejected"
        if review is not None:
            review.review_status = "rejected"
            review.updated_at = now
    else:
        task.status = "awaiting_decision"
    task.updated_at = now
    return archive_record


def record_task_decision_event(
    db,
    *,
    task: "DecisionTask",
    decision: "EmperorDecision",
    archive_record: dict[str, Any] | None,
) -> None:
    """Append the human judgment to the same official task event stream."""
    from src.chancellor.decree_status import record_timeline_event
    from src.db.models import FinalMemorial

    event_types = {
        "adopt": "decision.adopted",
        "approve": "decision.adopted",
        "archive": "decision.adopted",
        "request_evidence": "decision.evidence_requested",
        "followup": "decision.evidence_requested",
        "recheck": "decision.recheck_requested",
        "reject": "decision.rejected",
    }
    formal = db.query(FinalMemorial).filter_by(task_id=task.id).first()
    actual_source = formal.source_label if formal is not None else task.source_label
    event_source = (
        "LIVE" if actual_source in {"LIVE_ENGINE", "LIVE_SWARM"} else actual_source
    )
    record_timeline_event(
        db,
        task_id=task.id,
        stage="completed" if task.status == "archived" else task.status,
        actor="emperor",
        message=f"皇上已人工裁决：{decision.action}。",
        event_type=event_types.get(decision.action, "decision.recorded"),
        trace_id=decision.id,
        source_label=event_source,
        payload={
            "decision_id": decision.id,
            "action": decision.action,
            "human_confirmed": decision.human_confirmed,
            "formal_memorial_id": formal.id if formal is not None else None,
            "formal_source_label": actual_source,
            "archive_id": (
                archive_record.get("archive_id") if archive_record is not None else None
            ),
        },
        idempotency_key=f"decision:{decision.id}",
    )


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


def _formal_memorial_payload(formal) -> dict[str, Any] | None:
    if formal is None:
        return None
    return {
        "id": formal.id,
        "task_id": formal.task_id,
        "review_id": formal.review_id,
        "swarm_run_id": formal.swarm_run_id,
        "quality_result_id": formal.quality_result_id,
        "status": formal.status,
        "source_label": "LIVE" if formal.source_label == "LIVE_ENGINE" else formal.source_label,
        "runtime_source_label": formal.source_label,
        "memorial": _loads(formal.memorial_json, {}),
        "content_hash": formal.content_hash,
        "created_at": formal.created_at,
    }


def _timeline_item(key: str, label: str, done: bool = True) -> dict[str, str]:
    return {"key": key, "label": label, "status": "done" if done else "blocked"}


def _write_swarm_session(session_id: str, payload: dict[str, Any]) -> None:
    SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
    path = SESSIONS_DIR / f"{session_id}.json"
    tmp = path.with_suffix(f".{os.getpid()}.tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, path)


def _finance_case_from_task(
    task: DecisionTask, review: CourtReview | None = None
) -> dict[str, Any]:
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
        line_items = [
            item for item in budget.get("lineItems") or [] if isinstance(item, dict)
        ]
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
            "reasons": (
                ["large_budget_requires_manual_confirmation"]
                if amount >= 500000
                else []
            ),
        },
        "decisionOptions": [
            "issue_decree",
            "request_more_evidence",
            "request_review",
            "reject",
        ],
    }
    return {
        "taskId": task.id,
        "stage": (
            "awaiting_authorized_decision"
            if task.status in {"awaiting_decision", "reviewing"}
            else task.status
        ),
        "task": {
            "rawCommand": task.raw_question,
            "result": memorial if isinstance(memorial, dict) else {},
        },
        "issue": {
            "id": make_id("issue", task.id),
            "title": (task.refined_edict or question)[:80],
            "question": question,
            "intent": task.decision_type or "shangshufang_decision",
        },
        "evidencePacks": [{"id": make_id("pack", task.id), "pack": budget_brief}],
        "memorials": [
            {
                "id": review.id if review is not None else make_id("memorial", task.id),
                "memorial": budget_brief,
            }
        ],
        "decisionBrief": {
            "id": brief_id,
            "status": "awaiting_authorized_decision",
            "brief": budget_brief,
        },
        "instruction": None,
    }


def _finance_status_view(
    command: str, mode: str, source_label: str = "FALLBACK"
) -> dict[str, Any]:
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
                {
                    "label": "密旨" if mode == "secret" else "圣旨",
                    "tone": "red" if mode == "secret" else "amber",
                },
                {
                    "label": source_label,
                    "tone": "red" if source_label == "FALLBACK" else "green",
                },
            ],
        },
        "rows": [
            {"label": "所问", "body": command},
            {
                "label": "户部",
                "body": "当前 FastAPI 后端未接入实时财务总账；本回奏只列接口闭环状态与缺证边界。",
            },
            {
                "label": "证据",
                "body": "需补齐：现金余额、应收应付、预算执行、审计异常、来源时间戳。",
            },
            {"label": "后令", "body": "请户部补齐财务事实包后再进入准奏或归档。"},
            {
                "label": "来源",
                "body": f"source_label={source_label}; generated_at={now}",
            },
        ],
        "seal": "secret" if mode == "secret" else "imperial",
    }


def _run_swarm_execution_loop_sync(params: dict[str, Any]) -> dict[str, Any]:
    """Run the page-facing sync loop fast: no generic live LLM, no real-engine LLM.

    2026-07-14 hang 根因:此前只关通用角色扮演 LLM,但真实部门引擎(兵部/刑部/
    户部…)每部一次真 LLM 外呼不受管;配了 provider key 时串起来 >2min,卡死
    上书房页面点击。页面路径改走确定性规则兜底(各部仍有分奏、快),昂贵真 LLM
    分析留给 async 深议。

    2026-07-14 复审:此前用 os.environ[...] set/finally-restore 实现开关,但本
    路由是同步 def,FastAPI 扔进线程池跑,os.environ 是进程级共享状态——并发请求
    会互相踩踏对方的开关。改用 page_sync_scope()(contextvars,按线程/task 隔离,
    详见 src.swarm_execution_loop)。
    """
    with page_sync_scope():
        return run_swarm_execution_loop(params)


@router.get("/home")
def shangshufang_home(user: CurrentUser = Depends(get_current_user)) -> dict:
    from src.db.engine import SessionLocal

    db = SessionLocal()
    try:
        payload = home_payload()
        pending = (
            db.query(DecisionTask)
            .filter(
                DecisionTask.user_id == _user_id(user),
                DecisionTask.status.in_(
                    ["awaiting_emperor_confirm", "awaiting_decision"]
                )
            )
            .order_by(DecisionTask.updated_at.desc())
            .limit(10)
            .all()
        )
        reviewing = (
            db.query(DecisionTask)
            .filter(
                DecisionTask.user_id == _user_id(user),
                DecisionTask.status.in_(["reviewing", "awaiting_evidence"]),
            )
            .order_by(DecisionTask.updated_at.desc())
            .limit(10)
            .all()
        )
        task_ids = [row.id for row in (*pending, *reviewing)]
        latest_reviews = _latest_reviews_by_task(db, task_ids)
        final_memorials = _final_memorials_by_task(db, task_ids)
        payload["pending_decisions"] = [
            _task_to_payload(
                row,
                latest_reviews.get(row.id),
                final_memorials.get(row.id),
            )
            for row in pending
        ]
        payload["pending_evidence_tasks"] = [
            _task_to_payload(row, latest_reviews.get(row.id)) for row in reviewing
        ]
        if pending:
            top = pending[0]
            payload["source_label"] = top.source_label
            payload["today_issue"] = {
                "title": (top.refined_edict or top.raw_question)[:80],
                "why_now": "该事项已完成丞相拟旨，正在等待皇上确认。",
                "urgency": (
                    "高" if "需人工确认" in _loads(top.risk_flags_json, []) else "中"
                ),
                "recommended_action": "立即处理",
                "evidence_basis": _loads(top.known_facts_json, []),
                "missing_evidence": _loads(top.unknown_gaps_json, []),
            }
        return ok(payload)
    finally:
        db.close()


@router.post("/chancellor-chat")
def shangshufang_chancellor_chat(
    body: ChancellorChatRequest, _: CurrentUser = Depends(get_current_user)
) -> StreamingResponse:
    # 独立审查发现(2026-07-10)：此前缺鉴权依赖，等于匿名可烧真实LLM调用——
    # 同一分支几个提交前(2030baf)才刚修过 swarm-dispatch 的同类"匿名烧蜂群"漏洞，
    # 这里是遗漏的同类端点，补齐依赖。
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

        create_decision_task(
            db,
            task_id=task_id,
            user_id=_user_id(user),
            raw_question=edict.original_question,
            refined_edict=edict.refined_edict,
            decision_type=edict.decision_type,
            status="awaiting_emperor_confirm",
            source_label=edict.source_label,
            risk_flags=edict.risk_flags,
            known_facts=edict.known_facts,
            unknown_gaps=edict.unknown_gaps,
            recommended_departments=edict.recommended_departments,
            draft_edict=edict_payload,
            now=now,
            tenant_id=user.tenant_id,
        )
        db.add(
            CourtLoopRun(
                id=run_id,
                task_id=task_id,
                loop_id=LOOP_ID,
                status="awaiting_emperor_confirm",
                input_json=_json(body.model_dump()),
                output_json=_json(
                    {
                        "draft_edict": edict_payload,
                        "route": route,
                        "eval_result": eval_result,
                    }
                ),
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
        return fail(
            str(exc),
            {
                "task_id": task_id,
                "status": "failed_with_recovery",
                "source_label": "FALLBACK",
            },
        )
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
        if task.user_id != _user_id(user):
            db.rollback()
            return fail("无权确认该任务")
        if not body.confirmed:
            task.status = "draft_cancelled"
            task.updated_at = now_iso()
            db.commit()
            return ok(
                {"task_id": task.id, "status": task.status, "message": "拟旨已取消"}
            )

        # 独立审查发现(2026-07-10)：ChancellorRoutingService.decide() 只在
        # decision 行这一层幂等——同一 task_id 重复调用 confirm-edict(重复点击/
        # 浏览器重试)之前会无条件重新创建 CourtReview/CourtLoopRun/EmperorDecision
        # 并再 enqueue 一次 outbox 事件，导致 council 任务被真实执行两次(真实LLM
        # 成本+task.status 竞态覆盖)。这里在真正处理前短路：任务已经confirm过
        # (direct_completed/edict_recorded 及其后续终态)就直接返回既有结果，
        # 不重复写副作用、不重复派单。
        _TERMINAL_CONFIRMED_STATUSES = {
            "direct_completed",
            "edict_recorded",
            "reviewing",
            "awaiting_decision",
            "awaiting_evidence",
            # menxia_veto_pending 也已经写过 CourtReview(id 由 task.id 确定性生成)，
            # 不加进来的话重试会撞 court_reviews.id 唯一约束(2026-07-18 实测复现)。
            "menxia_veto_pending",
        }
        if task.status in _TERMINAL_CONFIRMED_STATUSES:
            existing_review = _latest_review(db, task.id)
            existing_decision_row = (
                db.query(ChancellorRouteDecision)
                .filter_by(task_id=task.id)
                .order_by(ChancellorRouteDecision.created_at.desc())
                .first()
            )
            if existing_review is not None and existing_decision_row is not None:
                existing_decision = RouteDecisionV2.model_validate_json(
                    existing_decision_row.decision_json
                )
                return ok(
                    {
                        "task_id": task.id,
                        "status": task.status,
                        "message": "该任务已确认下旨，返回既有结果(幂等，未重复派单)。",
                        "review_id": existing_review.id,
                        "routing_plan": _loads(existing_review.routing_plan_json, {}),
                        "memorial": _loads(existing_review.memorial_json, {}),
                        "route": legacy_route_dict(existing_decision),
                        "route_decision": existing_decision.model_dump(),
                        "review_status_url": f"/api/shangshufang/tasks/{task.id}/status",
                    }
                )

        draft_payload = body.edited_edict or _loads(task.draft_edict_json, {})
        # 注意：不能用 draft_payload["refined_edict"] 或 task.refined_edict 作为重新
        # 路由的输入——那是丞相生成的元描述模板("请军机处组织XX参审...")，其中"组织"
        # 等措辞会重新命中部门关键词、自我污染出多余部门。真正的"确认正文"只能是
        # 用户原问，或客户端显式传入的 confirmed_edict_text(方案7.2节请求体)。
        confirmed_edict_text = body.confirmed_edict_text or task.raw_question
        # 阶段1(方案6.6节)：路由必须依据用户确认/编辑后的最终正文重新生成，
        # 不得信任客户端 draft_payload 里回传的 route——2026-07-10 前的实现在这里
        # 直接读 draft_payload["route"]，等于让浏览器决定路由结果。
        idempotency_key = body.idempotency_key or f"confirm-{task.id}"
        route_decision = chancellor_routing_service.decide(
            db,
            task_id=task.id,
            confirmed_edict_text=confirmed_edict_text,
            idempotency_key=idempotency_key,
            source_label=task.source_label,
        )
        if "门下省封驳" in route_decision.risk_flags:
            # 门下省封驳：只审路由，不执行部门任务(menxia_veto.py docstring)。
            # 只认"门下省封驳"这个专属 riskFlag,不认宽泛的 human_confirmation_required
            # ——那个 flag 还有别的合法触发源,拿来当封驳信号会连正常任务一起挡住。
            #
            # 响应契约:前端(unified-loop.ts 等)无条件解引用 result.memorial.*,
            # 早期版本这里只返回 route_decision 会直接把前端打崩。routing_plan_for
            # 是纯函数、不触发真实派单，可以放心调用；memorial 手写一份诚实的
            # "已封驳、未会审"占位，不借真实会审的 direct_receipt_for/review_memorial_for
            # (那两个会触发真实部门任务，正是封驳要拦住的东西)。
            # 任务状态:之前留着 task.status 不变(多半是 draft/awaiting_emperor_confirm)，
            # 用户明明已确认提交却显示"未确认"，不诚实；改成专属状态
            # menxia_veto_pending，明确说"被拦住了，等人工确认"，不复用
            # awaiting_decision(那个隐含"有会审结果可看")或 rejected(那个隐含
            # "用户主动驳回")。
            route = legacy_route_dict(route_decision)
            routing_plan = routing_plan_for(
                draft_edict(confirmed_edict_text, source_label=task.source_label), route
            )
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
                "risk_register": [],
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
                    # passed,前端会判成 overallSignal='GRAY'(未知)而不是
                    # 'RED'(阻断),LIVE 模式渲染整段绕过封驳文案，落回默认的
                    # "作战流完成/仍在收尾"(2026-07-18 审计发现:真实控制流
                    # 是 ministryBrief 走 REST 轮询路径，不是 SSE streamStatus，
                    # 之前只修了 SSE 那条，这条 REST 驱动的 LIVE 模式漏了)。
                    "passed": False,
                    "status": "blocked",
                    "reasons": route_decision.risk_flags,
                    "blocking_issues": route_decision.risk_flags,
                    "human_signoff_required": True,
                },
            }
            memorial["formatted_memorial"] = format_memorial_sections(memorial)
            now = now_iso()
            review_id = make_id("review", task.id, "menxia-veto")
            task.status = "menxia_veto_pending"
            task.updated_at = now
            db.add(
                CourtReview(
                    id=review_id,
                    tenant_id=task.tenant_id,
                    task_id=task.id,
                    routing_plan_json=_json(routing_plan),
                    review_status="menxia_veto_pending",
                    ministry_outputs_json=_json(memorial["ministry_outputs"]),
                    conflict_summary_json=_json(memorial["conflict_summary"]),
                    memorial_json=_json({**memorial, "draft_edict": draft_payload}),
                    created_at=now,
                    updated_at=now,
                )
            )
            db.commit()
            return ok(
                {
                    "task_id": task.id,
                    "status": task.status,
                    "message": route_decision.reason_summary or "门下省封驳，需人工确认后才能派单。",
                    "review_id": review_id,
                    "routing_plan": routing_plan,
                    "memorial": memorial,
                    "route": route,
                    "route_decision": route_decision.model_dump(),
                    "review_status_url": f"/api/shangshufang/tasks/{task.id}/status",
                }
            )
        route = legacy_route_dict(route_decision)
        edict_for_review = draft_edict(
            confirmed_edict_text, source_label=task.source_label
        )
        routing_plan = routing_plan_for(edict_for_review, route)
        now = now_iso()

        if route.get("mode") == "direct":
            memorial = direct_receipt_for(edict_for_review, routing_plan)
            review_id = make_id("review", task.id, "direct")
            task.status = "direct_completed"
            task.updated_at = now
            record_timeline_event(
                db,
                task_id=task.id,
                stage="chancellor_routing",
                actor="chancellor",
                message=route_decision.reason_summary or "丞相完成简单任务路由。",
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
            record_timeline_event(
                db,
                task_id=task.id,
                stage="completed",
                actor="chancellor",
                message=f"丞相判定为简单任务单，已交由{route.get('targetDepartment', '承办方')}直接承办。",
                event_type="memorial.direct_completed",
                trace_id=review_id,
                source_label=route_decision.source_label,
                payload={
                    "decision_id": route_decision.decision_id,
                    "review_id": review_id,
                    "target_department": route.get("targetDepartment"),
                },
                idempotency_key=f"memorial.direct_completed:{review_id}",
            )
            db.add(
                CourtReview(
                    id=review_id,
                    tenant_id=task.tenant_id,
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
                    output_json=_json(
                        {
                            "routing_plan": routing_plan,
                            "review_id": review_id,
                            "memorial": memorial,
                            "route": route,
                        }
                    ),
                    trace_id=review_id,
                    created_at=now,
                    updated_at=now,
                )
            )
            db.add(
                EmperorDecision(
                    id=make_id("decision", task.id, "confirm-direct", now),
                    tenant_id=task.tenant_id,
                    task_id=task.id,
                    action="confirm_direct_task",
                    kind=emperor_decision_kind("confirm_direct_task"),
                    reason="皇上确认简单任务单，由丞相判定直接承办",
                    human_confirmed=True,
                    confirmation_record_json=_json(
                        {
                            "user_id": _user_id(user),
                            "confirmed_at": now,
                            "edited": body.edited_edict is not None,
                            "route": route,
                        }
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
                    "memorial": _loads(
                        db.query(CourtReview)
                        .filter_by(id=review_id)
                        .first()
                        .memorial_json,
                        memorial,
                    ),
                    "route": route,
                    "route_decision": route_decision.model_dump(),
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
                tenant_id=task.tenant_id,
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
                        "next_action": "dispatched_to_outbox",
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
                tenant_id=task.tenant_id,
                task_id=task.id,
                action="confirm_edict",
                kind=emperor_decision_kind("confirm_edict"),
                reason="皇上确认发起军机处会审",
                human_confirmed=True,
                confirmation_record_json=_json(
                    {
                        "user_id": _user_id(user),
                        "confirmed_at": now,
                        "edited": body.edited_edict is not None,
                    }
                ),
                created_at=now,
            )
        )
        record_timeline_event(
            db,
            task_id=task.id,
            stage="chancellor_routing",
            actor="chancellor",
            message=route_decision.reason_summary or "丞相完成军机处参审路由。",
            event_type="routing.decided",
            trace_id=review_id,
            source_label=route_decision.source_label,
            payload={
                "decision_id": route_decision.decision_id,
                "mode": route_decision.mode,
                "participants": [
                    participant.department for participant in route_decision.participants
                ],
            },
            idempotency_key=f"routing.decided:{route_decision.decision_id}",
        )
        # 阶段2(方案6.7节)：下旨记录+路由快照+outbox事件同一事务提交，
        # 事务成功后再触发后台派单——不能反过来先派单再提交，否则会出现
        # "蜂群已经在跑但下旨记录还没落库"的不一致窗口。
        outbox_event_id = enqueue_dispatch(
            db,
            task_id=task.id,
            decision_id=route_decision.decision_id,
            event_type="route.council",
        )
        record_timeline_event(
            db,
            task_id=task.id,
            stage="executing",
            actor="chancellor",
            message="圣旨与路由快照已登记，军机处派单进入可靠 outbox。",
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
        db.commit()
        dispatch_after_commit(outbox_event_id)
        return ok(
            {
                "task_id": task.id,
                "status": "edict_recorded",
                "message": "圣旨已登记，军机处已自动进入后台派单，无需再手动调用 swarm-deepen。",
                "review_id": review_id,
                "routing_plan": routing_plan,
                "memorial": _loads(
                    db.query(CourtReview).filter_by(id=review_id).first().memorial_json,
                    memorial,
                ),
                "route": route,
                "route_decision": route_decision.model_dump(),
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
def shangshufang_task_status(
    task_id: str, user: CurrentUser = Depends(get_current_user)
) -> dict:
    from src.db.engine import SessionLocal

    db = SessionLocal()
    try:
        task = db.query(DecisionTask).filter_by(id=task_id).first()
        if task is None:
            return fail("task_id 不存在")
        # P0-B(2026-07-14):归属校验。跟 jinyiwei.py 的 fill-gap 同款口径——
        # 别人的任务一律拒绝,不泄露其状态和会审内容。
        if task.user_id != _user_id(user):
            return fail("无权查看该任务")
        review = (
            db.query(CourtReview)
            .filter_by(task_id=task_id)
            .order_by(CourtReview.created_at.desc())
            .first()
        )
        from src.db.models import FinalMemorial
        formal_memorial = db.query(FinalMemorial).filter_by(task_id=task_id).first()
        execution_status = build_decree_execution_status(db, task_id)
        return ok(
            {
                "sourceLabel": "LIVE",
                "task": _task_to_payload(task, review),
                "review": _review_payload(review),
                "formal_memorial": _formal_memorial_payload(formal_memorial),
                # 方案10.3节 DecreeExecutionStatusV1；None 表示尚未下旨确认，
                # 还没有 ChancellorRouteDecision，不伪造占位路由快照。
                "execution_status": (
                    execution_status.model_dump() if execution_status else None
                ),
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
        if task.user_id != _user_id(user):
            return fail("无权裁决该任务")
        now = now_iso()
        decision = EmperorDecision(
            id=make_id("decision", task_id, body.action, now),
            tenant_id=task.tenant_id,
            task_id=task_id,
            action=body.action,
            kind=emperor_decision_kind(body.action),
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
        # 直接传原始 body.action(可能是 "approve"/"archive" 这类别名)，不在
        # 这里预先归一化——apply_task_decision 内部自己认得所有别名，同时
        # 会把这个原始字面量原样传给 _archive_task，史馆归档记录里保留的是
        # 陛下当时具体点的哪个动作，不是归一化后的 "adopt"。
        archive_record = apply_task_decision(
            db,
            task=task,
            review=review,
            action=body.action,
            reason=body.reason,
            human_confirmed=body.human_confirmed,
            now=now,
        )
        record_task_decision_event(
            db,
            task=task,
            decision=decision,
            archive_record=archive_record,
        )
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
                        "review_status": (
                            review.review_status if review is not None else None
                        ),
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
def shangshufang_swarm_deepen(
    task_id: str, user: CurrentUser = Depends(get_current_user)
) -> dict:
    from src.db.engine import SessionLocal

    db = SessionLocal()
    try:
        task = db.query(DecisionTask).filter_by(id=task_id).first()
        if task is None:
            return fail("task_id 不存在")
        if task.user_id != _user_id(user):
            return fail("无权对该任务发起深议")
        review = _latest_review(db, task_id)
        if review is None:
            edict = draft_edict(task.raw_question, source_label=task.source_label)
            routing_plan = routing_plan_for(edict)
            if routing_plan.get("route", {}).get("mode") == "direct":
                memorial = direct_receipt_for(edict, routing_plan)
                now = now_iso()
                review = CourtReview(
                    id=make_id("review", task.id, "swarm-deepen-direct", now),
                    tenant_id=task.tenant_id,
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
                tenant_id=task.tenant_id,
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
        draft_payload = _loads(task.draft_edict_json, {}) or draft_to_dict(
            draft_edict(task.raw_question, source_label=task.source_label)
        )
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
        task.status = decide_post_review_status(swarm_result["quality_result"])
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
                    "trace_id": swarm_result["swarm_run"]["trace_id"]
                    or swarm_result["swarm_run"]["id"],
                    "status": swarm_result["swarm_run"]["status"],
                    "findings": memorial.get("evidence_gaps", []),
                    "missing_capabilities": swarm_result["quality_result"].get(
                        "blocking_reasons", []
                    ),
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
                    "missing_capabilities": swarm_result["quality_result"].get(
                        "blocking_reasons", []
                    ),
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
            evidence_summary={
                "live": bool(body.source_urls),
                "source_urls": body.source_urls,
            },
            source_label=source_label,
        )
        edict_payload = draft_to_dict(edict)
        routing_plan = routing_plan_for(edict)
        review_id = make_id("review", task_id, "pack-swarm-loop", now)
        memorial = review_memorial_for(edict, routing_plan)
        create_decision_task(
            db,
            task_id=task_id,
            user_id=_user_id(user),
            raw_question=edict.original_question,
            refined_edict=edict.refined_edict,
            decision_type="PACK 蜂群协同评估",
            status="awaiting_evidence",
            source_label=source_label,
            risk_flags=edict.risk_flags,
            known_facts=edict.known_facts,
            unknown_gaps=edict.unknown_gaps,
            recommended_departments=["锦衣卫", "户部", "工部", "刑部"],
            draft_edict=edict_payload,
            now=now,
            tenant_id=user.tenant_id,
        )
        db.add(
            CourtReview(
                id=review_id,
                tenant_id=user.tenant_id,
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
        missing = (
            [] if body.source_urls else ["客户样本来源", "BOM/报价来源", "测试报告来源"]
        )
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
                    {
                        "id": "jinyiwei",
                        "label": "锦衣卫",
                        "role": "采集客户、竞品、报价和来源证据",
                    },
                    {
                        "id": "hu_bu",
                        "label": "户部",
                        "role": "预算、成本、ROI 和付款风险",
                    },
                    {
                        "id": "gong_bu",
                        "label": "工部",
                        "role": "PACK 技术方案、BOM、测试和交付",
                    },
                    {
                        "id": "xing_bu",
                        "label": "刑部",
                        "role": "合同、责任边界和对外承诺",
                    },
                ],
                "collection_checklist": collection_checklist,
                "data_schema": [
                    "customer_profile",
                    "pack_spec",
                    "bom",
                    "supplier_quote",
                    "test_report",
                    "after_sales_scope",
                ],
                "scoring_rubric": [
                    "证据完整度",
                    "成本可信度",
                    "技术可交付性",
                    "合同风险",
                    "战略优先级",
                ],
                "validation_methods": [
                    "来源链接核验",
                    "报价交叉验证",
                    "BOM 复算",
                    "测试报告复核",
                    "人工裁决确认",
                ],
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
                        "qualityGates": [
                            "source_urls_present",
                            "bom_quote_traceable",
                            "human_decision_required",
                        ],
                    },
                    "evidence_refs": body.source_urls,
                    "missing_evidence": missing,
                    "forbidden_outputs": [
                        "external_commitment",
                        "payment_instruction",
                        "binding_quote",
                    ],
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
                    "user_visible_summary": swarm_result["brief"].get(
                        "executive_summary", "PACK 蜂群协同评估已生成。"
                    ),
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
                    "user_visible_summary": swarm_result["brief"].get(
                        "executive_summary", "PACK 蜂群协同评估已生成。"
                    ),
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
                "final_recommendation": (
                    "先补齐锦衣卫采集清单与 BOM/报价来源，再进入户部核算和工部评审。"
                    if missing
                    else "可进入建设评审，但仍需人工裁决确认。"
                ),
                "timeline": [
                    {
                        "stage": "上书房立案",
                        "status": "done",
                        "summary": f"task={task_id}",
                    },
                    {
                        "stage": "锦衣卫采集",
                        "status": "blocked" if missing else "done",
                        "summary": "来源证据待补齐" if missing else "来源已挂载",
                    },
                    {
                        "stage": "户部预算",
                        "status": "blocked" if missing else "done",
                        "summary": "等待 BOM/报价" if missing else "可核算预算",
                    },
                    {
                        "stage": "工部方案",
                        "status": "done",
                        "summary": "已形成评审口径",
                    },
                    {
                        "stage": "上书房裁决",
                        "status": "blocked" if missing else "done",
                        "summary": "需人工确认" if missing else "等待裁决",
                    },
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
    task_id = make_id(
        "finance", body.ticker.upper(), body.question, _user_id(user), now
    )
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
            intelligence_pack={
                "ticker": body.ticker.upper(),
                "market": body.market,
                "sourceUrls": source_urls,
            },
            evidence_refs=source_urls,
            missing_evidence=[] if source_urls else [],
            forbidden_outputs=[
                "trade_recommendation",
                "payment_instruction",
                "external_commitment",
            ],
            source_label="LIVE" if source_urls else "FALLBACK",
            evidence_bound_run={
                "ticker": body.ticker.upper(),
                "market": body.market,
                "mode": body.edictMode,
                "source_label": "LIVE" if source_urls else "FALLBACK",
                "sourceUrls": source_urls,
            },
        )
        session = build_finance_intel_session(
            session_id=session_id, task_input=question, body=request
        )
        _write_swarm_session(session_id, session)
        loop = session.get("finance_intel_loop") or {}
        generated_urls = [str(url) for url in loop.get("sourceUrls") or []]
        evidence_complete = (
            bool(generated_urls)
            and (loop.get("qualityGate") or {})
            .get("checks", {})
            .get("missing_evidence_clear") is not False
        )
        edict = draft_edict(
            question,
            evidence_summary={"live": bool(generated_urls)},
            source_label="LIVE" if generated_urls else "FALLBACK",
        )
        edict_payload = draft_to_dict(edict)
        review_id = make_id("brief", task_id, "finance-intel")
        brief = {
            "title": f"{body.ticker.upper()} finance-intel-loop brief",
            "verdict": (
                "awaiting_authorized_decision"
                if evidence_complete
                else "needs_evidence"
            ),
            "summary": (loop.get("memorial") or {}).get(
                "summary", "户部已生成 finance-intel-loop 奏折。"
            ),
            "sourceUrls": generated_urls,
            "budgetKind": "finance_intel_loop",
            "decisionOptions": [
                "issue_decree",
                "request_more_evidence",
                "request_review",
                "reject",
            ],
            "riskGate": {
                "manualConfirmationRequired": True,
                "reasons": ["finance_decision_requires_authorized_human_review"],
            },
        }
        create_decision_task(
            db,
            task_id=task_id,
            user_id=_user_id(user),
            raw_question=question,
            refined_edict=edict.refined_edict,
            decision_type="finance_intel_loop",
            status=(
                "awaiting_decision" if evidence_complete else "awaiting_evidence"
            ),
            source_label="LIVE" if generated_urls else "FALLBACK",
            risk_flags=["需人工确认", "投资建议边界"],
            known_facts=[f"ticker={body.ticker.upper()}", *generated_urls],
            unknown_gaps=[] if evidence_complete else ["SEC 官方来源链接"],
            recommended_departments=["锦衣卫", "户部", "上书房"],
            draft_edict=edict_payload,
            now=now,
            tenant_id=user.tenant_id,
        )
        db.add(
            CourtReview(
                id=review_id,
                tenant_id=user.tenant_id,
                task_id=task_id,
                routing_plan_json=_json(
                    {
                        "ministry_candidates": ["锦衣卫", "户部", "上书房"],
                        "source_label": "LIVE" if generated_urls else "FALLBACK",
                    }
                ),
                review_status=(
                    "awaiting_decision" if evidence_complete else "awaiting_evidence"
                ),
                ministry_outputs_json=_json([loop.get("memorial") or {}]),
                conflict_summary_json=_json([]),
                memorial_json=_json(
                    {
                        "decisionBrief": brief,
                        "finance_intel_loop": loop,
                        "source_label": "LIVE_SWARM",
                    }
                ),
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
def shangshufang_finance_intel_loop_case(
    task_id: str, user: CurrentUser = Depends(get_current_user)
) -> dict:
    from src.db.engine import SessionLocal

    db = SessionLocal()
    try:
        task = db.query(DecisionTask).filter_by(id=task_id).first()
        if task is None:
            return fail("task_id 不存在")
        if task.user_id != _user_id(user):
            return fail("无权查看该任务案卷")
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
        if task.user_id != _user_id(user):
            return fail("无权裁决该任务")
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
            tenant_id=task.tenant_id,
            task_id=task.id,
            action=action,
            kind=emperor_decision_kind(action),
            reason=body.reason,
            human_confirmed=bool(body.manualConfirmation),
            confirmation_record_json=_json(
                {
                    "user_id": _user_id(user),
                    "brief_id": brief_id,
                    "at": now,
                    "execution_type": body.executionType,
                }
            ),
            created_at=now,
        )
        db.add(decision)
        # action 恒为 mapping 里四个 canonical 值之一(默认 "request_evidence")，
        # 跟 apply_task_decision 认的词表一致，不需要再映射。
        archive_record = apply_task_decision(
            db,
            task=task,
            review=review,
            action=action,
            reason=body.reason,
            human_confirmed=bool(body.manualConfirmation),
            now=now,
        )
        record_task_decision_event(
            db,
            task=task,
            decision=decision,
            archive_record=archive_record,
        )
        db.commit()
        return ok(
            {
                "task_id": task.id,
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
                "audit_id": make_id(
                    "polish", body.raw_question, _user_id(user), now_iso()
                ),
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
        if msg.get("mode") == mode
        and (sessionId is None or msg.get("sessionId") == sessionId)
    ]
    return ok({"messages": filtered[-max(1, min(limit, 200)) :]})


@router.post("/im")
def shangshufang_im_persist(
    body: ImPersistRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    created = now_iso()
    msg = body.message.model_dump()
    message = {
        "id": msg.get("id")
        or msg.get("clientId")
        or make_id("im", msg.get("text", ""), created),
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
        if task.user_id != _user_id(user):
            return fail("无权回填该任务")
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
    return ok(
        {
            "done": True,
            "sourceLabel": "FALLBACK",
            "view": _finance_status_view(body.command, body.mode),
        }
    )


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
        evidence_names = [
            str(item.get("label") or item.get("id") or "证据")
            for item in body.evidenceRefs
        ]
        missing = [] if body.evidenceRefs else ["预算依据", "历史支出", "供应商报价"]
        if body.requestedAmount >= body.riskThresholdAmount:
            missing.append("大额预算人工确认")
        budget_brief = {
            "budgetKind": "research_department_budget",
            "requestedAmount": body.requestedAmount,
            "currency": body.currency,
            "lineItems": body.lineItems,
            "missingEvidence": missing,
            "evidenceSummary": {
                "evidenceRefs": evidence_names,
                "missingEvidence": missing,
            },
            "evidenceCompleteness": max(0, 100 - len(missing) * 25),
            "riskGate": {
                "manualConfirmationRequired": body.requestedAmount
                >= body.riskThresholdAmount,
                "reasons": (
                    ["large_budget_requires_manual_confirmation"]
                    if body.requestedAmount >= body.riskThresholdAmount
                    else []
                ),
            },
            "decisionOptions": [
                "issue_decree",
                "request_more_evidence",
                "request_review",
                "reject",
            ],
        }
        create_decision_task(
            db,
            task_id=task_id,
            user_id=_user_id(user),
            raw_question=body.sacredEdict,
            refined_edict=f"请户部承办{body.department}{body.budgetPeriod}预算：{body.purpose}",
            decision_type="research_department_budget",
            status="awaiting_decision",
            source_label="MIXED" if body.evidenceRefs else "FALLBACK",
            risk_flags=(
                ["大额预算人工确认"]
                if body.requestedAmount >= body.riskThresholdAmount
                else []
            ),
            known_facts=[
                f"department={body.department}",
                f"owner={body.owner}",
                *evidence_names,
            ],
            unknown_gaps=missing,
            recommended_departments=["户部", "锦衣卫", "上书房"],
            draft_edict={
                "original_question": body.sacredEdict,
                "refined_edict": f"请户部承办{body.department}{body.budgetPeriod}预算：{body.purpose}",
                "source_label": "MIXED" if body.evidenceRefs else "FALLBACK",
            },
            now=now,
            tenant_id=user.tenant_id,
        )
        db.add(
            CourtReview(
                id=review_id,
                tenant_id=user.tenant_id,
                task_id=task_id,
                routing_plan_json=_json(
                    {
                        "ministry_candidates": ["户部", "锦衣卫", "上书房"],
                        "source_label": "MIXED" if body.evidenceRefs else "FALLBACK",
                    }
                ),
                review_status="awaiting_decision",
                ministry_outputs_json=_json([budget_brief]),
                conflict_summary_json=_json([]),
                memorial_json=_json(
                    {
                        "budget": body.model_dump(),
                        "decisionBrief": budget_brief,
                        "source_label": "MIXED" if body.evidenceRefs else "FALLBACK",
                    }
                ),
                created_at=now,
                updated_at=now,
            )
        )
        db.commit()
        return ok(
            _finance_case_from_task(
                db.query(DecisionTask).filter_by(id=task_id).first(),
                db.query(CourtReview).filter_by(id=review_id).first(),
            )
        )
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        return fail(str(exc))
    finally:
        db.close()
