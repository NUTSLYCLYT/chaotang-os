from __future__ import annotations

import pytest
from pydantic import ValidationError

from src.contracts.contract_lineage_identity import (
    ContractLineageIdentityV1,
    require_r0_review_pack_binding,
)
from src.contracts.contract_review_pack import ContractReviewPackV1


def _pack(**overrides: object) -> ContractReviewPackV1:
    payload: dict[str, object] = {
        "review_pack_id": "pack-1",
        "tenant_id": "7",
        "task_id": "task-1",
        "mission_contract_id": "task-1",
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
        "engine_tiers": ["deterministic"],
        "quality_gate_status": "PENDING",
    }
    payload.update(overrides)
    return ContractReviewPackV1.model_validate(payload)


def test_identity_requires_nonblank_exact_mission_task_binding() -> None:
    with pytest.raises(ValidationError):
        ContractLineageIdentityV1(
            tenant_id=7,
            task_id="task-1",
            mission_contract_id="mission-other",
        )

    with pytest.raises(ValidationError):
        ContractLineageIdentityV1(
            tenant_id=7,
            task_id="",
            mission_contract_id="",
        )


def test_review_pack_must_match_tenant_task_and_mission_identity() -> None:
    identity = ContractLineageIdentityV1(
        tenant_id=7,
        task_id="task-1",
        mission_contract_id="task-1",
    )

    require_r0_review_pack_binding(identity, _pack())

    for drifted_pack in (
        _pack(tenant_id="8"),
        _pack(task_id="task-2"),
        _pack(mission_contract_id="task-2"),
    ):
        with pytest.raises(ValueError, match="review pack lineage"):
            require_r0_review_pack_binding(identity, drifted_pack)


def test_current_w05_compatibility_identity_is_explicit() -> None:
    identity = ContractLineageIdentityV1.for_task(
        tenant_id=7,
        task_id="task-1",
    )

    assert identity.task_id == "task-1"
    assert identity.mission_contract_id == "task-1"
