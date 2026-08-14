"""Pure, fail-closed gates shared by six-ministry runtime capabilities.

These evaluators classify trusted inputs. They do not discover evidence, issue
authority, mutate work products, or perform the business actions they review.
"""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from enum import StrEnum
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

from app.work_products import (
    ArtifactGateStatus,
    ArtifactState,
    ConfirmationReceipt,
    ConfirmationStatus,
    WorkProductEnvelope,
    WorkProductStatus,
    semantic_digest,
)


class _FrozenGateModel(BaseModel):
    """Strict value object used by deterministic, non-authorizing classifiers."""

    model_config = ConfigDict(extra="forbid", frozen=True)


class GateExecutionIdentity(_FrozenGateModel):
    """Identity values supplied to a pure classifier, not an authority token."""

    tenant_id: str = Field(min_length=1)
    owner_user_id: str = Field(min_length=1)
    run_id: str = Field(min_length=1)


class GateDecision(StrEnum):
    PASS = "PASS"
    HOLD = "HOLD"
    BLOCK = "BLOCK"


class PaymentGateDecision(StrEnum):
    PREVIEW = "PREVIEW"
    HOLD = "HOLD"
    BLOCK = "BLOCK"


class FinancialClaim(_FrozenGateModel):
    claim_id: str = Field(min_length=1)
    amount: Decimal
    source_ref: str | None = None
    period: str | None = None
    basis: str | None = None
    currency: str | None = None

    @field_validator("amount", mode="before")
    @classmethod
    def _reject_inexact_amount(cls, value: object) -> object:
        if isinstance(value, (bool, float)):
            raise ValueError("financial amount must not be bool or float")
        return value

    @field_validator("amount")
    @classmethod
    def _require_finite_amount(cls, value: Decimal) -> Decimal:
        if not value.is_finite():
            raise ValueError("financial amount must be finite")
        return value

    @field_validator("claim_id")
    @classmethod
    def _strip_claim_id(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("claim_id must not be blank")
        return stripped


class FinancialGroundingInput(_FrozenGateModel):
    claims: tuple[FinancialClaim, ...]


class FinancialEvidenceFact(_FrozenGateModel):
    """Prevalidated fact shape; this value never proves provenance by itself."""

    claim_id: str = Field(min_length=1)
    source_ref: str = Field(min_length=1)
    requirement_key: str = Field(min_length=1)
    amount: Decimal
    period: str = Field(min_length=1)
    basis: str = Field(min_length=1)
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    tenant_id: str = Field(min_length=1)
    owner_user_id: str = Field(min_length=1)
    run_id: str = Field(min_length=1)

    @field_validator("amount", mode="before")
    @classmethod
    def _reject_inexact_amount(cls, value: object) -> object:
        if isinstance(value, (bool, float)):
            raise ValueError("financial amount must not be bool or float")
        return value

    @field_validator("amount")
    @classmethod
    def _require_finite_amount(cls, value: Decimal) -> Decimal:
        if not value.is_finite():
            raise ValueError("financial amount must be finite")
        return value


class FinancialEvidenceProjection(_FrozenGateModel):
    """Pure classifier input; production must reload it from an authority store."""
    tenant_id: str = Field(min_length=1)
    owner_user_id: str = Field(min_length=1)
    run_id: str = Field(min_length=1)
    facts: tuple[FinancialEvidenceFact, ...] = Field(min_length=1, max_length=1000)

    @model_validator(mode="after")
    def _bind_every_fact(self) -> FinancialEvidenceProjection:
        keys: set[tuple[str, str]] = set()
        for fact in self.facts:
            if (fact.tenant_id, fact.owner_user_id, fact.run_id) != (
                self.tenant_id,
                self.owner_user_id,
                self.run_id,
            ):
                raise ValueError("financial_evidence_identity_mismatch")
            key = (fact.claim_id, fact.source_ref)
            if key in keys:
                raise ValueError("financial_evidence_duplicate_fact")
            keys.add(key)
        return self


class FinancialClaimGap(_FrozenGateModel):
    claim_id: str
    missing_fields: tuple[str, ...]


class FinancialGroundingResult(_FrozenGateModel):
    decision: GateDecision
    reason_codes: tuple[str, ...]
    grounded_claim_ids: tuple[str, ...]
    conflicting_claim_ids: tuple[str, ...]
    claim_gaps: tuple[FinancialClaimGap, ...]
    side_effects: tuple[str, ...] = Field(default=(), max_length=0)


class PaymentGateInput(_FrozenGateModel):
    """Untrusted request facts; authority fields deliberately do not exist here."""

    contract_basis_refs: tuple[str, ...] = ()
    acceptance_evidence_refs: tuple[str, ...] = ()

    @field_validator("contract_basis_refs", "acceptance_evidence_refs")
    @classmethod
    def _validate_refs(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        normalized = tuple(item.strip() for item in value)
        if any(not item for item in normalized):
            raise ValueError("payment evidence references must not be blank")
        if len(set(normalized)) != len(normalized):
            raise ValueError("payment evidence references must be unique")
        return normalized


class EvidenceKind(StrEnum):
    CONTRACT_BASIS = "contract_basis"
    ACCEPTANCE = "acceptance"


class PaymentEvidenceProjection(_FrozenGateModel):
    """Typed payment evidence for validation only, never execution authority."""
    ref: str = Field(min_length=1)
    kind: EvidenceKind
    tenant_id: str = Field(min_length=1)
    owner_user_id: str = Field(min_length=1)
    run_id: str = Field(min_length=1)
    content_digest: str = Field(pattern=r"^[0-9a-f]{64}$")
    authorized_amount: Decimal | None = Field(
        default=None, gt=0, max_digits=24, decimal_places=6
    )
    currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    payee_ref: str | None = Field(default=None, min_length=1, max_length=256)

    @field_validator("authorized_amount", mode="before")
    @classmethod
    def _reject_inexact_amount(cls, value: object) -> object:
        if isinstance(value, (bool, float)):
            raise ValueError("payment amount must not be bool or float")
        return value

    @model_validator(mode="after")
    def _require_contract_terms_only_for_contract_evidence(
        self,
    ) -> PaymentEvidenceProjection:
        terms = (self.authorized_amount, self.currency, self.payee_ref)
        if self.kind is EvidenceKind.CONTRACT_BASIS and any(item is None for item in terms):
            raise ValueError("payment_contract_terms_missing")
        if self.kind is EvidenceKind.ACCEPTANCE and any(item is not None for item in terms):
            raise ValueError("payment_acceptance_contains_contract_terms")
        return self


class PaymentAuthorityProjection(_FrozenGateModel):
    """Prevalidated payment binding; it cannot authorize a payment or preview."""
    tenant_id: str = Field(min_length=1)
    owner_user_id: str = Field(min_length=1)
    run_id: str = Field(min_length=1)
    preview_digest: str = Field(pattern=r"^[0-9a-f]{64}$")
    receipt_work_product_id: str = Field(min_length=1)
    receipt_version: int = Field(gt=0)
    receipt_sequence: int = Field(gt=0)
    evidence: tuple[PaymentEvidenceProjection, ...] = Field(min_length=2, max_length=100)

    @model_validator(mode="after")
    def _bind_every_evidence(self) -> PaymentAuthorityProjection:
        if len({item.ref for item in self.evidence}) != len(self.evidence):
            raise ValueError("payment_evidence_duplicate_ref")
        for item in self.evidence:
            if (item.tenant_id, item.owner_user_id, item.run_id) != (
                self.tenant_id,
                self.owner_user_id,
                self.run_id,
            ):
                raise ValueError("payment_evidence_identity_mismatch")
        return self


class PaymentPreviewFacts(_FrozenGateModel):
    amount: Decimal = Field(gt=0, max_digits=24, decimal_places=6)
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    payee_ref: str = Field(min_length=1, max_length=256)

    @field_validator("amount", mode="before")
    @classmethod
    def _reject_inexact_amount(cls, value: object) -> object:
        if isinstance(value, (bool, float)):
            raise ValueError("payment amount must not be bool or float")
        return value


class PaymentGateResult(_FrozenGateModel):
    decision: PaymentGateDecision
    reason_codes: tuple[str, ...]
    preview_digest: str | None = None
    owner_user_id: str | None = None
    version: int | None = None
    payment_executed: Literal[False] = False
    side_effects: tuple[str, ...] = Field(default=(), max_length=0)


class ResponsibilityAuthorityInput(_FrozenGateModel):
    task_id: str = Field(min_length=1)
    human_owner_ref: str | None = None
    responsible_ref: str | None = None
    approver_ref: str | None = None
    independent_reviewer_ref: str | None = None
    substitute_ref: str | None = None
    high_privilege: bool = False

    @field_validator(
        "task_id",
        "human_owner_ref",
        "responsible_ref",
        "approver_ref",
        "independent_reviewer_ref",
        "substitute_ref",
    )
    @classmethod
    def _strip_identity(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class ResponsibilityAuthorityProjection(_FrozenGateModel):
    """Prevalidated responsibility projection; it cannot grant appointments."""
    task_id: str = Field(min_length=1)
    tenant_id: str = Field(min_length=1)
    owner_user_id: str = Field(min_length=1)
    run_id: str = Field(min_length=1)
    projection_ref: str = Field(min_length=1)
    projection_digest: str = Field(pattern=r"^[0-9a-f]{64}$")
    role_description_ref: str = Field(min_length=1)
    appointment_record_ref: str = Field(min_length=1)
    human_owner_ref: str = Field(pattern=r"^user:[^:\s][^\s]*$")
    responsible_ref: str = Field(min_length=1)
    approver_ref: str = Field(min_length=1)
    independent_reviewer_ref: str = Field(min_length=1)
    substitute_ref: str = Field(min_length=1)
    high_privilege: bool


class ResponsibilityAuthorityResult(_FrozenGateModel):
    decision: GateDecision
    reason_codes: tuple[str, ...]
    task_id: str
    side_effects: tuple[str, ...] = Field(default=(), max_length=0)


_FINANCIAL_FIELDS = (
    ("source_ref", "FINANCIAL_SOURCE_MISSING"),
    ("period", "FINANCIAL_PERIOD_MISSING"),
    ("basis", "FINANCIAL_BASIS_MISSING"),
    ("currency", "FINANCIAL_CURRENCY_MISSING"),
)


def _present(value: str | None) -> bool:
    return bool(value and value.strip())


def evaluate_financial_grounding(
    request: FinancialGroundingInput,
    *,
    execution_identity: GateExecutionIdentity,
    trusted_evidence: FinancialEvidenceProjection,
) -> FinancialGroundingResult:
    """Require complete provenance and preserve conflicting facts as conflicts."""

    reasons: list[str] = []
    gaps: list[FinancialClaimGap] = []
    by_claim_id: dict[str, list[FinancialClaim]] = defaultdict(list)
    if (
        trusted_evidence.tenant_id,
        trusted_evidence.owner_user_id,
        trusted_evidence.run_id,
    ) != (
        execution_identity.tenant_id,
        execution_identity.owner_user_id,
        execution_identity.run_id,
    ):
        reasons.append("FINANCIAL_EVIDENCE_EXECUTION_IDENTITY_MISMATCH")
    for claim in request.claims:
        by_claim_id[claim.claim_id].append(claim)
        missing = tuple(
            field_name
            for field_name, _reason in _FINANCIAL_FIELDS
            if not _present(getattr(claim, field_name))
        )
        if missing:
            gaps.append(FinancialClaimGap(claim_id=claim.claim_id, missing_fields=missing))
        if not missing:
            trusted = next(
                (
                    item
                    for item in trusted_evidence.facts
                    if item.claim_id == claim.claim_id
                    and item.source_ref == claim.source_ref
                ),
                None,
            )
            if trusted is None:
                reasons.append("FINANCIAL_FACT_NOT_IN_TRUSTED_EVIDENCE")
            elif (claim.amount, claim.period, claim.basis, claim.currency) != (
                trusted.amount,
                trusted.period,
                trusted.basis,
                trusted.currency,
            ):
                reasons.append("FINANCIAL_FACT_EVIDENCE_MISMATCH")

    for field_name, reason in _FINANCIAL_FIELDS:
        if any(not _present(getattr(claim, field_name)) for claim in request.claims):
            reasons.append(reason)

    conflicts: list[str] = []
    for claim_id, claims in sorted(by_claim_id.items()):
        complete_claims = [
            claim
            for claim in claims
            if all(_present(getattr(claim, field)) for field, _reason in _FINANCIAL_FIELDS)
        ]
        fact_values = {
            (claim.amount, claim.period, claim.basis, claim.currency)
            for claim in complete_claims
        }
        if len(fact_values) > 1:
            conflicts.append(claim_id)
    if conflicts:
        reasons.append("FINANCIAL_FACT_CONFLICT")

    gap_ids = {gap.claim_id for gap in gaps}
    conflict_ids = set(conflicts)
    grounded = tuple(
        claim_id
        for claim_id in sorted(by_claim_id)
        if claim_id not in gap_ids
        and claim_id not in conflict_ids
        and not any(reason.startswith("FINANCIAL_FACT_") for reason in reasons)
    )
    if not request.claims:
        reasons.append("FINANCIAL_CLAIMS_MISSING")

    return FinancialGroundingResult(
        decision=GateDecision.BLOCK if reasons else GateDecision.PASS,
        reason_codes=tuple(reasons),
        grounded_claim_ids=grounded,
        conflicting_claim_ids=tuple(conflicts),
        claim_gaps=tuple(gaps),
    )


def evaluate_payment_three_gates(
    request: PaymentGateInput,
    *,
    trusted_preview: WorkProductEnvelope,
    trusted_confirmation_receipt: ConfirmationReceipt | None,
    execution_identity: GateExecutionIdentity,
    trusted_authority: PaymentAuthorityProjection,
) -> PaymentGateResult:
    """Evaluate payment prerequisites without ever gaining payment authority."""

    hold_reasons: list[str] = []
    block_reasons: list[str] = []
    if not request.contract_basis_refs:
        hold_reasons.append("PAYMENT_CONTRACT_BASIS_MISSING")
    if not request.acceptance_evidence_refs:
        hold_reasons.append("PAYMENT_ACCEPTANCE_EVIDENCE_MISSING")
    if trusted_confirmation_receipt is None:
        hold_reasons.append("PAYMENT_CONFIRMATION_MISSING")
    if (
        trusted_authority.tenant_id,
        trusted_authority.owner_user_id,
        trusted_authority.run_id,
    ) != (
        execution_identity.tenant_id,
        execution_identity.owner_user_id,
        execution_identity.run_id,
    ):
        block_reasons.append("PAYMENT_AUTHORITY_EXECUTION_IDENTITY_MISMATCH")

    # Confirmation status is the one mutable work-product axis. The immutable
    # content digest was issued while the preview was still pending confirmation.
    digest_payload = trusted_preview.model_copy(
        update={"confirmation_status": ConfirmationStatus.PENDING}
    )
    expected_digest = semantic_digest(digest_payload.model_dump(mode="python"))
    if trusted_preview.content_digest != expected_digest:
        block_reasons.append("PAYMENT_PREVIEW_DIGEST_MISMATCH")
    if not set(request.contract_basis_refs).issubset(trusted_preview.evidence_used):
        block_reasons.append("PAYMENT_CONTRACT_BASIS_UNBOUND")
    if not set(request.acceptance_evidence_refs).issubset(trusted_preview.evidence_used):
        block_reasons.append("PAYMENT_ACCEPTANCE_EVIDENCE_UNBOUND")
    try:
        preview_facts = PaymentPreviewFacts.model_validate(
            dict(trusted_preview.facts[0]) if len(trusted_preview.facts) == 1 else {}
        )
    except ValueError:
        block_reasons.append("PAYMENT_PREVIEW_FACTS_INVALID")
        preview_facts = None
    if (
        trusted_preview.capability_id != "hubu-payment-preview"
        or trusted_preview.work_status is not WorkProductStatus.READY_FOR_HUMAN_CONFIRMATION
        or trusted_preview.artifact_state is not ArtifactState.PUBLISHED
        or trusted_preview.artifact_gate.status is not ArtifactGateStatus.PASSED
    ):
        block_reasons.append("PAYMENT_PREVIEW_STATE_INVALID")

    receipt = trusted_confirmation_receipt
    if receipt is not None:
        if receipt.work_product_id != trusted_preview.work_product_id:
            block_reasons.append("PAYMENT_CONFIRMATION_PREVIEW_MISMATCH")
        if receipt.version != trusted_preview.version:
            block_reasons.append("PAYMENT_CONFIRMATION_VERSION_MISMATCH")
        if receipt.actor_ref != f"user:{trusted_preview.owner_user_id}":
            block_reasons.append("PAYMENT_CONFIRMATION_OWNER_MISMATCH")
        if receipt.decision is not ConfirmationStatus.CONFIRMED:
            block_reasons.append("PAYMENT_CONFIRMATION_DECISION_INVALID")
        if trusted_preview.confirmation_status is not ConfirmationStatus.CONFIRMED:
            block_reasons.append("PAYMENT_CONFIRMATION_STATE_MISMATCH")
        if receipt.created_at < trusted_preview.created_at:
            block_reasons.append("PAYMENT_CONFIRMATION_BEFORE_PREVIEW")

    if (
        trusted_authority.owner_user_id != trusted_preview.owner_user_id
        or trusted_authority.run_id != trusted_preview.run_id
    ):
        block_reasons.append("PAYMENT_AUTHORITY_IDENTITY_MISMATCH")
    if trusted_authority.preview_digest != trusted_preview.content_digest:
        block_reasons.append("PAYMENT_AUTHORITY_PREVIEW_DIGEST_MISMATCH")
    if receipt is not None and (
        trusted_authority.receipt_work_product_id != receipt.work_product_id
        or trusted_authority.receipt_version != receipt.version
        or trusted_authority.receipt_sequence != receipt.sequence
    ):
        block_reasons.append("PAYMENT_AUTHORITY_RECEIPT_MISMATCH")
    kinds_by_ref = {item.ref: item.kind for item in trusted_authority.evidence}
    if any(
        kinds_by_ref.get(ref) is not EvidenceKind.CONTRACT_BASIS
        for ref in request.contract_basis_refs
    ):
        block_reasons.append("PAYMENT_CONTRACT_EVIDENCE_KIND_INVALID")
    if any(
        kinds_by_ref.get(ref) is not EvidenceKind.ACCEPTANCE
        for ref in request.acceptance_evidence_refs
    ):
        block_reasons.append("PAYMENT_ACCEPTANCE_EVIDENCE_KIND_INVALID")
    if set(request.contract_basis_refs) & set(request.acceptance_evidence_refs):
        block_reasons.append("PAYMENT_EVIDENCE_ROLE_CONFLICT")
    contract_evidence = tuple(
        item
        for item in trusted_authority.evidence
        if item.ref in request.contract_basis_refs
        and item.kind is EvidenceKind.CONTRACT_BASIS
    )
    if preview_facts is not None and any(
        (
            item.authorized_amount,
            item.currency,
            item.payee_ref,
        )
        != (
            preview_facts.amount,
            preview_facts.currency,
            preview_facts.payee_ref,
        )
        for item in contract_evidence
    ):
        block_reasons.append("PAYMENT_PREVIEW_CONTRACT_TERMS_MISMATCH")

    if block_reasons:
        decision = PaymentGateDecision.BLOCK
        reasons = tuple(block_reasons)
    elif hold_reasons:
        decision = PaymentGateDecision.HOLD
        reasons = tuple(hold_reasons)
    else:
        decision = PaymentGateDecision.PREVIEW
        reasons = ()
    return PaymentGateResult(
        decision=decision,
        reason_codes=reasons,
        preview_digest=trusted_preview.content_digest,
        owner_user_id=trusted_preview.owner_user_id,
        version=trusted_preview.version,
    )


def evaluate_responsibility_authority(
    request: ResponsibilityAuthorityInput,
    *,
    execution_identity: GateExecutionIdentity,
    trusted_authority: ResponsibilityAuthorityProjection,
) -> ResponsibilityAuthorityResult:
    """Require named human accountability and separation of duties."""

    reasons: list[str] = []
    missing = (
        ("human_owner_ref", "HUMAN_OWNER_MISSING"),
        ("responsible_ref", "RESPONSIBLE_PARTY_MISSING"),
        ("approver_ref", "APPROVER_MISSING"),
        ("independent_reviewer_ref", "INDEPENDENT_REVIEWER_MISSING"),
        ("substitute_ref", "SUBSTITUTE_MISSING"),
    )
    for field_name, reason in missing:
        if getattr(request, field_name) is None:
            if request.high_privilege and field_name == "human_owner_ref":
                reasons.append("HIGH_PRIVILEGE_HUMAN_OWNER_REQUIRED")
            else:
                reasons.append(reason)

    owner_is_human = bool(
        request.human_owner_ref
        and request.human_owner_ref.startswith("user:")
        and request.human_owner_ref.removeprefix("user:").strip()
    )
    if request.human_owner_ref is not None and not owner_is_human:
        reasons.append(
            "HIGH_PRIVILEGE_HUMAN_OWNER_REQUIRED"
            if request.high_privilege
            else "HUMAN_OWNER_INVALID"
        )
    if request.responsible_ref is not None and request.responsible_ref == request.approver_ref:
        reasons.append("RESPONSIBLE_APPROVER_CONFLICT")
    reviewer = request.independent_reviewer_ref
    if reviewer is not None and reviewer in {
        request.human_owner_ref,
        request.responsible_ref,
        request.approver_ref,
    }:
        reasons.append("INDEPENDENT_REVIEWER_CONFLICT")
    substitute = request.substitute_ref
    if substitute is not None and substitute in {
        request.human_owner_ref,
        request.responsible_ref,
        request.approver_ref,
        request.independent_reviewer_ref,
    }:
        reasons.append("SUBSTITUTE_CONFLICT")
    if (
        trusted_authority.tenant_id,
        trusted_authority.owner_user_id,
        trusted_authority.run_id,
    ) != (
        execution_identity.tenant_id,
        execution_identity.owner_user_id,
        execution_identity.run_id,
    ):
        reasons.append("RESPONSIBILITY_EXECUTION_IDENTITY_MISMATCH")
    if (
        request.task_id,
        request.human_owner_ref,
        request.responsible_ref,
        request.approver_ref,
        request.independent_reviewer_ref,
        request.substitute_ref,
        request.high_privilege,
    ) != (
        trusted_authority.task_id,
        trusted_authority.human_owner_ref,
        trusted_authority.responsible_ref,
        trusted_authority.approver_ref,
        trusted_authority.independent_reviewer_ref,
        trusted_authority.substitute_ref,
        trusted_authority.high_privilege,
    ):
        reasons.append("RESPONSIBILITY_AUTHORITY_MISMATCH")

    blocking = request.high_privilege or any(
        reason.endswith("CONFLICT")
        or reason.endswith("INVALID")
        or reason == "RESPONSIBILITY_AUTHORITY_MISMATCH"
        for reason in reasons
    )
    decision = (
        GateDecision.PASS
        if not reasons
        else GateDecision.BLOCK
        if blocking
        else GateDecision.HOLD
    )
    return ResponsibilityAuthorityResult(
        decision=decision,
        reason_codes=tuple(reasons),
        task_id=request.task_id,
    )
