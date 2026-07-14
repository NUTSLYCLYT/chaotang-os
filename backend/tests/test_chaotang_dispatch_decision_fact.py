"""The legacy Chaotang dispatch must be a durable DecisionTask adapter."""

from __future__ import annotations

from fastapi.testclient import TestClient

from src.db.models import DecisionTask, DecreeExecutionEvent
from web import task_registry
from web.main import app


_BODY = {
    "rawCommand": "分析低温电池市场并形成决策建议",
    "intent": "市场分析",
    "selectedCategories": [
        {
            "taskType": "analysis",
            "ministers": ["hu_bu"],
            "groups": ["intel"],
            "label": "市场分析",
        }
    ],
}


def test_dispatch_commits_decision_fact_before_execution(
    isolated_session_local, monkeypatch
):
    import web.routers.chaotang as chaotang
    from src import chaotang_orchestrator

    monkeypatch.setattr(task_registry, "_task_registry", {})
    monkeypatch.setattr(
        chaotang_orchestrator, "assemble_flow", lambda *args, **kwargs: "/tmp/fake.yaml"
    )
    observed: dict[str, object] = {}

    def capture_spawn(task_id, *args, **kwargs):
        with isolated_session_local() as db:
            observed["decision_exists_before_spawn"] = (
                db.get(DecisionTask, task_id) is not None
            )

    monkeypatch.setattr(chaotang, "_spawn_run", capture_spawn)

    response = TestClient(app).post("/api/chaotang/decree/dispatch", json=_BODY)

    assert response.status_code == 200
    assert response.json()["success"] is True
    task_id = response.json()["data"]["taskId"]
    with isolated_session_local() as db:
        decision = db.get(DecisionTask, task_id)
        assert decision is not None
        assert decision.user_id == "1"
        assert decision.status == "executing"
        event = (
            db.query(DecreeExecutionEvent)
            .filter_by(task_id=task_id, event_type="dispatch.started")
            .one()
        )
        assert event.actor == "emperor"
        assert event.source_label == "MIXED"
    assert observed["decision_exists_before_spawn"] is True
    execution = task_registry.get_task(task_id)
    assert execution is not None
    assert execution["fact_kind"] == "execution_run"
    assert execution["decision_task_id"] == task_id


def test_dispatch_persistence_failure_blocks_execution(
    isolated_session_local, monkeypatch
):
    import src.db.flow_store as flow_store
    import web.routers.chaotang as chaotang
    from src import chaotang_orchestrator

    monkeypatch.setattr(task_registry, "_task_registry", {})
    monkeypatch.setattr(
        chaotang_orchestrator, "assemble_flow", lambda *args, **kwargs: "/tmp/fake.yaml"
    )
    monkeypatch.setattr(
        flow_store,
        "save_decree_and_task",
        lambda **kwargs: (_ for _ in ()).throw(RuntimeError("DB故障")),
    )
    spawned: list[str] = []
    monkeypatch.setattr(
        chaotang, "_spawn_run", lambda task_id, *args, **kwargs: spawned.append(task_id)
    )

    response = TestClient(app).post("/api/chaotang/decree/dispatch", json=_BODY)

    assert response.status_code == 200
    assert response.json()["success"] is False
    assert "DB故障" in response.json()["error"]
    assert spawned == []
    assert task_registry.task_snapshot() == {}
    with isolated_session_local() as db:
        assert db.query(DecisionTask).count() == 0
