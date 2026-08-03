from datetime import UTC, datetime

import pytest
from pydantic import BaseModel, ValidationError

from app.agents.runtime_skills.models import (
    AgentLayer,
    BureauReport,
    CouncilReport,
    EvidenceSufficiency,
    MinistryReport,
    ReportStatus,
    RuntimeService,
    RuntimeSkillDefinition,
    SkillAuditRecord,
    SkillInvocation,
)


def _bureau_report(**overrides: object) -> BureauReport:
    values: dict[str, object] = {
        "report_id": "r-1",
        "request_id": "q-1",
        "agent_id": "hubu-accounting",
        "skill_id": "analyze-accounting-position",
        "skill_version": "1.0.0",
        "subject": "月结复盘",
        "executive_summary": "材料不足",
        "evidence_sufficiency": EvidenceSufficiency.INSUFFICIENT,
        "status": ReportStatus.DEGRADED,
        "data_gaps": ("缺少总账",),
        "analysis": (),
        "professional_findings": (),
        "risks": (),
        "recommendations": ("补齐总账后复核",),
    }
    values.update(overrides)
    return BureauReport(**values)


def _ministry_report(**overrides: object) -> MinistryReport:
    values: dict[str, object] = {
        "report_id": "r-2",
        "request_id": "q-1",
        "agent_id": "hubu",
        "skill_id": "synthesize-hubu-position",
        "skill_version": "1.0.0",
        "subject": "ministry review",
        "executive_summary": "position synthesized",
        "evidence_sufficiency": EvidenceSufficiency.SUFFICIENT,
        "status": ReportStatus.COMPLETED,
        "selected_bureaus": ("hubu-accounting",),
        "selection_reasons": ("accounting expertise",),
        "bureau_report_refs": ("r-1",),
        "shared_findings": ("accounts reconcile",),
        "conflicts": (),
        "cross_bureau_impacts": (),
        "ministry_position": ("approve",),
        "unresolved_items": (),
    }
    values.update(overrides)
    return MinistryReport(**values)


def _council_report(**overrides: object) -> CouncilReport:
    values: dict[str, object] = {
        "report_id": "r-3",
        "request_id": "q-1",
        "agent_id": "council-secretariat",
        "skill_id": "synthesize-council-position",
        "skill_version": "1.0.0",
        "subject": "council review",
        "executive_summary": "joint position synthesized",
        "evidence_sufficiency": EvidenceSufficiency.SUFFICIENT,
        "status": ReportStatus.COMPLETED,
        "participating_ministries": ("hubu",),
        "review_order": ("hubu",),
        "ministry_report_refs": ("r-2",),
        "consensus": ("approve",),
        "disagreements": (),
        "cross_ministry_dependencies": (),
        "joint_options": ("approve",),
        "matters_for_chancellor_decision": (),
    }
    values.update(overrides)
    return CouncilReport(**values)


def test_bureau_report_distinguishes_data_gaps_from_findings() -> None:
    report = _bureau_report()

    assert report.data_gaps == ("缺少总账",)
    assert report.status is ReportStatus.DEGRADED


def test_ministry_and_council_reports_reject_evidence_requests() -> None:
    for report_factory in (_ministry_report, _council_report):
        with pytest.raises(ValidationError) as exc_info:
            report_factory(evidence_requests=("collect more evidence",))

        assert exc_info.value.errors(include_url=False)[0]["type"] == "extra_forbidden"


