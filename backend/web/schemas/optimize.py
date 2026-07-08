"""优化闭环相关 schema。"""
from __future__ import annotations

from pydantic import BaseModel, Field


class OptimizeApplyRequest(BaseModel):
    suggestion_indices: list[int] = Field(default_factory=list)
    from_step: int = 0
    author: str = "user"
