"""tests/test_shangshufang_entry.py — 上书房单一门面(#3+#4:接线+丞相入口)。"""
from __future__ import annotations

from src import shangshufang_entry as sse
from src import token_monitor as tm


def setup_function(_):
    tm.reset()


def test_p0_light_no_swarm():
    r = sse.handle("我们的退货政策是什么")
    assert r["tier"] == "P0" and r["status"] == "light"
    assert r["engaged_layers"] == [] and r["court_doc"] is None
    assert r["model_tier"] == "lite"


def test_p2_runs_swarm_and_hides_machinery(monkeypatch):
    # 注入假蜂群,验证 P2 走蜂群出 court_doc,门面统一
    fake = lambda p: {"court_doc": {"dept": "prime_minister", "light": "yellow"}}  # noqa: E731
    r = sse.handle("帮我审查这份储能合同", swarm_runner=fake)
    assert r["tier"] == "P2" and r["status"] == "ok"
    assert r["court_doc"]["light"] == "yellow"
    assert "swarm" in r["engaged_layers"]
    assert "后台" in r["hidden"]   # 机器藏在门面后


def test_budget_block_short_circuits(monkeypatch):
    monkeypatch.setattr(tm, "RUN_LIMIT", 100)
    tm.record("deepseek-chat", 80, 40, run_id="over")  # 120 > 100
    r = sse.handle("帮我审查合同", run_id="over")
    assert r["status"] == "budget_blocked" and r["court_doc"] is None


def test_user_force_tier_flows_through():
    fake = lambda p: {"court_doc": {"dept": "prime_minister"}}  # noqa: E731
    r = sse.handle("你好", user_force_tier="P3", swarm_runner=fake)
    assert r["tier"] == "P3" and r["needs_signoff"] is True
    assert r["panel"]["overridden"] is True


def test_panel_row_always_present():
    r = sse.handle("你好")
    assert r["panel"]["task_id"] and r["panel"]["tier"] == "P0"


def test_swarm_error_does_not_crash():
    boom = lambda p: (_ for _ in ()).throw(RuntimeError("boom"))  # noqa: E731
    r = sse.handle("审查合同", swarm_runner=boom)
    assert r["status"] == "swarm_error" and r["court_doc"] is None
