"""Route deterministic gate requests through RuntimeSkill without self-authority.

These adapters are intentionally honest offline seams.  The pure evaluators in
``deterministic_gates`` implement the business rules, while production reports
remain ``DEGRADED`` until a real evidence or appointment authority store can
reload the referenced records.  No caller-provided object can mint that trust.
"""

from __future__ import annotations

from app.agents.runtime_skills.deterministic_gates import (
    FinancialGroundingInput,
    ResponsibilityAuthorityInput,
)
from app.agents.runtime_skills.executor import SkillExecutionResult, execute_runtime_skill
from app.agents.runtime_skills.models import (
    BureauReport,
    EvidenceSufficiency,
    ReportStatus,
    SkillInvocation,
)
from app.agents.runtime_skills.registry import build_default_downstream_skill_registry


def _degraded_gate_report(
    *,
    invocation: SkillInvocation,
    agent_id: str,
    reason_code: str,
) -> SkillExecutionResult:
    skill = build_default_downstream_skill_registry().get_by_agent(agent_id)
    if (
        invocation.agent_id != skill.agent_id
        or invocation.skill_id != skill.skill_id
        or invocation.skill_version != skill.version
    ):
        raise ValueError("gate_invocation_mismatch")
    report = BureauReport(
        report_id=f"bureau-report:{invocation.request_id}",
        request_id=invocation.request_id,
        agent_id=skill.agent_id,
        skill_id=skill.skill_id,
        skill_version=skill.version,
        subject=skill.purpose,
        executive_summary="deterministic gate ran without a production authority resolver",
        input_refs=invocation.input_refs,
        evidence_refs=invocation.evidence_refs,
        data_gaps=(reason_code,),
        evidence_sufficiency=EvidenceSufficiency.INSUFFICIENT,
        status=ReportStatus.DEGRADED,
        analysis=(),
        professional_findings=(),
        risks=(reason_code,),
        recommendations=(f"resolve:{reason_code}",),
        evidence_requests=("load records through the server-owned authority resolver",),
        out_of_scope_items=("external execution",),
    )
    return execute_runtime_skill(
        invocation,
        skill,
        {},
        lambda _messages: "",
        precomputed_report=report,
    )


def execute_financial_grounding_gate(
    request: FinancialGroundingInput,
    *,
    invocation: SkillInvocation,
) -> SkillExecutionResult:
    """Run the accounting seam without treating request facts as verified facts."""

    del request
    return _degraded_gate_report(
        invocation=invocation,
        agent_id="hubu-accounting",
        reason_code="financial_evidence_resolver_unavailable",
    )


def execute_responsibility_authority_gate(
    request: ResponsibilityAuthorityInput,
    *,
    invocation: SkillInvocation,
) -> SkillExecutionResult:
    """Run the appointment seam without accepting caller-created authority."""

    del request
    return _degraded_gate_report(
        invocation=invocation,
        agent_id="libu-appointments",
        reason_code="responsibility_authority_resolver_unavailable",
    )
