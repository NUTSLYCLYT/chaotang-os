"""Contracts for the read-only CapabilityRegistry projection.

V2 adds a metadata-only view of the user's personal Codex capability catalog.
Catalog visibility never grants installation, connection, verification, or runtime
permission.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

CapabilityType = Literal[
    "skill",
    "agent",
    "swarm",
    "workflow",
    "mcp",
    "plugin",
    "provider",
    "api",
    "template",
    "imprint",
]
CapabilitySource = Literal[
    "internal",
    "honglusi",
    "personal_catalog",
    "user_contribution",
    "shiguan",
    "external",
]
CapabilityLevel = Literal["low", "medium", "high"]
CapabilityStatus = Literal["draft", "trial", "approved", "retired"]
InvocationPolicy = Literal[
    "AUTO_MATCH",
    "EXPLICIT_ONLY",
    "PREPARE_THEN_CONFIRM",
    "DISABLED",
]


class CapabilityReadiness(BaseModel):
    """Five independent readiness dimensions; none implies another."""

    model_config = ConfigDict(extra="forbid")

    visibility_status: str = Field(min_length=1, max_length=128)
    installation_status: str = Field(min_length=1, max_length=128)
    connection_status: str = Field(min_length=1, max_length=128)
    verification_status: str = Field(min_length=1, max_length=128)
    runtime_binding_status: Literal["not_bound"] = "not_bound"


class McpToolDetail(BaseModel):
    """Metadata-only MCP tool detail nested under its provider group."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=3, max_length=256)
    name: str = Field(min_length=1, max_length=256)
    provider_group: str = Field(min_length=1, max_length=128)
    invocation_policy: InvocationPolicy
    connection_status: str = Field(min_length=1, max_length=128)
    verification_status: str = Field(min_length=1, max_length=128)
    runtime_binding_status: Literal["not_bound"] = "not_bound"


class CapabilityCatalogMetadata(BaseModel):
    """Personal catalog metadata attached to a canonical registry item."""

    model_config = ConfigDict(extra="forbid")

    origin: Literal["personal_catalog"] = "personal_catalog"
    category: str | None = Field(default=None, max_length=128)
    natural_language_trigger: str = Field(min_length=1, max_length=512)
    explicit_trigger: str | None = Field(default=None, max_length=256)
    invocation_policy: InvocationPolicy
    fee_status: str = Field(min_length=1, max_length=512)
    permission_summary: str = Field(min_length=1, max_length=1024)
    external_data: str = Field(min_length=1, max_length=512)
    readiness: CapabilityReadiness
    blocker: str = Field(min_length=1, max_length=512)
    provider_group: str | None = Field(default=None, max_length=128)
    tool_count: int = Field(default=0, ge=0, le=512)
    tools: list[McpToolDetail] = Field(default_factory=list, max_length=512)

    @model_validator(mode="after")
    def validate_tools(self) -> CapabilityCatalogMetadata:
        if self.tool_count != len(self.tools):
            raise ValueError("tool count mismatch")
        if len({tool.id for tool in self.tools}) != len(self.tools):
            raise ValueError("duplicate tool id")
        return self


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


class CrmProviderPassport(BaseModel):
    """鸿胪寺签发给兵部的 CRM 只读能力护照。

    护照描述准入事实，不携带连接凭据。兵部只能接收注入的只读 transport。
    """

    model_config = ConfigDict(extra="forbid")

    provider: str = Field(min_length=2, max_length=128)
    capability_id: str = Field(min_length=3, max_length=256)
    source: Literal["honglusi"] = "honglusi"
    admission: Literal["approved_read_only"] = "approved_read_only"
    review_status: Literal["approved"] = "approved"
    allowed_actions: list[Literal["read"]] = Field(min_length=1, max_length=1)
    forbidden_actions: list[str] = Field(min_length=1)
    credential_boundary: Literal["injected_transport_only"] = "injected_transport_only"
    evidence_sources: list[str] = Field(min_length=1)
    audit_required: Literal[True] = True

    @model_validator(mode="after")
    def validate_read_only_boundary(self) -> CrmProviderPassport:
        if self.allowed_actions != ["read"]:
            raise ValueError("CRM provider passports must allow read only")
        forbidden = {item.lower() for item in self.forbidden_actions}
        if not any("write" in item or "credential" in item for item in forbidden):
            raise ValueError("CRM provider passports must forbid writes and credential access")
        return self


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
    catalog: CapabilityCatalogMetadata | None = None

    @model_validator(mode="after")
    def validate_catalog_is_non_authorizing(self) -> CapabilityRegistryItem:
        if self.catalog is None:
            return self
        if self.card.active:
            raise ValueError("catalog cards cannot be active")
        if not self.card.zero_permission_when_inactive:
            raise ValueError("catalog cards must preserve zero permission")
        return self


class CapabilityRegistrySummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    total: int
    by_type: dict[str, int]
    by_home: dict[str, int]
    by_status: dict[str, int]
    external_review_required: int
    small_sample_without_authority_score: int
    catalog_hanlin_skills: int = Field(default=0, ge=0)
    catalog_provider_groups: int = Field(default=0, ge=0)
    catalog_mcp_tools: int = Field(default=0, ge=0)
    catalog_snapshot_provider_groups: int = Field(default=0, ge=0)
    catalog_snapshot_mcp_tools: int = Field(default=0, ge=0)
    catalog_excluded_support_tools: int = Field(default=0, ge=0)


class CapabilityRegistryProjection(BaseModel):
    """Deterministic, read-only registry view used by APIs and UI."""

    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["capability-registry.v2"] = "capability-registry.v2"
    owner: Literal["CapabilityRegistry V2 readonly projection"] = (
        "CapabilityRegistry V2 readonly projection"
    )
    canonical_writer: Literal["existing source-of-truth modules only"] = (
        "existing source-of-truth modules only"
    )
    readonly_sources: list[str]
    items: list[CapabilityRegistryItem]
    agent_personas: list[AgentPersonaCard]
    summary: CapabilityRegistrySummary
