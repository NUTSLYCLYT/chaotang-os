"""阶段2验收：outbox worker 幂等消费、重试上限、死信状态。

见 docs/super-chancellor-routing-implementation-plan-2026-07-10.md 第6.7节
worker 要求：幂等消费、最大重试次数和死信状态。
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

from src.execution.decree_dispatcher import enqueue_dispatch
from src.execution.outbox_worker import process_event, process_pending_events


@pytest.mark.parametrize(
    ("dialect_name", "expected_statements"),
    [
        ("postgresql", ["LOCK TABLE court_loop_runs IN SHARE MODE"]),
        ("sqlite", []),
    ],
)
def test_mission_publication_lock_matches_supported_dialect(
    dialect_name,
    expected_statements,
):
    from types import SimpleNamespace

    from src.contract_rework import _lock_mission_publication

    class _Database:
        def __init__(self):
            self.statements: list[str] = []

        def get_bind(self):
            return SimpleNamespace(dialect=SimpleNamespace(name=dialect_name))

        def execute(self, statement):
            self.statements.append(str(statement))

    db = _Database()
    _lock_mission_publication(db)
    assert db.statements == expected_statements


def test_mission_publication_lock_fails_closed_for_unknown_dialect():
    from types import SimpleNamespace

    from src.contract_rework import _lock_mission_publication

    class _Database:
        def get_bind(self):
            return SimpleNamespace(dialect=SimpleNamespace(name="unknown-db"))

    with pytest.raises(RuntimeError, match="unsupported"):
        _lock_mission_publication(_Database())


def _seed_direct_task(db, task_id: str = "task_direct_1"):
    from src.db.models import CourtReview, DecisionTask

    db.add(
        DecisionTask(
            id=task_id,
            user_id="tester",
            raw_question="草拟一份内部通知",
            status="edict_recorded",
            source_label="LIVE",
        )
    )
    db.add(
        CourtReview(
            id=f"review_{task_id}",
            task_id=task_id,
            routing_plan_json='{"route":{"mode":"direct"}}',
            review_status="direct_completed",
            ministry_outputs_json="[]",
            conflict_summary_json="[]",
            memorial_json='{"title":"direct receipt"}',
            created_at="2026-07-16T00:00:00+00:00",
            updated_at="2026-07-16T00:00:00+00:00",
        )
    )
    db.commit()


def test_process_event_not_found_returns_status(isolated_session_local):
    db = isolated_session_local()
    result = process_event(db, "does-not-exist")
    assert result["status"] == "not_found"
    db.close()


def test_direct_event_completes_and_is_idempotent(isolated_session_local):
    db = isolated_session_local()
    _seed_direct_task(db)
    event_id = enqueue_dispatch(db, task_id="task_direct_1", decision_id="dec_1", event_type="route.direct")
    db.commit()

    first = process_event(db, event_id)
    assert first["status"] == "completed"

    # 幂等：同一 event_id 再消费一次应该直接跳过，不重复执行。
    second = process_event(db, event_id)
    assert second["status"] == "completed"
    assert second.get("skipped") is True
    db.close()


def test_unknown_event_type_retries_then_dead_letters(isolated_session_local):
    from src.db.models import OutboxEvent

    db = isolated_session_local()
    _seed_direct_task(db, task_id="task_unknown_type")
    event_id = enqueue_dispatch(
        db,
        task_id="task_unknown_type",
        decision_id="dec_x",
        event_type="route.nonexistent",
    )
    db.commit()
    # max_attempts 默认 3；手动把它调小方便测试快速触底。
    event = db.query(OutboxEvent).filter_by(id=event_id).first()
    event.max_attempts = 2
    db.commit()

    first = process_event(db, event_id)
    assert first["status"] == "failed"

    second = process_event(db, event_id)
    assert second["status"] == "dead_letter"

    # 死信之后再消费应该直接跳过，不再重试。
    third = process_event(db, event_id)
    assert third["status"] == "dead_letter"
    assert third.get("skipped") is True
    db.close()


@pytest.mark.parametrize("corrupt_envelope", [False, True])
def test_parent_valid_rework_payload_is_quarantined_without_task_failure(
    isolated_session_local,
    monkeypatch,
    corrupt_envelope,
):
    import json

    from src.db.models import (
        CourtReview,
        DecisionTask,
        DecreeExecutionEvent,
        FinalMemorial,
        OutboxEvent,
    )

    monkeypatch.setenv("FENGQUN_W05_CONTRACT_REWORK", "1")
    db = isolated_session_local()
    task_id = "task-parent-valid-rework-payload"
    event_id = "outbox-parent-valid-rework-payload"
    db.add(
        DecisionTask(
            id=task_id,
            tenant_id=1,
            user_id="1",
            raw_question="父版本持久化补证任务",
            status="awaiting_evidence",
            source_label="LIVE",
        )
    )
    db.add(
        OutboxEvent(
            id=event_id,
            tenant_id=1,
            task_id=task_id,
            decision_id="decision-parent-valid-rework-payload",
            event_type="evidence.rework",
            generation=9 if corrupt_envelope else 2,
            idempotency_key="evidence-rework:parent-valid-payload",
            status="pending",
            attempts=0,
            max_attempts=3,
            payload_json=json.dumps(
                {
                    "schema_version": "EvidenceReworkGenerationV1",
                    "generation_id": (
                        "wrong-parent-generation-id"
                        if corrupt_envelope
                        else event_id
                    ),
                    "generation": 2,
                    "status": "candidate_ready" if corrupt_envelope else "pending",
                    "prior_final_memorial_content_hash": "a" * 64,
                    "evidence_request": {
                        "reason": "父版本生成的合法补证请求",
                        "followup_question": None,
                    },
                    "affected_sections": ["contract_review"],
                }
            ),
            created_at="2026-07-24T00:00:00+00:00",
            updated_at="2026-07-24T00:00:00+00:00",
        )
    )
    db.commit()

    result = process_event(db, event_id)

    if corrupt_envelope:
        assert result["status"] == "failed"
        event = db.get(OutboxEvent, event_id)
        task = db.get(DecisionTask, task_id)
        assert event.status == "failed"
        assert event.attempts == 1
        assert "durable evidence rework envelope" in (event.last_error or "")
        assert task.status == "awaiting_evidence"
        assert db.query(CourtReview).filter_by(task_id=task_id).count() == 0
        assert db.query(FinalMemorial).filter_by(task_id=task_id).count() == 0
        assert (
            db.query(DecreeExecutionEvent)
            .filter_by(task_id=task_id, event_type="dispatch.failed")
            .count()
            == 1
        )
        db.close()
        return

    assert result["status"] == "superseded"
    assert result["result"] == {
        "fenced": True,
        "reason": "mission_identity_missing",
        "generation": 2,
        "affected_sections": ["contract_review"],
    }
    event = db.get(OutboxEvent, event_id)
    task = db.get(DecisionTask, task_id)
    assert event.status == "superseded"
    assert event.attempts == 0
    assert event.last_error is None
    assert task.status == "awaiting_evidence"
    assert db.query(CourtReview).filter_by(task_id=task_id).count() == 0
    assert db.query(FinalMemorial).filter_by(task_id=task_id).count() == 0
    assert db.query(DecreeExecutionEvent).filter_by(task_id=task_id).count() == 0
    db.close()


def test_failure_finalizer_does_not_leave_processing_when_timeline_recording_fails(
    isolated_session_local,
):
    """Regression for the live 2026-07-17 stuck decree.

    The primary worker failure must be committed even if the richer timeline
    writer also fails.  Error reporting is never allowed to become a second
    exception that strands the event in processing with attempts=0.
    """
    from src.db.models import OutboxEvent

    db = isolated_session_local()
    _seed_direct_task(db, task_id="task_failure_finalizer")
    event_id = enqueue_dispatch(
        db,
        task_id="task_failure_finalizer",
        decision_id="decision_failure_finalizer",
        event_type="route.nonexistent",
    )
    db.commit()

    with patch(
        "src.execution.outbox_worker._record_timeline",
        side_effect=RuntimeError("timeline schema is unavailable"),
    ):
        result = process_event(db, event_id)

    event = db.query(OutboxEvent).filter_by(id=event_id).one()
    assert result["status"] == "failed"
    assert event.status == "failed"
    assert event.attempts == 1
    assert "未知 event_type" in (event.last_error or "")
    db.close()


def test_process_pending_events_skips_exhausted_failed_events(isolated_session_local):
    from src.db.models import OutboxEvent

    db = isolated_session_local()
    _seed_direct_task(db, task_id="task_batch")
    event_id = enqueue_dispatch(db, task_id="task_batch", decision_id="dec_batch", event_type="route.bad")
    db.commit()
    event = db.query(OutboxEvent).filter_by(id=event_id).first()
    event.max_attempts = 1
    db.commit()

    # 先手动打到 dead_letter（1次尝试就耗尽 max_attempts=1）。
    process_event(db, event_id)
    event = db.query(OutboxEvent).filter_by(id=event_id).first()
    assert event.status == "dead_letter"

    # process_pending_events 只扫 pending/failed，dead_letter 不该被再次捞起。
    results = process_pending_events(db, limit=10)
    assert all(r.get("event_id") != event_id for r in results)
    db.close()


def test_stale_processing_reaper_records_attempt_scoped_failure(
    isolated_session_local,
):
    import json

    from src.db.models import DecreeExecutionEvent, OutboxEvent
    from src.execution.outbox_worker import _reap_stale_processing_events

    db = isolated_session_local()
    _seed_direct_task(db, task_id="task_stale")
    event_id = enqueue_dispatch(
        db,
        task_id="task_stale",
        decision_id="decision_stale",
        event_type="route.direct",
    )
    db.commit()
    event = db.query(OutboxEvent).filter_by(id=event_id).one()
    event.status = "processing"
    event.updated_at = "2000-01-01T00:00:00+00:00"
    db.commit()

    assert _reap_stale_processing_events(db) == 1

    event = db.query(OutboxEvent).filter_by(id=event_id).one()
    terminal = db.query(DecreeExecutionEvent).filter_by(task_id="task_stale", event_type="dispatch.failed").one()
    assert event.status == "failed"
    assert event.attempts == 1
    assert json.loads(terminal.payload_json) == {
        "attempt": 1,
        "error_type": "StaleProcessingTimeout",
        "outbox_event_id": event_id,
        "outbox_status": "failed",
    }
    assert terminal.idempotency_key == f"dispatch.failed:{event_id}:attempt:1"
    db.close()


def test_stale_reaper_keeps_event_retryable_when_timeline_write_fails(
    isolated_session_local,
):
    from src.db.models import OutboxEvent
    from src.execution.outbox_worker import _reap_stale_processing_events

    db = isolated_session_local()
    _seed_direct_task(db, task_id="task_stale_timeline_failure")
    event_id = enqueue_dispatch(
        db,
        task_id="task_stale_timeline_failure",
        decision_id="decision_stale_timeline_failure",
        event_type="route.direct",
    )
    db.commit()
    event = db.query(OutboxEvent).filter_by(id=event_id).one()
    event.status = "processing"
    event.updated_at = "2000-01-01T00:00:00+00:00"
    db.commit()

    with patch(
        "src.execution.outbox_worker._record_timeline",
        side_effect=RuntimeError("timeline unavailable"),
    ):
        assert _reap_stale_processing_events(db) == 1

    event = db.query(OutboxEvent).filter_by(id=event_id).one()
    assert event.status == "failed"
    assert event.attempts == 1
    assert "timeline unavailable" in (event.last_error or "")
    db.close()


def test_stale_reaper_never_reclaims_work_claimed_by_this_process(isolated_session_local, monkeypatch):
    from src.db.models import OutboxEvent
    from src.execution import outbox_worker

    db = isolated_session_local()
    _seed_direct_task(db, task_id="task_current_process_lease")
    event_id = enqueue_dispatch(
        db,
        task_id="task_current_process_lease",
        decision_id="decision_current_process_lease",
        event_type="route.direct",
    )
    db.commit()
    event = db.query(OutboxEvent).filter_by(id=event_id).one()
    event.status = "processing"
    event.updated_at = "2000-01-01T00:00:00+00:00"
    db.commit()
    monkeypatch.setattr(outbox_worker, "_PROCESS_STARTED_AT", "1999-01-01T00:00:00+00:00")

    assert outbox_worker._reap_stale_processing_events(db) == 0
    assert db.query(OutboxEvent).filter_by(id=event_id).one().status == "processing"
    db.close()


def test_successful_retry_clears_stale_last_error(isolated_session_local):
    from src.db.models import OutboxEvent

    db = isolated_session_local()
    _seed_direct_task(db, task_id="task_successful_retry")
    event_id = enqueue_dispatch(
        db,
        task_id="task_successful_retry",
        decision_id="decision_successful_retry",
        event_type="route.direct",
    )
    db.commit()
    event = db.query(OutboxEvent).filter_by(id=event_id).one()
    event.status = "failed"
    event.attempts = 1
    event.last_error = "transient failure"
    db.commit()

    assert process_event(db, event_id)["status"] == "completed"

    event = db.query(OutboxEvent).filter_by(id=event_id).one()
    assert event.last_error is None
    db.close()


def test_council_event_runs_swarm_and_updates_task_status(isolated_session_local):
    from src.db.models import CourtReview, DecisionTask

    db = isolated_session_local()
    now = "2026-07-10T00:00:00+00:00"
    db.add(
        DecisionTask(
            id="task_council_1",
            user_id="tester",
            raw_question="这份合同能不能签",
            status="edict_recorded",
            source_label="LIVE",
            draft_edict_json="{}",
        )
    )
    db.add(
        CourtReview(
            id="review_council_1",
            task_id="task_council_1",
            routing_plan_json='{"route": {"mode": "cluster"}, "ministry_candidates": ["刑部"]}',
            review_status="edict_recorded",
            ministry_outputs_json="[]",
            conflict_summary_json="{}",
            memorial_json="{}",
            created_at=now,
            updated_at=now,
        )
    )
    db.commit()

    fake_swarm_result = {
        "swarm_run": {
            "id": "run_1",
            "task_id": "task_council_1",
            "review_id": "review_council_1",
            "source_label": "LIVE_SWARM",
            "route_plan": {"selected_swarms": []},
        },
        "quality_result": {
            "id": "quality_run_1",
            "passed": True,
            "blocking_reasons": [],
        },
    }

    def attach_candidate(session, review_id, _result):
        review = session.query(CourtReview).filter_by(id=review_id).one()
        review.memorial_json = '{"title":"会审奏折","summary":"证据充分"}'

    with (
        patch(
            "src.swarm_execution_loop.run_swarm_execution_loop",
            return_value=fake_swarm_result,
        ),
        patch("src.swarm_persistence.persist_swarm_execution_result"),
        patch(
            "src.swarm_persistence.attach_swarm_result_to_review",
            side_effect=attach_candidate,
        ),
    ):
        event_id = enqueue_dispatch(
            db,
            task_id="task_council_1",
            decision_id="dec_council",
            event_type="route.council",
        )
        db.commit()
        result = process_event(db, event_id)

    assert result["status"] == "completed"
    task = db.query(DecisionTask).filter_by(id="task_council_1").first()
    assert task.status == "awaiting_decision"
    db.close()


def test_council_event_passes_recommended_departments_to_swarm_loop(isolated_session_local):
    """单一事实源修复：draft_edict 阶段算出的 recommended_departments(审计记录用)
    必须真正驱动 run_swarm_execution_loop 的部门选择，而不是让蜂群execution loop
    自己用 route_swarms() 重新扫一遍关键词——否则"记录的参与者"和"实际执行的部门"
    是两套独立推断，只是恰好经常算出同一个结果。"""
    import json

    from src.db.models import CourtReview, DecisionTask

    db = isolated_session_local()
    now = "2026-07-13T00:00:00+00:00"
    db.add(
        DecisionTask(
            id="task_council_dept",
            user_id="tester",
            raw_question="这份合同能不能签",
            status="edict_recorded",
            source_label="LIVE",
            draft_edict_json=json.dumps({"recommended_departments": ["户部", "刑部"]}),
        )
    )
    db.add(
        CourtReview(
            id="review_council_dept",
            task_id="task_council_dept",
            routing_plan_json='{"route": {"mode": "cluster"}, "ministry_candidates": ["户部"]}',
            review_status="edict_recorded",
            ministry_outputs_json="[]",
            conflict_summary_json="{}",
            memorial_json="{}",
            created_at=now,
            updated_at=now,
        )
    )
    db.commit()

    fake_swarm_result = {
        "swarm_run": {"id": "run_2", "route_plan": {"selected_swarms": []}},
        "quality_result": {"passed": True, "blocking_reasons": []},
    }

    with (
        patch(
            "src.swarm_execution_loop.run_swarm_execution_loop",
            return_value=fake_swarm_result,
        ) as mock_run,
        patch("src.swarm_persistence.persist_swarm_execution_result"),
        patch("src.swarm_persistence.attach_swarm_result_to_review"),
    ):
        event_id = enqueue_dispatch(
            db,
            task_id="task_council_dept",
            decision_id="dec_council_dept",
            event_type="route.council",
        )
        db.commit()
        result = process_event(db, event_id)

    assert result["status"] == "completed"
    call_params = mock_run.call_args.args[0]
    assert call_params["department_ids"] == ["户部", "刑部"]
    db.close()


def test_council_event_fences_terminal_task_before_publication(
    isolated_session_local,
):
    from src.db.models import CourtReview, DecisionTask

    db = isolated_session_local()
    task_id = "task_council_terminal_during_swarm"
    review_id = "review_council_terminal_during_swarm"
    now = "2026-07-28T00:00:00+00:00"
    db.add(
        DecisionTask(
            id=task_id,
            tenant_id=1,
            user_id="1",
            raw_question="审查合同",
            status="edict_recorded",
            source_label="LIVE",
            draft_edict_json="{}",
        )
    )
    db.add(
        CourtReview(
            id=review_id,
            tenant_id=1,
            task_id=task_id,
            routing_plan_json='{"route":{"mode":"cluster"}}',
            review_status="edict_recorded",
            ministry_outputs_json="[]",
            conflict_summary_json="[]",
            memorial_json='{"title":"候选奏折"}',
            created_at=now,
            updated_at=now,
        )
    )
    db.commit()
    event_id = enqueue_dispatch(
        db,
        task_id=task_id,
        decision_id="decision_council_terminal_during_swarm",
        event_type="route.council",
    )
    db.commit()
    fake_swarm_result = {
        "swarm_run": {
            "id": "run_council_terminal_during_swarm",
            "task_id": task_id,
            "review_id": review_id,
            "source_label": "LIVE_SWARM",
            "route_plan": {"selected_swarms": []},
        },
        "quality_result": {
            "id": "quality_council_terminal_during_swarm",
            "passed": True,
            "blocking_reasons": [],
        },
    }

    def archive_while_swarm_runs(_params):
        other = isolated_session_local()
        task = other.get(DecisionTask, task_id)
        task.status = "archived"
        task.updated_at = "2026-07-28T00:01:00+00:00"
        other.commit()
        other.close()
        return fake_swarm_result

    with (
        patch(
            "src.swarm_execution_loop.run_swarm_execution_loop",
            side_effect=archive_while_swarm_runs,
        ),
        patch(
            "src.swarm_persistence.persist_swarm_execution_result"
        ) as persist_result,
        patch(
            "src.swarm_persistence.attach_swarm_result_to_review"
        ) as attach_result,
    ):
        result = process_event(db, event_id)

    assert result["status"] == "superseded"
    assert result["result"]["reason"] == "terminal_task"
    assert db.get(DecisionTask, task_id).status == "archived"
    persist_result.assert_not_called()
    attach_result.assert_not_called()
    db.close()


def test_council_event_fences_terminal_task_before_swarm_execution(
    isolated_session_local,
):
    from src.db.models import CourtReview, DecisionTask

    db = isolated_session_local()
    task_id = "task_council_terminal_before_swarm"
    review_id = "review_council_terminal_before_swarm"
    now = "2026-07-28T00:00:00+00:00"
    db.add(
        DecisionTask(
            id=task_id,
            tenant_id=1,
            user_id="1",
            raw_question="审查合同",
            status="archived",
            source_label="LIVE",
            draft_edict_json="{}",
        )
    )
    db.add(
        CourtReview(
            id=review_id,
            tenant_id=1,
            task_id=task_id,
            routing_plan_json='{"route":{"mode":"cluster"}}',
            review_status="awaiting_decision",
            ministry_outputs_json="[]",
            conflict_summary_json="[]",
            memorial_json='{"title":"已归档奏折"}',
            created_at=now,
            updated_at=now,
        )
    )
    db.commit()
    event_id = enqueue_dispatch(
        db,
        task_id=task_id,
        decision_id="decision_council_terminal_before_swarm",
        event_type="route.council",
    )
    db.commit()

    with patch(
        "src.swarm_execution_loop.run_swarm_execution_loop"
    ) as run_swarm:
        result = process_event(db, event_id)

    assert result["status"] == "superseded"
    assert result["result"]["reason"] == "terminal_task"
    run_swarm.assert_not_called()
    db.close()


def test_contract_council_rejects_nullable_review_tenant_before_swarm(
    isolated_session_local,
):
    import json

    from src.db.models import CourtReview, DecisionTask, OutboxEvent

    db = isolated_session_local()
    task_id = "task_contract_council_null_review_tenant"
    review_id = "review_contract_council_null_review_tenant"
    now = "2026-07-28T00:00:00+00:00"
    db.add(
        DecisionTask(
            id=task_id,
            tenant_id=1,
            user_id="1",
            raw_question="审查采购合同",
            status="edict_recorded",
            source_label="LIVE",
            contract_scope_json=json.dumps(
                {
                    "schema_version": "ContractIntakeV1",
                    "jurisdiction": "CN_MAINLAND",
                    "language": "zh-CN",
                    "contract_type": "procurement",
                    "our_role": "buyer",
                    "legal_question": "contract_risk_screening",
                }
            ),
            draft_edict_json="{}",
        )
    )
    db.add(
        CourtReview(
            id=review_id,
            tenant_id=None,
            task_id=task_id,
            routing_plan_json='{"route":{"mode":"cluster"}}',
            review_status="edict_recorded",
            ministry_outputs_json="[]",
            conflict_summary_json="[]",
            memorial_json='{"title":"无租户会审"}',
            created_at=now,
            updated_at=now,
        )
    )
    db.commit()
    event_id = enqueue_dispatch(
        db,
        task_id=task_id,
        decision_id="decision_contract_council_null_review_tenant",
        event_type="route.council",
    )
    db.commit()

    with patch(
        "src.swarm_execution_loop.run_swarm_execution_loop",
        side_effect=AssertionError("contract tenant failure must precede swarm"),
    ) as run_swarm:
        result = process_event(db, event_id)

    assert result["status"] == "failed"
    event = db.get(OutboxEvent, event_id)
    assert event is not None
    assert "contract council requires owned tenant lineage" in (
        event.last_error or ""
    )
    run_swarm.assert_not_called()
    db.close()


def test_council_rechecks_terminal_task_after_started_timeline_commit(
    isolated_session_local,
    monkeypatch,
):
    from src.db.models import CourtReview, DecisionTask

    db = isolated_session_local()
    task_id = "task_council_terminal_after_started_commit"
    review_id = "review_council_terminal_after_started_commit"
    now = "2026-07-28T00:00:00+00:00"
    db.add(
        DecisionTask(
            id=task_id,
            tenant_id=1,
            user_id="1",
            raw_question="审查合同",
            status="edict_recorded",
            source_label="LIVE",
            draft_edict_json="{}",
        )
    )
    db.add(
        CourtReview(
            id=review_id,
            tenant_id=1,
            task_id=task_id,
            routing_plan_json='{"route":{"mode":"cluster"}}',
            review_status="edict_recorded",
            ministry_outputs_json="[]",
            conflict_summary_json="[]",
            memorial_json='{"title":"候选奏折"}',
            created_at=now,
            updated_at=now,
        )
    )
    db.commit()
    event_id = enqueue_dispatch(
        db,
        task_id=task_id,
        decision_id="decision_council_terminal_after_started_commit",
        event_type="route.council",
    )
    db.commit()

    original_refresh = db.refresh
    archived = False

    def archive_before_first_refresh(instance, *args, **kwargs):
        nonlocal archived
        if isinstance(instance, DecisionTask) and not archived:
            archived = True
            other = isolated_session_local()
            other_task = other.get(DecisionTask, task_id)
            other_task.status = "archived"
            other_task.updated_at = "2026-07-28T00:01:00+00:00"
            other.commit()
            other.close()
        return original_refresh(instance, *args, **kwargs)

    monkeypatch.setattr(db, "refresh", archive_before_first_refresh)
    with patch(
        "src.swarm_execution_loop.run_swarm_execution_loop"
    ) as run_swarm:
        result = process_event(db, event_id)

    assert result["status"] == "superseded"
    assert result["result"]["reason"] == "terminal_task"
    run_swarm.assert_not_called()
    db.close()


def test_council_swarm_inputs_come_from_post_timeline_authority_snapshot(
    isolated_session_local,
    monkeypatch,
):
    import json

    from src.db.models import CourtReview, DecisionTask

    db = isolated_session_local()
    task_id = "task_council_post_timeline_inputs"
    review_id = "review_council_post_timeline_inputs"
    now = "2026-07-28T00:00:00+00:00"
    db.add(
        DecisionTask(
            id=task_id,
            tenant_id=1,
            user_id="1",
            raw_question="审查合同",
            status="edict_recorded",
            source_label="LIVE",
            draft_edict_json=json.dumps(
                {"recommended_departments": ["户部"], "snapshot": "before"}
            ),
        )
    )
    db.add(
        CourtReview(
            id=review_id,
            tenant_id=1,
            task_id=task_id,
            routing_plan_json=json.dumps(
                {"route": {"mode": "cluster"}, "snapshot": "before"}
            ),
            review_status="edict_recorded",
            ministry_outputs_json="[]",
            conflict_summary_json="[]",
            memorial_json='{"title":"候选奏折"}',
            created_at=now,
            updated_at=now,
        )
    )
    db.commit()
    event_id = enqueue_dispatch(
        db,
        task_id=task_id,
        decision_id="decision_council_post_timeline_inputs",
        event_type="route.council",
    )
    db.commit()

    original_refresh = db.refresh
    revised = False

    def revise_before_first_refresh(instance, *args, **kwargs):
        nonlocal revised
        if isinstance(instance, DecisionTask) and not revised:
            revised = True
            other = isolated_session_local()
            other_task = other.get(DecisionTask, task_id)
            other_review = other.get(CourtReview, review_id)
            other_task.draft_edict_json = json.dumps(
                {"recommended_departments": ["刑部"], "snapshot": "after"}
            )
            other_task.updated_at = "2026-07-28T00:01:00+00:00"
            other_review.routing_plan_json = json.dumps(
                {"route": {"mode": "cluster"}, "snapshot": "after"}
            )
            other_review.updated_at = "2026-07-28T00:01:00+00:00"
            other.commit()
            other.close()
        return original_refresh(instance, *args, **kwargs)

    captured: list[dict] = []

    def capture_inputs(params):
        captured.append(params)
        raise RuntimeError("stop after input capture")

    monkeypatch.setattr(db, "refresh", revise_before_first_refresh)
    with patch(
        "src.swarm_execution_loop.run_swarm_execution_loop",
        side_effect=capture_inputs,
    ):
        process_event(db, event_id)

    assert captured[0]["confirmed_edict"]["snapshot"] == "after"
    assert captured[0]["review_plan"]["snapshot"] == "after"
    assert captured[0]["department_ids"] == ["刑部"]
    db.close()


def test_council_event_fences_mission_drift_before_publication(
    isolated_session_local,
):
    from src.contract_mission_repository import save_mission_snapshot
    from src.db.models import CourtReview, DecisionTask
    from tests.contract_task_support import contract_mission

    db = isolated_session_local()
    task_id = "task_council_mission_drift"
    review_id = "review_council_mission_drift"
    now = "2026-07-28T00:00:00+00:00"
    task = DecisionTask(
        id=task_id,
        tenant_id=1,
        user_id="1",
        raw_question="审查合同",
        status="edict_recorded",
        source_label="LIVE",
        draft_edict_json="{}",
    )
    db.add(task)
    db.add(
        CourtReview(
            id=review_id,
            tenant_id=1,
            task_id=task_id,
            routing_plan_json='{"route":{"mode":"cluster"}}',
            review_status="edict_recorded",
            ministry_outputs_json="[]",
            conflict_summary_json="[]",
            memorial_json='{"title":"候选奏折"}',
            created_at=now,
            updated_at=now,
        )
    )
    db.flush()
    save_mission_snapshot(
        db,
        task=task,
        mission=contract_mission(task_id),
        state="confirmed",
    )
    db.commit()
    event_id = enqueue_dispatch(
        db,
        task_id=task_id,
        decision_id="decision_council_mission_drift",
        event_type="route.council",
    )
    db.commit()
    fake_swarm_result = {
        "swarm_run": {
            "id": "run_council_mission_drift",
            "task_id": task_id,
            "review_id": review_id,
            "source_label": "LIVE_SWARM",
            "route_plan": {"selected_swarms": []},
        },
        "quality_result": {
            "id": "quality_council_mission_drift",
            "passed": True,
            "blocking_reasons": [],
        },
    }

    def revise_mission_while_swarm_runs(_params):
        other = isolated_session_local()
        other_task = other.get(DecisionTask, task_id)
        revised = contract_mission(task_id).model_copy(update={"revision": 2})
        save_mission_snapshot(
            other,
            task=other_task,
            mission=revised,
            state="confirmed",
        )
        other.commit()
        other.close()
        return fake_swarm_result

    with (
        patch(
            "src.swarm_execution_loop.run_swarm_execution_loop",
            side_effect=revise_mission_while_swarm_runs,
        ),
        patch(
            "src.swarm_persistence.persist_swarm_execution_result"
        ) as persist_result,
        patch(
            "src.swarm_persistence.attach_swarm_result_to_review"
        ) as attach_result,
    ):
        result = process_event(db, event_id)

    assert result["status"] == "superseded"
    assert result["result"]["reason"] == "authority_changed"
    persist_result.assert_not_called()
    attach_result.assert_not_called()
    db.close()


@pytest.mark.parametrize(
    ("capability_active", "mission_present"),
    [(True, True), (True, False), (False, False)],
)
def test_evidence_rework_recomputes_only_declared_contract_section(
    isolated_session_local,
    tmp_path,
    monkeypatch,
    capability_active,
    mission_present,
):
    import hashlib
    import json

    from fastapi.testclient import TestClient

    from src.db.models import (
        CourtReview,
        DecisionTask,
        FinalMemorial,
        OutboxEvent,
        SecureIngestArtifact,
    )
    from tests.fixtures.secure_ingest_fixtures import golden_docx_bytes
    from web.main import app

    db = isolated_session_local()
    task_id = "task_evidence_rework_worker"
    artifact_id = "artifact-evidence-rework-worker"
    artifact_bytes = golden_docx_bytes("付款应在验收完成后七日内支付。")
    artifact_path = tmp_path / "payment-evidence.docx"
    artifact_path.write_bytes(artifact_bytes)
    digest = hashlib.sha256(artifact_bytes).hexdigest()
    prior_memorial = json.dumps(
        {
            "contract_review": {"status": "old"},
            "financial_review": {"status": "keep-me"},
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    prior_final_hash = hashlib.sha256(prior_memorial.encode("utf-8")).hexdigest()
    task = DecisionTask(
        id=task_id,
        tenant_id=1,
        user_id="1",
        raw_question="审查采购合同付款条款",
        status="awaiting_evidence",
        source_label="LIVE",
    )
    db.add(task)
    db.add(
        CourtReview(
            id="review-evidence-rework-worker",
            tenant_id=1,
            task_id=task_id,
            routing_plan_json='{"route":{"mode":"cluster"}}',
            review_status="awaiting_evidence",
            ministry_outputs_json="[]",
            conflict_summary_json="[]",
                memorial_json=prior_memorial,
            created_at="2026-07-24T00:00:00+00:00",
            updated_at="2026-07-24T00:00:00+00:00",
        )
    )
    db.add(
        FinalMemorial(
            id="final-evidence-rework-worker-v1",
            tenant_id=1,
            task_id=task_id,
            review_id="review-evidence-rework-worker",
            swarm_run_id="swarm-evidence-rework-worker-v1",
            quality_result_id="quality-evidence-rework-worker-v1",
            status="awaiting_evidence",
            source_label="LIVE",
            memorial_json=prior_memorial,
            content_hash=prior_final_hash,
            version=1,
            is_current=True,
        )
    )
    db.add(
        SecureIngestArtifact(
            id=artifact_id,
            tenant_id=1,
            user_id="1",
            mission_contract_id=task_id,
            original_filename="付款条件补证.docx",
            declared_content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            detected_format="DOCX_OOXML",
            file_size_bytes=len(artifact_bytes),
            page_count=1,
            digest_sha256=digest,
            status="ACCEPTED",
            ocr_status="NOT_APPLICABLE",
            macro_detected=False,
            zip_bomb_suspected=False,
            injection_flag_categories_json="[]",
            storage_path=str(artifact_path),
            created_at="2026-07-24T00:00:00+00:00",
        )
    )
    generation_id = "outbox-rework-generation-2"
    from tests.contract_task_support import contract_mission

    generation_mission = contract_mission(task_id)
    db.add(
        OutboxEvent(
            id=generation_id,
            tenant_id=1,
            task_id=task_id,
            decision_id="decision-evidence-rework-worker",
            event_type="evidence.rework",
            generation=2,
            idempotency_key="evidence-rework:worker-test",
            status="pending",
            attempts=0,
            max_attempts=3,
            payload_json=json.dumps(
                {
                    "schema_version": "EvidenceReworkGenerationV1",
                    "generation_id": generation_id,
                    "generation": 2,
                    "status": "evidence_bound",
                    "prior_final_memorial_content_hash": prior_final_hash,
                    "mission_revision": generation_mission.revision,
                    "mission_content_digest": generation_mission.content_digest,
                    "evidence_request": {
                        "reason": "补充第 4 页付款条件原文",
                        "followup_question": None,
                    },
                    "affected_sections": ["contract_review"],
                    "contract_scope": {
                        "schema_version": "ContractIntakeV1",
                        "jurisdiction": "CN_MAINLAND",
                        "language": "zh-CN",
                        "contract_type": "procurement",
                        "our_role": "buyer",
                        "legal_question": "contract_risk_screening",
                    },
                    "evidence_packets": [
                        {
                            "schema_version": "EvidencePacketV1",
                            "evidence_packet_id": "evidence-worker-test",
                            "tenant_id": "1",
                            "task_id": task_id,
                            "input_version_id": artifact_id,
                            "input_digest": digest,
                            "prior_final_memorial_content_hash": prior_final_hash,
                            "generation": 2,
                            "evidence_status": "GROUNDED",
                            "source_kind": "USER_UPLOAD",
                            "source_ref": artifact_id,
                            "content_hash": digest,
                            "verification_receipt_id": f"secure-ingest:{artifact_id}:{digest}",
                        }
                    ],
                }
            ),
            created_at="2026-07-24T00:00:00+00:00",
            updated_at="2026-07-24T00:00:00+00:00",
        )
    )
    if mission_present:
        from src.contract_mission_repository import save_mission_snapshot
        from tests.contract_task_support import contract_mission

        db.flush()
        save_mission_snapshot(
            db,
            task=task,
            mission=contract_mission(task_id),
            state="confirmed",
        )
    db.commit()

    monkeypatch.setenv(
        "FENGQUN_W05_CONTRACT_REWORK",
        "1" if capability_active else "0",
    )
    if not capability_active:
        monkeypatch.setattr(
            "src.contract_rework.read_artifact_bytes_at_path",
            lambda _path: pytest.fail("disabled W05 worker must not read evidence"),
        )
    result = process_event(db, generation_id)
    db.close()

    if not capability_active:
        assert result["status"] == "superseded", result
        assert result["result"]["fenced"] is True
        assert result["result"]["reason"] == "capability_disabled"
        status = TestClient(app).get(
            f"/api/shangshufang/tasks/{task_id}/status"
        ).json()["data"]
        assert status["task"]["status"] == "awaiting_evidence"
        assert status["review"]["memorial"]["contract_review"] == {
            "status": "old"
        }
        return
    if not mission_present:
        assert result["status"] == "superseded", result
        assert result["result"]["fenced"] is True
        assert result["result"]["reason"] == "mission_missing"
        status = TestClient(app).get(
            f"/api/shangshufang/tasks/{task_id}/status"
        ).json()["data"]
        assert status["task"]["status"] == "awaiting_evidence"
        assert status["review"]["memorial"]["contract_review"] == {
            "status": "old"
        }
        return

    assert result["status"] == "completed", result
    assert result["result"]["affected_sections"] == ["contract_review"]
    status = TestClient(app).get(
        f"/api/shangshufang/tasks/{task_id}/status"
    ).json()["data"]
    assert status["task"]["status"] == "awaiting_decision"
    assert status["review"]["review_status"] == "awaiting_decision"
    memorial = status["review"]["memorial"]
    assert memorial["financial_review"] == {"status": "keep-me"}
    assert memorial["contract_review"]["schema_version"] == "ContractReviewPackV1"
    assert memorial["contract_review"]["candidate_status"] == "CANDIDATE"
    assert memorial["contract_review"]["quality_gate_status"] == "PASSED"
    risk = memorial["contract_review"]["risk_items"][0]
    assert risk["risk_level"] == "medium"
    assert risk["page_number"] is None
    assert risk["clause_ref"] is None
    assert risk["missing_evidence"] == ["DOCX 文本抽取未提供可靠页码/条款定位"]


def test_late_old_rework_generation_cannot_replace_current_review(
    isolated_session_local,
):
    import json

    from fastapi.testclient import TestClient

    from src.db.models import CourtReview, DecisionTask, OutboxEvent
    from web.main import app

    db = isolated_session_local()
    task_id = "task_old_rework_generation_fenced"
    db.add(
        DecisionTask(
            id=task_id,
            tenant_id=1,
            user_id="1",
            raw_question="审查采购合同",
            status="awaiting_evidence",
            source_label="LIVE",
        )
    )
    db.add(
        CourtReview(
            id="review-old-rework-generation-fenced",
            tenant_id=1,
            task_id=task_id,
            routing_plan_json="{}",
            review_status="awaiting_evidence",
            ministry_outputs_json="[]",
            conflict_summary_json="[]",
            memorial_json='{"contract_review":{"status":"current-unchanged"}}',
            created_at="2026-07-24T00:00:00+00:00",
            updated_at="2026-07-24T00:00:00+00:00",
        )
    )
    base_payload = {
        "schema_version": "EvidenceReworkGenerationV1",
        "status": "evidence_bound",
        "prior_final_memorial_content_hash": "a" * 64,
        "mission_revision": 1,
        "mission_content_digest": "b" * 64,
        "evidence_request": {"reason": "补证", "followup_question": None},
        "affected_sections": ["contract_review"],
        "evidence_packets": [],
    }
    for generation in (2, 3):
        generation_id = f"outbox-rework-fenced-{generation}"
        db.add(
            OutboxEvent(
                id=generation_id,
                tenant_id=1,
                task_id=task_id,
                decision_id=f"decision-rework-fenced-{generation}",
                event_type="evidence.rework",
                generation=generation,
                idempotency_key=f"evidence-rework:fenced-{generation}",
                status="pending" if generation == 2 else "awaiting_evidence",
                attempts=0,
                max_attempts=3,
                payload_json=json.dumps(
                    {
                        **base_payload,
                        "generation_id": generation_id,
                        "generation": generation,
                    }
                ),
                created_at=f"2026-07-24T00:00:0{generation}+00:00",
                updated_at=f"2026-07-24T00:00:0{generation}+00:00",
            )
        )
    db.commit()

    result = process_event(db, "outbox-rework-fenced-2")
    db.close()

    assert result["status"] == "superseded", result
    assert result["result"]["fenced"] is True
    assert result["result"]["current_generation"] == 3
    status = TestClient(app).get(
        f"/api/shangshufang/tasks/{task_id}/status"
    ).json()["data"]
    assert status["task"]["status"] == "awaiting_evidence"
    assert status["review"]["review_status"] == "awaiting_evidence"
    assert status["review"]["memorial"]["contract_review"] == {
        "status": "current-unchanged"
    }


@pytest.mark.parametrize(
    "interruption",
    [
        None,
        "new_generation",
        "capability_disabled",
        "terminal_task",
        "mission_changed",
        "prior_final_changed",
        "mission_same_scope_changed_before_worker",
        "mission_scope_changed_before_worker",
        "prior_final_changed_before_worker",
        "wrong_review_tenant_before_worker",
        "null_review_tenant_before_worker",
    ],
)
def test_supported_contract_rework_public_chain_appends_current_v2(
    isolated_session_local,
    monkeypatch,
    tmp_path,
    interruption,
    w05_contract_user,
):
    """补证必须经公共 API 和真实 worker 形成可裁决 v2，不能靠测试直调 formalize。"""
    import json

    from fastapi.testclient import TestClient

    from src.contract_mission_repository import save_mission_snapshot
    from src.db.models import (
        CourtReview,
        DecisionTask,
        EmperorDecision,
        FinalMemorial,
        OutboxEvent,
        SwarmQualityResult,
        SwarmRun,
    )
    from src.formal_memorial import formalize_memorial
    from tests.contract_task_support import (
        contract_mission,
        contract_review_pack,
        seed_delivery,
    )
    from tests.fixtures.secure_ingest_fixtures import golden_docx_bytes
    from web.main import app

    db = isolated_session_local()
    task_id = "task_supported_contract_rework_public_chain"
    review_id = "review-supported-contract-rework-public-chain"
    task = DecisionTask(
        id=task_id,
        tenant_id=1,
        user_id="1",
        raw_question="审查中国大陆中文采购合同付款条款",
        status="awaiting_decision",
        source_label="LIVE",
        contract_scope_json=json.dumps({
            "schema_version": "ContractIntakeV1",
            "jurisdiction": "CN_MAINLAND",
            "language": "zh-CN",
            "contract_type": "procurement",
            "our_role": "buyer",
            "legal_question": "contract_risk_screening",
        }),
    )
    db.add(task)
    first_pack = contract_review_pack(
        task_id,
        tenant_id="1",
        court_review_id=review_id,
    )
    db.add(
        CourtReview(
            id=review_id,
            tenant_id=1,
            task_id=task_id,
            routing_plan_json='{"route":{"mode":"cluster"}}',
            review_status="awaiting_decision",
            ministry_outputs_json="[]",
            conflict_summary_json="[]",
            memorial_json=json.dumps(
                {
                    "title": "合同会审正式奏折 v1",
                    "summary": "现有付款条款需要补充原文。",
                    "recommendation": "request_evidence",
                    "contract_review": first_pack,
                },
                ensure_ascii=False,
            ),
            created_at="2026-07-24T00:00:00+00:00",
            updated_at="2026-07-24T00:00:00+00:00",
        )
    )
    db.flush()
    save_mission_snapshot(
        db,
        task=task,
        mission=contract_mission(task_id),
        state="confirmed",
    )
    first = formalize_memorial(
        db,
        task_id=task_id,
        review_id=review_id,
        swarm_result={
            "swarm_run": {
                "id": "run-supported-contract-rework-v1",
                "task_id": task_id,
                "review_id": review_id,
                "source_label": "LIVE_SWARM",
            },
            "quality_result": {
                "id": "quality-supported-contract-rework-v1",
                "passed": True,
                "blocking_reasons": [],
                "warnings": [],
            },
        },
    )
    db.flush()
    seed_delivery(
        db,
        storage_root=tmp_path / "artifacts",
        tenant_id=1,
        task_id=task_id,
        final=first,
        pack=first_pack,
    )
    first_hash = first.content_hash
    db.commit()
    db.close()

    monkeypatch.setenv("FENGQUN_RUNTIME_ROOT", str(tmp_path))
    client = TestClient(app)
    requested = client.post(
        f"/api/shangshufang/tasks/{task_id}/decision",
        json={
            "action": "request_evidence",
            "reason": "补充付款条件原文",
            "human_confirmed": True,
            "expected_final_memorial_content_hash": first_hash,
        },
    ).json()
    assert requested["success"] is True, requested
    generation = requested["data"]["rework_generation"]
    assert "mission_revision" not in generation
    assert "mission_content_digest" not in generation

    uploaded = client.post(
        "/api/secure-ingest/upload",
        data={
            "mission_contract_id": task_id,
            "purpose": "evidence_rework",
        },
        files={
            "file": (
                "付款条件补证.docx",
                golden_docx_bytes("付款应在验收完成后七日内支付。"),
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        },
    ).json()
    assert uploaded["status"] == "ACCEPTED", uploaded

    bound = client.post(
        (
            f"/api/shangshufang/tasks/{task_id}/rework-generations/"
            f"{generation['generation_id']}/evidence"
        ),
        json={
            "artifact_id": uploaded["artifact_id"],
            "contract_scope": {
                "jurisdiction": "CN_MAINLAND",
                "language": "zh-CN",
                "contract_type": "procurement",
                "our_role": "buyer",
                "legal_question": "contract_risk_screening",
            },
        },
    ).json()
    assert bound["success"] is True, bound
    assert "mission_revision" not in bound["data"]["rework_generation"]
    assert "mission_content_digest" not in bound["data"]["rework_generation"]

    worker_db = isolated_session_local()
    worker_task = worker_db.get(DecisionTask, task_id)
    durable_generation = json.loads(
        worker_db.get(OutboxEvent, generation["generation_id"]).payload_json
    )
    save_mission_snapshot(
        worker_db,
        task=worker_task,
        mission=contract_mission(task_id),
        state="confirmed",
    )
    if interruption in {
        "mission_same_scope_changed_before_worker",
        "mission_scope_changed_before_worker",
    }:
        from src.contracts.mission_contract import compute_mission_content_digest

        mission_updates = {
            "revision": 2,
            "content_digest": "0" * 64,
        }
        if interruption == "mission_scope_changed_before_worker":
            mission_updates.update(
                {
                    "contract_type": "sales",
                    "our_role": "seller",
                }
            )
        changed_mission = contract_mission(task_id).model_copy(
            update=mission_updates
        )
        changed_mission = changed_mission.model_copy(
            update={
                "content_digest": compute_mission_content_digest(changed_mission),
            }
        )
        save_mission_snapshot(
            worker_db,
            task=worker_task,
            mission=changed_mission,
            state="confirmed",
        )
        worker_db.flush()
    elif interruption == "prior_final_changed_before_worker":
        current_final = (
            worker_db.query(FinalMemorial)
            .filter_by(task_id=task_id, is_current=True)
            .one()
        )
        current_final.content_hash = "f" * 64
        worker_db.flush()
    elif interruption in {
        "wrong_review_tenant_before_worker",
        "null_review_tenant_before_worker",
    }:
        review = worker_db.get(CourtReview, review_id)
        review.tenant_id = (
            2 if interruption == "wrong_review_tenant_before_worker" else None
        )
        worker_db.flush()
    elif interruption is not None:
        import src.contract_rework as contract_rework

        extract_docx_text = contract_rework._extract_docx_text

        def _interrupt_after_initial_fence(raw_bytes):
            text = extract_docx_text(raw_bytes)
            if interruption == "capability_disabled":
                monkeypatch.setenv("FENGQUN_W05_CONTRACT_REWORK", "0")
                return text
            if interruption == "terminal_task":
                worker_task.status = "task_cancelled"
                worker_db.flush()
                return text
            if interruption == "mission_changed":
                from src.contracts.mission_contract import (
                    compute_mission_content_digest,
                )

                mission = contract_mission(task_id).model_copy(
                    update={
                        "revision": 2,
                        "content_digest": "0" * 64,
                    }
                )
                mission = mission.model_copy(
                    update={
                        "content_digest": compute_mission_content_digest(mission),
                    }
                )
                save_mission_snapshot(
                    worker_db,
                    task=worker_task,
                    mission=mission,
                    state="confirmed",
                )
                worker_db.flush()
                return text
            if interruption == "prior_final_changed":
                current_final = (
                    worker_db.query(FinalMemorial)
                    .filter_by(task_id=task_id, is_current=True)
                    .one()
                )
                current_final.content_hash = "e" * 64
                worker_db.flush()
                return text
            newer_id = "outbox-rework-generation-3-mid-processing"
            worker_db.add(
                OutboxEvent(
                    id=newer_id,
                    tenant_id=1,
                    task_id=task_id,
                    decision_id="decision-rework-generation-3-mid-processing",
                    event_type="evidence.rework",
                    generation=3,
                    idempotency_key="evidence-rework:mid-processing-generation-3",
                    status="awaiting_evidence",
                    attempts=0,
                    max_attempts=3,
                    payload_json=json.dumps(
                        {
                            "schema_version": "EvidenceReworkGenerationV1",
                            "generation_id": newer_id,
                            "generation": 3,
                            "status": "awaiting_evidence",
                            "prior_final_memorial_content_hash": first_hash,
                            "mission_revision": durable_generation[
                                "mission_revision"
                            ],
                            "mission_content_digest": durable_generation[
                                "mission_content_digest"
                            ],
                            "evidence_request": {
                                "reason": "处理途中追加的新补证",
                                "followup_question": None,
                            },
                            "affected_sections": ["contract_review"],
                        }
                    ),
                    created_at="2026-07-24T00:00:03+00:00",
                    updated_at="2026-07-24T00:00:03+00:00",
                )
            )
            worker_db.flush()
            return text

        monkeypatch.setattr(
            contract_rework,
            "_extract_docx_text",
            _interrupt_after_initial_fence,
        )
    worker_result = process_event(worker_db, generation["generation_id"])
    worker_db.close()

    if interruption is not None:
        assert worker_result["status"] == "superseded", worker_result
        assert worker_result["result"]["fenced"] is True
        if interruption == "new_generation":
            assert worker_result["result"]["current_generation"] == 3
        elif interruption == "capability_disabled":
            assert worker_result["result"]["reason"] == "capability_disabled"
        elif interruption == "terminal_task":
            assert worker_result["result"]["reason"] == "terminal_task"
            assert worker_result["result"]["task_status"] == "task_cancelled"
        elif interruption == "mission_scope_changed_before_worker":
            assert worker_result["result"]["reason"] == "mission_scope_changed"
        elif interruption == "mission_same_scope_changed_before_worker":
            assert worker_result["result"]["reason"] == "mission_changed"
        elif interruption == "prior_final_changed_before_worker":
            assert worker_result["result"]["reason"] == "prior_final_changed"
        elif interruption == "prior_final_changed":
            assert worker_result["result"]["reason"] == "prior_final_changed"
        elif interruption in {
            "wrong_review_tenant_before_worker",
            "null_review_tenant_before_worker",
        }:
            assert worker_result["result"]["reason"] == "review_lineage_conflict"
        else:
            assert worker_result["result"]["reason"] == "mission_changed"
        db = isolated_session_local()
        versions = db.query(FinalMemorial).filter_by(task_id=task_id).all()
        assert [(row.version, row.is_current) for row in versions] == [(1, True)]
        assert db.query(SwarmRun).filter_by(task_id=task_id).count() == 0
        review = db.query(CourtReview).filter_by(id=review_id).one()
        assert json.loads(review.memorial_json)["contract_review"] == first_pack
        db.close()
        return

    assert worker_result["status"] == "completed", worker_result
    assert worker_result["result"]["quality_gate_status"] == "PASSED"
    assert worker_result["result"]["final_memorial_version"] == 2

    db = isolated_session_local()
    versions = (
        db.query(FinalMemorial)
        .filter_by(task_id=task_id)
        .order_by(FinalMemorial.version)
        .all()
    )
    assert [row.version for row in versions] == [1, 2]
    assert versions[0].content_hash == first_hash
    assert versions[0].status == "superseded"
    assert versions[0].is_current is False
    assert versions[1].status == "ready_for_decision"
    assert versions[1].is_current is True
    assert versions[1].supersedes_id == versions[0].id
    current_pack = json.loads(versions[1].memorial_json)["contract_review"]
    current_mission = contract_mission(task_id)
    assert current_pack["mission_revision"] == current_mission.revision
    assert (
        current_pack["mission_content_digest"]
        == current_mission.content_digest
    )
    assert db.query(SwarmRun).filter_by(id=versions[1].swarm_run_id).one()
    assert (
        db.query(SwarmQualityResult)
        .filter_by(id=versions[1].quality_result_id, passed=True)
        .one()
    )
    db.close()

    replay = client.post(
        f"/api/shangshufang/tasks/{task_id}/decision",
        json={
            "action": "request_evidence",
            "reason": "补充付款条件原文",
            "human_confirmed": True,
            "expected_final_memorial_content_hash": first_hash,
        },
    )
    assert replay.status_code == 200, replay.json()
    replay_generation = replay.json()["data"]["rework_generation"]
    assert replay_generation["generation_id"] == generation["generation_id"]
    assert replay_generation["status"] == "candidate_ready"
    db = isolated_session_local()
    assert db.query(EmperorDecision).filter_by(task_id=task_id).count() == 1
    db.close()


@pytest.mark.parametrize("already_bound", [False, True])
def test_evidence_bind_cannot_replace_frozen_contract_scope(
    isolated_session_local,
    tmp_path,
    w05_contract_user,
    already_bound,
):
    import hashlib
    import json

    from fastapi.testclient import TestClient

    from src.db.models import DecisionTask, OutboxEvent, SecureIngestArtifact
    from web.main import app

    db = isolated_session_local()
    task_id = "task_frozen_contract_scope"
    generation_id = "outbox-frozen-contract-scope"
    artifact_id = "artifact-frozen-contract-scope"
    artifact_path = tmp_path / "scope.docx"
    artifact_path.write_bytes(b"scope")
    digest = hashlib.sha256(b"scope").hexdigest()
    frozen_scope = {
        "schema_version": "ContractIntakeV1",
        "jurisdiction": "CN_MAINLAND",
        "language": "zh-CN",
        "contract_type": "procurement",
        "our_role": "buyer",
    }
    db.add(
        DecisionTask(
            id=task_id,
            tenant_id=1,
            user_id="1",
            raw_question="审查采购合同",
            status="awaiting_evidence",
            source_label="LIVE",
            contract_scope_json=json.dumps(frozen_scope),
        )
    )
    generation_payload = {
        "schema_version": "EvidenceReworkGenerationV1",
        "generation_id": generation_id,
        "generation": 2,
        "status": "pending" if already_bound else "awaiting_evidence",
        "prior_final_memorial_content_hash": "a" * 64,
        "mission_revision": 1,
        "mission_content_digest": "b" * 64,
        "evidence_request": {
            "reason": "补证",
            "followup_question": None,
        },
        "affected_sections": ["contract_review"],
        "contract_scope": frozen_scope,
        "evidence_packets": (
            [
                {
                    "schema_version": "EvidencePacketV1",
                    "evidence_packet_id": "evidence-frozen-contract-scope",
                    "tenant_id": 1,
                    "task_id": task_id,
                    "input_version_id": artifact_id,
                    "input_digest": digest,
                    "prior_final_memorial_content_hash": "a" * 64,
                    "generation": 2,
                    "evidence_status": "GROUNDED",
                    "source_kind": "USER_UPLOAD",
                    "source_ref": artifact_id,
                    "content_hash": digest,
                    "verification_receipt_id": "receipt-frozen-contract-scope",
                }
            ]
            if already_bound
            else []
        ),
    }
    db.add(
        OutboxEvent(
            id=generation_id,
            tenant_id=1,
            task_id=task_id,
            decision_id="decision-frozen-contract-scope",
            event_type="evidence.rework",
            generation=2,
            idempotency_key="evidence-rework:frozen-contract-scope",
            status="pending" if already_bound else "awaiting_evidence",
            attempts=0,
            max_attempts=3,
            payload_json=json.dumps(generation_payload),
            created_at="2026-07-24T00:00:00+00:00",
            updated_at="2026-07-24T00:00:00+00:00",
        )
    )
    db.add(
        SecureIngestArtifact(
            id=artifact_id,
            tenant_id=1,
            user_id="1",
            mission_contract_id=task_id,
            original_filename="scope.docx",
            declared_content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            detected_format="DOCX_OOXML",
            file_size_bytes=5,
            page_count=1,
            digest_sha256=digest,
            status="ACCEPTED",
            ocr_status="NOT_APPLICABLE",
            macro_detected=False,
            zip_bomb_suspected=False,
            injection_flag_categories_json="[]",
            storage_path=str(artifact_path),
            created_at="2026-07-24T00:00:00+00:00",
        )
    )
    db.commit()
    db.close()

    response = TestClient(app).post(
        (
            f"/api/shangshufang/tasks/{task_id}/rework-generations/"
            f"{generation_id}/evidence"
        ),
        json={
            "artifact_id": artifact_id,
            "contract_scope": {
                "jurisdiction": "CN_MAINLAND",
                "language": "zh-CN",
                "contract_type": "sales",
                "our_role": "seller",
            },
        },
    )

    assert response.status_code == 409
    payload = response.json()
    assert payload["success"] is False
    assert "范围已经冻结" in payload["error"]
    db = isolated_session_local()
    task = db.query(DecisionTask).filter_by(id=task_id).one()
    generation = db.query(OutboxEvent).filter_by(id=generation_id).one()
    assert json.loads(task.contract_scope_json) == frozen_scope
    assert generation.status == ("pending" if already_bound else "awaiting_evidence")
    assert json.loads(generation.payload_json) == generation_payload
    db.close()


def test_evidence_binding_claim_prevents_later_payload_overwrite(
    isolated_session_local,
):
    import json

    import web.routers.shangshufang as shangshufang_router
    from src.db.models import DecisionTask, OutboxEvent

    db = isolated_session_local()
    task_id = "task_atomic_evidence_binding"
    generation_id = "outbox-atomic-evidence-binding"
    db.add(
        DecisionTask(
            id=task_id,
            tenant_id=1,
            user_id="1",
            raw_question="审查合同",
            status="awaiting_evidence",
            source_label="LIVE",
        )
    )
    db.add(
        OutboxEvent(
            id=generation_id,
            tenant_id=1,
            task_id=task_id,
            decision_id="decision-atomic-evidence-binding",
            event_type="evidence.rework",
            generation=2,
            idempotency_key="evidence-rework:atomic-evidence-binding",
            status="awaiting_evidence",
            attempts=0,
            max_attempts=3,
            payload_json='{"status":"awaiting_evidence","evidence_packets":[]}',
            created_at="2026-07-24T00:00:00+00:00",
            updated_at="2026-07-24T00:00:00+00:00",
        )
    )
    db.commit()

    claim = getattr(shangshufang_router, "_claim_evidence_binding", None)
    assert callable(claim), "补证绑定缺少数据库原子 claim"
    first_payload = {
        "status": "pending",
        "evidence_packets": [{"input_version_id": "artifact-first"}],
    }
    competing_payload = {
        "status": "pending",
        "evidence_packets": [{"input_version_id": "artifact-competing"}],
    }
    first = claim(
        db,
        task_id=task_id,
        generation_id=generation_id,
        payload_json=json.dumps(first_payload),
        updated_at="2026-07-24T00:01:00+00:00",
    )
    competing = claim(
        db,
        task_id=task_id,
        generation_id=generation_id,
        payload_json=json.dumps(competing_payload),
        updated_at="2026-07-24T00:01:01+00:00",
    )
    db.commit()

    assert first is True
    assert competing is False
    stored = db.query(OutboxEvent).filter_by(id=generation_id).one()
    assert stored.status == "pending"
    assert json.loads(stored.payload_json) == first_payload
    db.close()
