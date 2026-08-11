from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from app.agents.runtime_skills.models import (
    AgentLayer,
    BureauReport,
    MinistryReport,
    RuntimeSkillDefinition,
)
from app.agents.runtime_skills.tool_models import (
    ApprovedToolCall,
    BureauToolPolicy,
    ToolAuditRecord,
    ToolAuthorizationContext,
    ToolBudget,
    ToolCallProposal,
    ToolCallStatus,
    ToolDataQuality,
    ToolDescriptor,
    ToolHandlerContext,
    ToolName,
    ToolResultEnvelope,
)


def _policy(**overrides: object) -> BureauToolPolicy:
    values: dict[str, object] = {
        "policy_id": "policy-hubu-accounting",
        "version": "1.0.0",
        "agent_id": "hubu-accounting",
        "allowed_tools": frozenset({ToolName.COMPUTE_ANALYSIS}),
        "allowed_data_domains": frozenset({"finance"}),
        "tool_operations": {ToolName.COMPUTE_ANALYSIS: ("ratio",)},
        "tool_argument_constraints": {
            ToolName.COMPUTE_ANALYSIS: {"algorithm_ids": ("ratio.v1",)}
        },
        "required_data_refs": ("approved-data:ledger",),
        "max_tool_calls": 4,
        "max_tool_rounds": 2,
        "max_result_rows": 100,
        "max_result_bytes": 4096,
    }
    values.update(overrides)
    return BureauToolPolicy(**values)


def _proposal(**overrides: object) -> ToolCallProposal:
    values: dict[str, object] = {
        "tool_call_id": "tc-1",
        "tool_name": ToolName.COMPUTE_ANALYSIS,
        "purpose": "compare totals",
        "arguments": {"algorithm_id": "ratio.v1", "data_ref": "approved-data:ledger"},
        "required_for": ("finding",),
        "expected_result_schema": "ratio.v1",
    }
    values.update(overrides)
    return ToolCallProposal(**values)


def _approved_call(**overrides: object) -> ApprovedToolCall:
    values: dict[str, object] = {
        "request_id": "req-1",
        "case_id": "case-1",
        "decree_id": "decree-1",
        "agent_id": "hubu-accounting",
        "skill_id": "analyze-accounting-position",
        "skill_version": "1.0.0",
        "policy_id": "policy-hubu-accounting",
        "policy_version": "1.0.0",
        "tool_call_id": "tc-1",
        "tool_name": ToolName.COMPUTE_ANALYSIS,
        "purpose": "compare totals",
        "arguments": {"algorithm_id": "ratio.v1", "data_ref": "approved-data:ledger"},
        "required_for": ("finding",),
        "expected_result_schema": "ratio.v1",
        "normalized_arguments": {"algorithm_id": "ratio.v1", "data_ref": "approved-data:ledger"},
        "argument_fingerprint": "sha256:abc",
        "policy_fingerprint": "b" * 64,
        "descriptor_fingerprint": "a" * 64,
        "descriptor_version": "1.0.0",
        "descriptor_handler_id": "bureau-handler.compute-analysis.v1",
        "approval_status": ToolCallStatus.APPROVED,
        "audit_ref": "tool-audit:11111111111111111111111111111111",
    }
    values.update(overrides)
    return ApprovedToolCall(**values)


def _skill(layer: AgentLayer, **overrides: object) -> RuntimeSkillDefinition:
    values: dict[str, object] = {
        "skill_id": "analyze-accounting-position",
        "version": "1.0.0",
        "agent_id": "hubu-accounting",
        "layer": layer,
        "purpose": "analyze",
        "responsibility_scope": ("accounts",),
        "data_requirements": ("ledger",),
        "analysis_procedure": ("compare",),
        "required_findings": ("variance",),
        "allowed_services": frozenset(),
        "forbidden_actions": ("write",),
        "report_type": BureauReport if layer is AgentLayer.BUREAU else MinistryReport,
        "tool_policy": _policy() if layer is AgentLayer.BUREAU else None,
    }
    values.update(overrides)
    return RuntimeSkillDefinition(**values)


def test_exact_tool_enums() -> None:
    assert {item.value for item in ToolName} == {
        "request_evidence",
        "read_approved_materials",
        "inspect_approved_data",
        "compute_analysis",
        "inspect_accounting_content",
        "generate_accounting_workbook",
    }


@pytest.mark.parametrize(
    "unsafe_id",
    (
        "Bearer secret", "https://private.example/x", r"\\server\share",
        r"C:\private\file", "line\nfeed", "私密文本", "x" * 65,
    ),
)
def test_model_tool_call_id_rejects_unsafe_text(unsafe_id: str) -> None:
    with pytest.raises(ValidationError, match="tool_call_id_invalid"):
        _proposal(tool_call_id=unsafe_id)


