from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import pytest

import app.agents.runtime_skills as runtime_skills_package
import app.agents.runtime_skills.tool_executor as tool_executor_module
from app.agents.runtime_skills.tool_audit_ref import _mint_tool_audit_ref as new_tool_audit_ref
from app.agents.runtime_skills.tool_executor import (
    ToolExecutionError,
    _authorize_tool_handlers_from_trusted_adapters,
    _AuthorizedToolHandlerSet,
    _ToolHandlerBinding,
    clear_tool_audits,
    execute_approved_tool,
    tool_audit_snapshot,
)
from app.agents.runtime_skills.tool_issuance import (
    _bureau_tool_policy_fingerprint,
    _issue_approved_tool_call,
    _tool_descriptor_fingerprint,
)
from app.agents.runtime_skills.tool_models import (
    ApprovedToolCall,
    ToolBudget,
    ToolCallStatus,
    ToolDataQuality,
    ToolHandlerContext,
    ToolName,
)
from app.agents.runtime_skills.tool_registry import (
    BUREAU_TOOL_POLICIES,
    TOOL_DESCRIPTORS,
)

AuthorizedToolHandlerSet = _AuthorizedToolHandlerSet
ToolHandlerBinding = _ToolHandlerBinding
authorize_trusted_handlers = _authorize_tool_handlers_from_trusted_adapters

CASE = "case-1"
DECREE = "decree-1"
INPUT = f"input:case:{CASE}:decree:{DECREE}:brief"
DATA = f"approved-data:case:{CASE}:decree:{DECREE}:rows"
EVIDENCE = f"evidence:case:{CASE}:decree:{DECREE}:fact"


@pytest.fixture(autouse=True)
def isolated_audit() -> Any:
    clear_tool_audits()
    try:
        yield
    finally:
        clear_tool_audits()


def call(tool: ToolName = ToolName.READ_APPROVED_MATERIALS, **changes: Any) -> ApprovedToolCall:
    normalized = {"estimated_rows": 2, "estimated_bytes": 4096}
    if tool is ToolName.COMPUTE_ANALYSIS:
        normalized.update({"algorithm_id": "difference", "algorithm_version": "1.0.0"})
    values: dict[str, Any] = {
        "request_id": "request-1", "case_id": CASE, "decree_id": DECREE,
        "agent_id": "libu-policy", "skill_id": "bureau.libu.policy.v1",
        "skill_version": "1.0.0", "policy_id": "bureau.libu.policy.tools",
        "policy_version": "1.0.0", "tool_call_id": "tc-1", "tool_name": tool,
        "purpose": "bounded lookup", "arguments": {"estimated_rows": 2, "estimated_bytes": 4096},
        "required_for": ("finding",),
        "expected_result_schema": TOOL_DESCRIPTORS[tool].output_schema_id,
        "normalized_arguments": normalized,
        "argument_fingerprint": "a" * 64, "approval_status": ToolCallStatus.APPROVED,
        "policy_fingerprint": _bureau_tool_policy_fingerprint(
            BUREAU_TOOL_POLICIES["libu-policy"]
        ),
        "descriptor_fingerprint": _tool_descriptor_fingerprint(TOOL_DESCRIPTORS[tool]),
        "descriptor_version": TOOL_DESCRIPTORS[tool].version,
        "descriptor_handler_id": TOOL_DESCRIPTORS[tool].handler_id,
        "audit_ref": new_tool_audit_ref(),
    }
    values.update(changes)
    return _issue_approved_tool_call(ApprovedToolCall(**values))


def context(
    approved: ApprovedToolCall | None = None,
    capability_id: str = "unbound",
) -> ToolHandlerContext:
    approved = approved or call()
    return ToolHandlerContext(
        approved_call=approved,
        capability_id=capability_id,
        resolved_approved_inputs={
            INPUT: {"title": "brief"}, DATA: [{"value": 1}],
            EVIDENCE: {"fact": 1},
        },
        restricted_adapters={},
        budget=ToolBudget(
            max_calls=3, consumed_calls=1, max_rounds=2, consumed_rounds=1,
            max_rows=7, consumed_rows=2, max_bytes=8192, consumed_bytes=128,
        ),
    )


