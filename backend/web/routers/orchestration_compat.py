"""Backend-owned compatibility API for legacy frontend contracts.

These endpoints keep old browser paths working while the canonical backend
contracts settle. They are real backend routes, not frontend BFF handlers.
"""

from __future__ import annotations

import json
import secrets
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Body, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from web.deps import try_get_current_user
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


@router.post("/api/orchestration/run")
def orchestration_run(
    body: OrchestrationRunRequest,
    user: CurrentUser | None = Depends(try_get_current_user),
) -> StreamingResponse:
    command = body.command.strip()
    task_id = f"orch-{secrets.token_hex(6)}"
    register_task(task_id, task_input=command, config="orchestration-compat", monitor=True)

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
                user_id=user.user_id if user else None,
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


@router.post("/api/qintian/chat")
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
