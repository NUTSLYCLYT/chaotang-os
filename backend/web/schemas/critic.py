"""Critic 质疑检查 schema。"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class CriticAnalyzeRequest(BaseModel):
    task_input: str = ""
    steps_summary: str = ""
    qa_result: dict[str, Any] = Field(default_factory=dict)


class CriticAnalyzeResponse(BaseModel):
    system_prompt: str
    user_prompt: str