def binding(approved: ApprovedToolCall, handler: Any) -> ToolHandlerBinding:
    descriptor = TOOL_DESCRIPTORS[approved.tool_name]
    return ToolHandlerBinding(
        handler_id=descriptor.handler_id,
        tool_name=approved.tool_name,
        descriptor_id=descriptor.descriptor_id,
        handler=handler,
    )


def authorized(
    approved: ApprovedToolCall, handler: Any, ctx: ToolHandlerContext | None = None
) -> tuple[ToolHandlerContext, AuthorizedToolHandlerSet]:
    capability = authorize_trusted_handlers({approved.tool_name: handler})
    base = ctx or context(approved)
    return base.model_copy(update={"capability_id": capability.capability_id}), capability


def invoke(
    approved: ApprovedToolCall,
    handler: Any,
    ctx: ToolHandlerContext | None = None,
    audit_sink: Any = None,
) -> Any:
    authorized_context, capability = authorized(approved, handler, ctx)
    return execute_approved_tool(
        approved, authorized_context, capability, audit_sink=audit_sink
    )


def raw(
    approved: ApprovedToolCall,
    *,
    data: Any = None,
    refs: tuple[str, ...] = (INPUT,),
    **extra: Any,
) -> dict[str, object]:
    input_refs = tuple(ref for ref in refs if ref.startswith("input:"))
    evidence_refs = tuple(ref for ref in refs if ref.startswith("evidence:"))
    data_refs = tuple(ref for ref in refs if ref.startswith("approved-data:"))
    data_by_tool: dict[ToolName, object] = {
        ToolName.REQUEST_EVIDENCE: {
            "facts": [{
                "ref": EVIDENCE, "fact_key": "fact-1", "summary": "approved fact",
                "value": 1,
                "as_of": "2026-08-03T00:00:00Z",
            }]
        },
        ToolName.READ_APPROVED_MATERIALS: {
            "materials": [{
                "ref": INPUT, "summary": "approved material",
                "projection": {"title": "brief"},
            }]
        },
        ToolName.INSPECT_APPROVED_DATA: {
            "operation": "compare", "columns": ["value"], "rows": [{"value": 1}]
        },
        ToolName.COMPUTE_ANALYSIS: {
            "algorithm_id": "difference", "algorithm_version": "1.0.0",
            "values": [1], "units": "count",
        },
    }
    payload: dict[str, object] = {
        "result_schema": approved.expected_result_schema,
        "data": data_by_tool[approved.tool_name] if data is None else data,
        "input_refs": input_refs,
        "evidence_refs": evidence_refs, "approved_data_refs": data_refs,
        "data_quality": "SUFFICIENT", "limitations": (),
        "as_of": "2026-08-03T00:00:00Z",
    }
    payload.update(extra)
    return payload


def fake_raw(approved: ApprovedToolCall, **updates: Any) -> Any:
    def handler(_: ToolHandlerContext) -> dict[str, object]:
        return raw(approved, **updates)
    return handler


def fake_result(value: Any) -> Any:
    def handler(_: ToolHandlerContext) -> Any:
        return value
    return handler


@pytest.mark.parametrize("tool", tuple(ToolName))
def test_valid_success_for_each_descriptor(tool: ToolName) -> None:
    approved = call(tool)
    refs = {
        ToolName.REQUEST_EVIDENCE: (EVIDENCE,),
        ToolName.READ_APPROVED_MATERIALS: (INPUT,),
        ToolName.INSPECT_APPROVED_DATA: (DATA,),
        ToolName.COMPUTE_ANALYSIS: (DATA,),
    }[tool]
    extras = ({"algorithm_id": "difference", "algorithm_version": "1.0.0"}
              if tool is ToolName.COMPUTE_ANALYSIS else {})
    handler = fake_raw(approved, refs=refs, **extras)
    result = invoke(approved, handler)
    assert result.status is ToolCallStatus.SUCCEEDED
    assert result.tool_call_id == approved.audit_ref
    assert result.data_quality is ToolDataQuality.SUFFICIENT
    result_refs = (
        *result.approved_input_refs, *result.evidence_refs, *result.approved_data_refs
    )
    assert len(result_refs) > 0
    assert len(tool_audit_snapshot()) == 1


