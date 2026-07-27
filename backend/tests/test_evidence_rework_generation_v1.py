from __future__ import annotations

import pytest
from pydantic import ValidationError

from src.contracts.evidence_rework_generation import (
    EvidenceReworkGenerationPayloadV1,
    EvidenceReworkGenerationV1,
)
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


def _valid_payload() -> dict[str, object]:
    return {
        **_valid_generation(),
        "mission_revision": 1,
        "mission_content_digest": "b" * 64,
    }


def test_evidence_rework_generation_v1_accepts_exact_minimal_contract() -> None:
    generation = EvidenceReworkGenerationV1.model_validate(_valid_generation())

    assert generation.evidence_status == "NONE"
    assert generation.to_payload() == {
        **_valid_generation(),
        "evidence_status": "NONE",
    }


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


@pytest.mark.parametrize(
    "field",
    ["mission_revision", "mission_content_digest"],
)
def test_evidence_rework_payload_v1_requires_frozen_mission_identity(
    field: str,
) -> None:
    payload = _valid_payload()
    payload.pop(field)

    with pytest.raises(ValidationError):
        EvidenceReworkGenerationPayloadV1.model_validate(payload)


def test_evidence_rework_payload_projects_stable_public_contract() -> None:
    payload = EvidenceReworkGenerationPayloadV1.model_validate(_valid_payload())

    assert payload.to_public_payload() == {
        **_valid_generation(),
        "evidence_status": "NONE",
    }


@pytest.mark.parametrize(
    ("event_id", "event_generation", "durable_status", "error"),
    [
        ("wrong-generation-id", 2, "awaiting_evidence", "generation_id"),
        ("outbox_rework_contract_v1", 9, "awaiting_evidence", "generation"),
        ("outbox_rework_contract_v1", 2, "processing", "status"),
    ],
)
def test_parent_payload_quarantine_requires_exact_durable_envelope(
    event_id,
    event_generation,
    durable_status,
    error,
) -> None:
    from src.contracts.evidence_rework_generation import (
        EvidenceReworkGenerationV1,
        validate_durable_evidence_rework_envelope,
    )

    payload = _valid_payload()
    payload.pop("mission_revision")
    payload.pop("mission_content_digest")
    if error == "status":
        payload["status"] = "candidate_ready"
    generation = EvidenceReworkGenerationV1.model_validate(payload)

    with pytest.raises(ValueError, match=error):
        validate_durable_evidence_rework_envelope(
            generation,
            event_id=event_id,
            event_generation=event_generation,
            durable_status=durable_status,
        )


def test_parent_payload_quarantine_accepts_exact_durable_envelope() -> None:
    from src.contracts.evidence_rework_generation import (
        EvidenceReworkGenerationV1,
        validate_durable_evidence_rework_envelope,
    )

    payload = _valid_payload()
    payload.pop("mission_revision")
    payload.pop("mission_content_digest")
    generation = EvidenceReworkGenerationV1.model_validate(payload)

    validate_durable_evidence_rework_envelope(
        generation,
        event_id=generation.generation_id,
        event_generation=generation.generation,
        durable_status="awaiting_evidence",
    )


def test_evidence_rework_generation_rejects_evidence_status_drift() -> None:
    payload = {**_valid_generation(), "evidence_status": "GROUNDED"}

    with pytest.raises(ValidationError):
        EvidenceReworkGenerationV1.model_validate(payload)


def test_final_memorial_documents_append_only_version_identity() -> None:
    documentation = FinalMemorial.__doc__ or ""

    assert "task_id uniqueness prevents" not in documentation
    assert "one current version per task" in documentation
    assert "(task_id, version)" in documentation
