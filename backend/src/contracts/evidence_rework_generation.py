"""EvidenceReworkGenerationV1 — R0-W05 canonical 补证代际契约。"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from src.contracts.evidence_packet import EvidencePacketV1
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
    gate_reasons: list[str] | None = None
    contract_review_pack_id: str | None = Field(default=None, min_length=1)
    court_review_id: str | None = Field(default=None, min_length=1)

    def to_payload(self) -> dict[str, object]:
        """Serialize sparse state while retaining the request's explicit null."""
        payload = self.model_dump(mode="json", exclude_none=True)
        payload["evidence_request"] = self.evidence_request.model_dump(mode="json")
        return payload
