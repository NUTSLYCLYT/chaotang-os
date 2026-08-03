from __future__ import annotations

import inspect
import json

import pytest

import app.agents.runtime_skills.executor as runtime_executor_module
from app.agents.bureaus import (
    BureauAgentInvocationError,
    BureauAgentInvocationResult,
    bureau_profiles_for,
)
from app.agents.ministries import (
    MinistryAgentInvocationError,
    invoke_ministry_agent,
    invoke_ministry_agent_with_report,
)
from app.agents.runtime_skills import (
    BureauReport,
    EvidenceSufficiency,
    MinistryReport,
    ReportStatus,
    RuntimeService,
    build_default_downstream_skill_registry,
    bureau_agent_id,
)


@pytest.fixture(autouse=True)
def isolated_runtime_audits():
    runtime_executor_module.clear_runtime_skill_audits()
    try:
        yield
    finally:
        runtime_executor_module.clear_runtime_skill_audits()


def test_typed_ministry_skill_only_accepts_restricted_bureau_invoker() -> None:
    from app.agents.ministries.agent import invoke_ministry_skill_with_report

    parameters = inspect.signature(invoke_ministry_skill_with_report).parameters
    assert "bureau_invoker" in parameters
    assert "evidence_session" not in parameters
    assert "report_session" not in parameters


def test_ministry_authorized_operation_has_no_privileged_session_and_registers_exact_invoker(
    monkeypatch,
) -> None:
    import app.agents.ministries.agent as ministry_module
    import app.agents.runtime_skills.executor as executor_module

    evidence_session = object()
    report_session = object()
    captured: dict[str, object] = {}

    def fake_handler(*args, bureau_invoker, **kwargs):
        captured["handler_invoker"] = bureau_invoker
        return "handled"

    def inspect_authorization(invocation, skill, services, operation, **kwargs):
        closure_values = tuple(
            cell.cell_contents for cell in (operation.__closure__ or ())
        )
        assert evidence_session not in closure_values
        assert report_session not in closure_values
        captured["service_invoker"] = services[RuntimeService.BUREAU_AGENTS]
        return operation()

    monkeypatch.setattr(ministry_module, "invoke_ministry_skill_with_report", fake_handler)
    monkeypatch.setattr(
        executor_module, "run_authorized_runtime_operation", inspect_authorization
    )

    result = invoke_ministry_agent_with_report(
        "\u6237\u90e8",
        "request",
        "rationale",
        lambda _messages: "unused",
        required_bureaus=("\u4f1a\u8ba1\u53f8",),
        evidence_session=evidence_session,
        report_session=report_session,
    )

    assert result == "handled"
    assert captured["service_invoker"] is captured["handler_invoker"]


def _bureau_report(
    department: str,
    bureau: str,
    *,
    status: ReportStatus = ReportStatus.COMPLETED,
    with_gap: bool = False,
) -> BureauReport:
    skill = build_default_downstream_skill_registry().get_by_agent(
        bureau_agent_id(department, bureau)
    )
    return BureauReport(
        report_id=f"report:{skill.agent_id}",
        request_id="request:one",
        agent_id=skill.agent_id,
        skill_id=skill.skill_id,
        skill_version=skill.version,
        subject=skill.purpose,
        executive_summary=f"{bureau}真实摘要",
        data_gaps=("缺少批准数据",) if with_gap else (),
        evidence_sufficiency=(
            EvidenceSufficiency.INSUFFICIENT
            if status is not ReportStatus.COMPLETED
            else EvidenceSufficiency.SUFFICIENT
        ),
        status=status,
        analysis=(),
        professional_findings=(),
        risks=(),
        recommendations=(f"{bureau}真实摘要",),
    )


