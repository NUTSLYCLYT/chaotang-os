"""Backend-owned compatibility API for legacy frontend contracts.

These endpoints keep old browser paths working while the canonical backend
contracts settle. They are real backend routes, not frontend BFF handlers.
"""

from __future__ import annotations

import json
import secrets
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Body, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from src.compat_decision_adapter import persist_compat_decision_task
from web.deps import get_current_user, try_get_current_user
from web.schemas.auth import CurrentUser
from web.task_registry import mark_status, register_task

router = APIRouter(tags=["orchestration-compat"])


def _sse(event: str, payload: dict[str, Any]) -> str:
    body = dict(payload)
    body.setdefault("type", event)
    return f"event: {event}\ndata: {json.dumps(body, ensure_ascii=False)}\n\n"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class OrchestrationRunRequest(BaseModel):
    command: str


class QintianChatRequest(BaseModel):
    message: str
    scenarioContext: dict[str, Any] | None = None


class PromptSuggestRequest(BaseModel):
    input: str


def _qintian_fallback_reply(message: str) -> str:
    clean = " ".join((message or "").strip().split())
    return (
        "钦天监先按单 Agent 兜底占验：当前未接入实时外部检索，也未召集军机处会审。"
        f"\n\n所问：{clean[:160] or '未给出具体问题'}"
        "\n\n请补齐时间窗口、关键变量、最坏情形和可接受损失；若要正式推进，再由丞相判断是否下旨进入执行链。"
    )


def _call_qintian_agent(message: str) -> tuple[str, str]:
    system_prompt = (
        "你是朝堂 OS 的钦天监单 Agent，只回答时机、风险、情景推演和不确定性问题。"
        "你不能召集军机处，不能调用六部会审，不能伪装实时预测或实时检索。"
        "输出必须包含：时机判断、主要变数、最坏情形、建议观察信号。"
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
            return _qintian_fallback_reply(message), "FALLBACK"
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
    return _qintian_fallback_reply(message), "FALLBACK"


def _fallback_intel_signals() -> list[dict[str, Any]]:
    now = _now_iso()
    return [
        {
            "id": "signal-fallback-001",
            "category": "risk",
            "level": "warning",
            "title": "Backend intel source is not connected",
            "summary": "The compatibility endpoint is live, but no Turso intel_signals reader is configured in this backend process.",
            "region": "GLOBAL",
            "regionLabel": "Global",
            "industry": "system",
            "credibility": "low",
            "sources": [{"name": "backend.compat", "publishedAt": now}],
            "firstSeenAt": now,
            "lastUpdatedAt": now,
            "impactScore": 40,
            "soWhat": "This is an honest fallback signal. Do not treat it as real market intelligence.",
        }
    ]


@router.get("/api/court/intel/signals")
def list_intel_signals(
    limit: int = Query(default=80, ge=1, le=200),
    category: str | None = None,
    level: str | None = None,
    region: str | None = None,
) -> dict:
    signals = _fallback_intel_signals()
    if category:
        signals = [item for item in signals if item.get("category") == category]
    if level:
        signals = [item for item in signals if item.get("level") == level]
    if region:
        signals = [item for item in signals if item.get("region") == region]
    signals = signals[:limit]
    return {
        "success": True,
        "data": signals,
        "meta": {
            "total": len(signals),
            "source": "fallback",
            "fetchedAt": _now_iso(),
        },
    }


@router.post("/api/orchestration/run")
def orchestration_run(
    body: OrchestrationRunRequest,
    user: CurrentUser = Depends(get_current_user),
) -> StreamingResponse:
    command = body.command.strip()
    task_id = f"orch-{secrets.token_hex(6)}"
    user_id = str(user.user_id or user.username or user.tenant_slug or "anonymous")
    persist_compat_decision_task(
        task_id=task_id,
        user_id=user_id,
        command=command,
        source_label="FALLBACK",
        compat_entrypoint="orchestration.run",
    )
    register_task(
        task_id,
        task_input=command,
        config="orchestration-compat",
        monitor=True,
        decision_task_id=task_id,
    )

    def events():
        try:
            yield _sse("stage_start", {"stage": "retrieve", "message": "后端已接收审议请求。"})
            yield _sse(
                "retrieve_done",
                {
                    "stage": "retrieve",
                    "tavilyCitations": 0,
                    "precedents": 0,
                    "sourceLabel": "FALLBACK",
                },
            )
            summary = f"已登记审议请求：{command[:120]}"
            yield _sse(
                "zhongshu_done",
                {
                    "stage": "zhongshu",
                    "draft": {
                        "summary": summary,
                        "decision": "进入后端任务登记，等待专线蜂群继续处理。",
                        "citations": [],
                    },
                    "sourceLabel": "FALLBACK",
                },
            )
            yield _sse(
                "menxia_done",
                {
                    "stage": "menxia",
                    "review": {
                        "approved": True,
                        "verdict": "approved",
                        "summary": "兼容端点仅登记事实，不伪装实时蜂群产出。",
                    },
                    "sourceLabel": "FALLBACK",
                },
            )
            yield _sse(
                "shangshu_done",
                {
                    "stage": "shangshu",
                    "execution": {
                        "taskId": task_id,
                        "summary": "任务已进入后端 registry。",
                    },
                    "sourceLabel": "FALLBACK",
                },
            )
            yield _sse("persist_done", {"taskId": task_id, "generated_at": _now_iso()})
            mark_status(
                task_id,
                "done",
                finished_at=_now_iso(),
                run_index_required=False,
                user_id=user.user_id,
            )
            yield _sse(
                "pipeline_done",
                {
                    "taskId": task_id,
                    "result": {
                        "taskId": task_id,
                        "final_decision": "兼容审议完成，已生成后端任务记录。",
                        "finalVerdict": "兼容审议完成",
                        "zhongshu": {"citations": []},
                    },
                    "sourceLabel": "FALLBACK",
                },
            )
        except Exception as exc:  # noqa: BLE001
            mark_status(task_id, "error", error=str(exc))
            yield _sse("error", {"message": str(exc), "taskId": task_id})

    return StreamingResponse(events(), media_type="text/event-stream")


@router.post("/api/qintian/chat-legacy")
def qintian_chat(body: QintianChatRequest) -> StreamingResponse:
    message = body.message.strip()

    def events():
        text = (
            "〔钦天监·占验词·非实时推演〕"
            f"已收到占验：{message[:120]}。当前兼容端点未执行实时外部检索。"
        )
        for token in [text]:
            yield f"data: {json.dumps({'token': token, 'sourceLabel': 'FALLBACK', 'toolsUsed': []}, ensure_ascii=False)}\n\n"
        yield f"data: {json.dumps({'done': True, 'sourceLabel': 'FALLBACK'}, ensure_ascii=False)}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream")