def test_legacy_safe_model_tool_call_id_remains_compatible() -> None:
    assert _proposal(tool_call_id="legacy.safe-ID_1").tool_call_id == "legacy.safe-ID_1"
    assert {item.value for item in ToolCallStatus} == {
        "PROPOSED", "VALIDATING", "APPROVED", "EXECUTING", "SUCCEEDED",
        "DENIED", "INVALID", "BUDGET_EXCEEDED", "BLOCKED", "FAILED",
        "EMPTY", "TRUNCATED",
    }
    assert {item.value for item in ToolDataQuality} == {
        "SUFFICIENT", "PARTIAL", "INSUFFICIENT"
    }


def test_descriptor_is_frozen_and_rejects_invalid_metadata() -> None:
    descriptor = ToolDescriptor(
        descriptor_id="descriptor-compute",
        handler_id="handler-compute",
        tool_name=ToolName.COMPUTE_ANALYSIS,
        version="1.2.3",
        input_schema_id="compute-input.v1",
        output_schema_id="compute-output.v1",
        read_only=True,
        risk_level="low",
        deterministic=True,
        max_tool_calls=4,
        max_tool_rounds=2,
        max_result_rows=100,
        max_result_bytes=4096,
    )
    with pytest.raises(ValidationError):
        descriptor.version = "2.0.0"
    for updates in (
        {"descriptor_id": " "}, {"version": "v1"}, {"max_result_rows": -1},
        {"max_tool_calls": 5}, {"max_tool_rounds": 3}, {"unknown": True},
    ):
        with pytest.raises(ValidationError):
            ToolDescriptor.model_validate({**descriptor.model_dump(), **updates})


def test_policy_rejects_blank_nested_values_and_limits() -> None:
    assert _policy().max_tool_calls == 4
    for overrides in (
        {"version": "1.0"},
        {"allowed_data_domains": frozenset({" "})},
        {"tool_operations": {ToolName.COMPUTE_ANALYSIS: ("",)}},
        {"tool_argument_constraints": {ToolName.COMPUTE_ANALYSIS: {" ": ("x",)}}},
        {"required_data_refs": ("",)},
        {"max_tool_calls": 0}, {"max_tool_calls": 5},
        {"max_tool_rounds": 0}, {"max_tool_rounds": 3},
        {"max_result_rows": -1}, {"max_result_bytes": 0},
    ):
        with pytest.raises(ValidationError):
            _policy(**overrides)


@pytest.mark.parametrize(
    "field",
    [
        "agent_id", "skill_id", "case_id", "request_id", "decree_id",
        "credential", "provider", "url", "timeout", "audit_ref", "created_at",
        "approved", "approval_status",
    ],
)
def test_tool_proposal_cannot_supply_system_authority_fields(field: str) -> None:
    payload = _proposal().model_dump()
    payload[field] = True
    with pytest.raises(ValidationError):
        ToolCallProposal.model_validate(payload)


def test_tool_proposal_rejects_blank_nested_text() -> None:
    for overrides in (
        {"purpose": " "}, {"required_for": ("",)},
        {"arguments": {"algorithm_id": " "}},
        {"arguments": {"filters": [{"field": " "}]}},
    ):
        with pytest.raises(ValidationError):
            _proposal(**overrides)


def test_approved_call_has_canonical_identity_and_approved_state() -> None:
    call = _approved_call()
    assert call.approval_status is ToolCallStatus.APPROVED


def test_approved_call_default_construction_does_not_mint_audit_authority() -> None:
    values = _approved_call().model_dump(mode="python")
    values.pop("audit_ref")
    with pytest.raises(ValidationError, match="audit_ref"):
        ApprovedToolCall(**values)
    for overrides in (
        {"skill_version": "v1"}, {"policy_version": "1"},
        {"case_id": " "}, {"approval_status": ToolCallStatus.DENIED},
    ):
        with pytest.raises(ValidationError):
            _approved_call(**overrides)


def test_budget_rejects_negative_or_overconsumed_values() -> None:
    budget = ToolBudget(
        max_calls=4, consumed_calls=1, max_rounds=2, consumed_rounds=1,
        max_rows=100, consumed_rows=10, max_bytes=4096, consumed_bytes=512,
    )
    assert budget.consumed_calls == 1
    for updates in (
        {"consumed_calls": -1}, {"consumed_calls": 5},
        {"consumed_rounds": 3}, {"consumed_rows": 101}, {"consumed_bytes": 4097},
    ):
        with pytest.raises(ValidationError):
            ToolBudget.model_validate({**budget.model_dump(), **updates})


