from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.agents.runtime_skills.domain_controls import (
    BoundMinistryReport,
    ClaimKind,
    CommercialControlInput,
    CommunicationControlInput,
    DeliveryControlInput,
    EffectIntent,
    EvidenceClaim,
    GateDisposition,
    JointReviewInput,
    LegalControlInput,
    evaluate_commercial_control,
    evaluate_communication_control,
    evaluate_delivery_control,
    evaluate_joint_review,
    evaluate_legal_control,
)
from app.agents.runtime_skills.domain_runtime_adapter import (
    execute_commercial_control,
    execute_communication_control,
    execute_delivery_control,
    execute_legal_control,
)
from app.agents.runtime_skills.family_runtime import (
    FamilyRuntimeStatus,
    execute_capability_family,
    load_capability_family_bindings,
)
from app.agents.runtime_skills.gate_runtime_adapter import (
    execute_financial_grounding_gate,
    execute_responsibility_authority_gate,
)
from app.agents.runtime_skills.models import (
    CouncilReport,
    EvidenceSufficiency,
    MinistryReport,
    ReportStatus,
    SkillInvocation,
)
from app.agents.runtime_skills.registry import build_default_downstream_skill_registry


def _claim(*, evidence: tuple[str, ...] = ("evidence:fact-1",)) -> EvidenceClaim:
    return EvidenceClaim(
        claim_id="claim-1",
        kind=ClaimKind.FACT,
        text="The approved source records a value of 100.",
        evidence_refs=evidence,
    )


def test_rites_communication_remains_a_grounded_draft() -> None:
    result = evaluate_communication_control(
        CommunicationControlInput(
            tenant_id="tenant-1",
            owner_user_id="owner-1",
            run_id="run-1",
            channel="website",
            claims=(_claim(),),
            requested_effect=EffectIntent.DRAFT,
        )
    )

    assert result.disposition is GateDisposition.DRAFT
    assert result.reason_codes == ("human_review_required",)
    assert result.external_effect_authorized is False


def test_rites_communication_holds_missing_fact_evidence_and_blocks_publish() -> None:
    missing = evaluate_communication_control(
        CommunicationControlInput(
            tenant_id="tenant-1",
            owner_user_id="owner-1",
            run_id="run-1",
            channel="press",
            claims=(_claim(evidence=()),),
            requested_effect=EffectIntent.DRAFT,
        )
    )
    publish = evaluate_communication_control(
        CommunicationControlInput(
            tenant_id="tenant-1",
            owner_user_id="owner-1",
            run_id="run-1",
            channel="press",
            claims=(_claim(),),
            requested_effect=EffectIntent.EXTERNAL_WRITE,
        )
    )

    assert missing.disposition is GateDisposition.HOLD
    assert missing.reason_codes == ("factual_claim_evidence_missing",)
    assert publish.disposition is GateDisposition.BLOCK
    assert publish.reason_codes == ("external_communications_forbidden",)


def test_bingbu_requires_customer_truth_and_keeps_outreach_as_draft() -> None:
    missing = evaluate_commercial_control(
        CommercialControlInput(
            tenant_id="tenant-1",
            owner_user_id="owner-1",
            run_id="run-1",
            opportunity_id="opp-1",
            stage="qualified",
            customer_evidence_refs=(),
            pricing_evidence_refs=("evidence:price-1",),
            requested_effect=EffectIntent.DRAFT,
        )
    )
    grounded = evaluate_commercial_control(
        CommercialControlInput(
            tenant_id="tenant-1",
            owner_user_id="owner-1",
            run_id="run-1",
            opportunity_id="opp-1",
            stage="qualified",
            customer_evidence_refs=("evidence:customer-1",),
            pricing_evidence_refs=("evidence:price-1",),
            requested_effect=EffectIntent.DRAFT,
        )
    )

    assert missing.disposition is GateDisposition.HOLD
    assert "customer_intent_evidence_missing" in missing.reason_codes
    assert grounded.disposition is GateDisposition.DRAFT
    assert grounded.external_effect_authorized is False


