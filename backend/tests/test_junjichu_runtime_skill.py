from __future__ import annotations

import inspect
import json

import pytest

import app.agents.runtime_skills.executor as runtime_executor_module
from app.agents.ministries.agent import (
    MinistryAgentInvocationError,
    MinistryAgentInvocationResult,
)
from app.agents.runtime_skills.models import (
    EvidenceSufficiency,
    MinistryReport,
    ReportStatus,
    RuntimeService,
)

HUBU = "\u6237\u90e8"
XINGBU = "\u5211\u90e8"
TEST_BUREAU = "\u6d4b\u8bd5\u53f8"


@pytest.fixture(autouse=True)
def isolated_runtime_audits():
    runtime_executor_module.clear_runtime_skill_audits()
    try:
        yield
    finally:
        runtime_executor_module.clear_runtime_skill_audits()


def _ministry_result(
    department: str,
    *,
    status: ReportStatus = ReportStatus.COMPLETED,
    data_gaps: tuple[str, ...] = (),
    unresolved_items: tuple[str, ...] = (),
    conflicts: tuple[str, ...] | None = None,
) -> MinistryAgentInvocationResult:
    slug = {HUBU: "hubu", XINGBU: "xingbu"}[department]
    resolved_conflicts = (
        conflicts
        if conflicts is not None
        else (("pricing conflicts with contract",) if department == XINGBU else ())
    )
    report = MinistryReport(
        report_id=f"report:{slug}",
        request_id="request:council",
        agent_id=f"ministry-{slug}",
        skill_id={
            HUBU: "synthesize-finance-governance",
            XINGBU: "synthesize-risk-governance",
        }[department],
        skill_version="1.0.0",
        subject=department,
        executive_summary=f"{department} opinion",
        input_refs=(f"bureau:{slug}",),
        evidence_refs=(f"evidence:{slug}",),
        data_gaps=data_gaps,
        evidence_sufficiency=(
            EvidenceSufficiency.SUFFICIENT
            if status is ReportStatus.COMPLETED
            else EvidenceSufficiency.PARTIAL
        ),
        status=status,
        selected_bureaus=(TEST_BUREAU,),
        selection_reasons=("approved",),
        bureau_report_refs=(f"bureau:{slug}",),
        shared_findings=(f"{department} finding",),
        conflicts=resolved_conflicts,
        cross_bureau_impacts=(),
        ministry_position=(f"{department} position",),
        unresolved_items=unresolved_items,
    )
    return MinistryAgentInvocationResult(
        opinion={
            "department": department,
            "bureau_opinions": [{"bureau": TEST_BUREAU, "opinion": f"{department} bureau"}],
            "opinion": report.executive_summary,
        },
        runtime_report=report,
    )


def _structured_council_response() -> str:
    return json.dumps(
        {
            "verdict": "council verdict",
            "consensus": ["joint progress"],
            "disagreements": ["budget versus contract"],
            "cross_ministry_dependencies": ["budget before contract review"],
            "joint_options": ["stage delivery"],
            "matters_for_chancellor_decision": ["approve stage one"],
        }
    )


def _invoke(ministry_invoker, model=lambda _messages: _structured_council_response()):
    from app.agents.junjichu.agent import invoke_junjichu_council_with_report

    return invoke_junjichu_council_with_report(
        "decree",
        "rationale",
        [HUBU, XINGBU],
        model,
        approved_departments=(HUBU, XINGBU),
        required_bureaus_by_department={HUBU: (TEST_BUREAU,), XINGBU: (TEST_BUREAU,)},
        ministry_invoker=ministry_invoker,
    )


def test_council_validates_approved_order_before_any_ministry() -> None:
    from app.agents.junjichu.agent import invoke_junjichu_council_with_report

    calls: list[str] = []
    with pytest.raises(ValueError, match="approved_department_order_mismatch"):
        invoke_junjichu_council_with_report(
            "decree",
            "rationale",
            [XINGBU, HUBU],
            lambda _messages: _structured_council_response(),
            approved_departments=(HUBU, XINGBU),
            required_bureaus_by_department={HUBU: (TEST_BUREAU,), XINGBU: (TEST_BUREAU,)},
            ministry_invoker=lambda department, _required: calls.append(department),
        )
    assert calls == []