def test_current_descriptor_replacement_is_rejected_before_effect(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    approved = call(tool_call_id="Bearer-private-model-id", purpose="sk-SENSITIVE")
    current = TOOL_DESCRIPTORS[approved.tool_name]
    replacement = current.model_copy(update={
        "handler_id": "bureau-handler.replaced.v1",
        "risk_level": "different-authority",
    })
    hits = 0

    def handler(_: ToolHandlerContext) -> dict[str, object]:
        nonlocal hits
        hits += 1
        return raw(approved)

    monkeypatch.setattr(tool_executor_module, "tool_descriptor_for", lambda _: replacement)
    authorized_context, capability = authorized(approved, handler)
    with pytest.raises(ToolExecutionError, match="tool_descriptor_identity_mismatch") as caught:
        execute_approved_tool(approved, authorized_context, capability)
    assert hits == 0
    audits = tool_audit_snapshot()
    assert audits == (caught.value.audit,)
    assert caught.value.audit.audit_ref == approved.audit_ref
    assert caught.value.audit.reason_code == "tool_descriptor_identity_mismatch"
    serialized = caught.value.audit.model_dump_json()
    assert approved.tool_call_id not in serialized
    assert "SENSITIVE" not in serialized


@pytest.mark.parametrize(
    "mutation",
    (
        {"allowed_tools": frozenset({ToolName.READ_APPROVED_MATERIALS})},
        {"allowed_data_domains": frozenset({"replacement-domain"})},
        {"required_data_refs": ("replacement-ref",)},
        {
            "tool_operations": {
                ToolName.READ_APPROVED_MATERIALS: ("replacement-operation",)
            }
        },
        {
            "tool_argument_constraints": {
                ToolName.READ_APPROVED_MATERIALS: {
                    "allowed_fields": ("replacement-field",),
                    "operation_required": True,
                }
            }
        },
        {"max_tool_calls": 1},
        {"max_tool_rounds": 1},
        {"max_result_rows": 1},
        {"max_result_bytes": 1},
    ),
    ids=(
        "tool", "domain", "required-ref", "operation", "constraint",
        "calls", "rounds", "rows", "bytes",
    ),
)
def test_current_policy_mutation_is_rejected_before_effect(
    monkeypatch: pytest.MonkeyPatch,
    mutation: dict[str, object],
) -> None:
    approved = call(tool_call_id="Bearer-private-model-id", purpose="sk-SENSITIVE")
    current = BUREAU_TOOL_POLICIES[approved.agent_id]
    replacement = current.model_copy(deep=True, update=mutation)
    assert replacement.policy_id == current.policy_id
    assert replacement.version == current.version
    hits = 0

    def handler(_: ToolHandlerContext) -> dict[str, object]:
        nonlocal hits
        hits += 1
        return raw(approved)

    monkeypatch.setattr(
        tool_executor_module,
        "bureau_tool_policy_for",
        lambda _: replacement,
        raising=False,
    )
    authorized_context, capability = authorized(approved, handler)
    with pytest.raises(ToolExecutionError, match="tool_policy_identity_mismatch") as caught:
        execute_approved_tool(approved, authorized_context, capability)
    assert hits == 0
    audits = tool_audit_snapshot()
    assert audits == (caught.value.audit,)
    assert caught.value.audit.audit_ref == approved.audit_ref
    assert caught.value.audit.reason_code == "tool_policy_identity_mismatch"
    assert (caught.value.audit.max_calls, caught.value.audit.consumed_calls) == (3, 2)
    serialized = caught.value.audit.model_dump_json()
    assert approved.tool_call_id not in serialized
    assert "SENSITIVE" not in serialized


def test_authority_drift_audit_sink_failure_falls_back_without_changing_reason(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    approved = call()
    replacement = TOOL_DESCRIPTORS[approved.tool_name].model_copy(
        update={"risk_level": "replacement"}
    )
    monkeypatch.setattr(tool_executor_module, "tool_descriptor_for", lambda _: replacement)
    authorized_context, capability = authorized(approved, lambda _: raw(approved))

    def failing_sink(_: object) -> None:
        raise RuntimeError("private sink failure")

    with pytest.raises(ToolExecutionError) as caught:
        execute_approved_tool(
            approved, authorized_context, capability, audit_sink=failing_sink
        )
    assert caught.value.code == "tool_descriptor_identity_mismatch"
    assert tool_audit_snapshot() == (caught.value.audit,)


def test_success_and_failure_audits_apply_the_same_execution_budget_transition(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    approved = call()
    invoke(approved, fake_raw(approved))
    success = tool_audit_snapshot()[0]
    clear_tool_audits()
    replacement = TOOL_DESCRIPTORS[approved.tool_name].model_copy(
        update={"risk_level": "replacement"}
    )
    monkeypatch.setattr(tool_executor_module, "tool_descriptor_for", lambda _: replacement)
    authorized_context, capability = authorized(approved, lambda _: raw(approved))
    with pytest.raises(ToolExecutionError) as caught:
        execute_approved_tool(approved, authorized_context, capability)
    failure = caught.value.audit
    for audit in (success, failure):
        assert (audit.max_calls, audit.consumed_calls) == (3, 2)
        assert (audit.max_rounds, audit.consumed_rounds) == (2, 1)
        assert audit.consumed_rows <= audit.max_rows
        assert audit.consumed_bytes <= audit.max_bytes


def test_request_evidence_accepts_new_canonical_ref_from_sealed_protocol_adapter() -> None:
    approved = call(ToolName.REQUEST_EVIDENCE)
    ctx = context(approved).model_copy(update={
        "resolved_approved_inputs": {INPUT: {"title": "brief"}}
    })
    result = invoke(approved, fake_raw(approved, refs=(EVIDENCE,)), ctx)
    assert result.evidence_refs == (EVIDENCE,)


@pytest.mark.parametrize("bad", [{"tool_name": "x"}, object()])
def test_only_approved_model_is_executable(bad: object) -> None:
    hits = 0
    def handler(_: ToolHandlerContext) -> dict[str, object]:
        nonlocal hits
        hits += 1
        return {}
    with pytest.raises(ValueError, match="tool_call_not_issued"):
        approved = context().approved_call
        authorized_context, capability = authorized(approved, handler)
        execute_approved_tool(
            bad, authorized_context, capability,
        )  # type: ignore[arg-type]
    assert hits == 0


def test_unissued_copied_tampered_collision_and_fake_signature_are_effect_free() -> None:
    issued = call()
    shaped = ApprovedToolCall.model_validate(issued.model_dump(mode="python"))
    copied = issued.model_copy(deep=True)
    tampered = call()
    object.__setattr__(tampered, "audit_ref", new_tool_audit_ref())
    fake_signature = ApprovedToolCall.model_validate(issued.model_dump(mode="python"))
    object.__setattr__(fake_signature, "_audit_issuance", (object(), "0" * 64))
    collision = ApprovedToolCall.model_validate(issued.model_dump(mode="python"))
    hits = 0

    def handler(_: ToolHandlerContext) -> dict[str, object]:
        nonlocal hits
        hits += 1
        return {}

    for forged in (shaped, copied, tampered, fake_signature, collision):
        forged_context, capability = authorized(forged, handler)
        with pytest.raises(ValueError, match="tool_call_not_issued"):
            execute_approved_tool(forged, forged_context, capability)

    assert hits == 0
    assert tool_audit_snapshot() == ()


def test_context_and_handler_inventory_fail_before_activity() -> None:
    approved = call()
    other = call(tool_call_id="tc-other")
    hits = 0
    def handler(_: ToolHandlerContext) -> dict[str, object]:
        nonlocal hits
        hits += 1
        return raw(approved)
    authorized_context, capability = authorized(approved, handler)
    with pytest.raises(ToolExecutionError, match="tool_context_mismatch"):
        execute_approved_tool(
            approved,
            context(other, capability.capability_id),
            capability,
        )
    for fake in ({}, {approved.tool_name: binding(approved, handler)}):
        with pytest.raises(ToolExecutionError, match="tool_handler_invalid"):
            execute_approved_tool(approved, authorized_context, fake)  # type: ignore[arg-type]
    assert hits == 0


def test_handler_is_called_once_and_exception_is_redacted(
    caplog: pytest.LogCaptureFixture,
) -> None:
    approved = call()
    hits = 0
    secret = (
        "Bearer sk-secret https://provider.invalid "
        "C:\\private\\x.sql SELECT * FROM users 密钥值"
    )
    def handler(_: ToolHandlerContext) -> dict[str, object]:
        nonlocal hits
        hits += 1
        raise RuntimeError(secret)
    caplog.set_level(logging.INFO)
    with pytest.raises(ToolExecutionError) as caught:
        invoke(approved, handler)
    error = caught.value
    assert error.code == str(error) == "tool_execution_failed"
    assert error.__cause__ is error.__context__ is None
    assert hits == 1
    assert secret not in f"{error!r}{error.audit.model_dump_json()}{caplog.text}"


@pytest.mark.parametrize(
    ("change", "code"),
    [
        ({"result_schema": "wrong.v1"}, "tool_result_schema_invalid"),
        ({"input_refs": ("case:other:decree:decree-1:input:x",)}, "tool_result_reference_invalid"),
        ({"input_refs": ("unknown",)}, "tool_result_reference_invalid"),
        ({"input_refs": (DATA,)}, "tool_result_reference_invalid"),
        ({"data": {"nested": {"token": "secret"}}}, "tool_result_secret_detected"),
        ({"data": {"nested": {"api_token": "secret"}}}, "tool_result_secret_detected"),
        ({"data": {"note": "https://provider.invalid/private"}}, "tool_result_secret_detected"),
        ({"data": {"value": float("nan")}}, "tool_result_schema_invalid"),
        ({"data": {"value": " "}}, "tool_result_schema_invalid"),
    ],
)
def test_result_gate_rejects_invalid_output(
    change: dict[str, object], code: str
) -> None:
    approved = call()
    with pytest.raises(ToolExecutionError, match=code):
        handler = fake_raw(approved, **change)
        invoke(approved, handler)


def test_empty_and_deterministic_record_boundary_truncation() -> None:
    limits = {"estimated_rows": 2, "estimated_bytes": 4096}
    approved = call(arguments=limits, normalized_arguments=limits)
    empty_handler = fake_raw(approved, data={"materials": []})
    empty = invoke(approved, empty_handler)
    assert empty.status is ToolCallStatus.EMPTY and empty.data is None
    clear_tool_audits()
    records = [
        {"ref": INPUT, "summary": f"item {n}", "projection": {"value": n}}
        for n in range(5)
    ]
    bounded_context = context(approved).model_copy(update={
        "budget": ToolBudget(
            max_calls=3, consumed_calls=1, max_rounds=2, consumed_rounds=1,
            max_rows=4, consumed_rows=2, max_bytes=8192, consumed_bytes=128,
        )
    })
    truncated_handler = fake_raw(approved, data={"materials": records})
    truncated = invoke(approved, truncated_handler, bounded_context)
    assert truncated.status is ToolCallStatus.TRUNCATED
    assert truncated.data == {"materials": records[:2]}
    assert truncated.truncated_rows == 3
    assert "result_truncated" in truncated.limitations


def test_forged_system_fields_are_rejected() -> None:
    approved = call()
    with pytest.raises(ToolExecutionError, match="tool_result_schema_invalid"):
        handler = fake_raw(
            approved, status="FAILED", tool_call_id="forged",
            audit_ref="forged", created_at="past",
        )
        invoke(approved, handler)


def test_bounded_thread_safe_default_audit() -> None:
    approved = call()
    def one(index: int) -> str:
        current = _issue_approved_tool_call(approved.model_copy(update={
            "tool_call_id": f"tc-{index}", "audit_ref": new_tool_audit_ref()
        }))
        handler = fake_raw(current)
        result = invoke(current, handler)
        return result.tool_call_id
    with ThreadPoolExecutor(max_workers=4) as pool:
        refs = set(pool.map(one, range(8)))
        assert len(refs) == 8
        assert all(ref.startswith("tool-audit:") for ref in refs)
    assert len(tool_audit_snapshot()) == 8


def test_same_name_arbitrary_callable_and_forged_binding_never_execute() -> None:
    approved = call()
    hits = 0
    def handler(_: ToolHandlerContext) -> dict[str, object]:
        nonlocal hits
        hits += 1
        return raw(approved)
    descriptor = TOOL_DESCRIPTORS[approved.tool_name]
    forged = ToolHandlerBinding(
        handler_id="forged.handler", tool_name=approved.tool_name,
        descriptor_id=descriptor.descriptor_id, handler=handler,
    )
    valid_context = context(approved, "fake-capability")
    for handlers in ({approved.tool_name: handler}, {approved.tool_name: forged}):
        with pytest.raises(ToolExecutionError, match="tool_handler_invalid"):
            execute_approved_tool(approved, valid_context, handlers)  # type: ignore[arg-type]
    assert hits == 0


def test_result_schema_registry_rejects_arbitrary_mapping_and_wrong_kind() -> None:
    approved = call()
    for payload in (
        {"result_schema": approved.expected_result_schema, "data": {"anything": 1}},
        raw(approved, refs=(DATA,)),
    ):
        with pytest.raises(ToolExecutionError, match="tool_result_schema_invalid"):
            handler = fake_result(payload)
            invoke(approved, handler)


def test_schema_registry_rejects_wrong_as_of_type() -> None:
    approved = call()
    with pytest.raises(ToolExecutionError, match="tool_result_schema_invalid"):
        handler = fake_raw(approved, as_of=123)
        invoke(approved, handler)


@pytest.mark.parametrize(
    "key",
    ("password", "secret", "api_key", "auth", "token", "credential",
     "provider_payload", "raw_exception", "path", "sql", "code"),
)
def test_precise_forbidden_nested_keys_reject_nonascii_secret(key: str) -> None:
    approved = call()
    with pytest.raises(ToolExecutionError, match="tool_result_secret_detected"):
        data = {
            "materials": [
                {"ref": INPUT, "summary": "x", "projection": {key: "密钥值"}}
            ]
        }
        handler = fake_raw(approved, data=data)
        invoke(approved, handler)


def test_normal_nonascii_business_text_is_allowed() -> None:
    approved = call()
    data = {
        "materials": [
            {"ref": INPUT, "summary": "财政资料完整", "projection": {}}
        ]
    }
    handler = fake_raw(approved, data=data)
    result = invoke(approved, handler)
    assert result.data == data


def test_algorithm_identity_must_match_approved_fixed_algorithm() -> None:
    approved = call(
        ToolName.COMPUTE_ANALYSIS,
        normalized_arguments={
            "estimated_rows": 2, "estimated_bytes": 4096,
            "algorithm_id": "difference", "algorithm_version": "1.0.0",
        },
    )
    for algorithm_id, version in (("mean", "1.0.0"), ("difference", "2.0.0"), ("eval", "1.0.0")):
        with pytest.raises(ToolExecutionError, match="tool_result_schema_invalid"):
            handler = fake_raw(
                approved, refs=(DATA,), algorithm_id=algorithm_id,
                algorithm_version=version,
                data={
                    "algorithm_id": algorithm_id, "algorithm_version": version,
                    "values": [1], "units": "count",
                },
            )
            invoke(approved, handler)
    payload_mismatch = fake_raw(
        approved, refs=(DATA,), algorithm_id="difference",
        algorithm_version="1.0.0",
        data={
            "algorithm_id": "mean", "algorithm_version": "1.0.0",
            "values": [1], "units": "count",
        },
    )
    with pytest.raises(ToolExecutionError, match="tool_result_schema_invalid"):
        invoke(approved, payload_mismatch)


def test_mapping_and_byte_truncation_keep_whole_boundaries_and_real_budget() -> None:
    limits = {"estimated_rows": 7, "estimated_bytes": 8192}
    approved = call(arguments=limits, normalized_arguments=limits)
    ctx = context(approved).model_copy(update={
        "budget": ToolBudget(
            max_calls=3, consumed_calls=1, max_rounds=2, consumed_rounds=1,
            max_rows=7, consumed_rows=2, max_bytes=260, consumed_bytes=20,
        )
    })
    materials = [
        {"ref": INPUT, "summary": name, "projection": {"text": text}}
        for name, text in (("alpha", "x" * 90), ("beta", "y" * 90), ("gamma", "ok"))
    ]
    handler = fake_raw(approved, data={"materials": materials})
    result = invoke(approved, handler, ctx)
    assert result.status is ToolCallStatus.TRUNCATED
    assert result.data == {"materials": materials[:1]}
    assert result.original_records == 3 and result.returned_records == 1
    audit = tool_audit_snapshot()[-1]
    assert (audit.max_calls, audit.consumed_calls) == (3, 2)
    assert (audit.max_rows, audit.consumed_rows) == (7, 3)
    assert (audit.max_bytes, audit.consumed_bytes) == (260, 20 + audit.result_bytes)


def test_timeout_once_sink_fallback_and_deque_eviction() -> None:
    approved = call()
    hits = 0
    def timeout(_: ToolHandlerContext) -> dict[str, object]:
        nonlocal hits
        hits += 1
        raise TimeoutError("Bearer sk-timeout")
    with pytest.raises(ToolExecutionError, match="tool_execution_failed"):
        invoke(
            approved, timeout,
            audit_sink=lambda _: (_ for _ in ()).throw(RuntimeError("sink")),
        )
    assert hits == 1 and len(tool_audit_snapshot()) == 1
    clear_tool_audits()
    for index in range(4100):
        current = _issue_approved_tool_call(approved.model_copy(update={
            "tool_call_id": f"evict-{index}", "audit_ref": new_tool_audit_ref()
        }))
        handler = fake_raw(current)
        invoke(current, handler)
    snapshot = tool_audit_snapshot()
    assert len(snapshot) == 4096
    assert snapshot[0].tool_call_id == snapshot[0].audit_ref


def test_capability_provenance_rejects_public_id_copies_before_handler() -> None:
    approved = call()
    hits = 0
    def expected(_: ToolHandlerContext) -> dict[str, object]:
        nonlocal hits
        hits += 1
        return raw(approved)
    descriptor = TOOL_DESCRIPTORS[approved.tool_name]
    copied = ToolHandlerBinding(
        handler_id=descriptor.handler_id, tool_name=approved.tool_name,
        descriptor_id=descriptor.descriptor_id, handler=lambda _: raw(approved),
    )
    assert not hasattr(tool_executor_module, "authorize_tool_handlers")
    with pytest.raises(TypeError):
        AuthorizedToolHandlerSet("copied-id", (copied,), "copied-signature")
    assert hits == 0


def test_capability_signing_api_is_internal_and_package_does_not_export_it() -> None:
    for name in (
        "ToolHandlerBinding", "AuthorizedToolHandlerSet", "authorize_tool_handlers"
    ):
        assert name not in runtime_skills_package.__all__
        assert not hasattr(runtime_skills_package, name)
    assert not hasattr(tool_executor_module, "authorize_tool_handlers")
    with pytest.raises(ImportError):
        exec(
            "from app.agents.runtime_skills import authorize_tool_handlers",
            {},
        )


def test_authorized_capability_is_frozen_and_tamper_evident() -> None:
    approved = call()
    hits = 0
    def handler(_: ToolHandlerContext) -> dict[str, object]:
        nonlocal hits
        hits += 1
        return raw(approved)
    ctx, capability = authorized(approved, handler)
    with pytest.raises((AttributeError, TypeError)):
        capability._bindings[approved.tool_name] = binding(approved, handler)  # type: ignore[index]
    with pytest.raises((AttributeError, TypeError)):
        capability._capability_id = "copied"  # type: ignore[misc]
    object.__setattr__(capability, "_signature", "tampered")
    with pytest.raises(ToolExecutionError, match="tool_handler_invalid"):
        execute_approved_tool(approved, ctx, capability)
    assert hits == 0


def test_replaced_callable_and_fake_capability_fail_before_activity() -> None:
    approved = call()
    hits = 0
    def expected(_: ToolHandlerContext) -> dict[str, object]:
        nonlocal hits
        hits += 1
        return raw(approved)
    ctx, capability = authorized(approved, expected)
    evil_binding = binding(approved, lambda _: raw(approved))
    object.__setattr__(capability, "_bindings", (evil_binding,))
    with pytest.raises(ToolExecutionError, match="tool_handler_invalid"):
        execute_approved_tool(approved, ctx, capability)
    fake = object()
    with pytest.raises(ToolExecutionError, match="tool_handler_invalid"):
        execute_approved_tool(approved, ctx, fake)  # type: ignore[arg-type]
    assert hits == 0


@pytest.mark.parametrize("tool", tuple(ToolName))
def test_real_payload_schema_rejects_nonsense_extra_and_wrong_types(tool: ToolName) -> None:
    approved = call(tool)
    invalid_data = {
        ToolName.REQUEST_EVIDENCE: {
            "facts": [{"ref": EVIDENCE, "summary": 1, "as_of": "x"}]
        },
        ToolName.READ_APPROVED_MATERIALS: {
            "materials": [{
                "ref": INPUT, "summary": "x", "projection": {}, "extra": 1,
            }]
        },
        ToolName.INSPECT_APPROVED_DATA: {
            "operation": "compare", "columns": ["value"],
            "rows": [{"other": 1}],
        },
        ToolName.COMPUTE_ANALYSIS: {
            "algorithm_id": "difference", "algorithm_version": "1.0.0",
            "values": "nonsense", "units": "count",
        },
    }[tool]
    handler = fake_raw(approved, data=invalid_data)
    with pytest.raises(ToolExecutionError, match="tool_result_schema_invalid"):
        invoke(approved, handler)


@pytest.mark.parametrize(
    "malformed",
    (
        "input:case:case-1:decree:decree-1:brief:suffix",
        "input:case:case-1:case:case-1:decree:decree-1:brief",
        "prefix-input:case:case-1:decree:decree-1:brief",
        "input:case:xcase-1x:decree:decree-1:brief",
    ),
)
def test_exact_ref_parser_rejects_malformed_approved_strings(malformed: str) -> None:
    approved = call()
    ctx = context(approved).model_copy(update={
        "resolved_approved_inputs": {**context(approved).resolved_approved_inputs, malformed: {}},
    })
    handler = fake_raw(approved, input_refs=(malformed,))
    with pytest.raises(ToolExecutionError, match="tool_result_reference_invalid"):
        invoke(approved, handler, ctx)
