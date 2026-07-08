"""tests/test_libu_vet.py — 吏部招聘复核:决策锚定(复用recruit_check)+资质红线+飞轮校准。

确定性、离线:recruit_check 是纯正则;hire_outcome 读文件缺失/空时降级为"未加燃料"背书。
"""

from __future__ import annotations

import src.libu_vet as lv

BATTERY_TASK = "招聘锂电PACK工艺工程师,筛选简历"
GOOD = "硬性要求 R-01:3年焊接经验。逐项核验:R-01满足。安全资质:需危化/特种作业持证。结论:录用张工。"


def test_reuses_recruit_check_decision_anchors():
    # 复用 recruit_check:含 R-01 锚定 + 核验 + 结论 → 决策类条目为 green,无 red
    items = lv.vet_recruit_plan(GOOD, BATTERY_TASK)
    assert any(
        "C1硬性要求锚定" in it["title"] and it["level"] == "green" for it in items
    ), items
    assert not any(it["level"] == "red" for it in items), items


def test_battery_role_missing_safety_qual_is_red():
    items = lv.vet_recruit_plan(
        "硬性要求R-01:3年经验。逐项核验满足。结论:录用。", BATTERY_TASK
    )
    assert any(
        it["level"] == "red" and "安全资质" in it["title"] for it in items
    ), items


def test_blackbox_rejection_is_red_via_c3():
    # 有淘汰无依据 = 黑箱淘汰,C3 判 red
    items = lv.vet_recruit_plan(
        "综合评估,候选人李工淘汰,建议录用张工。", "招聘行政前台"
    )
    assert any(it["level"] == "red" and "C3" in it["title"] for it in items), items


def test_no_hire_decision_does_not_false_red():
    # 面试方案设计(无录用/淘汰决策):C1/C4 未过应降 yellow,不误判 red
    plan = "胜任力模型:大单管控。结构化面试题5道。评分锚点:优秀/合格。"
    items = lv.vet_recruit_plan(plan, "设计储能销售总监面试方案")
    # 电池域(储能)漏资质仍是 red,但决策类不该因无录用结论而 red
    decision_reds = [
        it
        for it in items
        if it["level"] == "red" and "C" in it["title"] and "安全资质" not in it["title"]
    ]
    assert not decision_reds, decision_reds


def test_flywheel_calibration_item_always_present():
    items = lv.vet_recruit_plan(GOOD, BATTERY_TASK)
    assert any("飞轮校准" in it["title"] for it in items), items


def test_flywheel_evaluates_system_not_person():
    # deming:命中率背书是 green info,不产生对个人的红黄惩罚
    note = lv.hire_calibration_note()
    assert note["level"] == "green"
    assert (
        "评系统" in note["title"]
        or "无历史命中率背书" in note["title"]
        or "未加真数据" in note["title"]
    )


def test_safety_redline_cites_specific_role_from_list():
    # 清单驱动:PACK岗漏资质→red,须指名 role id(R-PACK)+回链清单版本
    items = lv._battery_safety_items(
        "硬性要求3年经验。结论录用。", "招聘锂电PACK工艺工程师"
    )
    red = [it for it in items if it["level"] == "red"]
    assert red and "R-PACK" in red[0]["title"], items
    assert "safety_qual@v" in red[0]["evidence_ref"], items


def test_safety_redline_role_specific_qual_passes():
    # 储能运维提"消防/高压电工"→命中 R-STORAGE-OPS required_any → green
    items = lv._battery_safety_items("要求持有消防证与高压电工。", "储能电站运维工程师")
    assert (
        items and items[0]["level"] == "green" and "R-STORAGE-OPS" in items[0]["title"]
    )


def test_non_battery_role_skips_redline():
    assert lv._battery_safety_items("要求大专学历。", "招聘行政前台") == []


def test_build_libu_verdict_court_doc_shape():
    doc = lv.build_libu_verdict(GOOD, BATTERY_TASK, archive=False)
    assert doc["dept"] == "libu_personnel"
    assert doc["seal"]["stamp"] == "印绶印"
    assert doc["items"]