def test_council_uses_each_typed_ministry_once_and_builds_structured_report() -> None:
    calls: list[str] = []

    def ministry(department, _required):
        calls.append(department)
        return _ministry_result(
            department,
            status=ReportStatus.DEGRADED if department == HUBU else ReportStatus.COMPLETED,
            data_gaps=("missing approval",) if department == HUBU else (),
        )

    captured = []
    result = _invoke(
        ministry, lambda messages: captured.append(messages) or _structured_council_response()
    )

    assert calls == [HUBU, XINGBU]
    assert result.verdict == "council verdict"
    assert result.runtime_report.participating_ministries == (HUBU, XINGBU)
    assert result.runtime_report.review_order == (HUBU, XINGBU)
    assert result.runtime_report.ministry_report_refs == ("report:hubu", "report:xingbu")
    assert result.runtime_report.consensus == ("joint progress",)
    assert result.runtime_report.disagreements == (
        "budget versus contract",
        f"{XINGBU}:conflict:pricing conflicts with contract",
    )
    assert result.runtime_report.cross_ministry_dependencies == ("budget before contract review",)
    assert result.runtime_report.joint_options == ("stage delivery",)
    assert f"{HUBU}:data_gap:missing approval" in result.runtime_report.data_gaps
    assert result.runtime_report.status is ReportStatus.DEGRADED
    assert result.runtime_report.evidence_refs == ("evidence:hubu", "evidence:xingbu")
    assert len(captured) == 1


def test_council_skill_is_one_to_one_and_has_no_evidence_or_mcp_service() -> None:
    from app.agents.runtime_skills.registry import build_default_downstream_skill_registry

    skill = build_default_downstream_skill_registry().get_by_agent("junjichu")
    assert skill.skill_id == "conduct-joint-ministry-review"
    assert skill.allowed_services == frozenset({RuntimeService.MINISTRY_AGENTS})
    assert RuntimeService.EVIDENCE_PROTOCOL not in skill.allowed_services


def test_typed_council_handler_structurally_has_no_evidence_session() -> None:
    from app.agents.junjichu.agent import invoke_junjichu_council_with_report

    parameters = inspect.signature(invoke_junjichu_council_with_report).parameters
    assert "ministry_invoker" in parameters
    assert "evidence_session" not in parameters
    assert "report_session" not in parameters

    class EvidenceSpy:
        def __init__(self) -> None:
            self.accesses: list[str] = []

        def __getattribute__(self, name: str):
            if name not in {"accesses", "__dict__", "__class__"}:
                object.__getattribute__(self, "accesses").append(name)
            return object.__getattribute__(self, name)

    spy = EvidenceSpy()

    def restricted_invoker(department, _required):
        assert spy is not None
        return _ministry_result(department)

    _invoke(restricted_invoker)
    assert spy.accesses == []


def test_legacy_single_verdict_is_explicitly_degraded() -> None:
    result = _invoke(
        lambda department, _required: _ministry_result(department),
        lambda _messages: '{"verdict":"legacy"}',
    )
    assert result.verdict == "legacy"
    assert result.runtime_report.status is ReportStatus.DEGRADED
    assert "council_synthesis_legacy_contract" in result.runtime_report.data_gaps


def test_known_ministry_failure_is_recorded_but_unknown_failure_fails_closed() -> None:
    def known_failure(department, _required):
        if department == HUBU:
            raise MinistryAgentInvocationError("stable ministry failure")
        return _ministry_result(department)

    result = _invoke(known_failure)
    assert result.runtime_report.status is ReportStatus.DEGRADED
    assert result.runtime_report.ministry_report_refs == ("report:xingbu",)
    assert f"ministry_failed:{HUBU}" in result.runtime_report.data_gaps

    with pytest.raises(RuntimeError, match="private"):
        _invoke(lambda *_args: (_ for _ in ()).throw(RuntimeError("private")))


@pytest.mark.parametrize(
    ("status", "data_gaps", "unresolved", "conflicts", "expected"),
    [
        (ReportStatus.FAILED, (), (), (), f"{HUBU}:status:failed"),
        (
            ReportStatus.DEGRADED,
            ("missing price",),
            (),
            (),
            f"{HUBU}:data_gap:missing price",
        ),
        (
            ReportStatus.DEGRADED,
            (),
            ("needs approval",),
            ("budget conflict",),
            f"{HUBU}:conflict:budget conflict",
        ),
    ],
)
def test_noncompleted_ministry_propagates_status_and_each_issue_category(
    status, data_gaps, unresolved, conflicts, expected
) -> None:
    result = _invoke(
        lambda department, _required: _ministry_result(
            department,
            status=status if department == HUBU else ReportStatus.COMPLETED,
            data_gaps=data_gaps if department == HUBU else (),
            unresolved_items=unresolved if department == HUBU else (),
            conflicts=conflicts if department == HUBU else (),
        )
    )
    assert result.runtime_report.status is ReportStatus.DEGRADED
    assert expected in result.runtime_report.data_gaps
    assert expected in result.runtime_report.matters_for_chancellor_decision
    if unresolved:
        assert f"{HUBU}:unresolved:{unresolved[0]}" in result.runtime_report.data_gaps


