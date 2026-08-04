from __future__ import annotations

import hashlib
import hmac
import json
import logging
import math
import re
import secrets
from collections import deque
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from threading import RLock
from time import monotonic_ns

from app.agents.runtime_skills.tool_issuance import (
    _approved_call_is_issued,
    _bureau_tool_policy_fingerprint,
    _tool_descriptor_fingerprint,
)
from app.agents.runtime_skills.tool_models import (
    ApprovedToolCall,
    ToolAuditRecord,
    ToolCallStatus,
    ToolDataQuality,
    ToolHandlerContext,
    ToolName,
    ToolResultEnvelope,
)
from app.agents.runtime_skills.tool_registry import (
    bureau_tool_policy_for,
    tool_descriptor_for,
)

ToolHandler = Callable[[ToolHandlerContext], Mapping[str, object]]
ToolAuditSink = Callable[[ToolAuditRecord], None]


@dataclass(frozen=True)
class _ToolHandlerBinding:
    handler_id: str
    tool_name: ToolName
    descriptor_id: str
    handler: ToolHandler


_CAPABILITY_SEAL = object()
_CAPABILITY_SIGNING_KEY = secrets.token_bytes(32)


class _AuthorizedToolHandlerSet:
    __slots__ = ("_bindings", "_capability_id", "_seal", "_signature", "_frozen")

    def __init__(
        self,
        capability_id: str,
        bindings: tuple[_ToolHandlerBinding, ...],
        signature: str,
        _token: object | None = None,
    ) -> None:
        if _token is not _CAPABILITY_SEAL:
            raise TypeError("authorized_tool_handler_set_factory_required")
        object.__setattr__(self, "_capability_id", capability_id)
        object.__setattr__(self, "_bindings", bindings)
        object.__setattr__(self, "_seal", _CAPABILITY_SEAL)
        object.__setattr__(self, "_signature", signature)
        object.__setattr__(self, "_frozen", True)

    def __setattr__(self, name: str, value: object) -> None:
        if getattr(self, "_frozen", False):
            raise AttributeError("authorized_tool_handler_set_is_frozen")
        object.__setattr__(self, name, value)

    @property
    def capability_id(self) -> str:
        return self._capability_id


def _capability_signature(
    capability_id: str, bindings: tuple[_ToolHandlerBinding, ...]
) -> str:
    parts = [capability_id]
    for binding in bindings:
        parts.extend(
            (
                binding.tool_name.value, binding.descriptor_id,
                binding.handler_id, str(id(binding.handler)),
            )
        )
    message = "\x1f".join(parts).encode("utf-8")
    return hmac.new(_CAPABILITY_SIGNING_KEY, message, hashlib.sha256).hexdigest()


def _authorize_tool_handlers_from_trusted_adapters(
    adapters: Mapping[ToolName, ToolHandler],
) -> _AuthorizedToolHandlerSet:
    if not adapters or any(not callable(handler) for handler in adapters.values()):
        raise ValueError("tool_handler_identity_mismatch")
    bindings: list[_ToolHandlerBinding] = []
    for name, handler in sorted(adapters.items(), key=lambda item: item[0].value):
        descriptor = tool_descriptor_for(name)
        bindings.append(
            _ToolHandlerBinding(
                handler_id=descriptor.handler_id, tool_name=name,
                descriptor_id=descriptor.descriptor_id, handler=handler,
            )
        )
    frozen_bindings = tuple(bindings)
    capability_id = secrets.token_urlsafe(32)
    signature = _capability_signature(capability_id, frozen_bindings)
    return _AuthorizedToolHandlerSet(
        capability_id, frozen_bindings, signature, _CAPABILITY_SEAL
    )


