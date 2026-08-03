import json
from concurrent.futures import ThreadPoolExecutor

import pytest

import app.agents.runtime_skills.executor as executor_module
from app.agents.runtime_skills import (
    BureauReport,
    CouncilReport,
    EvidenceSufficiency,
    MinistryReport,
    ReportStatus,
    RuntimeService,
    SkillInvocation,
    build_default_downstream_skill_registry,
)
from app.agents.runtime_skills.executor import (
    RuntimeSkillExecutionError,
    execute_runtime_skill,
)


@pytest.fixture(autouse=True)
def isolated_default_audit_buffer():
    executor_module.clear_runtime_skill_audits()
    try:
        yield
    finally:
        executor_module.clear_runtime_skill_audits()


def _invocation(agent_id: str, skill_id: str, **changes: object) -> SkillInvocation:
    values: dict[str, object] = {
        "request_id": "request-1",
        "agent_id": agent_id,
        "skill_id": skill_id,
        "skill_version": "1.0.0",
        "input_refs": ("material-1",),
    }
    values.update(changes)
    return SkillInvocation(**values)


def _covered_invocation(skill: object, **changes: object) -> SkillInvocation:
    data_requirements = skill.data_requirements  # type: ignore[attr-defined]
    refs = tuple(f"material-{index}" for index, _ in enumerate(data_requirements, start=1))
    values: dict[str, object] = {
        "agent_id": skill.agent_id,  # type: ignore[attr-defined]
        "skill_id": skill.skill_id,  # type: ignore[attr-defined]
        "input_refs": refs,
        "requirement_data_refs": {
            requirement: (refs[index],) for index, requirement in enumerate(data_requirements)
        },
    }
    values.update(changes)
    agent_id = str(values.pop("agent_id"))
    skill_id = str(values.pop("skill_id"))
    return _invocation(agent_id, skill_id, **values)


def _valid_bureau_json(**changes: object) -> str:
    values: dict[str, object] = {
        "subject": "review",
        "executive_summary": "review complete",
        "evidence_sufficiency": "sufficient",
        "status": "completed",
        "analysis": ["checked"],
        "professional_findings": ["finding"],
        "risks": [],
        "recommendations": ["continue"],
    }
    values.update(changes)
    return json.dumps(values)


def _valid_ministry_json() -> str:
    return json.dumps(
        {
            "subject": "review",
            "executive_summary": "review complete",
            "evidence_sufficiency": "sufficient",
            "status": "completed",
            "selected_bureaus": ["hubu-accounting"],
            "selection_reasons": ["relevant"],
            "bureau_report_refs": ["bureau-report-1"],
            "shared_findings": ["finding"],
            "conflicts": [],
            "cross_bureau_impacts": [],
            "ministry_position": ["position"],
            "unresolved_items": [],
        }
    )


def _valid_council_json() -> str:
    return json.dumps(
        {
            "subject": "review",
            "executive_summary": "review complete",
            "evidence_sufficiency": "sufficient",
            "status": "completed",
            "participating_ministries": ["ministry-hubu"],
            "review_order": ["ministry-hubu"],
            "ministry_report_refs": ["ministry-report-1"],
            "consensus": ["finding"],
            "disagreements": [],
            "cross_ministry_dependencies": [],
            "joint_options": ["option"],
            "matters_for_chancellor_decision": [],
        }
    )


def test_executor_rejects_unapproved_service_before_model_call() -> None:
    skill = build_default_downstream_skill_registry().get_by_agent("ministry-hubu")
    invocation = _covered_invocation(skill)
    called = False

    def model(_: list[object]) -> str:
        nonlocal called
        called = True
        return "{}"

    audits = []
    with pytest.raises(RuntimeSkillExecutionError, match="^service_not_allowed$") as exc_info:
        execute_runtime_skill(
            invocation,
            skill,
            {RuntimeService.EVIDENCE_PROTOCOL: object()},
            model,
            audit_sink=audits.append,
        )
    assert called is False
    assert audits == [exc_info.value.audit]
    assert audits[0].status is ReportStatus.FAILED
    assert audits[0].failure_code == "service_not_allowed"