@pytest.mark.parametrize(
    "invalid_response",
    [
        {
            "verdict": "DUPLICATED-SECRET",
            "consensus": [" duplicated-secret "],
            "disagreements": [],
            "cross_ministry_dependencies": [],
            "joint_options": [],
            "matters_for_chancellor_decision": [],
        },
        {
            "verdict": "safe verdict",
            "consensus": ["DUPLICATED-SECRET"],
            "disagreements": [],
            "cross_ministry_dependencies": [" duplicated-secret "],
            "joint_options": [],
            "matters_for_chancellor_decision": [],
        },
    ],
)
def test_council_semantic_duplicates_degrade_without_echoing_raw(invalid_response) -> None:
    result = _invoke(
        lambda department, _required: _ministry_result(department),
        lambda _messages: json.dumps(invalid_response),
    )
    assert result.runtime_report.status is ReportStatus.DEGRADED
    assert "DUPLICATED-SECRET" not in result.verdict
    assert "DUPLICATED-SECRET" not in result.runtime_report.model_dump_json()


def test_production_council_report_runs_through_shared_executor(monkeypatch) -> None:
    import app.agents.runtime_skills.executor as executor_module

    calls = []
    real_execute = executor_module.execute_runtime_skill
    real_authorize = executor_module.run_authorized_runtime_operation

    def tracked_execute(*args, **kwargs):
        calls.append((args, kwargs))
        return real_execute(*args, **kwargs)

    monkeypatch.setattr(executor_module, "execute_runtime_skill", tracked_execute)
    authorized_agents = []

    def tracked_authorize(invocation, skill, services, operation, **kwargs):
        authorized_agents.append(invocation.agent_id)
        return real_authorize(invocation, skill, services, operation, **kwargs)

    monkeypatch.setattr(executor_module, "run_authorized_runtime_operation", tracked_authorize)
    executor_module.clear_runtime_skill_audits()
    result = _invoke(lambda department, _required: _ministry_result(department))

    assert len(calls) == 1
    assert authorized_agents == ["junjichu"]
    assert result.runtime_report.status is ReportStatus.COMPLETED
    assert [audit.agent_id for audit in executor_module.runtime_skill_audit_snapshot()] == [
        "junjichu"
    ]
def test_council_registers_the_exact_ministry_invoker_passed_to_handler(monkeypatch) -> None:
    import app.agents.junjichu.agent as council_module
    import app.agents.runtime_skills.executor as executor_module

    captured = {}

    def ministry_invoker(department, required):
        raise AssertionError("handler stub must not invoke downstream")

    def fake_handler(*args, ministry_invoker, **kwargs):
        captured["handler_invoker"] = ministry_invoker
        return "handled"

    def inspect_authorization(invocation, skill, services, operation, **kwargs):
        captured["registered_invoker"] = services[RuntimeService.MINISTRY_AGENTS]
        return operation()

    monkeypatch.setattr(
        council_module, "_invoke_junjichu_council_with_report_authorized", fake_handler
    )
    monkeypatch.setattr(
        executor_module, "run_authorized_runtime_operation", inspect_authorization
    )

    result = council_module.invoke_junjichu_council_with_report(
        "request",
        "route",
        [HUBU],
        lambda _messages: "unused",
        approved_departments=(HUBU,),
        required_bureaus_by_department={HUBU: (TEST_BUREAU,)},
        ministry_invoker=ministry_invoker,
    )

    assert result == "handled"
    assert captured["registered_invoker"] is captured["handler_invoker"]


@pytest.mark.parametrize("invalid_contract", ["binding", "service"])
def test_council_production_boundary_rejects_invalid_contract_before_all_side_effects(
    invalid_contract, monkeypatch
) -> None:
    import app.agents.junjichu.agent as council_module
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
        council_module,
        "invoke_ministry_agent_with_report",
        lambda *args, **kwargs: counters.__setitem__(
            "downstream", counters["downstream"] + 1
        ),
    )
    executor_module.clear_runtime_skill_audits()

    with pytest.raises(executor_module.RuntimeSkillExecutionError):
        council_module.run_junjichu_council_with_report(
            "request",
            "route",
            [HUBU],
            lambda _messages: counters.__setitem__("model", counters["model"] + 1),
            required_bureaus_by_department={HUBU: (TEST_BUREAU,)},
            evidence_session=SideEffectSpy("evidence"),
            report_session=SideEffectSpy("accounting"),
        )

    assert counters == {"model": 0, "evidence": 0, "accounting": 0, "downstream": 0}
    audit = executor_module.runtime_skill_audit_snapshot()[-1]
    assert audit.status is ReportStatus.FAILED
