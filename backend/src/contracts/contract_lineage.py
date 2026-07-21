"""ContractLineageStatusV1 — R0-W02 REQ-017（正交状态与 lineage 契约）。

RED case："一个状态字段承载多个正交语义"必须失败。反面教材：
`src/contracts/memorial_card.py::MemorialCard.status`（一个字段同时扛生命周期阶段 + 质量结论 +
阻塞原因分类）。这里没有 `status` 字段——四个独立轴各自建模，"一个字段扛多重语义"在类型层面就
不存在，不靠运行时检查防住。
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

MissionStatus = Literal["DRAFT", "AWAITING_CONFIRMATION", "CONFIRMED", "SUPERSEDED", "EXPIRED"]
SupportStatus = Literal["SUPPORTED", "DECLINED"]
CapabilityActivationStatus = Literal["NOT_ACTIVATED", "ACTIVATED"]
DecisionStatus = Literal["NOT_DECIDED", "DECIDED"]


class ContractLineageStatusV1(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["ContractLineageStatusV1"] = "ContractLineageStatusV1"
    lineage_id: str = Field(min_length=1)
    mission_contract_id: str = Field(min_length=1)
    revision: int = Field(ge=1)
    supersedes_revision: int | None = Field(default=None, ge=1)
    content_digest: str = Field(min_length=64, max_length=64)
    mission_status: MissionStatus
    support_status: SupportStatus
    capability_activation_status: CapabilityActivationStatus
    decision_status: DecisionStatus

    @model_validator(mode="after")
    def _cross_axis_consistency(self) -> "ContractLineageStatusV1":
        if self.supersedes_revision is not None and self.supersedes_revision >= self.revision:
            raise ValueError("supersedes_revision 必须小于 revision")
        if self.decision_status == "DECIDED" and self.mission_status != "CONFIRMED":
            raise ValueError("decision_status=DECIDED 要求 mission_status=CONFIRMED")
        return self