def test_authorized_operation_blocks_side_effect_before_unapproved_service() -> None:
    skill = build_default_downstream_skill_registry().get_by_agent("ministry-hubu")
    invocation = _covered_invocation(
        skill, requested_services=frozenset({RuntimeService.EVIDENCE_PROTOCOL})
    )
    side_effects = 0

    def operation():
        nonlocal side_effects
        side_effects += 1
        return object()

    with pytest.raises(RuntimeSkillExecutionError, match="service_not_allowed"):
        executor_module.run_authorized_runtime_operation(
            invocation,
            skill,
            {RuntimeService.EVIDENCE_PROTOCOL: object()},
            operation,
        )

    assert side_effects == 0
    assert executor_module.runtime_skill_audit_snapshot()[0].failure_code == "service_not_allowed"


def test_authorized_operation_audits_callback_failure_without_raw_exception() -> None:
    skill = build_default_downstream_skill_registry().get_by_agent("ministry-hubu")
    invocation = _covered_invocation(
        skill, requested_services=frozenset({RuntimeService.BUREAU_AGENTS})
    )
    failure = RuntimeError("credential=top-secret")

    with pytest.raises(RuntimeError) as exc_info:
        executor_module.run_authorized_runtime_operation(
            invocation,
            skill,
            {RuntimeService.BUREAU_AGENTS: object()},
            lambda: (_ for _ in ()).throw(failure),
        )

    assert exc_info.value is failure
    audit = executor_module.runtime_skill_audit_snapshot()[0]
    assert audit.status is ReportStatus.FAILED
    assert audit.failure_code == "skill_execution_failed"
    assert "top-secret" not in audit.model_dump_json()


def test_executor_rejects_wrong_agent_binding_before_model_call() -> None:
    skill = build_default_downstream_skill_registry().get_by_agent("hubu-accounting")
    invocation = _covered_invocation(skill, agent_id="hubu-budget")
    called = False

    def model(_: list[object]) -> str:
        nonlocal called
        called = True
        return "{}"

    audits = []
    with pytest.raises(RuntimeSkillExecutionError, match="^agent_skill_mismatch$") as exc_info:
        execute_runtime_skill(invocation, skill, {}, model, audit_sink=audits.append)
    assert called is False
    assert audits == [exc_info.value.audit]
    assert audits[0].skill_version == skill.version


def test_insufficient_bureau_data_returns_degraded_report_without_model_call() -> None:
    skill = build_default_downstream_skill_registry().get_by_agent("hubu-accounting")
    invocation = _invocation(
        skill.agent_id,
        skill.skill_id,
        input_refs=("unrelated-ref",),
        requirement_data_refs={},
    )
    called = False

    def model(_: list[object]) -> str:
        nonlocal called
        called = True
        return "{}"

    result = execute_runtime_skill(invocation, skill, {}, model)

    assert isinstance(result.report, BureauReport)
    assert result.report.status is ReportStatus.DEGRADED
    assert result.report.evidence_sufficiency is EvidenceSufficiency.INSUFFICIENT
    assert result.report.data_gaps == skill.data_requirements
    assert result.audit.status is ReportStatus.DEGRADED
    assert result.audit.failure_code is None
    assert called is False


def test_partial_requirement_coverage_lists_only_remaining_gaps() -> None:
    skill = build_default_downstream_skill_registry().get_by_agent("hubu-accounting")
    first_requirement, *remaining = skill.data_requirements
    invocation = _invocation(
        skill.agent_id,
        skill.skill_id,
        input_refs=("approved-1", "unrelated-1"),
        requirement_data_refs={first_requirement: ("approved-1",)},
    )

    result = execute_runtime_skill(invocation, skill, {}, lambda _: pytest.fail())

    assert result.report.data_gaps == tuple(remaining)


