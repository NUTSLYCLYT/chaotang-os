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


def test_tasks_list_reads_legacy_rows_without_schema_write(
    monkeypatch, isolated_session_local
):
    import src.db.flow_store as flow_store
    from src.db.models import Task

    with isolated_session_local() as db:
        db.add(
            Task(
                task_id="legacy_read_only_row",
                status="done",
                task_status="report_ready",
                task_input="只读历史任务",
            )
        )
        db.commit()
    monkeypatch.setattr(
        flow_store,
        "ensure_task_result_json_column",
        lambda session: (_ for _ in ()).throw(AssertionError("schema write")),
    )

    response = _client(monkeypatch).get("/api/chaotang/tasks")

    assert response.status_code == 200
    assert any(
        item["taskId"] == "legacy_read_only_row"
        for item in response.json()["data"]
    )


def test_tasks_persist_endpoints_are_read_only_and_detail_is_canonical(
    monkeypatch, isolated_session_local
):
    import json

    from src.db.models import DecisionTask, Task

    with isolated_session_local() as db:
        db.add(
            DecisionTask(
                id="task_frontend_1",
                tenant_id=1,
                user_id="1",
                raw_question="评估上书房刷新持久化",
                status="executing",
                source_label="MIXED",
            )
        )
        db.add(
            Task(
                task_id="task_frontend_1",
                status="done",
                task_status="report_ready",
                result_json=json.dumps({"legacy": "must-not-leak"}),
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
    assert created.json() == {
        "success": False,
        "data": None,
        "error": "legacy_task_projection_read_only",
    }

    patched = c.patch(
        "/api/chaotang/tasks/task_frontend_1/persist",
        json={
            "status": "report_ready",
            "result": {"shangshufangEdictReturn": {"mode": "secret", "finalOutputs": ["done"]}},
        },
    )
    assert patched.status_code == 200
    assert patched.json() == {
        "success": False,
        "data": None,
        "error": "legacy_task_projection_read_only",
    }

    detail = c.get("/api/chaotang/tasks/task_frontend_1")
    assert detail.status_code == 200
    task = detail.json()["data"]["task"]
    assert task["status"] == "running"
    assert task["result"] == {}
    assert task["finalReportId"] is None

    with isolated_session_local() as db:
        legacy = db.query(Task).filter_by(task_id="task_frontend_1").one()
        assert json.loads(legacy.result_json) == {"legacy": "must-not-leak"}
