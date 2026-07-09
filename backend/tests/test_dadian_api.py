from __future__ import annotations

from fastapi.testclient import TestClient

from web import deps
from web.main import app


def test_dadian_pulse_contract():
    client = TestClient(app)
    response = client.get("/api/court/dadian/pulse")

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    data = payload["data"]
    for key in (
        "activeTasks",
        "riskCount",
        "opportunityCount",
        "swarmActivity",
        "memorialsToday",
        "pendingDecisions",
        "source",
        "generatedAt",
    ):
        assert key in data
    assert data["source"] in {"real", "fallback"}
    assert isinstance(data["activeTasks"], int)


def test_dadian_feed_contract():
    client = TestClient(app)
    response = client.get("/api/court/dadian/feed")

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    data = payload["data"]
    assert {"items", "notice", "source", "generatedAt"} <= set(data)
    assert data["source"] in {"real", "fallback"}
    assert isinstance(data["items"], list)
    for item in data["items"]:
        assert {"id", "depts", "title", "status", "time"} <= set(item)
        assert item["status"] in {"执行中", "待审", "已结"}


def test_dadian_feed_requires_auth_when_backend_auth_enabled(monkeypatch):
    monkeypatch.setattr(deps, "AUTH_ENABLED", True)
    app.dependency_overrides.pop(deps.get_current_user, None)
    client = TestClient(app)

    response = client.get("/api/court/dadian/feed")

    assert response.status_code == 401


def test_chancellor_advice_is_derived_or_unavailable_not_fake_live():
    client = TestClient(app)
    response = client.get("/api/court/chancellor-advice?dept=overview")

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    data = payload["data"]
    assert data["source"] in {"derived", "unavailable"}
    assert data["source"] != "live"
    if data["source"] == "derived":
        assert data["advice"]["chancellorRecommendation"]
        assert data["advice"]["reasons"]
    else:
        assert data["advice"] is None
        assert data["reason"]


def test_decision_judgment_records_and_summarizes(monkeypatch, tmp_path):
    ledger = tmp_path / "dadian_judgments.jsonl"
    monkeypatch.setenv("FENGQUN_DADIAN_JUDGMENT_LEDGER", str(ledger))
    client = TestClient(app)

    initial = client.get("/api/court/decision-judgment")
    assert initial.status_code == 200
    assert initial.json()["data"] == {"count": 0, "helpfulRate": None}

    response = client.post(
        "/api/court/decision-judgment",
        json={
            "question": "Should this advice help?",
            "verdict": "Proceed with evidence.",
            "taskId": "task-1",
            "helpful": True,
            "note": "",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["recorded"] is True
    assert payload["data"]["count"] == 1
    assert payload["data"]["helpfulRate"] == 100

    stats = client.get("/api/court/decision-judgment").json()["data"]
    assert stats == {"count": 1, "helpfulRate": 100}