def test_unapproved_coverage_ref_does_not_satisfy_requirement() -> None:
    skill = build_default_downstream_skill_registry().get_by_agent("hubu-accounting")
    invocation = _invocation(
        skill.agent_id,
        skill.skill_id,
        input_refs=("approved-1",),
        requirement_data_refs={
            requirement: ("not-an-approved-ref",) for requirement in skill.data_requirements
        },
    )

    result = execute_runtime_skill(invocation, skill, {}, lambda _: pytest.fail())

    assert result.report.data_gaps == skill.data_requirements


def test_one_ref_cannot_claim_to_cover_multiple_requirements() -> None:
    skill = build_default_downstream_skill_registry().get_by_agent("hubu-accounting")
    invocation = _invocation(
        skill.agent_id,
        skill.skill_id,
        input_refs=("approved-1",),
        requirement_data_refs={
            requirement: ("approved-1",) for requirement in skill.data_requirements
        },
    )

    result = execute_runtime_skill(invocation, skill, {}, lambda _: pytest.fail())

    assert result.report.data_gaps == skill.data_requirements


def test_executor_parses_typed_report_and_writes_bounded_audit() -> None:
    skill = build_default_downstream_skill_registry().get_by_agent("hubu-accounting")
    invocation = _covered_invocation(
        skill,
        requested_services=frozenset({RuntimeService.EVIDENCE_PROTOCOL}),
    )
    secret_service = object()

    result = execute_runtime_skill(
        invocation,
        skill,
        {RuntimeService.EVIDENCE_PROTOCOL: secret_service},
        lambda _: _valid_bureau_json(),
    )

    assert isinstance(result.report, BureauReport)
    assert result.report.status is ReportStatus.COMPLETED
    assert result.audit.allowed_services == frozenset({RuntimeService.EVIDENCE_PROTOCOL})
    serialized_audit = result.audit.model_dump_json()
    assert "object at" not in serialized_audit
    assert "secret" not in serialized_audit


def test_executor_owns_trace_fields_and_never_messages_service_objects() -> None:
    skill = build_default_downstream_skill_registry().get_by_agent("hubu-accounting")
    invocation = _covered_invocation(
        skill,
        request_id="trusted-request",
        parent_report_id="trusted-parent",
    )
    service = object()
    captured_messages: list[object] = []

    def model(messages: list[object]) -> str:
        captured_messages.extend(messages)
        return _valid_bureau_json(
            report_id="hostile-report",
            request_id="hostile-request",
            parent_report_id="hostile-parent",
            agent_id="hostile-agent",
            skill_id="hostile-skill",
            skill_version="9.9.9",
            created_at="2000-01-01T00:00:00Z",
        )

    result = execute_runtime_skill(
        invocation,
        skill,
        {RuntimeService.EVIDENCE_PROTOCOL: service},
        model,
    )

    assert result.report.report_id == "trusted-request:analyze-accounting-position"
    assert result.report.request_id == "trusted-request"
    assert result.report.parent_report_id == "trusted-parent"
    assert result.report.agent_id == skill.agent_id
    assert result.report.skill_id == skill.skill_id
    assert result.report.skill_version == skill.version
    assert result.report.created_at.year != 2000
    assert all(service is not value for message in captured_messages for value in _values(message))


def test_model_context_preserves_only_approved_requirement_coverage() -> None:
    skill = build_default_downstream_skill_registry().get_by_agent("hubu-accounting")
    first, second = skill.data_requirements
    invocation = _invocation(
        skill.agent_id,
        skill.skill_id,
        input_refs=("approved-1", "approved-2", "unrelated"),
        requirement_data_refs={
            first: ("approved-1", "not-approved"),
            second: ("approved-2",),
        },
    )
    captured: list[object] = []

    def model(messages: list[object]) -> str:
        captured.extend(messages)
        return _valid_bureau_json()

    execute_runtime_skill(invocation, skill, {}, model)

    message = captured[0]
    assert isinstance(message, dict)
    assert message["requirement_data_refs"] == {
        first: ("approved-1",),
        second: ("approved-2",),
    }


def _values(value: object) -> tuple[object, ...]:
    if isinstance(value, dict):
        return (value, *(item for child in value.values() for item in _values(child)))
    if isinstance(value, (tuple, list, set, frozenset)):
        return (value, *(item for child in value for item in _values(child)))
    return (value,)


