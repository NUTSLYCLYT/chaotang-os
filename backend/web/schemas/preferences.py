"""用户偏好记忆 schema。"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class DomainExpertise(BaseModel):
    domain: str
    keywords: list[str] = Field(default_factory=list)


class PreferenceUpdateRequest(BaseModel):
    style_preferences: dict[str, Any] | None = None
    domain_expertise: list[DomainExpertise] | None = None
    avoid_pattern: str | None = None
    reason: str = "用户指定"


class CorrectionRecordRequest(BaseModel):
    step_id: str = ""
    issue: str = ""
    fix: str = ""
    severity: str = "medium"


class AcceptedDesignRequest(BaseModel):
    step_id: str = ""
    design_choice: str = ""
    context: str = ""


class SuggestFlowRequest(BaseModel):
    task_input: str = ""
