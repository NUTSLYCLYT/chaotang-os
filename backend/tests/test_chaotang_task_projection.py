"""Legacy task persistence is a projection of an owned DecisionTask."""

from __future__ import annotations

from fastapi.testclient import TestClient

from src.db.models import DecisionTask, Decree, Task
from web.main import app


def _seed_decision(session_factory, task_id: str, user_id: str = "1") -> None:
    with session_factory() as db:
        db.add(
            DecisionTask(
                id=task_id,
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


def test_persist_uses_owned_decision_as_projection_source(isolated_session_local):
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
    assert created.json()["success"] is True
    assert created.json()["data"]["rawCommand"] == "正式任务中的权威原问"
    with isolated_session_local() as db:
        decision = db.get(DecisionTask, "decision_projection_1")
        projection = db.query(Task).filter_by(task_id="decision_projection_1").one()
        assert decision.raw_question == "正式任务中的权威原问"
        assert projection.task_input == decision.raw_question


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