@pytest.mark.parametrize(
    "model",
    [
        lambda _: "credential=top-secret; not json",
        lambda _: (_ for _ in ()).throw(RuntimeError("provider secret top-secret")),
    ],
)
def test_invalid_or_failed_model_output_is_redacted(model: object) -> None:
    skill = build_default_downstream_skill_registry().get_by_agent("hubu-accounting")
    invocation = _covered_invocation(skill)
    audits = []

    with pytest.raises(RuntimeSkillExecutionError) as exc_info:
        execute_runtime_skill(  # type: ignore[arg-type]
            invocation, skill, {}, model, audit_sink=audits.append
        )

    assert str(exc_info.value) == "skill_report_invalid"
    assert "secret" not in repr(exc_info.value)
    assert exc_info.value.__cause__ is None
    assert exc_info.value.__context__ is None
    assert audits == [exc_info.value.audit]
    assert audits[0].status is ReportStatus.FAILED
    assert audits[0].failure_code == "skill_report_invalid"
    assert "secret" not in audits[0].model_dump_json()


def test_default_production_audit_sink_records_redacted_failure(caplog) -> None:
    skill = build_default_downstream_skill_registry().get_by_agent("hubu-accounting")
    invocation = _covered_invocation(skill)
    executor_module.clear_runtime_skill_audits()
    caplog.set_level("INFO", logger="chaotang.runtime_skills.audit")

    with pytest.raises(RuntimeSkillExecutionError):
        execute_runtime_skill(
            invocation,
            skill,
            {},
            lambda _: (_ for _ in ()).throw(RuntimeError("credential=top-secret")),
        )

    audits = executor_module.runtime_skill_audit_snapshot()
    assert len(audits) == 1
    assert audits[0].status is ReportStatus.FAILED
    assert "top-secret" not in audits[0].model_dump_json()
    assert any('"status":"failed"' in record.message for record in caplog.records)
    assert "top-secret" not in caplog.text


def test_default_audit_buffer_snapshot_is_atomic_under_bounded_concurrency() -> None:
    assert hasattr(executor_module, "_RUNTIME_SKILL_AUDIT_LOCK")
    skill = build_default_downstream_skill_registry().get_by_agent("hubu-accounting")

    def execute(index: int) -> None:
        invocation = _covered_invocation(skill, request_id=f"concurrent-{index}")
        execute_runtime_skill(invocation, skill, {}, lambda _: _valid_bureau_json())

    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(execute, range(8)))

    snapshot = executor_module.runtime_skill_audit_snapshot()
    assert len(snapshot) == 8
    assert {audit.request_id for audit in snapshot} == {f"concurrent-{index}" for index in range(8)}


def test_audit_sink_failure_never_masks_or_chains_original_failure() -> None:
    skill = build_default_downstream_skill_registry().get_by_agent("hubu-accounting")
    invocation = _covered_invocation(skill, agent_id="wrong-agent")

    def broken_sink(_: object) -> None:
        raise RuntimeError("sink secret")

    with pytest.raises(RuntimeSkillExecutionError) as exc_info:
        execute_runtime_skill(invocation, skill, {}, lambda _: "{}", audit_sink=broken_sink)

    assert str(exc_info.value) == "agent_skill_mismatch"
    assert exc_info.value.__cause__ is None
    assert exc_info.value.__context__ is None
    assert "sink secret" not in repr(exc_info.value)


@pytest.mark.parametrize(
    ("agent_id", "report_type", "model_json"),
    [
        ("hubu-accounting", BureauReport, _valid_bureau_json()),
        ("ministry-hubu", MinistryReport, _valid_ministry_json()),
        ("junjichu", CouncilReport, _valid_council_json()),
    ],
)
def test_each_layer_parses_its_typed_report(
    agent_id: str, report_type: type[object], model_json: str
) -> None:
    skill = build_default_downstream_skill_registry().get_by_agent(agent_id)
    invocation = _covered_invocation(skill)

    result = execute_runtime_skill(invocation, skill, {}, lambda _: model_json)

    assert isinstance(result.report, report_type)


