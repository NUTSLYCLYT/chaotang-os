from __future__ import annotations

import inspect
from typing import Any

import pytest

import app.agents.runtime_skills.tool_policy as policy_module
from app.agents.runtime_skills.registry import build_default_downstream_skill_registry
from app.agents.runtime_skills.tool_models import (
    ApprovedToolCall,
    ToolAuthorizationContext,
    ToolBudget,
    ToolCallProposal,
    ToolCallStatus,
    ToolName,
)
from app.agents.runtime_skills.tool_policy import (
    ToolPolicyError,
    approve_tool_call,
)
from app.agents.runtime_skills.tool_registry import (
    TOOL_DESCRIPTORS,
    bureau_tool_policy_for,
)

AGENT_ID = "libu-policy"
SKILL = build_default_downstream_skill_registry().get_by_agent(AGENT_ID)
POLICY = SKILL.tool_policy
assert POLICY is not None
CASE_ID = "case-1"
DECREE_ID = "decree-1"
INPUT_REF = f"case:{CASE_ID}:decree:{DECREE_ID}:input:brief"
EVIDENCE_REF = f"case:{CASE_ID}:decree:{DECREE_ID}:evidence:fact-1"
DATA_REF = f"case:{CASE_ID}:decree:{DECREE_ID}:data:dataset-1"


def _context(**updates: Any) -> ToolAuthorizationContext:
    values: dict[str, Any] = {
        "request_id": "request-1",
        "case_id": CASE_ID,
        "decree_id": DECREE_ID,
        "agent_id": AGENT_ID,
        "skill_id": SKILL.skill_id,
        "skill_version": SKILL.version,
        "policy_id": POLICY.policy_id,
        "policy_version": POLICY.version,
        "approved_input_refs": (INPUT_REF,),
        "approved_evidence_refs": (EVIDENCE_REF,),
        "approved_data_refs": (DATA_REF,),
        "business_state": "ready",
        "system_max_calls": 4,
        "system_max_rounds": 2,
        "system_max_result_rows": 200,
        "system_max_result_bytes": 262_144,
    }
    values.update(updates)
    return ToolAuthorizationContext(**values)


def _budget(**updates: int) -> ToolBudget:
    values = {
        "max_calls": 4,
        "consumed_calls": 0,
        "max_rounds": 2,
        "consumed_rounds": 0,
        "max_rows": 200,
        "consumed_rows": 0,
        "max_bytes": 262_144,
        "consumed_bytes": 0,
    }
    values.update(updates)
    return ToolBudget(**values)


def _arguments(tool: ToolName) -> dict[str, Any]:
    domain = "workforce.policy"
    if tool is ToolName.REQUEST_EVIDENCE:
        return {
            "operation": "request_fact_slots",
            "domain": domain,
            "fact_slots": [
                {
                    "fact_slot": "policy-effective-date",
                    "description": "Current effective date",
                    "category": "policy",
                    "data_scope": domain,
                    "subject": "appointment policy",
                    "time_range": {"as_of": "case"},
                    "freshness": {"max_age_seconds": 3600},
                    "use": "determine applicability",
                }
            ],
            "estimated_rows": 1,
            "estimated_bytes": 1024,
        }
    if tool is ToolName.READ_APPROVED_MATERIALS:
        return {
            "operation": "read_summary",
            "domain": domain,
            "input_refs": [INPUT_REF],
            "fields": ["workforce.policy.policy_id"],
            "estimated_rows": 1,
            "estimated_bytes": 1024,
        }
    if tool is ToolName.INSPECT_APPROVED_DATA:
        return {
            "operation": "compare",
            "domain": domain,
            "data_ref": DATA_REF,
            "fields": ["workforce.policy.policy_id"],
            "operators": ["eq"],
            "dimensions": ["workforce.policy.effective_period"],
            "metrics": ["workforce.policy.exception_rate"],
            "estimated_rows": 20,
            "estimated_bytes": 4096,
        }
    return {
        "operation": "difference",
        "domain": domain,
        "data_refs": [DATA_REF],
        "algorithm_id": "difference",
        "algorithm_version": "1.0.0",
        "dimensions": ["workforce.policy.effective_period"],
        "metrics": ["workforce.policy.exception_rate"],
        "thresholds": [0.5],
        "estimated_rows": 20,
        "estimated_bytes": 4096,
    }


