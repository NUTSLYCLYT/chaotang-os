"""Feature Flag schema。"""
from __future__ import annotations

from pydantic import BaseModel, Field


class FeatureFlagInfo(BaseModel):
    name: str
    enabled: bool
    description: str = ""
    roll_percentage: float = 100.0


class FeatureFlagUpdateRequest(BaseModel):
    enabled: bool = True
    description: str = ""
    roll_percentage: float = Field(default=100.0, ge=0.0, le=100.0)
