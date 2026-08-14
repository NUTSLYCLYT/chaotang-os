"""Closed, owner-scoped decision exchange for the Six Ministry evidence spine.

The public request deliberately carries no identity, routing, skill, trust, or
permission fields.  Those values are reloaded from CurrentUser, DecreeJob, the
authoritative RuntimeSkill registry, and owner-scoped evidence stores inside
``resolve_six_ministry_decision``.  The service is analytical only: every
result explicitly carries a zero-side-effect contract.
"""

from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Mapping
from datetime import UTC, datetime
from enum import Enum, StrEnum
from pathlib import Path
from typing import Any, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictBool,
    StrictInt,
    StrictStr,
    field_validator,
    model_validator,
)

from app.accounting_reports.storage import (
    ArtifactNotFound,
    ArtifactStorage,
    ArtifactStorageError,
)
from app.agents.runtime_skills.accounting_evidence_adapter import (
    AccountingEvidenceResolutionError,
    execute_accounting_evidence_gate,
)
from app.agents.runtime_skills.evidence_spine import (
    EvidenceSpineError,
    EvidenceSpineErrorCode,
    RunLocatorV1,
    load_bound_decree_authority,
)
from app.agents.runtime_skills.execution_ledger import (
    ExecutionLedgerError,
    ExecutionScopeBinding,
    ResourceBindingConflict,
    ResourceKind,
    RuntimeBindingLedger,
    RuntimeResourceBinding,
)
from app.agents.runtime_skills.models import (
    AgentLayer,
    CouncilReport,
    MinistryReport,
    ReportStatus,
    RuntimeSkillDefinition,
    SkillInvocation,
)
from app.agents.runtime_skills.registry import (
    DownstreamSkillRegistryError,
    build_default_downstream_skill_registry,
    bureau_agent_id,
    runtime_skill_definition_digest,
)
from app.auth.models import AuthenticatedUser
from app.decree_jobs.storage import DecreeJobStore
from app.jinyiwei import storage as jinyiwei_storage
from app.jinyiwei.freshness import is_evidence_fresh
from app.jinyiwei.models import EvidencePackStatus, EvidenceQuality, EvidenceStance
from app.jinyiwei.read_models import AdoptionStatus, InvestigationDetail
from app.junjichu_cases import (
    JunjichuRuntimeReportError,
    JunjichuRuntimeReportSnapshot,
    get_runtime_report_snapshot,
)
from app.shiguan import storage as shiguan_storage
from app.shiguan.errors import ArchiveNotFoundError, ShiguanStorageError
from app.shiguan.models import Archive
from app.work_products import (
    ConfirmationReceipt,
    ConfirmationStatus,
    WorkProductEnvelope,
)

_OPAQUE_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$")
_SHA256 = re.compile(r"^sha256:[0-9a-f]{64}$")


class _FrozenContract(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


def _identifier(value: str) -> str:
    if _OPAQUE_ID.fullmatch(value) is None:
        raise ValueError("invalid_opaque_identifier")
    return value


def _text(value: str, *, maximum: int = 4096) -> str:
    normalized = " ".join(value.split())
    if not normalized or len(normalized) > maximum:
        raise ValueError("invalid_text")
    return normalized


def _canonical_value(value: object) -> object:
    if isinstance(value, BaseModel):
        return _canonical_value(value.model_dump(mode="python"))
    if isinstance(value, Mapping):
        return {
            str(key): _canonical_value(item)
            for key, item in sorted(value.items(), key=lambda pair: str(pair[0]))
        }
    if isinstance(value, (set, frozenset)):
        return sorted((_canonical_value(item) for item in value), key=repr)
    if isinstance(value, (list, tuple)):
        return [_canonical_value(item) for item in value]
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, datetime):
        return value.astimezone(UTC).isoformat()
    if isinstance(value, type):
        return f"{value.__module__}.{value.__qualname__}"
    return value


