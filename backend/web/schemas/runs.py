"""运行/Step/Rerun/编辑 相关 schema。

⚠️ Response 大量动态字段（final_output 是任意 dict、qa_result schema 随 QA 版本变），
所以详情类响应统一用 dict[str, Any]，仅请求体严格用 Pydantic 校验。
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


# ── 请求 ─────────────────────────────────────────────────

class RunFlowRequest(BaseModel):
    task_input: str = Field(..., min_length=1)
    config: str = Field(..., min_length=1, description="如 'config/flow_opc.yaml'")
    provider: str | None = None


class RunFlowResponse(BaseModel):
    status: str = "accepted"
    run_id_prefix: str
    config: str
    task_input: str


class EditFinalOutputRequest(BaseModel):
    final_output: dict[str, Any] = Field(..., min_length=1)
    edit_note: str = ""


class EditFinalOutputResponse(BaseModel):
    status: str = "saved"
    run_id: str
    fields_saved: int
    backup: str


class RerunRequest(BaseModel):
    from_step: int = 0
    step_id: str | None = None
    step_overrides: dict[str, Any] | None = None


class RerunResponse(BaseModel):
    original_run_id: str
    new_run_id: str
    from_step: int
    step_id: str | None = None


# ── 反馈 ─────────────────────────────────────────────────

class FeedbackRequest(BaseModel):
    rating: int | str | None = None
    thumb: str | None = None
    comment: str = ""
    dimension_ratings: dict[str, int] = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)


class FeedbackSaveResponse(BaseModel):
    status: str = "saved"
    run_id: str
