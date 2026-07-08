"""修复循环相关 schema。"""
from __future__ import annotations

from pydantic import BaseModel, Field


class RepairRequest(BaseModel):
    max_retries: int = Field(default=3, ge=1, le=10)
    min_score: float = Field(default=3.5, ge=0.0, le=5.0)
    min_delta: float = Field(default=0.2, ge=0.0, le=5.0)
    min_dimension_score: float = Field(default=3.0, ge=0.0, le=5.0)
    config: str | None = None
