"""REQ-012：第六种裁决或"可签"文案出现必须失败——五枚举跨端一致。"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from src.contracts.contract_decision import ContractDecisionV1

_FIVE_VERDICTS = [
    "NEED_INFO",
    "REVISE_BEFORE_PROCEED",
    "PROCEED_TO_HUMAN_APPROVAL",
    "BLOCKED",
    "NEED_LEGAL_REVIEW",
]


def _decision(**overrides: object) -> ContractDecisionV1:
    base = dict(
        mission_contract_id="mission-1",
        final_memorial_id="memorial-1",
        content_hash="a" * 64,
        verdict="REVISE_BEFORE_PROCEED",
        verdict_narrative="付款条款需要修订后再推进",
        decided_at="2026-07-21T00:00:00+00:00",
    )
    base.update(overrides)
    return ContractDecisionV1(**base)


@pytest.mark.parametrize("verdict", _FIVE_VERDICTS)
def test_each_of_five_verdicts_round_trips(verdict: str) -> None:
    decision = _decision(verdict=verdict)
    assert decision.verdict == verdict
    assert ContractDecisionV1(**decision.model_dump()) == decision


def test_sixth_verdict_string_rejected() -> None:
    with pytest.raises(ValidationError):
        _decision(verdict="APPROVED_TO_SIGN")


@pytest.mark.parametrize("phrase", ["可以签", "可签", "已批准签署", "approved to sign"])
def test_sign_off_language_in_narrative_rejected(phrase: str) -> None:
    with pytest.raises(ValidationError):
        _decision(verdict_narrative=f"审查完成，{phrase}")
