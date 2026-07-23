"""EvidencePacketV1 — R0-W05 版本化证据包公共契约。"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

EvidenceStatus = Literal[
    "NONE",
    "COLLECTING",
    "PARTIAL",
    "GROUNDED",
    "CONFLICTED",
    "STALE",
    "UNVERIFIED",
]
EvidenceSourceKind = Literal[
    "USER_UPLOAD",
    "OFFICIAL_SOURCE",
    "VERIFIED_TOOL",
    "MANUAL_TEXT",
    "URL",
    "MODEL_ASSERTION",
]
_SELF_ASSERTED_SOURCE_KINDS = {"MANUAL_TEXT", "URL", "MODEL_ASSERTION"}


class EvidencePacketV1(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["EvidencePacketV1"] = "EvidencePacketV1"
    evidence_packet_id: str = Field(min_length=1)
    tenant_id: int = Field(ge=1)
    task_id: str = Field(min_length=1)
    input_version_id: str = Field(min_length=1)
    input_digest: str = Field(pattern=r"^[0-9a-f]{64}$")
    prior_final_memorial_content_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    generation: int = Field(ge=1)
    evidence_status: EvidenceStatus
    source_kind: EvidenceSourceKind
    source_ref: str = Field(min_length=1)
    content_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    verification_receipt_id: str | None = Field(default=None, min_length=1)

    @model_validator(mode="after")
    def _self_asserted_source_cannot_be_grounded(self) -> "EvidencePacketV1":
        if self.evidence_status != "GROUNDED":
            return self
        if not self.verification_receipt_id:
            raise ValueError("GROUNDED 证据必须绑定 verification receipt")
        if self.source_kind in _SELF_ASSERTED_SOURCE_KINDS:
            raise ValueError(
                f"{self.source_kind} 不能仅因内容非空而晋升为 GROUNDED"
            )
        return self
