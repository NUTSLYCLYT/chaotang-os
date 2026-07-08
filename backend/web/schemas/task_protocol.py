"""朝堂任务协议 schema。"""
from __future__ import annotations

from pydantic import BaseModel, Field


class TaskProtocolPreviewRequest(BaseModel):
    task: str = Field(..., min_length=1, max_length=4000)
