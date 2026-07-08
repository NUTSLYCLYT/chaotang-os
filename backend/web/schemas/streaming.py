"""异步任务 / SSE / 单步测试 / 修复异步 schema。"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class RunAsyncRequest(BaseModel):
    task_input: str = Field(..., min_length=1)
    config: str = "config/flow_opc.yaml"
    qa_version: str | None = None
    swarm: str | bool | None = None
    execution_modes: dict[str, str] | None = None


class TestStepRequest(BaseModel):
    config: str = Field(..., min_length=1)
    step_id: str = Field(..., min_length=1)
    test_input: str = Field(..., min_length=1)
    context_run_id: str | None = None


class TaskAcceptedResponse(BaseModel):
    task_id: str
    status: str = "running"
    # 蜂群模式下预生成的编排会话 id（response_model 会裁掉未声明字段——此前
    # 前端 pickJiqunSessionId 的"后端会话"分支因此永远走不到）
    session_id: str | None = None


class TaskStatusResponse(BaseModel):
    task_id: str
    status: str
    run_id: str | None = None
    error: str | None = None


class OkResponse(BaseModel):
    ok: bool = True


class OpenClawReplyRequest(BaseModel):
    message: str = Field(..., min_length=1)


class TaskMonitorEntry(BaseModel):
    task_id: str
    status: str | None = None
    task_input: str = ""
    config: str | None = None
    started_at: str | None = None
    finished_at: str | None = None
    flow_name: str | None = None
    total_steps: int | None = None
    current_step: int | None = None
    current_step_name: str | None = None
    completed_steps: int = 0
    step_names: list[str] = []
    run_id: str | None = None
    error: str | None = None
    elapsed_seconds: int | None = None


class TasksSnapshot(BaseModel):
    running: list[TaskMonitorEntry]
    recent: list[TaskMonitorEntry]
