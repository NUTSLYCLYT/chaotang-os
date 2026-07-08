# tests/test_chaotang_study_archive.py
from fastapi.testclient import TestClient


def _client(monkeypatch):
    monkeypatch.setenv("FENGQUN_AUTH", "false")
    from web.main import app
    return TestClient(app)


def test_briefing_shape(monkeypatch):
    c = _client(monkeypatch)
    r = c.get("/api/chaotang/study/briefing")
    assert r.status_code == 200
    d = r.json()["data"]
    for k in ("dailyReport", "importantEvents", "pendingDecisions",
              "recommendations", "recentMemorials", "recentTasks"):
        assert k in d


def test_archive_and_retrospective(monkeypatch, tmp_path):
    import src.chaotang_store as cs
    monkeypatch.setattr(cs, "_DATA_ROOT", tmp_path)
    c = _client(monkeypatch)
    r = c.get("/api/chaotang/archive")
    assert r.status_code == 200 and isinstance(r.json()["data"], dict)
    r2 = c.get("/api/chaotang/archive/some_task/retrospective")
    assert r2.status_code == 200
    assert r2.json()["data"]["synthetic"] is True
