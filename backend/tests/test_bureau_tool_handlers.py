from __future__ import annotations

import inspect
from typing import Any

# ruff: noqa: E501, I001

import pytest

import app.agents.runtime_skills.tool_handlers as handlers_module
import app.agents.runtime_skills as package
from app.agents.runtime_skills.tool_executor import ToolExecutionError, execute_approved_tool
from app.agents.runtime_skills.tool_audit_ref import _mint_tool_audit_ref as new_tool_audit_ref
from app.agents.runtime_skills.tool_issuance import (
    _bureau_tool_policy_fingerprint,
    _issue_approved_tool_call,
    _tool_descriptor_fingerprint,
)
from app.agents.runtime_skills.tool_handlers import build_bureau_tool_handlers
from app.agents.runtime_skills.tool_models import (
    ApprovedToolCall,
    ToolBudget,
    ToolCallStatus,
    ToolHandlerContext,
    ToolName,
)
from app.agents.runtime_skills.tool_registry import (
    BUREAU_TOOL_POLICIES,
    TOOL_DESCRIPTORS,
)
from app.agents.evidence_protocol import (
    AgentEvidenceSession,
    build_bureau_evidence_tool_adapter,
)

CASE = "case-1"
DECREE = "decree-1"
INPUT = f"input:case:{CASE}:decree:{DECREE}:brief"
DATA = f"approved-data:case:{CASE}:decree:{DECREE}:rows"
EVIDENCE = f"evidence:case:{CASE}:decree:{DECREE}:fact"


def _call(tool: ToolName, arguments: dict[str, Any]) -> ApprovedToolCall:
    return _issue_approved_tool_call(ApprovedToolCall(
        request_id="request-1", case_id=CASE, decree_id=DECREE,
        agent_id="libu-policy", skill_id="bureau.libu.policy.v1",
        skill_version="1.0.0", policy_id="bureau.libu.policy.tools",
        policy_version="1.0.0", tool_call_id=f"tc-{tool.value}", tool_name=tool,
        purpose="bounded read", arguments=arguments, required_for=("finding",),
        expected_result_schema=TOOL_DESCRIPTORS[tool].output_schema_id,
        normalized_arguments=arguments, argument_fingerprint="a" * 64,
        policy_fingerprint=_bureau_tool_policy_fingerprint(
            BUREAU_TOOL_POLICIES["libu-policy"]
        ),
        descriptor_fingerprint=_tool_descriptor_fingerprint(TOOL_DESCRIPTORS[tool]),
        descriptor_version=TOOL_DESCRIPTORS[tool].version,
        descriptor_handler_id=TOOL_DESCRIPTORS[tool].handler_id,
        approval_status=ToolCallStatus.APPROVED,
        audit_ref=new_tool_audit_ref(),
    ))


def _context(call: ApprovedToolCall, capability: object) -> ToolHandlerContext:
    return ToolHandlerContext(
        approved_call=call, capability_id=capability.capability_id,  # type: ignore[attr-defined]
        resolved_approved_inputs={
            INPUT: {"title": "brief"}, DATA: {"values": [10, 4], "unit": "count"},
            EVIDENCE: {"summary": "fact"},
        }, restricted_adapters={"material": "approved", "data": "approved", "evidence": "approved"},
        budget=ToolBudget(max_calls=4, consumed_calls=0, max_rounds=2,
                          consumed_rounds=0, max_rows=200, consumed_rows=0,
                          max_bytes=262144, consumed_bytes=0),
    )


def _execute(call: ApprovedToolCall, capability: object):
    return execute_approved_tool(call, _context(call, capability), capability)


def test_package_exports_builder_but_no_private_capability_or_signer() -> None:
    assert package.build_bureau_tool_handlers is build_bureau_tool_handlers
    for name in ("AuthorizedToolHandlerSet", "ToolHandlerBinding", "authorize_trusted_handlers"):
        assert not hasattr(package, name)


