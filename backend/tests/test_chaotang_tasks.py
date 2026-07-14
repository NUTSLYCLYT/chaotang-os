# tests/test_chaotang_tasks.py
from fastapi.testclient import TestClient


def _client(monkeypatch):
    monkeypatch.setenv("FENGQUN_AUTH", "false")
    from web.main import app
    return TestClient(app)


def test_tasks_list_shape(monkeypatch, isolated_session_local):
    import web.routers.chaotang as ct
    monkeypatch.setattr(ct, "task_snapshot", lambda: {
        "t1": {"status": "running", "task_input": "评估", "flow_name": "朝堂:评估",
               "completed_steps": 1, "total_steps": 3, "started_at": "2026-05-27T10:00:00",
               "run_id": None}})
    c = _client(monkeypatch)
    r = c.get("/api/chaotang/tasks")
    assert r.status_code == 200
    items = r.json()["data"]
    item = next(i for i in items if i["taskId"] == "t1")
    assert item["status"] in ("running", "interpreting", "planning", "aggregating",
                              "report_ready", "archived", "failed", "submitted",
                              "assigned", "reviewed")
    assert 0 <= item["progressPct"] <= 100


def test_task_detail_404_when_missing(monkeypatch, isolated_session_local):
    c = _client(monkeypatch)
    r = c.get("/api/chaotang/tasks/nonexistent")
    assert r.status_code == 200 and r.json()["success"] is False


def test_tasks_persist_patch_and_readback(monkeypatch, isolated_session_local):
    from src.db.models import DecisionTask

    with isolated_session_local() as db:
        db.add(
            DecisionTask(
                id="task_frontend_1",
                user_id="1",
                raw_question="评估上书房刷新持久化",
                status="executing",
                source_label="MIXED",
            )
        )
        db.commit()
    c = _client(monkeypatch)

    created = c.post(
        "/api/chaotang/tasks/persist",
        json={
            "taskId": "task_frontend_1",
            "command": "评估上书房刷新持久化",
            "title": "刷新持久化",
            "status": "submitted",
            "mode": "hybrid",
            "result": {"source": "orchestrate"},
        },
    )
    assert created.status_code == 200
    assert created.json()["success"] is True
    assert created.json()["data"]["taskId"] == "task_frontend_1"

    patched = c.patch(
        "/api/chaotang/tasks/task_frontend_1/persist",
        json={
            "status": "report_ready",
            "result": {"shangshufangEdictReturn": {"mode": "secret", "finalOutputs": ["done"]}},
        },
    )
    assert patched.status_code == 200
    assert patched.json()["success"] is True
    assert patched.json()["data"]["status"] == "report_ready"

    listed = c.get("/api/chaotang/tasks")
    assert listed.status_code == 200
    item = next(i for i in listed.json()["data"] if i["taskId"] == "task_frontend_1")
    assert item["status"] == "report_ready"
    assert item["result"]["source"] == "orchestrate"
    assert item["result"]["shangshufangEdictReturn"]["mode"] == "secret"

    detail = c.get("/api/chaotang/tasks/task_frontend_1")
    assert detail.status_code == 200
    task = detail.json()["data"]["task"]
    assert task["status"] == "report_ready"
    assert task["result"]["shangshufangEdictReturn"]["finalOutputs"] == ["done"]
