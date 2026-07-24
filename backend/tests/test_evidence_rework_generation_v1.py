from __future__ import annotations

import pytest
from pydantic import ValidationError

from src.contracts.evidence_rework_generation import EvidenceReworkGenerationV1
from src.db.models import FinalMemorial


def _valid_generation() -> dict[str, object]:
    return {
        "schema_version": "EvidenceReworkGenerationV1",
        "generation_id": "outbox_rework_contract_v1",
        "generation": 2,
        "status": "awaiting_evidence",
        "prior_final_memorial_content_hash": "a" * 64,
        "evidence_request": {
            "reason": "补充付款条件原文",
            "followup_question": None,
        },
        "affected_sections": ["contract_review"],
    }


def test_evidence_rework_generation_v1_accepts_exact_minimal_contract() -> None:
    generation = EvidenceReworkGenerationV1.model_validate(_valid_generation())

    assert generation.to_payload() == _valid_generation()


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("prior_final_memorial_content_hash", "A" * 64),
        ("prior_final_memorial_content_hash", "a" * 63),
        ("affected_sections", ["financial_review"]),
        ("affected_sections", ["contract_review", "financial_review"]),
    ],
)
def test_evidence_rework_generation_v1_rejects_identity_or_scope_drift(
    field: str,
    value: object,
) -> None:
    payload = {**_valid_generation(), field: value}

    with pytest.raises(ValidationError):
        EvidenceReworkGenerationV1.model_validate(payload)


def test_evidence_rework_generation_v1_rejects_unknown_fields() -> None:
    payload = {**_valid_generation(), "second_fact_source": True}

    with pytest.raises(ValidationError):
        EvidenceReworkGenerationV1.model_validate(payload)


def test_final_memorial_documents_append_only_version_identity() -> None:
    documentation = FinalMemorial.__doc__ or ""

    assert "task_id uniqueness prevents" not in documentation
    assert "one current version per task" in documentation
    assert "(task_id, version)" in documentation
