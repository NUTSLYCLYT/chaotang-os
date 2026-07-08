"""聊天会话 schema。"""
from __future__ import annotations

from pydantic import BaseModel, Field


class ChatSessionCreateRequest(BaseModel):
    config: str | None = None
    flow: str | None = None  # 兼容旧字段名


class ChatSessionTurnRequest(BaseModel):
    user_input: str = Field(..., min_length=1)
    config: str | None = None
    qa_version: str | None = None


class ChatSessionTurnResponse(BaseModel):
    task_id: str
    status: str = "running"
