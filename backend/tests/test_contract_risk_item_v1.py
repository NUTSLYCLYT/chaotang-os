"""R0-W05 ContractRiskItemV1 的高风险原文锚点门。"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from src.contracts.contract_risk_item import ContractRiskItemV1


def _risk(**overrides: object) -> ContractRiskItemV1:
    payload = {
        "risk_item_id": "risk-1",
        "evidence_packet_id": "evidence-1",
        "file_version_id": "file-v2",
        "page_number": 4,
        "clause_ref": None,
        "raw_excerpt": "付款应在验收完成后七日内支付。",
        "risk_level": "high",
        "explanation": "付款触发条件与验收结果绑定。",
        "missing_evidence": [],
        "recommended_revision": "明确验收标准、异议期限与付款起算日。",
        "source_label": "TASK_EVIDENCE",
        "engine_tier": "validated_model",
    }
    payload.update(overrides)
    return ContractRiskItemV1(**payload)


@pytest.mark.parametrize(
    "overrides",
    [
        {"file_version_id": None},
        {"page_number": None, "clause_ref": None},
        {"raw_excerpt": None},
    ],
)
def test_high_risk_requires_version_locator_and_raw_excerpt(
    overrides: dict[str, object],
) -> None:
    with pytest.raises(ValidationError):
        _risk(**overrides)


def test_lower_risk_without_original_anchor_must_name_missing_evidence() -> None:
    with pytest.raises(ValidationError):
        _risk(
            risk_level="medium",
            file_version_id=None,
            page_number=None,
            clause_ref=None,
            raw_excerpt=None,
            missing_evidence=[],
        )


def test_lower_risk_without_original_anchor_accepts_named_missing_evidence() -> None:
    risk = _risk(
        risk_level="medium",
        file_version_id=None,
        page_number=None,
        clause_ref=None,
        raw_excerpt=None,
        missing_evidence=["缺合同原文定位"],
    )

    assert risk.missing_evidence == ["缺合同原文定位"]
