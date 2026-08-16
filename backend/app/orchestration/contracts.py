from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Mapping
from enum import StrEnum
from typing import Any, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

_DIGEST_PATTERN = re.compile(r"^sha256:[0-9a-f]{64}$")
_SEMANTIC_VERSION = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")
_FAILURE_CODE = re.compile(r"^[A-Z][A-Z0-9_]{2,127}$")


class EngineKind(StrEnum):
    DIRECT = "DIRECT"
    LANGGRAPH = "LANGGRAPH"


class RouteType(StrEnum):
    SINGLE = "single"
    MULTI = "multi"


class ExecutionTerminalState(StrEnum):
    SUCCEEDED = "SUCCEEDED"
    DEGRADED = "DEGRADED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class ExecutionEventKind(StrEnum):
    PLAN_CREATED = "PLAN_CREATED"
    STEP_STARTED = "STEP_STARTED"
    STEP_COMPLETED = "STEP_COMPLETED"
    CHECKPOINTED = "CHECKPOINTED"
    FAILURE_CLASSIFIED = "FAILURE_CLASSIFIED"
    EVIDENCE_ADOPTED = "EVIDENCE_ADOPTED"
    RESULT_READY = "RESULT_READY"
    REPLY_ARCHIVED = "REPLY_ARCHIVED"


class FailureDisposition(StrEnum):
    RETRY = "RETRY"
    DEGRADE = "DEGRADE"
    ESCALATE = "ESCALATE"
    TERMINAL = "TERMINAL"


class _FrozenContract(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        extra="forbid",
        revalidate_instances="always",
    )

    def model_copy(
        self,
        *,
        update: Mapping[str, Any] | None = None,
        deep: bool = False,
    ) -> Self:
        """Return a validated copy instead of Pydantic's unchecked update copy."""

        values = self.model_dump(mode="python", round_trip=True)
        if update:
            values.update(update)
        # Validation rebuilds every nested frozen contract, so both shallow and
        # requested deep copies cross the same closed validation boundary.
        _ = deep
        return type(self).model_validate(values)


