"""CapabilityGrantV1 — R0-W02 REQ-006/007。

RED case：
- REQ-006"非硬需求能力仍被激活"——`activate_capabilities()` 只对 candidate ∩ hard_required
  的交集给 ACTIVATED，其余一律 NOT_ACTIVATED；直接构造 ACTIVATED+required_by_mission=False
  在类型层面就被拒绝。
- REQ-007"未激活能力仍获正文/token/tool"——`NOT_ACTIVATED` 状态下 body_access/token_scope/
  tool_access 全部结构性禁止为非空，不是运行时检查，是构造不出来。

金标切片桩：`HARD_REQUIRED_CAPABILITIES_R0` 只放 1 条，真实能力目录是 W03/W05 territory。
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.contracts.mission_contract import MissionContractV1

# W02 只需要证明"契约本身能往返"，不需要真实能力目录——真实目录留给 W03（安全摄取）/W05（证据）。
HARD_REQUIRED_CAPABILITIES_R0: frozenset[str] = frozenset({"docx_ingest"})


class CapabilityGrantV1(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["CapabilityGrantV1"] = "CapabilityGrantV1"
    capability_id: str = Field(min_length=1)
    required_by_mission: bool
    activation_status: Literal["NOT_ACTIVATED", "ACTIVATED"]
    body_access: bool = False
    token_scope: list[str] = Field(default_factory=list)
    tool_access: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def _zero_access_when_not_activated(self) -> "CapabilityGrantV1":
        if self.activation_status == "NOT_ACTIVATED":
            if self.body_access or self.token_scope or self.tool_access:
                raise ValueError("NOT_ACTIVATED 能力不得携带 body_access/token_scope/tool_access")
        if self.activation_status == "ACTIVATED" and not self.required_by_mission:
            raise ValueError("非硬需求能力不得被激活（ACTIVATED 要求 required_by_mission=True）")
        return self


def activate_capabilities(
    mission: MissionContractV1,  # noqa: ARG001 — 签名保留 mission 供未来 W03/W05 扩展判定依据
    candidate_ids: list[str],
    hard_required_ids: frozenset[str] = HARD_REQUIRED_CAPABILITIES_R0,
) -> list[CapabilityGrantV1]:
    """纯函数：只对 candidate ∩ hard_required 的交集给 ACTIVATED，其余全零权限。"""
    grants: list[CapabilityGrantV1] = []
    for capability_id in candidate_ids:
        required = capability_id in hard_required_ids
        if required:
            grants.append(
                CapabilityGrantV1(
                    capability_id=capability_id,
                    required_by_mission=True,
                    activation_status="ACTIVATED",
                    body_access=True,
                    token_scope=[capability_id],
                    tool_access=[capability_id],
                )
            )
        else:
            grants.append(
                CapabilityGrantV1(
                    capability_id=capability_id,
                    required_by_mission=False,
                    activation_status="NOT_ACTIVATED",
                )
            )
    return grants
