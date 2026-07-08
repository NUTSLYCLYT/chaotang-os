"""tests/test_automation_tier.py — 自动化档:绿自动/黄留痕/可逆红一键放行/不可逆红必须人签。

核心:决策权在客户 —— 不可逆(合同/资金/发布)必须人签;可逆红只需一键放行;绿黄不打扰人。
"""

from __future__ import annotations

import src.automation_tier as at


def test_green_auto_pass_no_human():
    r = at.decide_auto_action("green")
    assert r["tier"] == at.AUTO_PASS and r["human_needed"] is False


def test_yellow_auto_proceed_logged_no_human():
    r = at.decide_auto_action("yellow")
    assert r["tier"] == at.AUTO_PROCEED_LOGGED and r["human_needed"] is False


def test_reversible_red_holds_for_one_click_release():
    r = at.decide_auto_action("red", text="这篇内部方案筛选标准偏松", dept="bingbu")
    assert r["tier"] == at.HOLD_FOR_RELEASE and r["human_needed"] is True


def test_irreversible_dept_red_requires_human_sign():
    # 刑部合同:签下去收不回 → 必须人签(即使文本无"签署"字样)
    r = at.decide_auto_action("red", text="违约金50%超红线", dept="xingbu")
    assert r["tier"] == at.REQUIRE_HUMAN_SIGN


def test_irreversible_text_red_requires_human_sign():
    # 文本含资金/打款 → 必须人签(即使部门可逆)
    r = at.decide_auto_action(
        "red", text="自动给客户打款并对客户承诺交期", dept="bingbu"
    )
    assert r["tier"] == at.REQUIRE_HUMAN_SIGN


def test_black_always_requires_human_sign():
    r = at.decide_auto_action("red", text="改个内部草稿", has_black=True, dept="bingbu")
    assert r["tier"] == at.REQUIRE_HUMAN_SIGN


def test_tier_for_doc_reads_dept_and_light():
    doc = {
        "dept": "xingbu",
        "light": "red",
        "items": [{"level": "red", "title": "违约金超红线"}],
    }
    assert at.tier_for_doc(doc)["tier"] == at.REQUIRE_HUMAN_SIGN


def test_tier_for_items_infers_light():
    items = [{"level": "green", "title": "ok"}, {"level": "yellow", "title": "待核"}]
    assert at.tier_for_items(items)["tier"] == at.AUTO_PROCEED_LOGGED


def test_ministry_contract_carries_auto_action():
    # L4 消费层把自动化档带出去,下游据此决定自动流转还是留人
    from src import real_department_engines as rde

    doc = {
        "dept": "xingbu",
        "light": "red",
        "headline": "建议驳回",
        "items": [{"level": "red", "title": "违约金超红线", "fix": None}],
        "provenance": {},
    }
    out = rde._court_doc_to_ministry_contract(doc, swarm_id="s", swarm_role="r")
    assert out["auto_action"] == at.REQUIRE_HUMAN_SIGN
    assert out["requires_human"] is True
