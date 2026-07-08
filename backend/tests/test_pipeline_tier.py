"""tests/test_pipeline_tier.py — 管线复杂度分档(P0–P3)。"""
from __future__ import annotations

from src import pipeline_tier as pt


def test_p3_irreversible_needs_signoff():
    r = pt.select_pipeline_tier("帮我确认这单付款", )
    assert r["tier"] == pt.P3 and r["needs_signoff"] is True
    assert "signoff" in r["layers"]


def test_p3_by_decision_class():
    r = pt.select_pipeline_tier("做这个", decision_class="irreversible")
    assert r["tier"] == pt.P3 and r["needs_signoff"] is True


def test_p2_real_work_opens_swarm():
    r = pt.select_pipeline_tier("帮我审查这份储能合同")
    assert r["tier"] == pt.P2 and r["needs_signoff"] is False
    assert "court_doc" in r["layers"] and "swarm" in r["layers"]


def test_p2_when_entry_swarm_given():
    r = pt.select_pipeline_tier("跑一下", entry_swarm="legal")
    assert r["tier"] == pt.P2


def test_p2_multidept():
    r = pt.select_pipeline_tier("这事怎么办", involved_depts=["hubu", "xingbu"])
    assert r["tier"] == pt.P2


def test_p0_trivial_short_factual():
    r = pt.select_pipeline_tier("我们的退货政策是什么")
    assert r["tier"] == pt.P0
    assert r["layers"] == ["answer"]   # 不开蜂群/大神/court_doc


def test_p0_greeting():
    assert pt.select_pipeline_tier("你好")["tier"] == pt.P0


def test_p1_default_for_analysis():
    r = pt.select_pipeline_tier("帮我想想这个产品定位有没有问题")
    assert r["tier"] == pt.P1
    assert "advisor" in r["layers"] and "swarm" not in r["layers"]


def test_priority_p3_over_p2():
    # 既有"审查"(P2)又有"上线"(P3)→ 取最高档 P3
    r = pt.select_pipeline_tier("审查后直接上线发布")
    assert r["tier"] == pt.P3


def test_reason_never_silent():
    for cmd in ["你好", "审查合同", "确认付款", "随便分析下这个长一点的问题看看怎么样啊"]:
        assert pt.select_pipeline_tier(cmd)["reason"]
