"""统一任务输入与追踪上下文契约（M1）。"""

from __future__ import annotations

from typing import Any, Mapping

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TraceContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    trace_id: str = Field(min_length=1)
    span_id: str | None = Field(default=None, min_length=1)
    parent_span_id: str | None = Field(default=None, min_length=1)


class TaskEnvelope(BaseModel):
    """跨路由、部门和执行器传递的最小统一任务包。"""

    model_config = ConfigDict(extra="forbid")

    schema_version: str = "TaskEnvelopeV1"
    task_id: str = Field(min_length=1)
    intent: str = Field(min_length=1)
    payload: dict[str, Any] = Field(default_factory=dict)
    trace: TraceContext = Field(
        default_factory=lambda: TraceContext(trace_id="trace-unassigned")
    )
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("schema_version")
    @classmethod
    def _version_is_supported(cls, value: str) -> str:
        if value != "TaskEnvelopeV1":
            raise ValueError("unsupported task envelope schema version")
        return value

    @classmethod
    def from_legacy(cls, value: Mapping[str, Any]) -> "TaskEnvelope":
        """将旧式平铺 trace_id 输入适配为统一 envelope。"""
        data = dict(value)
        trace = data.pop("trace", None)
        trace_id = data.pop("trace_id", None)
        if trace is None:
            trace = {"trace_id": trace_id or "trace-unassigned"}
        data["trace"] = trace
        return cls.model_validate(data)
