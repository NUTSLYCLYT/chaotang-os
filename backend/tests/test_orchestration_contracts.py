from __future__ import annotations

import ast
from pathlib import Path
from typing import get_type_hints

import pytest
from pydantic import ValidationError

from app.orchestration import (
    EngineKind,
    ExecutionCheckpoint,
    ExecutionEvent,
    ExecutionEventKind,
    ExecutionFailure,
    ExecutionIdentity,
    ExecutionPlan,
    ExecutionReplayGuard,
    ExecutionResult,
    ExecutionResumeGuard,
    ExecutionStep,
    ExecutionTerminalState,
    ExecutionTrace,
    FailureDisposition,
    OrchestrationEngine,
    OrchestrationRequest,
    ProviderBudget,
    ResumeRequest,
    RouteType,
    archive_idempotency_key,
    decree_input_digest,
)

_DECREE_TEXT = "请户部核验预算并形成可复盘回奏。"
_DIGEST_A = decree_input_digest(_DECREE_TEXT)
_DIGEST_B = "sha256:" + "b" * 64


def _identity(owner: str = "owner-a") -> ExecutionIdentity:
    return ExecutionIdentity(owner_user_id=owner, run_id="run-001", decree_id="decree-001")


def _archive_key(owner: str = "owner-a", reply_ref: str = "reply-001") -> str:
    return archive_idempotency_key(_identity(owner), reply_ref)


def _request() -> OrchestrationRequest:
    return OrchestrationRequest(
        identity=_identity(),
        decree_text=_DECREE_TEXT,
        input_digest=_DIGEST_A,
        resource_manifest_digest=_DIGEST_B,
        provider_budget=ProviderBudget(
            max_calls=6,
            max_tokens=12_000,
            timeout_ms=60_000,
        ),
    )


def _plan() -> ExecutionPlan:
    return ExecutionPlan(
        identity=_identity(),
        engine_kind=EngineKind.DIRECT,
        engine_version="1.0.0",
        input_digest=_DIGEST_A,
        resource_manifest_digest=_DIGEST_B,
        route_type=RouteType.SINGLE,
        departments=("户部",),
        steps=(
            ExecutionStep(step_id="route"),
            ExecutionStep(step_id="ministry", department="户部"),
            ExecutionStep(step_id="finalize"),
            ExecutionStep(step_id="archive"),
        ),
    )


def _failure(owner: str = "owner-a") -> ExecutionFailure:
    return ExecutionFailure(
        identity=_identity(owner),
        engine_kind=EngineKind.DIRECT,
        engine_version="1.0.0",
        stage="ministry",
        code="EVIDENCE_INSUFFICIENT",
        disposition=FailureDisposition.TERMINAL,
        retryable=False,
        attempt=1,
    )


def _success_result(**updates: object) -> ExecutionResult:
    values: dict[str, object] = {
        "identity": _identity(),
        "engine_kind": EngineKind.DIRECT,
        "engine_version": "1.0.0",
        "terminal_state": ExecutionTerminalState.SUCCEEDED,
        "route_type": RouteType.SINGLE,
        "departments": ("户部",),
        "processing_path": ("route", "ministry", "finalize", "archive"),
        "final_verdict": "已完成预算核验。",
        "recommendations": ("复核来源", "人工确认", "归档复盘"),
        "evidence_refs": ("evidence-001",),
        "work_product_refs": ("work-product-001",),
        "reply_refs": ("reply-001",),
        "side_effect_keys": (_archive_key(),),
    }
    values.update(updates)
    return ExecutionResult(**values)