def test_bingbu_never_sends_or_commits_from_the_control() -> None:
    result = evaluate_commercial_control(
        CommercialControlInput(
            tenant_id="tenant-1",
            owner_user_id="owner-1",
            run_id="run-1",
            opportunity_id="opp-1",
            stage="proposal",
            customer_evidence_refs=("evidence:customer-1",),
            pricing_evidence_refs=("evidence:price-1",),
            requested_effect=EffectIntent.EXTERNAL_WRITE,
        )
    )

    assert result.disposition is GateDisposition.BLOCK
    assert result.reason_codes == ("commercial_external_action_forbidden",)


def test_xingbu_requires_contract_and_rules_and_never_signs() -> None:
    held = evaluate_legal_control(
        LegalControlInput(
            tenant_id="tenant-1",
            owner_user_id="owner-1",
            run_id="run-1",
            contract_ref="contract:v1",
            applicable_rule_refs=(),
            approval_record_ref=None,
            requested_effect=EffectIntent.ANALYSIS,
        )
    )
    blocked = evaluate_legal_control(
        LegalControlInput(
            tenant_id="tenant-1",
            owner_user_id="owner-1",
            run_id="run-1",
            contract_ref="contract:v1",
            applicable_rule_refs=("rule:approved-1",),
            approval_record_ref="approval:1",
            requested_effect=EffectIntent.IRREVERSIBLE,
        )
    )

    assert held.disposition is GateDisposition.HOLD
    assert held.reason_codes == (
        "applicable_rules_missing",
        "approval_record_missing",
    )
    assert blocked.disposition is GateDisposition.BLOCK
    assert blocked.reason_codes == ("legal_execution_forbidden",)


def test_gongbu_fails_closed_on_open_critical_defects_or_missing_rollback() -> None:
    critical = evaluate_delivery_control(
        DeliveryControlInput(
            tenant_id="tenant-1",
            owner_user_id="owner-1",
            run_id="run-1",
            acceptance_criteria_refs=("criteria:1",),
            test_evidence_refs=("test:1",),
            open_critical_defects=1,
            rollback_plan_ref="rollback:1",
            requested_effect=EffectIntent.ANALYSIS,
        )
    )
    missing_rollback = evaluate_delivery_control(
        DeliveryControlInput(
            tenant_id="tenant-1",
            owner_user_id="owner-1",
            run_id="run-1",
            acceptance_criteria_refs=("criteria:1",),
            test_evidence_refs=("test:1",),
            open_critical_defects=0,
            rollback_plan_ref=None,
            requested_effect=EffectIntent.ANALYSIS,
        )
    )

    assert critical.disposition is GateDisposition.BLOCK
    assert critical.reason_codes == ("critical_defects_open",)
    assert missing_rollback.disposition is GateDisposition.HOLD
    assert missing_rollback.reason_codes == ("rollback_plan_missing",)


def test_gongbu_readiness_is_analysis_only() -> None:
    ready = evaluate_delivery_control(
        DeliveryControlInput(
            tenant_id="tenant-1",
            owner_user_id="owner-1",
            run_id="run-1",
            acceptance_criteria_refs=("criteria:1",),
            test_evidence_refs=("test:1",),
            open_critical_defects=0,
            rollback_plan_ref="rollback:1",
            requested_effect=EffectIntent.ANALYSIS,
        )
    )
    deploy = evaluate_delivery_control(
        DeliveryControlInput(
            tenant_id="tenant-1",
            owner_user_id="owner-1",
            run_id="run-1",
            acceptance_criteria_refs=("criteria:1",),
            test_evidence_refs=("test:1",),
            open_critical_defects=0,
            rollback_plan_ref="rollback:1",
            requested_effect=EffectIntent.SYSTEM_WRITE,
        )
    )

    assert ready.disposition is GateDisposition.READY
    assert deploy.disposition is GateDisposition.BLOCK
    assert deploy.reason_codes == ("delivery_execution_forbidden",)


def _report(ministry: str, *, owner: str = "owner-1") -> BoundMinistryReport:
    return BoundMinistryReport(
        ministry=ministry,
        report_ref=f"ministry-report:{ministry}",
        tenant_id="tenant-1",
        owner_user_id=owner,
        run_id="run-1",
    )