@router.post("/api/qintian/chat")
def qintian_chat_single_agent(body: QintianChatRequest) -> StreamingResponse:
    message = body.message.strip()

    def events():
        text, source_label = _call_qintian_agent(message)
        yield f"data: {json.dumps({'token': text, 'sourceLabel': source_label, 'agent': 'qintian'}, ensure_ascii=False)}\n\n"
        yield f"data: {json.dumps({'done': True, 'sourceLabel': source_label}, ensure_ascii=False)}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream")


@router.post("/api/prompt/suggest")
def prompt_suggest(body: PromptSuggestRequest) -> dict:
    raw = body.input.strip()
    prompt = raw or "请分析当前任务"
    suggestion = {
        "userInput": raw,
        "intent": "analysis",
        "dept": None,
        "suggestions": {
            "fast": {
                "mode": "fast",
                "prompt": prompt,
                "estimatedTime": 3000,
                "estimatedCost": 0,
                "description": "快速整理问题和下一步。",
            },
            "standard": {
                "mode": "standard",
                "prompt": f"请基于事实源分析：{prompt}",
                "estimatedTime": 15000,
                "estimatedCost": 0,
                "description": "补充事实约束后形成建议。",
            },
            "deep": {
                "mode": "deep",
                "prompt": f"请组织多部门会审并给出可执行方案：{prompt}",
                "estimatedTime": 60000,
                "estimatedCost": 0,
                "description": "进入深度审议，适合高风险任务。",
            },
        },
        "recommended": "standard",
        "recommendedReason": "默认选择标准审议，平衡速度与事实约束。",
        "canSplit": False,
        "userHistory": {
            "totalAttempts": 0,
            "successRate": {"fast": 0, "standard": 0, "deep": 0},
            "lastUsedMode": None,
        },
    }
    return {"suggestions": suggestion, "sourceLabel": "FALLBACK"}


