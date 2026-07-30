from __future__ import annotations

from collections.abc import Iterator
from typing import Literal

from app.agents.evidence_protocol import EvidenceProtocolError
from app.agents.structured_output import StructuredOutputError
from app.langgraph_runtime.deepseek_client import DeepSeekModelInvocationError

SynthesisStage = Literal[
    "route", "report", "bureau", "ministry", "council", "finalize", "archive"
]
SynthesisFailureCode = Literal[
    "schema_invalid",
    "content_unsupported",
    "provider_unavailable",
    "state_invalid",
]

_PROVIDER_CODES = frozenset({"model_unavailable"})
_CONTENT_CODES = frozenset(
    {
        "uncited_fact_dependency",
        "unsupported_factual_dependency",
        "response_invalid",
        "adoption_invalid",
        "evidence_binding_invalid",
    }
)


def _chain(exc: BaseException) -> Iterator[BaseException]:
    current: BaseException | None = exc
    seen: set[int] = set()
    while current is not None and id(current) not in seen:
        seen.add(id(current))
        yield current
        current = current.__cause__ or current.__context__


def classify_synthesis_failure(exc: BaseException) -> SynthesisFailureCode:
    chain = tuple(_chain(exc))
    if any(isinstance(item, DeepSeekModelInvocationError) for item in chain):
        return "provider_unavailable"
    codes = {
        str(item) for item in chain if isinstance(item, EvidenceProtocolError)
    }
    if codes & _PROVIDER_CODES:
        return "provider_unavailable"
    if codes & _CONTENT_CODES:
        return "content_unsupported"
    if any(isinstance(item, (ValueError, StructuredOutputError)) for item in chain):
        return "schema_invalid"
    return "state_invalid"


def is_locally_degradable(exc: BaseException) -> bool:
    return classify_synthesis_failure(exc) in {
        "schema_invalid",
        "content_unsupported",
    }
