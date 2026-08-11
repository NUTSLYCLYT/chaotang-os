from __future__ import annotations

import hashlib
import json
import math
import re
from collections.abc import Iterable, Mapping
from datetime import UTC, datetime
from typing import Any, NoReturn

from app.agents.runtime_skills.registry import ALL_DOWNSTREAM_SKILLS
from app.agents.runtime_skills.tool_audit_ref import _mint_tool_audit_ref
from app.agents.runtime_skills.tool_issuance import (
    _bureau_tool_policy_fingerprint,
    _issue_approved_tool_call,
    _tool_authorization_context_is_issued,
    _tool_descriptor_fingerprint,
)
from app.agents.runtime_skills.tool_models import (
    ApprovedToolCall,
    BureauToolPolicy,
    ToolAuditRecord,
    ToolAuthorizationContext,
    ToolBudget,
    ToolCallProposal,
    ToolCallStatus,
    ToolName,
)
from app.agents.runtime_skills.tool_registry import (
    SYSTEM_MAX_RESULT_BYTES,
    SYSTEM_MAX_RESULT_ROWS,
    SYSTEM_MAX_TOOL_CALLS,
    SYSTEM_MAX_TOOL_ROUNDS,
    TOOL_DESCRIPTORS,
    bureau_tool_policy_for,
)

_FORBIDDEN_AUTHORITY_TERMS = (
    "agent",
    "skill",
    "case",
    "decree",
    "policy",
    "credential",
    "token",
    "provider",
    "url",
    "sql",
    "code",
    "shell",
    "path",
    "timeout",
    "audit",
    "approval",
    "timestamp",
)
_KEY_PARTS = re.compile(r"[^a-z0-9]+")
_CALL_HISTORY_ENTRY = re.compile(r"^call:\S+$")
_FINGERPRINT_HISTORY_ENTRY = re.compile(r"^fingerprint:[0-9a-f]{64}$")
_REF_KINDS = {"input", "evidence", "data"}
_INSPECT_OPERATORS = frozenset({"eq", "ne", "gt", "gte", "lt", "lte", "in"})
_ENABLED_BUSINESS_STATES = frozenset({"ready"})
_ESTIMATE_KEYS = frozenset({"estimated_rows", "estimated_bytes"})

_ARGUMENT_KEYS: Mapping[ToolName, frozenset[str]] = {
    ToolName.REQUEST_EVIDENCE: frozenset(
        {"operation", "domain", "fact_slots", *_ESTIMATE_KEYS}
    ),
    ToolName.READ_APPROVED_MATERIALS: frozenset(
        {"operation", "domain", "input_refs", "fields", *_ESTIMATE_KEYS}
    ),
    ToolName.INSPECT_APPROVED_DATA: frozenset(
        {
            "operation",
            "domain",
            "data_ref",
            "fields",
            "operators",
            "dimensions",
            "metrics",
            "top_n",
            *_ESTIMATE_KEYS,
        }
    ),
    ToolName.COMPUTE_ANALYSIS: frozenset(
        {
            "operation",
            "domain",
            "data_refs",
            "algorithm_id",
            "algorithm_version",
            "metrics",
            "dimensions",
            "thresholds",
            "arithmetic_operation",
            "periods",
            "tolerance",
            *_ESTIMATE_KEYS,
        }
    ),
    ToolName.INSPECT_ACCOUNTING_CONTENT: frozenset(
        {"operation", "domain", "data_ref", "fields", *_ESTIMATE_KEYS}
    ),
    ToolName.GENERATE_ACCOUNTING_WORKBOOK: frozenset(
        {"operation", "domain", "data_ref", "fields", *_ESTIMATE_KEYS}
    ),
}
_FACT_SLOT_KEYS = frozenset(
    {
        "fact_slot",
        "description",
        "category",
        "data_scope",
        "subject",
        "time_range",
        "freshness",
        "use",
    }
)
_FACT_SLOT_BINDING_KEYS = frozenset(
    {"jurisdiction", "expected_unit", "expected_shape", "market_metric"}
)


