"""Canonical R0-W06 delivery artifact manifest contract."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

_SHA256 = r"^[0-9a-f]{64}$"
ArtifactKind = Literal["PDF", "DOCX", "JSON"]
ArtifactStatus = Literal["READY", "UNAVAILABLE", "UNDER_REVIEW"]
ManifestStatus = Literal["READY", "PARTIAL", "UNDER_REVIEW"]


class ArtifactManifestItemV1(BaseModel):
    model_config = ConfigDict(extra="forbid")

    artifact_id: str = Field(min_length=1)
    kind: ArtifactKind
    mime_type: str = Field(min_length=1)
    byte_size: int = Field(ge=0)
    content_hash: str
    lineage_hash: str
    status: ArtifactStatus

    @field_validator("content_hash", "lineage_hash")
    @classmethod
    def sha256_only(cls, value: str) -> str:
        import re

        if not re.fullmatch(_SHA256, value):
            raise ValueError("hash must be a lowercase SHA-256 digest")
        return value


class ArtifactManifestV1(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["ArtifactManifestV1"] = "ArtifactManifestV1"
    manifest_id: str = Field(min_length=1)
    task_id: str = Field(min_length=1)
    final_memorial_id: str = Field(min_length=1)
    final_memorial_version: int = Field(ge=1)
    delivery_formula_version: str = Field(min_length=1)
    artifacts: list[ArtifactManifestItemV1] = Field(min_length=1)
    overall_status: ManifestStatus

    @model_validator(mode="after")
    def validate_status_matrix(self) -> "ArtifactManifestV1":
        statuses = {item.status for item in self.artifacts}
        if self.overall_status == "READY" and statuses != {"READY"}:
            raise ValueError("READY manifest requires every artifact READY")
        if self.overall_status == "PARTIAL" and not (
            "READY" in statuses and ("UNAVAILABLE" in statuses or "UNDER_REVIEW" in statuses)
        ):
            raise ValueError("PARTIAL manifest requires READY plus an unavailable/review artifact")
        if self.overall_status == "UNDER_REVIEW" and statuses == {"READY"}:
            raise ValueError("UNDER_REVIEW manifest requires a non-ready artifact")
        return self
