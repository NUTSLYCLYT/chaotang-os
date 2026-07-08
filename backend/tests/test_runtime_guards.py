"""tests/test_runtime_guards.py — C5 分档升档 + C2 大神禁当放行人(方案A运行时护栏)。"""
from __future__ import annotations

import pytest

from src import pipeline_tier as pt
from src import persona_registry as pr


# ── C5:不确定往上抬一档 ──────────────────────────────────────────────────────

def test_uncertain_bumps_p1_to_p2():
    base = pt.select_pipeline_tier("帮我想想这个产品定位")
    assert base["tier"] == pt.P1
    up = pt.select_pipeline_tier("帮我想想这个产品定位", uncertain=True)
    assert up["tier"] == pt.P2 and "C5" in up["reason"]


def test_uncertain_bumps_p0_to_p1():
    up = pt.select_pipeline_tier("退货政策是什么", uncertain=True)
    assert up["tier"] == pt.P1


def test_uncertain_caps_at_p3():
    up = pt.select_pipeline_tier("确认付款上线", uncertain=True)
    assert up["tier"] == pt.P3 and up["needs_signoff"] is True


def test_certain_unchanged():
    assert pt.select_pipeline_tier("帮我审查合同")["tier"] == pt.P2


# ── C2:大神/律师永远不能当放行人 ───────────────────────────────────────────

def test_advisors_cannot_gate():
    for name in ("richard-posner", "bruce-schneier", "contract-lawyer", "deming", "karpathy"):
        assert pr.is_valid_gatekeeper(name) is False


def test_only_yushi_harness_can_gate():
    for name in ("yushi", "御史", "harness", "release_gate"):
        assert pr.is_valid_gatekeeper(name) is True


def test_assert_not_gating_raises_on_violation():
    pr.assert_not_gating(["richard-posner", "contract-lawyer"])  # 纯参谋,OK
    with pytest.raises(ValueError, match="C2 违反"):
        pr.assert_not_gating(["richard-posner", "yushi"])  # 混入放行人 → 抛
