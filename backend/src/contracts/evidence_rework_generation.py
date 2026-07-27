"""EvidenceReworkGenerationV1 — R0-W05 canonical 补证代际契约。"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

from src.contracts.evidence_packet import EvidencePacketV1, EvidenceStatus
from src.contracts.mission_contract import ContractIntakeV1


class EvidenceReworkRequestV1(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: str = Field(min_length=1)
    followup_question: str | None = None


class EvidenceReworkGenerationV1(BaseModel):
    """One immutable request identity plus its canonical processing projection."""

    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["EvidenceReworkGenerationV1"] = (
        "EvidenceReworkGenerationV1"
    )
    generation_id: str = Field(min_length=1)
    generation: int = Field(ge=2)
    status: Literal[
        "awaiting_evidence",
        "evidence_bound",
        "pending",
        "candidate_ready",
        "quality_blocked",
    ]
    prior_final_memorial_content_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    evidence_request: EvidenceReworkRequestV1
    affected_sections: list[Literal["contract_review"]] = Field(
        min_length=1,
        max_length=1,
    )
    contract_scope: ContractIntakeV1 | None = None
    evidence_packets: list[EvidencePacketV1] | None = None
    evidence_status: EvidenceStatus = "NONE"
    gate_reasons: list[str] | None = None
    contract_review_pack_id: str | None = Field(default=None, min_length=1)
    court_review_id: str | None = Field(default=None, min_length=1)

    @model_validator(mode="after")
    def _project_evidence_status(self) -> "EvidenceReworkGenerationV1":
        packets = self.evidence_packets or []
        packet_statuses = {packet.evidence_status for packet in packets}
        if not packet_statuses:
            projected: EvidenceStatus = "NONE"
        elif "STALE" in packet_statuses:
            projected = "STALE"
        elif "CONFLICTED" in packet_statuses:
            projected = "CONFLICTED"
        elif packet_statuses == {"GROUNDED"}:
            projected = "GROUNDED"
        elif len(packet_statuses) == 1:
            projected = next(iter(packet_statuses))
        else:
            projected = "PARTIAL"

        if (
            "evidence_status" in self.model_fields_set
            and self.evidence_status != projected
        ):
            raise ValueError(
                "generation evidence_status 必须由 evidence_packets 唯一投影"
            )
        self.evidence_status = projected
        return self

    def to_payload(self) -> dict[str, object]:
        """Serialize sparse state while retaining the request's explicit null."""
        payload = self.model_dump(mode="json", exclude_none=True)
        payload["evidence_request"] = self.evidence_request.model_dump(mode="json")
        return payload


class EvidenceReworkGenerationPayloadV1(EvidenceReworkGenerationV1):
    """Durable generation payload with the frozen Mission identity fence."""

    mission_revision: int = Field(ge=1)
    mission_content_digest: str = Field(pattern=r"^[0-9a-f]{64}$")

    def to_public_payload(self) -> dict[str, object]:
        public = EvidenceReworkGenerationV1.model_validate(
            self.model_dump(
                mode="json",
                exclude={"mission_revision", "mission_content_digest"},
            )
        )
        return public.to_payload()


class EvidenceReworkMissionIdentityMissing(ValueError):
    """A parent-valid durable payload predating the frozen Mission identity."""

    def __init__(self, generation: EvidenceReworkGenerationV1) -> None:
        super().__init__("durable evidence rework payload lacks mission identity")
        self.generation = generation


def load_durable_evidence_rework_generation(
    payload_json: str,
) -> EvidenceReworkGenerationPayloadV1:
    """Read current payloads and identify valid parent payloads without mutation."""
    try:
        return EvidenceReworkGenerationPayloadV1.model_validate_json(payload_json)
    except ValidationError as current_error:
        try:
            legacy_generation = EvidenceReworkGenerationV1.model_validate_json(
                payload_json
            )
        except ValidationError as legacy_error:
            raise current_error from legacy_error
        raise EvidenceReworkMissionIdentityMissing(
            legacy_generation
        ) from current_error
