"""Owner-scoped accounting evidence bridge for the Hubu runtime skill.

The public entry point deliberately accepts only opaque record references and a
server-derived owner/job identity.  It reloads both authority and evidence from
their owning stores before constructing the pure-classifier values.  In
particular, callers cannot provide a ``FinancialEvidenceProjection``.

The current account model has owner isolation but no tenant authority.  The
classifier therefore receives the explicit ``owner_only`` compatibility scope;
this value is not a tenant identifier and must not be promoted as one.
"""

from __future__ import annotations

from collections.abc import Mapping
from decimal import Decimal
from typing import Literal, Protocol

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from app.accounting_reports.contract import _has_canonical_fact_semantics
from app.accounting_reports.models import AccountingFact
from app.accounting_reports.session import _ACCOUNTING_RULES_VERSION
from app.accounting_reports.storage import (
    ArtifactNotFound,
    ArtifactStorage,
    ArtifactStorageError,
)
from app.agents.runtime_skills.deterministic_gates import (
    FinancialClaim,
    FinancialEvidenceFact,
    FinancialEvidenceProjection,
    FinancialGroundingInput,
    GateDecision,
    GateExecutionIdentity,
    evaluate_financial_grounding,
)
from app.agents.runtime_skills.executor import SkillExecutionResult, execute_runtime_skill
from app.agents.runtime_skills.models import (
    BureauReport,
    EvidenceSufficiency,
    ReportStatus,
    SkillInvocation,
)
from app.agents.runtime_skills.registry import build_default_downstream_skill_registry
from app.decree_jobs.executor import _decode_authority
from app.decree_jobs.models import DecreeJob
from app.decree_jobs.storage import DecreeJobStore, DecreeJobStoreError, JobNotFound
from app.work_products import (
    ArtifactGateStatus,
    ArtifactState,
    ConfirmationStatus,
    WorkProductEnvelope,
    WorkProductStatus,
    semantic_digest,
)

ACCOUNTING_ISOLATION_SCOPE: Literal["owner_only"] = "owner_only"
_CLASSIFIER_OWNER_SCOPE = "owner-only"
_ACCOUNTING_CAPABILITY_ID = "accounting-report"
_ACCOUNTING_AGENT_ID = "hubu-accounting"
_ACCOUNTING_BUREAU = "会计司"


class AccountingEvidenceResolutionError(RuntimeError):
    """Stable, non-enumerating failure at the trusted-record boundary."""


class DecreeJobReader(Protocol):
    def get_for_owner(self, job_id: str, owner_user_id: str) -> DecreeJob: ...


class WorkProductReader(Protocol):
    def get_work_product(
        self, owner_user_id: str, work_product_id: str
    ) -> WorkProductEnvelope: ...

    def get_work_product_artifact_states(
        self, owner_user_id: str, work_product_id: str
    ) -> tuple[ArtifactState, ...]: ...


