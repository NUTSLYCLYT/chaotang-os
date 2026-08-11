from __future__ import annotations

import math
import re
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, PrivateAttr, field_validator, model_validator

from app.agents.runtime_skills.tool_audit_ref import _mint_tool_audit_ref

_SEMANTIC_VERSION = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")
_MODEL_TOOL_CALL_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
_AUDIT_REF = re.compile(r"^tool-audit:[0-9a-f]{32}$")


class ToolName(StrEnum):
    REQUEST_EVIDENCE = "request_evidence"
    READ_APPROVED_MATERIALS = "read_approved_materials"
    INSPECT_APPROVED_DATA = "inspect_approved_data"
    COMPUTE_ANALYSIS = "compute_analysis"
    INSPECT_ACCOUNTING_CONTENT = "inspect_accounting_content"
    GENERATE_ACCOUNTING_WORKBOOK = "generate_accounting_workbook"


class ToolSideEffect(StrEnum):
    READ = "read"
    ARTIFACT = "artifact"
    SYSTEM_WRITE = "system_write"
    EXTERNAL = "external"


class ToolHealth(StrEnum):
    AVAILABLE = "available"
    DEGRADED = "degraded"
    UNAVAILABLE = "unavailable"


class ToolCallStatus(StrEnum):
    PROPOSED = "PROPOSED"
    VALIDATING = "VALIDATING"
    APPROVED = "APPROVED"
    EXECUTING = "EXECUTING"
    SUCCEEDED = "SUCCEEDED"
    DENIED = "DENIED"
    INVALID = "INVALID"
    BUDGET_EXCEEDED = "BUDGET_EXCEEDED"
    BLOCKED = "BLOCKED"
    FAILED = "FAILED"
    EMPTY = "EMPTY"
    TRUNCATED = "TRUNCATED"


class ToolDataQuality(StrEnum):
    SUFFICIENT = "SUFFICIENT"
    PARTIAL = "PARTIAL"
    INSUFFICIENT = "INSUFFICIENT"