@router.post("/api/court/intel/signals/{signal_id}/dispatch")
def dispatch_intel_signal(
    signal_id: str,
    body: dict[str, Any] = Body(default_factory=dict),
    user: CurrentUser | None = Depends(try_get_current_user),
) -> dict:
    targets = body.get("targetAgents") if isinstance(body, dict) else None
    task_id = f"intel-{signal_id}-{secrets.token_hex(4)}"
    register_task(
        task_id,
        task_input=f"dispatch intel signal {signal_id}",
        config="intel-dispatch-compat",
        monitor=True,
        departments=[str(item) for item in targets or []],
    )
    mark_status(
        task_id,
        "done",
        finished_at=_now_iso(),
        run_index_required=False,
        user_id=user.user_id if user else None,
    )
    return {
        "success": True,
        "data": {
            "taskId": task_id,
            "signalId": signal_id,
            "targetAgents": targets or [],
            "sourceLabel": "FALLBACK",
        },
        "error": None,
    }


@router.post("/api/court/dept/swarm-dispatch")
def dept_swarm_dispatch(body: dict[str, Any] = Body(default_factory=dict)) -> dict:
    dept_code = str(body.get("deptCode") or "").strip()
    question = str(body.get("question") or "").strip()
    task_id = f"dept-{dept_code or 'unknown'}-{secrets.token_hex(4)}"
    register_task(
        task_id,
        task_input=question,
        config="dept-swarm-dispatch-compat",
        monitor=True,
        departments=[dept_code] if dept_code else [],
    )
    mark_status(task_id, "done", finished_at=_now_iso(), run_index_required=False)
    return {
        "ok": False,
        "sourceLabel": "FALLBACK",
        "summary": "后端已登记部门派发请求；当前兼容端点未执行实时蜂群实算。",
        "findings": [f"taskId={task_id}"],
        "missingCapabilities": ["live_swarm_adapter"],
        "adapterState": "compat_registered",
        "sessionId": task_id,
        "traceId": task_id,
        "verified": False,
    }


def _dept_true_chain_dispatch(prefix: str, task_input: str) -> dict:
    """工部可行性研判 / 吏部招募共用的诚实兜底登记逻辑,同 dept_swarm_dispatch
    风格:登记任务、给可轮询的 sessionId,不假装已跑真实蜂群。"""
    task_id = f"{prefix}-{secrets.token_hex(4)}"
    register_task(task_id, task_input=task_input, config=f"{prefix}-compat", monitor=True)
    mark_status(task_id, "done", finished_at=_now_iso(), run_index_required=False)
    return {"session_id": task_id, "sourceLabel": "FALLBACK"}


@router.post("/api/court/dept/gong-bu/feasibility")
def gongbu_feasibility(body: dict[str, Any] = Body(default_factory=dict)) -> dict:
    return _dept_true_chain_dispatch("gongbu-feasibility", str(body.get("task_input") or "").strip())


@router.get("/api/court/dept/gong-bu/feasibility/result")
def gongbu_feasibility_result(sid: str = Query(...)) -> dict:
    from web.task_registry import get_task

    task = get_task(sid)
    if task is None:
        return {"ok": False, "sourceLabel": "FALLBACK", "status": "not_found", "sessionId": sid}
    return {
        "ok": False,
        "sourceLabel": "FALLBACK",
        "status": "compat_registered",
        "sessionId": sid,
        "summary": "工部 PACK 可行性蜂群兼容端点已登记任务；当前未接入实时产线资产研判。",
        "missingCapabilities": ["gongbu_pack_feasibility_swarm"],
    }


@router.post("/api/court/dept/li-bu/recruit")
def libu_recruit(body: dict[str, Any] = Body(default_factory=dict)) -> dict:
    return _dept_true_chain_dispatch("libu-recruit", str(body.get("task_input") or "").strip())


@router.get("/api/court/dept/li-bu/recruit/result")
def libu_recruit_result(sid: str = Query(...)) -> dict:
    from web.task_registry import get_task

    task = get_task(sid)
    if task is None:
        return {"ok": False, "sourceLabel": "FALLBACK", "status": "not_found", "sessionId": sid}
    return {
        "ok": False,
        "sourceLabel": "FALLBACK",
        "status": "compat_registered",
        "sessionId": sid,
        "summary": "吏部招聘真链兼容端点已登记任务；当前未接入实时人才蜂群验真。",
        "missingCapabilities": ["libu_recruit_swarm"],
    }