def test_request_contract_is_frozen_closed_and_digest_bound() -> None:
    request = _request()

    with pytest.raises(ValidationError):
        request.model_copy(update={"unknown": "field"}).model_validate(
            {**request.model_dump(), "unknown": "field"}
        )
    with pytest.raises(ValidationError):
        OrchestrationRequest(
            identity=ExecutionIdentity(owner_user_id=" ", run_id="run-001", decree_id="decree-001"),
            decree_text="test",
            input_digest=_DIGEST_A,
            resource_manifest_digest=_DIGEST_B,
            provider_budget=ProviderBudget(
                max_calls=0,
                max_tokens=0,
                timeout_ms=1,
            ),
        )
    with pytest.raises(ValidationError):
        OrchestrationRequest(
            identity=_identity(),
            decree_text="test",
            input_digest="not-a-digest",
            resource_manifest_digest=_DIGEST_B,
            provider_budget=ProviderBudget(
                max_calls=0,
                max_tokens=0,
                timeout_ms=1,
            ),
        )
    with pytest.raises(ValidationError):
        request.decree_text = "mutated"  # type: ignore[misc]
    with pytest.raises(ValidationError, match="input_digest_must_bind_decree_text"):
        request.model_copy(update={"decree_text": "tampered decree"})


@pytest.mark.parametrize(
    ("field", "invalid_value"),
    [
        ("identity", _identity().model_dump()),
        ("engine_kind", "DIRECT"),
        ("departments", ["户部"]),
        ("steps", list(_plan().steps)),
    ],
)
def test_python_contract_input_rejects_implicit_coercion(field: str, invalid_value: object) -> None:
    plan = _plan()
    values = {name: getattr(plan, name) for name in type(plan).model_fields}
    values[field] = invalid_value

    with pytest.raises(ValidationError):
        ExecutionPlan.model_validate(values)


def test_identity_rejects_bytes_and_json_round_trip_remains_supported() -> None:
    with pytest.raises(ValidationError):
        ExecutionIdentity(
            owner_user_id=b"owner-a",  # type: ignore[arg-type]
            run_id="run-001",
            decree_id="decree-001",
        )

    plan = _plan()
    assert ExecutionPlan.model_validate_json(plan.model_dump_json()) == plan
    assert plan.model_copy(update={"engine_version": "1.0.1"}).engine_version == "1.0.1"


@pytest.mark.parametrize("invalid_value", [True, "1", -1])
def test_provider_budget_is_strict_and_safe_copy_revalidates(
    invalid_value: object,
) -> None:
    with pytest.raises(ValidationError):
        ProviderBudget(
            max_calls=invalid_value,  # type: ignore[arg-type]
            max_tokens=12_000,
            timeout_ms=60_000,
        )

    with pytest.raises(ValidationError):
        _request().model_copy(
            update={
                "provider_budget": {
                    "max_calls": invalid_value,
                    "max_tokens": 12_000,
                    "timeout_ms": 60_000,
                }
            }
        )


@pytest.mark.parametrize(
    ("route_type", "departments"),
    [
        (RouteType.SINGLE, ("户部", "工部")),
        (RouteType.MULTI, ("户部",)),
        (RouteType.MULTI, ("户部", "户部")),
    ],
)
def test_plan_rejects_invalid_or_duplicate_routes(
    route_type: RouteType, departments: tuple[str, ...]
) -> None:
    with pytest.raises(ValidationError):
        ExecutionPlan(
            identity=_identity(),
            engine_kind=EngineKind.DIRECT,
            engine_version="1.0.0",
            input_digest=_DIGEST_A,
            resource_manifest_digest=_DIGEST_B,
            route_type=route_type,
            departments=departments,
            steps=(ExecutionStep(step_id="route"), ExecutionStep(step_id="finalize")),
        )


def test_route_departments_are_normalized_before_comparison() -> None:
    plan = ExecutionPlan(
        identity=_identity(),
        engine_kind=EngineKind.DIRECT,
        engine_version="1.0.0",
        input_digest=_DIGEST_A,
        resource_manifest_digest=_DIGEST_B,
        route_type=RouteType.SINGLE,
        departments=(" 户部 ",),
        steps=(
            ExecutionStep(step_id="route"),
            ExecutionStep(step_id="ministry", department=" 户部 "),
            ExecutionStep(step_id="finalize"),
        ),
    )

    assert plan.departments == ("户部",)
    with pytest.raises(ValidationError):
        ExecutionPlan(
            identity=_identity(),
            engine_kind=EngineKind.DIRECT,
            engine_version="1.0.0",
            input_digest=_DIGEST_A,
            resource_manifest_digest=_DIGEST_B,
            route_type=RouteType.MULTI,
            departments=("户部", " 户部 "),
            steps=(
                ExecutionStep(step_id="route"),
                ExecutionStep(step_id="ministry", department="户部"),
                ExecutionStep(step_id="duplicate", department=" 户部 "),
                ExecutionStep(step_id="finalize"),
            ),
        )


