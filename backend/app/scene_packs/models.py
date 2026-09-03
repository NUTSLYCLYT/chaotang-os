"""Typed contracts for Scene Pack V1.

The contracts are deliberately independent from the Chancellor/LangGraph
runtime. Scene Packs consume user-provided material, produce a bounded advisory
card, and persist a military-office mission. They never perform external sales,
payment, contract-signing, mailing or publishing actions.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

SceneRunStatus = Literal["created", "running", "completed", "blocked", "failed"]
RiskGrade = Literal["low", "medium", "high"]
OpportunityGrade = Literal["low", "medium", "high"]
MissionStage = Literal["todo", "in_progress", "awaiting_input", "blocked", "done"]
ActionPriority = Literal["P0", "P1", "P2"]
EvidenceReliability = Literal["high", "medium", "low"]
EvidenceSourceType = Literal[
    "user_file",
    "customer_claim",
    "official_source",
    "company_site",
    "market_reference",
    "model_inference",
    "user_claim",
    "external_signal",
]


class ScenePack(BaseModel):
    """Registry item shown on the grand hall entry surface."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=80)
    slug: str = Field(min_length=1, max_length=120)
    name: str = Field(min_length=1, max_length=80)
    short_value: str = Field(min_length=1, max_length=240)
    target_user: str = Field(min_length=1, max_length=240)
    default_owner_dept: str = Field(min_length=1, max_length=240)
    sort_order: int = Field(ge=1)
    required_inputs: list[str]
    optional_inputs: list[str]
    output_contract: dict[str, Any]
    enabled: bool
    implementation_status: Literal["real_v1", "stubbed"]
    entry_route: str = Field(min_length=1, max_length=200)
    demo_available: bool
    created_at: str
    updated_at: str


class NextAction(BaseModel):
    """One safe next step for a human operator."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=240)
    owner_dept: str = Field(min_length=1, max_length=80)
    priority: ActionPriority
    due_hint: str = Field(min_length=1, max_length=80)


class EvidenceRef(BaseModel):
    """Bounded source label for one claim in a scene result."""

    model_config = ConfigDict(extra="forbid")

    claim: str = Field(min_length=1, max_length=240)
    source_label: str = Field(min_length=1, max_length=160)
    source_type: EvidenceSourceType
    captured_at: str
    reliability: EvidenceReliability


class BoardMissionBrief(BaseModel):
    """Mission fragment embedded in a scene run response."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=180)
    stage: MissionStage
    next_milestone: str = Field(min_length=1, max_length=240)


class SceneRun(BaseModel):
    """Persisted run projection shared by all scene packs."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=64)
    pack_id: str = Field(min_length=1, max_length=80)
    pack_slug: str = Field(min_length=1, max_length=120)
    user_id: str = Field(min_length=1, max_length=256)
    tenant_id: str = Field(min_length=1, max_length=256)
    status: SceneRunStatus
    verdict: str = Field(min_length=1, max_length=80)
    verdict_text: str = Field(min_length=1, max_length=500)
    confidence: int = Field(ge=0, le=100)
    risk_grade: RiskGrade
    opportunity_grade: OpportunityGrade
    result_summary: str = Field(min_length=1, max_length=1200)
    missing_items: list[str]
    next_actions: list[NextAction]
    evidence_refs: list[EvidenceRef]
    action_payload: dict[str, Any]
    created_at: str
    updated_at: str


class BoardMission(BaseModel):
    """Military-office task card derived from one scene run."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=64)
    run_id: str = Field(min_length=1, max_length=64)
    pack_id: str = Field(min_length=1, max_length=80)
    pack_slug: str = Field(min_length=1, max_length=120)
    pack_name: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=180)
    owner: str = Field(min_length=1, max_length=80)
    stage: MissionStage
    risk_grade: RiskGrade
    next_milestone: str = Field(min_length=1, max_length=240)
    due_at: str
    pinned: bool
    created_at: str
    updated_at: str


class SceneRunInput(BaseModel):
    """HTTP request payload accepted by ``POST /api/v1/court/scene-runs``."""

    model_config = ConfigDict(extra="forbid")

    pack_slug: str = Field(min_length=1, max_length=120)
    inputs: dict[str, Any] = Field(default_factory=dict)
    attachments: list[dict[str, Any]] = Field(default_factory=list)
    demo: bool = False

    @field_validator("pack_slug")
    @classmethod
    def _normalize_slug(cls, value: str) -> str:
        return value.strip()


class MissionPatch(BaseModel):
    """Safe manual mission-state update from the military office board."""

    model_config = ConfigDict(extra="forbid")

    stage: MissionStage | None = None
    next_milestone: str | None = Field(default=None, min_length=1, max_length=240)
    owner: str | None = Field(default=None, min_length=1, max_length=80)
    pinned: bool | None = None