_TOOL_AUDITS: deque[ToolAuditRecord] = deque(maxlen=4096)
_TOOL_AUDIT_LOCK = RLock()
_AUDIT_LOGGER = logging.getLogger("chaotang.runtime_skills.tool_audit")
_FORBIDDEN_KEYS = frozenset(
    {
        "password", "secret", "api_key", "auth", "authorization", "token",
        "credential", "provider", "provider_payload", "raw", "raw_exception",
        "path", "sql", "code", "url",
    }
)
_UNSAFE_TEXT = re.compile(
    r"(?i)(?:\bBearer\s+\S+|\bsk-[A-Za-z0-9_-]+|https?://|file://|"
    r"\\\\[^\\\s]+\\|[a-z]:\\|\b(?:select|insert|update|delete|drop)\s+|"
    r"\b(?:eval|exec)\s*\()"
)
_RESULT_KEYS = frozenset(
    {
        "result_schema", "data", "input_refs", "evidence_refs",
        "approved_data_refs", "data_quality", "limitations", "as_of",
    }
)
_FIXED_ALGORITHMS = frozenset(
    {
        "arithmetic", "percentage", "year_over_year", "period_over_period",
        "share", "difference", "mean",
        "median", "extrema", "rank", "group_summary", "trend", "threshold",
        "reconcile",
    }
)
_MAX_DEPTH = 8
_MAX_FIELDS = 256
_MAX_TEXT = 32_768
_REF_PATTERN = re.compile(
    r"(?P<kind>input|evidence|approved-data):case:"
    r"(?P<case>[A-Za-z0-9][A-Za-z0-9._-]{0,127}):decree:"
    r"(?P<decree>[A-Za-z0-9][A-Za-z0-9._-]{0,127}):"
    r"(?P<opaque>[A-Za-z0-9][A-Za-z0-9._-]{0,127})"
)


def record_tool_audit(audit: ToolAuditRecord) -> None:
    with _TOOL_AUDIT_LOCK:
        _TOOL_AUDITS.append(audit)
    _AUDIT_LOGGER.info(audit.model_dump_json())


def tool_audit_snapshot() -> tuple[ToolAuditRecord, ...]:
    with _TOOL_AUDIT_LOCK:
        return tuple(_TOOL_AUDITS)


def clear_tool_audits() -> None:
    with _TOOL_AUDIT_LOCK:
        _TOOL_AUDITS.clear()


class ToolExecutionError(ValueError):
    def __init__(self, code: str, audit: ToolAuditRecord) -> None:
        super().__init__(code)
        self.code = code
        self.audit = audit