def test_multi_plan_binds_each_department_to_one_serial_step_in_approved_order() -> None:
    valid_steps = (
        ExecutionStep(step_id="route"),
        ExecutionStep(step_id="hubu", department="户部"),
        ExecutionStep(step_id="gongbu", department="工部"),
        ExecutionStep(step_id="finalize"),
    )
    plan = ExecutionPlan(
        identity=_identity(),
        engine_kind=EngineKind.DIRECT,
        engine_version="1.0.0",
        input_digest=_DIGEST_A,
        resource_manifest_digest=_DIGEST_B,
        route_type=RouteType.MULTI,
        departments=("户部", "工部"),
        steps=valid_steps,
    )

    assert tuple(step.department for step in plan.steps if step.department) == (
        "户部",
        "工部",
    )
    with pytest.raises(ValidationError, match="department_steps_must_match_route_order"):
        plan.model_copy(
            update={
                "steps": (
                    valid_steps[0],
                    valid_steps[2],
                    valid_steps[1],
                    valid_steps[3],
                )
            }
        )
    with pytest.raises(ValidationError, match="department_steps_must_match_route_order"):
        plan.model_copy(
            update={
                "steps": (
                    ExecutionStep(step_id="route"),
                    ExecutionStep(step_id="ministry-pool"),
                    ExecutionStep(step_id="finalize"),
                )
            }
        )


def test_success_result_requires_one_reply_and_three_unique_recommendations() -> None:
    valid = dict(
        identity=_identity(),
        engine_kind=EngineKind.DIRECT,
        engine_version="1.0.0",
        terminal_state=ExecutionTerminalState.SUCCEEDED,
        route_type=RouteType.SINGLE,
        departments=("户部",),
        processing_path=("上书房", "丞相（首次分流）", "户部", "丞相（最终汇总）"),
        final_verdict="已完成预算核验。",
        recommendations=("复核来源", "人工确认", "归档复盘"),
        evidence_refs=("evidence-001",),
        work_product_refs=("work-product-001",),
        reply_refs=("reply-001",),
        side_effect_keys=(_archive_key(),),
    )

    result = ExecutionResult(**valid)
    assert result.reply_refs == ("reply-001",)

    with pytest.raises(ValidationError):
        ExecutionResult(**{**valid, "reply_refs": ()})
    with pytest.raises(ValidationError):
        ExecutionResult(**{**valid, "reply_refs": ("reply-001", "reply-002")})
    with pytest.raises(ValidationError):
        ExecutionResult(**{**valid, "side_effect_keys": ()})
    with pytest.raises(ValidationError, match="archive_side_effect_key_must_bind_identity"):
        ExecutionResult(**{**valid, "side_effect_keys": (_archive_key("owner-b"),)})
    with pytest.raises(ValidationError):
        ExecutionResult(**{**valid, "recommendations": ("复核来源",) * 3})
    with pytest.raises(ValidationError):
        ExecutionResult(**{**valid, "evidence_refs": ("evidence-001", "evidence-001")})
    with pytest.raises(ValidationError):
        ExecutionResult(**{**valid, "evidence_refs": ()})


