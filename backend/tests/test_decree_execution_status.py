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


def test_status_shows_completed_owner_for_direct_task(isolated_session_local):
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
    assert status["current_stage"] == "completed"
    assert status["current_owner"] == "已完结"
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
    assert status["route_decision"]["mode"] == "council"
    assert status["route_decision"]["human_confirmation_required"] is True
    assert len(status["departments"]) >= 1
    assert len(status["timeline"]) >= 1


def test_department_status_for_reflects_stage_not_fabricated_per_department_progress():
    """独立审查发现(2026-07-10)：修复前按 index==0 编造"第一个部门在执行、其余
    已汇报"，但 _execute_council() 是单次黑箱调用，完成前不存在"部分汇报"，完成
    后(awaiting_decision)也不存在"还有一个在执行"。这里直接测纯函数，不需要
    绕开测试环境禁用的后台 outbox 派单去凑真实状态流转。"""
    from src.chancellor.decree_status import _department_status_for

    for index in (0, 1, 2):
        assert _department_status_for("awaiting_emperor_decision", index) == "reported"
        assert _department_status_for("completed", index) == "reported"
        assert _department_status_for("department_reporting", index) == "executing"
        assert _department_status_for("executing", index) == "executing"
        assert _department_status_for("awaiting_emperor_confirm", index) == "planned"
