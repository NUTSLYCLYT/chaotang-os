from __future__ import annotations

import json
from collections.abc import Mapping

import pytest

import app.agents.runtime_skills.tool_executor as tool_executor_module
from app.agents.runtime_skills.registry import ALL_DOWNSTREAM_SKILLS
from app.agents.runtime_skills.tool_executor import (
    clear_tool_audits,
    tool_audit_snapshot,
)
from app.agents.runtime_skills.tool_handlers import build_bureau_tool_handlers
from app.agents.runtime_skills.tool_issuance import _issue_tool_authorization_context
from app.agents.runtime_skills.tool_loop import _next_terminal_failure, next_strategy
from app.agents.runtime_skills.tool_models import (
    RetryStrategy,
    ToolFailureCode,
    ToolHandlerContext,
    ToolName,
)
from app.agents.runtime_skills.tool_registry import (
    bureau_tool_policy_for,
    tool_descriptor_for,
)

CASE = "case-1"
DECREE = "decree-1"
INPUT = f"input:case:{CASE}:decree:{DECREE}:brief"
DATA = f"approved-data:case:{CASE}:decree:{DECREE}:rows"


class ScriptedModel:
    def __init__(self, *responses: object) -> None:
        self.responses = list(responses)
        self.messages: list[tuple[Mapping[str, object], ...]] = []

    def __call__(self, messages: tuple[Mapping[str, object], ...]) -> object:
        self.messages.append(messages)
        return self.responses.pop(0)


def _dependencies(*, max_calls: int = 6) -> dict[str, object]:
    skill = next(s for s in ALL_DOWNSTREAM_SKILLS if s.agent_id == "libu-appointments")
    policy = bureau_tool_policy_for(skill.agent_id)
    context = _issue_tool_authorization_context(
        request_id="request-1",
        case_id=CASE,
        decree_id=DECREE,
        agent_id=skill.agent_id,
        skill_id=skill.skill_id,
        skill_version=skill.version,
        policy=policy,
        approved_input_refs=(INPUT,),
        approved_evidence_refs=(),
        approved_data_refs=(DATA,),
        business_state="ready",
        system_max_calls=max_calls,
        system_max_rounds=2,
        system_max_result_rows=200,
        system_max_result_bytes=262_144,
        report_session_present=False,
    )
    handler_calls: list[str] = []

    def material_reader(handler_context: ToolHandlerContext) -> Mapping[str, object]:
        handler_calls.append(handler_context.approved_call.tool_call_id)
        requested = handler_context.approved_call.normalized_arguments["fields"]
        projection = {str(field).rsplit(".", 1)[-1]: "approved" for field in requested}
        return {
            "result_schema": "approved_materials_result.v1",
            "data": {
                "materials": [
                    {"ref": INPUT, "summary": "brief", "projection": projection}
                ]
            },
            "input_refs": [INPUT],
            "evidence_refs": [],
            "approved_data_refs": [],
            "data_quality": "SUFFICIENT",
            "limitations": [],
            "as_of": "2026-08-03T00:00:00Z",
        }

    return {
        "skill": skill,
        "policy": policy,
        "authorization_context": context,
        "canonical_context": {"subject": "appointment review", "input_refs": [INPUT]},
        "handlers": build_bureau_tool_handlers(
            material_reader=material_reader, data_reader=None, evidence_requester=None
        ),
        "resolved_approved_inputs": {INPUT: {"title": "brief"}, DATA: [{"value": 1}]},
        "handler_calls": handler_calls,
    }


def _call(call_id: str = "tc-1", *, fields: list[str] | None = None) -> dict[str, object]:
    return {
        "tool_call_id": call_id,
        "tool_name": "read_approved_materials",
        "purpose": "read the approved brief",
        "arguments": {
            "operation": "read_summary",
            "domain": "workforce.appointments",
            "input_refs": [INPUT],
            "fields": fields or ["workforce.appointments.candidate_id"],
            "estimated_rows": 1,
            "estimated_bytes": 128,
        },
        "required_for": ["appointment finding"],
        "expected_result_schema": tool_descriptor_for(
            ToolName.READ_APPROVED_MATERIALS
        ).output_schema_id,
    }


