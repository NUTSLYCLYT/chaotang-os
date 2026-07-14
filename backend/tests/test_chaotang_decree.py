# tests/test_chaotang_decree.py
from fastapi.testclient import TestClient


def _client(monkeypatch):
    monkeypatch.setenv("FENGQUN_AUTH", "false")
    from web.main import app
    return TestClient(app)


def test_draft_endpoint(monkeypatch):
    from src import chaotang_orchestrator as orch
    monkeypatch.setattr(orch, "draft_decree", lambda rc: {
        "draft": "拟旨", "intent": "评估", "source": "llm",
        "recommendedCategories": [{"id": "c1", "label": "可行性", "description": "",
                                   "taskType": "analysis", "ministers": ["hu_bu"],
                                   "groups": ["finlaw"], "confidence": 0.8, "citations": []}]})
    c = _client(monkeypatch)
    r = c.post("/api/chaotang/decree/draft", json={"rawCommand": "评估项目"})
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["recommendedCategories"][0]["groups"] == ["finlaw"]


def test_dispatch_returns_taskid_and_streamurl(monkeypatch, isolated_session_local):
    from src import chaotang_orchestrator as orch
    monkeypatch.setattr(orch, "assemble_flow", lambda *a, **k: "/tmp/fake.yaml")
    monkeypatch.setattr("web.routers.chaotang._spawn_run", lambda *a, **k: None)
    c = _client(monkeypatch)
    r = c.post("/api/chaotang/decree/dispatch",
               json={"rawCommand": "评估项目", "intent": "评估",
                     "selectedCategories": [{"taskType": "analysis",
                                             "ministers": ["hu_bu"], "groups": ["finlaw"]}]})
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["taskId"]
    assert data["streamUrl"] == f"/api/chaotang/stream/{data['taskId']}"
    assert data["groups"] == ["finlaw"]
