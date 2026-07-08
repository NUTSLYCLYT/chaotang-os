"""AB 测试相关 schema。"""
from __future__ import annotations

from pydantic import BaseModel, Field


class ABTestRequest(BaseModel):
    task: str = Field(..., min_length=1, description="测试任务输入")
    config_a: str = Field(..., min_length=1, description="A 组 flow 配置路径")
    config_b: str = Field(..., min_length=1, description="B 组 flow 配置路径")
    qa_version_a: str | None = None
    qa_version_b: str | None = None
