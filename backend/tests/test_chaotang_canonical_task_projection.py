"""P3b: chaotang task detail and terminal SSE project canonical facts."""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(monkeypatch, isolated_session_local):
    monkeypatch.setenv("FENGQUN_AUTH", "false")
    from web.main import app

    return TestClient(app)


def _seed_canonical_task(session_local, *, owner: str = "1") -> None:
    from src.db.models import (
        ChancellorRouteDecision,
        DecisionTask,
        DecreeExecutionEvent,
        OutboxEvent,
        SwarmQualityResult,
        SwarmRun,
        SwarmTaskRun,
    )
    from src.chancellor.routing_service import ChancellorRoutingService

    db = session_local()
    task = DecisionTask(
            id="task_p3b",
            tenant_id=1,
            user_id=owner,
            raw_question="核查供应商合同风险",
            refined_edict="请刑部核查合同证据并给出裁决建议",
            status="awaiting_decision",
            source_label="LIVE_SWARM",
            created_at="2026-07-15T09:00:00+00:00",
            updated_at="2026-07-15T09:05:00+00:00",
        )
    db.add(task)
    db.flush()
    route = ChancellorRoutingService().decide(
        db,
        task_id=task.id,
        confirmed_edict_text="请刑部核查合同证据并给出裁决建议",
        idempotency_key="route-p3b",
        source_label="LIVE",
    )
    db.flush()
    assert isinstance(
        db.query(ChancellorRouteDecision).filter_by(decision_id=route.decision_id).one(),
        ChancellorRouteDecision,
    )
    db.add(
        SwarmRun(
            id="swarm_p3b",
            task_id="task_p3b",
            review_id="review_p3b",
            mode="deep",
            status="completed",
            source_label="LIVE_SWARM",
            route_plan_json='{"departments":["刑部"]}',
            trace_id="trace_p3b",
            started_at="2026-07-15T09:01:00+00:00",
            finished_at="2026-07-15T09:04:00+00:00",
        )
    )
    db.add(
        SwarmTaskRun(
            id="swarm_task_p3b",
            swarm_run_id="swarm_p3b",
            swarm_id="xingbu_review",
            role="刑部审查",
            status="completed",
            input_json="{}",
            output_json=json.dumps(
                {"summary": "合同证据齐全，可有条件通过。"}, ensure_ascii=False
            ),
            source_label="LIVE_ENGINE",
            confidence="0.82",
            started_at="2026-07-15T09:01:00+00:00",
            finished_at="2026-07-15T09:03:00+00:00",
        )
    )
    db.add(
        SwarmQualityResult(
            id="quality_p3b",
            swarm_run_id="swarm_p3b",
            passed=True,
            blocking_reasons_json="[]",
            warnings_json="[]",
            revised_output_json="{}",
            created_at="2026-07-15T09:04:00+00:00",
        )
    )
    db.add(
        OutboxEvent(
            id="outbox_p3b",
            tenant_id=1,
            task_id=task.id,
            decision_id=route.decision_id,
            event_type="route.council",
            status="completed",
            attempts=0,
            max_attempts=3,
            payload_json="{}",
            created_at="2026-07-15T09:00:30+00:00",
            updated_at="2026-07-15T09:05:00+00:00",
        )
    )
    db.add_all(
        [
            DecreeExecutionEvent(
                id="evt_p3b_1",
                tenant_id=1,
                task_id="task_p3b",
                stage="executing",
                actor="worker",
                message="军机处开始异步派单。",
                event_type="dispatch.started",
                trace_id="trace_p3b",
                source_label="MIXED",
                payload_json='{"review_id":"review_p3b"}',
                occurred_at="2026-07-15T09:01:00+00:00",
                sequence=1,
            ),
            DecreeExecutionEvent(
                id="evt_p3b_2",
                tenant_id=1,
                task_id="task_p3b",
                stage="department_reporting",
                actor="worker",
                message="各部回奏完成。",
                event_type="reports.completed",
                trace_id="review_p3b",
                source_label="LIVE",
                payload_json=(
                    '{"attempt":1,"outbox_event_id":"outbox_p3b",'
                    '"swarm_run_id":"swarm_p3b"}'
                ),
                occurred_at="2026-07-15T09:04:00+00:00",
                sequence=2,
            ),
            DecreeExecutionEvent(
                id="evt_p3b_3",
                tenant_id=1,
                task_id="task_p3b",
                stage="awaiting_emperor_decision",
                actor="junjichu",
                message="军机处已生成唯一正式奏折。",
                event_type="memorial.formalized",
                trace_id="review_p3b",
                source_label="LIVE_SWARM",
                payload_json=(
                    '{"swarm_run_id":"swarm_p3b",'
                    '"formal_memorial_id":"formal_p3b"}'
                ),
                occurred_at="2026-07-15T09:05:00+00:00",
                sequence=3,
            ),
        ]
    )
    db.commit()
    db.close()