def test_failed_result_rejects_cross_owner_and_any_reply_side_effect() -> None:
    failed = dict(
        identity=_identity(),
        engine_kind=EngineKind.DIRECT,
        engine_version="1.0.0",
        terminal_state=ExecutionTerminalState.FAILED,
        route_type=RouteType.SINGLE,
        departments=("户部",),
        processing_path=("上书房", "丞相（首次分流）", "户部"),
        final_verdict=None,
        recommendations=(),
        evidence_refs=(),
        work_product_refs=(),
        reply_refs=(),
        failure=_failure(),
    )

    assert ExecutionResult(**failed).terminal_state is ExecutionTerminalState.FAILED
    with pytest.raises(ValidationError):
        ExecutionResult(**{**failed, "reply_refs": ("reply-forbidden",)})
    with pytest.raises(ValidationError):
        ExecutionResult(**{**failed, "work_product_refs": ("work-product-forbidden",)})
    with pytest.raises(ValidationError):
        ExecutionResult(**{**failed, "failure": _failure("owner-b")})
    with pytest.raises(ValidationError):
        ExecutionResult(
            **{
                **failed,
                "failure": ExecutionFailure(
                    identity=_identity(),
                    engine_kind=EngineKind.DIRECT,
                    engine_version="1.0.0",
                    stage="ministry",
                    code="TRANSIENT_PROVIDER_FAILURE",
                    disposition=FailureDisposition.RETRY,
                    retryable=True,
                    attempt=1,
                ),
            }
        )


def test_degraded_result_records_a_bound_degrade_reason() -> None:
    failure = ExecutionFailure(
        identity=_identity(),
        engine_kind=EngineKind.DIRECT,
        engine_version="1.0.0",
        stage="evidence-gate",
        code="PARTIAL_EVIDENCE",
        disposition=FailureDisposition.DEGRADE,
        retryable=False,
        attempt=1,
    )

    result = _success_result(
        terminal_state=ExecutionTerminalState.DEGRADED,
        failure=failure,
    )
    assert result.failure == failure
    with pytest.raises(ValidationError):
        _success_result(terminal_state=ExecutionTerminalState.DEGRADED, failure=_failure())


def test_event_checkpoint_and_failure_are_engine_and_identity_bound() -> None:
    event = ExecutionEvent(
        identity=_identity(),
        engine_kind=EngineKind.LANGGRAPH,
        engine_version="1.0.0",
        sequence=1,
        kind=ExecutionEventKind.CHECKPOINTED,
        step_id="route",
        checkpoint_ref="checkpoint-001",
        evidence_refs=(),
    )
    checkpoint = ExecutionCheckpoint(
        identity=_identity(),
        engine_kind=EngineKind.LANGGRAPH,
        engine_version="1.0.0",
        checkpoint_id="checkpoint-001",
        sequence=1,
        next_step_id="ministry",
        engine_state_ref="opaque-state-001",
        input_digest=_DIGEST_A,
        resource_manifest_digest=_DIGEST_B,
    )

    assert event.checkpoint_ref == "checkpoint-001"
    assert checkpoint.engine_state_ref == "opaque-state-001"
    with pytest.raises(ValidationError):
        ExecutionEvent(
            identity=_identity(),
            engine_kind=EngineKind.LANGGRAPH,
            engine_version="1.0.0",
            sequence=1,
            kind=ExecutionEventKind.CHECKPOINTED,
            step_id="route",
            checkpoint_ref=None,
            evidence_refs=(),
        )


@pytest.mark.parametrize("invalid_value", [True, "1", 1.0])
def test_event_checkpoint_and_failure_counters_require_strict_integers(
    invalid_value: object,
) -> None:
    with pytest.raises(ValidationError):
        ExecutionEvent(
            identity=_identity(),
            engine_kind=EngineKind.DIRECT,
            engine_version="1.0.0",
            sequence=invalid_value,  # type: ignore[arg-type]
            kind=ExecutionEventKind.PLAN_CREATED,
            step_id="route",
        )
    with pytest.raises(ValidationError):
        ExecutionCheckpoint(
            identity=_identity(),
            engine_kind=EngineKind.DIRECT,
            engine_version="1.0.0",
            checkpoint_id="checkpoint-001",
            sequence=invalid_value,  # type: ignore[arg-type]
            next_step_id="ministry",
            engine_state_ref="opaque-state-001",
            input_digest=_DIGEST_A,
            resource_manifest_digest=_DIGEST_B,
        )
    with pytest.raises(ValidationError):
        ExecutionFailure(
            identity=_identity(),
            engine_kind=EngineKind.DIRECT,
            engine_version="1.0.0",
            stage="ministry",
            code="EVIDENCE_INSUFFICIENT",
            disposition=FailureDisposition.TERMINAL,
            retryable=False,
            attempt=invalid_value,  # type: ignore[arg-type]
        )


