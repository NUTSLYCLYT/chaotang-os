"""Runtime-skill integration coverage for all authoritative bureaus."""

from __future__ import annotations

import json

import pytest

import app.agents.runtime_skills.executor as runtime_executor_module
from app.agents.bureaus import (
    BUREAU_PROFILES,
    BureauAgentInvocationError,
    BureauAgentInvocationResult,
    invoke_bureau_agent,
    invoke_bureau_agent_with_report,
)
from app.agents.evidence_protocol import AgentEvidenceSession, bureau_node_id
from app.agents.runtime_skills import (
    AgentLayer,
    BureauReport,
    EvidenceSufficiency,
    ReportStatus,
    RuntimeService,
    build_default_downstream_skill_registry,
    bureau_agent_id,
)
from app.agents.runtime_skills.tool_registry import BUREAU_TOOL_POLICIES


@pytest.fixture(autouse=True)
def isolated_runtime_audits():
    runtime_executor_module.clear_runtime_skill_audits()
    try:
        yield
    finally:
        runtime_executor_module.clear_runtime_skill_audits()


def test_registry_attaches_all_exact_professional_policies_only_to_bureaus() -> None:
    skills = build_default_downstream_skill_registry().skills
    bureau_skills = tuple(skill for skill in skills if skill.layer is AgentLayer.BUREAU)
    upper_skills = tuple(skill for skill in skills if skill.layer is not AgentLayer.BUREAU)

    assert len(bureau_skills) == 39
    assert {skill.agent_id for skill in bureau_skills} == set(BUREAU_TOOL_POLICIES)
    assert all(
        skill.tool_policy is BUREAU_TOOL_POLICIES[skill.agent_id]
        for skill in bureau_skills
    )
    assert all(skill.tool_policy is None for skill in upper_skills)
    for skill in bureau_skills:
        policy = skill.tool_policy
        assert policy is not None
        assert policy.agent_id == skill.agent_id
        assert policy.allowed_data_domains
        assert set(policy.tool_operations) == set(policy.allowed_tools)
        assert set(policy.tool_argument_constraints) == set(policy.allowed_tools)
        assert all(
            set(constraints["allowed_domains"]) <= policy.allowed_data_domains
            for constraints in policy.tool_argument_constraints.values()
        )


@pytest.mark.parametrize(
    ("department", "bureau"),
    [(profile.department, profile.bureau) for profile in BUREAU_PROFILES],
)
def test_each_bureau_invocation_uses_only_its_bound_runtime_skill(
    department: str,
    bureau: str,
) -> None:
    captured: list[list[dict[str, str]]] = []

    def model(messages: list[dict[str, str]]) -> str:
        captured.append(messages)
        return '{"opinion":"bounded professional opinion"}'

    result = invoke_bureau_agent_with_report(
        department,
        bureau,
        "approved request material",
        "approved parent routing",
        model,
    )

    skill = build_default_downstream_skill_registry().get_by_agent(
        bureau_agent_id(department, bureau)
    )
    system_text = captured[0][0]["content"]
    assert len(captured) == 1
    assert skill.skill_id in system_text
    assert skill.version in system_text
    assert all(step in system_text for step in skill.analysis_procedure)
    assert all(requirement in system_text for requirement in skill.data_requirements)
    assert all(finding in system_text for finding in skill.required_findings)
    assert all(guardrail in system_text for guardrail in skill.forbidden_actions)
    assert "专属能力包约束" not in system_text
    assert result.runtime_report.skill_id == skill.skill_id


