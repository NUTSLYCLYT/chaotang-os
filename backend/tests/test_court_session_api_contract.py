from __future__ import annotations

from fastapi.testclient import TestClient

from web.main import app
from web.routers import court_session


def test_court_session_latest_fallback_contract(monkeypatch, tmp_path):
    monkeypatch.setattr(court_session, "_REPORT_DIR", tmp_path / "missing")

    response = TestClient(app).get("/api/court-session/latest")

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    data = payload["data"]
    assert data["available"] is False
    assert data["sourceLabel"] == "FALLBACK"
    assert data["stamp"] == ""
    assert data["content"] == ""
    assert set(data["summary"]) == {
        "deptCount",
        "groundedCount",
        "ungroundedCount",
        "conflictCount",
    }


def test_court_session_latest_report_contract(monkeypatch, tmp_path):
    report_dir = tmp_path / "court_session"
    report_dir.mkdir()
    report = report_dir / "浠婃棩鏈濇姤-20260710.md"
    report.write_text("- **户部**\n有据\n", encoding="utf-8")
    monkeypatch.setattr(court_session, "_latest_report", lambda: report)

    response = TestClient(app).get("/api/court-session/latest")

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    data = payload["data"]
    assert data["available"] is True
    assert data["sourceLabel"] == "MIXED"
    assert data["stamp"].endswith("20260710")
    assert "**" in data["content"]
    assert set(data["summary"]) == {
        "deptCount",
        "groundedCount",
        "ungroundedCount",
        "conflictCount",
    }