def test_multi_ministry_review_requires_junjichu_and_exact_bound_reports() -> None:
    no_council = evaluate_joint_review(
        JointReviewInput(
            tenant_id="tenant-1",
            owner_user_id="owner-1",
            run_id="run-1",
            participating_ministries=("户部", "刑部"),
            reports=(_report("户部"), _report("刑部")),
            reviewer="户部",
            unresolved_conflicts=(),
            requested_effect=EffectIntent.ANALYSIS,
        )
    )
    wrong_owner = evaluate_joint_review(
        JointReviewInput(
            tenant_id="tenant-1",
            owner_user_id="owner-1",
            run_id="run-1",
            participating_ministries=("户部", "刑部"),
            reports=(_report("户部"), _report("刑部", owner="owner-2")),
            reviewer="junjichu",
            unresolved_conflicts=(),
            requested_effect=EffectIntent.ANALYSIS,
        )
    )

    assert no_council.disposition is GateDisposition.BLOCK
    assert no_council.reason_codes == ("junjichu_review_required",)
    assert wrong_owner.disposition is GateDisposition.BLOCK
    assert wrong_owner.reason_codes == ("report_identity_binding_mismatch",)


def test_multi_ministry_review_passes_only_with_exact_reports_and_no_conflict() -> None:
    result = evaluate_joint_review(
        JointReviewInput(
            tenant_id="tenant-1",
            owner_user_id="owner-1",
            run_id="run-1",
            participating_ministries=("户部", "刑部"),
            reports=(_report("户部"), _report("刑部")),
            reviewer="junjichu",
            unresolved_conflicts=(),
            requested_effect=EffectIntent.ANALYSIS,
        )
    )

    assert result.disposition is GateDisposition.READY
    assert result.reason_codes == ()


def test_contracts_are_frozen_and_reject_unknown_fields() -> None:
    with pytest.raises(ValidationError):
        CommunicationControlInput(
            tenant_id="tenant-1",
            owner_user_id="owner-1",
            run_id="run-1",
            channel="press",
            claims=(_claim(),),
            requested_effect=EffectIntent.DRAFT,
            model_approved=True,
        )

    value = _claim()
    with pytest.raises(ValidationError):
        value.text = "changed"


def _domain_invocation(agent_id: str, *, request_id: str) -> SkillInvocation:
    skill = build_default_downstream_skill_registry().get_by_agent(agent_id)
    refs = tuple(f"approved:{agent_id}:{index}" for index in range(2))
    return SkillInvocation(
        request_id=request_id,
        agent_id=skill.agent_id,
        skill_id=skill.skill_id,
        skill_version=skill.version,
        input_refs=(refs[0],),
        evidence_refs=(refs[1],),
        requirement_data_refs={
            requirement: (refs[index],)
            for index, requirement in enumerate(skill.data_requirements)
        },
    )


@pytest.mark.parametrize(
    ("executor", "agent_id", "control_input"),
    (
        (
            execute_communication_control,
            "libu-rites-content",
            CommunicationControlInput(
                tenant_id="tenant-1",
                owner_user_id="owner-1",
                run_id="run-1",
                channel="website",
                claims=(_claim(),),
                requested_effect=EffectIntent.DRAFT,
            ),
        ),
        (
            execute_commercial_control,
            "bingbu-sales-opportunity",
            CommercialControlInput(
                tenant_id="tenant-1",
                owner_user_id="owner-1",
                run_id="run-1",
                opportunity_id="opp-1",
                stage="qualified",
                customer_evidence_refs=("evidence:customer-1",),
                pricing_evidence_refs=("evidence:price-1",),
                requested_effect=EffectIntent.DRAFT,
            ),
        ),
        (
            execute_legal_control,
            "xingbu-contracts",
            LegalControlInput(
                tenant_id="tenant-1",
                owner_user_id="owner-1",
                run_id="run-1",
                contract_ref="contract:1",
                applicable_rule_refs=("rule:1",),
                approval_record_ref="approval:1",
                requested_effect=EffectIntent.ANALYSIS,
            ),
        ),
        (
            execute_delivery_control,
            "gongbu-quality",
            DeliveryControlInput(
                tenant_id="tenant-1",
                owner_user_id="owner-1",
                run_id="run-1",
                acceptance_criteria_refs=("acceptance:1",),
                test_evidence_refs=("test:1",),
                open_critical_defects=0,
                rollback_plan_ref="rollback:1",
                requested_effect=EffectIntent.ANALYSIS,
            ),
        ),
    ),
)
def test_four_domain_controls_run_through_authoritative_bureau_runtime(
    executor, agent_id: str, control_input
) -> None:
    result = executor(
        control_input,
        invocation=_domain_invocation(agent_id, request_id=f"request:{agent_id}"),
    )

    assert result.execution.report.status is ReportStatus.DEGRADED
    assert result.execution.report.agent_id == agent_id
    assert result.execution.audit.status is ReportStatus.DEGRADED
    assert "domain_evidence_authority_unavailable" in result.execution.report.data_gaps
    assert result.authority_status == "resolver-unavailable"
    assert result.external_effect_authorized is False


