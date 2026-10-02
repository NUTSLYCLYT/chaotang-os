from __future__ import annotations

import pytest

from app.orchestration import (
    ExecutionIdentity,
    OrchestrationRequest,
    ProviderBudget,
    decree_input_digest,
)
from app.orchestration.contracts import ExecutionEventKind, FailureDisposition
from app.orchestration.first_loop import (
    EvidenceLedger,
    FirstLoopAdapter,
    FirstLoopSubmission,
    GoalInterpreter,
    MemoryPolicy,
    RecoveryManager,
    ScopeBinding,
    TeamSelector,
)


def _request() -> OrchestrationRequest:
    text = "Review the budget evidence and return a scoped recommendation."
    return OrchestrationRequest(
        identity=ExecutionIdentity(owner_user_id="owner-a", run_id="run-1", decree_id="decree-1"),
        decree_text=text,
        input_digest=decree_input_digest(text),
        resource_manifest_digest="sha256:" + "a" * 64,
        provider_budget=ProviderBudget(max_calls=8, max_tokens=50000, timeout_ms=90000),
    )


def test_first_loop_emits_one_department_result_and_reply_archive() -> None:
    trace = FirstLoopAdapter().run(
        FirstLoopSubmission(
            request=_request(),
            task_ref="task-1",
            attempt_ref="attempt-1",
            evidence_refs=("evidence-1", "evidence-2"),
            reply_ref="reply-1",
        )
    )

    assert trace.plan.route_type.value == "single"
    assert trace.plan.departments == ("hubu",)
    assert trace.result is not None
    assert trace.result.reply_refs == ("reply-1",)
    assert len(trace.result.recommendations) == 3
    assert trace.result.evidence_refs == ("evidence-1", "evidence-2")
    assert trace.events[-1].kind is ExecutionEventKind.REPLY_ARCHIVED
    assert trace.events[-1].idempotency_key == trace.result.side_effect_keys[0]


def test_first_loop_replay_is_byte_equivalent_and_owner_bound() -> None:
    submission = FirstLoopSubmission(
        request=_request(),
        task_ref="task-1",
        attempt_ref="attempt-1",
        evidence_refs=("evidence-1",),
        reply_ref="reply-1",
    )
    first = FirstLoopAdapter().run(submission)
    replay = FirstLoopAdapter().replay(submission, prior=first)

    assert first.result == replay.result
    assert first.result is not None
    assert first.result.side_effect_keys[0].startswith("sha256:")
    assert MemoryPolicy().can_reuse(archive_owner_user_id="owner-a", requester_user_id="owner-a")
    assert not MemoryPolicy().can_reuse(
        archive_owner_user_id="owner-a", requester_user_id="owner-b"
    )
    with pytest.raises(ValueError, match="non_idempotent_replay"):
        FirstLoopAdapter().replay(
            FirstLoopSubmission(
                request=_request(),
                task_ref="task-2",
                attempt_ref="attempt-1",
                evidence_refs=("evidence-1",),
                reply_ref="reply-1",
            ),
            prior=first,
        )


def test_contracts_fail_closed_for_duplicate_evidence_or_unknown_department() -> None:
    with pytest.raises(ValueError, match="evidence_ref_must_be_unique"):
        EvidenceLedger.from_refs(("evidence-1", "evidence-1"))
    with pytest.raises(ValueError, match="department_not_available"):
        TeamSelector().select("external-capability")
    with pytest.raises(ValueError, match="recommendations_must_have_three"):
        FirstLoopAdapter().run(
            FirstLoopSubmission(
                request=_request(),
                task_ref="task-1",
                attempt_ref="attempt-1",
                evidence_refs=("evidence-1",),
                recommendations=("one", "two"),
            )
        )


def test_recovery_preserves_retry_cancel_and_terminal_semantics() -> None:
    manager = RecoveryManager()
    retry = manager.decide(attempt=1, retryable=True)
    cancelled = manager.decide(attempt=1, retryable=True, cancelled=True)
    terminal = manager.decide(attempt=2, retryable=True)

    assert retry.disposition is FailureDisposition.RETRY
    assert retry.retryable
    assert cancelled.disposition is FailureDisposition.TERMINAL
    assert cancelled.code == "CANCELLED"
    assert terminal.disposition is FailureDisposition.TERMINAL
    assert not terminal.retryable


def test_goal_interpreter_binds_normalized_text_and_existing_refs() -> None:
    goal = GoalInterpreter().interpret(
        owner_user_id=" owner-a ",
        run_id="run-1",
        decree_id="decree-1",
        decree_text="  Review evidence.  ",
        task_ref="task-1",
        attempt_ref="attempt-1",
    )

    assert goal.owner_user_id == "owner-a"
    assert goal.decree_text == "Review evidence."
    assert goal.task_ref == "task-1"
    assert goal.attempt_ref == "attempt-1"
    assert goal.input_digest == decree_input_digest(goal.decree_text)


def test_first_loop_scope_is_owner_bound_and_requires_task_and_attempt() -> None:
    with pytest.raises(ValueError, match="task_ref_and_attempt_ref_required"):
        FirstLoopAdapter().run(FirstLoopSubmission(request=_request()))

    with pytest.raises(ValueError, match="owner_scope_mismatch"):
        FirstLoopAdapter().run(
            FirstLoopSubmission(
                request=_request(),
                owner_user_id="owner-b",
                task_ref="task-1",
                attempt_ref="attempt-1",
                evidence_refs=("evidence-1",),
            )
        )

    policy = MemoryPolicy()
    assert policy.can_reuse_scope(
        archived=ScopeBinding("owner-a", "task-1", "attempt-1"),
        requester=ScopeBinding("owner-a", "task-1", "attempt-1"),
    )
    assert not policy.can_reuse_scope(
        archived=ScopeBinding("owner-a", "task-1", "attempt-1"),
        requester=ScopeBinding("owner-a", "task-2", "attempt-1"),
    )


def test_first_loop_rejects_partial_scope_and_invalid_attempt_counter() -> None:
    with pytest.raises(ValueError, match="task_ref_and_attempt_ref_must_be_provided_together"):
        FirstLoopSubmission(request=_request(), task_ref="task-1")

    with pytest.raises(ValueError, match="attempt_must_be_positive_integer"):
        RecoveryManager().decide(attempt=True, retryable=True)  # type: ignore[arg-type]
