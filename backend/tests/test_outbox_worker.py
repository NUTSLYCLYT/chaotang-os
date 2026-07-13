"""阶段2验收：outbox worker 幂等消费、重试上限、死信状态。

见 docs/super-chancellor-routing-implementation-plan-2026-07-10.md 第6.7节
worker 要求：幂等消费、最大重试次数和死信状态。
"""

from __future__ import annotations

from unittest.mock import patch

from src.execution.decree_dispatcher import enqueue_dispatch
from src.execution.outbox_worker import process_event, process_pending_events


def _seed_direct_task(db, task_id: str = "task_direct_1"):
    from src.db.models import DecisionTask

    db.add(
        DecisionTask(
            id=task_id,
            user_id="tester",
            raw_question="草拟一份内部通知",
            status="edict_recorded",
            source_label="LIVE",
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
    event_id = enqueue_dispatch(
        db, task_id="task_direct_1", decision_id="dec_1", event_type="route.direct"
    )
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


def test_process_pending_events_skips_exhausted_failed_events(isolated_session_local):
    from src.db.models import OutboxEvent

    db = isolated_session_local()
    _seed_direct_task(db, task_id="task_batch")
    event_id = enqueue_dispatch(
        db, task_id="task_batch", decision_id="dec_batch", event_type="route.bad"
    )
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

    with patch(
        "src.swarm_execution_loop.run_swarm_execution_loop",
        return_value=fake_swarm_result,
    ), patch("src.swarm_persistence.persist_swarm_execution_result"), patch(
        "src.swarm_persistence.attach_swarm_result_to_review",
        side_effect=attach_candidate,
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

    with patch(
        "src.swarm_execution_loop.run_swarm_execution_loop",
        return_value=fake_swarm_result,
    ) as mock_run, patch("src.swarm_persistence.persist_swarm_execution_result"), patch(
        "src.swarm_persistence.attach_swarm_result_to_review"
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