def _final(summary: str = "done") -> dict[str, object]:
    return {"status": "FINAL", "report": {"summary": summary}}


def _run(model: ScriptedModel, **changes: object):
    from app.agents.bureaus.prompts import policy_projected_tool_descriptors
    from app.agents.runtime_skills.tool_loop import run_bureau_tool_loop

    deps = _dependencies(max_calls=int(changes.pop("max_calls", 6)))
    deps.update(changes)
    calls = deps.pop("handler_calls")
    policy = deps["policy"]
    result = run_bureau_tool_loop(
        model_adapter=model,
        tool_descriptors=policy_projected_tool_descriptors(policy),
        **deps,
    )
    return result, calls


def test_zero_tool_final_response_uses_one_model_round_and_no_handler() -> None:
    model = ScriptedModel(_final())
    result, calls = _run(model)
    assert result.final_synthesis == {"summary": "done"}
    assert result.accepted_results == ()
    assert result.consumed_budget.consumed_rounds == 1
    assert result.consumed_budget.consumed_calls == 0
    assert len(model.messages) == 1
    assert calls == []


def test_one_and_multiple_proposals_execute_sequentially_then_finalize() -> None:
    second = _call("tc-2")
    second["arguments"] = {**second["arguments"], "estimated_bytes": 129}
    model = ScriptedModel(
        {"status": "TOOL_CALLS", "calls": [_call("tc-1"), second]},
        _final("with tools"),
    )
    result, calls = _run(model)
    result_ids = [item.tool_call_id for item in result.accepted_results]
    assert len(set(result_ids)) == 2
    assert all(item.startswith("tool-audit:") for item in result_ids)
    assert calls == ["tc-1", "tc-2"]
    assert len(model.messages) == 2
    assert result.consumed_budget.consumed_calls == 2
    assert result.consumed_budget.consumed_rounds == 2


