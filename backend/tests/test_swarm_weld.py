"""tests/test_swarm_weld.py — #3 深焊:蜂群 live 循环产出 court_doc(纯增量,不破既有)。"""
from __future__ import annotations

from src.swarm_execution_loop import run_swarm_execution_loop

_PARAMS = {
    "task_id": "t1", "review_id": "r1",
    "confirmed_edict": {"raw_command": "储能项目能不能上",
                        "source_label": "MIXED", "department": "prime_minister"},
}


def test_loop_emits_court_doc():
    r = run_swarm_execution_loop(_PARAMS)
    cd = r.get("court_doc")
    assert cd is not None
    assert cd["dept"] == "prime_minister" and cd["doc_type"] == "edict"
    assert cd["light"] in ("green", "yellow", "red", "black")
    assert cd["seal"]["stamp"] == "相印"


def test_loop_preserves_existing_keys():
    r = run_swarm_execution_loop(_PARAMS)
    # 深焊是纯增量:既有键一个不少
    for k in ("swarm_run", "task_runs", "brief", "quality_result", "conflict_summary"):
        assert k in r, f"深焊破坏了既有键 {k}"


def test_unknown_dept_falls_back_to_prime_minister():
    p = {**_PARAMS, "confirmed_edict": {**_PARAMS["confirmed_edict"], "department": "no_such"}}
    cd = run_swarm_execution_loop(p)["court_doc"]
    assert cd["dept"] == "prime_minister"   # 未注册部门兜底,不崩
