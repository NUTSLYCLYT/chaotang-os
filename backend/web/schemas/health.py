"""健康检查 schema。"""
from __future__ import annotations

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    version: str = "1.0"
    checks: dict[str, str]
    details: dict[str, dict] = Field(default_factory=dict)
