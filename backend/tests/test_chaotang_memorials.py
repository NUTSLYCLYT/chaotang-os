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


def test_review_persists_in_canonical_decision_chain(
    monkeypatch, tmp_path, isolated_session_local
):
    monkeypatch.setenv("FENGQUN_AUTH", "false")
    import src.chaotang_store as cs
    monkeypatch.setattr(cs, "_DATA_ROOT", tmp_path)
    import web.routers.chaotang as ct
    class _Run:
        final_output = {}
        task_input = "x"
    monkeypatch.setattr(ct, "load_run", lambda rid: _Run())
    from src.db.models import DecisionTask, FinalMemorial, Task

    with isolated_session_local() as db:
        db.add(
            DecisionTask(
                id="task_run_x",
                tenant_id=1,
                user_id="1",
                raw_question="正式任务 x",
                status="awaiting_decision",
                source_label="MIXED",
            )
        )
        db.add(Task(task_id="task_run_x", run_id="run_x", status="done"))
        db.add(
            FinalMemorial(
                id="formal_run_x",
                tenant_id=1,
                task_id="task_run_x",
                review_id="court_run_x",
                swarm_run_id="run_x",
                quality_result_id="quality_run_x",
                status="ready_for_decision",
                source_label="MIXED",
                memorial_json='{"title":"正式奏折"}',
                content_hash="hash_run_x",
            )
        )
        db.commit()
    from web.main import app
    c = TestClient(app)
    r = c.post("/api/chaotang/memorials/run_x/review",
               json={"action": "approve", "comment": "准"})
    assert r.status_code == 200
    assert r.json()["data"]["action"] == "approve"
    from src.db.models import EmperorDecision

    with isolated_session_local() as db:
        decision = db.query(EmperorDecision).filter_by(task_id="task_run_x").one()
        assert decision.action == "approve"
        assert decision.reason == "准"
    assert cs.get_review_for_memorial("run_x") is None
