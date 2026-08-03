from __future__ import annotations

import re
from datetime import UTC, datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

_SEMANTIC_VERSION = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")


class AgentLayer(StrEnum):
    BUREAU = "bureau"
    MINISTRY = "ministry"
    COUNCIL = "council"


class RuntimeService(StrEnum):
    REQUEST_MATERIALS = "request_materials"
    PARENT_TASK = "parent_task"
    APPROVED_DATA_SUMMARIES = "approved_data_summaries"
    CONTROLLED_CONTEXT = "controlled_context"
    EVIDENCE_PROTOCOL = "evidence_protocol"
    BUREAU_AGENTS = "bureau_agents"
    MINISTRY_AGENTS = "ministry_agents"


class EvidenceSufficiency(StrEnum):
    SUFFICIENT = "sufficient"
    PARTIAL = "partial"
    INSUFFICIENT = "insufficient"


class ReportStatus(StrEnum):
    COMPLETED = "completed"
    DEGRADED = "degraded"
    FAILED = "failed"


class _FrozenContract(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")


class RuntimeSkillDefinition(_FrozenContract):
    skill_id: str
    version: str
    agent_id: str
    layer: AgentLayer
    purpose: str
    responsibility_scope: tuple[str, ...]
    data_requirements: tuple[str, ...]
    analysis_procedure: tuple[str, ...]
    required_findings: tuple[str, ...]
    allowed_services: frozenset[RuntimeService]
    forbidden_actions: tuple[str, ...]
    report_type: type[BureauReport | MinistryReport | CouncilReport]

    @field_validator("skill_id", "agent_id", "purpose")
    @classmethod
    def require_nonblank_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("value_must_be_nonblank")
        return value

    @field_validator("version")
    @classmethod
    def require_semantic_version(cls, value: str) -> str:
        if _SEMANTIC_VERSION.fullmatch(value) is None:
            raise ValueError("unsupported_semantic_version")
        return value

    @field_validator(
        "responsibility_scope",
        "data_requirements",
        "analysis_procedure",
        "required_findings",
        "forbidden_actions",
    )
    @classmethod
    def require_nonempty_methods(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        if not value or any(not item.strip() for item in value):
            raise ValueError("method_items_must_be_nonblank")
        return value

    @model_validator(mode="after")
    def require_report_type_for_layer(self) -> RuntimeSkillDefinition:
        expected = {
            AgentLayer.BUREAU: BureauReport,
            AgentLayer.MINISTRY: MinistryReport,
            AgentLayer.COUNCIL: CouncilReport,
        }[self.layer]
        if self.report_type is not expected:
            raise ValueError("report_type_layer_mismatch")
        return self


class SkillInvocation(_FrozenContract):
    request_id: str
    parent_report_id: str | None = None
    agent_id: str
    skill_id: str
    skill_version: str
    input_refs: tuple[str, ...] = ()
    evidence_refs: tuple[str, ...] = ()
    requested_services: frozenset[RuntimeService] = frozenset()
    requirement_data_refs: dict[str, tuple[str, ...]] = Field(default_factory=dict)

    @field_validator("request_id", "agent_id", "skill_id")
    @classmethod
    def require_nonblank_identifier(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("identifier_must_be_nonblank")
        return value

    @field_validator("skill_version")
    @classmethod
    def require_semantic_version(cls, value: str) -> str:
        if _SEMANTIC_VERSION.fullmatch(value) is None:
            raise ValueError("unsupported_semantic_version")
        return value

    @field_validator("requirement_data_refs")
    @classmethod
    def require_valid_requirement_coverage(
        cls, value: dict[str, tuple[str, ...]]
    ) -> dict[str, tuple[str, ...]]:
        if any(
            not requirement.strip() or not refs or any(not ref.strip() for ref in refs)
            for requirement, refs in value.items()
        ):
            raise ValueError("requirement_coverage_must_be_nonblank")
        return value


class _ReportBase(_FrozenContract):
    report_id: str
    request_id: str
    parent_report_id: str | None = None
    agent_id: str
    skill_id: str
    skill_version: str
    subject: str
    executive_summary: str
    input_refs: tuple[str, ...] = ()
    data_sources: tuple[str, ...] = ()
    evidence_refs: tuple[str, ...] = ()
    data_gaps: tuple[str, ...] = ()
    evidence_sufficiency: EvidenceSufficiency
    status: ReportStatus
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    @field_validator(
        "report_id", "request_id", "agent_id", "skill_id", "subject", "executive_summary"
    )
    @classmethod
    def require_nonblank_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("value_must_be_nonblank")
        return value

    @field_validator("skill_version")
    @classmethod
    def require_semantic_version(cls, value: str) -> str:
        if _SEMANTIC_VERSION.fullmatch(value) is None:
            raise ValueError("unsupported_semantic_version")
        return value

    @model_validator(mode="after")
    def reject_completed_report_with_data_gaps(self) -> _ReportBase:
        if self.status is ReportStatus.COMPLETED and self.data_gaps:
            raise ValueError("completed_report_has_unresolved_fields")
        return self


class BureauReport(_ReportBase):
    analysis: tuple[str, ...]
    professional_findings: tuple[str, ...]
    risks: tuple[str, ...]
    recommendations: tuple[str, ...]
    evidence_requests: tuple[str, ...] = ()
    out_of_scope_items: tuple[str, ...] = ()

    @model_validator(mode="after")
    def reject_completed_report_with_evidence_requests(self) -> BureauReport:
        if self.status is ReportStatus.COMPLETED and self.evidence_requests:
            raise ValueError("completed_report_has_unresolved_fields")
        return self


class MinistryReport(_ReportBase):
    selected_bureaus: tuple[str, ...]
    selection_reasons: tuple[str, ...]
    bureau_report_refs: tuple[str, ...]
    shared_findings: tuple[str, ...]
    conflicts: tuple[str, ...]
    cross_bureau_impacts: tuple[str, ...]
    ministry_position: tuple[str, ...]
    unresolved_items: tuple[str, ...]

    @model_validator(mode="after")
    def reject_completed_report_with_unresolved_items(self) -> MinistryReport:
        if self.status is ReportStatus.COMPLETED and self.unresolved_items:
            raise ValueError("completed_report_has_unresolved_fields")
        return self


class CouncilReport(_ReportBase):
    participating_ministries: tuple[str, ...]
    review_order: tuple[str, ...]
    ministry_report_refs: tuple[str, ...]
    consensus: tuple[str, ...]
    disagreements: tuple[str, ...]
    cross_ministry_dependencies: tuple[str, ...]
    joint_options: tuple[str, ...]
    matters_for_chancellor_decision: tuple[str, ...]


class SkillAuditRecord(_FrozenContract):
    request_id: str
    parent_report_id: str | None = None
    agent_id: str
    skill_id: str
    skill_version: str
    input_refs: tuple[str, ...] = ()
    evidence_refs: tuple[str, ...] = ()
    allowed_services: frozenset[RuntimeService] = frozenset()
    status: ReportStatus
    failure_code: str | None = None
    duration_ms: int = Field(ge=0)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    @field_validator("request_id", "agent_id", "skill_id")
    @classmethod
    def require_nonblank_identifier(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("identifier_must_be_nonblank")
        return value

    @field_validator("skill_version")
    @classmethod
    def require_semantic_version(cls, value: str) -> str:
        if _SEMANTIC_VERSION.fullmatch(value) is None:
            raise ValueError("unsupported_semantic_version")
        return value


RuntimeSkillDefinition.model_rebuild()
