"""ContractDecisionV1 — R0-W02 REQ-012。

RED case："第六种裁决或'可签'文案出现"必须失败——五种裁决用 Literal 天然拒绝第六种；
`verdict_narrative` 显式禁用暗示"可以签署"的措辞（合同裁决必须保守，禁止越权替用户下结论）。
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from src.contract_taxonomy import ContractVerdict

_BANNED_SIGN_OFF_PHRASES = ("可以签", "可签", "已批准签署", "approved to sign")


class ContractDecisionV1(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["ContractDecisionV1"] = "ContractDecisionV1"
    mission_contract_id: str = Field(min_length=1)
    final_memorial_id: str = Field(min_length=1)
    content_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    verdict: ContractVerdict
    verdict_narrative: str = Field(min_length=1, max_length=200)
    decided_at: datetime

    @field_validator("verdict_narrative")
    @classmethod
    def _no_sign_off_language(cls, value: str) -> str:
        normalized = value.casefold()
        for phrase in _BANNED_SIGN_OFF_PHRASES:
            if phrase.casefold() in normalized:
                raise ValueError(f"verdict_narrative 不得包含签署暗示文案: {phrase!r}")
        return value