def test_four_domain_runtime_controls_reject_external_effects_as_degraded() -> None:
    request = CommunicationControlInput(
        tenant_id="tenant-1",
        owner_user_id="owner-1",
        run_id="run-1",
        channel="press",
        claims=(_claim(),),
        requested_effect=EffectIntent.EXTERNAL_WRITE,
    )
    result = execute_communication_control(
        request,
        invocation=_domain_invocation(
            "libu-rites-content", request_id="request:external"
        ),
    )

    assert result.execution.report.status is ReportStatus.DEGRADED
    assert "external_communications_forbidden" in result.execution.report.data_gaps


def _runtime_ministry_report(
    department: str, *, status: ReportStatus = ReportStatus.COMPLETED
) -> MinistryReport:
    slug = {"户部": "hubu", "刑部": "xingbu"}[department]
    return MinistryReport(
        report_id=f"ministry-report:{slug}",
        request_id="request:six-ministry",
        agent_id=f"ministry-{slug}",
        skill_id={
            "户部": "synthesize-finance-governance",
            "刑部": "synthesize-risk-governance",
        }[department],
        skill_version="1.0.0",
        subject=department,
        executive_summary=f"{department} structured opinion",
        input_refs=(f"bureau-report:{slug}",),
        evidence_refs=(f"evidence:{slug}",),
        data_gaps=() if status is ReportStatus.COMPLETED else ("missing approval",),
        evidence_sufficiency=(
            EvidenceSufficiency.SUFFICIENT
            if status is ReportStatus.COMPLETED
            else EvidenceSufficiency.PARTIAL
        ),
        status=status,
        selected_bureaus=("测试司",),
        selection_reasons=("approved",),
        bureau_report_refs=(f"bureau-report:{slug}",),
        shared_findings=(f"{department} finding",),
        conflicts=(),
        cross_bureau_impacts=(),
        ministry_position=(f"{department} position",),
        unresolved_items=(),
    )


def test_joint_control_contract_checks_reports_but_requires_real_authority_store() -> None:
    from app.agents.runtime_skills.joint_control_adapter import compile_controlled_council_report

    hubu = _runtime_ministry_report("户部")
    xingbu = _runtime_ministry_report("刑部")
    result = compile_controlled_council_report(
        tenant_id="tenant-1",
        owner_user_id="owner-1",
        run_id="run-1",
        reports=(hubu, xingbu),
    )

    assert isinstance(result, CouncilReport)
    assert result.status is ReportStatus.DEGRADED
    assert result.participating_ministries == ("户部", "刑部")
    assert result.ministry_report_refs == (hubu.report_id, xingbu.report_id)
    assert "council_authority_resolver_unavailable" in result.data_gaps
    assert result.consensus == ()


def test_joint_control_degrades_real_council_when_a_ministry_is_not_complete() -> None:
    from app.agents.runtime_skills.joint_control_adapter import compile_controlled_council_report

    hubu = _runtime_ministry_report("户部", status=ReportStatus.DEGRADED)
    xingbu = _runtime_ministry_report("刑部")
    result = compile_controlled_council_report(
        tenant_id="tenant-1",
        owner_user_id="owner-1",
        run_id="run-1",
        reports=(hubu, xingbu),
    )

    assert result.status is ReportStatus.DEGRADED
    assert "户部:status:degraded" in result.data_gaps


