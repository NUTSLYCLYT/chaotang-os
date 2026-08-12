"""Bounded, fail-closed invocation for strict structured model responses."""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from typing import TypeVar

from pydantic import ValidationError

from app.agents.structured_output import StructuredOutputError
from app.langgraph_runtime.deepseek_client import DeepSeekChatModel

T = TypeVar("T")

_VALIDATION_ERRORS = (
    KeyError,
    TypeError,
    ValueError,
    ValidationError,
    StructuredOutputError,
)


class StructuredInvocationError(RuntimeError):
    """Sanitized failure from one governed structured model stage."""

    def __init__(self, *, failure_stage: str, failure_code: str) -> None:
        super().__init__("structured_invocation_failed")
        self.failure_stage = failure_stage
        self.failure_code = failure_code


def invoke_strict_structured(
    chat_model: DeepSeekChatModel,
    messages: Sequence[Mapping[str, str]],
    validator: Callable[[object], T],
    *,
    stage: str,
    max_attempts: int = 3,
    correction_instruction: str | None = None,
) -> T:
    """Return a fully validated model value within a bounded attempt budget."""

    if not 1 <= max_attempts <= 3:
        raise ValueError("max_attempts must be between 1 and 3")

    base_messages = [dict(message) for message in messages]
    last_validation_error: Exception | None = None
    for attempt in range(max_attempts):
        attempt_messages = [dict(message) for message in base_messages]
        if attempt:
            attempt_messages.append(
                {
                    "role": "system",
                    "content": correction_instruction
                    or (
                        "The previous response failed the required schema. "
                        "Return exactly one corrected strict JSON object that "
                        "satisfies every field and constraint in the original "
                        "system instruction. Do not include Markdown or prose."
                    ),
                }
            )
        try:
            stage_invoker = getattr(chat_model, "invoke_structured", None)
            raw_response = (
                stage_invoker(attempt_messages, stage=stage)
                if callable(stage_invoker)
                else chat_model(attempt_messages)
            )
        except Exception as exc:  # noqa: BLE001 - provider boundary
            raise StructuredInvocationError(
                failure_stage=stage,
                failure_code="provider_unavailable",
            ) from exc
        try:
            return validator(raw_response)
        except _VALIDATION_ERRORS as exc:
            last_validation_error = exc

    raise StructuredInvocationError(
        failure_stage=stage,
        failure_code="schema_invalid",
    ) from last_validation_error
