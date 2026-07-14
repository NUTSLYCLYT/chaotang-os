"""Legacy memorial review must enter the owned formal decision chain."""

from __future__ import annotations

import json

from fastapi.testclient import TestClient

from src.db.models import (
    DecisionTask,
    DecreeExecutionEvent,
    EmperorDecision,
    FinalMemorial,
    Task,
)
from web.main import app


class _Run:
    task_input = "正式任务"
    final_output = {"background": "背景", "recommendation": "建议"}


def _seed_mapping(
    session_factory,
    *,
    task_id: str,
    run_id: str,
    user_id: str = "1",
    final_ready: bool = False,
) -> None:
    with session_factory() as db:
        db.add(
            DecisionTask(
                id=task_id,
                user_id=user_id,
                raw_question="正式任务",
                status="awaiting_decision",
                source_label="MIXED",
            )
        )
        db.add(Task(task_id=task_id, run_id=run_id, status="done"))
        if final_ready:
            db.add(
                FinalMemorial(
                    id=f"formal_{task_id}",
                    task_id=task_id,
                    review_id=f"court_{task_id}",
                    swarm_run_id=run_id,
                    quality_result_id=f"quality_{task_id}",
                    status="ready_for_decision",
                    source_label="MIXED",
                    memorial_json=json.dumps({"title": "正式奏折", "summary": "可裁决"}),
                    content_hash=f"hash_{task_id}",
                )
            )
        db.commit()


def test_review_rejects_orphan_run(isolated_session_local, monkeypatch, tmp_path):
    import src.chaotang_store as store
    import web.routers.chaotang as chaotang

    monkeypatch.setattr(store, "_DATA_ROOT", tmp_path)
    monkeypatch.setattr(chaotang, "load_run", lambda run_id: _Run())

    response = TestClient(app).post(
        "/api/chaotang/memorials/run_orphan/review",
        json={"action": "reject", "comment": "驳回"},
    )

    assert response.status_code == 200
    assert response.json()["success"] is False
    assert "未关联正式 DecisionTask" in response.json()["error"]
    with isolated_session_local() as db:
        assert db.query(EmperorDecision).count() == 0


def test_review_rejects_other_users_task(isolated_session_local, monkeypatch, tmp_path):
    import src.chaotang_store as store
    import web.routers.chaotang as chaotang

    monkeypatch.setattr(store, "_DATA_ROOT", tmp_path)
    monkeypatch.setattr(chaotang, "load_run", lambda run_id: _Run())
    _seed_mapping(
        isolated_session_local,
        task_id="review_other_task",
        run_id="run_other",
        user_id="someone_else",
    )

    response = TestClient(app).post(
        "/api/chaotang/memorials/run_other/review",
        json={"action": "reject", "comment": "越权"},
    )

    assert response.json()["success"] is False
    assert "无权" in response.json()["error"]
    with isolated_session_local() as db:
        assert db.query(EmperorDecision).count() == 0


def test_inquire_enters_formal_evidence_state(isolated_session_local, monkeypatch, tmp_path):
    import src.chaotang_store as store
    import web.routers.chaotang as chaotang

    monkeypatch.setattr(store, "_DATA_ROOT", tmp_path)
    monkeypatch.setattr(chaotang, "load_run", lambda run_id: _Run())
    _seed_mapping(
        isolated_session_local, task_id="review_inquire_task", run_id="run_inquire"
    )

    response = TestClient(app).post(
        "/api/chaotang/memorials/run_inquire/review",
        json={"action": "inquire", "comment": "请补证"},
    )

    assert response.json()["success"] is True
    assert response.json()["data"]["taskStatus"] == "awaiting_evidence"
    with isolated_session_local() as db:
        task = db.get(DecisionTask, "review_inquire_task")
        decision = db.query(EmperorDecision).filter_by(task_id=task.id).one()
        event = db.query(DecreeExecutionEvent).filter_by(task_id=task.id).one()
        assert task.status == "awaiting_evidence"
        assert decision.action == "request_evidence"
        assert event.event_type == "decision.evidence_requested"


def test_approve_requires_ready_formal_memorial(
    isolated_session_local, monkeypatch, tmp_path
):
    import src.chaotang_store as store
    import web.routers.chaotang as chaotang

    monkeypatch.setattr(store, "_DATA_ROOT", tmp_path)
    monkeypatch.setattr(chaotang, "load_run", lambda run_id: _Run())
    _seed_mapping(
        isolated_session_local, task_id="review_no_formal", run_id="run_no_formal"
    )

    blocked = TestClient(app).post(
        "/api/chaotang/memorials/run_no_formal/review",
        json={"action": "approve", "comment": "准"},
    )

    assert blocked.json()["success"] is False
    assert "正式奏折尚未通过" in blocked.json()["error"]
    with isolated_session_local() as db:
        assert db.get(DecisionTask, "review_no_formal").status == "awaiting_decision"
        assert db.query(EmperorDecision).count() == 0


def test_approve_archives_through_formal_decision(
    isolated_session_local, monkeypatch, tmp_path
):
    import src.chaotang_store as store
    import web.routers.chaotang as chaotang

    monkeypatch.setattr(store, "_DATA_ROOT", tmp_path)
    monkeypatch.setattr(chaotang, "load_run", lambda run_id: _Run())
    monkeypatch.setattr(store, "feedback_to_knowledge", lambda **kwargs: None)
    _seed_mapping(
        isolated_session_local,
        task_id="review_approve_task",
        run_id="run_approve",
        final_ready=True,
    )

    response = TestClient(app).post(
        "/api/chaotang/memorials/run_approve/review",
        json={"action": "approve", "comment": "准"},
    )

    assert response.json()["success"] is True
    assert response.json()["data"]["taskStatus"] == "archived"
    with isolated_session_local() as db:
        task = db.get(DecisionTask, "review_approve_task")
        formal = db.query(FinalMemorial).filter_by(task_id=task.id).one()
        event = db.query(DecreeExecutionEvent).filter_by(task_id=task.id).one()
        assert task.status == "archived"
        assert formal.status == "archived"
        assert event.event_type == "decision.adopted"