def test_legacy_entry_returns_exact_plain_string_and_new_entry_is_explicit_dataclass() -> None:
    legacy = invoke_bureau_agent(
        "户部",
        "会计司",
        "approved accounting request",
        "approved route",
        lambda _messages: '{"opinion":"  reconciled accounting opinion  "}',
    )
    result = invoke_bureau_agent_with_report(
        "户部",
        "会计司",
        "approved accounting request",
        "approved route",
        lambda _messages: '{"opinion":"  reconciled accounting opinion  "}',
    )

    assert type(legacy) is str
    assert json.dumps(legacy) == '"reconciled accounting opinion"'
    assert isinstance(result, BureauAgentInvocationResult)
    assert result.opinion == "reconciled accounting opinion"
    assert isinstance(result.runtime_report, BureauReport)
    assert result.runtime_report.executive_summary == result.opinion
    assert result.runtime_report.skill_id == "analyze-accounting-position"
    assert result.runtime_report.evidence_refs == ()
    assert result.runtime_report.evidence_requests == ()


def test_missing_requirement_coverage_is_degraded_without_fabricated_sections() -> None:
    result = invoke_bureau_agent_with_report(
        "户部",
        "会计司",
        "approved accounting request",
        "approved route",
        lambda _messages: '{"opinion":"review the accounting position"}',
    )
    skill = build_default_downstream_skill_registry().get_by_agent("hubu-accounting")
    report = result.runtime_report

    assert report.status is ReportStatus.DEGRADED
    assert report.evidence_sufficiency is EvidenceSufficiency.INSUFFICIENT
    assert report.data_gaps == skill.data_requirements
    assert report.analysis == ()
    assert report.professional_findings == ()
    assert report.risks == ()
    assert report.out_of_scope_items == ()
    assert report.recommendations == (result.opinion,)


def test_production_bureau_report_runs_through_shared_executor(monkeypatch) -> None:
    import app.agents.runtime_skills.executor as executor_module

    calls = []
    order = []
    real_execute = executor_module.execute_runtime_skill
    real_authorize = executor_module.run_authorized_runtime_operation

    def tracked_execute(*args, **kwargs):
        calls.append((args, kwargs))
        return real_execute(*args, **kwargs)

    monkeypatch.setattr(executor_module, "execute_runtime_skill", tracked_execute)

    def tracked_authorize(invocation, skill, services, operation, **kwargs):
        order.append("authorized")
        return real_authorize(invocation, skill, services, operation, **kwargs)

    monkeypatch.setattr(executor_module, "run_authorized_runtime_operation", tracked_authorize)
    executor_module.clear_runtime_skill_audits()
    skill = build_default_downstream_skill_registry().get_by_agent("hubu-accounting")
    response = json.dumps(
        {
            "opinion": "review the reconciled ledger",
            "analysis": ["reconciled ledger to voucher"],
            "professional_findings": ["one timing difference"],
            "risks": ["cutoff risk"],
            "recommendations": ["correct the timing difference"],
            "out_of_scope_items": ["payment execution"],
        }
    )
    result = invoke_bureau_agent_with_report(
        "\u6237\u90e8",
        "\u4f1a\u8ba1\u53f8",
        "approved accounting request",
        "approved route",
        lambda _messages: order.append("model") or response,
        approved_data_refs=("ledger", "contracts"),
        requirement_data_refs={
            skill.data_requirements[0]: ("ledger",),
            skill.data_requirements[1]: ("contracts",),
        },
    )

    assert len(calls) == 1
    assert order == ["authorized", "model"]
    assert result.runtime_report.analysis == ()
    assert result.runtime_report.professional_findings == ()
    assert result.runtime_report.risks == ()
    assert result.runtime_report.recommendations == ("correct the timing difference",)
    assert result.runtime_report.status is ReportStatus.DEGRADED
    assert result.runtime_report.input_refs == ()
    audits = executor_module.runtime_skill_audit_snapshot()
    assert [audit.agent_id for audit in audits] == [skill.agent_id]
    assert "approved accounting request" not in audits[0].model_dump_json()


