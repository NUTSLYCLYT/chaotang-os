"""ContractReviewPackV1 — R0-W05 canonical CourtReview 候选契约。"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.contract_taxonomy import (
    ContractLanguage,
    ContractType,
    ContractVerdict,
    Jurisdiction,
    LegalQuestion,
    OurRole,
)
from src.contracts.contract_risk_item import ContractRiskItemV1


class ContractReviewPackV1(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["ContractReviewPackV1"] = "ContractReviewPackV1"
    review_pack_id: str = Field(min_length=1)
    tenant_id: str = Field(min_length=1)
    task_id: str = Field(min_length=1)
    mission_contract_id: str = Field(min_length=1)
    mission_revision: int | None = Field(
        default=None,
        ge=1,
        exclude_if=lambda value: value is None,
    )
    mission_content_digest: str | None = Field(
        default=None,
        pattern=r"^[0-9a-f]{64}$",
        exclude_if=lambda value: value is None,
    )
    court_review_id: str = Field(min_length=1)
    evidence_packet_ids: list[str] = Field(min_length=1)
    jurisdiction: Jurisdiction
    language: ContractLanguage
    contract_type: ContractType
    our_role: OurRole
    legal_question: LegalQuestion
    risk_items: list[ContractRiskItemV1]
    verdict: ContractVerdict
    decision_summary: str = Field(min_length=1, max_length=4000)
    affected_sections: list[str] = Field(min_length=1)
    source_labels: list[str] = Field(min_length=1)
    engine_tiers: list[Literal["deterministic", "validated_model", "fallback"]] = Field(
        min_length=1
    )
    quality_gate_status: Literal["PENDING", "PASSED", "FAILED"]
    candidate_status: Literal["CANDIDATE"] = "CANDIDATE"

    @model_validator(mode="after")
    def _critical_risk_cannot_proceed(self) -> "ContractReviewPackV1":
        if self.verdict == "PROCEED_TO_HUMAN_APPROVAL" and any(
            item.risk_level == "critical" for item in self.risk_items
        ):
            raise ValueError("未解决 critical 风险不得进入人工批准裁决")
        scope_dimensions = (
            self.jurisdiction,
            self.language,
            self.contract_type,
            self.our_role,
            self.legal_question,
        )
        if (
            "UNSUPPORTED_OR_UNKNOWN" in scope_dimensions
            and self.verdict != "NEED_LEGAL_REVIEW"
        ):
            raise ValueError("超出获批范围只能 NEED_LEGAL_REVIEW")
        known_evidence_packets = set(self.evidence_packet_ids)
        if any(
            item.evidence_packet_id not in known_evidence_packets
            for item in self.risk_items
        ):
            raise ValueError("风险项必须引用 review pack 内的 evidence packet")
        return self