def test_runtime_skill_definition_is_immutable_and_serializes_string_enums() -> None:
    definition = RuntimeSkillDefinition(
        skill_id="analyze-accounting-position",
        version="1.0.0",
        agent_id="hubu-accounting",
        layer=AgentLayer.BUREAU,
        purpose="分析会计状况",
        responsibility_scope=("月结",),
        data_requirements=("总账",),
        analysis_procedure=("核对总账",),
        required_findings=("月结差异",),
        allowed_services=frozenset({RuntimeService.EVIDENCE_PROTOCOL}),
        forbidden_actions=("直接访问 MCP",),
        report_type=BureauReport,
    )

    assert definition.model_dump(mode="json", exclude={"report_type"})["layer"] == "bureau"
    with pytest.raises(ValidationError):
        definition.version = "2.0.0"


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("skill_id", " "),
        ("agent_id", ""),
        ("version", "v1"),
        ("analysis_procedure", ()),
        ("analysis_procedure", ("\t",)),
    ],
)
def test_runtime_skill_definition_rejects_invalid_metadata(
    field: str,
    value: object,
) -> None:
    values: dict[str, object] = {
        "skill_id": "analyze-accounting-position",
        "version": "1.0.0",
        "agent_id": "hubu-accounting",
        "layer": AgentLayer.BUREAU,
        "purpose": "分析会计状况",
        "responsibility_scope": ("月结",),
        "data_requirements": ("总账",),
        "analysis_procedure": ("核对总账",),
        "required_findings": ("月结差异",),
        "allowed_services": frozenset(),
        "forbidden_actions": ("直接执行付款",),
        "report_type": BureauReport,
    }
    values[field] = value

    with pytest.raises(ValidationError):
        RuntimeSkillDefinition(**values)


def test_completed_report_rejects_unresolved_required_fields() -> None:
    with pytest.raises(ValidationError, match="completed_report_has_unresolved_fields"):
        _bureau_report(
            evidence_sufficiency=EvidenceSufficiency.SUFFICIENT,
            status=ReportStatus.COMPLETED,
            data_gaps=("仍缺少凭证",),
            professional_findings=("差异已定位",),
        )


def test_completed_bureau_report_rejects_evidence_requests() -> None:
    with pytest.raises(ValidationError, match="completed_report_has_unresolved_fields"):
        _bureau_report(
            evidence_sufficiency=EvidenceSufficiency.SUFFICIENT,
            status=ReportStatus.COMPLETED,
            data_gaps=(),
            evidence_requests=("collect more evidence",),
        )


def test_completed_ministry_report_rejects_unresolved_items() -> None:
    with pytest.raises(ValidationError, match="completed_report_has_unresolved_fields"):
        _ministry_report(unresolved_items=("resolve bureau conflict",))


def test_completed_council_report_rejects_data_gaps() -> None:
    with pytest.raises(ValidationError, match="completed_report_has_unresolved_fields"):
        _council_report(data_gaps=("missing ministry report",))


@pytest.mark.parametrize(
    "values",
    [
        {
            "request_id": " ",
            "agent_id": "hubu-accounting",
            "skill_id": "analyze-accounting-position",
            "skill_version": "1.0.0",
        },
        {
            "request_id": "q-1",
            "agent_id": "",
            "skill_id": "analyze-accounting-position",
            "skill_version": "1.0.0",
        },
        {
            "request_id": "q-1",
            "agent_id": "hubu-accounting",
            "skill_id": "\t",
            "skill_version": "1.0.0",
        },
        {
            "request_id": "q-1",
            "agent_id": "hubu-accounting",
            "skill_id": "analyze-accounting-position",
            "skill_version": "v1",
        },
    ],
)
def test_skill_invocation_rejects_blank_identifiers_and_invalid_versions(
    values: dict[str, object],
) -> None:
    with pytest.raises(ValidationError):
        SkillInvocation(**values)


@pytest.mark.parametrize("report_factory", [_bureau_report, _ministry_report, _council_report])
@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("report_id", " "),
        ("request_id", ""),
        ("agent_id", "\t"),
        ("skill_id", " "),
        ("skill_version", "1.0"),
    ],
)
def test_public_reports_reject_blank_identifiers_and_invalid_versions(
    report_factory: object,
    field: str,
    value: str,
) -> None:
    with pytest.raises(ValidationError):
        report_factory(**{field: value})  # type: ignore[operator]


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("request_id", " "),
        ("agent_id", ""),
        ("skill_id", "\t"),
        ("skill_version", "1.0"),
    ],
)
def test_skill_audit_record_rejects_blank_identifiers_and_invalid_versions(
    field: str,
    value: str,
) -> None:
    values: dict[str, object] = {
        "request_id": "q-1",
        "agent_id": "hubu-accounting",
        "skill_id": "analyze-accounting-position",
        "skill_version": "1.0.0",
        "status": ReportStatus.COMPLETED,
        "duration_ms": 4,
    }
    values[field] = value

    with pytest.raises(ValidationError):
        SkillAuditRecord(**values)


