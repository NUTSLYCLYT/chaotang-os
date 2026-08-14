"""Deterministic no-side-effect controls distilled from the EXT ministries.

These controls do not register capabilities or grant authority.  They only
turn already-approved references into frozen readiness decisions that the
authoritative RuntimeSkill execution path may consume.
"""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class _FrozenControl(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")


def _nonblank(value: str) -> str:
    if not value.strip():
        raise ValueError("value_must_be_nonblank")
    return value


def _unique_refs(value: tuple[str, ...]) -> tuple[str, ...]:
    if any(not item.strip() for item in value) or len(set(value)) != len(value):
        raise ValueError("refs_must_be_unique_and_nonblank")
    return value


class EffectIntent(StrEnum):
    ANALYSIS = "analysis"
    DRAFT = "draft"
    SYSTEM_WRITE = "system_write"
    EXTERNAL_WRITE = "external_write"
    IRREVERSIBLE = "irreversible"


class GateDisposition(StrEnum):
    READY = "ready"
    DRAFT = "draft"
    HOLD = "hold"
    BLOCK = "block"


class ClaimKind(StrEnum):
    FACT = "fact"
    RECOMMENDATION = "recommendation"
    OPINION = "opinion"


class EvidenceClaim(_FrozenControl):
    claim_id: str
    kind: ClaimKind
    text: str
    evidence_refs: tuple[str, ...] = ()

    _text = field_validator("claim_id", "text")(_nonblank)
    _refs = field_validator("evidence_refs")(_unique_refs)


class _BoundInput(_FrozenControl):
    tenant_id: str
    owner_user_id: str
    run_id: str

    _identity = field_validator("tenant_id", "owner_user_id", "run_id")(_nonblank)


class CommunicationControlInput(_BoundInput):
    channel: str
    claims: tuple[EvidenceClaim, ...] = Field(min_length=1, max_length=100)
    requested_effect: EffectIntent

    _channel = field_validator("channel")(_nonblank)

    @model_validator(mode="after")
    def require_unique_claims(self) -> CommunicationControlInput:
        ids = [item.claim_id for item in self.claims]
        if len(set(ids)) != len(ids):
            raise ValueError("claim_ids_must_be_unique")
        return self


class CommercialControlInput(_BoundInput):
    opportunity_id: str
    stage: str
    customer_evidence_refs: tuple[str, ...]
    pricing_evidence_refs: tuple[str, ...]
    requested_effect: EffectIntent

    _text = field_validator("opportunity_id", "stage")(_nonblank)
    _refs = field_validator("customer_evidence_refs", "pricing_evidence_refs")(
        _unique_refs
    )


class LegalControlInput(_BoundInput):
    contract_ref: str
    applicable_rule_refs: tuple[str, ...]
    approval_record_ref: str | None
    requested_effect: EffectIntent

    _contract = field_validator("contract_ref")(_nonblank)
    _rules = field_validator("applicable_rule_refs")(_unique_refs)

    @field_validator("approval_record_ref")
    @classmethod
    def validate_optional_ref(cls, value: str | None) -> str | None:
        return _nonblank(value) if value is not None else None


class DeliveryControlInput(_BoundInput):
    acceptance_criteria_refs: tuple[str, ...]
    test_evidence_refs: tuple[str, ...]
    open_critical_defects: int = Field(ge=0)
    rollback_plan_ref: str | None
    requested_effect: EffectIntent

    _refs = field_validator("acceptance_criteria_refs", "test_evidence_refs")(
        _unique_refs
    )

    @field_validator("rollback_plan_ref")
    @classmethod
    def validate_optional_ref(cls, value: str | None) -> str | None:
        return _nonblank(value) if value is not None else None


class BoundMinistryReport(_BoundInput):
    ministry: str
    report_ref: str

    _text = field_validator("ministry", "report_ref")(_nonblank)


class JointReviewInput(_BoundInput):
    participating_ministries: tuple[str, ...] = Field(min_length=2, max_length=6)
    reports: tuple[BoundMinistryReport, ...] = Field(min_length=2, max_length=6)
    reviewer: str
    unresolved_conflicts: tuple[str, ...]
    requested_effect: EffectIntent

    _ministries = field_validator("participating_ministries", "unresolved_conflicts")(
        _unique_refs
    )
    _reviewer = field_validator("reviewer")(_nonblank)


class DomainControlResult(_FrozenControl):
    disposition: GateDisposition
    reason_codes: tuple[str, ...]
    external_effect_authorized: bool = False

    _reasons = field_validator("reason_codes")(_unique_refs)

    @model_validator(mode="after")
    def never_authorize_effects(self) -> DomainControlResult:
        if self.external_effect_authorized:
            raise ValueError("domain_controls_cannot_authorize_effects")
        if self.disposition in {GateDisposition.HOLD, GateDisposition.BLOCK}:
            if not self.reason_codes:
                raise ValueError("nonready_control_requires_reason")
        return self


def _result(
    disposition: GateDisposition, *reasons: str
) -> DomainControlResult:
    return DomainControlResult(disposition=disposition, reason_codes=tuple(reasons))


def evaluate_communication_control(
    request: CommunicationControlInput,
) -> DomainControlResult:
    if request.requested_effect in {
        EffectIntent.SYSTEM_WRITE,
        EffectIntent.EXTERNAL_WRITE,
        EffectIntent.IRREVERSIBLE,
    }:
        return _result(GateDisposition.BLOCK, "external_communications_forbidden")
    if any(
        claim.kind is ClaimKind.FACT and not claim.evidence_refs
        for claim in request.claims
    ):
        return _result(GateDisposition.HOLD, "factual_claim_evidence_missing")
    return _result(GateDisposition.DRAFT, "human_review_required")


def evaluate_commercial_control(
    request: CommercialControlInput,
) -> DomainControlResult:
    if request.requested_effect in {
        EffectIntent.SYSTEM_WRITE,
        EffectIntent.EXTERNAL_WRITE,
        EffectIntent.IRREVERSIBLE,
    }:
        return _result(GateDisposition.BLOCK, "commercial_external_action_forbidden")
    reasons: list[str] = []
    if not request.customer_evidence_refs:
        reasons.append("customer_intent_evidence_missing")
    if not request.pricing_evidence_refs:
        reasons.append("pricing_evidence_missing")
    if reasons:
        return _result(GateDisposition.HOLD, *reasons)
    return _result(GateDisposition.DRAFT, "human_review_required")


def evaluate_legal_control(request: LegalControlInput) -> DomainControlResult:
    if request.requested_effect in {
        EffectIntent.SYSTEM_WRITE,
        EffectIntent.EXTERNAL_WRITE,
        EffectIntent.IRREVERSIBLE,
    }:
        return _result(GateDisposition.BLOCK, "legal_execution_forbidden")
    reasons: list[str] = []
    if not request.applicable_rule_refs:
        reasons.append("applicable_rules_missing")
    if request.approval_record_ref is None:
        reasons.append("approval_record_missing")
    if reasons:
        return _result(GateDisposition.HOLD, *reasons)
    return _result(GateDisposition.READY)


def evaluate_delivery_control(request: DeliveryControlInput) -> DomainControlResult:
    if request.requested_effect is not EffectIntent.ANALYSIS:
        return _result(GateDisposition.BLOCK, "delivery_execution_forbidden")
    if request.open_critical_defects:
        return _result(GateDisposition.BLOCK, "critical_defects_open")
    reasons: list[str] = []
    if not request.acceptance_criteria_refs:
        reasons.append("acceptance_criteria_missing")
    if not request.test_evidence_refs:
        reasons.append("test_evidence_missing")
    if request.rollback_plan_ref is None:
        reasons.append("rollback_plan_missing")
    if reasons:
        return _result(GateDisposition.HOLD, *reasons)
    return _result(GateDisposition.READY)


def evaluate_joint_review(request: JointReviewInput) -> DomainControlResult:
    if request.requested_effect is not EffectIntent.ANALYSIS:
        return _result(GateDisposition.BLOCK, "joint_review_execution_forbidden")
    if request.reviewer != "junjichu":
        return _result(GateDisposition.BLOCK, "junjichu_review_required")
    expected = request.participating_ministries
    received = tuple(report.ministry for report in request.reports)
    if received != expected or len(set(received)) != len(received):
        return _result(GateDisposition.BLOCK, "ministry_report_set_mismatch")
    if any(
        report.tenant_id != request.tenant_id
        or report.owner_user_id != request.owner_user_id
        or report.run_id != request.run_id
        for report in request.reports
    ):
        return _result(GateDisposition.BLOCK, "report_identity_binding_mismatch")
    if request.unresolved_conflicts:
        return _result(GateDisposition.HOLD, "cross_ministry_conflict_unresolved")
    return _result(GateDisposition.READY)
