from pydantic import ValidationError
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