def _dump(value: object) -> bytes:
    return json.dumps(
        value, ensure_ascii=False, allow_nan=False, sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def _audit(
    call: ApprovedToolCall,
    context: ToolHandlerContext,
    status: ToolCallStatus,
    code: str,
    started_ns: int,
    *,
    input_refs: tuple[str, ...] = (),
    output_refs: tuple[str, ...] = (),
    rows: int = 0,
    size: int = 0,
) -> ToolAuditRecord:
    budget = context.budget
    return ToolAuditRecord(
        audit_ref=call.audit_ref, tool_call_id=call.audit_ref, request_id=call.request_id,
        case_id=call.case_id, decree_id=call.decree_id, agent_id=call.agent_id,
        skill_id=call.skill_id, skill_version=call.skill_version,
        policy_id=call.policy_id, policy_version=call.policy_version,
        tool_name=call.tool_name, argument_hash=call.argument_fingerprint,
        redacted_argument_summary=f"redacted:{len(call.normalized_arguments)}_keys",
        status=status, reason_code=code, input_refs=input_refs, output_refs=output_refs,
        result_rows=rows, result_bytes=size,
        max_calls=budget.max_calls,
        consumed_calls=min(budget.max_calls, budget.consumed_calls + 1),
        max_rounds=budget.max_rounds,
        consumed_rounds=min(budget.max_rounds, max(1, budget.consumed_rounds)),
        max_rows=budget.max_rows,
        consumed_rows=min(budget.max_rows, budget.consumed_rows + rows),
        max_bytes=budget.max_bytes,
        consumed_bytes=min(budget.max_bytes, budget.consumed_bytes + size),
        duration_ms=max(0, (monotonic_ns() - started_ns) // 1_000_000),
        created_at=datetime.now(UTC),
    )


def _publish(audit: ToolAuditRecord, sink: ToolAuditSink | None) -> None:
    if sink is None:
        record_tool_audit(audit)
        return
    try:
        sink(audit)
    except Exception:
        record_tool_audit(audit)


def _error(
    call: ApprovedToolCall,
    context: ToolHandlerContext,
    code: str,
    started_ns: int,
    sink: ToolAuditSink | None,
    *,
    rows: int = 0,
    size: int = 0,
) -> ToolExecutionError:
    audit = _audit(
        call, context, ToolCallStatus.FAILED, code, started_ns, rows=rows, size=size
    )
    _publish(audit, sink)
    return ToolExecutionError(code, audit)


def _forbidden_key(key: str) -> bool:
    normalized = key.casefold().replace("-", "_")
    parts = frozenset(part for part in normalized.split("_") if part)
    return normalized in _FORBIDDEN_KEYS or bool(parts & _FORBIDDEN_KEYS)


def _validate_safe(value: object, depth: int = 0) -> int:
    if depth > _MAX_DEPTH:
        raise ValueError("depth")
    fields = 0
    if isinstance(value, Mapping):
        for key, item in value.items():
            if not isinstance(key, str) or not key.strip():
                raise ValueError("key")
            if _forbidden_key(key):
                raise PermissionError("secret")
            fields += 1 + _validate_safe(item, depth + 1)
    elif isinstance(value, (list, tuple)):
        fields += sum(_validate_safe(item, depth + 1) for item in value)
    elif isinstance(value, str):
        if not value.strip() or len(value) > _MAX_TEXT:
            raise ValueError("text")
        if _UNSAFE_TEXT.search(value):
            raise PermissionError("secret")
    elif isinstance(value, float):
        if not math.isfinite(value):
            raise ValueError("number")
    elif value is not None and not isinstance(value, (bool, int)):
        raise ValueError("type")
    if fields > _MAX_FIELDS:
        raise ValueError("fields")
    return fields


def _invoke(handler: ToolHandler, context: ToolHandlerContext) -> tuple[bool, object]:
    try:
        return True, handler(context)
    except Exception:
        return False, None


def _refs(raw: Mapping[str, object], name: str) -> tuple[str, ...]:
    value = raw.get(name)
    if not isinstance(value, (list, tuple)) or any(not isinstance(x, str) for x in value):
        raise ValueError("refs")
    return tuple(value)


def _valid_ref(ref: str, kind: str, call: ApprovedToolCall) -> bool:
    match = _REF_PATTERN.fullmatch(ref)
    return bool(
        match
        and match.group("kind") == kind
        and match.group("case") == call.case_id
        and match.group("decree") == call.decree_id
    )


def _exact_record(value: object, keys: frozenset[str]) -> Mapping[str, object]:
    if not isinstance(value, Mapping) or set(value) != keys:
        raise ValueError("record_schema")
    return value


def _validate_payload(
    tool: ToolName,
    data: object,
    input_refs: tuple[str, ...],
    evidence_refs: tuple[str, ...],
    data_refs: tuple[str, ...],
) -> None:
    if not isinstance(data, Mapping):
        raise ValueError("payload_mapping")
    if tool is ToolName.REQUEST_EVIDENCE:
        if set(data) != {"facts"} or not isinstance(data["facts"], list):
            raise ValueError("facts_schema")
        for item in data["facts"]:
            fact = _exact_record(
                item, frozenset({"ref", "fact_key", "summary", "value", "as_of"})
            )
            if (
                fact["ref"] not in evidence_refs
                or not isinstance(fact["summary"], str)
                or not isinstance(fact["fact_key"], str)
                or not isinstance(fact["as_of"], str)
            ):
                raise ValueError("fact_schema")
        return
    if tool is ToolName.READ_APPROVED_MATERIALS:
        if set(data) != {"materials"} or not isinstance(data["materials"], list):
            raise ValueError("materials_schema")
        for item in data["materials"]:
            material = _exact_record(
                item, frozenset({"ref", "summary", "projection"})
            )
            if (
                material["ref"] not in input_refs
                or not isinstance(material["summary"], str)
                or not isinstance(material["projection"], Mapping)
            ):
                raise ValueError("material_schema")
        return
    if tool is ToolName.INSPECT_APPROVED_DATA:
        if set(data) != {"operation", "columns", "rows"}:
            raise ValueError("approved_data_schema")
        columns, rows = data["columns"], data["rows"]
        if (
            not isinstance(data["operation"], str)
            or not isinstance(columns, list)
            or not columns
            or any(not isinstance(column, str) or not column.strip() for column in columns)
            or len(set(columns)) != len(columns)
            or not isinstance(rows, list)
        ):
            raise ValueError("approved_data_schema")
        for row in rows:
            if not isinstance(row, Mapping) or list(row) != columns:
                raise ValueError("approved_data_row_schema")
        if not data_refs:
            raise ValueError("approved_data_refs")
        return
    if set(data) != {"algorithm_id", "algorithm_version", "values", "units"}:
        raise ValueError("analysis_schema")
    if (
        data["algorithm_id"] != "difference"
        and not isinstance(data["algorithm_id"], str)
    ):
        raise ValueError("analysis_algorithm")
    if (
        not isinstance(data["algorithm_version"], str)
        or not isinstance(data["values"], list)
        or not isinstance(data["units"], str)
    ):
        raise ValueError("analysis_schema")
    if not data_refs:
        raise ValueError("analysis_refs")


def _truncate(
    data: object, row_limit: int, byte_limit: int
) -> tuple[object, int, int, int, int]:
    """Return data, original count, returned count, removed rows, removed bytes."""
    original_size = len(_dump(data))
    if isinstance(data, list):
        original = len(data)
        kept = list(data[:row_limit])
        while kept and len(_dump(kept)) > byte_limit:
            kept.pop()
        if not kept and data:
            raise OverflowError
        return kept, original, len(kept), original - len(kept), original_size - len(_dump(kept))
    if isinstance(data, Mapping):
        collection_key = next(
            (
                key for key in ("facts", "materials", "rows", "values")
                if key in data and isinstance(data[key], list)
            ),
            None,
        )
        if collection_key is None:
            if original_size > byte_limit:
                raise OverflowError
            return data, 1, 1, 0, 0
        original_items = data[collection_key]
        assert isinstance(original_items, list)
        kept = list(original_items[:row_limit])
        candidate = {**data, collection_key: kept}
        while kept and len(_dump(candidate)) > byte_limit:
            kept.pop()
            candidate = {**data, collection_key: kept}
        if not kept and original_items:
            raise OverflowError
        return (
            candidate, len(original_items), len(kept),
            len(original_items) - len(kept), original_size - len(_dump(candidate)),
        )
    if original_size > byte_limit:
        raise OverflowError
    count = 0 if data in (None, {}, []) else 1
    return data, count, count, 0, 0


def execute_approved_tool(
    call: ApprovedToolCall,
    context: ToolHandlerContext,
    handlers: _AuthorizedToolHandlerSet,
    audit_sink: ToolAuditSink | None = None,
) -> ToolResultEnvelope:
    if not _approved_call_is_issued(call):
        raise ValueError("tool_call_not_issued")
    started = monotonic_ns()
    audit_call = call if isinstance(call, ApprovedToolCall) else context.approved_call
    if not isinstance(call, ApprovedToolCall):
        raise _error(
            audit_call, context, "tool_call_not_approved", started, audit_sink
        ) from None
    if context.approved_call != call:
        raise _error(call, context, "tool_context_mismatch", started, audit_sink) from None
    try:
        current_policy = bureau_tool_policy_for(call.agent_id)
    except ValueError:
        raise _error(
            call, context, "tool_policy_identity_mismatch", started, audit_sink
        ) from None
    policy_identity = (
        current_policy.policy_id,
        current_policy.version,
        _bureau_tool_policy_fingerprint(current_policy),
    )
    approved_policy_identity = (
        call.policy_id,
        call.policy_version,
        call.policy_fingerprint,
    )
    if any(
        not hmac.compare_digest(approved, current)
        for approved, current in zip(
            approved_policy_identity, policy_identity, strict=True
        )
    ):
        raise _error(
            call, context, "tool_policy_identity_mismatch", started, audit_sink
        ) from None
    try:
        descriptor = tool_descriptor_for(call.tool_name)
    except ValueError:
        raise _error(
            call, context, "tool_descriptor_identity_mismatch", started, audit_sink
        ) from None
    descriptor_identity = (
        _tool_descriptor_fingerprint(descriptor),
        descriptor.version,
        descriptor.handler_id,
    )
    approved_identity = (
        call.descriptor_fingerprint,
        call.descriptor_version,
        call.descriptor_handler_id,
    )
    if any(
        not hmac.compare_digest(approved, current)
        for approved, current in zip(approved_identity, descriptor_identity, strict=True)
    ):
        raise _error(
            call, context, "tool_descriptor_identity_mismatch", started, audit_sink
        ) from None
    if call.expected_result_schema != descriptor.output_schema_id:
        raise _error(
            call, context, "tool_result_schema_invalid", started, audit_sink
        ) from None
    if (
        not isinstance(handlers, _AuthorizedToolHandlerSet)
        or getattr(handlers, "_seal", None) is not _CAPABILITY_SEAL
        or context.capability_id != handlers.capability_id
        or not hmac.compare_digest(
            handlers._signature,
            _capability_signature(handlers.capability_id, handlers._bindings),
        )
    ):
        raise _error(call, context, "tool_handler_invalid", started, audit_sink) from None
    authorized_bindings = handlers._bindings
    binding_by_name = {binding.tool_name: binding for binding in authorized_bindings}
    if call.tool_name not in binding_by_name:
        raise _error(
            call, context, "tool_handler_unavailable", started, audit_sink
        ) from None
    binding = binding_by_name[call.tool_name]
    if (
        len(binding_by_name) != len(authorized_bindings)
        or not isinstance(binding, _ToolHandlerBinding)
        or binding.handler_id != descriptor.handler_id
        or binding.tool_name is not call.tool_name
        or binding.descriptor_id != descriptor.descriptor_id
        or not callable(binding.handler)
    ):
        raise _error(call, context, "tool_handler_invalid", started, audit_sink) from None
    ok, raw_value = _invoke(binding.handler, context)
    if not ok:
        raise _error(call, context, "tool_execution_failed", started, audit_sink) from None
    if not isinstance(raw_value, Mapping):
        raise _error(call, context, "tool_handler_invalid", started, audit_sink) from None
    raw = raw_value
    expected_keys = _RESULT_KEYS | (
        {"algorithm_id", "algorithm_version"}
        if call.tool_name is ToolName.COMPUTE_ANALYSIS else set()
    )
    if set(raw) != expected_keys or raw.get("result_schema") != descriptor.output_schema_id:
        raise _error(
            call, context, "tool_result_schema_invalid", started, audit_sink
        ) from None
    try:
        input_refs = _refs(raw, "input_refs")
        evidence_refs = _refs(raw, "evidence_refs")
        data_refs = _refs(raw, "approved_data_refs")
    except ValueError:
        raise _error(
            call, context, "tool_result_reference_invalid", started, audit_sink
        ) from None
    approved = frozenset(context.resolved_approved_inputs)
    typed_refs = (
        (input_refs, "input"),
        (evidence_refs, "evidence"),
        (data_refs, "approved-data"),
    )
    if any(
        (
            ref not in approved
            and not (
                call.tool_name is ToolName.REQUEST_EVIDENCE
                and kind == "evidence"
            )
        )
        or not _valid_ref(ref, kind, call)
        for refs, kind in typed_refs for ref in refs
    ):
        raise _error(
            call, context, "tool_result_reference_invalid", started, audit_sink
        ) from None
    required = {
        ToolName.REQUEST_EVIDENCE: evidence_refs,
        ToolName.READ_APPROVED_MATERIALS: input_refs,
        ToolName.INSPECT_APPROVED_DATA: data_refs,
        ToolName.COMPUTE_ANALYSIS: data_refs,
    }[call.tool_name]
    if not required:
        raise _error(
            call, context, "tool_result_schema_invalid", started, audit_sink
        ) from None
    limitations_value = raw["limitations"]
    if not isinstance(limitations_value, (list, tuple)):
        raise _error(
            call, context, "tool_result_schema_invalid", started, audit_sink
        ) from None
    try:
        _validate_safe(raw["data"])
        _validate_safe(limitations_value)
        _validate_payload(
            call.tool_name, raw["data"], input_refs, evidence_refs, data_refs
        )
    except PermissionError:
        raise _error(
            call, context, "tool_result_secret_detected", started, audit_sink
        ) from None
    except (TypeError, ValueError):
        raise _error(
            call, context, "tool_result_schema_invalid", started, audit_sink
        ) from None
    algorithm_id = raw.get("algorithm_id")
    algorithm_version = raw.get("algorithm_version")
    if call.tool_name is ToolName.COMPUTE_ANALYSIS and (
        algorithm_id not in _FIXED_ALGORITHMS
        or algorithm_id != call.normalized_arguments.get("algorithm_id")
        or algorithm_version != call.normalized_arguments.get("algorithm_version")
        or algorithm_version != "1.0.0"
        or not isinstance(raw["data"], Mapping)
        or raw["data"].get("algorithm_id") != algorithm_id
        or raw["data"].get("algorithm_version") != algorithm_version
    ):
        raise _error(
            call, context, "tool_result_schema_invalid", started, audit_sink
        ) from None
    row_limit = min(
        descriptor.max_result_rows,
        context.budget.max_rows - context.budget.consumed_rows,
    )
    byte_limit = min(
        descriptor.max_result_bytes,
        context.budget.max_bytes - context.budget.consumed_bytes,
    )
    try:
        data, original, returned, removed_rows, removed_bytes = _truncate(
            raw["data"], row_limit, byte_limit
        )
    except OverflowError:
        raise _error(
            call, context, "tool_result_too_large", started, audit_sink
        ) from None
    limitations = tuple(limitations_value)
    if original == 0:
        status = ToolCallStatus.EMPTY
        data = None
    elif returned < original:
        status = ToolCallStatus.TRUNCATED
        limitations = (*limitations, "result_truncated")
    else:
        status = ToolCallStatus.SUCCEEDED
    size = len(_dump(data)) if data is not None else 0
    try:
        quality = ToolDataQuality(raw["data_quality"])
        as_of_value = raw["as_of"]
        if not isinstance(as_of_value, str):
            raise ValueError("as_of")
        as_of = datetime.fromisoformat(as_of_value.replace("Z", "+00:00"))
        if as_of.tzinfo is None:
            raise ValueError("as_of_timezone")
        result = ToolResultEnvelope(
            tool_call_id=call.audit_ref, status=status, tool_name=call.tool_name,
            result_schema=descriptor.output_schema_id, data=data,
            approved_input_refs=input_refs, evidence_refs=evidence_refs,
            approved_data_refs=data_refs, as_of=as_of, data_quality=quality,
            limitations=limitations, audit_ref=call.audit_ref,
            algorithm_id=algorithm_id if isinstance(algorithm_id, str) else None,
            algorithm_version=(
                algorithm_version if isinstance(algorithm_version, str) else None
            ),
            truncated_rows=removed_rows if status is ToolCallStatus.TRUNCATED else None,
            truncated_bytes=removed_bytes if status is ToolCallStatus.TRUNCATED else None,
            original_records=original if status is ToolCallStatus.TRUNCATED else None,
            returned_records=returned if status is ToolCallStatus.TRUNCATED else None,
        )
    except (TypeError, ValueError):
        raise _error(
            call, context, "tool_result_schema_invalid", started, audit_sink,
            rows=returned, size=size,
        ) from None
    reason = {
        ToolCallStatus.SUCCEEDED: "tool_succeeded",
        ToolCallStatus.EMPTY: "tool_empty",
        ToolCallStatus.TRUNCATED: "tool_truncated",
    }[status]
    audit = _audit(
        call, context, status, reason, started, input_refs=input_refs,
        output_refs=(*input_refs, *evidence_refs, *data_refs), rows=returned, size=size,
    )
    _publish(audit, audit_sink)
    return result
