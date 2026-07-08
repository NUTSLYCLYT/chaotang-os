"""tests/test_nightly_flywheel.py — 硬棘轮门 + 进化日报(命门,不依赖 LLM)。"""
from __future__ import annotations

import importlib.util
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location(
    "nightly_flywheel", _ROOT / "scripts" / "nightly_flywheel.py")
fw = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fw)


# ── 硬棘轮门 ─────────────────────────────────────────────────────────────────

def test_gate_promotes_only_when_beats_baseline():
    assert fw.ratchet_gate(8.0, 7.5)["promote"] is True
    assert fw.ratchet_gate(7.5, 7.5)["promote"] is False   # 平手不算赢
    assert fw.ratchet_gate(7.0, 7.5)["promote"] is False   # 退步必拒


def test_gate_reject_carries_reason():
    g = fw.ratchet_gate(7.0, 7.5)
    assert g["promote"] is False and "硬门" in g["reason"]  # 绝不静默


def test_gate_min_delta_tightens():
    assert fw.ratchet_gate(7.6, 7.5, min_delta=0.2)["promote"] is False  # +0.1 不够
    assert fw.ratchet_gate(7.8, 7.5, min_delta=0.2)["promote"] is True   # +0.3 过


def test_signed_override_is_only_way_through():
    g = fw.ratchet_gate(1.0, 9.0, signed_override=True)
    assert g["promote"] is True and "override" in g["reason"]


def test_evaluate_candidates_unknown_domain_not_promoted():
    res = fw.evaluate_candidates(
        [{"key": "x", "domain": "no_such_domain", "score": 99}], baseline={})
    assert res[0]["promote"] is False and "基线" in res[0]["reason"]


def test_evaluate_candidates_mixed():
    baseline = {"finance": {"quality_score": 7.0}, "legal": {"quality_score": 8.0}}
    cands = [
        {"key": "fin_v2", "domain": "finance", "score": 7.5},   # 升 → 晋升
        {"key": "leg_v2", "domain": "legal", "score": 7.5},     # 退 → 拒绝
    ]
    res = fw.evaluate_candidates(cands, baseline)
    by = {r["key"]: r for r in res}
    assert by["fin_v2"]["promote"] is True
    assert by["leg_v2"]["promote"] is False


# ── 诊断 + 日报 ──────────────────────────────────────────────────────────────

def test_diagnose_weakest_sorts_ascending():
    baseline = {
        "a": {"quality_score": 9.0}, "b": {"quality_score": 5.0}, "c": {"quality_score": 7.0},
    }
    weak = fw.diagnose_weakest(baseline, bottom_n=2)
    assert [w["domain"] for w in weak] == ["b", "c"]


def test_build_report_runs_offline_with_real_roster():
    rep = fw.build_report(now_iso="2026-06-30T00:00:00+00:00")
    # 大神花名册接真实 registry,判官+观点两席都有人
    assert rep["personas"]["total"] >= 15
    assert rep["personas"]["judge_count"] >= 1
    assert rep["personas"]["advisor_count"] >= 1
    assert rep["ratchet"]["mode"] == "hard"
    # 手动模式无候选
    assert rep["candidates_evaluated"] == 0


def test_render_markdown_contains_benches():
    rep = fw.build_report(now_iso="2026-06-30T00:00:00+00:00",
                          candidates=[{"key": "k", "domain": "finance", "score": 9.9}])
    md = fw.render_markdown(rep)
    assert "判官席" in md and "观点席" in md and "棘轮门" in md
