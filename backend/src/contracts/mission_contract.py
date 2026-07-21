"""MissionContractV1 / ContractIntakeV1 — R0-W02 REQ-004。

后端 Pydantic/OpenAPI 为跨端契约事实源；前端不得重复定义同名结构（W02 packet card）。

RED case（REQ-004）："目标/约束/禁止动作/成果字段可缺"必须失败——`constraints`/
`prohibited_actions`/`goal`/`desired_outcome` 全部是必填键（值可以是空列表，但键不能省），
不用 `default_factory` 兜底，否则字段缺失会静默变成"没有约束"，把要修的 bug 直接写进 schema。
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from src.contract_taxonomy import ContractLanguage, ContractType, Jurisdiction, OurRole


class MissionGoal(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_intent: str = Field(min_length=1)
    biggest_concern: str = Field(min_length=1)
    risk_tolerance: str = ""


class MissionOutcome(BaseModel):
    model_config = ConfigDict(extra="forbid")

    required_artifacts: list[Literal["PDF", "DOCX", "JSON"]] = Field(min_length=1)


class ContractIntakeV1(BaseModel):
    """支持/拒答评估的前置输入——各维度可缺失（None），由 evaluate_support() 判定。"""

    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["ContractIntakeV1"] = "ContractIntakeV1"
    jurisdiction: Jurisdiction | None = None
    language: ContractLanguage | None = None
    contract_type: ContractType | None = None
    our_role: OurRole | None = None


class MissionContractV1(BaseModel):
    """确认后的精确任务版本——四维度必须齐全（SUPPORTED 之后才能构造）。"""

    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["MissionContractV1"] = "MissionContractV1"
    mission_contract_id: str = Field(min_length=1)
    task_id: str = Field(min_length=1)
    revision: int = Field(ge=1)
    jurisdiction: Jurisdiction
    language: ContractLanguage
    contract_type: ContractType
    our_role: OurRole
    goal: MissionGoal
    constraints: list[str]
    prohibited_actions: list[str]
    desired_outcome: MissionOutcome
    assumptions: list[str]
    budget_limit_minor: int = Field(ge=0)
    deadline_at: datetime
    read_scope: list[str] = Field(min_length=1)
    plan_digest: str = Field(pattern=r"^[0-9a-f]{64}$")
    content_digest: str = Field(min_length=64, max_length=64)
    created_at: str = Field(min_length=1)


def compute_mission_content_digest(mission: MissionContractV1) -> str:
    """sha256 hex over canonical sorted-key JSON of decision-relevant fields only.

    排除自指字段（mission_contract_id/revision/created_at/content_digest 自身）——
    这些字段变化不代表任务内容真的变了，混进摘要会让"内容没变但 digest 变了"这种假冲突出现。
    """
    payload: dict[str, Any] = {
        "task_id": mission.task_id,
        "jurisdiction": mission.jurisdiction,
        "language": mission.language,
        "contract_type": mission.contract_type,
        "our_role": mission.our_role,
        "goal": mission.goal.model_dump(),
        "constraints": mission.constraints,
        "prohibited_actions": mission.prohibited_actions,
        "desired_outcome": mission.desired_outcome.model_dump(),
        "assumptions": mission.assumptions,
        "budget_limit_minor": mission.budget_limit_minor,
        "deadline_at": mission.deadline_at.isoformat(),
        "read_scope": mission.read_scope,
        "plan_digest": mission.plan_digest,
    }
    canonical = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
