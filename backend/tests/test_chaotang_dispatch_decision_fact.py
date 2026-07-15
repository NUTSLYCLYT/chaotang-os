"""The legacy Chaotang dispatch must be a durable DecisionTask adapter."""

from __future__ import annotations

from fastapi.testclient import TestClient

from src.db.models import DecisionTask, DecreeExecutionEvent, OutboxEvent
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
    from src.execution import decree_dispatcher

    monkeypatch.setenv("FENGQUN_LEGACY_CHAOTANG_DAEMON", "0")
    observed: dict[str, object] = {}

    def capture_trigger(event_id: str):
        with isolated_session_local() as db:
            event = db.get(OutboxEvent, event_id)
            observed["decision_exists_before_dispatch_trigger"] = (
                event is not None and db.get(DecisionTask, event.task_id) is not None
            )

    monkeypatch.setattr(decree_dispatcher, "dispatch_after_commit", capture_trigger)

    response = TestClient(app).post("/api/chaotang/decree/dispatch", json=_BODY)

    assert response.status_code == 200
    assert response.json()["success"] is True
    task_id = response.json()["data"]["taskId"]
    with isolated_session_local() as db:
        decision = db.get(DecisionTask, task_id)
        assert decision is not None
        assert decision.user_id == "1"
        assert decision.status == "edict_recorded"
        event = (
            db.query(DecreeExecutionEvent)
            .filter_by(task_id=task_id, event_type="dispatch.queued")
            .one()
        )
        assert event.actor == "chancellor"
        assert event.source_label == "MIXED"
    assert observed["decision_exists_before_dispatch_trigger"] is True


def test_dispatch_persistence_failure_blocks_execution(
    isolated_session_local, monkeypatch
):
    import web.routers.chaotang as chaotang
    import src.execution.canonical_court_dispatch as canonical_dispatch

    monkeypatch.setenv("FENGQUN_LEGACY_CHAOTANG_DAEMON", "0")
    monkeypatch.setattr(
        canonical_dispatch,
        "dispatch_compat_court_task",
        lambda **kwargs: (_ for _ in ()).throw(RuntimeError("DB故障")),
    )
    spawned: list[str] = []
    monkeypatch.setattr(
        chaotang, "_spawn_run", lambda task_id, *args, **kwargs: spawned.append(task_id)
    )

    response = TestClient(app).post("/api/chaotang/decree/dispatch", json=_BODY)

    assert response.status_code == 200
    assert response.json()["success"] is False
    assert response.json()["error"] == "canonical_dispatch_failed"
    assert spawned == []
    with isolated_session_local() as db:
        assert db.query(DecisionTask).count() == 0
