"""统一任务输入与追踪上下文契约（M1）。"""

from __future__ import annotations

import uuid
from typing import Any, Mapping

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _unassigned_trace_id() -> str:
    """每次调用生成唯一值，避免不同任务共享同一个 trace_id。"""
    return f"trace-unassigned-{uuid.uuid4().hex}"


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
        default_factory=lambda: TraceContext(trace_id=_unassigned_trace_id())
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
        """将旧式平铺 trace_id 输入适配为统一 envelope。

        `trace` 与顶层 `trace_id` 同时存在且取值不同视为调用方矛盾输入，直接
        拒绝——不静默丢弃其中一个，避免调用方以为自己指定的 trace_id 生效了
        实际却被悄悄换掉。`trace` 缺 trace_id 而顶层有值时，补进去。`trace`
        可以是 dict 形式，也可以是调用方已经构造好的 `TraceContext` 实例——
        两种形式都要走同一套冲突检测。归一化只认 `Mapping` 和 `TraceContext`
        这两种确切形状，其余一律 `TypeError`：
        - 顶层 `value` 本身不是 `Mapping`（比如 None、字符串、list）时不再让
          `dict(value)` 抛出 Python 内置的、含义不明的 TypeError/ValueError，
          改成同一套显式报错。
        - `trace` 不再接受任意 `BaseModel` 子类（之前 `isinstance(trace, BaseModel)`
          过宽，传一个跟 trace 无关的模型也会被当成 trace 数据源，只是最终在
          `model_validate` 那一步才因为字段对不上而报错，报错信息跟"这是个
          无关类型"没有关系）——收窄成只认 `TraceContext` 自身。
        """
        if not isinstance(value, Mapping):
            raise TypeError(f"unsupported legacy value type: {type(value)!r}")
        data = dict(value)
        trace = data.pop("trace", None)
        trace_id = data.pop("trace_id", None)
        if trace is None:
            trace = {"trace_id": trace_id or _unassigned_trace_id()}
        else:
            if isinstance(trace, TraceContext):
                trace = trace.model_dump()
            elif isinstance(trace, Mapping):
                trace = dict(trace)
            else:
                raise TypeError(f"unsupported trace value type: {type(trace)!r}")
            existing_trace_id = trace.get("trace_id")
            if trace_id is not None and existing_trace_id not in (None, trace_id):
                raise ValueError(
                    f"conflicting trace_id: legacy trace_id={trace_id!r} vs "
                    f"trace.trace_id={existing_trace_id!r}"
                )
            if existing_trace_id is None and trace_id is not None:
                trace["trace_id"] = trace_id
        data["trace"] = trace
        return cls.model_validate(data)
