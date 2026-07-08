"""Flow 配置相关 schema。"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class FlowSummary(BaseModel):
    filename: str
    flow_name: str
    steps_count: int
    default_model: str = ""
    qa_version: str = ""


class FlowUpdateResponse(BaseModel):
    status: str = "saved"
    backup: str


class FlowCreateRequest(BaseModel):
    filename: str = Field(..., pattern=r"^flow_[A-Za-z0-9_\-]+\.yaml$",
                          description="必须匹配 flow_*.yaml")
    config: dict[str, Any]


class FlowCreatedResponse(BaseModel):
    status: str = "created"
    filename: str


class ToolDescription(BaseModel):
    description: str = ""
    capabilities: dict[str, str] = Field(default_factory=dict)
