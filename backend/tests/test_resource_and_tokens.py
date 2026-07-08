"""tests/test_resource_and_tokens.py — 资源路由(分档省资源)+ token 监控护栏(防跑飞)。"""
from __future__ import annotations

from src import resource_router as rr
from src import token_monitor as tm


# ── 资源路由:琐碎事跳过重型层 ────────────────────────────────────────────────

def test_p0_skips_everything_heavy():
    r = rr.route("我们的退货政策是什么")
    assert r["tier"] == "P0"
    assert r["engage"] == {"swarm": False, "sanxing": False, "yushi_gate": False,
                           "qintianjian": False, "signoff": False}
    assert r["model_tier"] == "lite"
    assert set(r["skipped"]) == {"swarm", "sanxing", "yushi_gate", "qintianjian", "signoff"}


def test_p2_engages_swarm_sanxing_yushi():
    r = rr.route("帮我审查这份储能合同")
    assert r["tier"] == "P2"
    assert r["engage"]["swarm"] and r["engage"]["sanxing"] and r["engage"]["yushi_gate"]
    assert r["engage"]["qintianjian"] is False   # P2 不惊动钦天监
    assert r["model_tier"] == "smart"


def test_p3_full_engage_with_signoff():
    r = rr.route("确认这单付款并上线")
    assert r["tier"] == "P3" and r["needs_signoff"] is True
    assert all(r["engage"].values())   # 全开


def test_should_engage_helper():
    assert rr.should_engage("你好", "swarm") is False
    assert rr.should_engage("审查合同", "yushi_gate") is True


# ── token 监控 + 预算护栏 ─────────────────────────────────────────────────────

def setup_function(_):
    tm.reset()


def test_record_accumulates():
    tm.record("deepseek-chat", 1000, 500, run_id="r1")
    tm.record("deepseek-chat", 2000, 800, run_id="r1")
    s = tm.summary()
    assert s["runs"]["r1"]["total_tokens"] == 4300
    assert s["session"]["total_tokens"] == 4300


def test_record_from_usage_tolerant():
    snap = tm.record_from_usage({"prompt_tokens": 10, "completion_tokens": 5},
                                model="deepseek-chat", run_id="r2")
    assert snap["run_total"] == 15
    # 缺字段不崩
    assert tm.record_from_usage({}, run_id="r3")["run_total"] == 0


def test_guard_blocks_runaway_run(monkeypatch):
    monkeypatch.setattr(tm, "RUN_LIMIT", 1000)
    tm.record("deepseek-chat", 600, 500, run_id="big")  # 1100 > 1000
    g = tm.guard("big")
    assert g["ok"] is False and "单运行" in g["reason"]


def test_guard_ok_when_under_budget(monkeypatch):
    monkeypatch.setattr(tm, "RUN_LIMIT", 100000)
    monkeypatch.setattr(tm, "SESSION_LIMIT", 100000)
    tm.record("deepseek-chat", 100, 50, run_id="ok")
    assert tm.guard("ok")["ok"] is True


def test_local_model_zero_cost():
    assert tm.estimate_cost("qwen3:4b", 100000, 100000) == 0.0
    assert tm.estimate_cost("deepseek-chat", 1_000_000, 0) == 0.27