class _StoredAccountingFact(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    fact_id: str = Field(min_length=1)
    name: str = Field(min_length=1, max_length=128)
    amount: Decimal
    source_ref: str = Field(min_length=1)
    source_digest: str = Field(pattern=r"^[0-9a-f]{64}$")
    rule_id: str = Field(min_length=1)
    source_human_confirmed: bool

    @field_validator("amount", mode="before")
    @classmethod
    def _reject_inexact_amount(cls, value: object) -> object:
        if isinstance(value, (bool, float)):
            raise ValueError("accounting amount must not be bool or float")
        return value

    @field_validator("amount")
    @classmethod
    def _require_finite_amount(cls, value: Decimal) -> Decimal:
        if not value.is_finite():
            raise ValueError("accounting amount must be finite")
        return value

    @field_validator("fact_id", "name", "source_ref", "rule_id")
    @classmethod
    def _strip_nonblank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("accounting fact fields must not be blank")
        return stripped


def _load_job(
    store: DecreeJobReader,
    *,
    owner_user_id: str,
    job_id: str,
) -> DecreeJob:
    try:
        job = store.get_for_owner(job_id, owner_user_id)
    except (JobNotFound, DecreeJobStoreError, OSError, ValueError):
        raise AccountingEvidenceResolutionError(
            "accounting_evidence_unavailable"
        ) from None
    if job.owner_user_id != owner_user_id or job.job_id != job_id:
        raise AccountingEvidenceResolutionError(
            "accounting_evidence_unavailable"
        )
    return job


def _load_work_product(
    storage: WorkProductReader,
    *,
    owner_user_id: str,
    work_product_id: str,
) -> WorkProductEnvelope:
    try:
        product = storage.get_work_product(owner_user_id, work_product_id)
    except (ArtifactNotFound, ArtifactStorageError, OSError, ValueError):
        raise AccountingEvidenceResolutionError(
            "accounting_evidence_unavailable"
        ) from None
    if (
        product.owner_user_id != owner_user_id
        or product.work_product_id != work_product_id
    ):
        raise AccountingEvidenceResolutionError(
            "accounting_evidence_unavailable"
        )
    return product


def _authority_period_and_route(job: DecreeJob) -> str:
    try:
        authority = _decode_authority(job.approved_route_json)
    except Exception:
        raise AccountingEvidenceResolutionError(
            "accounting_authority_invalid"
        ) from None
    hubu_routes = tuple(
        item for item in authority.route_snapshot.departments if item.department == "户部"
    )
    if (
        len(hubu_routes) != 1
        or _ACCOUNTING_BUREAU not in hubu_routes[0].required_bureaus
    ):
        raise AccountingEvidenceResolutionError(
            "accounting_route_unauthorized"
        )
    context = authority.accounting_context
    if context is None:
        raise AccountingEvidenceResolutionError(
            "accounting_authority_invalid"
        )
    period = context.period
    return (
        str(period.start_year)
        if period.start_year == period.end_year
        else f"{period.start_year}-{period.end_year}"
    )


def _require_product_integrity(
    product: WorkProductEnvelope,
    job: DecreeJob,
    *,
    artifact_states: tuple[ArtifactState, ...],
) -> None:
    if product.run_id != job.job_id:
        raise AccountingEvidenceResolutionError(
            "accounting_execution_identity_mismatch"
        )
    if product.capability_id != _ACCOUNTING_CAPABILITY_ID:
        raise AccountingEvidenceResolutionError(
            "accounting_work_product_invalid"
        )
    if (
        product.work_status is not WorkProductStatus.READY_FOR_HUMAN_CONFIRMATION
        or product.confirmation_status
        not in {ConfirmationStatus.PENDING, ConfirmationStatus.CONFIRMED}
        or not artifact_states
        or ArtifactState.ABORTED in artifact_states
        or product.missing_evidence
        or product.conflicts
    ):
        raise AccountingEvidenceResolutionError(
            "accounting_work_product_lifecycle_invalid"
        )
    # Human confirmation is persisted as a separate append-only receipt.  The
    # immutable preview digest was issued while this mutable axis was PENDING,
    # so normalize it before verifying the professional content.
    digest_payload = product.model_copy(
        update={"confirmation_status": ConfirmationStatus.PENDING}
    )
    expected_digest = semantic_digest(digest_payload.model_dump(mode="python"))
    if product.content_digest != expected_digest:
        raise AccountingEvidenceResolutionError(
            "accounting_evidence_integrity_invalid"
        )
    if product.artifact_gate.status is not ArtifactGateStatus.PASSED:
        raise AccountingEvidenceResolutionError(
            "accounting_evidence_integrity_invalid"
        )


def _parse_facts(
    values: tuple[Mapping[str, object], ...],
) -> tuple[_StoredAccountingFact, ...]:
    parsed: list[_StoredAccountingFact] = []
    seen: set[tuple[str, str]] = set()
    try:
        for value in values:
            fact = _StoredAccountingFact.model_validate(dict(value))
            domain_fact = AccountingFact(
                fact_id=fact.fact_id,
                name=fact.name,
                amount=fact.amount,
                source_ref=fact.source_ref,
                source_digest=fact.source_digest,
                rule_id=fact.rule_id,
                source_human_confirmed=fact.source_human_confirmed,
            )
            if not _has_canonical_fact_semantics(
                domain_fact, _ACCOUNTING_RULES_VERSION
            ):
                raise ValueError("noncanonical accounting fact")
            key = (fact.fact_id, fact.source_ref)
            if key in seen:
                raise ValueError("duplicate accounting fact")
            seen.add(key)
            parsed.append(fact)
    except (TypeError, ValueError, ValidationError):
        raise AccountingEvidenceResolutionError(
            "accounting_evidence_integrity_invalid"
        ) from None
    return tuple(parsed)


def _classifier_values(
    facts: tuple[_StoredAccountingFact, ...],
    *,
    owner_user_id: str,
    run_id: str,
    period: str,
) -> tuple[FinancialGroundingInput, GateExecutionIdentity, FinancialEvidenceProjection]:
    identity = GateExecutionIdentity(
        tenant_id=_CLASSIFIER_OWNER_SCOPE,
        owner_user_id=owner_user_id,
        run_id=run_id,
    )
    claims = tuple(
        FinancialClaim(
            claim_id=fact.fact_id,
            amount=fact.amount,
            source_ref=fact.source_ref,
            period=period,
            basis=fact.rule_id,
            # AccountingReportSession currently accepts and persists CNY-only
            # ledger facts.  This compatibility value must be replaced by a
            # persisted source-receipt currency before multi-currency support.
            currency="CNY",
        )
        for fact in facts
    )
    projection_facts = tuple(
        FinancialEvidenceFact(
            claim_id=claim.claim_id,
            source_ref=claim.source_ref or "",
            requirement_key=fact.rule_id,
            amount=claim.amount,
            period=claim.period or "",
            basis=claim.basis or "",
            currency=claim.currency or "",
            tenant_id=identity.tenant_id,
            owner_user_id=identity.owner_user_id,
            run_id=identity.run_id,
        )
        for claim, fact in zip(claims, facts, strict=True)
    )
    return (
        FinancialGroundingInput(claims=claims),
        identity,
        FinancialEvidenceProjection(
            tenant_id=identity.tenant_id,
            owner_user_id=identity.owner_user_id,
            run_id=identity.run_id,
            facts=projection_facts,
        ),
    )


def _trusted_invocation(
    invocation: SkillInvocation,
    *,
    facts: tuple[_StoredAccountingFact, ...],
    work_product_id: str,
    data_requirements: tuple[str, ...],
) -> SkillInvocation:
    trusted_refs = tuple(dict.fromkeys(fact.source_ref for fact in facts))
    return invocation.model_copy(
        update={
            "input_refs": (f"work-product:{work_product_id}",),
            "evidence_refs": trusted_refs,
            "requirement_data_refs": {
                requirement: (trusted_refs[index],)
                for index, requirement in enumerate(data_requirements)
                if index < len(trusted_refs)
            },
        }
    )


def execute_accounting_evidence_gate(
    *,
    owner_user_id: str,
    job_id: str,
    work_product_id: str,
    invocation: SkillInvocation,
    decree_job_store: DecreeJobReader | DecreeJobStore,
    artifact_storage: WorkProductReader | ArtifactStorage,
) -> SkillExecutionResult:
    """Reload, verify and classify one accounting WorkProduct without side effects."""

    skill = build_default_downstream_skill_registry().get_by_agent(
        _ACCOUNTING_AGENT_ID
    )
    if (
        invocation.agent_id != skill.agent_id
        or invocation.skill_id != skill.skill_id
        or invocation.skill_version != skill.version
    ):
        raise AccountingEvidenceResolutionError(
            "accounting_gate_invocation_mismatch"
        )
    job = _load_job(
        decree_job_store,
        owner_user_id=owner_user_id,
        job_id=job_id,
    )
    period = _authority_period_and_route(job)
    product = _load_work_product(
        artifact_storage,
        owner_user_id=owner_user_id,
        work_product_id=work_product_id,
    )
    try:
        artifact_states = artifact_storage.get_work_product_artifact_states(
            owner_user_id, work_product_id
        )
    except (ArtifactNotFound, ArtifactStorageError):
        raise AccountingEvidenceResolutionError(
            "record_not_found_or_not_authorized"
        ) from None
    _require_product_integrity(product, job, artifact_states=artifact_states)
    facts = _parse_facts(product.facts)
    if facts and not {
        fact.source_digest for fact in facts
    }.issubset(product.evidence_used):
        raise AccountingEvidenceResolutionError(
            "accounting_evidence_integrity_invalid"
        )
    trusted_invocation = _trusted_invocation(
        invocation,
        facts=facts,
        work_product_id=work_product_id,
        data_requirements=skill.data_requirements,
    )

    if facts:
        request, identity, projection = _classifier_values(
            facts,
            owner_user_id=job.owner_user_id,
            run_id=job.job_id,
            period=period,
        )
        verdict = evaluate_financial_grounding(
            request,
            execution_identity=identity,
            trusted_evidence=projection,
        )
        passed = verdict.decision is GateDecision.PASS
        reason_codes = verdict.reason_codes
        grounded = verdict.grounded_claim_ids
    else:
        passed = False
        reason_codes = ("FINANCIAL_CLAIMS_MISSING",)
        grounded = ()

    report = BureauReport(
        report_id=f"bureau-report:{invocation.request_id}",
        request_id=invocation.request_id,
        parent_report_id=invocation.parent_report_id,
        agent_id=skill.agent_id,
        skill_id=skill.skill_id,
        skill_version=skill.version,
        subject="owner-scoped accounting evidence grounding",
        executive_summary=(
            "stored accounting facts passed deterministic provenance checks"
            if passed
            else "stored accounting facts did not satisfy deterministic provenance checks"
        ),
        input_refs=trusted_invocation.input_refs,
        data_sources=tuple(dict.fromkeys(fact.source_digest for fact in facts)),
        evidence_refs=trusted_invocation.evidence_refs,
        data_gaps=() if passed else reason_codes,
        evidence_sufficiency=(
            EvidenceSufficiency.SUFFICIENT
            if passed
            else EvidenceSufficiency.INSUFFICIENT
        ),
        status=ReportStatus.COMPLETED if passed else ReportStatus.DEGRADED,
        analysis=tuple(f"grounded:{claim_id}" for claim_id in grounded),
        professional_findings=tuple(
            f"accounting_fact:{claim_id}" for claim_id in grounded
        ),
        risks=() if passed else reason_codes,
        recommendations=(
            ("retain the verified accounting evidence bindings",)
            if passed
            else tuple(f"resolve:{reason}" for reason in reason_codes)
        ),
        evidence_requests=() if passed else reason_codes,
        out_of_scope_items=("posting, payment, tax filing, or any external action",),
    )
    return execute_runtime_skill(
        trusted_invocation,
        skill,
        {},
        lambda _messages: "",
        precomputed_report=report,
    )


__all__ = (
    "ACCOUNTING_ISOLATION_SCOPE",
    "AccountingEvidenceResolutionError",
    "execute_accounting_evidence_gate",
)
