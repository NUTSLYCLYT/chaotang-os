"""REQ-003：支持/拒答 taxonomy——缺法域/语言/类型/角色仍输出放行必须失败。"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from src.contracts.contract_support import evaluate_support
from src.contracts.mission_contract import ContractIntakeV1

_GOLDEN = dict(
    jurisdiction="CN_MAINLAND",
    language="zh-CN",
    contract_type="procurement",
    our_role="buyer",
)


def _intake(**overrides: object) -> ContractIntakeV1:
    return ContractIntakeV1(**{**_GOLDEN, **overrides})


def _evaluate(intake: ContractIntakeV1, *, capability_active: bool = True):
    return evaluate_support(
        intake,
        mission_contract_id="mission-1",
        revision=1,
        evaluated_at="2026-07-21T00:00:00+00:00",
        capability_active=capability_active,
    )


def test_golden_slice_is_supported() -> None:
    decision = _evaluate(_intake())
    assert decision.support_status == "SUPPORTED"
    assert decision.decline_reasons == []


@pytest.mark.parametrize(
    "field,expected_reason",
    [
        ("jurisdiction", "MISSING_JURISDICTION"),
        ("language", "MISSING_LANGUAGE"),
        ("contract_type", "MISSING_CONTRACT_TYPE"),
        ("our_role", "MISSING_ROLE"),
    ],
)
def test_missing_dimension_declines_not_silently_passes(field: str, expected_reason: str) -> None:
    decision = _evaluate(_intake(**{field: None}))
    assert decision.support_status == "DECLINED"
    assert expected_reason in decision.decline_reasons


@pytest.mark.parametrize(
    "field,expected_reason",
    [
        ("jurisdiction", "UNSUPPORTED_JURISDICTION"),
        ("language", "UNSUPPORTED_LANGUAGE"),
        ("contract_type", "UNSUPPORTED_CONTRACT_TYPE"),
    ],
)
def test_sentinel_value_declines_gracefully(field: str, expected_reason: str) -> None:
    decision = _evaluate(_intake(**{field: "UNSUPPORTED_OR_UNKNOWN"}))
    assert decision.support_status == "DECLINED"
    assert expected_reason in decision.decline_reasons


def test_role_sentinel_declines_via_unknown_scope() -> None:
    decision = _evaluate(_intake(our_role="UNSUPPORTED_OR_UNKNOWN"))
    assert decision.support_status == "DECLINED"
    assert "UNKNOWN_SCOPE" in decision.decline_reasons


def test_raw_unrecognized_string_rejected_at_construction() -> None:
    with pytest.raises(ValidationError):
        _intake(jurisdiction="US")


def test_capability_not_activated_declines_even_when_scope_supported() -> None:
    decision = _evaluate(_intake(), capability_active=False)
    assert decision.support_status == "DECLINED"
    assert decision.decline_reasons == ["CAPABILITY_NOT_ACTIVATED"]


def test_support_status_cannot_carry_reasons() -> None:
    from src.contracts.contract_support import ContractSupportDecisionV1

    with pytest.raises(ValidationError):
        ContractSupportDecisionV1(
            mission_contract_id="mission-1",
            revision=1,
            support_status="SUPPORTED",
            decline_reasons=["MISSING_ROLE"],
            evaluated_at="2026-07-21T00:00:00+00:00",
        )


def test_declined_status_requires_at_least_one_reason() -> None:
    from src.contracts.contract_support import ContractSupportDecisionV1

    with pytest.raises(ValidationError):
        ContractSupportDecisionV1(
            mission_contract_id="mission-1",
            revision=1,
            support_status="DECLINED",
            decline_reasons=[],
            evaluated_at="2026-07-21T00:00:00+00:00",
        )
