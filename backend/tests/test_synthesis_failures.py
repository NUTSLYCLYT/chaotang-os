import logging

import pytest

from app.agents.evidence_protocol import EvidenceProtocolError
from app.agents.ministries.agent import MinistryAgentInvocationError
from app.agents.structured_output import StructuredOutputError
from app.agents.synthesis_failures import (
    classify_synthesis_failure,
    is_locally_degradable,
)
from app.langgraph_runtime.deepseek_client import DeepSeekModelInvocationError

_FIXED_FAILURE_CODES = {
    "schema_invalid",
    "content_unsupported",
    "provider_unavailable",
    "state_invalid",
}
_CONTENT_CODES = (
    "uncited_fact_dependency",
    "unsupported_factual_dependency",
    "response_invalid",
    "adoption_invalid",
    "evidence_binding_invalid",
)


@pytest.mark.parametrize(
    "exc",
    [
        ValueError("SECRET MODEL BODY"),
        StructuredOutputError("SECRET MODEL BODY"),
    ],
)
def test_schema_errors_are_locally_degradable(exc: BaseException) -> None:
    assert classify_synthesis_failure(exc) == "schema_invalid"
    assert is_locally_degradable(exc) is True


@pytest.mark.parametrize("content_code", _CONTENT_CODES)
def test_content_errors_are_locally_degradable(content_code: str) -> None:
    exc = EvidenceProtocolError(content_code)

    assert classify_synthesis_failure(exc) == "content_unsupported"
    assert is_locally_degradable(exc) is True


def test_provider_failure_in_cause_chain_is_not_degradable() -> None:
    provider = EvidenceProtocolError("model_unavailable")
    wrapped = MinistryAgentInvocationError("sanitized")
    wrapped.__cause__ = provider

    assert classify_synthesis_failure(wrapped) == "provider_unavailable"
    assert is_locally_degradable(wrapped) is False


def test_real_deepseek_invocation_failure_in_wrapper_chain_is_provider_unavailable():
    sdk_error = RuntimeError("SECRET SDK BODY")
    provider = DeepSeekModelInvocationError("sanitized provider failure")
    provider.__cause__ = sdk_error
    wrapped = MinistryAgentInvocationError("sanitized ministry failure")
    wrapped.__cause__ = provider

    assert classify_synthesis_failure(wrapped) == "provider_unavailable"
    assert is_locally_degradable(wrapped) is False


def test_provider_failure_takes_priority_over_schema_and_content_errors() -> None:
    schema = ValueError("SECRET MODEL BODY")
    content = EvidenceProtocolError("response_invalid")
    provider = EvidenceProtocolError("model_unavailable")
    schema.__cause__ = content
    content.__cause__ = provider

    assert classify_synthesis_failure(schema) == "provider_unavailable"
    assert is_locally_degradable(schema) is False


def test_unknown_exception_is_state_invalid() -> None:
    exc = RuntimeError("SECRET INTERNAL STATE")

    assert classify_synthesis_failure(exc) == "state_invalid"
    assert is_locally_degradable(exc) is False


@pytest.mark.parametrize("message", ["model_unavailable", "response_invalid"])
def test_untyped_exception_body_cannot_impersonate_a_stable_code(message: str) -> None:
    exc = RuntimeError(message)

    assert classify_synthesis_failure(exc) == "state_invalid"
    assert is_locally_degradable(exc) is False


def test_context_chain_is_classified() -> None:
    provider = EvidenceProtocolError("model_unavailable")
    wrapped = MinistryAgentInvocationError("sanitized")
    wrapped.__context__ = provider

    assert classify_synthesis_failure(wrapped) == "provider_unavailable"
    assert is_locally_degradable(wrapped) is False


@pytest.mark.parametrize(
    "chain_attribute",
    ["__cause__", "__context__"],
)
@pytest.mark.parametrize(
    "cycle_size",
    [1, 2],
)
def test_exception_chain_cycles_terminate(
    chain_attribute: str,
    cycle_size: int,
) -> None:
    exc = RuntimeError("cycle")
    if cycle_size == 1:
        setattr(exc, chain_attribute, exc)
    else:
        other = RuntimeError("other-cycle-node")
        setattr(exc, chain_attribute, other)
        setattr(other, chain_attribute, exc)

    assert classify_synthesis_failure(exc) == "state_invalid"
    assert is_locally_degradable(exc) is False


@pytest.mark.parametrize(
    ("exc", "expected"),
    [
        (ValueError("SECRET SCHEMA BODY"), "schema_invalid"),
        (EvidenceProtocolError("response_invalid"), "content_unsupported"),
        (EvidenceProtocolError("model_unavailable"), "provider_unavailable"),
        (RuntimeError("SECRET INTERNAL STATE"), "state_invalid"),
    ],
)
def test_public_results_are_fixed_codes_without_logging(
    exc: BaseException,
    expected: str,
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.DEBUG)

    result = classify_synthesis_failure(exc)

    assert result == expected
    assert result in _FIXED_FAILURE_CODES
    assert "SECRET" not in result
    assert caplog.records == []