def test_task_detail_projects_canonical_task_run_and_events(
    client, monkeypatch, isolated_session_local
):
    _seed_canonical_task(isolated_session_local)
    import web.routers.chaotang as chaotang_mod

    monkeypatch.setattr(
        chaotang_mod,
        "get_task",
        lambda *_: (_ for _ in ()).throw(AssertionError("legacy registry read")),
    )
    monkeypatch.setattr(
        chaotang_mod,
        "load_run",
        lambda *_: (_ for _ in ()).throw(AssertionError("legacy run read")),
    )

    response = client.get("/api/chaotang/tasks/task_p3b")

    assert response.status_code == 200
    assert response.json()["success"] is True
    data = response.json()["data"]
    assert data["task"] == {
        "id": "task_p3b",
        "sourceLabel": "LIVE_SWARM",
        "title": "请刑部核查合同证据并给出裁决建议",
        "rawCommand": "核查供应商合同风险",
            "status": "report_ready",
            "executionState": "completed",
            "executionQuarantined": False,
            "executionStateReason": (
                "reports.completed is paired with complete swarm and quality artifacts"
            ),
        "mode": "deep",
        "createdAt": "2026-07-15T09:00:00+00:00",
        "updatedAt": "2026-07-15T09:05:00+00:00",
        "finalReportId": "swarm_p3b",
        "result": {
            "source": "canonical",
            "swarmRunId": "swarm_p3b",
            "swarmStatus": "completed",
            "timeline": [
                {
                    "eventType": "dispatch.started",
                    "stage": "executing",
                    "message": "军机处开始异步派单。",
                    "sequence": 1,
                    "sourceLabel": "MIXED",
                },
                {
                    "eventType": "reports.completed",
                    "stage": "department_reporting",
                    "message": "各部回奏完成。",
                    "sequence": 2,
                    "sourceLabel": "LIVE",
                },
                {
                    "eventType": "memorial.formalized",
                    "stage": "awaiting_emperor_decision",
                    "message": "军机处已生成唯一正式奏折。",
                    "sequence": 3,
                    "sourceLabel": "LIVE_SWARM",
                },
            ],
        },
    }
    assert data["runId"] == "swarm_p3b"
    assert data["council"][0]["agentCode"] == "xingbu_review"
    assert data["council"][0]["opinion"] == "合同证据齐全，可有条件通过。"
    assert data["groupRuns"][0]["groupId"] == "xingbu_review"


def test_terminal_stream_replays_canonical_events_and_snapshot(
    client, monkeypatch, isolated_session_local
):
    _seed_canonical_task(isolated_session_local)
    import web.routers.chaotang as chaotang_mod

    monkeypatch.setattr(
        chaotang_mod,
        "get_task",
        lambda *_: (_ for _ in ()).throw(AssertionError("legacy queue read")),
    )

    events = []
    with client.stream("GET", "/api/chaotang/stream/task_p3b") as response:
        assert response.status_code == 200
        for line in response.iter_lines():
            if line.startswith("data: "):
                events.append(json.loads(line[len("data: ") :]))

    assert [event["type"] for event in events] == [
        "canonical.event",
        "canonical.event",
        "canonical.event",
        "canonical.snapshot",
    ]
    assert events[0]["eventType"] == "dispatch.started"
    assert events[2]["payload"]["formal_memorial_id"] == "formal_p3b"
    assert events[3] == {
        "type": "canonical.snapshot",
        "taskId": "task_p3b",
        "status": "report_ready",
        "executionState": "completed",
        "executionQuarantined": False,
        "executionStateReason": (
            "reports.completed is paired with complete swarm and quality artifacts"
        ),
        "terminal": True,
        "runId": "swarm_p3b",
        "sourceLabel": "LIVE_SWARM",
        "error": None,
    }


def test_canonical_task_projection_does_not_leak_other_owner(
    client, isolated_session_local
):
    _seed_canonical_task(isolated_session_local, owner="another-user")

    detail = client.get("/api/chaotang/tasks/task_p3b")
    assert detail.status_code == 200
    assert detail.json()["success"] is False
    assert "不存在" in detail.json()["error"]

    stream = client.get("/api/chaotang/stream/task_p3b")
    assert stream.status_code == 404


def test_task_projection_fails_closed_when_canonical_db_is_unavailable(
    client, monkeypatch
):
    import importlib

    engine_mod = importlib.import_module("src.db.engine")

    def _unavailable():
        raise RuntimeError("canonical db unavailable")

    monkeypatch.setattr(engine_mod, "SessionLocal", _unavailable)

    detail = client.get("/api/chaotang/tasks/task_db_down")
    assert detail.status_code == 200
    assert detail.json()["success"] is False
    assert "暂不可用" in detail.json()["error"]

    stream = client.get("/api/chaotang/stream/task_db_down")
    assert stream.status_code == 503


def test_task_detail_and_stream_require_auth_when_enabled(
    monkeypatch, isolated_session_local
):
    from web import deps
    from web.main import app

    monkeypatch.setattr(deps, "AUTH_ENABLED", True)
    app.dependency_overrides.pop(deps.get_current_user, None)
    unauthenticated = TestClient(app)

    assert unauthenticated.get("/api/chaotang/tasks/task_p3b").status_code == 401
    assert unauthenticated.get("/api/chaotang/stream/task_p3b").status_code == 401
