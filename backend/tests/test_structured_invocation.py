"""Bounded retry contract for strict structured model invocations."""

from __future__ import annotations

from collections.abc import Sequence

import pytest

from app.agents.structured_invocation import (
    StructuredInvocationError,
    invoke_strict_structured,
)
from app.agents.structured_output import parse_strict_json_object

MESSAGES = [
    {"role": "system", "content": "Return one strict JSON object."},
    {"role": "user", "content": "Give an opinion."},
]


class SequenceModel:
    def __init__(self, responses: Sequence[str]) -> None:
        self._responses = iter(responses)
        self.calls: list[list[dict[str, str]]] = []

    def __call__(self, messages: list[dict[str, str]]) -> str:
        self.calls.append(messages)
        return next(self._responses)


class RaisingModel:
    def __init__(self, exc: Exception) -> None:
        self._exc = exc
        self.calls: list[list[dict[str, str]]] = []

    def __call__(self, messages: list[dict[str, str]]) -> str:
        self.calls.append(messages)
        raise self._exc


def _validate_opinion(raw: object) -> str:
    if not isinstance(raw, str):
        raise ValueError("response is not text")
    parsed = parse_strict_json_object(raw)
    if set(parsed) != {"opinion"}:
        raise ValueError("invalid opinion schema")
    opinion = parsed["opinion"]
    if not isinstance(opinion, str) or not opinion.strip():
        raise ValueError("opinion is empty")
    return opinion.strip()


def test_retries_two_schema_failures_then_returns_validated_value() -> None:
    model = SequenceModel(["not-json", '{"wrong":true}', '{"opinion":"ok"}'])

    result = invoke_strict_structured(
        model,
        MESSAGES,
        _validate_opinion,
        stage="bureau",
    )

    assert result == "ok"
    assert len(model.calls) == 3
    assert model.calls[0] == MESSAGES
    assert model.calls[1][:-1] == MESSAGES
    assert model.calls[1][-1]["role"] == "system"
    assert "not-json" not in model.calls[1][-1]["content"]


def test_provider_failure_is_not_retried_or_leaked() -> None:
    model = RaisingModel(RuntimeError("secret provider detail"))

    with pytest.raises(StructuredInvocationError) as caught:
        invoke_strict_structured(
            model,
            MESSAGES,
            _validate_opinion,
            stage="bureau",
        )

    assert caught.value.failure_code == "provider_unavailable"
    assert caught.value.failure_stage == "bureau"
    assert len(model.calls) == 1
    assert "secret" not in str(caught.value)


def test_exhausted_schema_retries_are_sanitized() -> None:
    model = SequenceModel(["first secret", "second secret", "third secret"])

    with pytest.raises(StructuredInvocationError) as caught:
        invoke_strict_structured(
            model,
            MESSAGES,
            _validate_opinion,
            stage="ministry_route",
        )

    assert caught.value.failure_code == "schema_invalid"
    assert caught.value.failure_stage == "ministry_route"
    assert len(model.calls) == 3
    assert "secret" not in str(caught.value)


def test_uses_caller_provided_sanitized_correction_instruction() -> None:
    model = SequenceModel(["bad", '{"opinion":"ok"}'])

    result = invoke_strict_structured(
        model,
        MESSAGES,
        _validate_opinion,
        stage="ministry_route",
        correction_instruction="Include the approved required bureau: quality.",
    )

    assert result == "ok"
    assert model.calls[1][-1] == {
        "role": "system",
        "content": "Include the approved required bureau: quality.",
    }


@pytest.mark.parametrize("max_attempts", [0, -1, 4])
def test_rejects_attempt_counts_outside_the_governed_range(max_attempts: int) -> None:
    model = SequenceModel(['{"opinion":"ok"}'])

    with pytest.raises(ValueError, match="max_attempts"):
        invoke_strict_structured(
            model,
            MESSAGES,
            _validate_opinion,
            stage="bureau",
            max_attempts=max_attempts,
        )

    assert model.calls == []