def test_typed_ministry_execution_registers_exact_bureau_invoker(monkeypatch) -> None:
    import app.agents.runtime_skills.executor as executor_module
    from app.agents.ministries.agent import invoke_ministry_skill_with_report

    bureau = "\u4f1a\u8ba1\u53f8"
    captured = {}

    def bureau_invoker(selected_bureau, _rationale):
        assert selected_bureau == bureau
        return BureauAgentInvocationResult(
            "bureau opinion", _bureau_report("\u6237\u90e8", bureau)
        )

    real_execute = executor_module.execute_runtime_skill

    def inspect_execute(invocation, skill, services, model, **kwargs):
        captured["registered_invoker"] = services[RuntimeService.BUREAU_AGENTS]
        return real_execute(invocation, skill, services, model, **kwargs)

    monkeypatch.setattr(executor_module, "execute_runtime_skill", inspect_execute)
    responses = iter(
        [
            json.dumps({"rationale": "route", "bureaus": [bureau]}),
            _structured_synthesis(),
        ]
    )

    invoke_ministry_skill_with_report(
        "\u6237\u90e8",
        "request",
        "route",
        lambda _messages: next(responses),
        required_bureaus=(bureau,),
        bureau_invoker=bureau_invoker,
    )

    assert captured["registered_invoker"] is bureau_invoker


def test_ministry_resolves_bound_skill_before_routing_and_returns_typed_report(monkeypatch):
    department = "工部"
    bureau = bureau_profiles_for(department)[0].bureau
    calls: list[tuple[str, str]] = []
    model_messages: list[list[dict[str, str]]] = []

    def bureau_call(*args, **_kwargs):
        calls.append((args[0], args[1]))
        return BureauAgentInvocationResult("司议", _bureau_report(department, bureau))

    responses = iter(
        [
            json.dumps({"rationale": "办理", "bureaus": [bureau]}, ensure_ascii=False),
            '{"opinion":"部议"}',
        ]
    )

    def model(messages):
        model_messages.append(messages)
        return next(responses)

    monkeypatch.setattr("app.agents.ministries.agent.invoke_bureau_agent_with_report", bureau_call)
    result = invoke_ministry_agent_with_report(
        department,
        "交付请求",
        "交工部",
        model,
        required_bureaus=(bureau,),
    )

    ministry_skill = build_default_downstream_skill_registry().get_by_agent("ministry-gongbu")
    assert ministry_skill.skill_id in model_messages[0][0]["content"]
    assert calls == [(department, bureau)]
    assert result.opinion == {
        "department": department,
        "bureau_opinions": [{"bureau": bureau, "opinion": "司议"}],
        "opinion": "部议",
    }
    assert isinstance(result.runtime_report, MinistryReport)
    assert result.runtime_report.selected_bureaus == (bureau,)
    assert result.runtime_report.bureau_report_refs == (
        f"report:{bureau_agent_id(department, bureau)}",
    )
    synthesis_text = model_messages[1][1]["content"]
    assert "真实摘要" in synthesis_text
    assert "report:" in synthesis_text
    assert "professional_findings" not in synthesis_text


def test_legacy_ministry_contract_keeps_exact_fields(monkeypatch):
    department = "工部"
    bureau = bureau_profiles_for(department)[0].bureau
    monkeypatch.setattr(
        "app.agents.ministries.agent.invoke_bureau_agent_with_report",
        lambda *_args, **_kwargs: BureauAgentInvocationResult(
            "司议", _bureau_report(department, bureau)
        ),
    )
    responses = iter(
        [
            json.dumps({"rationale": "办理", "bureaus": [bureau]}, ensure_ascii=False),
            '{"opinion":"部议"}',
        ]
    )
    result = invoke_ministry_agent(
        department,
        "交付请求",
        "交工部",
        lambda _messages: next(responses),
        required_bureaus=(bureau,),
    )
    assert set(result) == {"department", "bureau_opinions", "opinion"}


