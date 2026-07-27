from __future__ import annotations

from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from src.contracts.contract_task_read_model import (
    ArchiveReceiptV1,
    ContractTaskReadModelV1,
    PublicArtifactDeliveryV1,
    PublicArtifactItemV1,
)


def _item(**overrides: object) -> PublicArtifactItemV1:
    payload: dict[str, object] = {
        "artifact_id": "artifact-pdf",
        "kind": "PDF",
        "mime_type": "application/pdf",
        "byte_size": 120,
        "content_hash": "a" * 64,
        "lineage_hash": "b" * 64,
        "status": "STORED",
        "download_url": "/api/artifacts/artifact-pdf/download",
    }
    payload.update(overrides)
    return PublicArtifactItemV1.model_validate(payload)


def _delivery(**overrides: object) -> PublicArtifactDeliveryV1:
    payload: dict[str, object] = {
        "manifest_id": "manifest-1",
        "task_id": "task-1",
        "final_memorial_id": "final-1",
        "final_memorial_version": 1,
        "delivery_formula_version": "w06-v1",
        "delivery_revision": 1,
        "payload_hash": "c" * 64,
        "artifacts": [_item()],
        "overall_status": "READY",
    }
    payload.update(overrides)
    return PublicArtifactDeliveryV1.model_validate(payload)


def test_public_delivery_rejects_secret_or_storage_fields() -> None:
    for secret in (
        {"resume_token": "secret"},
        {"resume_token_hash": "d" * 64},
        {"idempotency_key": "key"},
        {"idempotency_key_hash": "e" * 64},
        {"storage_path": "/tmp/private"},
    ):
        with pytest.raises(ValidationError):
            PublicArtifactDeliveryV1.model_validate(
                {
                    **_delivery().model_dump(mode="json"),
                    **secret,
                }
            )

    with pytest.raises(ValidationError):
        PublicArtifactItemV1.model_validate(
            {
                **_item().model_dump(mode="json"),
                "storage_path": "/tmp/private",
            }
        )


def test_archive_receipt_requires_exact_final_identity() -> None:
    receipt = ArchiveReceiptV1(
        archive_id="archive-1",
        task_id="task-1",
        final_memorial_id="final-1",
        final_memorial_version=1,
        final_memorial_content_hash="f" * 64,
        archived_at=datetime(2026, 7, 27, tzinfo=timezone.utc),
        source_label="LIVE",
    )

    assert receipt.final_memorial_content_hash == "f" * 64
    with pytest.raises(ValidationError):
        ArchiveReceiptV1(
            **{
                **receipt.model_dump(mode="json"),
                "final_memorial_id": None,
            }
        )


def test_read_model_has_closed_action_and_blocker_vocabularies() -> None:
    payload = {
        "read_revision": "a" * 64,
        "generated_at": "2026-07-27T00:00:00Z",
        "source_class": "ADJUDICABLE",
        "task": {
            "task_id": "task-1",
            "tenant_id": 7,
            "status": "reviewing",
            "source_label": "LIVE",
            "raw_question": "审查采购合同",
        },
        "allowed_actions": ["DOWNLOAD_ARTIFACT"],
        "blockers": [
            {
                "code": "PARTIAL_RECOVERY_REQUIRES_HARDENING",
                "detail": "刷新后不提供 resume",
            }
        ],
    }

    model = ContractTaskReadModelV1.model_validate(payload)
    assert model.allowed_actions == ["DOWNLOAD_ARTIFACT"]

    with pytest.raises(ValidationError):
        ContractTaskReadModelV1.model_validate(
            {**payload, "allowed_actions": ["CLIENT_INVENTED_ACTION"]}
        )
    with pytest.raises(ValidationError):
        ContractTaskReadModelV1.model_validate(
            {**payload, "blockers": [{"code": "UNKNOWN_BLOCKER"}]}
        )


def test_read_model_rejects_unexpected_top_level_fields() -> None:
    with pytest.raises(ValidationError):
        ContractTaskReadModelV1.model_validate(
            {
                "read_revision": "a" * 64,
                "generated_at": "2026-07-27T00:00:00Z",
                "task": {
                    "task_id": "task-1",
                    "tenant_id": 7,
                    "status": "reviewing",
                    "source_label": "LIVE",
                    "raw_question": "审查采购合同",
                },
                "allowed_actions": [],
                "blockers": [],
                "client_state": "done",
            }
        )
