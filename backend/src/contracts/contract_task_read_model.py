from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from src.contracts.contract_review_pack import ContractReviewPackV1
from src.contracts.mission_contract import MissionContractV1

ContractTaskAction = Literal[
    "CONFIRM_MISSION",
    "SUBMIT_EVIDENCE",
    "REFRESH_REVIEW",
    "GENERATE_DELIVERY",
    "RESUME_DELIVERY",
    "DOWNLOAD_ARTIFACT",
    "DECIDE",
    "REOPEN_ARCHIVE",
]
ContractTaskBlockerCode = Literal[
    "MISSION_MISSING",
    "MISSION_CONFLICT",
    "MISSION_NOT_CONFIRMED",
    "EVIDENCE_INCOMPLETE",
    "REVIEW_PACK_MISSING",
    "FINAL_MEMORIAL_MISSING",
    "DELIVERY_MISSING",
    "PARTIAL_RECOVERY_REQUIRES_HARDENING",
    "NON_ADJUDICABLE_SOURCE",
    "LINEAGE_CONFLICT",
    "DELIVERY_INTEGRITY_FAILED",
    "ARCHIVE_RECEIPT_MISSING",
    "ARCHIVE_LINEAGE_CONFLICT",
    "REVIEW_REVISION_REQUIRED",
    "REVIEW_BLOCKED",
    "LEGAL_REVIEW_REQUIRED",
    "STATE_INCONSISTENT",
]


class _ContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ContractTaskIdentityV1(_ContractModel):
    task_id: str = Field(min_length=1)
    tenant_id: int = Field(gt=0)
    status: str = Field(min_length=1)
    source_label: str = Field(min_length=1)
    raw_question: str = Field(min_length=1)
    refined_edict: str | None = None


class MissionSnapshotViewV1(_ContractModel):
    state: Literal["DRAFT", "CONFIRMED"]
    mission: MissionContractV1


class FinalMemorialIdentityV1(_ContractModel):
    final_memorial_id: str = Field(min_length=1)
    final_memorial_version: int = Field(ge=1)
    final_memorial_content_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    court_review_id: str = Field(min_length=1)
    status: str = Field(min_length=1)
    source_label: str = Field(min_length=1)


class PublicArtifactItemV1(_ContractModel):
    artifact_id: str = Field(min_length=1)
    kind: Literal["PDF", "DOCX", "JSON"]
    mime_type: str = Field(min_length=1)
    byte_size: int = Field(ge=0)
    content_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    lineage_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    status: Literal["PENDING", "STORED", "UNAVAILABLE"]
    incomplete_reason: str | None = None
    expires_at: datetime | None = None
    download_url: str | None = None

    @field_validator("expires_at")
    @classmethod
    def require_aware_expiry(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("expires_at must be timezone-aware")
        return value.astimezone(timezone.utc)

    @model_validator(mode="after")
    def require_honest_download(self) -> "PublicArtifactItemV1":
        if self.status != "STORED" and self.download_url is not None:
            raise ValueError("only STORED artifacts may expose a download URL")
        if self.status == "UNAVAILABLE" and not self.incomplete_reason:
            raise ValueError("UNAVAILABLE artifact requires incomplete_reason")
        return self


class PublicArtifactDeliveryV1(_ContractModel):
    manifest_id: str = Field(min_length=1)
    task_id: str = Field(min_length=1)
    final_memorial_id: str = Field(min_length=1)
    final_memorial_version: int = Field(ge=1)
    delivery_formula_version: str = Field(min_length=1)
    delivery_revision: int = Field(ge=1)
    payload_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    artifacts: list[PublicArtifactItemV1] = Field(min_length=1)
    overall_status: Literal["READY", "PARTIAL", "UNDER_REVIEW"]
    resume_token_expires_at: datetime | None = None

    @field_validator("resume_token_expires_at")
    @classmethod
    def require_aware_resume_expiry(
        cls,
        value: datetime | None,
    ) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("resume_token_expires_at must be timezone-aware")
        return value.astimezone(timezone.utc)


class ArchiveReceiptV1(_ContractModel):
    archive_id: str = Field(min_length=1)
    task_id: str = Field(min_length=1)
    final_memorial_id: str = Field(min_length=1)
    final_memorial_version: int = Field(ge=1)
    final_memorial_content_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    archived_at: datetime
    source_label: str = Field(min_length=1)

    @field_validator("archived_at")
    @classmethod
    def require_aware_archived_at(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("archived_at must be timezone-aware")
        return value.astimezone(timezone.utc)


class ContractTaskBlockerV1(_ContractModel):
    code: ContractTaskBlockerCode
    detail: str | None = None


class ContractTaskReadModelV1(_ContractModel):
    schema_version: Literal["ContractTaskReadModelV1"] = "ContractTaskReadModelV1"
    read_revision: str = Field(pattern=r"^[0-9a-f]{64}$")
    generated_at: datetime
    source_class: Literal["ADJUDICABLE", "FALLBACK", "UNKNOWN"]
    task: ContractTaskIdentityV1
    mission: MissionSnapshotViewV1 | None = None
    review_pack: ContractReviewPackV1 | None = None
    final_memorial: FinalMemorialIdentityV1 | None = None
    delivery: PublicArtifactDeliveryV1 | None = None
    archive_receipt: ArchiveReceiptV1 | None = None
    allowed_actions: list[ContractTaskAction]
    blockers: list[ContractTaskBlockerV1]

    @field_validator("generated_at")
    @classmethod
    def require_aware_generated_at(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("generated_at must be timezone-aware")
        return value.astimezone(timezone.utc)
