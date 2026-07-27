"""R0-REQ-018：取消是明确的人工接管路径之一。围栏用终态幂等检查——
重复/迟到的 cancel 请求不得重开或破坏已经落定的结果。
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from src.db.models import CourtReview, DecisionTask
from web.main import app


def _seed_task(db, *, task_id: str, status: str = "awaiting_decision"):
    db.add(
        DecisionTask(
            id=task_id,
            tenant_id=1,
            user_id="1",
            raw_question="请复核这份合同的违约责任和合规风险",
            status=status,
            source_label="LIVE",
        )
    )
    db.add(
        CourtReview(
            id=f"review_{task_id}",
            tenant_id=1,
            task_id=task_id,
            routing_plan_json='{"route":{"mode":"council"}}',
            review_status=status,
            ministry_outputs_json="[]",
            conflict_summary_json="[]",
            memorial_json="{}",
            created_at="2026-07-23T00:00:00+00:00",
            updated_at="2026-07-23T00:00:00+00:00",
        )
    )
    db.commit()


def test_cancel_moves_live_task_to_cancelled(isolated_session_local):
    db = isolated_session_local()
    task_id = "task_cancel_live"
    _seed_task(db, task_id=task_id)
    db.close()

    client = TestClient(app)
    resp = client.post(
        f"/api/shangshufang/tasks/{task_id}/decision",
        json={"action": "cancel", "reason": "客户撤单", "human_confirmed": True},
    )
    assert resp.json()["success"] is True

    db = isolated_session_local()
    task = db.query(DecisionTask).filter_by(id=task_id).one()
    review = db.query(CourtReview).filter_by(task_id=task_id).one()
    assert task.status == "task_cancelled"
    assert review.review_status == "task_cancelled"
    db.close()


def test_repeated_cancel_is_idempotent(isolated_session_local):
    """HTTP 重放必须返回既有结果，不能重复追加裁决和时间线。"""
    from src.db.models import DecreeExecutionEvent, EmperorDecision

    db = isolated_session_local()
    task_id = "task_cancel_repeated"
    _seed_task(db, task_id=task_id)
    db.close()

    client = TestClient(app)
    first = client.post(
        f"/api/shangshufang/tasks/{task_id}/decision",
        json={"action": "cancel", "reason": "客户撤单", "human_confirmed": True},
    )
    second = client.post(
        f"/api/shangshufang/tasks/{task_id}/decision",
        json={"action": "cancel", "reason": "重复点击", "human_confirmed": True},
    )

    assert first.status_code == 200, first.json()
    assert second.status_code == 200, second.json()
    db = isolated_session_local()
    task = db.query(DecisionTask).filter_by(id=task_id).one()
    review = db.query(CourtReview).filter_by(task_id=task_id).one()
    assert task.status == "task_cancelled"
    assert review.review_status == "task_cancelled"
    assert (
        db.query(EmperorDecision)
        .filter_by(task_id=task_id, action="cancel")
        .count()
        == 1
    )
    assert (
        db.query(DecreeExecutionEvent)
        .filter_by(task_id=task_id, event_type="decision.cancelled")
        .count()
        == 1
    )
    db.close()


def test_repeated_recheck_is_idempotent(isolated_session_local):
    from src.db.models import DecreeExecutionEvent, EmperorDecision

    db = isolated_session_local()
    task_id = "task_recheck_repeated"
    _seed_task(db, task_id=task_id)
    db.close()

    client = TestClient(app)
    first = client.post(
        f"/api/shangshufang/tasks/{task_id}/decision",
        json={"action": "recheck", "reason": "重新会审", "human_confirmed": True},
    )
    second = client.post(
        f"/api/shangshufang/tasks/{task_id}/decision",
        json={"action": "recheck", "reason": "重复点击", "human_confirmed": True},
    )

    assert first.status_code == 200, first.json()
    assert second.status_code == 200, second.json()
    db = isolated_session_local()
    assert db.query(DecisionTask).filter_by(id=task_id).one().status == "reviewing"
    assert (
        db.query(EmperorDecision)
        .filter_by(task_id=task_id, action="recheck")
        .count()
        == 1
    )
    assert (
        db.query(DecreeExecutionEvent)
        .filter_by(task_id=task_id, event_type="decision.recheck_requested")
        .count()
        == 1
    )
    db.close()


def test_cancel_rejected_on_already_archived_task(isolated_session_local):
    """已经归档的任务不能被取消撤回——围栏挡住迟到/伪造的 cancel 请求。"""
    db = isolated_session_local()
    task_id = "task_cancel_after_archive"
    _seed_task(db, task_id=task_id, status="archived")
    db.close()

    client = TestClient(app)
    resp = client.post(
        f"/api/shangshufang/tasks/{task_id}/decision",
        json={"action": "cancel", "reason": "太迟了", "human_confirmed": True},
    )
    assert resp.json()["success"] is True

    db = isolated_session_local()
    assert db.query(DecisionTask).filter_by(id=task_id).one().status == "archived"
    db.close()


def test_cancel_rejected_on_already_draft_cancelled_task(isolated_session_local):
    """独立审查发现(2026-07-23)：cancel 围栏词表曾经跟 outbox_worker.py 的
    execution_failed 推进词表各写各的，且漏了 draft_cancelled——已收口成共用
    TASK_TERMINAL_STATUSES。一个已经在草拟阶段被取消的任务不该被 cancel 重新
    盖成 task_cancelled（虽然两者显示的 stage 一样，但覆盖本身违反终态幂等
    的设计意图，且会产生一条多余的 decision.cancelled 审计事件）。"""
    db = isolated_session_local()
    task_id = "task_cancel_after_draft_cancelled"
    _seed_task(db, task_id=task_id, status="draft_cancelled")
    db.close()

    client = TestClient(app)
    resp = client.post(
        f"/api/shangshufang/tasks/{task_id}/decision",
        json={"action": "cancel", "reason": "太迟了", "human_confirmed": True},
    )
    assert resp.json()["success"] is True

    db = isolated_session_local()
    assert db.query(DecisionTask).filter_by(id=task_id).one().status == "draft_cancelled"
    db.close()


def test_cancel_action_is_recorded_with_final_verdict_kind(isolated_session_local):
    from src.db.models import EmperorDecision

    db = isolated_session_local()
    task_id = "task_cancel_decision_kind"
    _seed_task(db, task_id=task_id)
    db.close()

    client = TestClient(app)
    client.post(
        f"/api/shangshufang/tasks/{task_id}/decision",
        json={"action": "cancel", "reason": "客户撤单", "human_confirmed": True},
    )

    db = isolated_session_local()
    decision = db.query(EmperorDecision).filter_by(task_id=task_id, action="cancel").one()
    assert decision.kind == "final_verdict"
    db.close()