def _canonical_json(value: object) -> str:
    return json.dumps(
        _canonical_value(value),
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def _digest(value: object) -> str:
    return hashlib.sha256(_canonical_json(value).encode("utf-8")).hexdigest()


def _prefixed_digest(value: object) -> str:
    return f"sha256:{_digest(value)}"


class MaterialKind(StrEnum):
    ACCOUNTING_EVALUATION = "accounting_evaluation"
    EVIDENCE_PACK = "evidence_pack"
    WORK_PRODUCT = "work_product"
    DECREE_ATTACHMENT = "decree_attachment"
    APPROVED_MATERIAL = "approved_material"


class MaterialRefV1(_FrozenContract):
    kind: MaterialKind
    opaque_id: StrictStr
    expected_digest: StrictStr | None = Field(
        default=None, pattern=r"^sha256:[0-9a-f]{64}$"
    )
    version: StrictInt | None = Field(default=None, ge=1)

    @field_validator("opaque_id")
    @classmethod
    def _opaque_id(cls, value: str) -> str:
        return _identifier(value)

    @model_validator(mode="after")
    def _requires_content_or_version_binding(self) -> MaterialRefV1:
        if self.expected_digest is None and self.version is None:
            raise ValueError("material_binding_required")
        return self


class RequestConstraintsV1(_FrozenContract):
    as_of: datetime | None
    output_language: Literal["zh-CN", "en-US"]

    @field_validator("as_of")
    @classmethod
    def _aware_time(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.utcoffset() is None:
            raise ValueError("timestamp_requires_timezone")
        return value


class DecisionRequestV1(_FrozenContract):
    schema_version: Literal["1.0.0"] = "1.0.0"
    message_type: Literal["decision_request"] = "decision_request"
    request_id: StrictStr
    objective: StrictStr = Field(max_length=4096)
    material_refs: tuple[MaterialRefV1, ...] = Field(min_length=1, max_length=64)
    constraints: RequestConstraintsV1

    @field_validator("request_id")
    @classmethod
    def _request_id(cls, value: str) -> str:
        return _identifier(value)

    @field_validator("objective")
    @classmethod
    def _objective(cls, value: str) -> str:
        return _text(value)

    @field_validator("material_refs")
    @classmethod
    def _unique_materials(
        cls, value: tuple[MaterialRefV1, ...]
    ) -> tuple[MaterialRefV1, ...]:
        keys = tuple((item.kind, item.opaque_id) for item in value)
        if len(set(keys)) != len(keys):
            raise ValueError("duplicate_material_ref")
        return value


class DecisionErrorCode(StrEnum):
    INVALID_REQUEST = "INVALID_REQUEST"
    IDENTITY_UNAVAILABLE = "IDENTITY_UNAVAILABLE"
    OWNER_SCOPE_MISMATCH = "OWNER_SCOPE_MISMATCH"
    ROUTE_UNAPPROVED = "ROUTE_UNAPPROVED"
    RUNTIME_SKILL_UNAVAILABLE = "RUNTIME_SKILL_UNAVAILABLE"
    MATERIAL_NOT_FOUND = "MATERIAL_NOT_FOUND"
    MATERIAL_BINDING_MISMATCH = "MATERIAL_BINDING_MISMATCH"
    EVIDENCE_UNAVAILABLE = "EVIDENCE_UNAVAILABLE"
    EVIDENCE_INCOMPLETE = "EVIDENCE_INCOMPLETE"
    EVIDENCE_CONFLICT = "EVIDENCE_CONFLICT"
    EVIDENCE_STALE = "EVIDENCE_STALE"
    AUTHORITY_UNAVAILABLE = "AUTHORITY_UNAVAILABLE"
    AUTHORITY_DENIED = "AUTHORITY_DENIED"
    JOINT_REVIEW_REQUIRED = "JOINT_REVIEW_REQUIRED"
    AUDIT_WRITE_FAILED = "AUDIT_WRITE_FAILED"
    INTERNAL_ERROR = "INTERNAL_ERROR"


class SixMinistryEvidenceServiceError(RuntimeError):
    """Sanitized boundary exception for identity/material lookup failures."""

    def __init__(self, code: DecisionErrorCode) -> None:
        self.code = code
        super().__init__(code.value)


def _utc_now() -> datetime:
    """Server-owned clock seam; requests must never choose freshness time."""

    return datetime.now(UTC)


class ScopeV1(_FrozenContract):
    scope_mode: Literal["owner_only"] = "owner_only"
    tenant_id: Literal[None] = None


class IdentityV1(_FrozenContract):
    owner_user_id: StrictStr
    run_id: StrictStr
    case_id: StrictStr | None
    decree_id: StrictStr
    assembled_at: datetime

    @field_validator("owner_user_id", "run_id", "decree_id")
    @classmethod
    def _identifiers(cls, value: str) -> str:
        return _identifier(value)

    @field_validator("case_id")
    @classmethod
    def _optional_identifier(cls, value: str | None) -> str | None:
        return None if value is None else _identifier(value)

    @field_validator("assembled_at")
    @classmethod
    def _assembled_time(cls, value: datetime) -> datetime:
        if value.utcoffset() is None:
            raise ValueError("timestamp_requires_timezone")
        return value


class JointReviewV1(_FrozenContract):
    required: StrictBool
    status: Literal["not_required", "pending", "completed", "failed"]
    reviewer: Literal["none", "junjichu"]
    receipt_ref: StrictStr | None

    @field_validator("receipt_ref")
    @classmethod
    def _receipt_ref(cls, value: str | None) -> str | None:
        return None if value is None else _identifier(value)

    @model_validator(mode="after")
    def _state_is_consistent(self) -> JointReviewV1:
        if not self.required:
            if (
                self.status != "not_required"
                or self.reviewer != "none"
                or self.receipt_ref is not None
            ):
                raise ValueError("joint_review_state_invalid")
        elif self.reviewer != "junjichu" or self.status == "not_required":
            raise ValueError("joint_review_state_invalid")
        if self.status == "completed" and self.receipt_ref is None:
            raise ValueError("completed_joint_review_requires_receipt")
        return self


class RoutingV1(_FrozenContract):
    route_mode: Literal["single", "multi"]
    route_authority_source: Literal["DecreeJob"] = "DecreeJob"
    capability_id: StrictStr
    accountable_ministry: Literal["libu", "hubu", "rites", "bingbu", "xingbu", "gongbu"]
    participating_ministries: tuple[
        Literal["libu", "hubu", "rites", "bingbu", "xingbu", "gongbu"], ...
    ] = Field(min_length=1, max_length=6)
    joint_review: JointReviewV1

    @field_validator("capability_id")
    @classmethod
    def _capability(cls, value: str) -> str:
        return _identifier(value)

    @field_validator("participating_ministries")
    @classmethod
    def _unique_ministries(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        if len(set(value)) != len(value):
            raise ValueError("duplicate_ministry")
        return value

    @model_validator(mode="after")
    def _route_shape(self) -> RoutingV1:
        if self.route_mode == "single":
            if len(self.participating_ministries) != 1 or self.joint_review.required:
                raise ValueError("single_route_shape_invalid")
        elif len(self.participating_ministries) < 2 or not self.joint_review.required:
            raise ValueError("multi_route_shape_invalid")
        return self


class RuntimeBindingV1(_FrozenContract):
    skill_id: StrictStr
    definition_version: StrictStr
    definition_digest: StrictStr = Field(pattern=r"^sha256:[0-9a-f]{64}$")
    registry_source: Literal["backend/app/agents/runtime_skills/registry.py"] = (
        "backend/app/agents/runtime_skills/registry.py"
    )

    @field_validator("skill_id")
    @classmethod
    def _skill_id(cls, value: str) -> str:
        return _identifier(value)


class EvidenceSummaryV1(_FrozenContract):
    status: Literal["resolved", "partial", "blocked", "unavailable"]
    projection_mode: Literal[
        "accounting_grounding",
        "citation_draft",
        "evidence_integrity",
        "joint_review",
        "authority_source_unavailable",
    ]
    snapshot_ref: StrictStr | None
    freshness: Literal["current", "stale", "unknown"]
    required_fact_count: StrictInt = Field(ge=0, le=4096)
    resolved_fact_count: StrictInt = Field(ge=0, le=4096)

    @field_validator("snapshot_ref")
    @classmethod
    def _snapshot_ref(cls, value: str | None) -> str | None:
        return None if value is None else _identifier(value)


class AuthoritySummaryV1(_FrozenContract):
    status: Literal["allowed", "denied", "unavailable"]
    analysis_allowed: StrictBool
    projection_ref: StrictStr | None
    binding_digest: StrictStr | None = Field(
        default=None, pattern=r"^sha256:[0-9a-f]{64}$"
    )
    sources: tuple[
        Literal["CurrentUser", "DecreeJob", "RuntimeSkill", "JunjichuCase"], ...
    ] = Field(min_length=1, max_length=4)

    @field_validator("projection_ref")
    @classmethod
    def _projection_ref(cls, value: str | None) -> str | None:
        return None if value is None else _identifier(value)


class FactV1(_FrozenContract):
    fact_key: StrictStr
    value: StrictStr | StrictInt | float | StrictBool | None
    unit: StrictStr | None
    as_of: datetime | None
    evidence_ref_ids: tuple[StrictStr, ...] = Field(max_length=128)


class FindingV1(_FrozenContract):
    finding_id: StrictStr
    statement: StrictStr = Field(min_length=1, max_length=4096)
    severity: Literal["info", "warning", "critical"]
    evidence_ref_ids: tuple[StrictStr, ...] = Field(max_length=128)

    @field_validator("finding_id")
    @classmethod
    def _finding_id(cls, value: str) -> str:
        return _identifier(value)


class RiskV1(_FrozenContract):
    risk_id: StrictStr
    statement: StrictStr = Field(min_length=1, max_length=4096)
    severity: Literal["low", "medium", "high", "critical"]
    evidence_ref_ids: tuple[StrictStr, ...] = Field(max_length=128)


class ConflictV1(_FrozenContract):
    conflict_id: StrictStr
    statement: StrictStr = Field(min_length=1, max_length=4096)
    evidence_ref_ids: tuple[StrictStr, ...] = Field(max_length=128)


class MissingEvidenceV1(_FrozenContract):
    requirement_id: StrictStr
    reason_code: Literal[
        "source_unavailable",
        "material_not_found",
        "binding_mismatch",
        "incomplete",
        "conflict",
        "stale",
    ]
    required: StrictBool

    @field_validator("requirement_id")
    @classmethod
    def _requirement_id(cls, value: str) -> str:
        return _identifier(value)


class NextActionV1(_FrozenContract):
    action_id: StrictStr
    instruction: StrictStr = Field(min_length=1, max_length=4096)
    owner_role: Literal[
        "requester",
        "accountable_ministry",
        "responsible_bureau",
        "junjichu",
        "system_operator",
    ]
    action_class: Literal[
        "obtain_evidence",
        "human_review",
        "revise_request",
        "retry_read_only",
        "no_external_effect",
    ]


class ArtifactRefV1(_FrozenContract):
    artifact_id: StrictStr
    artifact_type: Literal["decision_report", "work_product_preview", "citation_draft"]
    digest: StrictStr = Field(pattern=r"^sha256:[0-9a-f]{64}$")
    version: StrictInt = Field(ge=1)


class DecisionV1(_FrozenContract):
    status: Literal["completed", "degraded", "failed"]
    action_disposition: Literal["preview", "hold", "block"]
    summary: StrictStr = Field(min_length=1, max_length=4096)
    facts: tuple[FactV1, ...] = Field(max_length=512)
    findings: tuple[FindingV1, ...] = Field(max_length=256)
    risks: tuple[RiskV1, ...] = Field(max_length=256)
    conflicts: tuple[ConflictV1, ...] = Field(max_length=256)
    missing_evidence: tuple[MissingEvidenceV1, ...] = Field(max_length=256)
    next_actions: tuple[NextActionV1, ...] = Field(max_length=64)
    artifact_refs: tuple[ArtifactRefV1, ...] = Field(max_length=64)


class EvidenceRefV1(_FrozenContract):
    ref_id: StrictStr
    source_type: Literal[
        "accounting_evaluation", "EvidencePack", "WorkProduct", "approved_material"
    ]
    source_ref: StrictStr
    digest: StrictStr = Field(pattern=r"^sha256:[0-9a-f]{64}$")
    as_of: datetime | None
    adoption_status: Literal["adopted", "supporting", "rejected"]


class AuditRefV1(_FrozenContract):
    ref_id: StrictStr
    event_type: Literal[
        "identity_assembly",
        "route_resolution",
        "runtime_binding",
        "evidence_resolution",
        "authority_decision",
        "decision_emission",
    ]
    digest: StrictStr = Field(pattern=r"^sha256:[0-9a-f]{64}$")


class DecisionErrorV1(_FrozenContract):
    code: DecisionErrorCode
    phase: Literal[
        "request",
        "identity",
        "routing",
        "runtime",
        "evidence",
        "authority",
        "decision",
        "audit",
    ]
    retryable: StrictBool


class ExternalEffectsV1(_FrozenContract):
    authorized: Literal[False] = False
    mode: Literal["none"] = "none"
    effect_count: Literal[0] = 0


class DecisionEnvelopeV1(_FrozenContract):
    schema_version: Literal["1.0.0"] = "1.0.0"
    message_type: Literal["decision_envelope"] = "decision_envelope"
    request_id: StrictStr
    decision_id: StrictStr
    scope: ScopeV1
    identity: IdentityV1
    routing: RoutingV1
    runtime_binding: RuntimeBindingV1
    evidence: EvidenceSummaryV1
    authority: AuthoritySummaryV1
    decision: DecisionV1
    evidence_refs: tuple[EvidenceRefV1, ...] = Field(max_length=512)
    audit_refs: tuple[AuditRefV1, ...] = Field(max_length=128)
    errors: tuple[DecisionErrorV1, ...] = Field(max_length=64)
    external_effects: ExternalEffectsV1 = ExternalEffectsV1()

    @model_validator(mode="after")
    def _status_invariants(self) -> DecisionEnvelopeV1:
        if self.decision.status == "completed":
            if (
                self.decision.action_disposition != "preview"
                or self.decision.missing_evidence
                or self.evidence.status != "resolved"
                or self.authority.status != "allowed"
                or not self.authority.analysis_allowed
                or self.errors
            ):
                raise ValueError("completed_envelope_invariant_failed")
            if self.routing.route_mode == "multi" and (
                self.routing.joint_review.status != "completed"
                or self.routing.joint_review.receipt_ref is None
            ):
                raise ValueError("completed_multi_requires_council_receipt")
        elif self.decision.status == "degraded":
            if self.decision.action_disposition not in {"hold", "block"} or not self.errors:
                raise ValueError("degraded_envelope_invariant_failed")
        elif self.decision.action_disposition != "block" or not self.errors:
            raise ValueError("failed_envelope_invariant_failed")
        return self


_MINISTRY_IDS = {
    "吏部": "libu",
    "户部": "hubu",
    "礼部": "rites",
    "兵部": "bingbu",
    "刑部": "xingbu",
    "工部": "gongbu",
}

_MISSING_AUTHORITY_REQUIREMENTS = {
    "libu": "personnel_authority_source",
    "hubu": "accounting_work_product_source",
    "bingbu": "commercial_authority_source",
    "gongbu": "delivery_authority_source",
    "xingbu": "legal_authority_source",
    "rites": "communication_work_product_source",
}


def _pack_projection(detail: InvestigationDetail) -> dict[str, object]:
    # Adoption rows are mutable reply-side acknowledgements and are not part of
    # the immutable EvidencePack content identity.
    projection = detail.model_dump(mode="python")
    projection.pop("adoptions", None)
    return projection


def _pack_digest(detail: InvestigationDetail) -> str:
    return _digest(_pack_projection(detail))


def _ledger_scope(
    bound_scope: Any, *, case_id: str | None = None
) -> ExecutionScopeBinding:
    return ExecutionScopeBinding(
        scope_mode="owner_only",
        tenant_id=None,
        owner_user_id=bound_scope.owner_user_id,
        run_id=bound_scope.run_id,
        decree_id=bound_scope.decree_id,
        case_id=case_id if case_id is not None else bound_scope.case_id,
        draft_fingerprint=bound_scope.draft_fingerprint,
        route_digest=bound_scope.route_digest,
    )


def _append_or_reload(
    ledger: RuntimeBindingLedger,
    binding: RuntimeResourceBinding,
) -> RuntimeResourceBinding:
    try:
        existing = ledger.get_for_execution(
            binding.binding_id,
            owner_user_id=binding.scope.owner_user_id,
            run_id=binding.scope.run_id,
        )
    except ExecutionLedgerError as exc:
        if str(exc) != "record_not_found_or_not_authorized":
            raise
    else:
        if (
            existing.resource_kind != binding.resource_kind
            or existing.resource_ref != binding.resource_ref
            or existing.resource_version != binding.resource_version
            or existing.content_digest != binding.content_digest
            or existing.scope != binding.scope
            or existing.parent_binding_ids != binding.parent_binding_ids
        ):
            raise ResourceBindingConflict("runtime_binding_conflict")
        return existing
    try:
        return ledger.append(binding)
    except ResourceBindingConflict:
        # A concurrent writer may have won after the read.  Reload and compare
        # through the same owner/run scope before accepting it.
        existing = ledger.get_for_execution(
            binding.binding_id,
            owner_user_id=binding.scope.owner_user_id,
            run_id=binding.scope.run_id,
        )
        if (
            existing.resource_kind != binding.resource_kind
            or existing.resource_ref != binding.resource_ref
            or existing.resource_version != binding.resource_version
            or existing.content_digest != binding.content_digest
            or existing.scope != binding.scope
            or existing.parent_binding_ids != binding.parent_binding_ids
        ):
            raise
        return existing


def _evidence_refs(
    details: tuple[InvestigationDetail, ...],
    *,
    adopted_only: bool,
    now: datetime,
    server_now: datetime,
    requested_as_of: datetime | None,
) -> tuple[EvidenceRefV1, ...]:
    result: dict[str, EvidenceRefV1] = {}
    for detail in details:
        if detail.status is not EvidencePackStatus.RESOLVED or detail.do_not_infer:
            continue
        resolved_facts = set(detail.resolved_facts)
        unresolved_facts = set(detail.unresolved_facts)
        confirmed = {
            adoption.evidence_id
            for adoption in detail.adoptions
            if adoption.status is AdoptionStatus.CONFIRMED
        }
        for fact_key in sorted(detail.evidence_by_fact):
            if fact_key not in resolved_facts or fact_key in unresolved_facts:
                continue
            for item in detail.evidence_by_fact[fact_key]:
                if (
                    item.quality is EvidenceQuality.UNVERIFIED
                    or item.stance is not EvidenceStance.SUPPORTS
                ):
                    continue
                is_adopted = item.evidence_id in confirmed
                if adopted_only and not is_adopted:
                    continue
                if not _evidence_time_not_future_to_server(
                    item.as_of, item.retrieved_at, server_now=server_now
                ) or not _evidence_time_within_requested_cutoff(
                    item.as_of,
                    item.retrieved_at,
                    requested_as_of=requested_as_of,
                ) or not is_evidence_fresh(
                    as_of=item.as_of,
                    retrieved_at=item.retrieved_at,
                    request=detail.request,
                    fact_key=fact_key,
                    source_type=item.source_type,
                    now=now,
                ):
                    continue
                candidate = EvidenceRefV1(
                    ref_id=item.evidence_id,
                    source_type="EvidencePack",
                    source_ref=detail.pack_id,
                    digest=f"sha256:{item.content_hash}",
                    as_of=datetime.fromisoformat(item.as_of.replace("Z", "+00:00")),
                    adoption_status="adopted" if is_adopted else "supporting",
                )
                previous = result.get(candidate.ref_id)
                if previous is not None and previous != candidate:
                    raise SixMinistryEvidenceServiceError(
                        DecisionErrorCode.MATERIAL_BINDING_MISMATCH
                    )
                result[candidate.ref_id] = candidate
    return tuple(result[key] for key in sorted(result))


def _required_and_resolved_counts(
    details: tuple[InvestigationDetail, ...],
    *,
    adopted_only: bool,
    now: datetime,
    server_now: datetime,
    requested_as_of: datetime | None,
) -> tuple[int, int, tuple[str, ...], tuple[str, ...]]:
    required_count = 0
    resolved_count = 0
    missing: list[str] = []
    stale: list[str] = []
    for detail in details:
        pack_resolved = (
            detail.status is EvidencePackStatus.RESOLVED
            and not detail.do_not_infer
        )
        resolved_facts = set(detail.resolved_facts)
        unresolved_facts = set(detail.unresolved_facts)
        confirmed = {
            adoption.evidence_id
            for adoption in detail.adoptions
            if adoption.status is AdoptionStatus.CONFIRMED
        }
        for fact in detail.request.required_facts:
            required_count += 1
            current = detail.evidence_by_fact.get(fact.key, ())
            adopted = (
                tuple(item for item in current if item.evidence_id in confirmed)
                if adopted_only
                else tuple(current)
            )
            protocol_accepted = tuple(
                item
                for item in adopted
                if pack_resolved
                and fact.key in resolved_facts
                and fact.key not in unresolved_facts
                and item.quality is not EvidenceQuality.UNVERIFIED
                and item.stance is EvidenceStance.SUPPORTS
            )
            usable = tuple(
                item
                for item in protocol_accepted
                if _evidence_time_not_future_to_server(
                    item.as_of, item.retrieved_at, server_now=server_now
                )
                and _evidence_time_within_requested_cutoff(
                    item.as_of,
                    item.retrieved_at,
                    requested_as_of=requested_as_of,
                )
                and is_evidence_fresh(
                    as_of=item.as_of,
                    retrieved_at=item.retrieved_at,
                    request=detail.request,
                    fact_key=fact.key,
                    source_type=item.source_type,
                    now=now,
                )
            )
            if usable:
                resolved_count += 1
            elif protocol_accepted:
                stale.append(fact.key)
            else:
                missing.append(fact.key)
    return (
        required_count,
        resolved_count,
        tuple(dict.fromkeys(missing)),
        tuple(dict.fromkeys(stale)),
    )


def _evidence_time_not_future_to_server(
    as_of: str, retrieved_at: str, *, server_now: datetime
) -> bool:
    try:
        observed = datetime.fromisoformat(as_of.replace("Z", "+00:00"))
        retrieved = datetime.fromisoformat(retrieved_at.replace("Z", "+00:00"))
    except ValueError:
        return False
    if observed.utcoffset() is None or retrieved.utcoffset() is None:
        return False
    current = server_now.astimezone(UTC)
    return observed.astimezone(UTC) <= current and retrieved.astimezone(UTC) <= current


def _evidence_time_within_requested_cutoff(
    as_of: str,
    retrieved_at: str,
    *,
    requested_as_of: datetime | None,
) -> bool:
    if requested_as_of is None:
        return True
    try:
        observed = datetime.fromisoformat(as_of.replace("Z", "+00:00"))
        retrieved = datetime.fromisoformat(retrieved_at.replace("Z", "+00:00"))
    except ValueError:
        return False
    if (
        observed.utcoffset() is None
        or retrieved.utcoffset() is None
        or requested_as_of.utcoffset() is None
    ):
        return False
    cutoff = requested_as_of.astimezone(UTC)
    return observed.astimezone(UTC) <= cutoff and retrieved.astimezone(UTC) <= cutoff


def _load_materials(
    request: DecisionRequestV1,
    *,
    owner_user_id: str,
    db_path: Path,
) -> tuple[tuple[InvestigationDetail, ...], tuple[str, ...]]:
    details: list[InvestigationDetail] = []
    digests: list[str] = []
    for locator in request.material_refs:
        if locator.kind is not MaterialKind.EVIDENCE_PACK:
            raise SixMinistryEvidenceServiceError(DecisionErrorCode.EVIDENCE_UNAVAILABLE)
        try:
            detail = jinyiwei_storage.get_investigation_detail(
                locator.opaque_id,
                owner_user_id=owner_user_id,
                db_path=db_path,
            )
        except jinyiwei_storage.InvestigationNotFoundError as exc:
            raise SixMinistryEvidenceServiceError(
                DecisionErrorCode.MATERIAL_NOT_FOUND
            ) from exc
        except jinyiwei_storage.JinyiweiStorageError as exc:
            raise SixMinistryEvidenceServiceError(
                DecisionErrorCode.EVIDENCE_UNAVAILABLE
            ) from exc
        digest = _pack_digest(detail)
        if locator.version not in {None, 1} or (
            locator.expected_digest is not None
            and locator.expected_digest != f"sha256:{digest}"
        ):
            raise SixMinistryEvidenceServiceError(
                DecisionErrorCode.MATERIAL_BINDING_MISMATCH
            )
        details.append(detail)
        digests.append(digest)
    return tuple(details), tuple(digests)


def _load_accounting_work_product(
    request: DecisionRequestV1,
    *,
    owner_user_id: str,
    job_id: str,
    skill: RuntimeSkillDefinition,
    decree_job_store: DecreeJobStore,
    artifact_storage: ArtifactStorage | None,
) -> tuple[
    WorkProductEnvelope | None,
    Any | None,
    tuple[ConfirmationReceipt, ...],
]:
    if len(request.material_refs) != 1 or (
        request.material_refs[0].kind is not MaterialKind.WORK_PRODUCT
    ):
        raise SixMinistryEvidenceServiceError(
            DecisionErrorCode.MATERIAL_BINDING_MISMATCH
        )
    if artifact_storage is None:
        return None, None, ()
    locator = request.material_refs[0]
    try:
        product = artifact_storage.get_work_product(
            owner_user_id, locator.opaque_id
        )
    except (ArtifactNotFound, ArtifactStorageError, OSError, ValueError) as exc:
        raise SixMinistryEvidenceServiceError(
            DecisionErrorCode.MATERIAL_NOT_FOUND
        ) from exc
    if locator.version not in {None, product.version} or (
        locator.expected_digest is not None
        and locator.expected_digest != f"sha256:{product.content_digest}"
    ):
        raise SixMinistryEvidenceServiceError(
            DecisionErrorCode.MATERIAL_BINDING_MISMATCH
        )
    try:
        receipts = artifact_storage.list_confirmation_receipts(
            owner_user_id,
            product.work_product_id,
        )
    except (ArtifactNotFound, ArtifactStorageError, OSError, ValueError) as exc:
        raise SixMinistryEvidenceServiceError(
            DecisionErrorCode.MATERIAL_BINDING_MISMATCH
        ) from exc
    latest_receipt = receipts[-1] if receipts else None
    if product.confirmation_status is ConfirmationStatus.PENDING:
        confirmation_valid = latest_receipt is None
    else:
        confirmation_valid = (
            latest_receipt is not None
            and latest_receipt.version == product.version
            and latest_receipt.decision is product.confirmation_status
        )
    if not confirmation_valid:
        raise SixMinistryEvidenceServiceError(
            DecisionErrorCode.MATERIAL_BINDING_MISMATCH
        )
    invocation = SkillInvocation(
        request_id=request.request_id,
        agent_id=skill.agent_id,
        skill_id=skill.skill_id,
        skill_version=skill.version,
    )
    try:
        result = execute_accounting_evidence_gate(
            owner_user_id=owner_user_id,
            job_id=job_id,
            work_product_id=product.work_product_id,
            invocation=invocation,
            decree_job_store=decree_job_store,
            artifact_storage=artifact_storage,
        )
    except AccountingEvidenceResolutionError as exc:
        code = (
            DecisionErrorCode.MATERIAL_NOT_FOUND
            if str(exc) == "accounting_evidence_unavailable"
            else DecisionErrorCode.MATERIAL_BINDING_MISMATCH
        )
        raise SixMinistryEvidenceServiceError(code) from exc
    return product, result, receipts


def _decision_error(
    code: DecisionErrorCode,
    *,
    phase: Literal["evidence", "authority", "routing", "audit"],
    retryable: bool,
) -> DecisionErrorV1:
    return DecisionErrorV1(code=code, phase=phase, retryable=retryable)


def _load_verified_council_receipt(
    snapshot: JunjichuRuntimeReportSnapshot,
    *,
    owner_user_id: str,
    decree_text: str,
    departments: tuple[str, ...],
    db_path: Path | None,
) -> Archive | None:
    if snapshot.case_status != "ARCHIVED" or snapshot.receipt_ref is None:
        return None
    if db_path is None:
        return None
    try:
        receipt = shiguan_storage.get_archive(
            snapshot.receipt_ref,
            owner_user_id=owner_user_id,
            db_path=db_path,
        )
    except (ArchiveNotFoundError, ShiguanStorageError):
        return None
    if (
        receipt.id != snapshot.run_id
        or receipt.id != snapshot.decree_id
        or receipt.type != "REPLY"
        or receipt.source_kind != "DECREE"
        or receipt.source_text != decree_text
        or tuple(receipt.participating_departments or ()) != departments
        or receipt.department != departments[0]
        or receipt.respondent != "丞相"
    ):
        return None
    return receipt


def resolve_six_ministry_decision(
    request: DecisionRequestV1,
    *,
    current_user: AuthenticatedUser,
    job_id: str,
    decree_job_store: DecreeJobStore,
    jinyiwei_db_path: Path,
    binding_ledger: RuntimeBindingLedger,
    artifact_storage: ArtifactStorage | None = None,
    case_id: str | None = None,
    junjichu_db_path: Path | None = None,
    shiguan_db_path: Path | None = None,
) -> DecisionEnvelopeV1:
    """Resolve a governed, read-only Six Ministry decision envelope.

    No caller-provided projection can become authority.  Multi-ministry routes
    remain machine-blocked until the owner-scoped Junjichu reports and Shiguan
    receipt reload and satisfy the exact execution binding.
    """

    if not isinstance(request, DecisionRequestV1):
        raise TypeError("request must be DecisionRequestV1")
    if not isinstance(current_user, AuthenticatedUser):
        raise TypeError("current_user must be AuthenticatedUser")
    try:
        owner_user_id = _identifier(current_user.id)
        run_locator = RunLocatorV1(job_id=_identifier(job_id))
    except ValueError as exc:
        raise SixMinistryEvidenceServiceError(
            DecisionErrorCode.IDENTITY_UNAVAILABLE
        ) from exc

    try:
        bound = load_bound_decree_authority(
            decree_job_store,
            authenticated_owner_user_id=owner_user_id,
            run_locator=run_locator,
        )
    except EvidenceSpineError as exc:
        code = {
            EvidenceSpineErrorCode.NOT_FOUND_OR_NOT_AUTHORIZED: (
                DecisionErrorCode.MATERIAL_NOT_FOUND
            ),
            EvidenceSpineErrorCode.AUTHORITY_SNAPSHOT_INVALID: DecisionErrorCode.ROUTE_UNAPPROVED,
            EvidenceSpineErrorCode.CASE_BINDING_UNAVAILABLE: (
                DecisionErrorCode.JOINT_REVIEW_REQUIRED
            ),
        }.get(exc.code, DecisionErrorCode.INTERNAL_ERROR)
        raise SixMinistryEvidenceServiceError(code) from exc

    registry = build_default_downstream_skill_registry()
    departments = bound.route.departments
    participating = tuple(_MINISTRY_IDS[item.department] for item in departments)
    route_mode: Literal["single", "multi"] = "single" if len(departments) == 1 else "multi"
    try:
        if route_mode == "multi":
            skill = registry.get_by_agent("junjichu")
        else:
            primary_route = departments[0]
            if len(primary_route.required_bureaus) != 1:
                # v1 has one exact RuntimeSkill binding.  Silently choosing
                # the first of several approved bureaus would drop authority
                # and evidence obligations, so multi-bureau single routes are
                # closed until a composite binding contract is versioned.
                raise SixMinistryEvidenceServiceError(
                    DecisionErrorCode.ROUTE_UNAPPROVED
                )
            agent_id = bureau_agent_id(
                primary_route.department, primary_route.required_bureaus[0]
            )
            skill = registry.get_by_agent(agent_id)
    except SixMinistryEvidenceServiceError:
        raise
    except (DownstreamSkillRegistryError, IndexError, KeyError) as exc:
        raise SixMinistryEvidenceServiceError(
            DecisionErrorCode.RUNTIME_SKILL_UNAVAILABLE
        ) from exc

    is_hubu_accounting = skill.agent_id == "hubu-accounting"
    accounting_product: WorkProductEnvelope | None = None
    accounting_result: Any | None = None
    accounting_receipts: tuple[ConfirmationReceipt, ...] = ()
    if is_hubu_accounting:
        (
            accounting_product,
            accounting_result,
            accounting_receipts,
        ) = _load_accounting_work_product(
            request,
            owner_user_id=owner_user_id,
            job_id=bound.scope.run_id,
            skill=skill,
            decree_job_store=decree_job_store,
            artifact_storage=artifact_storage,
        )
        details: tuple[InvestigationDetail, ...] = ()
        pack_digests: tuple[str, ...] = ()
        material_digests = (
            (
                accounting_product.content_digest,
                *(_digest(receipt) for receipt in accounting_receipts),
            )
            if accounting_product is not None
            else ()
        )
    else:
        details, pack_digests = _load_materials(
            request,
            owner_user_id=owner_user_id,
            db_path=Path(jinyiwei_db_path),
        )
        material_digests = pack_digests
    council_snapshot: JunjichuRuntimeReportSnapshot | None = None
    council_receipt: Archive | None = None
    if route_mode == "multi" and case_id is not None:
        try:
            normalized_case_id = _identifier(case_id)
            if junjichu_db_path is None:
                raise JunjichuRuntimeReportError(
                    "case_execution_binding_unavailable"
                )
            council_snapshot = get_runtime_report_snapshot(
                normalized_case_id,
                owner_user_id=owner_user_id,
                run_id=bound.scope.run_id,
                db_path=Path(junjichu_db_path),
            )
        except ValueError as exc:
            raise SixMinistryEvidenceServiceError(
                DecisionErrorCode.MATERIAL_NOT_FOUND
            ) from exc
        except JunjichuRuntimeReportError as exc:
            if str(exc) == "record_not_found_or_not_authorized":
                raise SixMinistryEvidenceServiceError(
                    DecisionErrorCode.MATERIAL_NOT_FOUND
                ) from exc
            raise SixMinistryEvidenceServiceError(
                DecisionErrorCode.JOINT_REVIEW_REQUIRED
            ) from exc
        if (
            council_snapshot.decree_id != bound.scope.decree_id
            or council_snapshot.draft_fingerprint != bound.scope.draft_fingerprint
            or council_snapshot.route_digest != bound.scope.route_digest
            or council_snapshot.departments
            != tuple(item.department for item in departments)
        ):
            raise SixMinistryEvidenceServiceError(
                DecisionErrorCode.MATERIAL_BINDING_MISMATCH
            )
        council_receipt = _load_verified_council_receipt(
            council_snapshot,
            owner_user_id=owner_user_id,
            decree_text=bound.decree_text,
            departments=tuple(item.department for item in departments),
            db_path=Path(shiguan_db_path) if shiguan_db_path is not None else None,
        )
    assembled_at = _utc_now()
    ledger_scope = _ledger_scope(
        bound.scope,
        case_id=council_snapshot.case_id if council_snapshot is not None else None,
    )
    evidence_binding_ids: list[str] = []
    audit_refs: list[AuditRefV1] = []
    try:
        for detail, pack_digest in zip(details, pack_digests, strict=True):
            binding = _append_or_reload(
                binding_ledger,
                RuntimeResourceBinding(
                    binding_id=f"binding:evidence:{bound.scope.run_id}:{pack_digest[:20]}",
                    scope=ledger_scope,
                    resource_kind=ResourceKind.EVIDENCE_PACK,
                    resource_ref=f"evidence-pack:{detail.pack_id}",
                    resource_version="1",
                    content_digest=pack_digest,
                    created_at=assembled_at,
                ),
            )
            evidence_binding_ids.append(binding.binding_id)
            audit_refs.append(
                AuditRefV1(
                    ref_id=binding.binding_id,
                    event_type="evidence_resolution",
                    digest=f"sha256:{binding.content_digest}",
                )
            )
        if accounting_product is not None:
            binding = _append_or_reload(
                binding_ledger,
                RuntimeResourceBinding(
                    binding_id=(
                        "binding:accounting-work-product:"
                        f"{bound.scope.run_id}:{accounting_product.content_digest[:20]}"
                    ),
                    scope=ledger_scope,
                    resource_kind=ResourceKind.ACCOUNTING_WORK_PRODUCT,
                    resource_ref=f"work-product:{accounting_product.work_product_id}",
                    resource_version=str(accounting_product.version),
                    content_digest=accounting_product.content_digest,
                    created_at=assembled_at,
                ),
            )
            evidence_binding_ids.append(binding.binding_id)
            audit_refs.append(
                AuditRefV1(
                    ref_id=binding.binding_id,
                    event_type="evidence_resolution",
                    digest=f"sha256:{binding.content_digest}",
                )
            )
            for receipt in accounting_receipts:
                receipt_digest = _digest(receipt)
                receipt_binding = _append_or_reload(
                    binding_ledger,
                    RuntimeResourceBinding(
                        binding_id=(
                            "binding:confirmation-receipt:"
                            f"{bound.scope.run_id}:{receipt_digest[:20]}"
                        ),
                        scope=ledger_scope,
                        resource_kind=ResourceKind.CONFIRMATION_RECEIPT,
                        resource_ref=(
                            "confirmation-receipt:"
                            f"{receipt.work_product_id}:{receipt.sequence}"
                        ),
                        resource_version=f"{receipt.version}:{receipt.sequence}",
                        content_digest=receipt_digest,
                        parent_binding_ids=(binding.binding_id,),
                        created_at=assembled_at,
                    ),
                )
                evidence_binding_ids.append(receipt_binding.binding_id)
                audit_refs.append(
                    AuditRefV1(
                        ref_id=receipt_binding.binding_id,
                        event_type="authority_decision",
                        digest=f"sha256:{receipt_binding.content_digest}",
                    )
                )
        ministry_binding_ids: list[str] = []
        material_binding_ids = tuple(evidence_binding_ids)
        if council_snapshot is not None:
            for record in council_snapshot.ministry_records:
                binding = _append_or_reload(
                    binding_ledger,
                    RuntimeResourceBinding(
                        binding_id=(
                            "binding:ministry-report:"
                            f"{bound.scope.run_id}:{record.content_digest[:20]}"
                        ),
                        scope=ledger_scope,
                        resource_kind=ResourceKind.MINISTRY_REPORT,
                        resource_ref=f"ministry-report:{record.report_id}",
                        resource_version=record.report.skill_version,
                        content_digest=record.content_digest,
                        parent_binding_ids=material_binding_ids,
                        created_at=assembled_at,
                    ),
                )
                ministry_binding_ids.append(binding.binding_id)
                evidence_binding_ids.append(binding.binding_id)
                audit_refs.append(
                    AuditRefV1(
                        ref_id=binding.binding_id,
                        event_type="runtime_binding",
                        digest=f"sha256:{binding.content_digest}",
                    )
                )
            if council_snapshot.council_record is not None:
                record = council_snapshot.council_record
                binding = _append_or_reload(
                    binding_ledger,
                    RuntimeResourceBinding(
                        binding_id=(
                            "binding:council-report:"
                            f"{bound.scope.run_id}:{record.content_digest[:20]}"
                        ),
                        scope=ledger_scope,
                        resource_kind=ResourceKind.COUNCIL_REPORT,
                        resource_ref=f"council-report:{record.report_id}",
                        resource_version=record.report.skill_version,
                        content_digest=record.content_digest,
                        parent_binding_ids=tuple(ministry_binding_ids),
                        created_at=assembled_at,
                    ),
                )
                evidence_binding_ids.append(binding.binding_id)
                audit_refs.append(
                    AuditRefV1(
                        ref_id=binding.binding_id,
                        event_type="runtime_binding",
                        digest=f"sha256:{binding.content_digest}",
                    )
                )
                if council_receipt is not None:
                    receipt_digest = _digest(council_receipt)
                    receipt_binding = _append_or_reload(
                        binding_ledger,
                        RuntimeResourceBinding(
                            binding_id=(
                                "binding:junjichu-receipt:"
                                f"{bound.scope.run_id}:{receipt_digest[:20]}"
                            ),
                            scope=ledger_scope,
                            resource_kind=ResourceKind.JUNJICHU_CASE_RECEIPT,
                            resource_ref=(
                                "shiguan-reply:"
                                f"{council_receipt.id}"
                            ),
                            resource_version=council_receipt.created_at,
                            content_digest=receipt_digest,
                            parent_binding_ids=(binding.binding_id,),
                            created_at=assembled_at,
                        ),
                    )
                    evidence_binding_ids.append(receipt_binding.binding_id)
                    audit_refs.append(
                        AuditRefV1(
                            ref_id=receipt_binding.binding_id,
                            event_type="authority_decision",
                            digest=f"sha256:{receipt_binding.content_digest}",
                        )
                    )
    except (ExecutionLedgerError, ResourceBindingConflict) as exc:
        raise SixMinistryEvidenceServiceError(DecisionErrorCode.AUDIT_WRITE_FAILED) from exc

    primary_ministry = participating[0]
    is_multi = route_mode == "multi"
    is_rites_citation = skill.agent_id == "libu-rites-content"
    is_xingbu_integrity = skill.agent_id == "xingbu-evidence-integrity"
    adopted_only = is_rites_citation
    if accounting_product is not None:
        evidence_refs = (
            EvidenceRefV1(
                ref_id=f"work-product:{accounting_product.work_product_id}",
                source_type="WorkProduct",
                source_ref=accounting_product.work_product_id,
                digest=f"sha256:{accounting_product.content_digest}",
                as_of=accounting_product.created_at,
                adoption_status="supporting",
            ),
        )
        required_count = len(skill.data_requirements)
        accounting_completed = (
            accounting_result is not None
            and accounting_result.report.status is ReportStatus.COMPLETED
        )
        resolved_count = required_count if accounting_completed else 0
        missing_fact_keys = (
            () if accounting_completed else tuple(skill.data_requirements)
        )
        stale_fact_keys: tuple[str, ...] = ()
    else:
        freshness_now = max(
            assembled_at,
            request.constraints.as_of or assembled_at,
        )
        evidence_refs = _evidence_refs(
            details,
            adopted_only=adopted_only,
            now=freshness_now,
            server_now=assembled_at,
            requested_as_of=request.constraints.as_of,
        )
        (
            required_count,
            resolved_count,
            missing_fact_keys,
            stale_fact_keys,
        ) = _required_and_resolved_counts(
            details,
            adopted_only=adopted_only,
            now=freshness_now,
            server_now=assembled_at,
            requested_as_of=request.constraints.as_of,
        )
    conflicts = tuple(conflict for detail in details for conflict in detail.conflicts)
    council_completed = False
    council_issues: tuple[str, ...] = ()
    if council_snapshot is not None:
        ministry_reports = tuple(
            record.report for record in council_snapshot.ministry_records
        )
        council_record = council_snapshot.council_record
        bound_evidence_ids = {item.ref_id for item in evidence_refs}
        ministry_evidence_union: set[str] = set()
        issues: list[str] = []
        if council_snapshot.case_status != "ARCHIVED":
            issues.append("case_lifecycle_incomplete")
        if council_receipt is None:
            issues.append("case_receipt_unverified")
        if len(ministry_reports) != len(council_snapshot.departments):
            issues.append("ministry_report_set_incomplete")
        for index, report in enumerate(ministry_reports):
            if not isinstance(report, MinistryReport):
                issues.append("ministry_report_type_invalid")
                continue
            try:
                current_report_skill = registry.get_by_agent(report.agent_id)
            except DownstreamSkillRegistryError:
                issues.append(f"{report.agent_id}:runtime_skill_unavailable")
                continue
            report_record = council_snapshot.ministry_records[index]
            if (
                current_report_skill.layer is not AgentLayer.MINISTRY
                or report.skill_id != current_report_skill.skill_id
                or report.skill_version != current_report_skill.version
                or report_record.skill_definition_digest
                != runtime_skill_definition_digest(current_report_skill)
            ):
                issues.append(f"{report.agent_id}:runtime_skill_binding_stale")
            if (
                index >= len(departments)
                or report.selected_bureaus
                != tuple(departments[index].required_bureaus)
            ):
                issues.append(f"{report.agent_id}:bureau_route_mismatch")
            if report.status is not ReportStatus.COMPLETED:
                issues.append(f"{report.agent_id}:status:{report.status.value}")
            if report.evidence_sufficiency.value != "sufficient":
                issues.append(
                    f"{report.agent_id}:evidence:{report.evidence_sufficiency.value}"
                )
            if report.data_gaps or report.unresolved_items or report.conflicts:
                issues.append(f"{report.agent_id}:unresolved")
            if not report.evidence_refs:
                issues.append(f"{report.agent_id}:evidence_missing")
            if not set(report.evidence_refs).issubset(bound_evidence_ids):
                issues.append(f"{report.agent_id}:evidence_binding_mismatch")
            ministry_evidence_union.update(report.evidence_refs)
        if council_record is None or not isinstance(
            council_record.report if council_record is not None else None,
            CouncilReport,
        ):
            issues.append("council_report_missing")
        else:
            council_report = council_record.report
            try:
                current_council_skill = registry.get_by_agent(council_report.agent_id)
            except DownstreamSkillRegistryError:
                issues.append("council_runtime_skill_unavailable")
                current_council_skill = None
            if current_council_skill is None or (
                current_council_skill.layer is not AgentLayer.COUNCIL
                or council_report.skill_id != current_council_skill.skill_id
                or council_report.skill_version != current_council_skill.version
                or council_record.skill_definition_digest
                != runtime_skill_definition_digest(current_council_skill)
            ):
                issues.append("council_runtime_skill_binding_stale")
            expected_report_ids = tuple(
                report.report_id
                for report in ministry_reports
                if isinstance(report, MinistryReport)
            )
            if (
                council_report.status is not ReportStatus.COMPLETED
                or council_report.evidence_sufficiency.value != "sufficient"
                or council_report.data_gaps
            ):
                issues.append("council_report_incomplete")
            if (
                council_report.participating_ministries
                != council_snapshot.departments
                or council_report.review_order != council_snapshot.departments
                or council_report.ministry_report_refs != expected_report_ids
            ):
                issues.append("council_report_set_mismatch")
            if not council_report.evidence_refs:
                issues.append("council_evidence_missing")
            if set(council_report.evidence_refs) != ministry_evidence_union:
                issues.append("council_evidence_union_mismatch")
            if not set(council_report.evidence_refs).issubset(bound_evidence_ids):
                issues.append("council_evidence_binding_mismatch")
        council_issues = tuple(dict.fromkeys(issues))
        council_completed = not council_issues

    errors: tuple[DecisionErrorV1, ...]
    missing_evidence: tuple[MissingEvidenceV1, ...]
    findings: tuple[FindingV1, ...]
    artifact_refs: tuple[ArtifactRefV1, ...]
    authority_status: Literal["allowed", "unavailable"]
    analysis_allowed: bool
    projection_mode: Literal[
        "citation_draft",
        "evidence_integrity",
        "joint_review",
        "authority_source_unavailable",
    ]

    if is_multi and council_snapshot is None:
        errors = (
            _decision_error(
                DecisionErrorCode.JOINT_REVIEW_REQUIRED,
                phase="routing",
                retryable=False,
            ),
        )
        missing_evidence = (
            MissingEvidenceV1(
                requirement_id="junjichu_report_receipt",
                reason_code="source_unavailable",
                required=True,
            ),
        )
        findings = ()
        artifact_refs = ()
        authority_status = "unavailable"
        analysis_allowed = False
        projection_mode = "authority_source_unavailable"
    elif conflicts:
        errors = (
            _decision_error(
                DecisionErrorCode.EVIDENCE_CONFLICT,
                phase="evidence",
                retryable=True,
            ),
        )
        missing_evidence = tuple(
            MissingEvidenceV1(
                requirement_id=conflict.fact_key,
                reason_code="conflict",
                required=True,
            )
            for conflict in conflicts
        )
        findings = ()
        artifact_refs = ()
        authority_status = "allowed"
        analysis_allowed = True
        projection_mode = (
            "citation_draft" if is_rites_citation else "evidence_integrity"
        )
    elif stale_fact_keys and not is_hubu_accounting:
        errors = (
            _decision_error(
                DecisionErrorCode.EVIDENCE_STALE,
                phase="evidence",
                retryable=True,
            ),
        )
        missing_evidence = tuple(
            MissingEvidenceV1(
                requirement_id=fact_key,
                reason_code="stale",
                required=True,
            )
            for fact_key in stale_fact_keys
        )
        findings = ()
        artifact_refs = ()
        authority_status = "allowed"
        analysis_allowed = True
        projection_mode = (
            "citation_draft" if is_rites_citation else "evidence_integrity"
        )
    elif missing_fact_keys and not is_hubu_accounting:
        errors = (
            _decision_error(
                DecisionErrorCode.EVIDENCE_INCOMPLETE,
                phase="evidence",
                retryable=True,
            ),
        )
        missing_evidence = tuple(
            MissingEvidenceV1(
                requirement_id=fact_key,
                reason_code="incomplete",
                required=True,
            )
            for fact_key in missing_fact_keys
        )
        findings = ()
        artifact_refs = ()
        authority_status = "allowed"
        analysis_allowed = True
        projection_mode = (
            "citation_draft" if is_rites_citation else "evidence_integrity"
        )
    elif is_multi and not council_completed:
        errors = (
            _decision_error(
                DecisionErrorCode.JOINT_REVIEW_REQUIRED,
                phase="routing",
                retryable=False,
            ),
        )
        missing_evidence = tuple(
            MissingEvidenceV1(
                requirement_id=f"joint:{index}",
                reason_code="incomplete",
                required=True,
            )
            for index, _item in enumerate(council_issues, start=1)
        )
        findings = ()
        artifact_refs = ()
        authority_status = "unavailable"
        analysis_allowed = False
        projection_mode = "joint_review"
    elif is_multi and council_snapshot is not None:
        council_record = council_snapshot.council_record
        if council_record is None or not isinstance(council_record.report, CouncilReport):
            raise SixMinistryEvidenceServiceError(
                DecisionErrorCode.JOINT_REVIEW_REQUIRED
            )
        council_report = council_record.report
        finding_values = tuple(
            dict.fromkeys(
                (
                    *council_report.consensus,
                    *council_report.cross_ministry_dependencies,
                    *council_report.joint_options,
                )
            )
        ) or (council_report.executive_summary,)
        findings = tuple(
            FindingV1(
                finding_id=f"finding:joint:{index}",
                statement=value,
                severity="info",
                evidence_ref_ids=tuple(item.ref_id for item in evidence_refs),
            )
            for index, value in enumerate(finding_values, start=1)
        )
        errors = ()
        missing_evidence = ()
        artifact_refs = (
            ArtifactRefV1(
                artifact_id=f"council-report:{council_report.report_id}",
                artifact_type="decision_report",
                digest=f"sha256:{council_record.content_digest}",
                version=1,
            ),
        )
        authority_status = "allowed"
        analysis_allowed = True
        projection_mode = "joint_review"
    elif is_hubu_accounting and accounting_product is None:
        errors = (
            _decision_error(
                DecisionErrorCode.AUTHORITY_UNAVAILABLE,
                phase="authority",
                retryable=False,
            ),
        )
        missing_evidence = (
            MissingEvidenceV1(
                requirement_id="accounting_work_product_source",
                reason_code="source_unavailable",
                required=True,
            ),
        )
        findings = ()
        artifact_refs = ()
        authority_status = "unavailable"
        analysis_allowed = False
        projection_mode = "authority_source_unavailable"
    elif is_hubu_accounting and accounting_result is not None:
        accounting_completed = accounting_result.report.status is ReportStatus.COMPLETED
        findings = tuple(
            FindingV1(
                finding_id=f"finding:accounting:{index}",
                statement=item,
                severity="info",
                evidence_ref_ids=tuple(ref.ref_id for ref in evidence_refs),
            )
            for index, item in enumerate(
                accounting_result.report.professional_findings, start=1
            )
        )
        if accounting_completed:
            errors = ()
            missing_evidence = ()
            artifact_refs = (
                ArtifactRefV1(
                    artifact_id=f"work-product:{accounting_product.work_product_id}",
                    artifact_type="work_product_preview",
                    digest=f"sha256:{accounting_product.content_digest}",
                    version=accounting_product.version,
                ),
            )
        else:
            errors = (
                _decision_error(
                    DecisionErrorCode.EVIDENCE_INCOMPLETE,
                    phase="evidence",
                    retryable=True,
                ),
            )
            missing_evidence = tuple(
                MissingEvidenceV1(
                    requirement_id=f"accounting:{index}",
                    reason_code="incomplete",
                    required=True,
                )
                for index, _item in enumerate(
                    accounting_result.report.data_gaps, start=1
                )
            ) or (
                MissingEvidenceV1(
                    requirement_id="accounting_facts",
                    reason_code="incomplete",
                    required=True,
                ),
            )
            artifact_refs = ()
        authority_status = "allowed"
        analysis_allowed = True
        projection_mode = "accounting_grounding"
    elif is_rites_citation:
        adopted_ids = tuple(item.ref_id for item in evidence_refs)
        findings = (
            FindingV1(
                finding_id="finding:adopted-citations",
                statement=(
                    f"已从服务端确认采纳记录装配 {len(adopted_ids)} 条可引用证据；"
                    "结果仅为引用草稿，不代表已发布。"
                ),
                severity="info",
                evidence_ref_ids=adopted_ids,
            ),
        )
        artifact_payload = {
            "kind": "citation_draft",
            "request_id": request.request_id,
            "objective": request.objective,
            "evidence_ref_ids": adopted_ids,
            "scope_binding_digest": bound.scope.binding_digest,
            "skill_id": skill.skill_id,
            "skill_version": skill.version,
        }
        artifact_refs = (
            ArtifactRefV1(
                artifact_id=f"citation-draft:{request.request_id}",
                artifact_type="citation_draft",
                digest=_prefixed_digest(artifact_payload),
                version=1,
            ),
        )
        errors = ()
        missing_evidence = ()
        authority_status = "allowed"
        analysis_allowed = True
        projection_mode = "citation_draft"
    elif is_xingbu_integrity:
        adopted_count = sum(
            1 for item in evidence_refs if item.adoption_status == "adopted"
        )
        findings = (
            FindingV1(
                finding_id="finding:evidence-integrity",
                statement=(
                    "证据包结构、当前事实覆盖与内容摘要已通过只读完整性检查；"
                    f"采纳状态为 {adopted_count}/{len(evidence_refs)}，"
                    "该结果不构成法律批准。"
                ),
                severity="info" if adopted_count == len(evidence_refs) else "warning",
                evidence_ref_ids=tuple(item.ref_id for item in evidence_refs),
            ),
        )
        errors = ()
        missing_evidence = ()
        artifact_refs = ()
        authority_status = "allowed"
        analysis_allowed = True
        projection_mode = "evidence_integrity"
    else:
        requirement = _MISSING_AUTHORITY_REQUIREMENTS[primary_ministry]
        errors = (
            _decision_error(
                DecisionErrorCode.AUTHORITY_UNAVAILABLE,
                phase="authority",
                retryable=False,
            ),
        )
        missing_evidence = (
            MissingEvidenceV1(
                requirement_id=requirement,
                reason_code="source_unavailable",
                required=True,
            ),
        )
        findings = ()
        artifact_refs = ()
        authority_status = "unavailable"
        analysis_allowed = False
        projection_mode = "authority_source_unavailable"

    completed = not errors
    evidence_status: Literal["resolved", "partial", "blocked", "unavailable"]
    if conflicts:
        evidence_status = "blocked"
    elif stale_fact_keys or resolved_count < required_count:
        evidence_status = "partial"
    else:
        evidence_status = "resolved"
    decision_status: Literal["completed", "degraded"] = (
        "completed" if completed else "degraded"
    )
    summary = (
        "服务端只读证据解析完成；结果仅为预览，不授权任何外部动作。"
        if completed
        else "服务端只读解析已停止在可信边界；缺失证据、领域权威或军机处回执前不得升级。"
    )
    decision = DecisionV1(
        status=decision_status,
        action_disposition="preview" if completed else "hold",
        summary=summary,
        facts=(),
        findings=findings,
        risks=(),
        conflicts=tuple(
            ConflictV1(
                conflict_id=f"conflict:{index}",
                statement=conflict.summary,
                evidence_ref_ids=conflict.evidence_ids,
            )
            for index, conflict in enumerate(conflicts, start=1)
        ),
        missing_evidence=missing_evidence,
        next_actions=(
            NextActionV1(
                action_id="next:human-review",
                instruction="请补齐机器列出的权威来源或证据，并由现有受控流程重新执行只读解析。",
                owner_role="requester",
                action_class=(
                    "human_review" if is_rites_citation else "obtain_evidence"
                ),
            ),
            NextActionV1(
                action_id="next:no-external-effect",
                instruction="保持所有发送、发布、付款、签署与系统写入关闭。",
                owner_role="system_operator",
                action_class="no_external_effect",
            ),
        ),
        artifact_refs=artifact_refs,
    )

    authority_binding = _prefixed_digest(
        {
            "scope_binding_digest": bound.scope.binding_digest,
            "route_digest": bound.scope.route_digest,
            "skill_id": skill.skill_id,
            "skill_version": skill.version,
            "analysis_allowed": analysis_allowed,
        }
    )
    envelope_without_decision_audit = {
        "request_id": request.request_id,
        "scope_binding_digest": bound.scope.binding_digest,
        "route": bound.route,
        "skill_definition_digest": runtime_skill_definition_digest(skill),
        "material_digests": material_digests,
        "case_id": (
            council_snapshot.case_id if council_snapshot is not None else None
        ),
        "council_report_digest": (
            council_snapshot.council_record.content_digest
            if council_snapshot is not None
            and council_snapshot.council_record is not None
            else None
        ),
        "authority_binding": authority_binding,
        "decision": decision,
        "evidence_refs": evidence_refs,
        "errors": errors,
    }
    decision_digest = _digest(envelope_without_decision_audit)
    try:
        decision_binding = _append_or_reload(
            binding_ledger,
            RuntimeResourceBinding(
                binding_id=f"binding:decision:{bound.scope.run_id}:{decision_digest[:20]}",
                scope=ledger_scope,
                resource_kind=ResourceKind.DECISION_ENVELOPE,
                resource_ref=f"decision:{request.request_id}",
                resource_version=decision_digest,
                content_digest=decision_digest,
                parent_binding_ids=tuple(evidence_binding_ids),
                created_at=assembled_at,
            ),
        )
    except (ExecutionLedgerError, ResourceBindingConflict) as exc:
        raise SixMinistryEvidenceServiceError(DecisionErrorCode.AUDIT_WRITE_FAILED) from exc
    audit_refs.append(
        AuditRefV1(
            ref_id=decision_binding.binding_id,
            event_type="decision_emission",
            digest=f"sha256:{decision_binding.content_digest}",
        )
    )

    return DecisionEnvelopeV1(
        request_id=request.request_id,
        decision_id=f"decision:{bound.scope.run_id}:{decision_digest[:16]}",
        scope=ScopeV1(),
        identity=IdentityV1(
            owner_user_id=owner_user_id,
            run_id=bound.scope.run_id,
            case_id=(
                council_snapshot.case_id if council_snapshot is not None else None
            ),
            decree_id=bound.scope.decree_id,
            assembled_at=assembled_at,
        ),
        routing=RoutingV1(
            route_mode=route_mode,
            capability_id=skill.skill_id,
            accountable_ministry=primary_ministry,
            participating_ministries=participating,
            joint_review=JointReviewV1(
                required=is_multi,
                status=(
                    "completed"
                    if is_multi and council_completed
                    else ("pending" if is_multi else "not_required")
                ),
                reviewer="junjichu" if is_multi else "none",
                receipt_ref=(
                    council_receipt.id
                    if is_multi
                    and council_completed
                    and council_receipt is not None
                    else None
                ),
            ),
        ),
        runtime_binding=RuntimeBindingV1(
            skill_id=skill.skill_id,
            definition_version=skill.version,
            definition_digest=runtime_skill_definition_digest(skill),
        ),
        evidence=EvidenceSummaryV1(
            status=evidence_status,
            projection_mode=projection_mode,
            snapshot_ref=f"bundle:{decision_digest[:24]}",
            freshness="stale" if stale_fact_keys else "current",
            required_fact_count=required_count,
            resolved_fact_count=resolved_count,
        ),
        authority=AuthoritySummaryV1(
            status=authority_status,
            analysis_allowed=analysis_allowed,
            projection_ref=f"authority:{bound.scope.binding_digest[:24]}",
            binding_digest=authority_binding,
            sources=(
                "CurrentUser",
                "DecreeJob",
                "RuntimeSkill",
                *(("JunjichuCase",) if council_snapshot is not None else ()),
            ),
        ),
        decision=decision,
        evidence_refs=evidence_refs,
        audit_refs=tuple(audit_refs),
        errors=errors,
        external_effects=ExternalEffectsV1(),
    )


__all__ = [
    "DecisionEnvelopeV1",
    "DecisionErrorCode",
    "DecisionRequestV1",
    "MaterialKind",
    "MaterialRefV1",
    "RequestConstraintsV1",
    "SixMinistryEvidenceServiceError",
    "resolve_six_ministry_decision",
]
