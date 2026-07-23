"""R0-W05 EvidencePacketV1 的可信证据晋升门。"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from src.contracts.evidence_packet import EvidencePacketV1


def _packet(**overrides: object) -> EvidencePacketV1:
    payload = {
        "evidence_packet_id": "evidence-1",
        "tenant_id": 7,
        "task_id": "task-1",
        "input_version_id": "input-v2",
        "input_digest": "a" * 64,
        "prior_final_memorial_content_hash": "b" * 64,
        "generation": 2,
        "evidence_status": "UNVERIFIED",
        "source_kind": "USER_UPLOAD",
        "source_ref": "object://contracts/input-v2",
        "content_hash": "c" * 64,
    }
    payload.update(overrides)
    return EvidencePacketV1(**payload)


@pytest.mark.parametrize("source_kind", ["MANUAL_TEXT", "URL", "MODEL_ASSERTION"])
def test_nonempty_unverified_source_cannot_self_promote_to_grounded(
    source_kind: str,
) -> None:
    with pytest.raises(ValidationError):
        _packet(
            source_kind=source_kind,
            source_ref="https://example.invalid/nonempty",
            evidence_status="GROUNDED",
        )


def test_uploaded_object_without_verification_receipt_cannot_be_grounded() -> None:
    with pytest.raises(ValidationError):
        _packet(source_kind="USER_UPLOAD", evidence_status="GROUNDED")


def test_verified_tool_receipt_can_produce_grounded_packet() -> None:
    packet = _packet(
        source_kind="VERIFIED_TOOL",
        evidence_status="GROUNDED",
        verification_receipt_id="receipt-1",
    )
    assert packet.evidence_status == "GROUNDED"