class _FrozenToolContract(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")


def _require_nonblank(value: str) -> str:
    if not value.strip():
        raise ValueError("value_must_be_nonblank")
    return value


def _require_semantic_version(value: str) -> str:
    if _SEMANTIC_VERSION.fullmatch(value) is None:
        raise ValueError("unsupported_semantic_version")
    return value


def _reject_blank_nested(value: Any) -> Any:
    if isinstance(value, str):
        return _require_nonblank(value)
    if isinstance(value, dict):
        for key, item in value.items():
            if isinstance(key, str):
                _require_nonblank(key)
            _reject_blank_nested(item)
    elif isinstance(value, (list, tuple, set, frozenset)):
        for item in value:
            _reject_blank_nested(item)
    elif isinstance(value, float) and not math.isfinite(value):
        raise ValueError("numeric_value_must_be_finite")
    return value


class ToolDescriptor(_FrozenToolContract):
    descriptor_id: str
    handler_id: str
    tool_name: ToolName
    version: str
    input_schema_id: str
    output_schema_id: str
    read_only: bool
    risk_level: str
    deterministic: bool
    max_tool_calls: int = Field(gt=0, le=4)
    max_tool_rounds: int = Field(gt=0, le=2)
    max_result_rows: int = Field(ge=0)
    max_result_bytes: int = Field(ge=0)
    capability_group: str = "general"
    required_scopes: frozenset[str] = frozenset()
    data_domains: frozenset[str] = frozenset()
    side_effect: ToolSideEffect = ToolSideEffect.READ
    health: ToolHealth = ToolHealth.AVAILABLE

    _identifiers = field_validator(
        "descriptor_id", "handler_id", "input_schema_id", "output_schema_id", "risk_level",
        "capability_group",
    )(_require_nonblank)
    _version = field_validator("version")(_require_semantic_version)

    @field_validator("required_scopes", "data_domains")
    @classmethod
    def reject_blank_authority_values(cls, value: frozenset[str]) -> frozenset[str]:
        return _reject_blank_nested(value)


class ToolDiscoveryContext(_FrozenToolContract):
    version: str
    agent_id: str
    skill_id: str
    skill_version: str
    policy_id: str
    policy_version: str
    decree_scopes: frozenset[str]
    data_domains: frozenset[str]
    allowed_side_effects: frozenset[ToolSideEffect]

    _identifiers = field_validator("agent_id", "skill_id", "policy_id")(_require_nonblank)
    _versions = field_validator("version", "skill_version", "policy_version")(
        _require_semantic_version
    )

    @field_validator("decree_scopes", "data_domains")
    @classmethod
    def reject_blank_authority_values(cls, value: frozenset[str]) -> frozenset[str]:
        return _reject_blank_nested(value)


class DiscoveredTool(_FrozenToolContract):
    descriptor_id: str
    name: ToolName
    version: str
    input_schema_id: str
    output_schema_id: str
    capability_group: str
    risk_level: str
    deterministic: bool
    side_effect: ToolSideEffect
    health: ToolHealth
    handler_id: None = None

    _identifiers = field_validator(
        "descriptor_id", "input_schema_id", "output_schema_id", "capability_group", "risk_level"
    )(_require_nonblank)
    _version = field_validator("version")(_require_semantic_version)

    @classmethod
    def from_descriptor(cls, descriptor: ToolDescriptor) -> DiscoveredTool:
        return cls(
            descriptor_id=descriptor.descriptor_id,
            name=descriptor.tool_name,
            version=descriptor.version,
            input_schema_id=descriptor.input_schema_id,
            output_schema_id=descriptor.output_schema_id,
            capability_group=descriptor.capability_group,
            risk_level=descriptor.risk_level,
            deterministic=descriptor.deterministic,
            side_effect=descriptor.side_effect,
            health=descriptor.health,
        )


class BureauToolPolicy(_FrozenToolContract):
    policy_id: str
    version: str
    agent_id: str
    allowed_tools: frozenset[ToolName]
    allowed_data_domains: frozenset[str]
    tool_operations: dict[ToolName, tuple[str, ...]]
    tool_argument_constraints: dict[ToolName, dict[str, Any]]
    required_data_refs: tuple[str, ...]
    max_tool_calls: int = Field(gt=0, le=4)
    max_tool_rounds: int = Field(gt=0, le=2)
    max_result_rows: int = Field(gt=0)
    max_result_bytes: int = Field(gt=0)

    _identifiers = field_validator("policy_id", "agent_id")(_require_nonblank)
    _version = field_validator("version")(_require_semantic_version)

    @field_validator(
        "allowed_data_domains", "tool_operations", "tool_argument_constraints",
        "required_data_refs",
    )
    @classmethod
    def reject_blank_nested_values(cls, value: Any) -> Any:
        return _reject_blank_nested(value)

    @model_validator(mode="after")
    def require_constraints_for_allowed_tools(self) -> BureauToolPolicy:
        if not self.allowed_tools:
            raise ValueError("allowed_tools_must_not_be_empty")
        if set(self.tool_operations) != set(self.allowed_tools):
            raise ValueError("tool_operations_must_match_allowed_tools")
        if set(self.tool_argument_constraints) != set(self.allowed_tools):
            raise ValueError("tool_constraints_must_match_allowed_tools")
        if any(not operations for operations in self.tool_operations.values()):
            raise ValueError("tool_operations_must_not_be_empty")
        return self


class ToolCallProposal(_FrozenToolContract):
    tool_call_id: str
    tool_name: ToolName
    purpose: str
    arguments: dict[str, Any]
    required_for: tuple[str, ...]
    expected_result_schema: str

    _text = field_validator(
        "purpose", "expected_result_schema"
    )(_require_nonblank)

    @field_validator("tool_call_id")
    @classmethod
    def require_safe_model_call_id(cls, value: str) -> str:
        if not isinstance(value, str) or _MODEL_TOOL_CALL_ID.fullmatch(value) is None:
            raise ValueError("tool_call_id_invalid")
        return value

    @field_validator("arguments", "required_for")
    @classmethod
    def reject_blank_nested_values(cls, value: Any) -> Any:
        return _reject_blank_nested(value)

    @field_validator("required_for")
    @classmethod
    def require_findings(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        if not value:
            raise ValueError("required_for_must_not_be_empty")
        return value


class ApprovedToolCall(_FrozenToolContract):
    request_id: str
    case_id: str
    decree_id: str
    agent_id: str
    skill_id: str
    skill_version: str
    policy_id: str
    policy_version: str
    tool_call_id: str
    tool_name: ToolName
    purpose: str
    arguments: dict[str, Any]
    required_for: tuple[str, ...]
    expected_result_schema: str
    normalized_arguments: dict[str, Any]
    argument_fingerprint: str
    policy_fingerprint: str
    descriptor_fingerprint: str
    descriptor_version: str
    descriptor_handler_id: str
    approval_status: ToolCallStatus
    audit_ref: str
    _audit_issuance: object | None = PrivateAttr(default=None)

    _text = field_validator(
        "request_id", "case_id", "decree_id", "agent_id", "skill_id", "policy_id",
        "tool_call_id", "purpose", "expected_result_schema", "argument_fingerprint",
        "audit_ref", "policy_fingerprint", "descriptor_fingerprint",
        "descriptor_handler_id",
    )(_require_nonblank)

    @field_validator("audit_ref")
    @classmethod
    def require_server_audit_ref(cls, value: str) -> str:
        if _AUDIT_REF.fullmatch(value) is None:
            raise ValueError("audit_ref_invalid")
        return value
    _versions = field_validator("skill_version", "policy_version", "descriptor_version")(
        _require_semantic_version
    )

    @field_validator("arguments", "required_for", "normalized_arguments")
    @classmethod
    def reject_blank_nested_values(cls, value: Any) -> Any:
        return _reject_blank_nested(value)

    @field_validator("approval_status")
    @classmethod
    def require_approved_state(cls, value: ToolCallStatus) -> ToolCallStatus:
        if value is not ToolCallStatus.APPROVED:
            raise ValueError("approved_call_requires_approved_state")
        return value

    @property
    def call_history_entry(self) -> str:
        return f"call:{self.tool_call_id}"

    @property
    def fingerprint_history_entry(self) -> str:
        return f"fingerprint:{self.argument_fingerprint}"


class ToolBudget(_FrozenToolContract):
    max_calls: int = Field(gt=0, le=4)
    consumed_calls: int = Field(ge=0)
    max_rounds: int = Field(gt=0, le=2)
    consumed_rounds: int = Field(ge=0)
    max_rows: int = Field(gt=0)
    consumed_rows: int = Field(ge=0)
    max_bytes: int = Field(gt=0)
    consumed_bytes: int = Field(ge=0)

    @model_validator(mode="after")
    def reject_overconsumption(self) -> ToolBudget:
        if (
            self.consumed_calls > self.max_calls
            or self.consumed_rounds > self.max_rounds
            or self.consumed_rows > self.max_rows
            or self.consumed_bytes > self.max_bytes
        ):
            raise ValueError("budget_consumption_exceeds_maximum")
        return self


class ToolAuthorizationContext(_FrozenToolContract):
    request_id: str
    case_id: str
    decree_id: str
    agent_id: str
    skill_id: str
    skill_version: str
    policy_id: str
    policy_version: str
    approved_input_refs: tuple[str, ...]
    approved_evidence_refs: tuple[str, ...]
    approved_data_refs: tuple[str, ...]
    business_state: str
    system_max_calls: int = Field(gt=0, le=4)
    system_max_rounds: int = Field(gt=0, le=2)
    system_max_result_rows: int = Field(gt=0)
    system_max_result_bytes: int = Field(gt=0)

    _text = field_validator(
        "request_id", "case_id", "decree_id", "agent_id", "skill_id", "policy_id",
        "business_state",
    )(_require_nonblank)
    _versions = field_validator("skill_version", "policy_version")(
        _require_semantic_version
    )

    @field_validator(
        "approved_input_refs", "approved_evidence_refs", "approved_data_refs"
    )
    @classmethod
    def reject_blank_refs(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        return _reject_blank_nested(value)


class ToolHandlerContext(_FrozenToolContract):
    approved_call: ApprovedToolCall
    capability_id: str
    resolved_approved_inputs: dict[str, Any]
    restricted_adapters: dict[str, str]
    budget: ToolBudget

    _capability = field_validator("capability_id")(_require_nonblank)

    @field_validator("resolved_approved_inputs", "restricted_adapters")
    @classmethod
    def reject_blank_nested_values(cls, value: Any) -> Any:
        return _reject_blank_nested(value)


class ToolResultEnvelope(_FrozenToolContract):
    tool_call_id: str
    status: ToolCallStatus
    tool_name: ToolName
    result_schema: str
    data: Any = None
    approved_input_refs: tuple[str, ...] = ()
    evidence_refs: tuple[str, ...] = ()
    approved_data_refs: tuple[str, ...] = ()
    as_of: datetime | None = None
    data_quality: ToolDataQuality
    limitations: tuple[str, ...] = ()
    audit_ref: str
    algorithm_id: str | None = None
    algorithm_version: str | None = None
    truncated_rows: int | None = Field(default=None, ge=0)
    truncated_bytes: int | None = Field(default=None, ge=0)
    original_records: int | None = Field(default=None, ge=0)
    returned_records: int | None = Field(default=None, ge=0)

    _text = field_validator("tool_call_id", "result_schema", "audit_ref")(
        _require_nonblank
    )

    @field_validator("data")
    @classmethod
    def reject_invalid_nested_data(cls, value: Any) -> Any:
        if value is not None:
            _reject_blank_nested(value)
        return value

    @field_validator(
        "approved_input_refs", "evidence_refs", "approved_data_refs", "limitations"
    )
    @classmethod
    def reject_blank_refs(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        return _reject_blank_nested(value)

    @field_validator("algorithm_id")
    @classmethod
    def reject_blank_algorithm(cls, value: str | None) -> str | None:
        return _require_nonblank(value) if value is not None else None

    @field_validator("algorithm_version")
    @classmethod
    def validate_algorithm_version(cls, value: str | None) -> str | None:
        return _require_semantic_version(value) if value is not None else None

    @model_validator(mode="after")
    def validate_result_state(self) -> ToolResultEnvelope:
        successful = {ToolCallStatus.SUCCEEDED, ToolCallStatus.TRUNCATED}
        terminal_without_data = {
            ToolCallStatus.DENIED, ToolCallStatus.INVALID,
            ToolCallStatus.BUDGET_EXCEEDED, ToolCallStatus.BLOCKED,
            ToolCallStatus.FAILED, ToolCallStatus.EMPTY,
        }
        if self.status in successful and not (
            self.approved_input_refs or self.evidence_refs or self.approved_data_refs
        ):
            raise ValueError("successful_result_requires_approved_refs")
        if self.status in terminal_without_data and self.data is not None:
            raise ValueError("terminal_error_result_cannot_carry_data")
        if self.tool_name is ToolName.COMPUTE_ANALYSIS and self.status in successful:
            if self.algorithm_id is None or self.algorithm_version is None:
                raise ValueError("calculated_result_requires_algorithm_identity")
        if self.status is ToolCallStatus.TRUNCATED and (
            self.truncated_rows is None and self.truncated_bytes is None
        ):
            raise ValueError("truncated_result_requires_metadata")
        if self.status is ToolCallStatus.TRUNCATED and (
            self.original_records is None
            or self.returned_records is None
            or self.returned_records >= self.original_records
        ):
            raise ValueError("truncated_result_requires_record_counts")
        return self


class ToolAuditRecord(_FrozenToolContract):
    audit_ref: str = Field(default_factory=_mint_tool_audit_ref)
    tool_call_id: str
    request_id: str
    case_id: str
    decree_id: str
    agent_id: str
    skill_id: str
    skill_version: str
    policy_id: str
    policy_version: str
    tool_name: ToolName
    argument_hash: str
    redacted_argument_summary: str
    status: ToolCallStatus
    reason_code: str
    input_refs: tuple[str, ...]
    output_refs: tuple[str, ...]
    result_rows: int = Field(ge=0)
    result_bytes: int = Field(ge=0)
    max_calls: int = Field(gt=0, le=4)
    consumed_calls: int = Field(ge=0)
    max_rounds: int = Field(gt=0, le=2)
    consumed_rounds: int = Field(ge=0)
    max_rows: int = Field(gt=0)
    consumed_rows: int = Field(ge=0)
    max_bytes: int = Field(gt=0)
    consumed_bytes: int = Field(ge=0)
    retry_source: str | None = None
    duration_ms: int = Field(ge=0)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    _text = field_validator(
        "audit_ref", "tool_call_id", "request_id", "case_id", "decree_id", "agent_id", "skill_id",
        "policy_id",
        "argument_hash", "redacted_argument_summary", "reason_code",
    )(_require_nonblank)

    @field_validator("audit_ref")
    @classmethod
    def require_server_audit_ref(cls, value: str) -> str:
        if _AUDIT_REF.fullmatch(value) is None:
            raise ValueError("audit_ref_invalid")
        return value
    _versions = field_validator("skill_version", "policy_version")(
        _require_semantic_version
    )

    @field_validator("input_refs", "output_refs")
    @classmethod
    def reject_blank_refs(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        return _reject_blank_nested(value)

    @field_validator("retry_source")
    @classmethod
    def reject_blank_retry_source(cls, value: str | None) -> str | None:
        return _require_nonblank(value) if value is not None else None

    @model_validator(mode="after")
    def reject_overconsumed_budget(self) -> ToolAuditRecord:
        if (
            self.consumed_calls > self.max_calls
            or self.consumed_rounds > self.max_rounds
            or self.consumed_rows > self.max_rows
            or self.consumed_bytes > self.max_bytes
        ):
            raise ValueError("audit_budget_consumption_exceeds_maximum")
        return self