def test_ministry_rejects_selected_bureau_report_identity_mismatch(monkeypatch):
    department = "工部"
    selected, wrong = bureau_profiles_for(department)[:2]
    monkeypatch.setattr(
        "app.agents.ministries.agent.invoke_bureau_agent_with_report",
        lambda *_args, **_kwargs: BureauAgentInvocationResult(
            "伪装司议", _bureau_report(department, wrong.bureau)
        ),
    )
    responses = iter(
        [json.dumps({"rationale": "办理", "bureaus": [selected.bureau]}, ensure_ascii=False)]
    )
    with pytest.raises(Exception, match="identity"):
        invoke_ministry_agent_with_report(
            department,
            "交付请求",
            "交工部",
            lambda _messages: next(responses),
            required_bureaus=(selected.bureau,),
        )


def test_degraded_bureau_is_honestly_propagated_to_ministry_report(monkeypatch):
    department = "工部"
    bureau = bureau_profiles_for(department)[0].bureau
    monkeypatch.setattr(
        "app.agents.ministries.agent.invoke_bureau_agent_with_report",
        lambda *_args, **_kwargs: BureauAgentInvocationResult(
            "数据不足",
            _bureau_report(
                department,
                bureau,
                status=ReportStatus.DEGRADED,
                with_gap=True,
            ),
        ),
    )
    responses = iter(
        [
            json.dumps({"rationale": "办理", "bureaus": [bureau]}, ensure_ascii=False),
            '{"opinion":"基于不足材料的有限部议"}',
        ]
    )
    result = invoke_ministry_agent_with_report(
        department,
        "交付请求",
        "交工部",
        lambda _messages: next(responses),
        required_bureaus=(bureau,),
    )
    assert result.runtime_report.status is ReportStatus.DEGRADED
    assert result.runtime_report.conflicts
    assert "缺少批准数据" in result.runtime_report.unresolved_items
    assert any(bureau in item for item in result.runtime_report.unresolved_items)
    assert result.runtime_report.evidence_sufficiency is EvidenceSufficiency.INSUFFICIENT


def _structured_synthesis(opinion: str = "部级结论", **overrides) -> str:
    values = {
        "opinion": opinion,
        "shared_findings": ["共同发现"],
        "conflicts": [],
        "cross_bureau_impacts": ["跨司影响"],
        "ministry_position": ["部级立场"],
        "unresolved_items": [],
    }
    values.update(overrides)
    return json.dumps(
        values,
        ensure_ascii=False,
    )


@pytest.mark.parametrize("synthesis", ['{"opinion":"legacy"}', "not-json"])
def test_legacy_or_invalid_ministry_synthesis_is_degraded(synthesis, monkeypatch):
    department = "工部"
    bureau = bureau_profiles_for(department)[0].bureau
    monkeypatch.setattr(
        "app.agents.ministries.agent.invoke_bureau_agent_with_report",
        lambda *_args, **_kwargs: BureauAgentInvocationResult(
            "司议", _bureau_report(department, bureau)
        ),
    )
    responses = iter(
        [json.dumps({"rationale": "办理", "bureaus": [bureau]}, ensure_ascii=False), synthesis]
        + ([synthesis, synthesis] if synthesis == "not-json" else [])
    )
    result = invoke_ministry_agent_with_report(
        department,
        "交付请求",
        "交工部",
        lambda _messages: next(responses),
        required_bureaus=(bureau,),
    )
    assert result.runtime_report.status is ReportStatus.DEGRADED
    assert result.runtime_report.evidence_sufficiency is not EvidenceSufficiency.SUFFICIENT
    assert result.runtime_report.data_gaps
    assert result.runtime_report.unresolved_items


@pytest.mark.parametrize("bureau_status", [ReportStatus.FAILED, ReportStatus.DEGRADED])
def test_noncompleted_bureau_without_gap_is_unresolved(bureau_status, monkeypatch):
    department = "工部"
    bureau = bureau_profiles_for(department)[0].bureau
    monkeypatch.setattr(
        "app.agents.ministries.agent.invoke_bureau_agent_with_report",
        lambda *_args, **_kwargs: BureauAgentInvocationResult(
            "有限司议", _bureau_report(department, bureau, status=bureau_status)
        ),
    )
    responses = iter(
        [
            json.dumps({"rationale": "办理", "bureaus": [bureau]}, ensure_ascii=False),
            _structured_synthesis(),
        ]
    )
    result = invoke_ministry_agent_with_report(
        department,
        "交付请求",
        "交工部",
        lambda _messages: next(responses),
        required_bureaus=(bureau,),
    )
    assert result.runtime_report.status is ReportStatus.DEGRADED
    assert any(bureau in item for item in result.runtime_report.unresolved_items)


