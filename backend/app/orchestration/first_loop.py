"""Deterministic first-loop contracts for the study-to-archive path.

This module is deliberately framework-neutral.  It adapts the existing
``app.orchestration`` contracts and opaque task/attempt/reply references; it
does not create a second task store or expose capability execution.
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Final

from app.orchestration.contracts import (
    EngineKind,
    ExecutionEvent,
    ExecutionEventKind,
    ExecutionFailure,
    ExecutionPlan,
    ExecutionResult,
    ExecutionStep,
    ExecutionTerminalState,
    ExecutionTrace,
    FailureDisposition,
    OrchestrationRequest,
    RouteType,
    archive_idempotency_key,
    decree_input_digest,
)

_ENGINE_VERSION: Final = "1.0.0"
_DEFAULT_DEPARTMENT: Final = "hubu"
_KNOWN_DEPARTMENTS: Final = frozenset({"hubu", "gongbu", "bingbu", "libu", "xingbu", "libu_rites"})
_SUCCESS_CRITERIA: Final = (
    "one_department_review",
    "evidence_backed_result",
    "one_owner_scoped_reply",
)


def _nonblank(value: str, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field}_must_be_nonblank")
    return value.strip()


def _unique_refs(values: Iterable[str], field: str) -> tuple[str, ...]:
    normalized = tuple(_nonblank(value, field) for value in values)
    if len(normalized) != len(set(normalized)):
        raise ValueError(f"{field}_must_be_unique")
    return normalized


def _require_attempt_number(value: int, field: str = "attempt") -> int:
    """Validate an attempt counter without accepting bool-as-int coercion."""

    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise ValueError(f"{field}_must_be_positive_integer")
    return value


@dataclass(frozen=True, slots=True)
class ScopeBinding:
    """Opaque owner/task/attempt scope carried at the first-loop boundary.

    The orchestration contracts intentionally do not own a task store.  These
    references therefore remain opaque, but they are still required together
    and are checked before any plan or result is produced.
    """

    owner_user_id: str
    task_ref: str
    attempt_ref: str

    def __post_init__(self) -> None:
        object.__setattr__(
            self,
            "owner_user_id",
            _nonblank(self.owner_user_id, "owner_user_id"),
        )
        object.__setattr__(self, "task_ref", _nonblank(self.task_ref, "task_ref"))
        object.__setattr__(self, "attempt_ref", _nonblank(self.attempt_ref, "attempt_ref"))

    def assert_owner(self, owner_user_id: str) -> None:
        if self.owner_user_id != _nonblank(owner_user_id, "owner_user_id"):
            raise ValueError("owner_scope_mismatch")

    def assert_matches(self, other: ScopeBinding) -> None:
        if self.owner_user_id != other.owner_user_id:
            raise ValueError("owner_scope_mismatch")
        if self.task_ref != other.task_ref:
            raise ValueError("task_scope_mismatch")
        if self.attempt_ref != other.attempt_ref:
            raise ValueError("attempt_scope_mismatch")

    @property
    def digest(self) -> str:
        payload = json.dumps(
            [self.owner_user_id, self.task_ref, self.attempt_ref],
            ensure_ascii=False,
            separators=(",", ":"),
        ).encode("utf-8")
        return f"sha256:{hashlib.sha256(payload).hexdigest()}"


@dataclass(frozen=True, slots=True)
class GoalSpec:
    """Owner/task/attempt-bound interpretation of one study decree."""

    owner_user_id: str
    run_id: str
    decree_id: str
    decree_text: str
    input_digest: str
    task_ref: str | None = None
    attempt_ref: str | None = None
    success_criteria: tuple[str, ...] = _SUCCESS_CRITERIA

    def __post_init__(self) -> None:
        object.__setattr__(self, "owner_user_id", _nonblank(self.owner_user_id, "owner_user_id"))
        object.__setattr__(self, "run_id", _nonblank(self.run_id, "run_id"))
        object.__setattr__(self, "decree_id", _nonblank(self.decree_id, "decree_id"))
        normalized_text = _nonblank(self.decree_text, "decree_text")
        object.__setattr__(self, "decree_text", normalized_text)
        if self.input_digest != decree_input_digest(normalized_text):
            raise ValueError("input_digest_must_bind_decree_text")
        if (self.task_ref is None) != (self.attempt_ref is None):
            raise ValueError("task_ref_and_attempt_ref_must_be_provided_together")
        if self.task_ref is not None:
            object.__setattr__(self, "task_ref", _nonblank(self.task_ref, "task_ref"))
            object.__setattr__(self, "attempt_ref", _nonblank(self.attempt_ref, "attempt_ref"))
        object.__setattr__(
            self,
            "success_criteria",
            _unique_refs(self.success_criteria, "success_criterion"),
        )

    @property
    def scope(self) -> ScopeBinding | None:
        if self.task_ref is None or self.attempt_ref is None:
            return None
        return ScopeBinding(self.owner_user_id, self.task_ref, self.attempt_ref)


class GoalInterpreter:
    """Turn user text into a stable, non-executing goal record."""

    def interpret(
        self,
        *,
        owner_user_id: str,
        run_id: str,
        decree_id: str,
        decree_text: str,
        task_ref: str | None = None,
        attempt_ref: str | None = None,
    ) -> GoalSpec:
        owner = _nonblank(owner_user_id, "owner_user_id")
        run = _nonblank(run_id, "run_id")
        decree = _nonblank(decree_id, "decree_id")
        text = _nonblank(decree_text, "decree_text")
        if (task_ref is None) != (attempt_ref is None):
            raise ValueError("task_ref_and_attempt_ref_must_be_provided_together")
        return GoalSpec(
            owner_user_id=owner,
            run_id=run,
            decree_id=decree,
            decree_text=text,
            input_digest=decree_input_digest(text),
            task_ref=None if task_ref is None else _nonblank(task_ref, "task_ref"),
            attempt_ref=None if attempt_ref is None else _nonblank(attempt_ref, "attempt_ref"),
        )


@dataclass(frozen=True, slots=True)
class TeamSelection:
    """The selected chancellor plus exactly one department."""

    department: str
    roles: tuple[str, ...] = ("chancellor", "department")

    def __post_init__(self) -> None:
        selected = _nonblank(self.department, "department").lower()
        if selected not in _KNOWN_DEPARTMENTS:
            raise ValueError("department_not_available_for_first_loop")
        if self.roles != ("chancellor", "department"):
            raise ValueError("first_loop_team_must_have_chancellor_and_department")
        object.__setattr__(self, "department", selected)


class TeamSelector:
    """Select a deterministic department without touching the capability registry."""

    def select(self, department: str = _DEFAULT_DEPARTMENT) -> TeamSelection:
        selected = _nonblank(department, "department").lower()
        if selected not in _KNOWN_DEPARTMENTS:
            raise ValueError("department_not_available_for_first_loop")
        return TeamSelection(department=selected)


class PlanBuilder:
    """Build a single-department plan on the existing orchestration contract."""

    def build(self, request: OrchestrationRequest, team: TeamSelection) -> ExecutionPlan:
        _nonblank(request.identity.owner_user_id, "owner_user_id")
        if team.department not in _KNOWN_DEPARTMENTS:
            raise ValueError("department_not_available_for_first_loop")
        return ExecutionPlan(
            identity=request.identity,
            engine_kind=EngineKind.DIRECT,
            engine_version=_ENGINE_VERSION,
            input_digest=request.input_digest,
            resource_manifest_digest=request.resource_manifest_digest,
            route_type=RouteType.SINGLE,
            departments=(team.department,),
            steps=(
                ExecutionStep(step_id="goal"),
                ExecutionStep(step_id="chancellor"),
                ExecutionStep(step_id="department", department=team.department),
                ExecutionStep(step_id="result"),
            ),
        )


@dataclass(frozen=True, slots=True)
class EvidenceLedger:
    """Append-only evidence references; values remain opaque and owner-scoped."""

    refs: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        object.__setattr__(self, "refs", _unique_refs(self.refs, "evidence_ref"))

    @classmethod
    def from_refs(cls, refs: Iterable[str]) -> EvidenceLedger:
        return cls(refs=_unique_refs(refs, "evidence_ref"))

    def adopt(self, evidence_ref: str) -> EvidenceLedger:
        return EvidenceLedger.from_refs((*self.refs, evidence_ref))

    @property
    def digest(self) -> str:
        payload = json.dumps(self.refs, ensure_ascii=False, separators=(",", ":")).encode()
        return f"sha256:{hashlib.sha256(payload).hexdigest()}"


@dataclass(frozen=True, slots=True)
class QualityDecision:
    passed: bool
    reasons: tuple[str, ...] = ()


class QualityGate:
    """Check the result-card invariants before a REPLY archive is emitted."""

    def evaluate(self, result: ExecutionResult, ledger: EvidenceLedger) -> QualityDecision:
        reasons: list[str] = []
        if result.terminal_state not in {
            ExecutionTerminalState.SUCCEEDED,
            ExecutionTerminalState.DEGRADED,
        }:
            reasons.append("result_not_publishable")
        if result.evidence_refs != ledger.refs:
            reasons.append("evidence_ledger_mismatch")
        if len(result.recommendations) != 3:
            reasons.append("recommendations_must_have_three_items")
        if len(result.reply_refs) != 1:
            reasons.append("reply_must_have_one_reference")
        if len(result.side_effect_keys) != 1:
            reasons.append("archive_must_have_one_idempotency_key")
        return QualityDecision(passed=not reasons, reasons=tuple(reasons))


class ResultContract:
    """Factory for the existing ``ExecutionResult`` result-card contract."""

    def success(
        self,
        *,
        request: OrchestrationRequest,
        plan: ExecutionPlan,
        final_verdict: str,
        recommendations: Iterable[str],
        evidence: EvidenceLedger,
        reply_ref: str,
    ) -> ExecutionResult:
        refs = _unique_refs(recommendations, "recommendation")
        if len(refs) != 3:
            raise ValueError("recommendations_must_have_three_items")
        reply = _nonblank(reply_ref, "reply_ref")
        return ExecutionResult(
            identity=request.identity,
            engine_kind=plan.engine_kind,
            engine_version=plan.engine_version,
            terminal_state=ExecutionTerminalState.SUCCEEDED,
            route_type=plan.route_type,
            departments=plan.departments,
            processing_path=tuple(step.step_id for step in plan.steps),
            final_verdict=_nonblank(final_verdict, "final_verdict"),
            recommendations=refs,
            evidence_refs=evidence.refs,
            work_product_refs=(f"result-card:{request.identity.run_id}",),
            reply_refs=(reply,),
            side_effect_keys=(archive_idempotency_key(request.identity, reply),),
        )


@dataclass(frozen=True, slots=True)
class RecoveryDecision:
    disposition: FailureDisposition
    code: str
    retryable: bool
    attempt: int

    def __post_init__(self) -> None:
        _nonblank(self.code, "code")
        _require_attempt_number(self.attempt)
        if not isinstance(self.retryable, bool):
            raise ValueError("retryable_must_be_boolean")
        if self.retryable != (self.disposition is FailureDisposition.RETRY):
            raise ValueError("retryable_and_disposition_conflict")


class RecoveryManager:
    """Classify cancellation/retry without mutating task or attempt storage."""

    def decide(
        self,
        *,
        attempt: int,
        retryable: bool,
        cancelled: bool = False,
        max_attempts: int = 2,
    ) -> RecoveryDecision:
        _require_attempt_number(attempt)
        _require_attempt_number(max_attempts, "max_attempts")
        if not isinstance(retryable, bool):
            raise ValueError("retryable_must_be_boolean")
        if not isinstance(cancelled, bool):
            raise ValueError("cancelled_must_be_boolean")
        if attempt > max_attempts:
            raise ValueError("attempt_out_of_range")
        if cancelled:
            return RecoveryDecision(FailureDisposition.TERMINAL, "CANCELLED", False, attempt)
        if retryable and attempt < max_attempts:
            return RecoveryDecision(FailureDisposition.RETRY, "RETRYABLE_FAILURE", True, attempt)
        return RecoveryDecision(FailureDisposition.TERMINAL, "TERMINAL_FAILURE", False, attempt)

    def failure(
        self,
        *,
        identity,
        stage: str,
        decision: RecoveryDecision,
    ) -> ExecutionFailure:
        return ExecutionFailure(
            identity=identity,
            engine_kind=EngineKind.DIRECT,
            engine_version=_ENGINE_VERSION,
            stage=_nonblank(stage, "stage"),
            code=decision.code,
            disposition=decision.disposition,
            retryable=decision.retryable,
            attempt=decision.attempt,
        )


class MemoryPolicy:
    """Owner-only archive reuse policy; capability discovery remains out of scope."""

    def archive_scope(self, owner_user_id: str) -> tuple[str, str]:
        return ("owner", _nonblank(owner_user_id, "owner_user_id"))

    def can_reuse(self, *, archive_owner_user_id: str, requester_user_id: str) -> bool:
        return _nonblank(archive_owner_user_id, "archive_owner_user_id") == _nonblank(
            requester_user_id, "requester_user_id"
        )

    def can_reuse_scope(self, *, archived: ScopeBinding, requester: ScopeBinding) -> bool:
        """Allow archive reuse only for the exact owner/task/attempt scope."""

        return archived == requester


@dataclass(frozen=True, slots=True)
class FirstLoopSubmission:
    request: OrchestrationRequest
    owner_user_id: str | None = None
    task_ref: str | None = None
    attempt_ref: str | None = None
    department: str = _DEFAULT_DEPARTMENT
    evidence_refs: tuple[str, ...] = ()
    final_verdict: str = "Result ready"
    recommendations: tuple[str, ...] = ("Review evidence", "Confirm scope", "Archive reply")
    reply_ref: str = "reply-1"

    def __post_init__(self) -> None:
        if self.owner_user_id is not None:
            _nonblank(self.owner_user_id, "owner_user_id")
        if (self.task_ref is None) != (self.attempt_ref is None):
            raise ValueError("task_ref_and_attempt_ref_must_be_provided_together")
        if self.task_ref is not None:
            _nonblank(self.task_ref, "task_ref")
            _nonblank(self.attempt_ref, "attempt_ref")

    @property
    def scope(self) -> ScopeBinding | None:
        if self.task_ref is None or self.attempt_ref is None:
            return None
        owner = (
            self.request.identity.owner_user_id
            if self.owner_user_id is None
            else self.owner_user_id
        )
        return ScopeBinding(owner, self.task_ref, self.attempt_ref)


class FirstLoopAdapter:
    """Produce one deterministic, fully validated study-to-REPLY trace."""

    def __init__(
        self,
        *,
        interpreter: GoalInterpreter | None = None,
        selector: TeamSelector | None = None,
        planner: PlanBuilder | None = None,
        result_contract: ResultContract | None = None,
        quality_gate: QualityGate | None = None,
    ) -> None:
        self.interpreter = interpreter or GoalInterpreter()
        self.selector = selector or TeamSelector()
        self.planner = planner or PlanBuilder()
        self.result_contract = result_contract or ResultContract()
        self.quality_gate = quality_gate or QualityGate()

    def run(self, submission: FirstLoopSubmission) -> ExecutionTrace:
        request = submission.request
        scope = self._submission_scope(submission)
        self.interpreter.interpret(
            owner_user_id=scope.owner_user_id,
            run_id=request.identity.run_id,
            decree_id=request.identity.decree_id,
            decree_text=request.decree_text,
            task_ref=scope.task_ref,
            attempt_ref=scope.attempt_ref,
        )
        team = self.selector.select(submission.department)
        plan = self.planner.build(request, team)
        ledger = EvidenceLedger.from_refs(submission.evidence_refs)
        result = self.result_contract.success(
            request=request,
            plan=plan,
            final_verdict=submission.final_verdict,
            recommendations=submission.recommendations,
            evidence=ledger,
            reply_ref=submission.reply_ref,
        )
        result = result.model_copy(
            update={
                "work_product_refs": (
                    *result.work_product_refs,
                    f"scope:{scope.digest}",
                )
            }
        )
        quality = self.quality_gate.evaluate(result, ledger)
        if not quality.passed:
            raise ValueError("quality_gate_rejected:" + ",".join(quality.reasons))
        identity = request.identity
        engine = plan.engine_kind
        version = plan.engine_version
        events: list[ExecutionEvent] = []

        def emit(kind: ExecutionEventKind, step_id: str, **kwargs: object) -> None:
            events.append(
                ExecutionEvent(
                    identity=identity,
                    engine_kind=engine,
                    engine_version=version,
                    sequence=len(events) + 1,
                    kind=kind,
                    step_id=step_id,
                    **kwargs,
                )
            )

        emit(ExecutionEventKind.PLAN_CREATED, "goal")
        for step in ("goal", "chancellor", "department", "result"):
            emit(ExecutionEventKind.STEP_STARTED, step)
            if step == "department":
                emit(ExecutionEventKind.EVIDENCE_ADOPTED, step, evidence_refs=ledger.refs)
            emit(ExecutionEventKind.STEP_COMPLETED, step)
        emit(ExecutionEventKind.RESULT_READY, "result")
        emit(
            ExecutionEventKind.REPLY_ARCHIVED,
            "result",
            reply_ref=result.reply_refs[0],
            idempotency_key=result.side_effect_keys[0],
        )
        return ExecutionTrace(request=request, plan=plan, events=tuple(events), result=result)

    def replay(
        self,
        submission: FirstLoopSubmission,
        prior: ExecutionTrace | None = None,
    ) -> ExecutionTrace:
        """Rebuild the trace and optionally prove byte-equivalent replay."""

        replayed = self.run(submission)
        if prior is not None and prior != replayed:
            raise ValueError("non_idempotent_replay")
        return replayed

    @staticmethod
    def _submission_scope(submission: FirstLoopSubmission) -> ScopeBinding:
        request_owner = submission.request.identity.owner_user_id
        owner = request_owner if submission.owner_user_id is None else submission.owner_user_id
        if submission.task_ref is None or submission.attempt_ref is None:
            raise ValueError("task_ref_and_attempt_ref_required")
        scope = ScopeBinding(owner, submission.task_ref, submission.attempt_ref)
        scope.assert_owner(request_owner)
        return scope


__all__ = [
    "EvidenceLedger",
    "FirstLoopAdapter",
    "FirstLoopSubmission",
    "GoalInterpreter",
    "GoalSpec",
    "MemoryPolicy",
    "PlanBuilder",
    "QualityDecision",
    "QualityGate",
    "RecoveryDecision",
    "RecoveryManager",
    "ResultContract",
    "ScopeBinding",
    "TeamSelection",
    "TeamSelector",
]