def test_authorization_and_handler_context_are_restricted() -> None:
    authorization = ToolAuthorizationContext(
        request_id="req-1", case_id="case-1", decree_id="decree-1",
        agent_id="hubu-accounting", skill_id="analyze-accounting-position",
        skill_version="1.0.0", policy_id="policy-hubu-accounting",
        policy_version="1.0.0", approved_input_refs=("input:1",),
        approved_evidence_refs=("evidence:1",),
        approved_data_refs=("approved-data:ledger",), business_state="approved",
        system_max_calls=4, system_max_rounds=2,
        system_max_result_rows=100, system_max_result_bytes=4096,
    )
    assert authorization.business_state == "approved"
    context = ToolHandlerContext(
        approved_call=_approved_call(),
        capability_id="capability-test",
        resolved_approved_inputs={"approved-data:ledger": {"total": 10}},
        restricted_adapters={"calculator": "deterministic-calculator-v1"},
        budget=ToolBudget(
            max_calls=4, consumed_calls=0, max_rounds=2, consumed_rounds=0,
            max_rows=100, consumed_rows=0, max_bytes=4096, consumed_bytes=0,
        ),
    )
    assert context.restricted_adapters["calculator"] == "deterministic-calculator-v1"
    for field in (
        "model", "database", "mcp_client", "credentials", "filesystem",
        "session", "evidence_session", "report_session",
    ):
        with pytest.raises(ValidationError):
            ToolHandlerContext.model_validate({**context.model_dump(), field: object()})


def test_result_success_requires_refs_and_calculation_identity() -> None:
    result = ToolResultEnvelope(
        tool_call_id="tc-1", status=ToolCallStatus.SUCCEEDED,
        tool_name=ToolName.COMPUTE_ANALYSIS, result_schema="ratio.v1",
        data={"ratio": 0.5}, approved_data_refs=("approved-data:ledger",),
        as_of=datetime(2026, 8, 3, tzinfo=UTC),
        data_quality=ToolDataQuality.SUFFICIENT, limitations=(),
        audit_ref="tool-audit:1", algorithm_id="ratio", algorithm_version="1.0.0",
    )
    assert result.data == {"ratio": 0.5}
    for overrides in (
        {"approved_data_refs": ()}, {"algorithm_id": None},
        {"algorithm_version": None}, {"algorithm_version": "v1"},
    ):
        with pytest.raises(ValidationError):
            ToolResultEnvelope.model_validate({**result.model_dump(), **overrides})


def test_result_error_states_cannot_carry_success_data() -> None:
    for status in (
        ToolCallStatus.DENIED, ToolCallStatus.INVALID, ToolCallStatus.BUDGET_EXCEEDED,
        ToolCallStatus.BLOCKED, ToolCallStatus.FAILED, ToolCallStatus.EMPTY,
    ):
        with pytest.raises(ValidationError):
            ToolResultEnvelope(
                tool_call_id="tc-1", status=status,
                tool_name=ToolName.READ_APPROVED_MATERIALS,
                result_schema="materials.v1", data={"secret": "value"},
                data_quality=ToolDataQuality.INSUFFICIENT,
                limitations=("stable reason",), audit_ref="tool-audit:1",
            )


def test_truncated_result_requires_truncation_metadata() -> None:
    with pytest.raises(ValidationError):
        ToolResultEnvelope(
            tool_call_id="tc-1", status=ToolCallStatus.TRUNCATED,
            tool_name=ToolName.INSPECT_APPROVED_DATA, result_schema="rows.v1",
            data={"rows": []}, approved_data_refs=("approved-data:ledger",),
            data_quality=ToolDataQuality.PARTIAL, limitations=("row limit",),
            audit_ref="tool-audit:1",
        )


def test_audit_record_rejects_raw_exception_and_secret_fields() -> None:
    record = ToolAuditRecord(
        tool_call_id="tc-1", request_id="req-1", case_id="case-1",
        decree_id="decree-1",
        agent_id="hubu-accounting", skill_id="analyze-accounting-position",
        skill_version="1.0.0", policy_id="policy-hubu-accounting",
        policy_version="1.0.0", tool_name=ToolName.COMPUTE_ANALYSIS,
        argument_hash="sha256:abc", redacted_argument_summary="ratio over approved data",
        status=ToolCallStatus.SUCCEEDED, reason_code="ok",
        input_refs=("approved-data:ledger",), output_refs=("result:1",),
        result_rows=1, result_bytes=64, consumed_calls=1, consumed_rounds=1,
        max_calls=4, max_rounds=2, max_rows=100, max_bytes=4096,
        consumed_rows=1, consumed_bytes=64,
        retry_source=None, duration_ms=3,
    )
    assert record.created_at.tzinfo is UTC
    assert record.decree_id == "decree-1"
    for field in ("raw_exception", "secret", "credentials"):
        with pytest.raises(ValidationError):
            ToolAuditRecord.model_validate({**record.model_dump(), field: "leak"})


