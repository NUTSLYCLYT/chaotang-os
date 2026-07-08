# tests/test_chaotang_run.py
import queue
from src import chaotang_orchestrator as orch


def test_translate_engine_events_to_court_semantics():
    assert orch.translate_event({"type": "flow_start", "total": 3,
                                 "steps": ["council_hu_bu", "group_finlaw", "aggregate"]}
                                )["type"] == "council.summon"
    assert orch.translate_event({"type": "step_start", "step": 0,
                                 "name": "council_hu_bu"})["type"] == "minister.opinion"
    g = orch.translate_event({"type": "step_start", "step": 1, "name": "group_finlaw"})
    assert g["type"] == "group.dispatch" and g["groupId"] == "finlaw"
    assert orch.translate_event({"type": "token", "step": 1, "content": "x"})["type"] == "subagent.step"
    assert orch.translate_event({"type": "heartbeat"}) is None


def test_partial_group_failure_still_aggregates(monkeypatch):
    events = []

    class FakeEngine:
        def __init__(self, *a, **k): pass
        def run(self, task_input, on_step_done=None, on_flow_start=None,
                on_step_start=None, **cbs):
            on_flow_start and on_flow_start(3, "朝堂", ["g1", "g2", "aggregate"])
            on_step_done and on_step_done(0, 3, "group_g1", 1.0, "error", "")
            on_step_done and on_step_done(1, 3, "group_g2", 1.0, "success", "ok")
            on_step_done and on_step_done(2, 3, "aggregate", 1.0, "success", "{}")
            class RL:
                run_id = "run_x"; final_output = {"background": "b"}; quality_score = {"total_score": 4.0}
            return RL()

    monkeypatch.setattr(orch, "FlowEngine", FakeEngine)
    q: queue.Queue = queue.Queue()
    orch.run_chaotang_task("task_x", q, flow_path="/tmp/x.yaml", min_success_groups=1)
    while not q.empty():
        events.append(q.get())
    types = [e["type"] for e in events]
    assert "memorial.drafted" in types
    assert "done" in types
    assert any(e["type"] == "risk.flagged" for e in events)


def test_full_success_run_emits_memorial(monkeypatch):
    events = []

    class FakeEngine:
        def __init__(self, *a, **k): pass
        def run(self, task_input, on_step_done=None, on_flow_start=None,
                on_step_start=None, **cbs):
            on_flow_start and on_flow_start(3, "朝堂", ["g1", "g2", "aggregate"])
            on_step_done and on_step_done(0, 3, "group_g1", 1.0, "success", "ok1")
            on_step_done and on_step_done(1, 3, "group_g2", 1.0, "success", "ok2")
            on_step_done and on_step_done(2, 3, "aggregate", 1.0, "success", "{}")
            class RL:
                run_id = "run_ok"; final_output = {"background": "b"}; quality_score = {"total_score": 4.5}
            return RL()

    monkeypatch.setattr(orch, "FlowEngine", FakeEngine)
    q: queue.Queue = queue.Queue()
    orch.run_chaotang_task("task_ok", q, flow_path="/tmp/x.yaml", min_success_groups=1)
    while not q.empty():
        events.append(q.get())
    types = [e["type"] for e in events]
    assert "error" not in types
    assert "memorial.drafted" in types
    assert "done" in types
    assert "risk.flagged" not in types


def test_run_status_error_emits_error(monkeypatch):
    events = []

    class FakeEngine:
        def __init__(self, *a, **k): pass
        def run(self, task_input, on_step_done=None, on_flow_start=None,
                on_step_start=None, **cbs):
            on_flow_start and on_flow_start(2, "朝堂", ["g1", "aggregate"])
            on_step_done and on_step_done(0, 2, "group_g1", 1.0, "success", "ok")
            class RL:
                run_status = "error"; run_id = "run_err"
                final_output = {}; quality_score = {}
            return RL()

    monkeypatch.setattr(orch, "FlowEngine", FakeEngine)
    q: queue.Queue = queue.Queue()
    orch.run_chaotang_task("task_err", q, flow_path="/tmp/x.yaml", min_success_groups=1)
    while not q.empty():
        events.append(q.get())
    types = [e["type"] for e in events]
    assert "error" in types
    assert "memorial.drafted" not in types