@pytest.mark.parametrize("invalid_value", [1, "true", "1"])
def test_failure_retryable_requires_a_strict_boolean(invalid_value: object) -> None:
    with pytest.raises(ValidationError):
        ExecutionFailure(
            identity=_identity(),
            engine_kind=EngineKind.DIRECT,
            engine_version="1.0.0",
            stage="ministry",
            code="TRANSIENT_PROVIDER_FAILURE",
            disposition=FailureDisposition.RETRY,
            retryable=invalid_value,  # type: ignore[arg-type]
            attempt=1,
        )


def test_trace_rejects_plan_resource_digest_tampering() -> None:
    with pytest.raises(ValidationError, match="plan_input_binding_mismatch"):
        ExecutionTrace(
            request=_request(),
            plan=_plan().model_copy(update={"resource_manifest_digest": "sha256:" + "c" * 64}),
        )


def test_resume_trace_and_replay_close_cross_object_invariants() -> None:
    request = _request()
    plan = _plan()
    checkpoint = ExecutionCheckpoint(
        identity=_identity(),
        engine_kind=EngineKind.DIRECT,
        engine_version="1.0.0",
        checkpoint_id="checkpoint-001",
        sequence=2,
        next_step_id="ministry",
        engine_state_ref="opaque-state-001",
        input_digest=_DIGEST_A,
        resource_manifest_digest=_DIGEST_B,
    )
    events = (
        ExecutionEvent(
            identity=_identity(),
            engine_kind=EngineKind.DIRECT,
            engine_version="1.0.0",
            sequence=1,
            kind=ExecutionEventKind.PLAN_CREATED,
            step_id="route",
        ),
        ExecutionEvent(
            identity=_identity(),
            engine_kind=EngineKind.DIRECT,
            engine_version="1.0.0",
            sequence=2,
            kind=ExecutionEventKind.CHECKPOINTED,
            step_id="route",
            checkpoint_ref="checkpoint-001",
        ),
    )

    resume = ResumeRequest(
        caller_owner_user_id="owner-a",
        expected_engine_kind=EngineKind.DIRECT,
        expected_engine_version="1.0.0",
        request=request,
        checkpoint=checkpoint,
    )
    assert resume.checkpoint.checkpoint_id == "checkpoint-001"
    with pytest.raises(ValidationError):
        ResumeRequest(
            caller_owner_user_id="owner-b",
            expected_engine_kind=EngineKind.DIRECT,
            expected_engine_version="1.0.0",
            request=request,
            checkpoint=checkpoint,
        )
    with pytest.raises(ValidationError):
        ResumeRequest(
            caller_owner_user_id="owner-a",
            expected_engine_kind=EngineKind.LANGGRAPH,
            expected_engine_version="1.0.0",
            request=request,
            checkpoint=checkpoint,
        )

    trace = ExecutionTrace(
        request=request,
        plan=plan,
        events=events,
        checkpoints=(checkpoint,),
    )
    assert trace.events[-1].sequence == checkpoint.sequence
    with pytest.raises(ValidationError):
        ExecutionTrace(
            request=request,
            plan=plan,
            events=(
                events[0],
                ExecutionEvent(
                    identity=_identity(),
                    engine_kind=EngineKind.DIRECT,
                    engine_version="1.0.0",
                    sequence=2,
                    kind=ExecutionEventKind.STEP_STARTED,
                    step_id="archive",
                ),
            ),
        )
    with pytest.raises(ValidationError):
        ExecutionTrace(
            request=request,
            plan=plan,
            events=(events[1], events[0]),
            checkpoints=(checkpoint,),
        )
    duplicate_checkpoint_events = (
        events[0].model_copy(
            update={
                "kind": ExecutionEventKind.CHECKPOINTED,
                "checkpoint_ref": "checkpoint-001",
            }
        ),
        events[1],
    )
    with pytest.raises(ValidationError):
        ExecutionTrace(
            request=request,
            plan=plan,
            events=duplicate_checkpoint_events,
            checkpoints=(checkpoint,),
        )

    success = _success_result()
    with pytest.raises(ValidationError):
        ExecutionTrace(request=request, plan=plan, result=success)
    terminal_events_list = [
        ExecutionEvent(
            identity=_identity(),
            engine_kind=EngineKind.DIRECT,
            engine_version="1.0.0",
            sequence=1,
            kind=ExecutionEventKind.PLAN_CREATED,
            step_id="route",
        )
    ]
    for step in plan.steps:
        step_id = step.step_id
        terminal_events_list.extend(
            (
                ExecutionEvent(
                    identity=_identity(),
                    engine_kind=EngineKind.DIRECT,
                    engine_version="1.0.0",
                    sequence=len(terminal_events_list) + 1,
                    kind=ExecutionEventKind.STEP_STARTED,
                    step_id=step_id,
                ),
                ExecutionEvent(
                    identity=_identity(),
                    engine_kind=EngineKind.DIRECT,
                    engine_version="1.0.0",
                    sequence=len(terminal_events_list) + 2,
                    kind=ExecutionEventKind.STEP_COMPLETED,
                    step_id=step_id,
                ),
            )
        )
    terminal_events_list.extend(
        (
            ExecutionEvent(
                identity=_identity(),
                engine_kind=EngineKind.DIRECT,
                engine_version="1.0.0",
                sequence=len(terminal_events_list) + 1,
                kind=ExecutionEventKind.EVIDENCE_ADOPTED,
                step_id="archive",
                evidence_refs=("evidence-001",),
            ),
            ExecutionEvent(
                identity=_identity(),
                engine_kind=EngineKind.DIRECT,
                engine_version="1.0.0",
                sequence=len(terminal_events_list) + 2,
                kind=ExecutionEventKind.RESULT_READY,
                step_id="archive",
            ),
            ExecutionEvent(
                identity=_identity(),
                engine_kind=EngineKind.DIRECT,
                engine_version="1.0.0",
                sequence=len(terminal_events_list) + 3,
                kind=ExecutionEventKind.REPLY_ARCHIVED,
                step_id="archive",
                reply_ref="reply-001",
                idempotency_key=_archive_key(),
            ),
        )
    )
    terminal_events = tuple(terminal_events_list)
    assert (
        ExecutionTrace(request=request, plan=plan, events=terminal_events, result=success).result
        == success
    )
    with pytest.raises(ValidationError, match="archive_event_step_must_match_result_ready_step"):
        ExecutionTrace(
            request=request,
            plan=plan,
            events=(
                *terminal_events[:-1],
                terminal_events[-1].model_copy(update={"step_id": "finalize"}),
            ),
            result=success,
        )
    with pytest.raises(ValidationError, match="usable_result_requires_adopted_evidence"):
        ExecutionTrace(
            request=request,
            plan=plan,
            events=tuple(
                event.model_copy(update={"sequence": event.sequence - 1})
                if event.sequence > terminal_events[-3].sequence
                else event
                for event in terminal_events
                if event.kind is not ExecutionEventKind.EVIDENCE_ADOPTED
            ),
            result=success,
        )
    with pytest.raises(ValidationError, match="result_evidence_must_match_adopted_evidence"):
        ExecutionTrace(
            request=request,
            plan=plan,
            events=tuple(
                event.model_copy(update={"evidence_refs": ("evidence-forged",)})
                if event.kind is ExecutionEventKind.EVIDENCE_ADOPTED
                else event
                for event in terminal_events
            ),
            result=success,
        )
    with pytest.raises(ValidationError):
        ExecutionTrace(
            request=request,
            plan=plan,
            events=(
                *terminal_events[:-1],
                terminal_events[-1].model_copy(update={"reply_ref": "reply-002"}),
            ),
            result=success,
        )
    with pytest.raises(ValidationError):
        ExecutionTrace(
            request=request,
            plan=plan,
            events=(
                *terminal_events[:-1],
                terminal_events[-1].model_copy(
                    update={"idempotency_key": _archive_key(reply_ref="reply-duplicate")}
                ),
            ),
            result=success,
        )

    with pytest.raises(ValidationError):
        ExecutionTrace(
            request=request,
            plan=plan,
            events=terminal_events[1:],
            result=success,
        )
    with pytest.raises(ValidationError):
        ExecutionTrace(
            request=request,
            plan=plan,
            events=(
                terminal_events[0],
                terminal_events[-2].model_copy(update={"step_id": "invented"}),
                terminal_events[-1].model_copy(update={"sequence": 3}),
            ),
            result=success,
        )

    failed = ExecutionResult(
        identity=_identity(),
        engine_kind=EngineKind.DIRECT,
        engine_version="1.0.0",
        terminal_state=ExecutionTerminalState.FAILED,
        route_type=RouteType.SINGLE,
        departments=("户部",),
        processing_path=("route",),
        failure=_failure(),
    )
    failed_events = (
        terminal_events[0],
        terminal_events[1],
        terminal_events[2],
        ExecutionEvent(
            identity=_identity(),
            engine_kind=EngineKind.DIRECT,
            engine_version="1.0.0",
            sequence=4,
            kind=ExecutionEventKind.FAILURE_CLASSIFIED,
            step_id="ministry",
            failure_code="EVIDENCE_INSUFFICIENT",
        ),
        terminal_events[-2].model_copy(update={"sequence": 5, "step_id": "ministry"}),
    )
    assert (
        ExecutionTrace(
            request=request,
            plan=plan,
            events=failed_events,
            result=failed,
        ).result
        == failed
    )
    with pytest.raises(ValidationError):
        ExecutionTrace(
            request=request,
            plan=plan,
            events=(
                terminal_events[0],
                terminal_events[-2].model_copy(update={"sequence": 2, "step_id": "ministry"}),
            ),
            result=failed,
        )

    prior = _success_result()
    assert ExecutionReplayGuard(prior_result=prior, replayed_result=prior).result == prior
    with pytest.raises(ValidationError):
        ExecutionReplayGuard(
            prior_result=prior,
            replayed_result=_success_result(reply_refs=("reply-002",)),
        )
    with pytest.raises(ValidationError):
        ExecutionReplayGuard(
            prior_result=prior,
            replayed_result=_success_result(
                side_effect_keys=(_archive_key(reply_ref="reply-duplicate"),)
            ),
        )
    with pytest.raises(ValidationError):
        ExecutionFailure(
            identity=_identity(),
            engine_kind=EngineKind.DIRECT,
            engine_version="1.0.0",
            stage="route",
            code="TRANSIENT_PROVIDER_FAILURE",
            disposition=FailureDisposition.RETRY,
            retryable=False,
            attempt=1,
        )


