from __future__ import annotations

import hashlib
import json
from collections.abc import Callable, Mapping, Sequence
from copy import deepcopy
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.agents.runtime_skills.models import RuntimeSkillDefinition
from app.agents.runtime_skills.tool_executor import (
    ToolExecutionError,
    _issue_loop_recovery_state,
    execute_approved_tool,
    record_tool_audit,
)
from app.agents.runtime_skills.tool_models import (
    BureauToolPolicy,
    RetryStrategy,
    ToolAuthorizationContext,
    ToolBudget,
    ToolCallProposal,
    ToolFailureCode,
    ToolHandlerContext,
    ToolHealth,
    ToolName,
    ToolResultEnvelope,
)
from app.agents.runtime_skills.tool_policy import ToolPolicyError, approve_tool_call
from app.agents.runtime_skills.tool_registry import tool_descriptor_for

ModelMessage = Mapping[str, object]
ModelAdapter = Callable[[tuple[ModelMessage, ...]], object]

_RECOVERABLE_FAILURES = frozenset(
    {
        ToolFailureCode.FORMAT_UNRECOGNIZED,
        ToolFailureCode.TOOL_UNAVAILABLE,
        ToolFailureCode.SOURCE_NOT_FOUND,
    }
)


def _next_terminal_failure(
    current: ToolFailureCode | None, failure: ToolFailureCode | None
) -> ToolFailureCode | None:
    return failure if failure in _RECOVERABLE_FAILURES else current


def next_strategy(
    history: Sequence[RetryStrategy],
    result: ToolFailureCode,
    catalog: Sequence[object],
) -> RetryStrategy | None:
    """Choose the first untried bounded recovery strategy."""
    if result not in _RECOVERABLE_FAILURES or not catalog:
        return None
    tried = frozenset(history)
    return next((item for item in RetryStrategy if item not in tried), None)


