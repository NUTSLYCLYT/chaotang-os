"""Legacy task persistence is read-only and preserves canonical ownership."""

from __future__ import annotations

from fastapi.testclient import TestClient

from src.db.models import DecisionTask, Decree, Task
from web.main import app


def _seed_decision(session_factory, task_id: str, user_id: str = "1") -> None:
    with session_factory() as db:
        db.add(
            DecisionTask(
                id=task_id,
                tenant_id=1,
                user_id=user_id,
                raw_question="正式任务中的权威原问",
                status="executing",
                source_label="MIXED",
            )
        )
        db.commit()


def test_persist_rejects_orphan_execution_projection(isolated_session_local):
    response = TestClient(app).post(
        "/api/chaotang/tasks/persist",
        json={
            "taskId": "orphan_frontend_task",
            "command": "前端自行创造的任务",
            "status": "submitted",
        },
    )

    assert response.status_code == 200
    assert response.json()["success"] is False
    assert "正式 DecisionTask 不存在" in response.json()["error"]
    with isolated_session_local() as db:
        assert db.query(Task).count() == 0
        assert db.query(Decree).count() == 0


def test_persist_rejects_owned_decision_without_legacy_projection_write(
    isolated_session_local,
):
    _seed_decision(isolated_session_local, "decision_projection_1")

    created = TestClient(app).post(
        "/api/chaotang/tasks/persist",
        json={
            "taskId": "decision_projection_1",
            "command": "试图覆盖正式原问的前端文本",
            "title": "执行投影",
            "status": "submitted",
            "result": {"source": "legacy_projection"},
        },
    )

    assert created.status_code == 200
    assert created.json()["success"] is False
    assert created.json()["error"] == "legacy_task_projection_read_only"
    with isolated_session_local() as db:
        decision = db.get(DecisionTask, "decision_projection_1")
        assert decision.raw_question == "正式任务中的权威原问"
        assert db.query(Task).filter_by(task_id="decision_projection_1").first() is None


def test_patch_rejects_other_users_decision_projection(isolated_session_local):
    _seed_decision(
        isolated_session_local, "decision_projection_other", user_id="someone_else"
    )

    response = TestClient(app).patch(
        "/api/chaotang/tasks/decision_projection_other/persist",
        json={"status": "report_ready", "result": {"secret": "stolen"}},
    )

    assert response.status_code == 200
    assert response.json()["success"] is False
    assert "无权" in response.json()["error"]
    with isolated_session_local() as db:
        assert db.query(Task).count() == 0
