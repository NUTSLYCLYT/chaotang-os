"""R0-REQ-018：硬重试上限打满(dead_letter)必须进入明确终态或人工接管，
不得停留在 "executing" 假装还在跑，也不得静默重试。

2026-07-23 修复前：outbox_worker.py 的 apply_failure_state 只写
OutboxEvent.status，从不碰 DecisionTask.status——dead_letter 后
current_stage 会一直停在 "executing"，跟这条 REQ 直接冲突。
"""

from __future__ import annotations

from unittest.mock import patch

from fastapi.testclient import TestClient

from src.chancellor.contracts import RouteDecisionV2
from src.db.models import ChancellorRouteDecision, CourtReview, DecisionTask
from src.execution.decree_dispatcher import enqueue_dispatch
from src.execution.outbox_worker import process_event
from web.main import app


def _seed_council_task(db, *, task_id: str):
    review_id = f"review_{task_id}"
    db.add(
        DecisionTask(
            id=task_id,
            user_id="1",
            raw_question="请复核这份合同的违约责任和合规风险",
            status="edict_recorded",
            source_label="LIVE",
        )
    )
    db.add(
        CourtReview(
            id=review_id,
            task_id=task_id,
            routing_plan_json='{"route":{"mode":"council"}}',
            review_status="edict_recorded",
            ministry_outputs_json="[]",
            conflict_summary_json="[]",
            memorial_json="{}",
            created_at="2026-07-23T00:00:00+00:00",
            updated_at="2026-07-23T00:00:00+00:00",
        )
    )
    decision = RouteDecisionV2(
        decision_id=f"dec_{task_id}",
        task_id=task_id,
        mode="council",
        strategy="parallel_review",
        primary_department="刑部",
        participants=[],
        reason_summary="需要刑部会审合同风险",
        complexity_score=0.5,
        confidence=0.8,
        human_confirmation_required=True,
        capability_snapshot_version="v1",
        source_label="LIVE",
        created_at="2026-07-23T00:00:00+00:00",
    )
    db.add(
        ChancellorRouteDecision(
            decision_id=f"dec_{task_id}",
            task_id=task_id,
            idempotency_key=f"idem_{task_id}",
            mode="council",
            primary_department="刑部",
            source_label="LIVE",
            decision_json=decision.model_dump_json(),
        )
    )
    db.commit()
    return review_id


def test_dead_letter_promotes_task_to_execution_failed_and_status_reflects_it(
    isolated_session_local,
):
    db = isolated_session_local()
    task_id = "task_dead_letter_execution_failed"
    _seed_council_task(db, task_id=task_id)
    event_id = enqueue_dispatch(
        db, task_id=task_id, decision_id=f"dec_{task_id}", event_type="route.council"
    )
    db.commit()

    from src.db.models import OutboxEvent

    event = db.query(OutboxEvent).filter_by(id=event_id).one()
    # 已经失败过 max_attempts-1 次：这次再失败就会打满上限进 dead_letter。
    event.attempts = event.max_attempts - 1
    db.commit()

    with patch(
        "src.swarm_execution_loop.run_swarm_execution_loop",
        side_effect=RuntimeError("provider 故障，模拟真实调用失败"),
    ):
        result = process_event(db, event_id)

    assert result["status"] == "dead_letter"
    db.commit()

    task = db.query(DecisionTask).filter_by(id=task_id).one()
    assert task.status == "execution_failed"

    client = TestClient(app)
    response = client.get(f"/api/shangshufang/tasks/{task_id}/status")
    status = response.json()["data"]["execution_status"]
    assert status is not None
    assert status["current_stage"] == "execution_failed"
    assert status["current_owner"] == "人工"
    assert status["blocked_reason"] is not None
    assert "provider 故障，模拟真实调用失败" in status["blocked_reason"]
    assert status["next_stage"] is None


def test_execution_failed_never_overwrites_an_already_archived_task(
    isolated_session_local,
):
    """终态之间不互相覆盖：任务已经 archived 后，一个迟到/残留的 outbox
    dead_letter 事件不得把它拽回 execution_failed。"""
    db = isolated_session_local()
    task_id = "task_dead_letter_after_archive"
    _seed_council_task(db, task_id=task_id)
    task = db.query(DecisionTask).filter_by(id=task_id).one()
    task.status = "archived"
    db.commit()

    from src.execution.outbox_worker import _promote_task_to_execution_failed

    _promote_task_to_execution_failed(db, task_id)
    db.commit()

    assert db.query(DecisionTask).filter_by(id=task_id).one().status == "archived"
