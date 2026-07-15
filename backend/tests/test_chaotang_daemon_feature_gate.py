"""P3d: legacy chaotang daemon paths stay behind an explicit rollback flag."""

from __future__ import annotations

from fastapi.testclient import TestClient


_DISPATCH_BODY = {
    "rawCommand": "请军机处会审供应商合同、付款与交付风险",
    "intent": "风险会审",
    "selectedCategories": [
        {
            "taskType": "analysis",
            "ministers": ["hu_bu", "xing_bu"],
            "groups": ["finlaw"],
            "label": "财法会审",
        }
    ],
}


def test_decree_dispatch_defaults_to_canonical_outbox_without_legacy_daemon(
    isolated_session_local, monkeypatch
):
    import web.routers.chaotang as chaotang
    from src import chaotang_orchestrator
    from src.execution import decree_dispatcher

    monkeypatch.setenv("FENGQUN_LEGACY_CHAOTANG_DAEMON", "0")

    def _forbidden(*_args, **_kwargs):
        raise AssertionError("legacy chaotang daemon path")

    monkeypatch.setattr(chaotang_orchestrator, "assemble_flow", _forbidden)
    monkeypatch.setattr(chaotang, "_spawn_run", _forbidden)
    triggered: list[str] = []
    monkeypatch.setattr(
        decree_dispatcher, "dispatch_after_commit", triggered.append
    )

    from web.main import app

    response = TestClient(app).post(
        "/api/chaotang/decree/dispatch", json=_DISPATCH_BODY
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True, payload
    assert set(payload["data"]) == {
        "taskId",
        "status",
        "acceptedAt",
        "streamUrl",
        "intent",
        "taskType",
        "ministers",
        "groups",
        "budget",
    }
    assert payload["data"]["status"] == "edict_recorded"

    from src.db.models import DecisionTask, Decree, OutboxEvent, Task

    task_id = payload["data"]["taskId"]
    with isolated_session_local() as db:
        decision_task = db.get(DecisionTask, task_id)
        outbox = db.query(OutboxEvent).filter_by(task_id=task_id).one()
        assert decision_task is not None
        assert decision_task.status == "edict_recorded"
        assert outbox.event_type == "route.council"
        assert db.query(Task).filter_by(task_id=task_id).count() == 0
        assert db.query(Decree).filter_by(decree_id=task_id).count() == 0

    assert triggered == [outbox.id]


def test_study_live_async_fails_closed_when_legacy_daemon_is_disabled(
    isolated_session_local, monkeypatch
):
    import threading
    import web.routers.throne as throne

    monkeypatch.setenv("FENGQUN_LEGACY_CHAOTANG_DAEMON", "0")
    monkeypatch.setattr(throne, "_build_memorial_list", lambda: [])
    started: list[bool] = []

    class _ForbiddenThread:
        def __init__(self, *_args, **_kwargs):
            started.append(True)

        def start(self):
            raise AssertionError("legacy study daemon started")

    monkeypatch.setattr(threading, "Thread", _ForbiddenThread)

    from web.main import app

    response = TestClient(app).post(
        "/api/chaotang/study/run",
        json={"command": "研究供应链风险", "mode": "live", "asyncRun": True},
    )

    assert response.status_code == 200
    assert response.json()["success"] is False
    assert response.json()["error"] == "legacy_study_async_daemon_disabled"
    assert started == []


def test_decree_dispatch_applies_selected_ministers_and_groups_to_canonical_route(
    isolated_session_local, monkeypatch
):
    import json

    from src.execution import decree_dispatcher
    from web.main import app

    monkeypatch.setenv("FENGQUN_LEGACY_CHAOTANG_DAEMON", "0")
    monkeypatch.setattr(decree_dispatcher, "dispatch_after_commit", lambda _: None)
    response = TestClient(app).post(
        "/api/chaotang/decree/dispatch",
        json={
            "rawCommand": "整理例行材料",
            "intent": "按财法口径整理",
            "selectedCategories": [
                {
                    "taskType": "analysis",
                    "ministers": ["hu_bu"],
                    "groups": ["finlaw"],
                    "label": "财法会审",
                }
            ],
        },
    )

    assert response.json()["success"] is True
    task_id = response.json()["data"]["taskId"]
    from src.db.models import ChancellorRouteDecision, DecisionTask

    with isolated_session_local() as db:
        task = db.get(DecisionTask, task_id)
        route = (
            db.query(ChancellorRouteDecision).filter_by(task_id=task_id).one()
        )
        draft = json.loads(task.draft_edict_json)
        decision = json.loads(route.decision_json)
        assert json.loads(task.recommended_departments_json) == ["户部", "刑部"]
        assert draft["recommended_departments"] == ["户部", "刑部"]
        assert draft["compat_constraints"]["intent"] == "按财法口径整理"
        assert draft["compat_constraints"]["taskType"] == "analysis"
        assert [item["department"] for item in decision["participants"]] == [
            "户部",
            "刑部",
        ]


def test_decree_dispatch_rejects_unenforced_budget_and_stakes(
    isolated_session_local, monkeypatch
):
    from src.db.models import DecisionTask, OutboxEvent
    from web.main import app

    monkeypatch.setenv("FENGQUN_LEGACY_CHAOTANG_DAEMON", "0")
    response = TestClient(app).post(
        "/api/chaotang/decree/dispatch",
        json={
            **_DISPATCH_BODY,
            "budget": {"maxCalls": 5, "maxCostUsd": 0.25},
            "stakes": "high",
        },
    )

    assert response.json()["success"] is False
    assert response.json()["error"] == (
        "canonical_constraints_unsupported: "
        "budget.maxCalls,budget.maxCostUsd,stakes=high"
    )
    with isolated_session_local() as db:
        assert db.query(DecisionTask).count() == 0
        assert db.query(OutboxEvent).count() == 0


def test_decree_dispatch_rejects_group_without_canonical_department_equivalent(
    isolated_session_local, monkeypatch
):
    from web.main import app

    monkeypatch.setenv("FENGQUN_LEGACY_CHAOTANG_DAEMON", "0")
    response = TestClient(app).post(
        "/api/chaotang/decree/dispatch",
        json={
            "rawCommand": "整理史馆材料",
            "selectedCategories": [
                {
                    "taskType": "general",
                    "ministers": ["scribe"],
                    "groups": ["review"],
                }
            ],
        },
    )

    assert response.json()["success"] is False
    assert response.json()["error"] == (
        "canonical_constraints_unsupported: minister=scribe"
    )
