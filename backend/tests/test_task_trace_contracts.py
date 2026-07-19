from pydantic import BaseModel, ValidationError
import pytest

from src.contracts.task_trace import TaskEnvelope, TraceContext


def test_task_envelope_builds_trace_context_and_is_serializable():
    envelope = TaskEnvelope(
        task_id="task-1",
        intent="review",
        payload={"text": "审查合同"},
        trace=TraceContext(trace_id="trace-1", span_id="span-1"),
    )

    assert envelope.schema_version == "TaskEnvelopeV1"
    assert envelope.trace.trace_id == "trace-1"
    assert envelope.model_dump(mode="json")["task_id"] == "task-1"


def test_task_envelope_rejects_empty_identity():
    with pytest.raises(ValidationError):
        TaskEnvelope(task_id="", intent="review", payload={})


def test_task_envelope_accepts_legacy_trace_id_as_compatibility_input():
    envelope = TaskEnvelope.from_legacy(
        {"task_id": "task-2", "intent": "route", "payload": {}, "trace_id": "trace-2"}
    )

    assert envelope.trace.trace_id == "trace-2"
    assert envelope.trace.span_id is None


def test_task_envelope_rejects_unsupported_schema_version():
    with pytest.raises(ValidationError):
        TaskEnvelope(task_id="task-3", intent="review", schema_version="TaskEnvelopeV2")


def test_task_envelope_rejects_unknown_field():
    with pytest.raises(ValidationError):
        TaskEnvelope(task_id="task-4", intent="review", unexpected_field="boom")


def test_from_legacy_rejects_unknown_field():
    with pytest.raises(ValidationError):
        TaskEnvelope.from_legacy(
            {"task_id": "task-5", "intent": "review", "trace_id": "trace-5", "mystery": 1}
        )


def test_from_legacy_rejects_conflicting_trace_and_trace_id():
    with pytest.raises(ValueError):
        TaskEnvelope.from_legacy(
            {
                "task_id": "task-6",
                "intent": "review",
                "trace": {"trace_id": "trace-explicit"},
                "trace_id": "trace-flat-different",
            }
        )


def test_from_legacy_allows_matching_trace_and_trace_id():
    envelope = TaskEnvelope.from_legacy(
        {
            "task_id": "task-6b",
            "intent": "review",
            "trace": {"trace_id": "trace-same", "span_id": "span-1"},
            "trace_id": "trace-same",
        }
    )

    assert envelope.trace.trace_id == "trace-same"
    assert envelope.trace.span_id == "span-1"


def test_from_legacy_fills_missing_trace_id_from_flat_field():
    envelope = TaskEnvelope.from_legacy(
        {
            "task_id": "task-6c",
            "intent": "review",
            "trace": {"span_id": "span-2"},
            "trace_id": "trace-flat-fill",
        }
    )

    assert envelope.trace.trace_id == "trace-flat-fill"
    assert envelope.trace.span_id == "span-2"


def test_unassigned_trace_id_is_unique_per_envelope():
    first = TaskEnvelope(task_id="task-7", intent="review")
    second = TaskEnvelope(task_id="task-8", intent="review")

    assert first.trace.trace_id != second.trace.trace_id
    assert first.trace.trace_id.startswith("trace-unassigned-")


def test_from_legacy_rejects_conflicting_trace_context_instance_and_trace_id():
    with pytest.raises(ValueError):
        TaskEnvelope.from_legacy(
            {
                "task_id": "task-9",
                "intent": "review",
                "trace": TraceContext(trace_id="trace-object"),
                "trace_id": "trace-flat-different",
            }
        )


def test_from_legacy_allows_matching_trace_context_instance_and_trace_id():
    envelope = TaskEnvelope.from_legacy(
        {
            "task_id": "task-10",
            "intent": "review",
            "trace": TraceContext(trace_id="trace-same", span_id="span-3"),
            "trace_id": "trace-same",
        }
    )

    assert envelope.trace.trace_id == "trace-same"
    assert envelope.trace.span_id == "span-3"


def test_from_legacy_rejects_unsupported_trace_value_type():
    with pytest.raises(TypeError):
        TaskEnvelope.from_legacy(
            {"task_id": "task-11", "intent": "review", "trace": "not-a-trace"}
        )


def test_from_legacy_rejects_unrelated_basemodel_as_trace():
    """归一化只认 TraceContext 自身，不接受任意 BaseModel 子类混进来当 trace。"""

    class NotATrace(BaseModel):
        foo: str = "bar"

    with pytest.raises(TypeError):
        TaskEnvelope.from_legacy(
            {"task_id": "task-12", "intent": "review", "trace": NotATrace()}
        )


@pytest.mark.parametrize("bad_value", [None, "not-a-dict", 123, ["task_id", "intent"]])
def test_from_legacy_rejects_non_mapping_top_level_value(bad_value):
    """value 本身不是 Mapping 时，改成显式 TypeError，不让内置 dict() 抛出含义
    不明的 TypeError/ValueError（例如 dict(None) 报 'NoneType' object is not
    iterable，dict('x') 报 dictionary update sequence 相关的内部实现细节）。"""
    with pytest.raises(TypeError):
        TaskEnvelope.from_legacy(bad_value)
