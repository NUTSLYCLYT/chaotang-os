from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field


class RunRequest(BaseModel):
    input: str = Field(
        ..., min_length=1, max_length=20000, description="用户原始需求描述"
    )
    type: str = Field("auto", description="蜂群类型: opc|haolong|product|legal|auto")
    caller_task_id: Optional[str] = Field(
        None, description="CourtOS 任务ID，完成后回调用"
    )
    optimize_prompt: bool = Field(True, description="是否先经过Prompt优化器")
    qa_version: str = Field("v2", description="QA评分版本: v1|v2|v3")
    options: dict = Field(default_factory=dict)


class RerunRequest(BaseModel):
    from_step: int = Field(0, description="从第几步重跑 (0-based)")
    step_id: Optional[str] = Field(None, description="DAG模式：目标步骤ID")
    prompt_override: Optional[str] = Field(None, description="替换目标步骤的prompt")


class RunStarted(BaseModel):
    run_id: str
    status: str = "queued"
    flow: str
    optimized_input: Optional[str] = None
    stream_url: str


class StepInfo(BaseModel):
    step_idx: int
    step_id: str
    agent_name: str
    status: str  # waiting | running | done | error
    output: Optional[str] = None
    duration_ms: Optional[int] = None
    quality_score: Optional[float] = None


class RunStatus(BaseModel):
    run_id: str
    status: str  # queued | running | complete | failed
    flow: str
    steps: list[StepInfo]
    final_output: Optional[dict] = None
    quality_score: Optional[float] = None
    quality_grade: Optional[str] = None
    error: Optional[str] = None