def test_supplied_adapters_are_selected_once_from_one_sealed_capability() -> None:
    hits = {"material": 0, "data": 0, "evidence": 0}
    def material(ctx: ToolHandlerContext) -> dict[str, object]:
        hits["material"] += 1
        assert set(type(ctx).model_fields) == {"approved_call", "capability_id", "resolved_approved_inputs", "restricted_adapters", "budget"}
        return {"result_schema": "approved_materials_result.v1", "data": {"materials": [{"ref": INPUT, "summary": "brief", "projection": {"title": "brief"}}]}, "input_refs": [INPUT], "evidence_refs": [], "approved_data_refs": [], "data_quality": "SUFFICIENT", "limitations": [], "as_of": "2026-08-03T00:00:00Z"}
    def data(_: ToolHandlerContext) -> dict[str, object]:
        hits["data"] += 1
        return {"result_schema": "approved_data_result.v1", "data": {"operation": "describe", "columns": ["value"], "rows": [{"value": 10}]}, "input_refs": [], "evidence_refs": [], "approved_data_refs": [DATA], "data_quality": "SUFFICIENT", "limitations": [], "as_of": "2026-08-03T00:00:00Z"}
    capability = build_bureau_tool_handlers(material_reader=material, data_reader=data, evidence_requester=None)
    calls = [
        _call(ToolName.READ_APPROVED_MATERIALS, {"input_refs": [INPUT], "fields": ["title"]}),
        _call(ToolName.INSPECT_APPROVED_DATA, {"operation": "describe", "data_ref": DATA}),
    ]
    for call in calls:
        _execute(call, capability)
    assert hits == {"material": 1, "data": 1, "evidence": 0}


@pytest.mark.parametrize("algorithm", ["year_over_year", "period_over_period"])
def test_distinct_period_change_algorithms_return_percent(algorithm: str) -> None:
    capability = build_bureau_tool_handlers(material_reader=None, data_reader=None, evidence_requester=None)
    call = _call(ToolName.COMPUTE_ANALYSIS, {"algorithm_id": algorithm, "algorithm_version": "1.0.0", "data_refs": [DATA], "periods": ["2025", "2026"], "thresholds": []})
    result = _execute(call, capability)
    assert result.data["values"] == [-60.0]
    assert result.data["units"] == "percent"


def test_reconcile_returns_consistency_and_tolerance() -> None:
    capability = build_bureau_tool_handlers(material_reader=None, data_reader=None, evidence_requester=None)
    call = _call(ToolName.COMPUTE_ANALYSIS, {"algorithm_id": "reconcile", "algorithm_version": "1.0.0", "data_refs": [DATA], "tolerance": 6, "thresholds": []})
    result = _execute(call, capability)
    assert result.data["values"] == [{"total": 10, "parts_total": 4, "difference": 6, "tolerance": 6, "is_consistent": True}]


@pytest.mark.parametrize("periods", [["2026", "2025"], ["x", "y"], ["2025", "2025"]])
def test_period_change_rejects_unordered_or_unparseable_labels(periods: list[str]) -> None:
    capability = build_bureau_tool_handlers(material_reader=None, data_reader=None, evidence_requester=None)
    call = _call(ToolName.COMPUTE_ANALYSIS, {"algorithm_id": "year_over_year", "algorithm_version": "1.0.0", "data_refs": [DATA], "periods": periods, "thresholds": []})
    with pytest.raises(ToolExecutionError, match="tool_execution_failed"):
        _execute(call, capability)


@pytest.mark.parametrize("periods", [["1", "inf"], ["nan", "2"], ["2025-01-01T00:00:00", "2026-01-01T00:00:00Z"], ["2026-01-01T00:00:00+08:00", "2025-01-01T00:00:00Z"]])
def test_period_change_executor_stably_rejects_nonfinite_or_timezone_invalid(periods: list[str]) -> None:
    capability = build_bureau_tool_handlers(material_reader=None, data_reader=None, evidence_requester=None)
    call = _call(ToolName.COMPUTE_ANALYSIS, {"algorithm_id": "period_over_period", "algorithm_version": "1.0.0", "data_refs": [DATA], "periods": periods, "thresholds": []})
    with pytest.raises(ToolExecutionError) as caught:
        _execute(call, capability)
    assert caught.value.code == "tool_execution_failed"


def test_period_change_accepts_aware_iso_normalized_order() -> None:
    capability = build_bureau_tool_handlers(material_reader=None, data_reader=None, evidence_requester=None)
    call = _call(ToolName.COMPUTE_ANALYSIS, {"algorithm_id": "year_over_year", "algorithm_version": "1.0.0", "data_refs": [DATA], "periods": ["2025-01-01T00:00:00+08:00", "2026-01-01T00:00:00Z"], "thresholds": []})
    assert _execute(call, capability).status is ToolCallStatus.SUCCEEDED


