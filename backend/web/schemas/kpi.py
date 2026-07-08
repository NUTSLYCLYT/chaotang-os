"""KPI / SLO / 校准 schema。"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class BusinessOutcomeRequest(BaseModel):
    flow_name: str = ""
    task_input: str = ""
    quality_score: float = 0
    outcome: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)
    reviewer: str = ""


class CalibrationRequest(BaseModel):
    run_id: str = Field(..., min_length=1)
    step_id: str = ""
    llm_score: float = 0
    human_score: float = Field(...)
    dimensions_llm: dict[str, Any] = Field(default_factory=dict)
    dimensions_human: dict[str, Any] = Field(default_factory=dict)
    reviewer: str = ""
    notes: str = ""
