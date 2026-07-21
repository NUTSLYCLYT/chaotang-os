"""ContractSupportDecisionV1 — R0-W02 REQ-003（支持/拒答 taxonomy 的运行时判定）。

RED case："缺法域/语言/类型/角色仍输出放行"必须失败——`evaluate_support()` 对四维度逐一独立
检查，缺失或超范围一律走 DECLINED，绝不静默放行；累计所有命中的拒答原因（不是只报第一个）。
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, model_validator

from src.contract_taxonomy import UNSUPPORTED_SENTINEL, DeclineReason
from src.contracts.mission_contract import ContractIntakeV1


class ContractSupportDecisionV1(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["ContractSupportDecisionV1"] = "ContractSupportDecisionV1"
    mission_contract_id: str
    revision: int
    support_status: Literal["SUPPORTED", "DECLINED"]
    decline_reasons: list[DeclineReason]
    evaluated_at: str

    @model_validator(mode="after")
    def _status_matches_reasons(self) -> "ContractSupportDecisionV1":
        if self.support_status == "SUPPORTED" and self.decline_reasons:
            raise ValueError("SUPPORTED 不能携带 decline_reasons")
        if self.support_status == "DECLINED" and not self.decline_reasons:
            raise ValueError("DECLINED 必须携带至少一个 decline_reasons")
        return self


def evaluate_support(
    intake: ContractIntakeV1,
    *,
    mission_contract_id: str,
    revision: int,
    evaluated_at: str,
    capability_active: bool,
) -> ContractSupportDecisionV1:
    """纯函数：四维度独立检查，累计所有命中的拒答原因。"""
    reasons: list[DeclineReason] = []

    if intake.jurisdiction is None:
        reasons.append("MISSING_JURISDICTION")
    elif intake.jurisdiction == UNSUPPORTED_SENTINEL:
        reasons.append("UNSUPPORTED_JURISDICTION")

    if intake.language is None:
        reasons.append("MISSING_LANGUAGE")
    elif intake.language == UNSUPPORTED_SENTINEL:
        reasons.append("UNSUPPORTED_LANGUAGE")

    if intake.contract_type is None:
        reasons.append("MISSING_CONTRACT_TYPE")
    elif intake.contract_type == UNSUPPORTED_SENTINEL:
        reasons.append("UNSUPPORTED_CONTRACT_TYPE")

    if intake.our_role is None:
        reasons.append("MISSING_ROLE")
    elif intake.our_role == UNSUPPORTED_SENTINEL:
        # our_role 目前没有独立 DeclineReason 值，用 UNKNOWN_SCOPE 兜底记录。
        reasons.append("UNKNOWN_SCOPE")

    if not reasons and not capability_active:
        reasons.append("CAPABILITY_NOT_ACTIVATED")

    return ContractSupportDecisionV1(
        mission_contract_id=mission_contract_id,
        revision=revision,
        support_status="DECLINED" if reasons else "SUPPORTED",
        decline_reasons=reasons,
        evaluated_at=evaluated_at,
    )
