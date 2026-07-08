"""OpenAI Chat Completions 兼容 schema。

接口契约：https://platform.openai.com/docs/api-reference/chat/create
当前仅实现 sync 模式（stream=true 返回 501）。
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: str = Field(..., description="system/user/assistant")
    content: str = ""


class ChatCompletionRequest(BaseModel):
    model: str = Field(..., min_length=1, description="支持的值: opc / haolong / product / quotation")
    messages: list[ChatMessage] = Field(default_factory=list)
    stream: bool = False
    # 兼容字段（接收但不使用）
    temperature: float | None = None
    max_tokens: int | None = None
    top_p: float | None = None
    n: int | None = None


class ChatCompletionChoice(BaseModel):
    index: int
    message: ChatMessage
    finish_reason: str = "stop"


class ChatCompletionUsage(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


class ChatCompletionResponse(BaseModel):
    id: str
    object: str = "chat.completion"
    model: str
    choices: list[ChatCompletionChoice]
    usage: ChatCompletionUsage = Field(default_factory=ChatCompletionUsage)


class ChatCompletionErrorPayload(BaseModel):
    message: str
    type: str = "invalid_request_error"


class ChatCompletionErrorResponse(BaseModel):
    error: ChatCompletionErrorPayload