def test_stable_bureau_failure_continues_remaining_selected_bureaus(monkeypatch):
    department = "工部"
    first, second = bureau_profiles_for(department)[:2]
    called = []

    def invoke(_department, bureau, *_args, **_kwargs):
        called.append(bureau)
        if bureau == first.bureau:
            raise BureauAgentInvocationError("Bureau structured response failed.")
        return BureauAgentInvocationResult("第二司议", _bureau_report(department, bureau))

    monkeypatch.setattr("app.agents.ministries.agent.invoke_bureau_agent_with_report", invoke)
    responses = iter(
        [
            json.dumps(
                {"rationale": "依次办理", "bureaus": [first.bureau, second.bureau]},
                ensure_ascii=False,
            ),
            _structured_synthesis(),
        ]
    )
    result = invoke_ministry_agent_with_report(
        department,
        "交付请求",
        "交工部",
        lambda _messages: next(responses),
        required_bureaus=(first.bureau,),
    )
    assert called == [first.bureau, second.bureau]
    assert result.runtime_report.bureau_report_refs == (
        f"report:{bureau_agent_id(department, second.bureau)}",
    )
    assert any(first.bureau in item for item in result.runtime_report.unresolved_items)


def test_all_stable_bureau_failures_return_degraded_without_fake_refs(monkeypatch):
    department = "工部"
    bureau = bureau_profiles_for(department)[0].bureau
    monkeypatch.setattr(
        "app.agents.ministries.agent.invoke_bureau_agent_with_report",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            BureauAgentInvocationError("Bureau structured response failed.")
        ),
    )
    responses = iter(
        [
            json.dumps({"rationale": "办理", "bureaus": [bureau]}, ensure_ascii=False),
            _structured_synthesis("材料不足，无法形成司级事实结论"),
        ]
    )
    result = invoke_ministry_agent_with_report(
        department,
        "交付请求",
        "交工部",
        lambda _messages: next(responses),
        required_bureaus=(bureau,),
    )
    assert result.runtime_report.status is ReportStatus.DEGRADED
    assert result.runtime_report.bureau_report_refs == ()
    assert any(bureau in item for item in result.runtime_report.unresolved_items)


def test_structured_ministry_synthesis_populates_distinct_report_fields(monkeypatch):
    department = "工部"
    bureau = bureau_profiles_for(department)[0].bureau
    monkeypatch.setattr(
        "app.agents.ministries.agent.invoke_bureau_agent_with_report",
        lambda *_args, **_kwargs: BureauAgentInvocationResult(
            "司议", _bureau_report(department, bureau)
        ),
    )
    responses = iter(
        [
            json.dumps({"rationale": "办理", "bureaus": [bureau]}, ensure_ascii=False),
            _structured_synthesis("真实部议", conflicts=["真实冲突"]),
        ]
    )
    result = invoke_ministry_agent_with_report(
        department,
        "交付请求",
        "交工部",
        lambda _messages: next(responses),
        required_bureaus=(bureau,),
    )
    report = result.runtime_report
    assert report.status is ReportStatus.DEGRADED
    assert report.shared_findings == ("共同发现",)
    assert report.conflicts == ("真实冲突",)
    assert report.cross_bureau_impacts == ("跨司影响",)
    assert report.ministry_position == ("部级立场",)
    assert report.unresolved_items == ("synthesis_conflict:真实冲突",)