def test_resume_guard_binds_trace_to_checkpoint_and_next_step() -> None:
    request = _request()
    plan = _plan()
    checkpoint = ExecutionCheckpoint(
        identity=_identity(),
        engine_kind=EngineKind.DIRECT,
        engine_version="1.0.0",
        checkpoint_id="checkpoint-001",
        sequence=4,
        next_step_id="ministry",
        engine_state_ref="opaque-state-001",
        input_digest=_DIGEST_A,
        resource_manifest_digest=_DIGEST_B,
    )
    resume = ResumeRequest(
        caller_owner_user_id="owner-a",
        expected_engine_kind=EngineKind.DIRECT,
        expected_engine_version="1.0.0",
        request=request,
        checkpoint=checkpoint,
    )
    events = (
        ExecutionEvent(
            identity=_identity(),
            engine_kind=EngineKind.DIRECT,
            engine_version="1.0.0",
            sequence=1,
            kind=ExecutionEventKind.PLAN_CREATED,
            step_id="route",
        ),
        ExecutionEvent(
            identity=_identity(),
            engine_kind=EngineKind.DIRECT,
            engine_version="1.0.0",
            sequence=2,
            kind=ExecutionEventKind.STEP_STARTED,
            step_id="route",
        ),
        ExecutionEvent(
            identity=_identity(),
            engine_kind=EngineKind.DIRECT,
            engine_version="1.0.0",
            sequence=3,
            kind=ExecutionEventKind.STEP_COMPLETED,
            step_id="route",
        ),
        ExecutionEvent(
            identity=_identity(),
            engine_kind=EngineKind.DIRECT,
            engine_version="1.0.0",
            sequence=4,
            kind=ExecutionEventKind.CHECKPOINTED,
            step_id="route",
            checkpoint_ref="checkpoint-001",
        ),
        ExecutionEvent(
            identity=_identity(),
            engine_kind=EngineKind.DIRECT,
            engine_version="1.0.0",
            sequence=5,
            kind=ExecutionEventKind.STEP_STARTED,
            step_id="ministry",
        ),
    )
    trace = ExecutionTrace(
        request=request,
        plan=plan,
        events=events,
        checkpoints=(checkpoint,),
        resume_checkpoint_id="checkpoint-001",
    )

    assert ExecutionResumeGuard(resume_request=resume, resumed_trace=trace).trace == trace
    wrong_checkpoint = checkpoint.model_copy(update={"next_step_id": "route"})
    with pytest.raises(ValidationError, match="resume_trace_must_continue_at_next_step"):
        trace.model_copy(update={"checkpoints": (wrong_checkpoint,)})


