"""P4.5b contract for attempt-aware execution-state projection."""

from __future__ import annotations

import ast
import json
from itertools import product
from pathlib import Path


def _event(event_type: str, sequence: int, **payload):
    from src.execution_state import ExecutionEventFact

    return ExecutionEventFact(
        event_type=event_type,
        sequence=sequence,
        payload=payload,
    )


def test_frozen_decree_event_vocabulary_matches_production_writers():
    backend_root = Path(__file__).resolve().parent.parent
    sources = (
        backend_root / "src/chancellor/decree_status.py",
        backend_root / "src/execution/canonical_court_dispatch.py",
        backend_root / "src/execution/outbox_worker.py",
        backend_root / "web/routers/chaotang.py",
        backend_root / "web/routers/shangshufang.py",
    )
    actual = {"timeline.note"}
    for path in sources:
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                for keyword in node.keywords:
                    if keyword.arg != "event_type":
                        continue
                    actual.update(
                        child.value
                        for child in ast.walk(keyword.value)
                        if isinstance(child, ast.Constant)
                        and isinstance(child.value, str)
                    )
            if (
                isinstance(node, ast.Assign)
                and any(
                    isinstance(target, ast.Name) and target.id == "event_types"
                    for target in node.targets
                )
                and isinstance(node.value, ast.Dict)
            ):
                actual.update(
                    value.value
                    for value in node.value.values
                    if isinstance(value, ast.Constant)
                    and isinstance(value.value, str)
                )

    assert actual == {
        "decision.adopted",
        "decision.cancelled",
        "decision.evidence_requested",
        "decision.recorded",
        "decision.recheck_requested",
        "decision.rejected",
        "dispatch.failed",
        "dispatch.queued",
        "dispatch.receipt_only",
        "dispatch.started",
        "evidence.rework",
        "memorial.blocked",
        "memorial.direct_completed",
        "memorial.formalized",
        "quality.blocked",
        "quality.passed",
        "reports.completed",
        "route.council",
        "route.direct",
        "routing.decided",
        "timeline.note",
    }


def _artifacts(
    *,
    outbox_status: str | None = "completed",
    outbox_event_id: str | None = "outbox-1",
    direct_reviews: tuple[str, ...] = (),
    run_status: str | None = None,
    task_statuses: tuple[str, ...] = (),
    quality: bool = False,
):
    from src.execution_state import ExecutionArtifacts, SwarmRunArtifact

    runs = ()
    if run_status is not None:
        runs = (
            SwarmRunArtifact(
                run_id="run-1",
                status=run_status,
                task_statuses=task_statuses,
                finished=True,
                task_outputs_present=tuple(True for _status in task_statuses),
                has_quality_result=quality,
            ),
        )
    return ExecutionArtifacts(
        outbox_status=outbox_status,
        outbox_event_id=outbox_event_id,
        direct_receipt_review_ids=direct_reviews,
        swarm_runs=runs,
    )