def test_copied_opinion_in_semantic_field_degrades_without_raw_echo(monkeypatch):
    department = "工部"
    bureau = bureau_profiles_for(department)[0].bureau
    monkeypatch.setattr(
        "app.agents.ministries.agent.invoke_bureau_agent_with_report",
        lambda *_args, **_kwargs: BureauAgentInvocationResult(
            "司议", _bureau_report(department, bureau)
        ),
    )
    invalid = _structured_synthesis("重复结论", shared_findings=["  重复结论  "])
    responses = iter(
        [json.dumps({"rationale": "办理", "bureaus": [bureau]}, ensure_ascii=False)] + [invalid] * 3
    )
    result = invoke_ministry_agent_with_report(
        department,
        "交付请求",
        "交工部",
        lambda _messages: next(responses),
        required_bureaus=(bureau,),
    )
    assert result.runtime_report.status is ReportStatus.DEGRADED
    assert "ministry_synthesis_invalid" in result.runtime_report.unresolved_items
    assert "重复结论" not in result.runtime_report.unresolved_items


def test_cross_field_duplicate_degrades(monkeypatch):
    department = "工部"
    bureau = bureau_profiles_for(department)[0].bureau
    monkeypatch.setattr(
        "app.agents.ministries.agent.invoke_bureau_agent_with_report",
        lambda *_args, **_kwargs: BureauAgentInvocationResult(
            "司议", _bureau_report(department, bureau)
        ),
    )
    invalid = _structured_synthesis(
        shared_findings=["相同语义"], cross_bureau_impacts=[" 相同语义 "]
    )
    responses = iter(
        [json.dumps({"rationale": "办理", "bureaus": [bureau]}, ensure_ascii=False)] + [invalid] * 3
    )
    result = invoke_ministry_agent_with_report(
        department,
        "交付请求",
        "交工部",
        lambda _messages: next(responses),
        required_bureaus=(bureau,),
    )
    assert result.runtime_report.status is ReportStatus.DEGRADED
    assert result.runtime_report.shared_findings == ()
    assert result.runtime_report.cross_bureau_impacts == ()


@pytest.mark.parametrize("cause", [TypeError("bug"), ValueError("bug"), AttributeError("bug")])
def test_bureau_error_with_any_cause_fails_closed(cause, monkeypatch):
    department = "工部"
    first, second = bureau_profiles_for(department)[:2]
    called = []

    def invoke(_department, bureau, *_args, **_kwargs):
        called.append(bureau)
        if bureau == first.bureau:
            try:
                raise cause
            except Exception as exc:
                raise BureauAgentInvocationError("Bureau structured response failed.") from exc
        return BureauAgentInvocationResult("司议", _bureau_report(department, bureau))

    monkeypatch.setattr("app.agents.ministries.agent.invoke_bureau_agent_with_report", invoke)
    route = json.dumps(
        {"rationale": "办理", "bureaus": [first.bureau, second.bureau]}, ensure_ascii=False
    )
    responses = iter([route])
    with pytest.raises(MinistryAgentInvocationError):
        invoke_ministry_agent_with_report(
            department,
            "交付请求",
            "交工部",
            lambda _messages: next(responses),
            required_bureaus=(first.bureau,),
        )
    assert called == [first.bureau]


def test_unknown_cause_free_bureau_error_fails_closed(monkeypatch):
    department = "工部"
    first, second = bureau_profiles_for(department)[:2]
    called = []

    def invoke(_department, bureau, *_args, **_kwargs):
        called.append(bureau)
        raise BureauAgentInvocationError("unknown unstable message")

    monkeypatch.setattr("app.agents.ministries.agent.invoke_bureau_agent_with_report", invoke)
    route = json.dumps(
        {"rationale": "办理", "bureaus": [first.bureau, second.bureau]}, ensure_ascii=False
    )
    responses = iter([route])
    with pytest.raises(MinistryAgentInvocationError):
        invoke_ministry_agent_with_report(
            department,
            "交付请求",
            "交工部",
            lambda _messages: next(responses),
            required_bureaus=(first.bureau,),
        )
    assert called == [first.bureau]


