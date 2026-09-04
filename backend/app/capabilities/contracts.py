"""Contracts for the read-only CapabilityRegistry projection.

V1 intentionally describes existing capabilities only. It does not grant a skill,
agent, MCP server, plugin, or persona any runtime permission.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


CapabilityType = Literal[
    "skill",
    "agent",
    "swarm",
    "workflow",
    "mcp",
    "plugin",
    "api",
    "template",
    "imprint",
]
CapabilitySource = Literal[
    "internal",
    "honglusi",
    "user_contribution",
    "shiguan",
    "external",
]
CapabilityLevel = Literal["low", "medium", "high"]
CapabilityStatus = Literal["draft", "trial", "approved", "retired"]


class CapabilityCard(BaseModel):
    """User-facing capability card projected from an existing source of truth."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=3)
    name: str = Field(min_length=1)
    type: CapabilityType
    source: CapabilitySource
    best_use_case: str = Field(min_length=1)
    input_needed: list[str]
    output_produced: list[str]
    risk_level: CapabilityLevel
    cost_level: CapabilityLevel
    reuse_potential: CapabilityLevel
    recommended_home: str = Field(min_length=2)
    status: CapabilityStatus
    evidence_sources: list[str] = Field(min_length=1)
    active: bool
    sample_count: int = Field(ge=0)
    authority_score: float | None = Field(default=None, ge=0, le=1)
    zero_permission_when_inactive: bool = True


class AgentPersonaCard(BaseModel):
    """Persona metadata for communication only; never a permission principal."""

    model_config = ConfigDict(extra="forbid")

    agent_id: str = Field(min_length=3)
    display_name: str = Field(min_length=1)
    role: str = Field(min_length=1)
    voice: str = Field(min_length=1)
    humor_level: int = Field(ge=0, le=3)
    decision_style: str = Field(min_length=1)
    forbidden_behavior: list[str]
    default_opening: str = Field(min_length=1)
    evolution_goal: str = Field(min_length=1)
    cost_efficiency_goal: str = Field(min_length=1)


class ExternalCapabilityReview(BaseModel):
    """Default fail-closed review envelope for external capability candidates."""

    model_config = ConfigDict(extra="forbid")

    provider: str = Field(min_length=2)
    permission_needed: list[str]
    data_exposure: list[str]
    allowed_actions: list[str]
    forbidden_actions: list[str]
    requires_xingbu_review: bool
    default_grant_duration: str
    audit_required: bool


class CapabilityPromotionCase(BaseModel):
    """Libu-style capability admission, promotion, merge, or retirement advice."""

    model_config = ConfigDict(extra="forbid")

    capability_id: str = Field(min_length=3)
    current_home: str = Field(min_length=2)
    recommended_action: str = Field(min_length=1)
    rationale: str = Field(min_length=1)
    required_evidence: list[str]
    reviewer_department: str = Field(min_length=1)


class CapabilityRegistryItem(BaseModel):
    """One canonical row in the CapabilityRegistry read-only projection."""

    model_config = ConfigDict(extra="forbid")

    card: CapabilityCard
    persona: AgentPersonaCard | None = None
    external_review: ExternalCapabilityReview | None = None
    promotion_case: CapabilityPromotionCase


class CapabilityRegistrySummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    total: int
    by_type: dict[str, int]
    by_home: dict[str, int]
    by_status: dict[str, int]
    external_review_required: int
    small_sample_without_authority_score: int


class CapabilityRegistryProjection(BaseModel):
    """Deterministic, read-only registry view used by APIs and UI."""

    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["capability-registry.v1"] = "capability-registry.v1"
    owner: Literal["CapabilityRegistry V1 readonly projection"] = (
        "CapabilityRegistry V1 readonly projection"
    )
    canonical_writer: Literal["existing source-of-truth modules only"] = (
        "existing source-of-truth modules only"
    )
    readonly_sources: list[str]
    items: list[CapabilityRegistryItem]
    agent_personas: list[AgentPersonaCard]
    summary: CapabilityRegistrySummary