def test_six_frozen_real_paths_have_honest_states():
    from src.execution_state import derive_execution_state

    direct = derive_execution_state(
        mode="direct",
        events=[
            _event(
                "dispatch.receipt_only",
                2,
                attempt=1,
                outbox_event_id="outbox-1",
                review_id="review-1",
            )
        ],
        artifacts=_artifacts(direct_reviews=("review-1",)),
    )
    council_success = derive_execution_state(
        mode="council",
        events=[
            _event(
                "reports.completed",
                4,
                attempt=1,
                outbox_event_id="outbox-1",
                swarm_run_id="run-1",
            )
        ],
        artifacts=_artifacts(
            run_status="completed",
            task_statuses=("completed", "completed"),
            quality=True,
        ),
    )
    council_failure = derive_execution_state(
        mode="council",
        events=[
            _event(
                "dispatch.failed",
                3,
                attempt=1,
                outbox_event_id="outbox-1",
                error="provider down",
            )
        ],
        artifacts=_artifacts(outbox_status="failed"),
    )
    council_partial = derive_execution_state(
        mode="council",
        events=[
            _event(
                "reports.completed",
                4,
                attempt=1,
                outbox_event_id="outbox-1",
                swarm_run_id="run-1",
            )
        ],
        artifacts=_artifacts(
            run_status="completed",
            task_statuses=("completed", "failed"),
            quality=True,
        ),
    )
    receipt_then_real_execution = derive_execution_state(
        mode="council",
        events=[
            _event("memorial.direct_completed", 1, review_id="review-legacy"),
            _event(
                "reports.completed",
                5,
                attempt=1,
                outbox_event_id="outbox-1",
                swarm_run_id="run-1",
            ),
        ],
        artifacts=_artifacts(
            direct_reviews=("review-legacy",),
            run_status="completed",
            task_statuses=("completed",),
            quality=True,
        ),
    )
    retry_success = derive_execution_state(
        mode="council",
        events=[
            # Zombie attempt 1 lands later and receives the larger sequence.
            _event(
                "reports.completed",
                8,
                attempt=2,
                outbox_event_id="outbox-1",
                swarm_run_id="run-1",
            ),
            _event(
                "dispatch.failed",
                9,
                attempt=1,
                outbox_event_id="outbox-1",
                error="late old worker",
            ),
        ],
        artifacts=_artifacts(
            run_status="completed",
            task_statuses=("completed",),
            quality=True,
        ),
    )

    assert direct.execution_state == "receipt_only"
    assert council_success.execution_state == "completed"
    assert council_failure.execution_state == "failed"
    assert council_partial.execution_state == "inconsistent"
    assert council_partial.quarantined is True
    assert receipt_then_real_execution.execution_state == "completed"
    assert retry_success.execution_state == "completed"
    assert retry_success.selected_attempt == 2
    assert not any(
        result.quarantined
        for result in (
            direct,
            council_success,
            council_failure,
            receipt_then_real_execution,
            retry_success,
        )
    )


def test_legacy_single_terminal_is_readable_but_cross_generation_is_quarantined():
    from src.execution_state import derive_execution_state

    single = derive_execution_state(
        mode="direct",
        events=[_event("memorial.direct_completed", 1, review_id="review-legacy")],
        artifacts=_artifacts(
            outbox_status=None,
            outbox_event_id=None,
            direct_reviews=("review-legacy",),
        ),
    )
    ambiguous = derive_execution_state(
        mode="council",
        events=[
            _event("reports.completed", 4, swarm_run_id="run-1"),
            _event("dispatch.failed", 5, error="legacy retry"),
        ],
        artifacts=_artifacts(
            run_status="completed",
            task_statuses=("completed",),
            quality=True,
        ),
    )

    assert single.execution_state == "receipt_only"
    assert single.selected_attempt is None
    assert ambiguous.execution_state == "inconsistent"
    assert ambiguous.quarantined is True


def test_same_attempt_uses_sequence_but_success_without_artifacts_fails_closed():
    from src.execution_state import derive_execution_state

    same_attempt = derive_execution_state(
        mode="council",
        events=[
            _event(
                "dispatch.failed",
                4,
                attempt=3,
                outbox_event_id="outbox-1",
                error="first terminal",
            ),
            _event(
                "reports.completed",
                5,
                attempt=3,
                outbox_event_id="outbox-1",
                swarm_run_id="run-1",
            ),
        ],
        artifacts=_artifacts(
            run_status="completed",
            task_statuses=("completed",),
            quality=True,
        ),
    )
    missing_artifacts = derive_execution_state(
        mode="council",
        events=[
            _event(
                "reports.completed",
                5,
                attempt=1,
                outbox_event_id="outbox-1",
                swarm_run_id="missing",
            )
        ],
        artifacts=_artifacts(),
    )

    assert same_attempt.execution_state == "completed"
    assert same_attempt.selected_attempt == 3
    assert missing_artifacts.execution_state == "inconsistent"
    assert missing_artifacts.quarantined is True


