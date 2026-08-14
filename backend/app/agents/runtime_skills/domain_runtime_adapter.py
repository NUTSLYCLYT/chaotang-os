"""Run distilled domain controls without manufacturing evidence authority.

The pure controls are useful today, but this adapter deliberately remains
``DEGRADED`` until the production Evidence Protocol supplies an owner/run-bound
resolver.  Caller-provided mappings, strings, or locally signed value objects
can never upgrade the report to ``COMPLETED``.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.agents.runtime_skills.domain_controls import (
    CommercialControlInput,
    CommunicationControlInput,
    DeliveryControlInput,
    DomainControlResult,
    GateDisposition,
    LegalControlInput,
    evaluate_commercial_control,
    evaluate_communication_control,
    evaluate_delivery_control,
    evaluate_legal_control,
)
from app.agents.runtime_skills.executor import SkillExecutionResult, execute_runtime_skill
from app.agents.runtime_skills.models import (
    BureauReport,
    EvidenceSufficiency,
    ReportStatus,
    SkillInvocation,
)
from app.agents.runtime_skills.registry import build_default_downstream_skill_registry


class DomainRuntimeAdapterError(ValueError):
    """Stable failure raised when an invocation targets the wrong RuntimeSkill."""


class DomainRuntimeResult(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    execution: SkillExecutionResult
    disposition: GateDisposition
    authority_status: Literal["resolver-unavailable"] = "resolver-unavailable"
    external_effect_authorized: Literal[False] = False


_DOMAIN_AGENTS = {
    "rites": "libu-rites-content",
    "bingbu": "bingbu-sales-opportunity",
    "xingbu": "xingbu-contracts",
    "gongbu": "gongbu-quality",
}


def _execute_domain_control(
    domain: str,
    control: DomainControlResult,
    *,
    invocation: SkillInvocation,
) -> DomainRuntimeResult:
    registry = build_default_downstream_skill_registry()
    skill = registry.get_by_agent(_DOMAIN_AGENTS[domain])
    if (
        invocation.agent_id != skill.agent_id
        or invocation.skill_id != skill.skill_id
        or invocation.skill_version != skill.version
    ):
        raise DomainRuntimeAdapterError("domain_invocation_mismatch")

    reasons = tuple(
        dict.fromkeys((*control.reason_codes, "domain_evidence_authority_unavailable"))
    )
    report = BureauReport(
        report_id=f"bureau-report:{invocation.request_id}",
        request_id=invocation.request_id,
        agent_id=skill.agent_id,
        skill_id=skill.skill_id,
        skill_version=skill.version,
        subject=skill.purpose,
        executive_summary=(
            "deterministic domain control ran, but authoritative evidence "
            "resolution is not connected"
        ),
        input_refs=invocation.input_refs,
        evidence_refs=invocation.evidence_refs,
        data_gaps=reasons,
        evidence_sufficiency=EvidenceSufficiency.INSUFFICIENT,
        status=ReportStatus.DEGRADED,
        analysis=(),
        professional_findings=(),
        risks=reasons,
        recommendations=tuple(f"resolve:{reason}" for reason in reasons),
        evidence_requests=("load owner/run-bound Evidence Protocol snapshot",),
        out_of_scope_items=("external execution",),
    )
    return DomainRuntimeResult(
        execution=execute_runtime_skill(
            invocation,
            skill,
            {},
            lambda _messages: "",
            precomputed_report=report,
        ),
        disposition=control.disposition,
    )


def execute_communication_control(
    request: CommunicationControlInput,
    *,
    invocation: SkillInvocation,
) -> DomainRuntimeResult:
    return _execute_domain_control(
        "rites", evaluate_communication_control(request), invocation=invocation
    )


def execute_commercial_control(
    request: CommercialControlInput,
    *,
    invocation: SkillInvocation,
) -> DomainRuntimeResult:
    return _execute_domain_control(
        "bingbu", evaluate_commercial_control(request), invocation=invocation
    )


def execute_legal_control(
    request: LegalControlInput,
    *,
    invocation: SkillInvocation,
) -> DomainRuntimeResult:
    return _execute_domain_control(
        "xingbu", evaluate_legal_control(request), invocation=invocation
    )


def execute_delivery_control(
    request: DeliveryControlInput,
    *,
    invocation: SkillInvocation,
) -> DomainRuntimeResult:
    return _execute_domain_control(
        "gongbu", evaluate_delivery_control(request), invocation=invocation
    )
