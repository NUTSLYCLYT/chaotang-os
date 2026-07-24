"""ContractRiskItemV1 — R0-W05 合同风险项公共契约。"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

RiskLevel = Literal["critical", "high", "medium", "low"]
EngineTier = Literal["deterministic", "validated_model", "fallback"]


class ContractRiskItemV1(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["ContractRiskItemV1"] = "ContractRiskItemV1"
    risk_item_id: str = Field(min_length=1)
    evidence_packet_id: str = Field(min_length=1)
    file_version_id: str | None = Field(default=None, min_length=1)
    page_number: int | None = Field(default=None, ge=1)
    clause_ref: str | None = Field(default=None, min_length=1)
    raw_excerpt: str | None = Field(default=None, min_length=1, max_length=2000)
    risk_level: RiskLevel
    explanation: str = Field(min_length=1, max_length=2000)
    missing_evidence: list[str] = Field(default_factory=list)
    recommended_revision: str = Field(min_length=1, max_length=4000)
    source_label: str = Field(min_length=1)
    engine_tier: EngineTier

    @model_validator(mode="after")
    def _high_risk_requires_original_anchor(self) -> "ContractRiskItemV1":
        if self.risk_level not in {"critical", "high"}:
            has_complete_anchor = (
                bool(self.file_version_id)
                and (self.page_number is not None or bool(self.clause_ref))
                and bool(self.raw_excerpt)
            )
            if not has_complete_anchor and not self.missing_evidence:
                raise ValueError("缺少原文锚点时必须声明 missing evidence")
            return self
        if not self.file_version_id:
            raise ValueError("critical/high 风险必须绑定 file version")
        if self.page_number is None and not self.clause_ref:
            raise ValueError("critical/high 风险必须绑定 page 或 clause")
        if not self.raw_excerpt:
            raise ValueError("critical/high 风险必须绑定 raw excerpt")
        return self