def test_ordered_rule_table_is_total_and_selects_exactly_one_rule():
    from src.execution_state import (
        derive_execution_state,
        matching_execution_state_rules,
    )

    modes = ("direct", "council", "invented")
    terminals = (
        (),
        (_event("dispatch.failed", 1, attempt=1, outbox_event_id="outbox-1"),),
        (
            _event(
                "dispatch.receipt_only",
                1,
                attempt=1,
                outbox_event_id="outbox-1",
                review_id="review-1",
            ),
        ),
        (
            _event(
                "reports.completed",
                1,
                attempt=1,
                outbox_event_id="outbox-1",
                swarm_run_id="run-1",
            ),
        ),
        (
            _event(
                "reports.completed",
                1,
                attempt="bad",
                outbox_event_id="outbox-1",
                swarm_run_id="run-1",
            ),
        ),
    )
    outbox_statuses = (None, "pending", "processing", "failed", "completed")
    direct_receipts = ((), ("review-1",))
    task_statuses = ((), ("completed",), ("completed", "failed"))

    for mode, events, outbox, direct, tasks in product(
        modes, terminals, outbox_statuses, direct_receipts, task_statuses
    ):
        artifacts = _artifacts(
            outbox_status=outbox,
            direct_reviews=direct,
            run_status="completed" if tasks else None,
            task_statuses=tasks,
            quality=bool(tasks),
        )
        matches = matching_execution_state_rules(
            mode=mode,
            events=events,
            artifacts=artifacts,
        )
        assert len(matches) == 1, (mode, events, artifacts, matches)
        projection = derive_execution_state(
            mode=mode,
            events=events,
            artifacts=artifacts,
        )
        assert projection.rule == matches[0]


def test_worker_records_attempt_scoped_failure_and_direct_receipt_terminals(
    isolated_session_local,
):
    from src.db.models import CourtReview, DecisionTask, DecreeExecutionEvent
    from src.execution.decree_dispatcher import enqueue_dispatch
    from src.execution.outbox_worker import process_event

    db = isolated_session_local()
    now = "2026-07-16T00:00:00+00:00"
    db.add_all(
        [
            DecisionTask(
                id="task-failure",
                user_id="tester",
                raw_question="会审失败路径",
                status="edict_recorded",
                source_label="LIVE",
            ),
            DecisionTask(
                id="task-direct",
                user_id="tester",
                raw_question="直接回执路径",
                status="direct_completed",
                source_label="LIVE",
            ),
            CourtReview(
                id="review-direct",
                task_id="task-direct",
                routing_plan_json='{"route":{"mode":"direct"}}',
                review_status="direct_completed",
                ministry_outputs_json="[]",
                conflict_summary_json="[]",
                memorial_json='{"title":"直接回执"}',
                created_at=now,
                updated_at=now,
            ),
        ]
    )
    failed_id = enqueue_dispatch(
        db,
        task_id="task-failure",
        decision_id="decision-failure",
        event_type="route.council",
    )
    direct_id = enqueue_dispatch(
        db,
        task_id="task-direct",
        decision_id="decision-direct",
        event_type="route.direct",
    )
    db.commit()

    assert process_event(db, failed_id)["status"] == "failed"
    assert process_event(db, direct_id)["status"] == "completed"

    rows = {
        row.event_type: row
        for row in db.query(DecreeExecutionEvent)
        .filter(DecreeExecutionEvent.task_id.in_(["task-failure", "task-direct"]))
        .all()
    }
    assert set(rows) == {"dispatch.failed", "dispatch.receipt_only"}
    failure_payload = json.loads(rows["dispatch.failed"].payload_json)
    direct_payload = json.loads(rows["dispatch.receipt_only"].payload_json)
    assert failure_payload["attempt"] == 1
    assert failure_payload["outbox_event_id"] == failed_id
    assert direct_payload["attempt"] == 1
    assert direct_payload["outbox_event_id"] == direct_id
    assert direct_payload["review_id"] == "review-direct"
    assert rows["dispatch.failed"].idempotency_key.endswith(":attempt:1")
    assert rows["dispatch.receipt_only"].idempotency_key.endswith(":attempt:1")
    db.close()
