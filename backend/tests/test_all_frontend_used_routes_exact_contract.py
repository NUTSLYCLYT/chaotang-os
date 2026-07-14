from __future__ import annotations

from fastapi.testclient import TestClient

from web.main import app


def test_chaotang_archive_search_exact_contract():
    response = TestClient(app).get("/api/chaotang/archive/search?q=test")

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert {"results", "query", "total", "sourceLabel"} <= set(payload["data"])


def test_court_backend_task_exact_missing_contract():
    response = TestClient(app).get("/api/court/backend/tasks/missing-task")

    assert response.status_code == 404
    assert "missing-task" in response.json()["detail"]


def test_governance_actor_and_audit_exact_contracts():
    client = TestClient(app)

    actor = client.get("/api/governance/whoami")
    assert actor.status_code == 200
    assert "actor" in actor.json()

    updated = client.post("/api/governance/whoami", json={"actor": "zhongshu"})
    assert updated.status_code == 200
    assert updated.json()["actor"] == "zhongshu"

    audit = client.get("/api/governance/audit/summary")
    assert audit.status_code == 200
    assert {"totalBills", "okCount", "tamperedCount", "sourceLabel"} <= set(audit.json())


def test_legal_overview_and_from_text_exact_contracts():
    client = TestClient(app)

    overview = client.get("/api/legal/overview")
    assert overview.status_code == 200
    overview_payload = overview.json()
    assert overview_payload["success"] is True
    assert {"cases", "complianceItems", "summary"} <= set(overview_payload["data"])

    verdict = client.post("/api/legal/verdict/from-text", json={"text": ""})
    assert verdict.status_code == 200
    verdict_payload = verdict.json()
    assert verdict_payload["success"] is False
    assert verdict_payload["error"]


def test_swarm_runs_serial_exact_validation_contract(isolated_session_local):
    response = TestClient(app).post(
        "/api/swarm-runs/serial",
        json={"task_id": "missing-task", "review_id": None, "mode": "standard"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is False
    assert payload["data"]["source_label"] == "FALLBACK"