@pytest.mark.parametrize(
    ("agent_id", "report_type"),
    [
        ("hubu-accounting", BureauReport),
        ("ministry-hubu", MinistryReport),
        ("junjichu", CouncilReport),
    ],
)
def test_each_layer_degrades_to_its_typed_report(agent_id: str, report_type: type[object]) -> None:
    skill = build_default_downstream_skill_registry().get_by_agent(agent_id)
    invocation = _invocation(skill.agent_id, skill.skill_id, input_refs=())

    result = execute_runtime_skill(invocation, skill, {}, lambda _: pytest.fail())

    assert isinstance(result.report, report_type)
    assert result.report.status is ReportStatus.DEGRADED


@pytest.mark.parametrize(
    ("agent_id", "wrong_json"),
    [
        ("hubu-accounting", _valid_ministry_json()),
        ("ministry-hubu", _valid_council_json()),
        ("junjichu", _valid_bureau_json()),
    ],
)
def test_wrong_layer_report_is_rejected_and_audited(agent_id: str, wrong_json: str) -> None:
    skill = build_default_downstream_skill_registry().get_by_agent(agent_id)
    invocation = _covered_invocation(skill)
    audits = []

    with pytest.raises(RuntimeSkillExecutionError, match="skill_report_invalid") as exc_info:
        execute_runtime_skill(
            invocation,
            skill,
            {},
            lambda _: wrong_json,
            audit_sink=audits.append,
        )

    assert audits == [exc_info.value.audit]
    assert audits[0].status is ReportStatus.FAILED
    assert audits[0].failure_code == "skill_report_invalid"


def test_runtime_defense_rejects_constructed_illegal_report_type_without_raw_error() -> None:
    class SecretReport(BureauReport):
        pass

    valid_skill = build_default_downstream_skill_registry().get_by_agent("ministry-hubu")
    invalid_skill = valid_skill.model_copy(update={"report_type": SecretReport})
    invocation = _invocation(invalid_skill.agent_id, invalid_skill.skill_id, input_refs=())
    audits = []

    with pytest.raises(RuntimeSkillExecutionError) as exc_info:
        execute_runtime_skill(
            invocation,
            invalid_skill,
            {},
            lambda _: pytest.fail(),
            audit_sink=audits.append,
        )

    assert str(exc_info.value) == "skill_report_invalid"
    assert exc_info.value.__context__ is None
    assert exc_info.value.__cause__ is None
    assert audits == [exc_info.value.audit]
    assert audits[0].status is ReportStatus.FAILED
    assert audits[0].failure_code == "skill_report_invalid"


@pytest.mark.parametrize("stage", ["prepare", "degraded", "result", "audit"])
def test_unexpected_executor_stage_failure_is_stable_and_audited(
    stage: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    skill = build_default_downstream_skill_registry().get_by_agent("hubu-accounting")
    invocation = _covered_invocation(skill)
    if stage == "degraded":
        invocation = _invocation(skill.agent_id, skill.skill_id, input_refs=())

    def fail(*_: object, **__: object) -> object:
        raise RuntimeError("stage provider secret")

    target = {
        "prepare": "_prepare_minimal_context",
        "degraded": "_degraded_report",
        "result": "SkillExecutionResult",
        "audit": "_audit",
    }[stage]
    monkeypatch.setattr(executor_module, target, fail)
    audits = []

    with pytest.raises(RuntimeSkillExecutionError) as exc_info:
        execute_runtime_skill(
            invocation,
            skill,
            {},
            lambda _: _valid_bureau_json(),
            audit_sink=audits.append,
        )

    assert str(exc_info.value) == "skill_execution_failed"
    assert exc_info.value.__context__ is None
    assert exc_info.value.__cause__ is None
    assert "secret" not in repr(exc_info.value)
    assert audits == [exc_info.value.audit]
    assert audits[0].status is ReportStatus.FAILED
    assert audits[0].failure_code == "skill_execution_failed"
    assert "secret" not in audits[0].model_dump_json()
