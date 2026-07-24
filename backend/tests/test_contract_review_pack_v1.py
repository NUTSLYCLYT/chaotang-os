"""R0-W05 ContractReviewPackV1 的 canonical 候选门。"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from src.contracts.contract_review_pack import ContractReviewPackV1
from src.contracts.contract_risk_item import ContractRiskItemV1


def _critical_risk() -> ContractRiskItemV1:
    return ContractRiskItemV1(
        risk_item_id="risk-critical-1",
        evidence_packet_id="evidence-1",
        file_version_id="file-v2",
        page_number=4,
        raw_excerpt="供应商对全部间接损失承担无限责任。",
        risk_level="critical",
        explanation="责任范围无上限。",
        missing_evidence=[],
        recommended_revision="增加责任上限并排除间接损失。",
        source_label="TASK_EVIDENCE",
        engine_tier="validated_model",
    )


def _pack(**overrides: object) -> ContractReviewPackV1:
    payload = {
        "review_pack_id": "pack-1",
        "tenant_id": "tenant-1",
        "task_id": "task-1",
        "mission_contract_id": "mission-1",
        "court_review_id": "review-1",
        "evidence_packet_ids": ["evidence-1"],
        "jurisdiction": "CN_MAINLAND",
        "language": "zh-CN",
        "contract_type": "procurement",
        "our_role": "buyer",
        "legal_question": "contract_risk_screening",
        "risk_items": [],
        "verdict": "REVISE_BEFORE_PROCEED",
        "decision_summary": "付款和责任条款需修改后再推进。",
        "affected_sections": ["contract_review"],
        "source_labels": ["TASK_EVIDENCE"],
        "engine_tiers": ["validated_model"],
        "quality_gate_status": "PENDING",
    }
    payload.update(overrides)
    return ContractReviewPackV1(**payload)


def test_unresolved_critical_risk_cannot_proceed_to_human_approval() -> None:
    with pytest.raises(ValidationError):
        _pack(
            risk_items=[_critical_risk()],
            verdict="PROCEED_TO_HUMAN_APPROVAL",
        )


def test_unsupported_jurisdiction_can_only_need_legal_review() -> None:
    with pytest.raises(ValidationError):
        _pack(
            jurisdiction="UNSUPPORTED_OR_UNKNOWN",
            verdict="REVISE_BEFORE_PROCEED",
        )


@pytest.mark.parametrize(
    "field",
    ["language", "contract_type", "our_role", "legal_question"],
)
def test_other_unsupported_scope_dimensions_can_only_need_legal_review(field: str) -> None:
    with pytest.raises(ValidationError):
        _pack(
            **{
                field: "UNSUPPORTED_OR_UNKNOWN",
                "verdict": "REVISE_BEFORE_PROCEED",
            }
        )


def test_each_risk_item_must_reference_a_pack_evidence_packet() -> None:
    with pytest.raises(ValidationError):
        _pack(
            evidence_packet_ids=["evidence-other"],
            risk_items=[_critical_risk()],
            verdict="BLOCKED",
        )


def test_unsupported_scope_accepts_need_legal_review_candidate() -> None:
    pack = _pack(
        jurisdiction="UNSUPPORTED_OR_UNKNOWN",
        verdict="NEED_LEGAL_REVIEW",
    )

    assert pack.candidate_status == "CANDIDATE"


def test_supported_scope_without_critical_risk_can_proceed_to_human_approval() -> None:
    pack = _pack(verdict="PROCEED_TO_HUMAN_APPROVAL")

    assert pack.verdict == "PROCEED_TO_HUMAN_APPROVAL"