def test_audit_record_requires_nonblank_decree_id() -> None:
    record = ToolAuditRecord(
        tool_call_id="tc-1", request_id="req-1", case_id="case-1",
        decree_id="decree-1", agent_id="hubu-accounting",
        skill_id="analyze-accounting-position", skill_version="1.0.0",
        policy_id="policy-hubu-accounting", policy_version="1.0.0",
        tool_name=ToolName.COMPUTE_ANALYSIS, argument_hash="sha256:abc",
        redacted_argument_summary="approved ratio", status=ToolCallStatus.INVALID,
        reason_code="tool_arguments_invalid", input_refs=(), output_refs=(),
        result_rows=0, result_bytes=0, max_calls=4, consumed_calls=0,
        max_rounds=2, consumed_rounds=0, max_rows=100, consumed_rows=0,
        max_bytes=4096, consumed_bytes=0, duration_ms=0,
    )
    with pytest.raises(ValidationError, match="Field required"):
        ToolAuditRecord.model_validate(record.model_dump(exclude={"decree_id"}))
    with pytest.raises(ValidationError, match="value_must_be_nonblank"):
        ToolAuditRecord.model_validate({**record.model_dump(), "decree_id": " "})


@pytest.mark.parametrize(
    "updates",
    [
        {"max_calls": 0}, {"max_calls": 5}, {"consumed_calls": 5},
        {"max_rounds": 0}, {"max_rounds": 3}, {"consumed_rounds": 3},
        {"max_rows": 0}, {"consumed_rows": -1}, {"consumed_rows": 101},
        {"max_bytes": 0}, {"consumed_bytes": -1}, {"consumed_bytes": 4097},
    ],
)
def test_audit_record_rejects_invalid_or_overconsumed_budget(
    updates: dict[str, int],
) -> None:
    record = ToolAuditRecord(
        tool_call_id="tc-1", request_id="req-1", case_id="case-1",
        decree_id="decree-1",
        agent_id="hubu-accounting", skill_id="analyze-accounting-position",
        skill_version="1.0.0", policy_id="policy-hubu-accounting",
        policy_version="1.0.0", tool_name=ToolName.COMPUTE_ANALYSIS,
        argument_hash="sha256:abc", redacted_argument_summary="approved ratio",
        status=ToolCallStatus.SUCCEEDED, reason_code="ok", input_refs=(),
        output_refs=(), result_rows=1, result_bytes=64,
        max_calls=4, consumed_calls=1, max_rounds=2, consumed_rounds=1,
        max_rows=100, consumed_rows=1, max_bytes=4096, consumed_bytes=64,
        duration_ms=3,
    )
    with pytest.raises(ValidationError):
        ToolAuditRecord.model_validate({**record.model_dump(), **updates})


@pytest.mark.parametrize(
    "bad_data",
    [
        {"rows": [{"label": " "}]},
        {"metrics": {"ratio": float("nan")}},
        {"metrics": [float("inf")]},
        {"metrics": [-float("inf")]},
    ],
)
@pytest.mark.parametrize("status", [ToolCallStatus.SUCCEEDED, ToolCallStatus.TRUNCATED])
def test_successful_result_rejects_blank_or_nonfinite_nested_data(
    status: ToolCallStatus,
    bad_data: dict[str, object],
) -> None:
    values: dict[str, object] = {
        "tool_call_id": "tc-1",
        "status": status,
        "tool_name": ToolName.INSPECT_APPROVED_DATA,
        "result_schema": "rows.v1",
        "data": bad_data,
        "approved_data_refs": ("approved-data:ledger",),
        "data_quality": ToolDataQuality.PARTIAL,
        "limitations": (),
        "audit_ref": "tool-audit:1",
    }
    if status is ToolCallStatus.TRUNCATED:
        values["truncated_rows"] = 1
    with pytest.raises(ValidationError):
        ToolResultEnvelope(**values)


def test_runtime_skill_layer_policy_relationship() -> None:
    assert _skill(AgentLayer.BUREAU).tool_policy is not None
    with pytest.raises(ValidationError, match="bureau_tool_policy_required"):
        _skill(AgentLayer.BUREAU, tool_policy=None)
    with pytest.raises(ValidationError, match="tool_policy_agent_mismatch"):
        _skill(AgentLayer.BUREAU, tool_policy=_policy(agent_id="other"))
    for layer in (AgentLayer.MINISTRY, AgentLayer.COUNCIL):
        report_type = MinistryReport
        if layer is AgentLayer.COUNCIL:
            from app.agents.runtime_skills.models import CouncilReport
            report_type = CouncilReport
        with pytest.raises(ValidationError, match="upper_layer_tool_policy_forbidden"):
            _skill(layer, report_type=report_type, tool_policy=_policy())
