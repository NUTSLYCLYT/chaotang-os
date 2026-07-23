"""阶段2b验收：状态接口能说明当前owner/部门进度/阻塞原因。

见 docs/super-chancellor-routing-implementation-plan-2026-07-10.md 第6.7/10.3节。
"""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_status_returns_none_execution_status_before_confirm(isolated_session_local):
    from web.main import app

    client = TestClient(app)
    draft = client.post(
        "/api/shangshufang/draft-edict",
        json={"raw_question": "草拟一份内部通知"},
    ).json()["data"]

    response = client.get(f"/api/shangshufang/tasks/{draft['task_id']}/status")
    data = response.json()["data"]
    assert data["execution_status"] is None


def test_status_shows_receipt_only_owner_for_direct_task(isolated_session_local):
    """R0-REQ-022：direct 接单回执只能表示已受理/办理中，不得显示为完成。

    2026-07-23 修复前：_STAGE_MAP 把 "direct_completed" 映射成 "completed"，
    跟真正走完质量门的 "archived" 用同一个字面量，人类可见层撒谎说回执=完成。
    execution_state（下面这条断言本来就是对的）早就正确判成 "receipt_only"——
    这条测试原来锁的是 current_stage/current_owner 两层跟 execution_state
    不一致的错误状态，现在两层用词一致。"""
    from web.main import app

    client = TestClient(app)
    draft = client.post(
        "/api/shangshufang/draft-edict",
        json={"raw_question": "草拟一份内部通知"},
    ).json()["data"]
    client.post(
        "/api/shangshufang/confirm-edict",
        json={"task_id": draft["task_id"], "confirmed": True},
    )

    response = client.get(f"/api/shangshufang/tasks/{draft['task_id']}/status")
    status = response.json()["data"]["execution_status"]

    assert status is not None
    assert status["current_stage"] == "receipt_only"
    assert status["current_owner"] == "承办方"
    assert status["execution_state"] == "receipt_only"
    assert status["execution_quarantined"] is False
    assert status["route_decision"]["mode"] == "direct"
    assert len(status["timeline"]) >= 1


def test_status_shows_blocked_reason_and_departments_for_cluster_task(
    isolated_session_local,
):
    from web.main import app

    client = TestClient(app)
    draft = client.post(
        "/api/shangshufang/draft-edict",
        json={"raw_question": "对方要求股权对赌，独家合作三年，是否同意"},
    ).json()["data"]
    client.post(
        "/api/shangshufang/confirm-edict",
        json={"task_id": draft["task_id"], "confirmed": True},
    )

    response = client.get(f"/api/shangshufang/tasks/{draft['task_id']}/status")
    status = response.json()["data"]["execution_status"]

    assert status is not None
    assert status["current_stage"] == "executing"
    assert status["current_owner"] == "军机处"
    assert status["execution_state"] == "queued"
    assert status["execution_quarantined"] is False
    assert status["route_decision"]["mode"] == "council"
    assert status["route_decision"]["human_confirmation_required"] is True
    assert len(status["departments"]) >= 1
    assert len(status["timeline"]) >= 1


def test_load_timeline_orders_by_sequence_when_occurred_at_collides(
    isolated_session_local,
):
    """方案阶段4验收(见 valiant-crunching-candy.md)：occurred_at 只精确到秒，
    同一秒内触发的多个事件必须靠 sequence 而不是时间戳保证确定性排序。"""
    from src.chancellor.decree_status import _load_timeline, record_timeline_event
    from src.db.models import DecreeExecutionEvent

    db = isolated_session_local()
    try:
        record_timeline_event(
            db, task_id="task_seq_1", stage="a", actor="chancellor", message="第一条"
        )
        record_timeline_event(
            db, task_id="task_seq_1", stage="b", actor="worker", message="第二条"
        )
        record_timeline_event(
            db, task_id="task_seq_1", stage="c", actor="worker", message="第三条"
        )
        db.commit()

        # 强制把三行的 occurred_at 改成完全相同的时间戳，模拟同一秒内触发——
        # 此时唯一还能区分先后顺序的就只剩 sequence。
        db.query(DecreeExecutionEvent).filter_by(task_id="task_seq_1").update(
            {"occurred_at": "2026-07-12T00:00:00+00:00"}
        )
        db.commit()

        timeline = _load_timeline(db, "task_seq_1")
        assert [e.message for e in timeline] == ["第一条", "第二条", "第三条"]
        assert [e.sequence for e in timeline] == [1, 2, 3]
    finally:
        db.close()


def test_department_status_for_reflects_stage_not_fabricated_per_department_progress():
    """独立审查发现(2026-07-10)：修复前按 index==0 编造"第一个部门在执行、其余
    已汇报"，但 _execute_council() 是单次黑箱调用，完成前不存在"部分汇报"，完成
    后(awaiting_decision)也不存在"还有一个在执行"。这里直接测纯函数，不需要
    绕开测试环境禁用的后台 outbox 派单去凑真实状态流转。"""
    from src.chancellor.decree_status import _department_status_for

    for index in (0, 1, 2):
        assert _department_status_for("awaiting_emperor_decision", index) == "reported"
        assert _department_status_for("delivered", index) == "reported"
        assert _department_status_for("department_reporting", index) == "executing"
        assert _department_status_for("executing", index) == "executing"
        assert _department_status_for("awaiting_emperor_confirm", index) == "planned"
