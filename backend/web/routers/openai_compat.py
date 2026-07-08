"""OpenAI Chat Completions 兼容端点 — POST /v1/chat/completions

把蜂群 Flow 执行包装成 OpenAI 标准 chat.completion 格式。
支持的 model 值：opc / haolong / product / quotation
stream=true 暂未实现，返回 501。
"""
from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from src.flow_engine import FlowEngine

from web.deps import get_current_user
from web.schemas.auth import CurrentUser
from web.schemas.openai_compat import (
    ChatCompletionChoice,
    ChatCompletionRequest,
    ChatCompletionResponse,
    ChatCompletionUsage,
    ChatMessage,
)

router = APIRouter(prefix="/v1", tags=["openai_compat"])

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

# model 名称 → flow 配置文件名映射
_MODEL_FLOW_MAP = {
    "opc": "flow_opc.yaml",
    "haolong": "flow_haolong.yaml",
    "product": "flow_product.yaml",
    "quotation": "flow_quotation.yaml",
}


def _openai_error(status_code: int, message: str, err_type: str) -> JSONResponse:
    """返回符合 OpenAI 错误格式的响应（不是 FastAPI 默认的 {"detail":...}）。"""
    return JSONResponse(
        status_code=status_code,
        content={"error": {"message": message, "type": err_type}},
    )


@router.post("/chat/completions", response_model=ChatCompletionResponse)
def api_openai_chat_completions(
    body: ChatCompletionRequest,
    _: CurrentUser = Depends(get_current_user),
):
    """OpenAI 兼容 — 把 jiqun_ai Flow 包装为 chat.completion 响应。"""
    if body.stream:
        return _openai_error(
            501,
            "Streaming not yet supported",
            "not_implemented_error",
        )

    flow_filename = _MODEL_FLOW_MAP.get(body.model)
    if not flow_filename:
        return _openai_error(
            400,
            f"Unknown model: {body.model}",
            "invalid_request_error",
        )

    # 取最后一条 user message
    task_input = ""
    for msg in reversed(body.messages):
        if msg.role == "user":
            task_input = (msg.content or "").strip()
            break

    if not task_input:
        return _openai_error(
            400,
            "No user message found in messages",
            "invalid_request_error",
        )

    config_path = str(_PROJECT_ROOT / "config" / flow_filename)
    if not Path(config_path).exists():
        return _openai_error(
            500,
            f"Flow config not found: {flow_filename}",
            "server_error",
        )

    try:
        engine = FlowEngine(config_path)
        run_log = engine.run(task_input)
    except Exception as e:
        return _openai_error(
            500,
            f"Flow execution failed: {e!s}",
            "server_error",
        )

    final_output = run_log.final_output or {}
    content = json.dumps(final_output, ensure_ascii=False)

    return ChatCompletionResponse(
        id=f"chatcmpl-{run_log.run_id}",
        object="chat.completion",
        model=body.model,
        choices=[
            ChatCompletionChoice(
                index=0,
                message=ChatMessage(role="assistant", content=content),
                finish_reason="stop",
            )
        ],
        usage=ChatCompletionUsage(
            prompt_tokens=0,
            completion_tokens=0,
            total_tokens=0,
        ),
    )
