"""R0-REQ-018：取消是明确的人工接管路径之一。围栏用终态幂等检查——
重复/迟到的 cancel 请求不得重开或破坏已经落定的结果。
"""

from __future__ import annotations

import importlib
import threading

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.db.models import Base, CourtReview, DecisionTask
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


@pytest.mark.parametrize(
    ("action", "expected_status", "event_type"),
    [
        ("cancel", "task_cancelled", "decision.cancelled"),
        ("recheck", "reviewing", "decision.recheck_requested"),
    ],
)
def test_concurrent_legacy_decision_replays_one_durable_result(
    tmp_path,
    monkeypatch,
    action,
    expected_status,
    event_type,
):
    """Concurrent legacy retries serialize before deciding whether to append."""
    from src.db.models import DecreeExecutionEvent, EmperorDecision

    engine = create_engine(
        f"sqlite:///{tmp_path / f'legacy-{action}-race.db'}",
        connect_args={"check_same_thread": False, "timeout": 10},
    )
    Base.metadata.create_all(engine)
    test_session = sessionmaker(
        bind=engine,
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
    )
    engine_module = importlib.import_module("src.db.engine")
    router_module = importlib.import_module("web.routers.shangshufang")
    monkeypatch.setattr(engine_module, "SessionLocal", test_session)

    task_id = f"task_{action}_concurrent"
    db = test_session()
    _seed_task(db, task_id=task_id)
    db.close()

    both_loaded = threading.Barrier(2)
    classify_calls = threading.local()
    original_is_contract_task = router_module._is_contract_task

    def _pace_after_task_load(*args, **kwargs):
        result = original_is_contract_task(*args, **kwargs)
        call_count = getattr(classify_calls, "count", 0) + 1
        classify_calls.count = call_count
        if call_count == 1:
            both_loaded.wait(timeout=5)
        return result

    monkeypatch.setattr(
        router_module,
        "_is_contract_task",
        _pace_after_task_load,
    )

    responses = []
    errors: list[BaseException] = []

    def _submit(reason: str) -> None:
        try:
            response = TestClient(app).post(
                f"/api/shangshufang/tasks/{task_id}/decision",
                json={
                    "action": action,
                    "reason": reason,
                    "human_confirmed": True,
                },
            )
            responses.append(response)
        except BaseException as exc:  # noqa: BLE001 - surface thread failures
            errors.append(exc)

    threads = [
        threading.Thread(target=_submit, args=("first request",)),
        threading.Thread(target=_submit, args=("concurrent retry",)),
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=15)

    assert not errors
    assert len(responses) == 2
    assert [response.status_code for response in responses] == [200, 200]

    db = test_session()
    try:
        assert db.get(DecisionTask, task_id).status == expected_status
        assert (
            db.query(EmperorDecision)
            .filter_by(task_id=task_id, action=action)
            .count()
            == 1
        )
        assert (
            db.query(DecreeExecutionEvent)
            .filter_by(task_id=task_id, event_type=event_type)
            .count()
            == 1
        )
    finally:
        db.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


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
    assert resp.status_code == 409
    assert resp.json()["success"] is False
    assert "durable legacy decision missing" in resp.json()["error"]

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
    assert resp.status_code == 409
    assert resp.json()["success"] is False
    assert "durable legacy decision missing" in resp.json()["error"]

    db = isolated_session_local()
    assert db.query(DecisionTask).filter_by(id=task_id).one().status == "draft_cancelled"
    db.close()


def test_recheck_replay_requires_durable_decision(isolated_session_local):
    db = isolated_session_local()
    task_id = "task_recheck_without_decision"
    _seed_task(db, task_id=task_id, status="reviewing")
    db.close()

    response = TestClient(app).post(
        f"/api/shangshufang/tasks/{task_id}/decision",
        json={
            "action": "recheck",
            "reason": "没有 durable decision 不得伪装 replay",
            "human_confirmed": True,
        },
    )

    assert response.status_code == 409
    assert response.json()["success"] is False
    assert "durable legacy decision missing" in response.json()["error"]
    db = isolated_session_local()
    assert db.get(DecisionTask, task_id).status == "reviewing"
    db.close()


@pytest.mark.parametrize(
    ("action", "initial_status"),
    [
        ("cancel", "awaiting_decision"),
        ("recheck", "awaiting_decision"),
    ],
)
def test_legacy_action_reclassifies_after_task_lock_when_mission_appears(
    isolated_session_local,
    monkeypatch,
    action,
    initial_status,
):
    from src.contract_mission_repository import save_mission_snapshot
    from src.db.models import DecreeExecutionEvent, EmperorDecision
    from src.execution import decree_dispatcher
    from tests.contract_task_support import contract_mission

    task_id = f"task-mission-race-{action}"
    with isolated_session_local() as db:
        _seed_task(db, task_id=task_id, status=initial_status)

    original_lock = decree_dispatcher.lock_evidence_rework_task
    mission_published = False

    def _publish_mission_while_acquiring_lock(db, locked_task_id):
        nonlocal mission_published
        original_lock(db, locked_task_id)
        if not mission_published:
            mission_published = True
            task = db.get(DecisionTask, locked_task_id)
            save_mission_snapshot(
                db,
                task=task,
                mission=contract_mission(locked_task_id),
                state="confirmed",
            )

    monkeypatch.setattr(
        decree_dispatcher,
        "lock_evidence_rework_task",
        _publish_mission_while_acquiring_lock,
    )

    response = TestClient(app).post(
        f"/api/shangshufang/tasks/{task_id}/decision",
        json={
            "action": action,
            "reason": "锁后出现 Mission 必须改走合同 authority",
            "human_confirmed": True,
        },
    )

    assert response.status_code == 409
    assert response.json()["success"] is False
    assert "contract" in response.json()["error"] or (
        "REFRESH_REVIEW" in response.json()["error"]
    )
    with isolated_session_local() as db:
        assert db.get(DecisionTask, task_id).status == initial_status
        assert (
            db.query(CourtReview).filter_by(task_id=task_id).one().review_status
            == initial_status
        )
        assert db.query(EmperorDecision).filter_by(task_id=task_id).count() == 0
        assert (
            db.query(DecreeExecutionEvent).filter_by(task_id=task_id).count()
            == 0
        )


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
