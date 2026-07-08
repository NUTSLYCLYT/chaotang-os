"""需求文档存档 schema。"""
from __future__ import annotations

from pydantic import BaseModel, Field


class RequirementSaveRequest(BaseModel):
    content: str = Field(..., min_length=1)
    title: str | None = None
    run_id: str = ""
    flow_name: str = ""


class RequirementSaveResponse(BaseModel):
    id: str
    title: str


class RequirementItem(BaseModel):
    id: str
    title: str = ""
    content: str = ""
    run_id: str = ""
    flow_name: str = ""
    created_at: str = ""