def test_structured_bureau_rejects_opinion_duplicated_in_any_section() -> None:
    skill = build_default_downstream_skill_registry().get_by_agent("hubu-accounting")
    duplicated = json.dumps(
        {
            "opinion": "same conclusion",
            "analysis": ["ledger checked"],
            "professional_findings": [],
            "risks": [],
            "recommendations": ["  SAME   CONCLUSION "],
            "out_of_scope_items": [],
        }
    )

    with pytest.raises(BureauAgentInvocationError, match="Bureau structured response failed"):
        invoke_bureau_agent_with_report(
            "户部",
            "会计司",
            "request",
            "route",
            lambda _messages: duplicated,
            approved_data_refs=("ledger", "contracts"),
            requirement_data_refs={
                skill.data_requirements[0]: ("ledger",),
                skill.data_requirements[1]: ("contracts",),
            },
        )


def test_partial_coverage_uses_only_current_bureau_selection(monkeypatch) -> None:
    session = AgentEvidenceSession(coordinator=object())
    node_id = bureau_node_id("户部", "会计司")
    session.record_selection(node_id, ("old-evidence",))
    calls = 0

    def model(_messages):
        nonlocal calls
        calls += 1
        session.record_selection(node_id, (f"new-evidence-{calls}",))
        opinion = f"opinion-{calls}"
        return json.dumps({"status": "READY", "result": {
            "opinion": opinion, "factual_claims": [{
                "claim": opinion, "basis": "NORMATIVE", "evidence_ids": [],
                "fact_key": None, "category": None, "subject": None,
            }]}, "adopted_evidence_ids": [], "fact_basis": "NOT_REQUIRED"})
    skill = build_default_downstream_skill_registry().get_by_agent("hubu-accounting")

    first = invoke_bureau_agent_with_report(
        "户部",
        "会计司",
        "request one",
        "route",
        model,
        evidence_session=session,
        requirement_data_refs={skill.data_requirements[0]: ("new-evidence-1",)},
    )
    second = invoke_bureau_agent_with_report(
        "户部",
        "会计司",
        "request two",
        "route",
        model,
        evidence_session=session,
        requirement_data_refs={skill.data_requirements[0]: ("new-evidence-2",)},
    )

    assert first.runtime_report.evidence_refs == ("new-evidence-1",)
    assert second.runtime_report.evidence_refs == ("new-evidence-2",)
    assert first.runtime_report.data_gaps == (skill.data_requirements[1],)
    assert second.runtime_report.data_gaps == (skill.data_requirements[1],)
    assert second.runtime_report.status is ReportStatus.DEGRADED
    assert second.runtime_report.evidence_sufficiency is EvidenceSufficiency.PARTIAL


def test_full_current_call_legacy_evidence_result_remains_degraded(monkeypatch) -> None:
    session = AgentEvidenceSession(coordinator=object())
    node_id = bureau_node_id("户部", "会计司")
    skill = build_default_downstream_skill_registry().get_by_agent("hubu-accounting")

    def model(_messages):
        session.record_selection(node_id, ("ledger", "contracts"))
        opinion = "bounded accounting recommendation"
        return json.dumps({"status": "READY", "result": {
            "opinion": opinion, "factual_claims": [{
                "claim": opinion, "basis": "NORMATIVE", "evidence_ids": [],
                "fact_key": None, "category": None, "subject": None,
            }]}, "adopted_evidence_ids": [], "fact_basis": "NOT_REQUIRED"})
    result = invoke_bureau_agent_with_report(
        "户部",
        "会计司",
        "request",
        "route",
        model,
        evidence_session=session,
        requirement_data_refs={
            skill.data_requirements[0]: ("ledger",),
            skill.data_requirements[1]: ("contracts",),
        },
    )

    assert result.runtime_report.status is ReportStatus.DEGRADED
    assert result.runtime_report.evidence_sufficiency is EvidenceSufficiency.PARTIAL
    assert result.runtime_report.data_gaps == ()
    assert result.runtime_report.analysis == ()
    assert result.runtime_report.professional_findings == ()