def test_engine_protocol_is_runtime_checkable_and_framework_neutral() -> None:
    class FakeEngine:
        kind = EngineKind.DIRECT
        version = "1.0.0"

        def plan(self, request: OrchestrationRequest) -> ExecutionPlan:
            return _plan()

        def execute(
            self,
            request: OrchestrationRequest,
            plan: ExecutionPlan,
        ) -> ExecutionTrace:
            return ExecutionTrace(request=request, plan=plan)

        def resume(self, request: ResumeRequest) -> ExecutionResumeGuard:
            raise NotImplementedError

    assert isinstance(FakeEngine(), OrchestrationEngine)
    assert get_type_hints(OrchestrationEngine.execute) == {
        "request": OrchestrationRequest,
        "plan": ExecutionPlan,
        "return": ExecutionTrace,
    }
    assert get_type_hints(OrchestrationEngine.resume) == {
        "request": ResumeRequest,
        "return": ExecutionResumeGuard,
    }
    package_root = Path(__file__).parents[1] / "app" / "orchestration"
    imported_modules: set[str] = set()
    for path in sorted(package_root.glob("*.py")):
        tree = ast.parse(path.read_text("utf-8"), filename=str(path))
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imported_modules.update(alias.name for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module is not None:
                imported_modules.add(node.module)
    assert not any(
        module == "langgraph"
        or module.startswith("langgraph.")
        or module == "app.langgraph_runtime"
        or module.startswith("app.langgraph_runtime.")
        for module in imported_modules
    )


def test_existing_runtime_does_not_wire_the_comparison_contract_package() -> None:
    app_root = Path(__file__).parents[1] / "app"
    unexpected_imports: list[str] = []

    for path in sorted(app_root.rglob("*.py")):
        if path.parent == app_root / "orchestration":
            continue
        tree = ast.parse(path.read_text("utf-8"), filename=str(path))
        for node in ast.walk(tree):
            modules: tuple[str, ...] = ()
            if isinstance(node, ast.Import):
                modules = tuple(alias.name for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module is not None:
                modules = (node.module,)
            if any(
                module == "app.orchestration" or module.startswith("app.orchestration.")
                for module in modules
            ):
                unexpected_imports.append(str(path.relative_to(app_root.parent)))

    assert unexpected_imports == []
