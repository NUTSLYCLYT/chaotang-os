"""Legacy business routes must adapt into the canonical DecisionTask fact."""

from __future__ import annotations

import json

from fastapi.testclient import TestClient

from src.db.models import DecisionTask
from web import task_registry
from web.main import app


def _decision_task(session_factory, task_id: str) -> DecisionTask:
    with session_factory() as db:
        task = db.get(DecisionTask, task_id)
        assert task is not None
        return task


def _assert_canonical_execution_link(session_factory, task_id: str) -> None:
    task = _decision_task(session_factory, task_id)
    assert task.user_id == "1"
    assert task.status == "awaiting_emperor_confirm"
    assert task.source_label in {"FALLBACK", "MIXED"}

    execution = task_registry.get_task(task_id)
    assert execution is not None
    assert execution["fact_kind"] == "execution_run"
    assert execution["decision_task_id"] == task_id


def test_junjichu_case_persists_canonical_decision_task(
    isolated_session_local, monkeypatch
):
    monkeypatch.setattr(task_registry, "_task_registry", {})

    response = TestClient(app).post(
        "/api/court/junjichu/cases",
        json={"command": "请军机处评估这个报价是否值得推进"},
    )

    assert response.status_code == 200
    task_id = response.json()["data"]["taskId"]
    assert task_id.startswith("junjichu-")
    _assert_canonical_execution_link(isolated_session_local, task_id)


def test_court_orchestrate_persists_canonical_decision_task(
    isolated_session_local, monkeypatch
):
    monkeypatch.setattr(task_registry, "_task_registry", {})

    response = TestClient(app).post(
        "/api/court/orchestrate", json={"command": "核算预算"}
    )

    assert response.status_code == 200
    task_id = response.json()["taskId"]
    assert task_id.startswith("court-orch-")
    _assert_canonical_execution_link(isolated_session_local, task_id)


def test_orchestration_stream_persists_canonical_decision_task(
    isolated_session_local, monkeypatch
):
    monkeypatch.setattr(task_registry, "_task_registry", {})

    with TestClient(app).stream(
        "POST",
        "/api/orchestration/run",
        json={"command": "请三省审议预算"},
    ) as response:
        body = "".join(response.iter_text())

    assert response.status_code == 200
    pipeline_line = next(
        line
        for line in body.splitlines()
        if line.startswith("data: ") and '"type": "pipeline_done"' in line
    )
    task_id = json.loads(pipeline_line.removeprefix("data: "))["taskId"]
    assert task_id.startswith("orch-")
    _assert_canonical_execution_link(isolated_session_local, task_id)