class BureauToolLoopResult(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    final_synthesis: dict[str, Any]
    accepted_results: tuple[ToolResultEnvelope, ...]
    audit_refs: tuple[str, ...]
    consumed_budget: ToolBudget
    degradation_reasons: tuple[str, ...]
    terminal_failure_code: ToolFailureCode | None = None


def _parse_envelope(raw: object) -> tuple[str, object]:
    if isinstance(raw, str):
        raw = json.loads(raw)
    if not isinstance(raw, Mapping) or set(raw) not in (
        {"status", "calls"},
        {"status", "report"},
    ):
        raise ValueError("malformed_model_envelope")
    status = raw.get("status")
    if status == "FINAL" and isinstance(raw.get("report"), Mapping):
        report = dict(raw["report"])  # type: ignore[arg-type]
        if not report:
            raise ValueError("malformed_model_envelope")
        return status, report
    if status == "TOOL_CALLS" and isinstance(raw.get("calls"), list):
        calls = raw["calls"]
        if not calls:
            raise ValueError("malformed_model_envelope")
        return status, calls
    raise ValueError("malformed_model_envelope")


def _budget(
    context: ToolAuthorizationContext,
    policy: BureauToolPolicy,
    *,
    calls: int,
    rounds: int,
    rows: int,
    size: int,
) -> ToolBudget:
    return ToolBudget(
        max_calls=min(context.system_max_calls, policy.max_tool_calls),
        consumed_calls=calls,
        max_rounds=min(context.system_max_rounds, policy.max_tool_rounds),
        consumed_rounds=rounds,
        max_rows=min(context.system_max_result_rows, policy.max_result_rows),
        consumed_rows=rows,
        max_bytes=min(context.system_max_result_bytes, policy.max_result_bytes),
        consumed_bytes=size,
    )


def _degraded(reasons: Sequence[str]) -> dict[str, Any]:
    return {"status": "DEGRADED", "reason_codes": list(dict.fromkeys(reasons))}


def run_bureau_tool_loop(
    *,
    skill: RuntimeSkillDefinition,
    policy: BureauToolPolicy,
    tool_descriptors: Sequence[Mapping[str, object]],
    canonical_context: Mapping[str, object],
    model_adapter: ModelAdapter,
    authorization_context: ToolAuthorizationContext,
    handlers: object,
    resolved_approved_inputs: Mapping[str, Any],
    tool_health: Mapping[ToolName, ToolHealth] | None = None,
) -> BureauToolLoopResult:
    """Run a non-recursive, fail-closed bureau proposal loop."""

    if skill.tool_policy != policy or policy.agent_id != authorization_context.agent_id:
        raise ValueError("tool_loop_identity_mismatch")
    expected_descriptors = []
    for tool_name in sorted(policy.allowed_tools, key=lambda item: item.value):
        descriptor = tool_descriptor_for(tool_name)
        expected_descriptors.append(
            {
                "tool_name": tool_name.value,
                "input_schema": descriptor.input_schema_id,
                "result_schema": descriptor.output_schema_id,
                "operations": list(policy.tool_operations[tool_name]),
                "argument_constraints": deepcopy(
                    policy.tool_argument_constraints[tool_name]
                ),
                "max_result_rows": min(policy.max_result_rows, descriptor.max_result_rows),
                "max_result_bytes": min(policy.max_result_bytes, descriptor.max_result_bytes),
            }
        )
    if [dict(item) for item in tool_descriptors] != expected_descriptors:
        raise ValueError("tool_descriptor_projection_invalid")
    catalog_fingerprint = hashlib.sha256(
        json.dumps(
            expected_descriptors, ensure_ascii=False, sort_keys=True, separators=(",", ":")
        ).encode("utf-8")
    ).hexdigest()

    messages: list[ModelMessage] = [
        {
            "role": "system",
            "content": {
                "instruction": "Return exactly one FINAL or TOOL_CALLS envelope.",
                "skill_id": skill.skill_id,
                "tool_descriptors": deepcopy(
                    [dict(item) for item in tool_descriptors]
                ),
            },
        },
        {"role": "context", "content": deepcopy(dict(canonical_context))},
    ]
    accepted: list[ToolResultEnvelope] = []
    audit_refs: list[str] = []
    reasons: list[str] = []
    history: list[str] = []
    calls = rounds = rows = size = 0
    correction_used = False
    final: dict[str, Any] | None = None
    recovery_history: list[RetryStrategy] = []
    pending_strategy: RetryStrategy | None = None
    retry_source: str | None = None
    failed_tool: ToolName | None = None
    failed_fingerprint: str | None = None
    terminal_failure: ToolFailureCode | None = None

    while rounds < min(authorization_context.system_max_rounds, policy.max_tool_rounds):
        rounds += 1
        current = _budget(
            authorization_context, policy, calls=calls, rounds=rounds, rows=rows, size=size
        )
        try:
            status, payload = _parse_envelope(
                model_adapter(tuple(deepcopy(messages)))
            )
        except (TypeError, ValueError, json.JSONDecodeError):
            reasons.append("malformed_model_envelope")
            if correction_used or rounds >= current.max_rounds:
                reasons.append("correction_exhausted")
                break
            correction_used = True
            messages.append(
                {"role": "correction", "content": {"code": "malformed_model_envelope"}}
            )
            continue

        if status == "FINAL":
            final = payload  # type: ignore[assignment]
            break

        invalid_proposal = False
        force_degraded_finalization = False
        round_outcomes: list[dict[str, object]] = []
        for raw_call in payload:  # type: ignore[union-attr]
            max_calls = current.max_calls
            if calls >= max_calls:
                reasons.append("tool_call_limit")
                break
            calls += 1
            gate_budget = _budget(
                authorization_context,
                policy,
                calls=calls - 1,
                rounds=rounds - 1,
                rows=rows,
                size=size,
            )
            current = _budget(
                authorization_context,
                policy,
                calls=calls,
                rounds=rounds,
                rows=rows,
                size=size,
            )
            execution_budget = _budget(
                authorization_context,
                policy,
                calls=calls - 1,
                rounds=rounds,
                rows=rows,
                size=size,
            )
            try:
                proposal = ToolCallProposal.model_validate(raw_call)
            except (TypeError, ValueError):
                reasons.append("tool_proposal_invalid")
                invalid_proposal = True
                round_outcomes.append(
                    {"status": "REJECTED", "code": "tool_proposal_invalid"}
                )
                continue
            try:
                approved = approve_tool_call(
                    authorization_context, proposal, gate_budget, tuple(history)
                )
            except ToolPolicyError as exc:
                reasons.append(exc.code)
                normalized_audit = exc.audit.model_copy(
                    update={
                        "consumed_calls": calls,
                        "consumed_rounds": rounds,
                        "consumed_rows": rows,
                        "consumed_bytes": size,
                    }
                )
                record_tool_audit(normalized_audit)
                audit_refs.append(exc.audit.audit_ref)
                history.extend((f"call:{proposal.tool_call_id}",))
                round_outcomes.append(
                    {
                        "tool_call_id": exc.audit.audit_ref,
                        "status": "REJECTED",
                        "code": exc.code,
                    }
                )
                if exc.code == "tool_budget_exceeded":
                    reasons.append("tool_budget_exhausted")
                    force_degraded_finalization = True
                    break
                continue
            history.extend((approved.call_history_entry, approved.fingerprint_history_entry))
            if retry_source is not None:
                if failed_tool is approved.tool_name:
                    pending_strategy = RetryStrategy.CORRECT_ARGUMENTS
                else:
                    pending_strategy = RetryStrategy.ALTERNATE_TOOL
                prefix = tuple(RetryStrategy)[: tuple(RetryStrategy).index(pending_strategy)]
                if (
                    next_strategy(
                        prefix,
                        ToolFailureCode.FORMAT_UNRECOGNIZED,
                        expected_descriptors,
                    )
                    is not pending_strategy
                ):
                    raise ValueError("tool_recovery_strategy_invalid")
                if (
                    pending_strategy is RetryStrategy.CORRECT_ARGUMENTS
                    and failed_fingerprint == approved.argument_fingerprint
                ):
                    reasons.append("tool_recovery_action_mismatch")
                    continue
            handler_context = ToolHandlerContext(
                approved_call=approved,
                capability_id=handlers.capability_id,
                resolved_approved_inputs=dict(resolved_approved_inputs),
                restricted_adapters={},
                budget=execution_budget,
                accepted_results=tuple(accepted),
            )
            try:
                result = execute_approved_tool(
                    approved, handler_context, handlers, health=tool_health,
                    authorization_context=authorization_context,
                    recovery_state=(
                        _issue_loop_recovery_state(
                            retry_source, pending_strategy, catalog_fingerprint,
                            failed_tool, failed_fingerprint,
                            approved.tool_name, approved.argument_fingerprint,
                        )
                        if (
                            retry_source is not None
                            and pending_strategy is not None
                            and failed_tool is not None
                            and failed_fingerprint is not None
                        )
                        else None
                    ),
                )
            except ToolExecutionError as exc:
                reasons.append(exc.code)
                audit_refs.append(exc.audit.audit_ref)
                round_outcomes.append(
                    {
                        "tool_call_id": exc.audit.audit_ref,
                        "status": "FAILED",
                        "code": exc.code,
                    }
                )
                try:
                    failure = ToolFailureCode(exc.code)
                except ValueError:
                    failure = None
                terminal_failure = _next_terminal_failure(terminal_failure, failure)
                strategy = (
                    next_strategy(recovery_history, failure, expected_descriptors)
                    if failure is not None
                    else None
                )
                if strategy is not None:
                    retry_source = exc.audit.audit_ref
                    failed_tool = approved.tool_name
                    failed_fingerprint = approved.argument_fingerprint
                continue
            pending_strategy = None
            retry_source = None
            failed_tool = None
            failed_fingerprint = None
            terminal_failure = None
            accepted.append(result)
            audit_refs.append(result.audit_ref)
            returned = result.returned_records
            rows += returned if returned is not None else (0 if result.data is None else 1)
            size += len(
                json.dumps(
                    result.data,
                    ensure_ascii=False,
                    sort_keys=True,
                    separators=(",", ":"),
                ).encode("utf-8")
            )
            round_outcomes.append(
                {
                    "tool_call_id": result.tool_call_id,
                    "status": result.status.value,
                    "result_schema": result.result_schema,
                    "data": result.data,
                    "approved_input_refs": list(result.approved_input_refs),
                    "evidence_refs": list(result.evidence_refs),
                    "approved_data_refs": list(result.approved_data_refs),
                    "data_quality": result.data_quality.value,
                    "limitations": list(result.limitations),
                }
            )

        if force_degraded_finalization or calls >= current.max_calls:
            reasons.append("tool_budget_exhausted")
            break
        messages.append({"role": "tool_result", "content": round_outcomes})
        if invalid_proposal:
            if correction_used:
                reasons.append("correction_exhausted")
                break
            correction_used = True
            messages.append(
                {"role": "correction", "content": {"code": "tool_proposal_invalid"}}
            )

    if final is None:
        if rounds >= min(authorization_context.system_max_rounds, policy.max_tool_rounds):
            reasons.append("model_round_limit")
        final = _degraded(reasons)
    consumed = _budget(
        authorization_context, policy, calls=calls, rounds=rounds, rows=rows, size=size
    )
    return BureauToolLoopResult(
        final_synthesis=final,
        accepted_results=tuple(accepted),
        audit_refs=tuple(dict.fromkeys(audit_refs)),
        consumed_budget=consumed,
        degradation_reasons=tuple(dict.fromkeys(reasons)),
        terminal_failure_code=terminal_failure,
    )