def test_invocation_and_audit_contracts_preserve_traceability() -> None:
    invocation = SkillInvocation(
        request_id="q-1",
        parent_report_id=None,
        agent_id="hubu-accounting",
        skill_id="analyze-accounting-position",
        skill_version="1.0.0",
        input_refs=("memorial:m-1",),
        evidence_refs=(),
        requested_services=frozenset({RuntimeService.EVIDENCE_PROTOCOL}),
        requirement_data_refs={"鎬昏处": ("memorial:m-1",)},
    )
    audit = SkillAuditRecord(
        request_id=invocation.request_id,
        parent_report_id=invocation.parent_report_id,
        agent_id=invocation.agent_id,
        skill_id=invocation.skill_id,
        skill_version=invocation.skill_version,
        input_refs=invocation.input_refs,
        evidence_refs=invocation.evidence_refs,
        allowed_services=invocation.requested_services,
        status=ReportStatus.COMPLETED,
        failure_code=None,
        duration_ms=4,
        created_at=datetime(2026, 8, 3, tzinfo=UTC),
    )

    assert audit.skill_version == "1.0.0"
    assert audit.duration_ms == 4
    assert invocation.requirement_data_refs == {"鎬昏处": ("memorial:m-1",)}


def test_invocation_rejects_blank_requirement_coverage() -> None:
    with pytest.raises(ValidationError):
        SkillInvocation(
            request_id="q-1",
            agent_id="hubu-accounting",
            skill_id="analyze-accounting-position",
            skill_version="1.0.0",
            requirement_data_refs={" ": ("material-1",)},
        )


def test_report_type_accepts_matching_ministry_report() -> None:
    definition = RuntimeSkillDefinition(
        skill_id="example-skill",
        version="1.2.3",
        agent_id="example-agent",
        layer=AgentLayer.MINISTRY,
        purpose="示例",
        responsibility_scope=("示例",),
        data_requirements=("示例",),
        analysis_procedure=("分析",),
        required_findings=("发现",),
        allowed_services=frozenset(),
        forbidden_actions=("越权",),
        report_type=MinistryReport,
    )

    assert definition.report_type is MinistryReport


@pytest.mark.parametrize(
    ("layer", "report_type"),
    [
        (AgentLayer.BUREAU, MinistryReport),
        (AgentLayer.BUREAU, CouncilReport),
        (AgentLayer.MINISTRY, BureauReport),
        (AgentLayer.MINISTRY, CouncilReport),
        (AgentLayer.COUNCIL, BureauReport),
        (AgentLayer.COUNCIL, MinistryReport),
    ],
)
def test_runtime_skill_definition_rejects_layer_report_type_mismatch(
    layer: AgentLayer, report_type: type[BaseModel]
) -> None:
    with pytest.raises(ValidationError, match="report_type_layer_mismatch"):
        RuntimeSkillDefinition(
            skill_id="example-skill",
            version="1.2.3",
            agent_id="example-agent",
            layer=layer,
            purpose="example",
            responsibility_scope=("example",),
            data_requirements=("example",),
            analysis_procedure=("analyze",),
            required_findings=("finding",),
            allowed_services=frozenset(),
            forbidden_actions=("overreach",),
            report_type=report_type,
        )


def test_runtime_skill_definition_rejects_arbitrary_pydantic_report_type() -> None:
    class ExampleReport(BaseModel):
        value: str

    with pytest.raises(ValidationError):
        RuntimeSkillDefinition(
            skill_id="example-skill",
            version="1.2.3",
            agent_id="example-agent",
            layer=AgentLayer.MINISTRY,
            purpose="example",
            responsibility_scope=("example",),
            data_requirements=("example",),
            analysis_procedure=("analyze",),
            required_findings=("finding",),
            allowed_services=frozenset(),
            forbidden_actions=("overreach",),
            report_type=ExampleReport,
        )