def test_ministry_passes_only_explicit_requirement_coverage_to_real_bureau_path(monkeypatch):
    import app.agents.bureaus.agent as bureau_module
    import app.agents.runtime_skills.executor as executor_module
    from app.agents.ministries.agent import invoke_ministry_agent_with_report
    from app.agents.runtime_skills.registry import (
        build_default_downstream_skill_registry,
        bureau_agent_id,
    )

    department = "\u6237\u90e8"
    bureau = "\u4f1a\u8ba1\u53f8"
    skill = build_default_downstream_skill_registry().get_by_agent(
        bureau_agent_id(department, bureau)
    )
    captured = []
    executed_agents = []
    real_invoke = bureau_module.invoke_bureau_agent_with_report
    real_execute = executor_module.execute_runtime_skill
    real_authorize = executor_module.run_authorized_runtime_operation

    def tracked_invoke(*args, **kwargs):
        captured.append(kwargs.get("requirement_data_refs"))
        return real_invoke(*args, **kwargs)

    monkeypatch.setattr(
        "app.agents.ministries.agent.invoke_bureau_agent_with_report", tracked_invoke
    )

    def tracked_execute(invocation, *args, **kwargs):
        executed_agents.append(invocation.agent_id)
        return real_execute(invocation, *args, **kwargs)

    monkeypatch.setattr(executor_module, "execute_runtime_skill", tracked_execute)
    authorized_agents = []

    def tracked_authorize(invocation, skill, services, operation, **kwargs):
        authorized_agents.append(invocation.agent_id)
        return real_authorize(invocation, skill, services, operation, **kwargs)

    monkeypatch.setattr(executor_module, "run_authorized_runtime_operation", tracked_authorize)
    executor_module.clear_runtime_skill_audits()
    responses = iter(
        [
            json.dumps({"rationale": "route", "bureaus": [bureau]}),
            '{"opinion":"bureau opinion"}',
            _structured_synthesis(),
        ]
    )
    result = invoke_ministry_agent_with_report(
        department,
        "request",
        "rationale",
        lambda _messages: next(responses),
        required_bureaus=(bureau,),
        requirement_data_refs_by_bureau={
            bureau: {skill.data_requirements[0]: ("approved:ledger",)}
        },
        approved_data_refs=("approved:ledger",),
    )

    assert captured == [{skill.data_requirements[0]: ("approved:ledger",)}]
    assert executed_agents == [skill.agent_id, "ministry-hubu"]
    assert authorized_agents == ["ministry-hubu", skill.agent_id]
    assert result.runtime_report.status is ReportStatus.DEGRADED
    assert [audit.agent_id for audit in executor_module.runtime_skill_audit_snapshot()] == [
        skill.agent_id,
        "ministry-hubu",
    ]
@pytest.mark.parametrize("invalid_contract", ["binding", "service"])
def test_ministry_production_boundary_rejects_invalid_contract_before_all_side_effects(
    invalid_contract, monkeypatch
) -> None:
    import app.agents.ministries.agent as ministry_module
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
                | {RuntimeService.EVIDENCE_PROTOCOL}
            }
        )

    monkeypatch.setattr(models_module, "SkillInvocation", invalid_invocation)
    monkeypatch.setattr(
        ministry_module,
        "invoke_bureau_agent_with_report",
        lambda *args, **kwargs: counters.__setitem__(
            "downstream", counters["downstream"] + 1
        ),
    )
    executor_module.clear_runtime_skill_audits()

    with pytest.raises(executor_module.RuntimeSkillExecutionError):
        invoke_ministry_agent_with_report(
            "\u6237\u90e8",
            "request",
            "route",
            lambda _messages: counters.__setitem__("model", counters["model"] + 1),
            required_bureaus=("\u4f1a\u8ba1\u53f8",),
            evidence_session=SideEffectSpy("evidence"),
            report_session=SideEffectSpy("accounting"),
        )

    assert counters == {"model": 0, "evidence": 0, "accounting": 0, "downstream": 0}
    audit = executor_module.runtime_skill_audit_snapshot()[-1]
    assert audit.status is ReportStatus.FAILED