class ToolPolicyError(ValueError):
    """Stable fail-closed denial with a redacted, system-owned audit record."""

    def __init__(self, code: str, audit: ToolAuditRecord) -> None:
        super().__init__(code)
        self.code = code
        self.audit = audit


def _canonicalize(value: Any) -> Any:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, dict):
        return {
            key.strip(): _canonicalize(item)
            for key, item in sorted(value.items(), key=lambda pair: pair[0].strip())
        }
    if isinstance(value, (list, tuple)):
        return [_canonicalize(item) for item in value]
    return value


def _fingerprint(tool_name: ToolName, arguments: dict[str, Any]) -> str:
    canonical = {"tool_name": tool_name.value, "normalized_arguments": arguments}
    encoded = json.dumps(
        canonical, ensure_ascii=False, allow_nan=False, separators=(",", ":"), sort_keys=True
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _safe_fingerprint(proposal: ToolCallProposal) -> str:
    try:
        return _fingerprint(proposal.tool_name, _canonicalize(proposal.arguments))
    except (TypeError, ValueError):
        return hashlib.sha256(proposal.tool_name.value.encode()).hexdigest()


def _safe_input_refs(
    context: ToolAuthorizationContext, arguments: Mapping[str, Any]
) -> tuple[str, ...]:
    approved = set(
        context.approved_input_refs
        + context.approved_evidence_refs
        + context.approved_data_refs
    )
    found: set[str] = set()

    def collect(value: Any) -> None:
        if isinstance(value, str) and value.strip() in approved:
            found.add(value.strip())
        elif isinstance(value, Mapping):
            for nested in value.values():
                collect(nested)
        elif isinstance(value, (list, tuple)):
            for nested in value:
                collect(nested)

    collect(arguments)
    return tuple(sorted(found))


def _audit(
    code: str,
    status: ToolCallStatus,
    context: ToolAuthorizationContext,
    proposal: ToolCallProposal,
    budget: ToolBudget,
) -> ToolAuditRecord:
    candidates = [
        skill
        for skill in ALL_DOWNSTREAM_SKILLS
        if skill.tool_policy is not None
        and (
            skill.agent_id == context.agent_id
            or skill.skill_id == context.skill_id
            or skill.tool_policy.policy_id == context.policy_id
        )
    ]
    canonical_skill = max(
        candidates,
        key=lambda skill: sum(
            (
                skill.agent_id == context.agent_id,
                skill.skill_id == context.skill_id,
                skill.tool_policy is not None
                and skill.tool_policy.policy_id == context.policy_id,
            )
        ),
        default=None,
    )
    canonical_policy = (
        canonical_skill.tool_policy if canonical_skill is not None else None
    )
    audit_ref = _mint_tool_audit_ref(b"policy-denial")
    return ToolAuditRecord(
        audit_ref=audit_ref,
        tool_call_id=audit_ref,
        request_id=context.request_id,
        case_id=context.case_id,
        decree_id=context.decree_id,
        agent_id=(canonical_skill.agent_id if canonical_skill else context.agent_id),
        skill_id=(canonical_skill.skill_id if canonical_skill else context.skill_id),
        skill_version=(canonical_skill.version if canonical_skill else context.skill_version),
        policy_id=(canonical_policy.policy_id if canonical_policy else context.policy_id),
        policy_version=(
            canonical_policy.version if canonical_policy else context.policy_version
        ),
        tool_name=proposal.tool_name,
        argument_hash=_safe_fingerprint(proposal),
        redacted_argument_summary=f"redacted:{len(proposal.arguments)}_keys",
        status=status,
        reason_code=code,
        input_refs=_safe_input_refs(context, proposal.arguments),
        output_refs=(),
        result_rows=0,
        result_bytes=0,
        max_calls=budget.max_calls,
        consumed_calls=budget.consumed_calls,
        max_rounds=budget.max_rounds,
        consumed_rounds=budget.consumed_rounds,
        max_rows=budget.max_rows,
        consumed_rows=budget.consumed_rows,
        max_bytes=budget.max_bytes,
        consumed_bytes=budget.consumed_bytes,
        duration_ms=0,
    )


def _reject(
    code: str,
    status: ToolCallStatus,
    context: ToolAuthorizationContext,
    proposal: ToolCallProposal,
    budget: ToolBudget,
) -> NoReturn:
    raise ToolPolicyError(code, _audit(code, status, context, proposal, budget)) from None


def _authoritative_binding(
    context: ToolAuthorizationContext,
) -> tuple[Any, BureauToolPolicy] | None:
    if not _tool_authorization_context_is_issued(context):
        return None
    skill = next(
        (item for item in ALL_DOWNSTREAM_SKILLS if item.agent_id == context.agent_id), None
    )
    if skill is None or skill.tool_policy is None:
        return None
    try:
        policy = bureau_tool_policy_for(context.agent_id)
    except (TypeError, ValueError):
        return None
    approved_refs = (
        context.approved_input_refs
        + context.approved_evidence_refs
        + context.approved_data_refs
    )
    case_marker = f"case:{context.case_id}:"
    decree_marker = f":decree:{context.decree_id}:"
    if (
        skill.skill_id != context.skill_id
        or skill.version != context.skill_version
        or skill.tool_policy != policy
        or policy.policy_id != context.policy_id
        or policy.version != context.policy_version
        or not context.request_id.strip()
        or not context.case_id.strip()
        or not context.decree_id.strip()
        or any("case:" in ref and case_marker not in ref for ref in approved_refs)
        or any(":decree:" in ref and decree_marker not in ref for ref in approved_refs)
    ):
        return None
    return skill, policy


def _contains_forbidden_key(value: Any) -> bool:
    if isinstance(value, Mapping):
        for key, nested in value.items():
            compact = _KEY_PARTS.sub("", str(key).casefold())
            if any(term in compact for term in _FORBIDDEN_AUTHORITY_TERMS):
                return True
            if _contains_forbidden_key(nested):
                return True
    elif isinstance(value, (list, tuple)):
        return any(_contains_forbidden_key(item) for item in value)
    return False


def _nonblank_strings(value: Any, *, maximum: int | None = None) -> bool:
    return (
        isinstance(value, list)
        and bool(value)
        and (maximum is None or len(value) <= maximum)
        and all(isinstance(item, str) and bool(item.strip()) for item in value)
    )


def _positive_estimates(arguments: Mapping[str, Any]) -> bool:
    return all(
        isinstance(arguments.get(key), int)
        and not isinstance(arguments.get(key), bool)
        and arguments[key] > 0
        for key in _ESTIMATE_KEYS
    )


def _valid_time_range(value: object) -> bool:
    if not isinstance(value, dict):
        return False
    if set(value) == {"as_of"}:
        return value["as_of"] == "case"
    if set(value) != {"start", "end"}:
        return False
    try:
        start = datetime.fromisoformat(value["start"].replace("Z", "+00:00"))
        end = datetime.fromisoformat(value["end"].replace("Z", "+00:00"))
    except (AttributeError, TypeError, ValueError):
        return False
    return start.tzinfo is not None and end.tzinfo is not None and start <= end


def _valid_periods(value: object) -> bool:
    if not _nonblank_strings(value, maximum=2) or len(value) != 2:
        return False
    parsed: list[tuple[int, object]] = []
    for label in value:
        try:
            numeric = float(label)
            if not math.isfinite(numeric):
                return False
            parsed.append((0, numeric))
            continue
        except ValueError:
            pass
        try:
            period = datetime.fromisoformat(label.replace("Z", "+00:00"))
            if period.tzinfo is None:
                return False
            parsed.append((1, period.astimezone(UTC)))
        except (AttributeError, TypeError, ValueError):
            return False
    try:
        return parsed[0][0] == parsed[1][0] and parsed[0][1] < parsed[1][1]
    except TypeError:
        return False


def _arguments_valid(tool: ToolName, arguments: Mapping[str, Any]) -> bool:
    optional_keys: set[str] = set()
    if tool is ToolName.INSPECT_APPROVED_DATA and "top_n" not in arguments:
        optional_keys.add("top_n")
    if tool is ToolName.COMPUTE_ANALYSIS and "arithmetic_operation" not in arguments:
        optional_keys.add("arithmetic_operation")
    if tool is ToolName.COMPUTE_ANALYSIS and "periods" not in arguments:
        optional_keys.add("periods")
    if tool is ToolName.COMPUTE_ANALYSIS and "tolerance" not in arguments:
        optional_keys.add("tolerance")
    if set(arguments) != _ARGUMENT_KEYS[tool] - optional_keys:
        return False
    if _contains_forbidden_key(arguments) or not _positive_estimates(arguments):
        return False
    if not all(
        isinstance(arguments.get(key), str) and bool(arguments[key].strip())
        for key in ("operation", "domain")
    ):
        return False
    if tool is ToolName.REQUEST_EVIDENCE:
        slots = arguments.get("fact_slots")
        def valid_slot(slot: object) -> bool:
            if (
                not isinstance(slot, dict)
                or set(slot) not in {
                    _FACT_SLOT_KEYS,
                    _FACT_SLOT_KEYS | _FACT_SLOT_BINDING_KEYS,
                }
            ):
                return False
            freshness = slot.get("freshness")
            time_range = slot.get("time_range")
            text_keys = _FACT_SLOT_KEYS - {"freshness", "time_range"}
            return bool(
                all(
                    isinstance(slot.get(key), str) and slot[key].strip()
                    for key in text_keys
                )
                and isinstance(freshness, dict)
                and set(freshness) == {"max_age_seconds"}
                and isinstance(freshness["max_age_seconds"], int)
                and not isinstance(freshness["max_age_seconds"], bool)
                and freshness["max_age_seconds"] > 0
                and _valid_time_range(time_range)
                and all(
                    slot.get(key) is None
                    or (
                        isinstance(slot.get(key), str)
                        and bool(slot[key].strip())
                    )
                    for key in _FACT_SLOT_BINDING_KEYS
                )
            )
        return (
            isinstance(slots, list)
            and 0 < len(slots) <= 5
            and all(valid_slot(slot) for slot in slots)
            and all(
                slot["freshness"] == slots[0]["freshness"] for slot in slots
            )
        )
    if tool is ToolName.READ_APPROVED_MATERIALS:
        return _nonblank_strings(arguments.get("input_refs"), maximum=20) and _nonblank_strings(
            arguments.get("fields"), maximum=50
        )
    if tool is ToolName.INSPECT_APPROVED_DATA:
        top_n = arguments.get("top_n")
        return (
            isinstance(arguments.get("data_ref"), str)
            and bool(arguments["data_ref"].strip())
            and all(
                _nonblank_strings(arguments.get(key), maximum=50)
                for key in ("fields", "operators", "dimensions", "metrics")
            )
            and (
                top_n is None
                or (
                    isinstance(top_n, int)
                    and not isinstance(top_n, bool)
                    and 0 < top_n <= 100
                )
            )
        )
    if tool in {
        ToolName.INSPECT_ACCOUNTING_CONTENT,
        ToolName.GENERATE_ACCOUNTING_WORKBOOK,
    }:
        return (
            isinstance(arguments.get("data_ref"), str)
            and bool(arguments["data_ref"].strip())
            and _nonblank_strings(arguments.get("fields"), maximum=50)
        )
    return (
        _nonblank_strings(arguments.get("data_refs"), maximum=20)
        and isinstance(arguments.get("algorithm_id"), str)
        and bool(arguments["algorithm_id"].strip())
        and arguments.get("algorithm_version") == "1.0.0"
        and _nonblank_strings(arguments.get("metrics"), maximum=50)
        and _nonblank_strings(arguments.get("dimensions"), maximum=50)
        and isinstance(arguments.get("thresholds"), list)
        and len(arguments["thresholds"]) <= 20
        and all(
            isinstance(item, (int, float)) and not isinstance(item, bool)
            for item in arguments["thresholds"]
        )
        and (
            arguments.get("algorithm_id") != "arithmetic"
            or arguments.get("arithmetic_operation")
            in {"add", "subtract", "multiply", "divide"}
        )
        and (
            arguments.get("algorithm_id") not in {"year_over_year", "period_over_period"}
            or _valid_periods(arguments.get("periods"))
        )
        and (
            arguments.get("algorithm_id") != "reconcile"
            or (
                isinstance(arguments.get("tolerance"), (int, float))
                and not isinstance(arguments.get("tolerance"), bool)
                and arguments["tolerance"] >= 0
            )
        )
    )


def _within_scope(
    tool: ToolName, arguments: Mapping[str, Any], policy: BureauToolPolicy
) -> bool:
    constraints = policy.tool_argument_constraints[tool]
    if arguments["domain"] not in constraints["allowed_domains"]:
        return False
    if arguments["operation"] not in policy.tool_operations[tool]:
        return False
    for argument_key, constraint_key in (
        ("fields", "allowed_fields"),
        ("dimensions", "allowed_dimensions"),
        ("metrics", "allowed_metrics"),
    ):
        if argument_key in arguments and not set(arguments[argument_key]) <= set(
            constraints[constraint_key]
        ):
            return False
    if "operators" in arguments and not set(arguments["operators"]) <= _INSPECT_OPERATORS:
        return False
    if tool is ToolName.COMPUTE_ANALYSIS and arguments["algorithm_id"] != arguments["operation"]:
        return False
    return True


def _refs_for(tool: ToolName, arguments: Mapping[str, Any]) -> tuple[tuple[str, str], ...]:
    if tool is ToolName.READ_APPROVED_MATERIALS:
        return tuple((ref, "input") for ref in arguments["input_refs"])
    if tool is ToolName.INSPECT_APPROVED_DATA:
        return ((arguments["data_ref"], "data"),)
    if tool is ToolName.COMPUTE_ANALYSIS:
        return tuple((ref, "data") for ref in arguments["data_refs"])
    if tool in {
        ToolName.INSPECT_ACCOUNTING_CONTENT,
        ToolName.GENERATE_ACCOUNTING_WORKBOOK,
    }:
        return ((arguments["data_ref"], "data"),)
    return ()


def _refs_approved(
    context: ToolAuthorizationContext, refs: Iterable[tuple[str, str]]
) -> bool:
    approved_by_kind = {
        "input": set(context.approved_input_refs),
        "evidence": set(context.approved_evidence_refs),
        "data": set(context.approved_data_refs),
    }
    case_marker = f"case:{context.case_id}:"
    decree_marker = f":decree:{context.decree_id}:"
    for raw_ref, expected_kind in refs:
        ref = raw_ref.strip()
        if (
            ref not in approved_by_kind[expected_kind]
            or any(ref in approved_by_kind[kind] for kind in _REF_KINDS - {expected_kind})
            or ("case:" in ref and case_marker not in ref)
            or (":decree:" in ref and decree_marker not in ref)
        ):
            return False
    return True


def _budget_valid(
    context: ToolAuthorizationContext,
    policy: BureauToolPolicy,
    budget: ToolBudget,
    arguments: Mapping[str, Any],
) -> bool:
    if (
        context.system_max_calls != SYSTEM_MAX_TOOL_CALLS
        or context.system_max_rounds != SYSTEM_MAX_TOOL_ROUNDS
        or context.system_max_result_rows != SYSTEM_MAX_RESULT_ROWS
        or context.system_max_result_bytes != SYSTEM_MAX_RESULT_BYTES
    ):
        return False
    if (
        policy.max_tool_calls > context.system_max_calls
        or policy.max_tool_rounds > context.system_max_rounds
        or policy.max_result_rows > context.system_max_result_rows
        or policy.max_result_bytes > context.system_max_result_bytes
        or budget.max_calls > policy.max_tool_calls
        or budget.max_rounds > policy.max_tool_rounds
        or budget.max_rows > policy.max_result_rows
        or budget.max_bytes > policy.max_result_bytes
    ):
        return False
    return (
        budget.consumed_calls < budget.max_calls
        and budget.consumed_rounds < budget.max_rounds
        and budget.consumed_rows < budget.max_rows
        and budget.consumed_bytes < budget.max_bytes
        and arguments["estimated_rows"] <= budget.max_rows - budget.consumed_rows
        and arguments["estimated_bytes"] <= budget.max_bytes - budget.consumed_bytes
    )


def _history_valid(history: tuple[str, ...]) -> bool:
    return all(
        isinstance(entry, str)
        and (
            _CALL_HISTORY_ENTRY.fullmatch(entry) is not None
            or _FINGERPRINT_HISTORY_ENTRY.fullmatch(entry) is not None
        )
        for entry in history
    )


def approve_tool_call(
    context: ToolAuthorizationContext,
    proposal: ToolCallProposal,
    budget: ToolBudget,
    history: tuple[str, ...],
) -> ApprovedToolCall:
    """Approve one pure, side-effect-free proposal or fail closed in stable order."""

    binding = _authoritative_binding(context)
    if binding is None:
        _reject("tool_identity_mismatch", ToolCallStatus.INVALID, context, proposal, budget)
    _, policy = binding

    descriptor = TOOL_DESCRIPTORS.get(proposal.tool_name)
    if descriptor is None:
        _reject("tool_unknown", ToolCallStatus.INVALID, context, proposal, budget)
    if proposal.expected_result_schema != descriptor.output_schema_id:
        _reject(
            "tool_result_schema_invalid", ToolCallStatus.INVALID, context, proposal, budget
        )
    if proposal.tool_name not in policy.allowed_tools:
        _reject("tool_not_allowed", ToolCallStatus.DENIED, context, proposal, budget)

    normalized = _canonicalize(proposal.arguments)
    if not _arguments_valid(proposal.tool_name, normalized):
        _reject("tool_arguments_invalid", ToolCallStatus.INVALID, context, proposal, budget)
    if not _within_scope(proposal.tool_name, normalized, policy):
        _reject("tool_scope_invalid", ToolCallStatus.DENIED, context, proposal, budget)
    if not _refs_approved(context, _refs_for(proposal.tool_name, normalized)):
        _reject("tool_reference_unapproved", ToolCallStatus.DENIED, context, proposal, budget)

    argument_fingerprint = _fingerprint(proposal.tool_name, normalized)
    call_history_entry = f"call:{proposal.tool_call_id}"
    fingerprint_history_entry = f"fingerprint:{argument_fingerprint}"
    if (
        not _history_valid(history)
        or call_history_entry in history
        or fingerprint_history_entry in history
    ):
        _reject("tool_call_duplicate", ToolCallStatus.INVALID, context, proposal, budget)
    if not _budget_valid(context, policy, budget, normalized):
        _reject(
            "tool_budget_exceeded", ToolCallStatus.BUDGET_EXCEEDED, context, proposal, budget
        )
    if context.business_state.casefold() not in _ENABLED_BUSINESS_STATES:
        _reject(
            "tool_business_state_blocked", ToolCallStatus.BLOCKED, context, proposal, budget
        )

    return _issue_approved_tool_call(ApprovedToolCall(
        request_id=context.request_id,
        case_id=context.case_id,
        decree_id=context.decree_id,
        agent_id=context.agent_id,
        skill_id=context.skill_id,
        skill_version=context.skill_version,
        policy_id=context.policy_id,
        policy_version=context.policy_version,
        tool_call_id=proposal.tool_call_id,
        tool_name=proposal.tool_name,
        purpose=proposal.purpose,
        arguments=normalized,
        required_for=proposal.required_for,
        expected_result_schema=descriptor.output_schema_id,
        normalized_arguments=normalized,
        argument_fingerprint=argument_fingerprint,
        policy_fingerprint=_bureau_tool_policy_fingerprint(policy),
        descriptor_fingerprint=_tool_descriptor_fingerprint(descriptor),
        descriptor_version=descriptor.version,
        descriptor_handler_id=descriptor.handler_id,
        approval_status=ToolCallStatus.APPROVED,
        audit_ref=_mint_tool_audit_ref(
            f"{context.request_id}\x1f{proposal.tool_call_id}".encode()
        ),
    ))