def _require_nonblank(value: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError("value_must_be_nonblank")
    return value.strip()


def _require_digest(value: str) -> str:
    if _DIGEST_PATTERN.fullmatch(value) is None:
        raise ValueError("digest_must_be_lowercase_sha256")
    return value


def _require_version(value: str) -> str:
    if _SEMANTIC_VERSION.fullmatch(value) is None:
        raise ValueError("unsupported_semantic_version")
    return value


def _require_unique_nonblank(
    values: tuple[str, ...], *, allow_empty: bool = True
) -> tuple[str, ...]:
    if not allow_empty and not values:
        raise ValueError("items_must_not_be_empty")
    normalized = tuple(_require_nonblank(value) for value in values)
    if len(set(normalized)) != len(normalized):
        raise ValueError("items_must_be_unique")
    return normalized


def _validate_route(route_type: RouteType, departments: tuple[str, ...]) -> tuple[str, ...]:
    normalized = _require_unique_nonblank(departments, allow_empty=False)
    if route_type is RouteType.SINGLE and len(normalized) != 1:
        raise ValueError("single_route_requires_one_department")
    if route_type is RouteType.MULTI and len(normalized) < 2:
        raise ValueError("multi_route_requires_multiple_departments")
    return normalized


class ExecutionIdentity(_FrozenContract):
    owner_user_id: str
    run_id: str
    decree_id: str

    @field_validator("owner_user_id", "run_id", "decree_id")
    @classmethod
    def require_identity(cls, value: str) -> str:
        return _require_nonblank(value)


def archive_idempotency_key(identity: ExecutionIdentity, reply_ref: str) -> str:
    """Derive an opaque archive key bound to one identity and reply."""

    normalized_reply_ref = _require_nonblank(reply_ref)
    payload = json.dumps(
        [
            identity.owner_user_id,
            identity.run_id,
            identity.decree_id,
            normalized_reply_ref,
        ],
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")
    return f"sha256:{hashlib.sha256(payload).hexdigest()}"


def decree_input_digest(decree_text: str) -> str:
    """Hash the normalized decree text used by the orchestration request."""

    normalized_decree = _require_nonblank(decree_text)
    return f"sha256:{hashlib.sha256(normalized_decree.encode('utf-8')).hexdigest()}"


class ProviderBudget(_FrozenContract):
    max_calls: int = Field(strict=True, ge=0, le=1_000)
    max_tokens: int = Field(strict=True, ge=0, le=10_000_000)
    timeout_ms: int = Field(strict=True, ge=1, le=900_000)


class OrchestrationRequest(_FrozenContract):
    identity: ExecutionIdentity
    decree_text: str
    input_digest: str
    resource_manifest_digest: str
    provider_budget: ProviderBudget

    @field_validator("decree_text")
    @classmethod
    def require_decree_text(cls, value: str) -> str:
        return _require_nonblank(value)

    @field_validator("input_digest", "resource_manifest_digest")
    @classmethod
    def require_digest(cls, value: str) -> str:
        return _require_digest(value)

    @model_validator(mode="after")
    def require_input_digest_binding(self) -> OrchestrationRequest:
        if self.input_digest != decree_input_digest(self.decree_text):
            raise ValueError("input_digest_must_bind_decree_text")
        return self


class ExecutionStep(_FrozenContract):
    step_id: str
    department: str | None = None

    @field_validator("step_id")
    @classmethod
    def require_step_id(cls, value: str) -> str:
        return _require_nonblank(value)

    @field_validator("department")
    @classmethod
    def normalize_department(cls, value: str | None) -> str | None:
        return None if value is None else _require_nonblank(value)


class ExecutionPlan(_FrozenContract):
    identity: ExecutionIdentity
    engine_kind: EngineKind
    engine_version: str
    input_digest: str
    resource_manifest_digest: str
    route_type: RouteType
    departments: tuple[str, ...]
    steps: tuple[ExecutionStep, ...]

    @field_validator("engine_version")
    @classmethod
    def require_engine_version(cls, value: str) -> str:
        return _require_version(value)

    @field_validator("input_digest", "resource_manifest_digest")
    @classmethod
    def require_digest(cls, value: str) -> str:
        return _require_digest(value)

    @field_validator("departments")
    @classmethod
    def normalize_departments(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        return _require_unique_nonblank(value, allow_empty=False)

    @field_validator("steps")
    @classmethod
    def require_steps(cls, value: tuple[ExecutionStep, ...]) -> tuple[ExecutionStep, ...]:
        if not value:
            raise ValueError("items_must_not_be_empty")
        step_ids = tuple(step.step_id for step in value)
        if len(set(step_ids)) != len(step_ids):
            raise ValueError("step_ids_must_be_unique")
        return value

    @model_validator(mode="after")
    def require_valid_route(self) -> ExecutionPlan:
        _validate_route(self.route_type, self.departments)
        department_steps = tuple(
            step.department for step in self.steps if step.department is not None
        )
        if department_steps != self.departments:
            raise ValueError("department_steps_must_match_route_order")
        return self


class ExecutionEvent(_FrozenContract):
    identity: ExecutionIdentity
    engine_kind: EngineKind
    engine_version: str
    sequence: int = Field(strict=True, ge=1)
    kind: ExecutionEventKind
    step_id: str
    checkpoint_ref: str | None = None
    reply_ref: str | None = None
    idempotency_key: str | None = None
    failure_code: str | None = None
    evidence_refs: tuple[str, ...] = ()

    @field_validator("engine_version")
    @classmethod
    def require_engine_version(cls, value: str) -> str:
        return _require_version(value)

    @field_validator("step_id")
    @classmethod
    def require_step_id(cls, value: str) -> str:
        return _require_nonblank(value)

    @field_validator("checkpoint_ref", "reply_ref", "idempotency_key")
    @classmethod
    def normalize_optional_reference(cls, value: str | None) -> str | None:
        return None if value is None else _require_nonblank(value)

    @field_validator("failure_code")
    @classmethod
    def normalize_failure_code(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if _FAILURE_CODE.fullmatch(value) is None:
            raise ValueError("failure_code_must_be_stable")
        return value

    @field_validator("evidence_refs")
    @classmethod
    def require_evidence_refs(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        return _require_unique_nonblank(value)

    @model_validator(mode="after")
    def checkpoint_event_requires_reference(self) -> ExecutionEvent:
        if self.kind is ExecutionEventKind.CHECKPOINTED and self.checkpoint_ref is None:
            raise ValueError("checkpoint_event_requires_reference")
        if self.kind is not ExecutionEventKind.CHECKPOINTED and self.checkpoint_ref is not None:
            raise ValueError("checkpoint_reference_requires_checkpoint_event")
        if self.kind is ExecutionEventKind.REPLY_ARCHIVED and self.reply_ref is None:
            raise ValueError("reply_archive_event_requires_reply_reference")
        if self.kind is not ExecutionEventKind.REPLY_ARCHIVED and self.reply_ref is not None:
            raise ValueError("reply_reference_requires_archive_event")
        if self.kind is ExecutionEventKind.REPLY_ARCHIVED and self.idempotency_key is None:
            raise ValueError("reply_archive_event_requires_idempotency_key")
        if self.kind is not ExecutionEventKind.REPLY_ARCHIVED and self.idempotency_key is not None:
            raise ValueError("idempotency_key_requires_archive_event")
        if self.kind is ExecutionEventKind.FAILURE_CLASSIFIED and self.failure_code is None:
            raise ValueError("failure_event_requires_failure_code")
        if self.kind is not ExecutionEventKind.FAILURE_CLASSIFIED and self.failure_code is not None:
            raise ValueError("failure_code_requires_failure_event")
        if self.kind is ExecutionEventKind.EVIDENCE_ADOPTED and not self.evidence_refs:
            raise ValueError("evidence_adopted_event_requires_references")
        if self.kind is not ExecutionEventKind.EVIDENCE_ADOPTED and self.evidence_refs:
            raise ValueError("evidence_references_require_adoption_event")
        return self


class ExecutionCheckpoint(_FrozenContract):
    identity: ExecutionIdentity
    engine_kind: EngineKind
    engine_version: str
    checkpoint_id: str
    sequence: int = Field(strict=True, ge=1)
    next_step_id: str
    engine_state_ref: str
    input_digest: str
    resource_manifest_digest: str

    @field_validator("engine_version")
    @classmethod
    def require_engine_version(cls, value: str) -> str:
        return _require_version(value)

    @field_validator("checkpoint_id", "next_step_id", "engine_state_ref")
    @classmethod
    def require_state_reference(cls, value: str) -> str:
        return _require_nonblank(value)

    @field_validator("input_digest", "resource_manifest_digest")
    @classmethod
    def require_digest(cls, value: str) -> str:
        return _require_digest(value)


class ResumeRequest(_FrozenContract):
    caller_owner_user_id: str
    expected_engine_kind: EngineKind
    expected_engine_version: str
    request: OrchestrationRequest
    checkpoint: ExecutionCheckpoint

    @field_validator("caller_owner_user_id")
    @classmethod
    def require_caller_owner(cls, value: str) -> str:
        return _require_nonblank(value)

    @field_validator("expected_engine_version")
    @classmethod
    def require_engine_version(cls, value: str) -> str:
        return _require_version(value)

    @model_validator(mode="after")
    def require_request_checkpoint_binding(self) -> ResumeRequest:
        if self.caller_owner_user_id != self.request.identity.owner_user_id:
            raise ValueError("caller_owner_mismatch")
        if self.checkpoint.identity != self.request.identity:
            raise ValueError("checkpoint_identity_mismatch")
        if (
            self.checkpoint.engine_kind is not self.expected_engine_kind
            or self.checkpoint.engine_version != self.expected_engine_version
        ):
            raise ValueError("checkpoint_engine_binding_mismatch")
        if (
            self.checkpoint.input_digest != self.request.input_digest
            or self.checkpoint.resource_manifest_digest != self.request.resource_manifest_digest
        ):
            raise ValueError("checkpoint_input_binding_mismatch")
        return self


class ExecutionFailure(_FrozenContract):
    identity: ExecutionIdentity
    engine_kind: EngineKind
    engine_version: str
    stage: str
    code: str
    disposition: FailureDisposition
    retryable: bool = Field(strict=True)
    attempt: int = Field(strict=True, ge=1)

    @field_validator("engine_version")
    @classmethod
    def require_engine_version(cls, value: str) -> str:
        return _require_version(value)

    @field_validator("stage")
    @classmethod
    def require_stage(cls, value: str) -> str:
        return _require_nonblank(value)

    @field_validator("code")
    @classmethod
    def require_stable_code(cls, value: str) -> str:
        if _FAILURE_CODE.fullmatch(value) is None:
            raise ValueError("failure_code_must_be_stable")
        return value

    @model_validator(mode="after")
    def require_retry_consistency(self) -> ExecutionFailure:
        if self.retryable != (self.disposition is FailureDisposition.RETRY):
            raise ValueError("retryable_and_disposition_conflict")
        return self


class ExecutionResult(_FrozenContract):
    identity: ExecutionIdentity
    engine_kind: EngineKind
    engine_version: str
    terminal_state: ExecutionTerminalState
    route_type: RouteType
    departments: tuple[str, ...]
    processing_path: tuple[str, ...] = ()
    final_verdict: str | None = None
    recommendations: tuple[str, ...] = ()
    evidence_refs: tuple[str, ...] = ()
    work_product_refs: tuple[str, ...] = ()
    reply_refs: tuple[str, ...] = ()
    side_effect_keys: tuple[str, ...] = ()
    failure: ExecutionFailure | None = None

    @field_validator("engine_version")
    @classmethod
    def require_engine_version(cls, value: str) -> str:
        return _require_version(value)

    @field_validator("departments")
    @classmethod
    def normalize_departments(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        return _require_unique_nonblank(value, allow_empty=False)

    @field_validator("processing_path")
    @classmethod
    def normalize_processing_path(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        return tuple(_require_nonblank(item) for item in value)

    @field_validator("final_verdict")
    @classmethod
    def normalize_final_verdict(cls, value: str | None) -> str | None:
        return None if value is None else _require_nonblank(value)

    @field_validator(
        "recommendations",
        "evidence_refs",
        "work_product_refs",
        "reply_refs",
        "side_effect_keys",
    )
    @classmethod
    def require_unique_references(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        return _require_unique_nonblank(value)

    @model_validator(mode="after")
    def require_closed_terminal_contract(self) -> ExecutionResult:
        _validate_route(self.route_type, self.departments)
        usable = self.terminal_state in {
            ExecutionTerminalState.SUCCEEDED,
            ExecutionTerminalState.DEGRADED,
        }
        if usable:
            if self.final_verdict is None or not self.processing_path:
                raise ValueError("usable_result_requires_verdict_and_path")
            if len(self.recommendations) != 3:
                raise ValueError("usable_result_requires_three_recommendations")
            if not self.evidence_refs:
                raise ValueError("usable_result_requires_evidence")
            if len(self.reply_refs) != 1:
                raise ValueError("usable_result_requires_exactly_one_reply")
            if len(self.side_effect_keys) != 1:
                raise ValueError("usable_result_requires_exactly_one_side_effect_key")
            if self.side_effect_keys != (
                archive_idempotency_key(self.identity, self.reply_refs[0]),
            ):
                raise ValueError("archive_side_effect_key_must_bind_identity")
            if self.terminal_state is ExecutionTerminalState.SUCCEEDED:
                if self.failure is not None:
                    raise ValueError("successful_result_cannot_have_failure")
            elif self.failure is None:
                raise ValueError("degraded_result_requires_failure")
            elif self.failure.disposition is not FailureDisposition.DEGRADE:
                raise ValueError("degraded_result_requires_degrade_disposition")
            if self.failure is not None:
                self._require_failure_binding()
            return self
        if (
            self.final_verdict is not None
            or self.recommendations
            or self.work_product_refs
            or self.reply_refs
            or self.side_effect_keys
        ):
            raise ValueError("failed_result_cannot_publish_reply_content")
        if self.failure is None:
            raise ValueError("failed_result_requires_failure")
        self._require_failure_binding()
        if self.failure.disposition not in {
            FailureDisposition.ESCALATE,
            FailureDisposition.TERMINAL,
        }:
            raise ValueError("terminal_result_requires_terminal_failure")
        return self

    def _require_failure_binding(self) -> None:
        assert self.failure is not None
        if (
            self.failure.identity != self.identity
            or self.failure.engine_kind is not self.engine_kind
            or self.failure.engine_version != self.engine_version
        ):
            raise ValueError("failure_binding_mismatch")


class ExecutionReplayGuard(_FrozenContract):
    prior_result: ExecutionResult
    replayed_result: ExecutionResult

    @model_validator(mode="after")
    def require_byte_equivalent_result(self) -> ExecutionReplayGuard:
        if self.prior_result != self.replayed_result:
            raise ValueError("non_idempotent_replay")
        return self

    @property
    def result(self) -> ExecutionResult:
        return self.prior_result


class ExecutionTrace(_FrozenContract):
    request: OrchestrationRequest
    plan: ExecutionPlan
    events: tuple[ExecutionEvent, ...] = ()
    checkpoints: tuple[ExecutionCheckpoint, ...] = ()
    result: ExecutionResult | None = None
    resume_checkpoint_id: str | None = None

    @field_validator("resume_checkpoint_id")
    @classmethod
    def normalize_resume_checkpoint_id(cls, value: str | None) -> str | None:
        return None if value is None else _require_nonblank(value)

    @model_validator(mode="after")
    def require_closed_execution_chain(self) -> ExecutionTrace:
        identity = self.request.identity
        engine = (self.plan.engine_kind, self.plan.engine_version)
        plan_steps = tuple(step.step_id for step in self.plan.steps)
        step_positions = {step_id: index for index, step_id in enumerate(plan_steps)}
        if self.plan.identity != identity:
            raise ValueError("plan_identity_mismatch")
        if (
            self.plan.input_digest != self.request.input_digest
            or self.plan.resource_manifest_digest != self.request.resource_manifest_digest
        ):
            raise ValueError("plan_input_binding_mismatch")
        if [event.sequence for event in self.events] != list(range(1, len(self.events) + 1)):
            raise ValueError("event_sequence_must_be_contiguous")
        for event in self.events:
            if event.identity != identity or (event.engine_kind, event.engine_version) != engine:
                raise ValueError("event_binding_mismatch")
            if event.step_id not in step_positions:
                raise ValueError("event_step_not_in_plan")
        if self.events:
            plan_created = [
                event for event in self.events if event.kind is ExecutionEventKind.PLAN_CREATED
            ]
            if (
                len(plan_created) != 1
                or plan_created[0].sequence != 1
                or plan_created[0].step_id != plan_steps[0]
            ):
                raise ValueError("trace_requires_first_plan_created_event")
        checkpoint_ids = tuple(checkpoint.checkpoint_id for checkpoint in self.checkpoints)
        if len(set(checkpoint_ids)) != len(checkpoint_ids):
            raise ValueError("checkpoint_ids_must_be_unique")
        if (
            self.resume_checkpoint_id is not None
            and self.resume_checkpoint_id not in checkpoint_ids
        ):
            raise ValueError("resume_checkpoint_must_be_in_trace")
        checkpoint_event_items = [
            (event.checkpoint_ref, event.sequence)
            for event in self.events
            if event.kind is ExecutionEventKind.CHECKPOINTED
        ]
        if len({item[0] for item in checkpoint_event_items}) != len(checkpoint_event_items):
            raise ValueError("checkpoint_event_refs_must_be_unique")
        checkpoint_events = dict(checkpoint_event_items)
        if set(checkpoint_ids) != set(checkpoint_events):
            raise ValueError("checkpoint_event_set_mismatch")
        for checkpoint in self.checkpoints:
            if checkpoint.next_step_id not in step_positions:
                raise ValueError("checkpoint_next_step_not_in_plan")
            checkpoint_event = next(
                event
                for event in self.events
                if event.kind is ExecutionEventKind.CHECKPOINTED
                and event.checkpoint_ref == checkpoint.checkpoint_id
            )
            current_position = step_positions[checkpoint_event.step_id]
            next_position = step_positions[checkpoint.next_step_id]
            if (
                checkpoint.identity != identity
                or (checkpoint.engine_kind, checkpoint.engine_version) != engine
                or checkpoint.input_digest != self.request.input_digest
                or checkpoint.resource_manifest_digest != self.request.resource_manifest_digest
                or checkpoint_events[checkpoint.checkpoint_id] != checkpoint.sequence
            ):
                raise ValueError("checkpoint_binding_mismatch")
            if next_position not in {current_position, current_position + 1}:
                raise ValueError("checkpoint_next_step_is_not_legal_successor")
        if self.resume_checkpoint_id is not None:
            resume_checkpoint = next(
                checkpoint
                for checkpoint in self.checkpoints
                if checkpoint.checkpoint_id == self.resume_checkpoint_id
            )
            continuation_events = [
                event
                for event in self.events
                if event.sequence > resume_checkpoint.sequence
                and event.kind
                in {
                    ExecutionEventKind.STEP_STARTED,
                    ExecutionEventKind.FAILURE_CLASSIFIED,
                    ExecutionEventKind.RESULT_READY,
                }
            ]
            if (
                not continuation_events
                or continuation_events[0].step_id != resume_checkpoint.next_step_id
            ):
                raise ValueError("resume_trace_must_continue_at_next_step")
        started: dict[str, int] = {}
        started_order: list[str] = []
        completed: list[str] = []
        for event in self.events:
            if event.kind is ExecutionEventKind.STEP_STARTED:
                if event.step_id in started:
                    raise ValueError("step_must_start_once")
                started[event.step_id] = event.sequence
                started_order.append(event.step_id)
            elif event.kind is ExecutionEventKind.STEP_COMPLETED:
                if (
                    event.step_id not in started
                    or started[event.step_id] >= event.sequence
                    or event.step_id in completed
                ):
                    raise ValueError("step_completion_requires_one_prior_start")
                completed.append(event.step_id)
        if completed != list(plan_steps[: len(completed)]):
            raise ValueError("completed_steps_must_follow_plan_order")
        if started_order != list(plan_steps[: len(started_order)]):
            raise ValueError("started_steps_must_follow_plan_order")
        if completed != started_order[: len(completed)] or len(started_order) - len(
            completed
        ) not in {0, 1}:
            raise ValueError("started_and_completed_steps_must_form_one_prefix")
        result_ready = [
            event for event in self.events if event.kind is ExecutionEventKind.RESULT_READY
        ]
        reply_archived = [
            event for event in self.events if event.kind is ExecutionEventKind.REPLY_ARCHIVED
        ]
        if self.result is None:
            if result_ready or reply_archived:
                raise ValueError("terminal_events_require_result")
            return self
        if len(result_ready) != 1:
            raise ValueError("result_requires_one_ready_event")
        usable = self.result.terminal_state in {
            ExecutionTerminalState.SUCCEEDED,
            ExecutionTerminalState.DEGRADED,
        }
        if usable:
            adoption_events = [
                event
                for event in self.events
                if event.kind is ExecutionEventKind.EVIDENCE_ADOPTED
            ]
            if not adoption_events:
                raise ValueError("usable_result_requires_adopted_evidence")
            adopted_evidence = tuple(
                evidence_ref
                for event in adoption_events
                for evidence_ref in event.evidence_refs
            )
            if len(set(adopted_evidence)) != len(adopted_evidence):
                raise ValueError("adopted_evidence_must_be_unique")
            if any(event.sequence >= result_ready[0].sequence for event in adoption_events):
                raise ValueError("evidence_must_be_adopted_before_result_ready")
            if adopted_evidence != self.result.evidence_refs:
                raise ValueError("result_evidence_must_match_adopted_evidence")
            if (
                len(reply_archived) != 1
                or result_ready[0].sequence != len(self.events) - 1
                or reply_archived[0].sequence != len(self.events)
                or reply_archived[0].reply_ref != self.result.reply_refs[0]
                or reply_archived[0].idempotency_key != self.result.side_effect_keys[0]
            ):
                raise ValueError("usable_result_requires_final_archive_event")
        elif reply_archived or result_ready[0].sequence != len(self.events):
            raise ValueError("failed_result_requires_final_ready_event_without_archive")
        if self.result is not None:
            if (
                self.result.identity != identity
                or (self.result.engine_kind, self.result.engine_version) != engine
                or self.result.route_type is not self.plan.route_type
                or self.result.departments != self.plan.departments
            ):
                raise ValueError("result_binding_mismatch")
        if tuple(completed) != self.result.processing_path:
            raise ValueError("result_processing_path_must_match_completed_steps")
        if usable and tuple(completed) != plan_steps:
            raise ValueError("usable_result_requires_all_planned_steps")
        if (
            not usable
            and self.result.failure is not None
            and step_positions.get(self.result.failure.stage) != len(completed)
        ):
            raise ValueError("terminal_failure_must_follow_completed_prefix")
        expected_ready_step = (
            completed[-1]
            if usable
            else self.result.failure.stage
            if self.result.failure is not None
            else plan_steps[0]
        )
        if result_ready[0].step_id != expected_ready_step:
            raise ValueError("result_ready_step_mismatch")
        failure_events = [
            event for event in self.events if event.kind is ExecutionEventKind.FAILURE_CLASSIFIED
        ]
        if self.result.failure is not None:
            matching_failures = [
                event
                for event in failure_events
                if event.step_id == self.result.failure.stage
                and event.failure_code == self.result.failure.code
                and event.sequence < result_ready[0].sequence
            ]
            if len(matching_failures) != 1:
                raise ValueError("result_failure_requires_matching_classified_event")
        return self


class ExecutionResumeGuard(_FrozenContract):
    resume_request: ResumeRequest
    resumed_trace: ExecutionTrace

    @model_validator(mode="after")
    def require_checkpoint_bound_continuation(self) -> ExecutionResumeGuard:
        checkpoint = self.resume_request.checkpoint
        trace = self.resumed_trace
        if (
            trace.request != self.resume_request.request
            or trace.plan.engine_kind is not self.resume_request.expected_engine_kind
            or trace.plan.engine_version != self.resume_request.expected_engine_version
            or trace.resume_checkpoint_id != checkpoint.checkpoint_id
        ):
            raise ValueError("resume_trace_binding_mismatch")
        matching_checkpoints = [
            item for item in trace.checkpoints if item.checkpoint_id == checkpoint.checkpoint_id
        ]
        if matching_checkpoints != [checkpoint]:
            raise ValueError("resume_trace_checkpoint_mismatch")
        return self

    @property
    def trace(self) -> ExecutionTrace:
        return self.resumed_trace