def test_second_call_does_not_inherit_first_call_degradation(monkeypatch) -> None:
    session = AgentEvidenceSession(coordinator=object())
    node_id = bureau_node_id("户部", "会计司")
    skill = build_default_downstream_skill_registry().get_by_agent("hubu-accounting")
    calls = 0

    def model(_messages):
        nonlocal calls
        calls += 1
        refs = (f"call-{calls}-one", f"call-{calls}-two")
        session.record_selection(node_id, refs)
        if calls == 1:
            session.record_degradation(node_id)
        opinion = f"opinion-{calls}"
        return json.dumps({"status": "READY", "result": {
            "opinion": opinion, "factual_claims": [{
                "claim": opinion, "basis": "NORMATIVE", "evidence_ids": [],
                "fact_key": None, "category": None, "subject": None,
            }]}, "adopted_evidence_ids": [], "fact_basis": "NOT_REQUIRED"})

    def coverage(call: int) -> dict[str, tuple[str, ...]]:
        return {
            skill.data_requirements[0]: (f"call-{call}-one",),
            skill.data_requirements[1]: (f"call-{call}-two",),
        }

    first = invoke_bureau_agent_with_report(
        "户部",
        "会计司",
        "first",
        "route",
        model,
        evidence_session=session,
        requirement_data_refs=coverage(1),
    )
    second = invoke_bureau_agent_with_report(
        "户部",
        "会计司",
        "second",
        "route",
        model,
        evidence_session=session,
        requirement_data_refs=coverage(2),
    )

    assert first.runtime_report.status is ReportStatus.DEGRADED
    assert second.runtime_report.status is ReportStatus.DEGRADED
    assert second.runtime_report.evidence_sufficiency is EvidenceSufficiency.PARTIAL
    assert second.runtime_report.data_gaps == ()


def test_second_call_records_its_own_new_degradation(monkeypatch) -> None:
    session = AgentEvidenceSession(coordinator=object())
    node_id = bureau_node_id("户部", "会计司")
    skill = build_default_downstream_skill_registry().get_by_agent("hubu-accounting")
    calls = 0

    def model(_messages):
        nonlocal calls
        calls += 1
        refs = (f"call-{calls}-one", f"call-{calls}-two")
        session.record_selection(node_id, refs)
        if calls == 2:
            session.record_degradation(node_id)
        opinion = f"opinion-{calls}"
        return json.dumps({"status": "READY", "result": {
            "opinion": opinion, "factual_claims": [{
                "claim": opinion, "basis": "NORMATIVE", "evidence_ids": [],
                "fact_key": None, "category": None, "subject": None,
            }]}, "adopted_evidence_ids": [], "fact_basis": "NOT_REQUIRED"})

    def coverage(call: int) -> dict[str, tuple[str, ...]]:
        return {
            skill.data_requirements[0]: (f"call-{call}-one",),
            skill.data_requirements[1]: (f"call-{call}-two",),
        }

    invoke_bureau_agent_with_report(
        "户部",
        "会计司",
        "first",
        "route",
        model,
        evidence_session=session,
        requirement_data_refs=coverage(1),
    )
    second = invoke_bureau_agent_with_report(
        "户部",
        "会计司",
        "second",
        "route",
        model,
        evidence_session=session,
        requirement_data_refs=coverage(2),
    )

    assert second.runtime_report.status is ReportStatus.DEGRADED
    assert second.runtime_report.evidence_sufficiency is EvidenceSufficiency.PARTIAL
    assert second.runtime_report.data_gaps == (f"model_synthesis_degraded:{node_id}",)


def test_runtime_skill_prompt_embeds_all_legacy_modes_once_in_one_system_message() -> None:
    captured: list[dict[str, str]] = []

    def model(messages: list[dict[str, str]]) -> str:
        captured.extend(messages)
        return '{"opinion":"technical opinion"}'

    invoke_bureau_agent(
        "工部",
        "技术司",
        "approved architecture request",
        "approved route",
        model,
    )

    system_text = captured[0]["content"]
    assert "analyze-technical-feasibility" in system_text
    assert len(captured) == 2
    assert captured[0]["role"] == "system"
    assert sum(message["role"] == "system" for message in captured) == 1
    assert system_text.count("兼容分析模式") == 1
    for text in (
        "Advise on battery pack research and development.",
        "Pack R&D advisory.",
        "Advise on hardware design trade-offs.",
        "Hardware design review.",
        "Advise on software delivery lifecycle choices.",
        "SDLC advisory memo.",
        "Advise on code review findings.",
        "Code review advisory.",
    ):
        assert system_text.count(text) == 1