def test_authority_drift_becomes_audited_degraded_outcome(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    clear_tool_audits()
    current = bureau_tool_policy_for("libu-appointments")
    replacement = current.model_copy(update={"max_result_bytes": 1})
    monkeypatch.setattr(
        tool_executor_module, "bureau_tool_policy_for", lambda _: replacement
    )
    model = ScriptedModel(
        {"status": "TOOL_CALLS", "calls": [_call("Bearer-private-loop-id")]},
        {"status": "BROKEN"},
    )
    result, calls = _run(model)
    assert calls == []
    assert result.final_synthesis["status"] == "DEGRADED"
    assert "tool_policy_identity_mismatch" in result.degradation_reasons
    assert len(result.audit_refs) == 1
    audits = tool_audit_snapshot()
    assert len(audits) == 1
    assert audits[0].audit_ref == result.audit_refs[0]
    assert audits[0].reason_code == "tool_policy_identity_mismatch"
    assert "Bearer-private-loop-id" not in audits[0].model_dump_json()


def test_invalid_proposal_can_be_corrected_once_without_third_round() -> None:
    invalid = _call("bad")
    invalid["unexpected"] = "authority"
    model = ScriptedModel(
        {"status": "TOOL_CALLS", "calls": [invalid]},
        {"status": "TOOL_CALLS", "calls": [_call("fixed")]},
        _final("must not be consumed"),
    )
    result, calls = _run(model)
    assert len(model.messages) == 2
    assert calls == ["fixed"]
    assert result.final_synthesis["status"] == "DEGRADED"
    assert "model_round_limit" in result.degradation_reasons


def test_maximum_four_calls_counts_denied_and_rejects_fifth_without_handler() -> None:
    clear_tool_audits()
    calls = [_call(f"tc-{i}") for i in range(5)]
    calls[0]["arguments"] = {**calls[0]["arguments"], "domain": "forbidden.domain"}
    model = ScriptedModel({"status": "TOOL_CALLS", "calls": calls}, _final())
    result, handler_calls = _run(model)
    assert len(model.messages) == 1
    assert handler_calls == ["tc-1"]
    assert result.consumed_budget.consumed_calls == 4
    assert "tool_call_limit" in result.degradation_reasons
    audits = tool_audit_snapshot()
    assert [audit.consumed_calls for audit in audits] == [1, 2, 3, 4]
    assert audits[-1].consumed_calls == result.consumed_budget.consumed_calls


def test_duplicate_is_rejected_and_never_executes_twice() -> None:
    model = ScriptedModel(
        {"status": "TOOL_CALLS", "calls": [_call("same"), _call("same")]},
        _final(),
    )
    result, calls = _run(model)
    assert calls == ["same"]
    assert len(result.accepted_results) == 1
    assert result.consumed_budget.consumed_calls == 2
    assert "tool_call_duplicate" in result.degradation_reasons
    second_messages = json.dumps(model.messages[1], ensure_ascii=False)
    assert '"code": "tool_call_duplicate"' in second_messages
    assert "argument_fingerprint" not in second_messages


def test_tool_result_is_inert_and_cannot_supply_executable_descriptors() -> None:
    model = ScriptedModel({"status": "TOOL_CALLS", "calls": [_call()]}, _final())
    result, calls = _run(model)
    assert calls == ["tc-1"]
    second_messages = json.dumps(model.messages[1], ensure_ascii=False)
    assert '"role": "tool_result"' in second_messages
    assert "handler_id" not in second_messages
    assert result.final_synthesis == {"summary": "done"}


def test_budget_exhaustion_forces_degraded_finalization() -> None:
    oversized = _call("one")
    oversized["arguments"] = {**oversized["arguments"], "estimated_rows": 201}
    model = ScriptedModel({"status": "TOOL_CALLS", "calls": [oversized]}, _final())
    result, calls = _run(model)
    assert calls == []
    assert result.final_synthesis["status"] == "DEGRADED"
    assert result.consumed_budget.consumed_calls == 1
    assert len(model.messages) == 1
    assert "tool_budget_exhausted" in result.degradation_reasons


def test_malformed_envelope_gets_exactly_one_correction_and_no_third_round() -> None:
    model = ScriptedModel("not-json", {"status": "BROKEN"}, _final("third"))
    result, calls = _run(model)
    assert len(model.messages) == 2
    assert calls == []
    assert result.final_synthesis["status"] == "DEGRADED"
    assert "malformed_model_envelope" in result.degradation_reasons
    assert "correction_exhausted" in result.degradation_reasons


def test_descriptors_are_policy_projection_without_callable_identity() -> None:
    from app.agents.bureaus.prompts import policy_projected_tool_descriptors

    policy = bureau_tool_policy_for("libu-appointments")
    descriptors = policy_projected_tool_descriptors(policy)
    assert {item["tool_name"] for item in descriptors} == {
        item.value for item in policy.allowed_tools
    }
    assert all("handler_id" not in item and "descriptor_id" not in item for item in descriptors)
    assert all(
        item["operations"]
        == list(policy.tool_operations[ToolName(item["tool_name"])])
        for item in descriptors
    )


def test_loop_rejects_descriptor_projection_with_extra_model_visible_field() -> None:
    from app.agents.bureaus.prompts import policy_projected_tool_descriptors
    from app.agents.runtime_skills.tool_loop import run_bureau_tool_loop

    deps = _dependencies()
    deps.pop("handler_calls")
    descriptors = list(policy_projected_tool_descriptors(deps["policy"]))
    descriptors[0] = {**descriptors[0], "debug_metadata": "must-not-leak"}
    model = ScriptedModel(_final())
    try:
        run_bureau_tool_loop(
            model_adapter=model,
            tool_descriptors=descriptors,
            **deps,
        )
    except ValueError as exc:
        assert str(exc) == "tool_descriptor_projection_invalid"
    else:
        raise AssertionError("unsafe descriptor projection was accepted")
    assert len(model.messages) == 0


def test_model_cannot_mutate_nested_descriptor_aliases_or_expand_gate_policy() -> None:
    policy = bureau_tool_policy_for("libu-appointments")
    before = policy.model_dump(mode="python")
    handler_calls: list[str] = []

    class MutatingModel:
        def __init__(self) -> None:
            self.calls = 0

        def __call__(self, messages: tuple[Mapping[str, object], ...]) -> object:
            self.calls += 1
            system = messages[0]["content"]
            assert isinstance(system, dict)
            descriptors = system["tool_descriptors"]
            assert isinstance(descriptors, list)
            descriptor = next(
                item for item in descriptors if item["tool_name"] == "read_approved_materials"
            )
            descriptor["operations"].append("forbidden_operation")
            constraints = descriptor["argument_constraints"]
            constraints["allowed_fields"] = (
                *constraints["allowed_fields"],
                "workforce.appointments.forbidden_field",
            )
            constraints["nested_probe"] = {
                "lists": [["mutated"]],
                "tuples": (("mutated",),),
            }
            proposal = _call("alias-attack", fields=["workforce.appointments.forbidden_field"])
            return {"status": "TOOL_CALLS", "calls": [proposal]}

    model = MutatingModel()
    result, calls = _run(model)  # type: ignore[arg-type]
    handler_calls.extend(calls)
    assert model.calls == 2
    assert handler_calls == []
    assert "tool_scope_invalid" in result.degradation_reasons
    assert policy.model_dump(mode="python") == before


def test_success_audits_count_each_call_once_and_end_at_loop_budget() -> None:
    clear_tool_audits()
    second = _call("audit-2")
    second["arguments"] = {**second["arguments"], "estimated_bytes": 129}
    model = ScriptedModel(
        {"status": "TOOL_CALLS", "calls": [_call("audit-1"), second]},
        _final(),
    )
    result, calls = _run(model)
    audits = tool_audit_snapshot()
    assert calls == ["audit-1", "audit-2"]
    assert [audit.consumed_calls for audit in audits] == [1, 2]
    assert audits[-1].consumed_calls == result.consumed_budget.consumed_calls == 2


def test_denied_and_failed_audits_match_single_consumed_loop_call() -> None:
    clear_tool_audits()
    denied = _call("denied")
    denied["arguments"] = {**denied["arguments"], "domain": "forbidden.domain"}
    denied_result, denied_calls = _run(
        ScriptedModel({"status": "TOOL_CALLS", "calls": [denied]}, _final())
    )
    denied_audits = tool_audit_snapshot()
    assert denied_calls == []
    assert [audit.consumed_calls for audit in denied_audits] == [1]
    assert denied_audits[0].consumed_calls == denied_result.consumed_budget.consumed_calls

    clear_tool_audits()
    handler_calls: list[str] = []

    def failing_reader(context: ToolHandlerContext) -> Mapping[str, object]:
        handler_calls.append(context.approved_call.tool_call_id)
        raise RuntimeError("private failure")

    failed_handlers = build_bureau_tool_handlers(
        material_reader=failing_reader, data_reader=None, evidence_requester=None
    )
    failed_result, _ = _run(
        ScriptedModel({"status": "TOOL_CALLS", "calls": [_call("failed")]}, _final()),
        handlers=failed_handlers,
    )
    failed_audits = tool_audit_snapshot()
    assert handler_calls == ["failed"]
    assert [audit.consumed_calls for audit in failed_audits] == [1]
    assert failed_audits[0].consumed_calls == failed_result.consumed_budget.consumed_calls


def test_recovery_state_machine_uses_each_strategy_once() -> None:
    catalog = ("inspect_accounting_content", "inspect_approved_data")
    history: tuple[RetryStrategy, ...] = ()
    for expected in RetryStrategy:
        assert next_strategy(history, ToolFailureCode.FORMAT_UNRECOGNIZED, catalog) is expected
        history = (*history, expected)
    assert next_strategy(history, ToolFailureCode.FORMAT_UNRECOGNIZED, catalog) is None


def test_nonrecoverable_failure_has_no_strategy() -> None:
    assert next_strategy((), ToolFailureCode.POLICY_DENIED, ("tool",)) is None


def test_failed_loop_exposes_its_terminal_required_tool_failure() -> None:
    def missing(_: ToolHandlerContext) -> Mapping[str, object]:
        raise FileNotFoundError

    result, _ = _run(
        ScriptedModel({"status": "TOOL_CALLS", "calls": [_call("missing")]}, _final()),
        handlers=build_bureau_tool_handlers(
            material_reader=missing, data_reader=None, evidence_requester=None
        ),
    )

    assert result.terminal_failure_code is ToolFailureCode.SOURCE_NOT_FOUND
    assert result.final_synthesis == {"summary": "done"}


@pytest.mark.parametrize(
    ("sequence", "expected"),
    [
        (
            (ToolFailureCode.FORMAT_UNRECOGNIZED, ToolFailureCode.TOOL_UNAVAILABLE),
            ToolFailureCode.TOOL_UNAVAILABLE,
        ),
        (
            (ToolFailureCode.FORMAT_UNRECOGNIZED, ToolFailureCode.SOURCE_NOT_FOUND),
            ToolFailureCode.SOURCE_NOT_FOUND,
        ),
    ],
)
def test_mixed_recovery_sequence_uses_actual_terminal_failure(sequence, expected) -> None:
    terminal = None
    for failure in sequence:
        terminal = _next_terminal_failure(terminal, failure)
    assert terminal is expected


def test_real_failure_switches_capability_member_without_repeating_fingerprint() -> None:
    clear_tool_audits()
    attempts: list[str] = []

    def bad_format(_: ToolHandlerContext) -> Mapping[str, object]:
        attempts.append("read")
        raise ValueError("format_unrecognized")

    def inspect(ctx: ToolHandlerContext) -> Mapping[str, object]:
        attempts.append("inspect")
        return {
            "result_schema": "approved_data_result.v1",
            "data": {
                "operation": "compare", "columns": ["candidate_id"],
                "rows": [{"candidate_id": "1"}],
            },
            "input_refs": [], "evidence_refs": [],
            "approved_data_refs": [DATA], "data_quality": "SUFFICIENT",
            "limitations": [], "as_of": "2026-08-11T00:00:00Z",
        }

    handlers = build_bureau_tool_handlers(
        material_reader=bad_format, data_reader=inspect, evidence_requester=None
    )
    evidence_call = {
        "tool_call_id": "inspect-2", "tool_name": "inspect_approved_data",
        "purpose": "use alternate capability", "arguments": {
            "operation": "compare", "domain": "workforce.appointments", "data_ref": DATA,
            "fields": ["workforce.appointments.candidate_id"], "operators": ["eq"],
            "dimensions": ["workforce.appointments.grade"],
            "metrics": ["workforce.appointments.appointment_fit"],
            "estimated_rows": 1, "estimated_bytes": 128,
        }, "required_for": ["appointment finding"],
        "expected_result_schema": "approved_data_result.v1",
    }
    model = ScriptedModel(
        {"status": "TOOL_CALLS", "calls": [_call("format-1")]},
        {"status": "TOOL_CALLS", "calls": [evidence_call]},
    )
    result, _ = _run(model, handlers=handlers)
    audits = tool_audit_snapshot()
    assert attempts == ["read", "inspect"]
    assert [item.tool_name for item in audits] == [
        ToolName.READ_APPROVED_MATERIALS, ToolName.INSPECT_APPROVED_DATA,
    ]
    assert len({item.argument_hash for item in audits}) == 2
    assert audits[1].retry_source == audits[0].audit_ref
    assert audits[1].retry_strategy is RetryStrategy.ALTERNATE_TOOL
    assert result.accepted_results
