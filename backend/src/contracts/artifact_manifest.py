"""Canonical R0-W06 delivery artifact manifest contract."""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

_SHA256 = r"^[0-9a-f]{64}$"
_REQUIRED_ARTIFACT_KINDS = {"PDF", "DOCX", "JSON"}

ArtifactKind = Literal["PDF", "DOCX", "JSON"]
ArtifactItemStatus = Literal["PENDING", "STORED", "UNAVAILABLE"]
ManifestStatus = Literal["READY", "PARTIAL", "UNDER_REVIEW"]


class ArtifactManifestItemV1(BaseModel):
    model_config = ConfigDict(extra="forbid")

    artifact_id: str = Field(min_length=1)
    kind: ArtifactKind
    mime_type: str = Field(min_length=1)
    byte_size: int = Field(ge=0)
    content_hash: str
    lineage_hash: str
    status: ArtifactItemStatus
    incomplete_reason: str | None = None
    expires_at: datetime | None = None

    @field_validator("content_hash", "lineage_hash")
    @classmethod
    def sha256_only(cls, value: str) -> str:
        if not re.fullmatch(_SHA256, value):
            raise ValueError("hash must be a lowercase SHA-256 digest")
        return value

    @model_validator(mode="after")
    def validate_unavailable_reason(self) -> "ArtifactManifestItemV1":
        if self.status == "UNAVAILABLE" and not self.incomplete_reason:
            raise ValueError("UNAVAILABLE artifact requires incomplete_reason")
        return self


class ArtifactManifestV1(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["ArtifactManifestV1"] = "ArtifactManifestV1"
    manifest_id: str = Field(min_length=1)
    tenant_id: int
    task_id: str = Field(min_length=1)
    final_memorial_id: str = Field(min_length=1)
    final_memorial_version: int = Field(ge=1)
    delivery_formula_version: str = Field(min_length=1)
    delivery_revision: int = Field(ge=1)
    idempotency_key_hash: str
    payload_hash: str
    artifacts: list[ArtifactManifestItemV1]
    overall_status: ManifestStatus
    resume_token_hash: str | None = None
    resume_token_expires_at: datetime | None = None

    @field_validator("idempotency_key_hash", "payload_hash", "resume_token_hash")
    @classmethod
    def sha256_only(cls, value: str | None) -> str | None:
        if value is not None and not re.fullmatch(_SHA256, value):
            raise ValueError("hash must be a lowercase SHA-256 digest")
        return value

    @model_validator(mode="after")
    def validate_sealed_manifest(self) -> "ArtifactManifestV1":
        kinds = [item.kind for item in self.artifacts]
        if len(kinds) != len(_REQUIRED_ARTIFACT_KINDS) or set(kinds) != _REQUIRED_ARTIFACT_KINDS:
            raise ValueError("manifest requires exactly one PDF, DOCX, and JSON artifact")

        statuses = {item.status for item in self.artifacts}
        if self.overall_status == "READY":
            if statuses != {"STORED"}:
                raise ValueError("READY manifest requires every artifact STORED")
            if self.resume_token_hash is not None or self.resume_token_expires_at is not None:
                raise ValueError("READY manifest cannot include resume metadata")
        elif self.overall_status == "PARTIAL" and not (
            "STORED" in statuses and "UNAVAILABLE" in statuses
        ):
            raise ValueError("PARTIAL manifest requires STORED and UNAVAILABLE artifacts")
        return self

    def artifact(self, kind: ArtifactKind) -> ArtifactManifestItemV1:
        for item in self.artifacts:
            if item.kind == kind:
                return item
        raise ValueError(f"artifact kind is not present: {kind}")


def canonical_manifest_hash(manifest: ArtifactManifestV1) -> str:
    canonical_json = json.dumps(
        manifest.model_dump(mode="json", exclude_none=True),
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()