@pytest.mark.parametrize("records", [[{"id": "a"}], [1, 2], [{"id": "a", "score": True}]])
def test_rank_rejects_missing_nonmapping_or_nonnumeric_records(records: list[object]) -> None:
    capability = build_bureau_tool_handlers(material_reader=None, data_reader=None, evidence_requester=None)
    call = _call(ToolName.COMPUTE_ANALYSIS, {"algorithm_id": "rank", "algorithm_version": "1.0.0", "data_refs": [DATA], "metrics": ["score"], "dimensions": ["id"], "thresholds": []})
    ctx = _context(call, capability).model_copy(update={"resolved_approved_inputs": {DATA: {"records": records, "unit": "score"}}})
    with pytest.raises(ToolExecutionError, match="tool_execution_failed"):
        execute_approved_tool(call, ctx, capability)


def test_arithmetic_divide_uses_explicit_fixed_operation() -> None:
    capability = build_bureau_tool_handlers(material_reader=None, data_reader=None, evidence_requester=None)
    call = _call(ToolName.COMPUTE_ANALYSIS, {"algorithm_id": "arithmetic", "algorithm_version": "1.0.0", "arithmetic_operation": "divide", "data_refs": [DATA], "thresholds": []})
    result = _execute(call, capability)
    assert result.data["values"] == [2.5]
    assert result.data["units"] == "ratio"


def test_rank_preserves_row_identity() -> None:
    capability = build_bureau_tool_handlers(material_reader=None, data_reader=None, evidence_requester=None)
    call = _call(ToolName.COMPUTE_ANALYSIS, {"algorithm_id": "rank", "algorithm_version": "1.0.0", "data_refs": [DATA], "metrics": ["score"], "dimensions": ["id"], "thresholds": []})
    ctx = _context(call, capability).model_copy(update={"resolved_approved_inputs": {DATA: {"records": [{"id": "a", "score": 2}, {"id": "b", "score": 5}], "unit": "score"}}})
    result = execute_approved_tool(call, ctx, capability)
    assert result.data["values"] == [{"id": "b", "score": 5, "rank": 1}, {"id": "a", "score": 2, "rank": 2}]


def test_group_summary_groups_dimension_and_metric_deterministically() -> None:
    capability = build_bureau_tool_handlers(material_reader=None, data_reader=None, evidence_requester=None)
    call = _call(ToolName.COMPUTE_ANALYSIS, {"algorithm_id": "group_summary", "algorithm_version": "1.0.0", "data_refs": [DATA], "metrics": ["amount"], "dimensions": ["group"], "thresholds": []})
    ctx = _context(call, capability).model_copy(update={"resolved_approved_inputs": {DATA: {"records": [{"group": "b", "amount": 2}, {"group": "a", "amount": 3}, {"group": "b", "amount": 4}], "unit": "count"}}})
    result = execute_approved_tool(call, ctx, capability)
    assert result.data["values"] == [{"group": "a", "amount": 3}, {"group": "b", "amount": 6}]


@pytest.mark.parametrize("operation", ["describe", "filter", "aggregate", "compare", "top_n", "lookup"])
def test_all_inspect_operations_reach_reader_once_with_narrow_context(operation: str) -> None:
    hits = 0
    def reader(ctx: ToolHandlerContext) -> dict[str, object]:
        nonlocal hits
        hits += 1
        assert ctx.approved_call.normalized_arguments["operation"] == operation
        assert set(ctx.resolved_approved_inputs) == {DATA}
        return {"result_schema": "approved_data_result.v1", "data": {"operation": operation, "columns": ["value"], "rows": [{"value": 10}]}, "input_refs": [], "evidence_refs": [], "approved_data_refs": [DATA], "data_quality": "SUFFICIENT", "limitations": [], "as_of": "2026-08-03T00:00:00Z"}
    capability = build_bureau_tool_handlers(material_reader=None, data_reader=reader, evidence_requester=None)
    _execute(_call(ToolName.INSPECT_APPROVED_DATA, {"operation": operation, "data_ref": DATA}), capability)
    assert hits == 1


