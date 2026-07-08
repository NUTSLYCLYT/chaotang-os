"""tests/test_difficulty_assessor.py — 难易度评判(旨意×自动化×军机处)+ 用户可改档。"""
from __future__ import annotations

from src import difficulty_assessor as da


def test_trivial_is_p0_low_effort():
    a = da.assess("我们的退货政策是什么")
    assert a["tier"] == "P0" and a["effort_score"] <= 3
    assert a["overridden"] is False


def test_irreversible_automation_forces_p3():
    a = da.assess("跑个内部任务", automation_level="L5")
    assert a["tier"] == "P3" and a["needs_signoff"] is True
    assert "L5" in a["reason"]


def test_council_low_confidence_bumps_up():
    base = da.assess("帮我想想定位")                       # P1
    bumped = da.assess("帮我想想定位", council_confidence="低")
    assert da._TIER_ORDER.index(bumped["tier"]) > da._TIER_ORDER.index(base["tier"])


def test_council_conflicts_bump_up():
    a = da.assess("帮我想想定位", council_conflicts=2)
    assert a["tier"] != "P1"   # 有分歧 → 升档


def test_user_override_wins_and_marked():
    # 自动评 P2,用户强制降到 P0(像 Claude Code 选档)
    a = da.assess("帮我审查合同", user_force_tier="P0")
    assert a["tier"] == "P0" and a["overridden"] is True
    assert a["auto_tier"] == "P2"   # 仍记录自动评的结果
    assert "用户改档" in a["reason"]


def test_user_override_can_escalate():
    a = da.assess("你好", user_force_tier="P3")
    assert a["tier"] == "P3" and a["overridden"] is True and a["needs_signoff"] is True


def test_effort_score_in_range():
    for cmd, kw in [("你好", {}), ("审查合同", {"automation_level": "L5", "council_conflicts": 3})]:
        a = da.assess(cmd, **kw)
        assert 1 <= a["effort_score"] <= 10


def test_panel_row_shape():
    row = da.panel_row("t1", "确认付款上线", council_confidence="低")
    assert row["task_id"] == "t1" and row["tier"] in da._TIER_ORDER
    assert "engaged_layers" in row and isinstance(row["engaged_layers"], list)
    assert "overridden" in row and "effort" in row