def test_runtime_skill_prompt_omits_compatibility_section_for_bureau_without_modes() -> None:
    captured: list[list[dict[str, str]]] = []

    def model(messages: list[dict[str, str]]) -> str:
        captured.append(messages)
        return '{"opinion":"bounded budget opinion"}'

    invoke_bureau_agent(
        "户部",
        "预算司",
        "approved budget request",
        "approved route",
        model,
    )

    assert len(captured) == 1
    system_text = captured[0][0]["content"]
    assert "analyze-budget-performance" in system_text
    assert "兼容分析模式" not in system_text
def test_bureau_registers_the_exact_evidence_service_passed_to_handler(monkeypatch) -> None:
    import app.agents.bureaus.agent as bureau_module
    import app.agents.runtime_skills.executor as executor_module

    evidence_service = object()
    captured = {}

    def fake_handler(*args, evidence_session, **kwargs):
        captured["handler_service"] = evidence_session
        return "handled"

    def inspect_authorization(invocation, skill, services, operation, **kwargs):
        captured["registered_service"] = services[RuntimeService.EVIDENCE_PROTOCOL]
        return operation()

    monkeypatch.setattr(
        bureau_module, "_invoke_bureau_agent_with_report_authorized", fake_handler
    )
    monkeypatch.setattr(
        executor_module, "run_authorized_runtime_operation", inspect_authorization
    )

    result = invoke_bureau_agent_with_report(
        "\u6237\u90e8",
        "\u4f1a\u8ba1\u53f8",
        "request",
        "route",
        lambda _messages: "unused",
        evidence_session=evidence_service,
    )

    assert result == "handled"
    assert captured["registered_service"] is captured["handler_service"]


@pytest.mark.parametrize("invalid_contract", ["binding", "service"])
def test_bureau_production_boundary_rejects_invalid_contract_before_all_side_effects(
    invalid_contract, monkeypatch
) -> None:
    import app.agents.runtime_skills.executor as executor_module
    import app.agents.runtime_skills.models as models_module

    real_invocation = models_module.SkillInvocation
    counters = {"model": 0, "evidence": 0, "accounting": 0, "downstream": 0}

    class SideEffectSpy:
        def __init__(self, counter):
            object.__setattr__(self, "counter", counter)

        def __getattribute__(self, name):
            if name in {"counter", "__class__", "__dict__"}:
                return object.__getattribute__(self, name)
            counters[object.__getattribute__(self, "counter")] += 1
            return object.__getattribute__(self, name)

    def invalid_invocation(**kwargs):
        invocation = real_invocation(**kwargs)
        if invalid_contract == "binding":
            return invocation.model_copy(update={"agent_id": "illegal-agent"})
        return invocation.model_copy(
            update={
                "requested_services": invocation.requested_services
                | {RuntimeService.MINISTRY_AGENTS}
            }
        )

    monkeypatch.setattr(models_module, "SkillInvocation", invalid_invocation)
    executor_module.clear_runtime_skill_audits()

    with pytest.raises(executor_module.RuntimeSkillExecutionError):
        invoke_bureau_agent_with_report(
            "\u6237\u90e8",
            "\u4f1a\u8ba1\u53f8",
            "request",
            "route",
            lambda _messages: counters.__setitem__("model", counters["model"] + 1),
            evidence_session=SideEffectSpy("evidence"),
            report_session=SideEffectSpy("accounting"),
        )

    assert counters == {"model": 0, "evidence": 0, "accounting": 0, "downstream": 0}
    audit = executor_module.runtime_skill_audit_snapshot()[-1]
    assert audit.status is ReportStatus.FAILED