@pytest.mark.parametrize("algorithm, expected", [("difference", [6]), ("mean", [7.0]), ("median", [7.0]), ("extrema", [4, 10])])
def test_fixed_calculations_are_task5_accepted_and_deterministic(algorithm: str, expected: list[float]) -> None:
    capability = build_bureau_tool_handlers(material_reader=None, data_reader=None, evidence_requester=None)
    call = _call(ToolName.COMPUTE_ANALYSIS, {"algorithm_id": algorithm, "algorithm_version": "1.0.0", "data_refs": [DATA], "thresholds": []})
    first = _execute(call, capability)
    second = _execute(call, capability)
    assert first.data == second.data
    assert first.data["values"] == expected


@pytest.mark.parametrize(
    ("algorithm", "values", "thresholds"),
    [
        ("arithmetic", [10, 4], []), ("percentage", [10, 4], []),
        ("year_over_year", [10, 4], []),
        ("period_over_period", [10, 4], []), ("share", [10, 4], []),
        ("difference", [10, 4], []), ("mean", [10, 4], []),
        ("median", [10, 4], []), ("extrema", [10, 4], []),
        ("rank", [10, 4], []), ("group_summary", [10, 4], []),
        ("threshold", [10, 4], [5]), ("trend", [10, 4], []),
        ("reconcile", [10, 4], []),
    ],
)
def test_authoritative_fixed_algorithm_matrix(
    algorithm: str, values: list[float], thresholds: list[float]
) -> None:
    capability = build_bureau_tool_handlers(material_reader=None, data_reader=None, evidence_requester=None)
    arguments = {"algorithm_id": algorithm, "algorithm_version": "1.0.0", "data_refs": [DATA], "thresholds": thresholds}
    if algorithm == "arithmetic":
        arguments["arithmetic_operation"] = "add"
    if algorithm in {"year_over_year", "period_over_period"}:
        arguments["periods"] = ["2025", "2026"]
    if algorithm == "reconcile":
        arguments["tolerance"] = 0
    call = _call(ToolName.COMPUTE_ANALYSIS, arguments)
    ctx = _context(call, capability).model_copy(update={"resolved_approved_inputs": {DATA: {"values": values, "unit": "count"}}})
    assert execute_approved_tool(call, ctx, capability).status is ToolCallStatus.SUCCEEDED


@pytest.mark.parametrize(
    ("algorithm", "values", "thresholds"),
    [
        ("difference", [True, 1], []), ("mean", [float("nan")], []),
        ("mean", [float("inf")], []), ("percentage", [1, 0], []),
        ("difference", [1], []), ("threshold", [1], []),
        ("unsupported", [1, 2], []), ("mean", list(range(201)), []),
    ],
)
def test_calculation_negative_matrix_is_stably_redacted(
    algorithm: str, values: list[float], thresholds: list[float]
) -> None:
    capability = build_bureau_tool_handlers(material_reader=None, data_reader=None, evidence_requester=None)
    call = _call(ToolName.COMPUTE_ANALYSIS, {"algorithm_id": algorithm, "algorithm_version": "1.0.0", "data_refs": [DATA], "thresholds": thresholds})
    ctx = _context(call, capability).model_copy(update={"resolved_approved_inputs": {DATA: {"values": values, "unit": "count"}}})
    with pytest.raises(ToolExecutionError) as caught:
        execute_approved_tool(call, ctx, capability)
    assert caught.value.code == "tool_execution_failed"


@pytest.mark.parametrize("tool", [ToolName.READ_APPROVED_MATERIALS, ToolName.INSPECT_APPROVED_DATA, ToolName.REQUEST_EVIDENCE])
def test_missing_adapter_is_unavailable_before_execution(tool: ToolName) -> None:
    capability = build_bureau_tool_handlers(material_reader=None, data_reader=None, evidence_requester=None)
    call = _call(tool, {"operation": "describe"})
    with pytest.raises(ToolExecutionError) as caught:
        _execute(call, capability)
    assert caught.value.code == "tool_handler_unavailable"


def test_handler_module_has_no_direct_privileged_integration() -> None:
    source = inspect.getsource(handlers_module)
    for forbidden in ("AgentEvidenceSession", "mcp", "sqlite", "requests", "httpx", "pathlib", "open("):
        assert forbidden not in source