def _proposal(
    tool: ToolName = ToolName.READ_APPROVED_MATERIALS, **updates: Any
) -> ToolCallProposal:
    values: dict[str, Any] = {
        "tool_call_id": "tool-call-1",
        "tool_name": tool,
        "purpose": "answer the bounded policy question",
        "arguments": _arguments(tool),
        "required_for": ("policy finding",),
        "expected_result_schema": TOOL_DESCRIPTORS[tool].output_schema_id,
    }
    values.update(updates)
    return ToolCallProposal(**values)


def _denied(
    proposal: ToolCallProposal,
    code: str,
    *,
    context: ToolAuthorizationContext | None = None,
    budget: ToolBudget | None = None,
    history: tuple[str, ...] = (),
) -> ToolPolicyError:
    with pytest.raises(ToolPolicyError) as caught:
        approve_tool_call(context or _context(), proposal, budget or _budget(), history)
    error = caught.value
    assert error.code == code
    assert str(error) == code
    assert error.__cause__ is None
    assert error.__context__ is None
    return error


@pytest.mark.parametrize(
    "tool",
    (
        ToolName.REQUEST_EVIDENCE,
        ToolName.READ_APPROVED_MATERIALS,
        ToolName.INSPECT_APPROVED_DATA,
        ToolName.COMPUTE_ANALYSIS,
    ),
)
def test_approves_each_currently_executable_tool_with_canonical_identity(
    tool: ToolName,
) -> None:
    approved = approve_tool_call(_context(), _proposal(tool), _budget(), ())
    assert isinstance(approved, ApprovedToolCall)
    assert approved.approval_status is ToolCallStatus.APPROVED
    assert (
        approved.request_id,
        approved.case_id,
        approved.decree_id,
        approved.agent_id,
        approved.skill_id,
        approved.policy_id,
    ) == (
        "request-1",
        CASE_ID,
        DECREE_ID,
        AGENT_ID,
        SKILL.skill_id,
        POLICY.policy_id,
    )
    assert len(approved.argument_fingerprint) == 64
    assert approved.call_history_entry == f"call:{approved.tool_call_id}"
    assert approved.fingerprint_history_entry == (
        f"fingerprint:{approved.argument_fingerprint}"
    )


def test_accounting_only_tools_bind_to_explicit_accounting_policy() -> None:
    accounting_skill = build_default_downstream_skill_registry().get_by_agent(
        "hubu-accounting"
    )
    accounting_policy = bureau_tool_policy_for("hubu-accounting")

    assert accounting_skill.tool_policy == accounting_policy
    assert {
        ToolName.INSPECT_ACCOUNTING_CONTENT,
        ToolName.GENERATE_ACCOUNTING_WORKBOOK,
    } <= accounting_policy.allowed_tools
    assert accounting_policy.allowed_data_domains == frozenset({"finance.accounting"})


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("agent_id", "hubu-budget"),
        ("skill_id", "bureau.hubu.budget.v1"),
        ("skill_version", "1.0.1"),
        ("policy_id", "forged-policy"),
        ("policy_version", "1.0.1"),
        ("case_id", "case-forged"),
        ("decree_id", "decree-forged"),
    ],
)
def test_rejects_noncanonical_context_binding(field: str, value: str) -> None:
    _denied(_proposal(), "tool_identity_mismatch", context=_context(**{field: value}))


