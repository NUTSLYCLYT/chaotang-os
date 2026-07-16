"""Attempt-aware execution state derived from durable events and artifacts.

This projection deliberately does not reinterpret ``DecisionTask.status``.  The
legacy status vocabulary remains intact while this module answers the narrower
question: what can the durable execution facts actually prove?
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Iterable, Literal, Mapping, Sequence


ExecutionState = Literal[
    "queued",
    "running",
    "receipt_only",
    "completed",
    "failed",
    "inconsistent",
]

_TERMINAL_EVENT_TYPES = frozenset(
    {
        "dispatch.failed",
        "dispatch.receipt_only",
        "reports.completed",
        # Read compatibility for direct receipts written before attempt-aware
        # worker terminals existed.
        "memorial.direct_completed",
    }
)


@dataclass(frozen=True)
class ExecutionEventFact:
    event_type: str
    sequence: int
    payload: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class SwarmRunArtifact:
    run_id: str
    status: str
    task_statuses: tuple[str, ...]
    finished: bool
    task_outputs_present: tuple[bool, ...]
    has_quality_result: bool


@dataclass(frozen=True)
class ExecutionArtifacts:
    outbox_status: str | None = None
    outbox_event_id: str | None = None
    direct_receipt_review_ids: tuple[str, ...] = ()
    swarm_runs: tuple[SwarmRunArtifact, ...] = ()


@dataclass(frozen=True)
class ExecutionStateProjection:
    execution_state: ExecutionState
    quarantined: bool
    reason: str
    rule: str
    terminal: bool
    selected_attempt: int | None = None
    selected_event_type: str | None = None


@dataclass(frozen=True)
class _TerminalSelection:
    event: ExecutionEventFact | None
    attempt: int | None
    invalid_reason: str | None = None


def _select_terminal(events: Iterable[ExecutionEventFact]) -> _TerminalSelection:
    terminals = [event for event in events if event.event_type in _TERMINAL_EVENT_TYPES]
    invalid = []
    numbered: list[tuple[int, ExecutionEventFact]] = []
    unnumbered: list[ExecutionEventFact] = []
    for event in terminals:
        if "attempt" not in event.payload:
            unnumbered.append(event)
            continue
        attempt = event.payload["attempt"]
        if isinstance(attempt, bool) or not isinstance(attempt, int) or attempt < 1:
            invalid.append(event)
            continue
        numbered.append((attempt, event))

    if invalid:
        return _TerminalSelection(
            event=None,
            attempt=None,
            invalid_reason="terminal event contains an invalid attempt number",
        )
    if numbered:
        highest_attempt = max(attempt for attempt, _event in numbered)
        same_attempt = [
            event for attempt, event in numbered if attempt == highest_attempt
        ]
        selected = max(same_attempt, key=lambda event: event.sequence)
        return _TerminalSelection(event=selected, attempt=highest_attempt)
    if len(unnumbered) == 1:
        return _TerminalSelection(event=unnumbered[0], attempt=None)
    if len(unnumbered) > 1:
        return _TerminalSelection(
            event=None,
            attempt=None,
            invalid_reason=(
                "multiple legacy terminal events have no attempt number"
            ),
        )
    return _TerminalSelection(event=None, attempt=None)


def _swarm_run(
    artifacts: ExecutionArtifacts, run_id: object
) -> SwarmRunArtifact | None:
    if not isinstance(run_id, str) or not run_id:
        return None
    return next((run for run in artifacts.swarm_runs if run.run_id == run_id), None)


def matching_execution_state_rules(
    *,
    mode: str,
    events: Sequence[ExecutionEventFact],
    artifacts: ExecutionArtifacts,
) -> tuple[str, ...]:
    """Return the one ordered-table row selected by these durable facts."""

    terminal = _select_terminal(events)
    matches: list[str] = []
    if mode not in {"direct", "council"} or terminal.invalid_reason:
        matches.append("inconsistent_input")
    elif terminal.event is not None:
        event = terminal.event
        event_outbox_id = event.payload.get("outbox_event_id")
        if terminal.attempt is not None and (
            not isinstance(event_outbox_id, str)
            or event_outbox_id != artifacts.outbox_event_id
        ):
            matches.append("terminal_generation_mismatch")
        elif event.event_type == "dispatch.failed":
            matches.append("terminal_failed")
        elif event.event_type in {
            "dispatch.receipt_only",
            "memorial.direct_completed",
        }:
            review_id = event.payload.get("review_id")
            if (
                mode == "direct"
                and isinstance(review_id, str)
                and review_id in artifacts.direct_receipt_review_ids
            ):
                matches.append("direct_receipt_proved")
            else:
                matches.append("direct_receipt_inconsistent")
        elif event.event_type == "reports.completed":
            run = _swarm_run(artifacts, event.payload.get("swarm_run_id"))
            valid_run = bool(
                mode == "council"
                and run is not None
                and run.status in {"completed", "quality_blocked"}
                and run.finished
                and run.has_quality_result
                and run.task_statuses
                and len(run.task_outputs_present) == len(run.task_statuses)
                and all(run.task_outputs_present)
            )
            if valid_run and all(status == "completed" for status in run.task_statuses):
                matches.append("council_artifacts_complete")
            elif valid_run and any(
                status == "completed" for status in run.task_statuses
            ):
                matches.append("council_artifacts_partial")
            else:
                matches.append("council_artifacts_inconsistent")
    elif artifacts.outbox_status == "pending":
        matches.append("outbox_queued")
    elif artifacts.outbox_status == "processing":
        matches.append("outbox_running")
    elif artifacts.outbox_status in {"failed", "dead_letter"}:
        matches.append("legacy_outbox_failed")

    if not matches:
        matches.append("inconsistent_catch_all")
    return tuple(matches)


_RULE_RESULTS: dict[str, tuple[ExecutionState, bool, str]] = {
    "inconsistent_input": (
        "inconsistent",
        True,
        "mode or attempt metadata is outside the frozen execution vocabulary",
    ),
    "terminal_failed": (
        "failed",
        False,
        "the highest execution attempt ended in dispatch.failed",
    ),
    "terminal_generation_mismatch": (
        "inconsistent",
        True,
        "an attempt terminal is not bound to the selected outbox generation",
    ),
    "direct_receipt_proved": (
        "receipt_only",
        False,
        "direct routing produced a receipt but no asynchronous execution artifact",
    ),
    "direct_receipt_inconsistent": (
        "inconsistent",
        True,
        "a direct terminal lacks a matching direct receipt artifact or mode",
    ),
    "council_artifacts_complete": (
        "completed",
        False,
        "reports.completed is paired with complete swarm and quality artifacts",
    ),
    "council_artifacts_partial": (
        "inconsistent",
        True,
        "partial council artifacts are not a legal committed worker state",
    ),
    "council_artifacts_inconsistent": (
        "inconsistent",
        True,
        "reports.completed lacks the required council execution artifacts",
    ),
    "outbox_queued": (
        "queued",
        False,
        "the durable outbox event is waiting to be claimed",
    ),
    "outbox_running": (
        "running",
        False,
        "the durable outbox event is currently claimed",
    ),
    "legacy_outbox_failed": (
        "failed",
        False,
        "a legacy outbox failure predates attempt-scoped terminal events",
    ),
    "inconsistent_catch_all": (
        "inconsistent",
        True,
        "durable facts do not match any frozen execution-state row",
    ),
}

_ALWAYS_TERMINAL_RULES = frozenset(
    {"direct_receipt_proved", "council_artifacts_complete"}
)


def derive_execution_state(
    *,
    mode: str,
    events: Sequence[ExecutionEventFact],
    artifacts: ExecutionArtifacts,
) -> ExecutionStateProjection:
    """Apply the total, first-match-wins execution-state decision table."""

    matches = matching_execution_state_rules(
        mode=mode,
        events=events,
        artifacts=artifacts,
    )
    if len(matches) != 1:
        raise AssertionError(f"execution-state table matched {len(matches)} rows: {matches}")
    rule = matches[0]
    state, quarantined, reason = _RULE_RESULTS[rule]
    terminal = _select_terminal(events)
    is_terminal = rule in _ALWAYS_TERMINAL_RULES or (
        rule in {"terminal_failed", "legacy_outbox_failed"}
        and artifacts.outbox_status == "dead_letter"
    )
    return ExecutionStateProjection(
        execution_state=state,
        quarantined=quarantined,
        reason=(terminal.invalid_reason or reason),
        rule=rule,
        terminal=is_terminal,
        selected_attempt=terminal.attempt,
        selected_event_type=(
            terminal.event.event_type if terminal.event is not None else None
        ),
    )


def derive_execution_state_from_db(
    db,
    *,
    task_id: str,
    decision_id: str,
    mode: str,
) -> ExecutionStateProjection:
    """Load generation-bound durable facts and derive one execution state."""

    import json

    from src.db.models import (
        CourtReview,
        DecreeExecutionEvent,
        OutboxEvent,
        SwarmQualityResult,
        SwarmRun,
        SwarmTaskRun,
    )

    outbox = (
        db.query(OutboxEvent)
        .filter_by(task_id=task_id, decision_id=decision_id)
        .order_by(OutboxEvent.created_at.desc())
        .first()
    )
    outbox_count = db.query(OutboxEvent).filter_by(task_id=task_id).count()
    rows = (
        db.query(DecreeExecutionEvent)
        .filter_by(task_id=task_id)
        .order_by(DecreeExecutionEvent.sequence)
        .all()
    )
    events: list[ExecutionEventFact] = []
    for row in rows:
        try:
            payload = json.loads(row.payload_json or "{}")
        except (TypeError, ValueError):
            payload = {"_invalid_payload": True}
        if not isinstance(payload, dict):
            payload = {"_invalid_payload": True}
        # Attempt-bearing terminals are scoped to one exact outbox generation.
        # Old generations remain visible in the timeline but cannot outrank the
        # currently selected decision's execution attempt.
        if (
            outbox is not None
            and row.event_type in _TERMINAL_EVENT_TYPES
            and "attempt" in payload
            and payload.get("outbox_event_id") != outbox.id
        ):
            continue
        if (
            outbox is not None
            and row.event_type in _TERMINAL_EVENT_TYPES
            and "attempt" not in payload
            and (
                outbox_count > 1
                or (
                    row.event_type == "memorial.direct_completed"
                    and mode != "direct"
                )
                or (row.event_type == "reports.completed" and mode != "council")
            )
        ):
            # A legacy terminal has no generation key. It is readable only when
            # one outbox generation exists and its literal agrees with the
            # current route mode; otherwise treating it as current would guess.
            continue
        events.append(
            ExecutionEventFact(
                event_type=row.event_type,
                sequence=row.sequence,
                payload=payload,
            )
        )

    direct_review_ids = tuple(
        review.id
        for review in db.query(CourtReview)
        .filter_by(task_id=task_id, review_status="direct_completed")
        .all()
        if review.memorial_json
    )

    swarm_artifacts = []
    for run in db.query(SwarmRun).filter_by(task_id=task_id).all():
        task_runs = db.query(SwarmTaskRun).filter_by(swarm_run_id=run.id).all()
        has_quality = (
            db.query(SwarmQualityResult).filter_by(swarm_run_id=run.id).first()
            is not None
        )
        swarm_artifacts.append(
            SwarmRunArtifact(
                run_id=run.id,
                status=run.status,
                task_statuses=tuple(item.status for item in task_runs),
                finished=bool(run.finished_at),
                task_outputs_present=tuple(
                    bool(item.output_json) for item in task_runs
                ),
                has_quality_result=has_quality,
            )
        )

    return derive_execution_state(
        mode=mode,
        events=events,
        artifacts=ExecutionArtifacts(
            outbox_status=outbox.status if outbox is not None else None,
            outbox_event_id=outbox.id if outbox is not None else None,
            direct_receipt_review_ids=direct_review_ids,
            swarm_runs=tuple(swarm_artifacts),
        ),
    )