def test_joint_control_rejects_wrong_skill_and_degrades_insufficient_empty_report() -> None:
    from app.agents.runtime_skills.joint_control_adapter import (
        JointControlAdapterError,
        compile_controlled_council_report,
    )

    hubu = _runtime_ministry_report("户部")
    xingbu = _runtime_ministry_report("刑部")
    wrong = hubu.model_copy(update={"skill_id": "synthesize-risk-governance"})
    with pytest.raises(
        JointControlAdapterError, match="ministry_report_skill_binding_mismatch"
    ):
        compile_controlled_council_report(
            tenant_id="tenant-1",
            owner_user_id="owner-1",
            run_id="run-1",
            reports=(wrong, xingbu),
        )

    insufficient = hubu.model_copy(
        update={
            "evidence_sufficiency": EvidenceSufficiency.INSUFFICIENT,
            "selected_bureaus": (),
            "bureau_report_refs": (),
            "shared_findings": (),
            "ministry_position": (),
        }
    )
    result = compile_controlled_council_report(
        tenant_id="tenant-1",
        owner_user_id="owner-1",
        run_id="run-1",
        reports=(insufficient, xingbu),
    )
    assert result.status is ReportStatus.DEGRADED
    assert "户部:evidence:insufficient" in result.data_gaps
    assert result.consensus == ()


def test_joint_adapter_exposes_no_local_authority_issuer() -> None:
    import app.agents.runtime_skills.joint_control_adapter as adapter

    assert not hasattr(adapter, "_issue_ministry_report_binding")
    assert not hasattr(adapter, "_issue_council_order")


def test_all_nonretired_capability_families_bind_to_authoritative_runtime_skills() -> None:
    bindings = load_capability_family_bindings()

    assert len(bindings) == 22
    assert len({item.family_id for item in bindings}) == 22
    assert all(item.runtime_skill_ids for item in bindings)
    assert max(len(item.runtime_skill_ids) for item in bindings) <= 6
    registry_ids = {
        skill.skill_id for skill in build_default_downstream_skill_registry().skills
    }
    mapped_ids = {
        skill_id for item in bindings for skill_id in item.runtime_skill_ids
    }
    assert mapped_ids == registry_ids
    assert all(not item.production_promotion_authorized for item in bindings)
    sales = next(
        item
        for item in bindings
        if item.family_id == "capability-family:bingbu-sales-channel"
    )
    assert "analyze-competitive-position" not in sales.runtime_skill_ids
    accounting = next(
        item
        for item in bindings
        if item.family_id == "capability-family:hubu-accounting-controls"
    )
    assert accounting.runtime_skill_ids == (
        "analyze-accounting-position",
        "analyze-financial-controls",
    )


def test_every_family_runs_locally_without_provider_or_side_effects() -> None:
    results = tuple(
        execute_capability_family(
            item.family_id,
            tenant_id="tenant-1",
            owner_user_id="owner-1",
            run_id=f"run-{index}",
            candidate_refs=(),
        )
        for index, item in enumerate(load_capability_family_bindings(), start=1)
    )

    assert len(results) == 22
    assert all(result.status is FamilyRuntimeStatus.DEGRADED for result in results)
    assert all(result.external_effect_authorized is False for result in results)
    assert all(result.missing_requirements for result in results)


def test_family_runtime_rejects_unknown_family_and_invalid_candidate_refs() -> None:
    from app.agents.runtime_skills.family_runtime import FamilyRuntimeError

    with pytest.raises(FamilyRuntimeError, match="capability_family_not_registered"):
        execute_capability_family(
            "capability-family:invented",
            tenant_id="tenant-1",
            owner_user_id="owner-1",
            run_id="run-1",
            candidate_refs=(),
        )
    family_id = load_capability_family_bindings()[0].family_id
    with pytest.raises(FamilyRuntimeError, match="candidate_ref_invalid"):
        execute_capability_family(
            family_id,
            tenant_id="tenant-1",
            owner_user_id="owner-1",
            run_id="run-1",
            candidate_refs=("private-secret",),
        )


def test_family_runtime_detects_matrix_runtime_drift(monkeypatch, tmp_path) -> None:
    import json

    import app.agents.runtime_skills.family_runtime as family_runtime
    from app.agents.runtime_skills.family_runtime import FamilyRuntimeError

    matrix = json.loads(family_runtime._MATRIX_PATH.read_text(encoding="utf-8"))
    matrix["families"] = [
        item
        for item in matrix["families"]
        if item["familyId"] != "capability-family:bingbu-commercial-governance"
    ]
    path = tmp_path / "drifted-matrix.json"
    path.write_text(json.dumps(matrix), encoding="utf-8")
    family_runtime.load_capability_family_bindings.cache_clear()
    monkeypatch.setattr(family_runtime, "_MATRIX_PATH", path)

    with pytest.raises(
        FamilyRuntimeError, match="capability_family_inventory_mismatch"
    ):
        family_runtime.load_capability_family_bindings()
    family_runtime.load_capability_family_bindings.cache_clear()


