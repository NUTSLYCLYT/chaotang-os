"""P3c: /api/direct mode=court dispatches through the canonical outbox."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(monkeypatch, isolated_session_local):
    monkeypatch.setenv("FENGQUN_AUTH", "false")
    from web.main import app

    return TestClient(app)


def _forbid_legacy_court_orchestrator(monkeypatch) -> None:
    from src import chaotang_orchestrator

    def _forbidden(*_args, **_kwargs):
        raise AssertionError("legacy chaotang_orchestrator dispatch")

    monkeypatch.setattr(chaotang_orchestrator, "assemble_flow", _forbidden)
    monkeypatch.setattr(chaotang_orchestrator, "run_chaotang_task", _forbidden)


def test_direct_court_mode_enqueues_canonical_outbox_with_same_response_shape(
    client, monkeypatch, isolated_session_local
):
    from src.execution import decree_dispatcher

    _forbid_legacy_court_orchestrator(monkeypatch)
    triggered: list[str] = []
    monkeypatch.setattr(
        decree_dispatcher, "dispatch_after_commit", triggered.append
    )

    response = client.post(
        "/api/direct/execute",
        json={
            "command": "请军机处会审供应商合同、付款与交付风险",
            "mode": "court",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True, payload
    assert set(payload["data"]) == {
        "task_id",
        "status",
        "result",
        "mode",
        "latency_ms",
    }
    assert payload["data"]["mode"] == "court"
    assert payload["data"]["status"] == "edict_recorded"

    from src.db.models import (
        ChancellorRouteDecision,
        CourtReview,
        DecisionTask,
        DecreeExecutionEvent,
        OutboxEvent,
    )

    task_id = payload["data"]["task_id"]
    with isolated_session_local() as db:
        task = db.get(DecisionTask, task_id)
        decision = (
            db.query(ChancellorRouteDecision).filter_by(task_id=task_id).one()
        )
        review = db.query(CourtReview).filter_by(task_id=task_id).one()
        outbox = db.query(OutboxEvent).filter_by(task_id=task_id).one()
        timeline = (
            db.query(DecreeExecutionEvent)
            .filter_by(task_id=task_id)
            .order_by(DecreeExecutionEvent.sequence)
            .all()
        )

        assert task.user_id == "1"
        assert task.status == "edict_recorded"
        assert decision.mode == "council"
        assert review.review_status == "edict_recorded"
        assert outbox.event_type == "route.council"
        assert outbox.status == "pending"
        assert [event.event_type for event in timeline] == [
            "routing.decided",
            "dispatch.queued",
        ]

    assert triggered == [outbox.id]
    assert payload["data"]["result"]["outbox_event_id"] == outbox.id
    assert payload["data"]["result"]["review_id"] == review.id


def test_direct_court_mode_fails_closed_when_canonical_db_is_unavailable(
    client, monkeypatch
):
    import importlib

    _forbid_legacy_court_orchestrator(monkeypatch)
    engine = importlib.import_module("src.db.engine")

    def _unavailable():
        raise RuntimeError("canonical db unavailable")

    monkeypatch.setattr(engine, "SessionLocal", _unavailable)

    response = client.post(
        "/api/direct/execute",
        json={"command": "请军机处会审合同风险", "mode": "court"},
    )

    assert response.status_code == 200
    assert response.json()["success"] is False
    assert "canonical_dispatch_failed" in response.json()["error"]


def test_direct_court_mode_preserves_canonical_direct_short_circuit(
    client, monkeypatch, isolated_session_local
):
    from src.execution import decree_dispatcher

    _forbid_legacy_court_orchestrator(monkeypatch)
    triggered: list[str] = []
    monkeypatch.setattr(
        decree_dispatcher, "dispatch_after_commit", triggered.append
    )

    response = client.post(
        "/api/direct/execute",
        json={"command": "请礼部整理一份客户拜访纪要。", "mode": "court"},
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["status"] == "direct_completed"

    from src.chaotang_task_projection import read_stream_snapshot
    from src.db.models import OutboxEvent

    with isolated_session_local() as db:
        outbox = db.query(OutboxEvent).filter_by(task_id=data["task_id"]).one()
        assert outbox.event_type == "route.direct"
        assert outbox.status == "pending"

    snapshot = read_stream_snapshot(data["task_id"], "1")
    assert snapshot is not None
    assert snapshot["snapshot"]["terminal"] is True
    assert snapshot["snapshot"]["status"] == "report_ready"
    assert triggered == [outbox.id]


def test_direct_court_mode_requires_auth_when_enabled(
    monkeypatch, isolated_session_local
):
    from web import deps
    from web.main import app

    monkeypatch.setattr(deps, "AUTH_ENABLED", True)
    app.dependency_overrides.pop(deps.get_current_user, None)

    response = TestClient(app).post(
        "/api/direct/execute",
        json={"command": "请军机处会审合同风险", "mode": "court"},
    )

    assert response.status_code == 401


def test_manor_router_has_no_legacy_dispatch_path_to_absorb():
    from pathlib import Path
    import web.routers.manor as manor

    source = Path(manor.__file__).read_text(encoding="utf-8")
    assert "chaotang_orchestrator" not in source
    assert "run_chaotang_task" not in source
