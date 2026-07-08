"""通用响应模型。"""
from __future__ import annotations

from pydantic import BaseModel, Field


class StatusResponse(BaseModel):
    status: str = Field(..., description="操作状态，通常为 ok/created/deleted/saved")


class ErrorResponse(BaseModel):
    error: str = Field(..., description="错误描述（人类可读中文）")


class IdResponse(BaseModel):
    status: str = "created"
    id: int