def test_financial_gate_runs_through_hubu_runtime_skill_and_audit() -> None:
    from decimal import Decimal

    from app.agents.runtime_skills.deterministic_gates import (
        FinancialClaim,
        FinancialGroundingInput,
    )
    from app.agents.runtime_skills.executor import clear_runtime_skill_audits

    clear_runtime_skill_audits()
    request = FinancialGroundingInput(
            claims=(
                FinancialClaim(
                    claim_id="revenue",
                    amount=Decimal("100"),
                    source_ref="evidence:ledger-1",
                    period="2026-Q2",
                    basis="accrual",
                    currency="CNY",
                ),
                FinancialClaim(
                    claim_id="contract-value",
                    amount=Decimal("100"),
                    source_ref="evidence:contract-1",
                    period="2026-Q2",
                    basis="contract",
                    currency="CNY",
                ),
            )
    )
    skill = build_default_downstream_skill_registry().get_by_agent("hubu-accounting")
    refs = ("evidence:ledger-1", "evidence:contract-1")
    result = execute_financial_grounding_gate(
        request,
        invocation=SkillInvocation(
            request_id="request-financial",
            agent_id=skill.agent_id,
            skill_id=skill.skill_id,
            skill_version=skill.version,
            evidence_refs=refs,
            requirement_data_refs={
                skill.data_requirements[0]: (refs[0],),
                skill.data_requirements[1]: (refs[1],),
            },
        ),
    )

    assert result.report.status is ReportStatus.DEGRADED
    assert result.report.agent_id == "hubu-accounting"
    assert result.audit.status is ReportStatus.DEGRADED
    assert result.report.data_gaps == ("financial_evidence_resolver_unavailable",)


def test_blocked_financial_gate_is_an_honest_degraded_runtime_report() -> None:
    from decimal import Decimal

    from app.agents.runtime_skills.deterministic_gates import (
        FinancialClaim,
        FinancialGroundingInput,
    )

    request = FinancialGroundingInput(
            claims=(
                FinancialClaim(
                    claim_id="revenue",
                    amount=Decimal("100"),
                    source_ref=None,
                    period=None,
                    basis=None,
                    currency=None,
                ),
            )
    )
    skill = build_default_downstream_skill_registry().get_by_agent("hubu-accounting")
    result = execute_financial_grounding_gate(
        request,
        invocation=SkillInvocation(
            request_id="request-financial-blocked",
            agent_id=skill.agent_id,
            skill_id=skill.skill_id,
            skill_version=skill.version,
        ),
    )

    assert result.report.status is ReportStatus.DEGRADED
    assert "financial_evidence_resolver_unavailable" in result.report.data_gaps
    assert set(skill.data_requirements) <= set(result.report.data_gaps)


def test_responsibility_gate_runs_through_libu_runtime_skill() -> None:
    from app.agents.runtime_skills.deterministic_gates import (
        ResponsibilityAuthorityInput,
    )

    request = ResponsibilityAuthorityInput(
            task_id="task-1",
            human_owner_ref="user:owner-1",
            responsible_ref="user:operator-1",
            approver_ref="user:approver-1",
            independent_reviewer_ref="user:reviewer-1",
            substitute_ref="user:substitute-1",
    )
    skill = build_default_downstream_skill_registry().get_by_agent("libu-appointments")
    refs = (
        "approved:role-description",
        "approved:appointment-record",
        "authority:task-1",
    )
    result = execute_responsibility_authority_gate(
        request,
        invocation=SkillInvocation(
            request_id="request-responsibility",
            agent_id=skill.agent_id,
            skill_id=skill.skill_id,
            skill_version=skill.version,
            input_refs=refs,
            requirement_data_refs={
                skill.data_requirements[0]: (refs[0],),
                skill.data_requirements[1]: (refs[1],),
            },
        ),
    )

    assert result.report.status is ReportStatus.DEGRADED
    assert result.report.agent_id == "libu-appointments"
    assert result.report.data_gaps == (
        "responsibility_authority_resolver_unavailable",
    )
    assert result.report.audit_refs == ()