def test_plain_evidence_callable_is_rejected_as_untrusted() -> None:
    with pytest.raises(ValueError, match="evidence_adapter_invalid"):
        build_bureau_tool_handlers(
            material_reader=None,
            data_reader=None,
            evidence_requester=lambda _context: {},
        )


def test_material_adapter_receives_only_call_selected_input_refs() -> None:
    seen: dict[str, object] = {}
    def material(ctx: ToolHandlerContext) -> dict[str, object]:
        seen.update(ctx.resolved_approved_inputs)
        return {"result_schema": "approved_materials_result.v1", "data": {"materials": [{"ref": INPUT, "summary": "brief", "projection": {"title": "brief"}}]}, "input_refs": [INPUT], "evidence_refs": [], "approved_data_refs": [], "data_quality": "SUFFICIENT", "limitations": [], "as_of": "2026-08-03T00:00:00Z"}
    capability = build_bureau_tool_handlers(material_reader=material, data_reader=None, evidence_requester=None)
    call = _call(ToolName.READ_APPROVED_MATERIALS, {"input_refs": [INPUT], "fields": ["title"]})
    _execute(call, capability)
    assert seen == {INPUT: {"title": "brief"}}


def test_evidence_session_is_not_itself_accepted_as_requester() -> None:
    class Coordinator:
        pass
    session = AgentEvidenceSession(coordinator=Coordinator())  # type: ignore[arg-type]
    with pytest.raises(ValueError, match="evidence_adapter_invalid"):
        build_bureau_tool_handlers(
            material_reader=None, data_reader=None,
            evidence_requester=session,  # type: ignore[arg-type]
        )


def test_full_slot_evidence_adapter_clone_is_rejected_before_effect() -> None:
    class Coordinator:
        def __init__(self) -> None:
            self.hits = 0
        def investigate(self, *args: object, **kwargs: object) -> object:
            self.hits += 1
            raise AssertionError("must not execute")
    coordinator = Coordinator()
    original = build_bureau_evidence_tool_adapter(session=AgentEvidenceSession(coordinator=coordinator), node_id="bureau:x", department="吏部", matter_type="MEMORIAL", case_id=CASE, decree_id=DECREE)  # type: ignore[arg-type]
    clone = object.__new__(type(original))
    for slot in type(original).__slots__:
        object.__setattr__(clone, slot, getattr(original, slot))
    capability = build_bureau_tool_handlers(material_reader=None, data_reader=None, evidence_requester=clone)
    call = _call(ToolName.REQUEST_EVIDENCE, {"operation": "request_fact_slots", "domain": "workforce.policy", "fact_slots": []})
    with pytest.raises(ToolExecutionError, match="tool_execution_failed"):
        _execute(call, capability)
    assert coordinator.hits == 0


@pytest.mark.parametrize(
    ("update", "code"),
    [
        ({"extra": "x"}, "tool_result_schema_invalid"),
        ({"input_refs": ["input:case:other:decree:decree-1:x"]},
         "tool_result_reference_invalid"),
        ({"data": {"materials": [{"ref": INPUT, "summary": "brief", "projection": {"secret": "x"}}]}},
         "tool_result_secret_detected"),
    ],
)
def test_builder_adapter_output_is_rejected_by_real_result_gate_once(
    update: dict[str, object], code: str
) -> None:
    hits = 0
    def material(_: ToolHandlerContext) -> dict[str, object]:
        nonlocal hits
        hits += 1
        payload: dict[str, object] = {"result_schema": "approved_materials_result.v1", "data": {"materials": [{"ref": INPUT, "summary": "brief", "projection": {"title": "brief"}}]}, "input_refs": [INPUT], "evidence_refs": [], "approved_data_refs": [], "data_quality": "SUFFICIENT", "limitations": [], "as_of": "2026-08-03T00:00:00Z"}
        payload.update(update)
        return payload
    capability = build_bureau_tool_handlers(material_reader=material, data_reader=None, evidence_requester=None)
    call = _call(ToolName.READ_APPROVED_MATERIALS, {"input_refs": [INPUT], "fields": ["title"]})
    with pytest.raises(ToolExecutionError) as caught:
        _execute(call, capability)
    assert caught.value.code == code
    assert hits == 1
