# tests/test_chaotang_memorials.py
from src.chaotang_api import build_memorial_sections


def test_build_sections_from_final_output():
    fo = {"background": "b", "objective": "o", "risks": ["r1"],
          "recommendation": "rec", "opinions": [{"agentCode": "hu_bu", "text": "算账"}],
          "executionPath": [], "decisionsNeeded": ["d1"], "nextSteps": ["n1"]}
    sec = build_memorial_sections(fo)
    assert sec["background"] == "b"
    assert sec["risks"] == ["r1"]
    assert sec["opinions"][0]["agentCode"] == "hu_bu"


def test_build_sections_tolerates_missing():
    sec = build_memorial_sections({})
    assert sec["background"] == "" and sec["risks"] == [] and sec["opinions"] == []


from fastapi.testclient import TestClient


def test_review_persists(monkeypatch, tmp_path):
    monkeypatch.setenv("FENGQUN_AUTH", "false")
    import src.chaotang_store as cs
    monkeypatch.setattr(cs, "_DATA_ROOT", tmp_path)
    import web.routers.chaotang as ct
    class _Run:
        final_output = {}
        task_input = "x"
    monkeypatch.setattr(ct, "load_run", lambda rid: _Run())
    from web.main import app
    c = TestClient(app)
    r = c.post("/api/chaotang/memorials/run_x/review",
               json={"action": "approve", "comment": "准"})
    assert r.status_code == 200
    assert r.json()["data"]["action"] == "approve"
    assert cs.get_review_for_memorial("run_x")["comment"] == "准"
