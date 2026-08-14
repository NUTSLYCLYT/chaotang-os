"""Compile ministry reports without inventing council authority.

The existing Chancellor graph and DraftAuthorityRegistry own approved routing.
This offline adapter therefore never accepts a caller-created "trusted order".
It validates ministry reports against the authoritative RuntimeSkill registry,
then produces a machine-readable ``DEGRADED`` CouncilReport stating that the
approved route/report store resolver has not been connected here.
"""

from __future__ import annotations

from hashlib import sha256

from app.agents.runtime_skills.executor import execute_runtime_skill
from app.agents.runtime_skills.models import (
    AgentLayer,
    CouncilReport,
    EvidenceSufficiency,
    MinistryReport,
    ReportStatus,
    RuntimeService,
    SkillInvocation,
)
from app.agents.runtime_skills.registry import build_default_downstream_skill_registry


class JointControlAdapterError(ValueError):
    """Stable fail-closed error raised before council execution."""


_DEPARTMENT_BY_AGENT = {
    "ministry-libu": "吏部",
    "ministry-hubu": "户部",
    "ministry-libu-rites": "礼部",
    "ministry-bingbu": "兵部",
    "ministry-xingbu": "刑部",
    "ministry-gongbu": "工部",
}


def compile_controlled_council_report(
    *,
    tenant_id: str,
    owner_user_id: str,
    run_id: str,
    reports: tuple[MinistryReport, ...],
) -> CouncilReport:
    """Validate report contracts and return an honest no-authority degradation."""

    if not tenant_id.strip() or not owner_user_id.strip() or not run_id.strip():
        raise JointControlAdapterError("council_execution_identity_invalid")
    if len(reports) < 2 or len(reports) > 6:
        raise JointControlAdapterError("ministry_report_count_invalid")
    report_ids = tuple(report.report_id for report in reports)
    if len(set(report_ids)) != len(report_ids):
        raise JointControlAdapterError("ministry_report_set_mismatch")

    registry = build_default_downstream_skill_registry()
    departments: list[str] = []
    issues = ["council_authority_resolver_unavailable"]
    for report in reports:
        try:
            department = _DEPARTMENT_BY_AGENT[report.agent_id]
            skill = registry.get_by_agent(report.agent_id)
        except (KeyError, ValueError) as exc:
            raise JointControlAdapterError("unknown_ministry_report") from exc
        if (
            skill.layer is not AgentLayer.MINISTRY
            or report.skill_id != skill.skill_id
            or report.skill_version != skill.version
        ):
            raise JointControlAdapterError("ministry_report_skill_binding_mismatch")
        if report.status is not ReportStatus.COMPLETED:
            issues.append(f"{department}:status:{report.status.value}")
        if report.evidence_sufficiency is not EvidenceSufficiency.SUFFICIENT:
            issues.append(f"{department}:evidence:{report.evidence_sufficiency.value}")
        if not report.evidence_refs and not report.audit_refs:
            issues.append(f"{department}:evidence_or_audit_missing")
        for field_name in (
            "selected_bureaus",
            "bureau_report_refs",
            "shared_findings",
            "ministry_position",
        ):
            if not getattr(report, field_name):
                issues.append(f"{department}:{field_name}_missing")
        issues.extend(f"{department}:data_gap:{item}" for item in report.data_gaps)
        issues.extend(f"{department}:unresolved:{item}" for item in report.unresolved_items)
        issues.extend(f"{department}:conflict:{item}" for item in report.conflicts)
        departments.append(department)
    if len(set(departments)) != len(departments):
        raise JointControlAdapterError("ministry_report_set_mismatch")

    skill = registry.get_by_agent("junjichu")
    identity_digest = sha256(
        "\0".join((tenant_id, owner_user_id, run_id, *departments)).encode()
    ).hexdigest()
    route_ref = f"council-authority-unresolved:{identity_digest}"
    distinct_issues = tuple(dict.fromkeys(issues))
    candidate = CouncilReport(
        report_id=f"council-report:{identity_digest}",
        request_id=f"council-request:{identity_digest}",
        agent_id=skill.agent_id,
        skill_id=skill.skill_id,
        skill_version=skill.version,
        subject=skill.purpose,
        executive_summary=(
            "ministry reports were contract-checked, but the approved council "
            "route and report-store authority are unavailable"
        ),
        input_refs=(route_ref, *report_ids),
        evidence_refs=tuple(
            dict.fromkeys(ref for report in reports for ref in report.evidence_refs)
        ),
        audit_refs=tuple(
            dict.fromkeys(ref for report in reports for ref in report.audit_refs)
        ),
        data_gaps=distinct_issues,
        evidence_sufficiency=EvidenceSufficiency.PARTIAL,
        status=ReportStatus.DEGRADED,
        participating_ministries=tuple(departments),
        review_order=tuple(departments),
        ministry_report_refs=report_ids,
        consensus=(),
        disagreements=(),
        cross_ministry_dependencies=(),
        joint_options=(),
        matters_for_chancellor_decision=distinct_issues,
    )
    invocation = SkillInvocation(
        request_id=candidate.request_id,
        agent_id=skill.agent_id,
        skill_id=skill.skill_id,
        skill_version=skill.version,
        input_refs=candidate.input_refs,
        evidence_refs=candidate.evidence_refs,
        requested_services=frozenset({RuntimeService.MINISTRY_AGENTS}),
        requirement_data_refs={
            skill.data_requirements[0]: (route_ref,),
            skill.data_requirements[1]: report_ids,
        },
    )
    execution = execute_runtime_skill(
        invocation,
        skill,
        {RuntimeService.MINISTRY_AGENTS: reports},
        lambda _messages: "",
        precomputed_report=candidate,
    )
    if not isinstance(execution.report, CouncilReport):
        raise JointControlAdapterError("council_runtime_skill_report_invalid")
    return execution.report
