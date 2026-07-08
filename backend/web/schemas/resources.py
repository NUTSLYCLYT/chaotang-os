"""资源配置 schema。"""
from __future__ import annotations

from pydantic import BaseModel, Field


class ResourceProfileUpdateRequest(BaseModel):
    mode: str = Field(..., description="chaotang_default / hybrid / user_own")
