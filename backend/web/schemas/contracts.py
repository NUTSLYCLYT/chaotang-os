"""合同契约路由的请求体 schema（R0-W02）。"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class MissionConfirmRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    revision: int = Field(ge=1)
    content_digest: str = Field(min_length=64, max_length=64)


class CapabilityActivationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mission_contract_id: str = Field(min_length=1)
    candidate_capability_ids: list[str] = Field(min_length=1)
