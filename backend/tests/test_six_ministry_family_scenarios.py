from __future__ import annotations

import pytest

from app.agents.runtime_skills.executor import execute_runtime_skill
from app.agents.runtime_skills.family_runtime import (
    FamilyCandidateAssertion,
    FamilyRuntimeError,
    FamilyRuntimeStatus,
    execute_capability_family,
    load_capability_family_bindings,
)
from app.agents.runtime_skills.models import (
    BureauReport,
    CouncilReport,
    EvidenceSufficiency,
    MinistryReport,
    ReportStatus,
    SkillInvocation,
)
from app.agents.runtime_skills.registry import build_default_downstream_skill_registry


@pytest.mark.parametrize(
    "family_id",
    [item.family_id for item in load_capability_family_bindings()],
)
def test_every_family_has_an_honest_missing_evidence_scenario(family_id: str) -> None:
    result = execute_capability_family(
        family_id,
        tenant_id="tenant-synthetic",
        owner_user_id="owner-synthetic",
        run_id=f"run:{family_id}",
        candidate_refs=(),
    )

    assert result.status is FamilyRuntimeStatus.DEGRADED
    assert result.reason_codes == ("authoritative_requirement_coverage_missing",)
    assert result.missing_requirements
    assert result.external_effect_authorized is False


@pytest.mark.parametrize(
    "family_id",
    [item.family_id for item in load_capability_family_bindings()],
)
def test_every_family_rejects_an_untrusted_reference_scenario(family_id: str) -> None:
    with pytest.raises(FamilyRuntimeError, match="candidate_ref_invalid"):
        execute_capability_family(
            family_id,
            tenant_id="tenant-synthetic",
            owner_user_id="owner-synthetic",
            run_id=f"run:{family_id}",
            candidate_refs=("model://self-approved",),
        )


@pytest.mark.parametrize(
    "family_id",
    [item.family_id for item in load_capability_family_bindings()],
)
def test_every_family_detects_structured_candidate_conflicts_and_stays_degraded(
    family_id: str,
) -> None:
    first_ref = f"evidence:{family_id}:claim-a:first"
    second_ref = f"evidence:{family_id}:claim-a:second"
    result = execute_capability_family(
        family_id,
        tenant_id="tenant-synthetic",
        owner_user_id="owner-synthetic",
        run_id=f"run:{family_id}",
        candidate_refs=(first_ref, second_ref),
        candidate_assertions=(
            FamilyCandidateAssertion(
                assertion_id=f"assertion:{family_id}:first",
                subject="shared-business-claim",
                value_digest=f"sha256:{'1' * 64}",
                source_ref=first_ref,
            ),
            FamilyCandidateAssertion(
                assertion_id=f"assertion:{family_id}:second",
                subject="shared-business-claim",
                value_digest=f"sha256:{'2' * 64}",
                source_ref=second_ref,
            ),
        ),
    )

    assert result.status is FamilyRuntimeStatus.DEGRADED
    assert result.reason_codes == (
        "candidate_assertion_conflict_unresolved",
        "authoritative_requirement_coverage_missing",
    )
    assert result.external_effect_authorized is False


def _synthetic_completed_report(skill, request_id: str, refs: tuple[str, ...]):
    common = {
        "report_id": f"synthetic-report:{request_id}",
        "request_id": request_id,
        "agent_id": skill.agent_id,
        "skill_id": skill.skill_id,
        "skill_version": skill.version,
        "subject": skill.purpose,
        "executive_summary": "synthetic contract exercise; not a business conclusion",
        "input_refs": refs,
        "evidence_refs": refs,
        "data_gaps": (),
        "evidence_sufficiency": EvidenceSufficiency.SUFFICIENT,
        "status": ReportStatus.COMPLETED,
    }
    if skill.report_type is BureauReport:
        return BureauReport(
            **common,
            analysis=("synthetic approved inputs validated",),
            professional_findings=("contract_shape_exercised",),
            risks=("synthetic_only",),
            recommendations=("obtain real evidence before business use",),
        )
    if skill.report_type is MinistryReport:
        return MinistryReport(
            **common,
            selected_bureaus=("synthetic-bureau",),
            selection_reasons=("contract exercise",),
            bureau_report_refs=(refs[1],),
            shared_findings=("contract_shape_exercised",),
            conflicts=(),
            cross_bureau_impacts=(),
            ministry_position=("synthetic_only",),
            unresolved_items=(),
        )
    return CouncilReport(
        **common,
        participating_ministries=("synthetic-a", "synthetic-b"),
        review_order=("synthetic-a", "synthetic-b"),
        ministry_report_refs=(refs[1],),
        consensus=("contract_shape_exercised",),
        disagreements=(),
        cross_ministry_dependencies=(),
        joint_options=("synthetic_only",),
        matters_for_chancellor_decision=(),
    )


@pytest.mark.parametrize(
    "binding",
    load_capability_family_bindings(),
    ids=lambda item: item.family_id,
)
def test_every_family_exercises_every_runtime_contract_shape_without_business_claim(
    binding,
) -> None:
    registry = build_default_downstream_skill_registry()
    for skill_id in binding.runtime_skill_ids:
        skill = registry.get(skill_id)
        refs = tuple(
            f"approved:{binding.family_id}:{skill_id}:{index}"
            for index in range(len(skill.data_requirements))
        )
        invocation = SkillInvocation(
            request_id=f"synthetic:{binding.family_id}:{skill_id}",
            agent_id=skill.agent_id,
            skill_id=skill.skill_id,
            skill_version=skill.version,
            input_refs=refs,
            evidence_refs=refs,
            requirement_data_refs={
                requirement: (refs[index],)
                for index, requirement in enumerate(skill.data_requirements)
            },
        )
        result = execute_runtime_skill(
            invocation,
            skill,
            {},
            lambda _messages: "",
            precomputed_report=_synthetic_completed_report(skill, invocation.request_id, refs),
        )

        assert result.report.status is ReportStatus.COMPLETED
        assert result.audit.status is ReportStatus.COMPLETED
        assert result.report.executive_summary.startswith("synthetic contract exercise")