def test_unknown_tool_and_result_schema_are_distinct(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(policy_module, "TOOL_DESCRIPTORS", {})
    _denied(_proposal(), "tool_unknown")
    monkeypatch.undo()
    _denied(
        _proposal(expected_result_schema="forged_result.v1"),
        "tool_result_schema_invalid",
    )


def test_tool_not_allowed_uses_exact_authoritative_policy() -> None:
    appointment = build_default_downstream_skill_registry().get_by_agent("libu-appointments")
    appointment_policy = appointment.tool_policy
    assert appointment_policy is not None
    context = _context(
        agent_id=appointment.agent_id,
        skill_id=appointment.skill_id,
        policy_id=appointment_policy.policy_id,
    )
    _denied(_proposal(ToolName.REQUEST_EVIDENCE), "tool_not_allowed", context=context)


@pytest.mark.parametrize(
    "arguments",
    [
        {},
        {"operation": "read_summary", "domain": "workforce.policy", "input_refs": []},
        {**_arguments(ToolName.READ_APPROVED_MATERIALS), "extra": "x"},
        {**_arguments(ToolName.READ_APPROVED_MATERIALS), "fields": [1]},
        {**_arguments(ToolName.READ_APPROVED_MATERIALS), "nested": {"provider": "secret"}},
        {**_arguments(ToolName.READ_APPROVED_MATERIALS), "filters": [{"api_token": "secret"}]},
    ],
)
def test_rejects_malformed_extra_blank_and_nested_authority(arguments: dict[str, Any]) -> None:
    _denied(_proposal(arguments=arguments), "tool_arguments_invalid")


def test_rejects_non_iso_or_reversed_evidence_time_range() -> None:
    arguments = _arguments(ToolName.REQUEST_EVIDENCE)
    arguments["fact_slots"][0]["time_range"] = {
        "start": "2026-02-01T00:00:00Z", "end": "not-a-date"
    }
    _denied(_proposal(ToolName.REQUEST_EVIDENCE, arguments=arguments), "tool_arguments_invalid")


def test_evidence_slots_match_datagap_limit_and_one_shared_freshness() -> None:
    arguments = _arguments(ToolName.REQUEST_EVIDENCE)
    slot = arguments["fact_slots"][0]
    arguments["fact_slots"] = [{**slot, "fact_slot": f"fact-{i}"} for i in range(6)]
    _denied(_proposal(ToolName.REQUEST_EVIDENCE, arguments=arguments), "tool_arguments_invalid")
    arguments["fact_slots"] = [
        slot,
        {
            **slot, "fact_slot": "fact-2",
            "freshness": {"max_age_seconds": 60},
        },
    ]
    _denied(_proposal(ToolName.REQUEST_EVIDENCE, arguments=arguments), "tool_arguments_invalid")


@pytest.mark.parametrize(
    "periods",
    [
        ["1", "inf"],
        ["nan", "2"],
        ["2025-01-01T00:00:00", "2026-01-01T00:00:00Z"],
        ["2026-01-01T00:00:00+08:00", "2025-01-01T00:00:00Z"],
    ],
)
def test_policy_stably_rejects_invalid_period_labels(periods: list[str]) -> None:
    arguments = _arguments(ToolName.COMPUTE_ANALYSIS)
    arguments.update(
        {
            "operation": "year_over_year",
            "algorithm_id": "year_over_year",
            "periods": periods,
        }
    )
    _denied(_proposal(ToolName.COMPUTE_ANALYSIS, arguments=arguments), "tool_arguments_invalid")


@pytest.mark.parametrize(
    ("tool", "update"),
    [
        (ToolName.READ_APPROVED_MATERIALS, {"domain": "finance.budget"}),
        (ToolName.INSPECT_APPROVED_DATA, {"operation": "filter"}),
        (ToolName.INSPECT_APPROVED_DATA, {"fields": ["forbidden.field"]}),
        (ToolName.INSPECT_APPROVED_DATA, {"operators": ["contains"]}),
        (ToolName.INSPECT_APPROVED_DATA, {"dimensions": ["forbidden.dimension"]}),
        (ToolName.INSPECT_APPROVED_DATA, {"metrics": ["forbidden.metric"]}),
        (ToolName.COMPUTE_ANALYSIS, {"algorithm_id": "python-eval"}),
    ],
)
def test_rejects_out_of_scope_values(tool: ToolName, update: dict[str, Any]) -> None:
    arguments = {**_arguments(tool), **update}
    _denied(_proposal(tool, arguments=arguments), "tool_scope_invalid")


@pytest.mark.parametrize(
    ("tool", "update"),
    [
        (
            ToolName.READ_APPROVED_MATERIALS,
            {"input_refs": ["case:case-2:decree:decree-1:input:brief"]},
        ),
        (
            ToolName.READ_APPROVED_MATERIALS,
            {"input_refs": ["case:case-1:decree:decree-1:input:unknown"]},
        ),
        (ToolName.READ_APPROVED_MATERIALS, {"input_refs": [DATA_REF]}),
        (ToolName.INSPECT_APPROVED_DATA, {"data_ref": EVIDENCE_REF}),
        (ToolName.COMPUTE_ANALYSIS, {"data_refs": [INPUT_REF]}),
    ],
)
def test_rejects_cross_case_unknown_or_wrong_kind_refs(
    tool: ToolName, update: dict[str, Any]
) -> None:
    _denied(
        _proposal(tool, arguments={**_arguments(tool), **update}),
        "tool_reference_unapproved",
    )


def test_duplicate_fingerprint_normalizes_key_order_and_whitespace() -> None:
    first = approve_tool_call(_context(), _proposal(), _budget(), ())
    reordered = {
        "estimated_bytes": 1024,
        "fields": [" workforce.policy.policy_id "],
        "input_refs": [f" {INPUT_REF} "],
        "domain": " workforce.policy ",
        "operation": " read_summary ",
        "estimated_rows": 1,
    }
    _denied(
        _proposal(arguments=reordered),
        "tool_call_duplicate",
        history=(first.fingerprint_history_entry,),
    )


def test_duplicate_tool_call_id_is_distinct_namespaced_history_input() -> None:
    first = approve_tool_call(_context(), _proposal(), _budget(), ())
    different = _proposal(
        arguments={
            **_arguments(ToolName.READ_APPROVED_MATERIALS),
            "operation": "lookup_section",
        }
    )
    _denied(
        different,
        "tool_call_duplicate",
        history=(first.call_history_entry,),
    )


@pytest.mark.parametrize(
    "history_entry",
    [
        "tool-call-1",
        "call:",
        "fingerprint:not-a-sha256",
        "unknown:value",
    ],
)
def test_history_rejects_non_namespaced_or_malformed_entries(
    history_entry: str,
) -> None:
    _denied(
        _proposal(tool_call_id="tool-call-2"),
        "tool_call_duplicate",
        history=(history_entry,),
    )


@pytest.mark.parametrize(
    ("budget", "estimate_update"),
    [
        (_budget(consumed_calls=4), {}),
        (_budget(consumed_rounds=2), {}),
        (_budget(consumed_rows=200), {}),
        (_budget(consumed_bytes=262_144), {}),
        (_budget(consumed_rows=190), {"estimated_rows": 20}),
        (_budget(consumed_bytes=261_500), {}),
    ],
)
def test_rejects_consumed_or_request_estimate_over_remaining_budget(
    budget: ToolBudget, estimate_update: dict[str, int]
) -> None:
    _denied(
        _proposal(arguments={**_arguments(ToolName.READ_APPROVED_MATERIALS), **estimate_update}),
        "tool_budget_exceeded",
        budget=budget,
    )


@pytest.mark.parametrize(
    "context",
    [
        _context(system_max_calls=3),
        _context(system_max_rounds=1),
        _context(system_max_result_rows=199),
        _context(system_max_result_bytes=262_143),
    ],
)
def test_rejects_policy_or_system_cap_mismatch(context: ToolAuthorizationContext) -> None:
    _denied(_proposal(), "tool_budget_exceeded", context=context)


def test_rejects_blocked_business_state_last() -> None:
    _denied(
        _proposal(),
        "tool_business_state_blocked",
        context=_context(business_state="draft"),
    )


@pytest.mark.parametrize(
    ("code", "status"),
    [
        ("tool_identity_mismatch", ToolCallStatus.INVALID),
        ("tool_not_allowed", ToolCallStatus.DENIED),
        ("tool_arguments_invalid", ToolCallStatus.INVALID),
        ("tool_scope_invalid", ToolCallStatus.DENIED),
        ("tool_reference_unapproved", ToolCallStatus.DENIED),
        ("tool_call_duplicate", ToolCallStatus.INVALID),
        ("tool_budget_exceeded", ToolCallStatus.BUDGET_EXCEEDED),
        ("tool_business_state_blocked", ToolCallStatus.BLOCKED),
    ],
)
def test_audit_has_stable_status_reason_identity_and_no_secrets(
    code: str, status: ToolCallStatus
) -> None:
    secret = "never-log-this-secret"
    proposal = _proposal(arguments={"nested": {"credential": secret}})
    context = _context()
    budget = _budget()
    if code == "tool_identity_mismatch":
        context = _context(agent_id="forged")
    elif code == "tool_not_allowed":
        appointment = build_default_downstream_skill_registry().get_by_agent("libu-appointments")
        assert appointment.tool_policy is not None
        context = _context(
            agent_id=appointment.agent_id,
            skill_id=appointment.skill_id,
            policy_id=appointment.tool_policy.policy_id,
        )
        proposal = _proposal(ToolName.REQUEST_EVIDENCE)
    elif code == "tool_scope_invalid":
        proposal = _proposal(
            arguments={
                **_arguments(ToolName.READ_APPROVED_MATERIALS),
                "domain": "x",
            }
        )
    elif code == "tool_reference_unapproved":
        proposal = _proposal(
            arguments={
                **_arguments(ToolName.READ_APPROVED_MATERIALS),
                "input_refs": ["case:case-2:decree:decree-1:input:x"],
            }
        )
    elif code == "tool_call_duplicate":
        approved = approve_tool_call(context, _proposal(), budget, ())
        proposal = _proposal()
        error = _denied(proposal, code, history=(approved.fingerprint_history_entry,))
        assert error.audit.status is status
        return
    elif code == "tool_budget_exceeded":
        proposal = _proposal()
        budget = _budget(consumed_calls=4)
    elif code == "tool_business_state_blocked":
        proposal = _proposal()
        context = _context(business_state="blocked")
    error = _denied(proposal, code, context=context, budget=budget)
    audit = error.audit
    assert audit.status is status
    assert audit.reason_code == code
    assert audit.decree_id == context.decree_id
    assert audit.duration_ms == audit.result_rows == audit.result_bytes == 0
    assert (
        audit.max_calls,
        audit.consumed_calls,
        audit.max_rounds,
        audit.consumed_rounds,
        audit.max_rows,
        audit.consumed_rows,
        audit.max_bytes,
        audit.consumed_bytes,
    ) == (
        budget.max_calls,
        budget.consumed_calls,
        budget.max_rounds,
        budget.consumed_rounds,
        budget.max_rows,
        budget.consumed_rows,
        budget.max_bytes,
        budget.consumed_bytes,
    )
    assert (audit.request_id, audit.case_id) == (context.request_id, context.case_id)
    if code == "tool_identity_mismatch":
        assert (audit.agent_id, audit.skill_id, audit.policy_id) == (
            AGENT_ID,
            SKILL.skill_id,
            POLICY.policy_id,
        )
    else:
        assert (audit.agent_id, audit.skill_id) == (context.agent_id, context.skill_id)
    serialized = f"{error!r} {audit.model_dump_json()}"
    assert secret not in serialized
    assert "credential" not in audit.redacted_argument_summary


@pytest.mark.parametrize(
    "earlier_stage",
    [
        "identity",
        "descriptor",
        "policy",
        "arguments",
        "scope",
        "references",
        "duplicate",
        "budget",
    ],
)
def test_adjacent_validation_stages_lock_complete_earliest_error_order(
    earlier_stage: str,
) -> None:
    context = _context()
    proposal = _proposal()
    budget = _budget()
    history: tuple[str, ...] = ()
    expected = ""
    if earlier_stage == "identity":
        context = _context(agent_id="wrong")
        proposal = _proposal(expected_result_schema="wrong")
        expected = "tool_identity_mismatch"
    elif earlier_stage == "descriptor":
        appointment = build_default_downstream_skill_registry().get_by_agent(
            "libu-appointments"
        )
        assert appointment.tool_policy is not None
        context = _context(
            agent_id=appointment.agent_id,
            skill_id=appointment.skill_id,
            policy_id=appointment.tool_policy.policy_id,
        )
        proposal = _proposal(
            ToolName.REQUEST_EVIDENCE,
            expected_result_schema="wrong",
        )
        expected = "tool_result_schema_invalid"
    elif earlier_stage == "policy":
        appointment = build_default_downstream_skill_registry().get_by_agent(
            "libu-appointments"
        )
        assert appointment.tool_policy is not None
        context = _context(
            agent_id=appointment.agent_id,
            skill_id=appointment.skill_id,
            policy_id=appointment.tool_policy.policy_id,
        )
        proposal = _proposal(ToolName.REQUEST_EVIDENCE, arguments={"provider": "x"})
        expected = "tool_not_allowed"
    elif earlier_stage == "arguments":
        proposal = _proposal(arguments={"provider": "x", "domain": "wrong"})
        expected = "tool_arguments_invalid"
    elif earlier_stage == "scope":
        proposal = _proposal(
            arguments={
                **_arguments(ToolName.READ_APPROVED_MATERIALS),
                "domain": "wrong",
                "input_refs": ["unknown"],
            }
        )
        expected = "tool_scope_invalid"
    elif earlier_stage == "references":
        proposal = _proposal(
            arguments={
                **_arguments(ToolName.READ_APPROVED_MATERIALS),
                "input_refs": ["unknown"],
            }
        )
        approved = approve_tool_call(_context(), _proposal(), _budget(), ())
        history = (approved.fingerprint_history_entry,)
        expected = "tool_reference_unapproved"
    elif earlier_stage == "duplicate":
        approved = approve_tool_call(context, proposal, budget, ())
        history = (approved.fingerprint_history_entry,)
        budget = _budget(consumed_calls=4)
        expected = "tool_call_duplicate"
    else:
        context = _context(business_state="blocked")
        budget = _budget(consumed_calls=4)
        expected = "tool_budget_exceeded"
    _denied(
        proposal,
        expected,
        context=context,
        budget=budget,
        history=history,
    )


def test_policy_gate_api_and_source_have_no_handler_or_executor_dependency() -> None:
    assert tuple(inspect.signature(approve_tool_call).parameters) == (
        "context",
        "proposal",
        "budget",
        "history",
    )
    source = inspect.getsource(policy_module)
    for forbidden in (
        "ToolHandler",
        "ToolExecutor",
        "execute_tool",
        "handler=",
        "executor=",
    ):
        assert forbidden not in source


@pytest.mark.parametrize(
    ("proposal", "context", "budget", "history", "code"),
    [
        (_proposal(), _context(agent_id="wrong"), _budget(), (), "tool_identity_mismatch"),
        (
            _proposal(arguments={"provider": "x"}),
            _context(),
            _budget(),
            (),
            "tool_arguments_invalid",
        ),
        (_proposal(), _context(), _budget(consumed_calls=4), (), "tool_budget_exceeded"),
    ],
)
def test_rejections_complete_inside_pure_gate(
    proposal: ToolCallProposal,
    context: ToolAuthorizationContext,
    budget: ToolBudget,
    history: tuple[str, ...],
    code: str,
) -> None:
    _denied(proposal, code, context=context, budget=budget, history=history)
