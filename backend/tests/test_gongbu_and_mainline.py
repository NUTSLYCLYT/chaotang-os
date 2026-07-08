"""tests/test_gongbu_and_mainline.py — 工部确定性接地 + 丞相主线保真(借鉴融合)。"""
from __future__ import annotations

import pytest

from src import court_doc_builder as cdb
from src import gongbu_review_verdict as gv


# ── 工部:确定性重算接地(借工部,非 RAG)──────────────────────────────────────

def test_gongbu_green_when_recompute_matches():
    v = {"extracted": True, "green": True, "seriesTruth": "PASS",
         "parallelTruth": "PASS", "deviations": {}}
    doc = gv.build_gongbu_review(v, archive=False)
    assert doc["dept"] == "gongbu" and doc["doc_type"] == "review"
    assert doc["light"] == "green"
    assert doc["provenance"]["grounding"] == "deterministic"
    assert doc["provenance"]["deterministic_gated"] is True
    assert doc["seal"]["stamp"] == "规矩印"


def test_gongbu_advisors_match_dept_design_doc():
    """docs/dept_design/gongbu.md §三:工程分支判官(kent-beck/charity-majors/martin-fowler)+
    顾问(karpathy/elon-musk-perspective/sam-altman)。这轮才补上(此前一直是空的)。
    """
    v = {"extracted": True, "green": True, "seriesTruth": "PASS",
         "parallelTruth": "PASS", "deviations": {}}
    doc = gv.build_gongbu_review(v, archive=False)
    assert doc["provenance"]["advisors"] == [
        "kent-beck", "charity-majors", "martin-fowler",
        "karpathy", "elon-musk-perspective", "sam-altman",
    ]


def test_gongbu_red_when_recompute_mismatch():
    v = {"extracted": True, "green": False, "seriesTruth": "PASS",
         "parallelTruth": "FAIL", "deviations": {"parallel": 3}}
    doc = gv.build_gongbu_review(v, archive=False)
    assert doc["light"] == "red"
    assert doc["provenance"]["deterministic_gated"] is True   # 重算成功(只是对不上)


def test_gongbu_unknown_blocks_fake_pass():
    # extracted=False → UNKNOWN → 禁假 PASS:gate pending
    v = {"extracted": False, "green": False, "deviations": {}}
    doc = gv.build_gongbu_review(v, archive=False)
    assert doc["provenance"]["gate"] == "pending"
    assert doc["provenance"]["deterministic_gated"] is False
    assert "不予验收" in doc["headline"]


# ── 丞相主线:按灯排序 + 物理保真(不软化各部门红灯)─────────────────────────

def _doc(dept, light):
    return cdb.build_court_doc(dept, items=[{"level": light if light != "black" else "red"}],
                              escalate_black=(light == "black"), archive=False)


def test_mainline_orders_by_severity_lead_is_worst():
    docs = [_doc("hubu", "green"), _doc("xingbu", "red"), _doc("gongbu", "yellow")]
    ml = cdb.assemble_mainline(docs, archive=False)
    assert ml["dept"] == "prime_minister" and ml["seal"]["stamp"] == "相印"
    # 主线第一句指向最严重(刑部 red)
    assert "xingbu" in ml["headline"]


def test_mainline_preserves_levels():
    docs = [_doc("xingbu", "red"), _doc("hubu", "green")]
    ml = cdb.assemble_mainline(docs, archive=False)
    cdb.assert_mainline_preserves(docs, ml)   # 不抛 = 没软化


def test_mainline_tamper_raises():
    docs = [_doc("xingbu", "red")]
    ml = cdb.assemble_mainline(docs, archive=False)
    # 篡改:把刑部 red 软化成 green
    for it in ml["items"]:
        it["level"] = "green"
    with pytest.raises(ValueError, match="丞相违规"):
        cdb.assert_mainline_preserves(docs, ml)
