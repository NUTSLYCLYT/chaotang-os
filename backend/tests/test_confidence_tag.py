"""tests/test_confidence_tag.py — 可信度章（每个数字带来源章）可证伪测试。

纯确定性、无模型链路、无外部依赖。
核心契约：
  - 有一手来源（财报/官方公告/交易所）的数字 → 标 "一手"。
  - 有二手来源（行业媒体/新闻转述）的数字 → 标 "二手"。
  - 没有任何来源的硬数字 → 标 "待核" / "推算"（反幻觉）。
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.confidence_tag import classify, tag_confidence  # noqa: E402


# ── classify：来源 → tier ──────────────────────────────────────────────────
def test_classify_firsthand_from_financial_report():
    r = classify("营收152.8万", ["公司2025年财报"])
    assert r["tier"] == "一手"
    assert "一手" in r["mark"]


def test_classify_firsthand_from_official_announcement():
    r = classify("产能扩张至30GWh", ["交易所官方公告"])
    assert r["tier"] == "一手"


def test_classify_secondhand_from_industry_media():
    r = classify("出货量增长40%", ["据GGII行业媒体报道"])
    assert r["tier"] == "二手"
    assert "二手" in r["mark"]


def test_classify_secondhand_from_news_relay():
    r = classify("融资2亿", ["据36kr报道"])
    assert r["tier"] == "二手"


def test_classify_no_source_is_unverified():
    r = classify("毛利率高达45%", None)
    assert r["tier"] == "推算"
    assert "待核" in r["mark"] or "推算" in r["mark"]


def test_classify_empty_source_list_is_unverified():
    r = classify("市占率18%", [])
    assert r["tier"] == "推算"


def test_classify_returns_mark_string():
    r = classify("营收152.8万", ["财报"])
    assert isinstance(r["mark"], str) and r["mark"]


# ── tag_confidence：文本里的硬数字打章 ─────────────────────────────────────
def test_tag_firsthand_number_gets_firsthand_mark():
    text = "据公司2025年财报，营收152.8万元。"
    out = tag_confidence(text, ["公司2025年财报"])
    assert "152.8" in out
    assert "一手" in out


def test_tag_no_source_hard_number_gets_pending_mark():
    text = "我们预计明年营收能到500万。"
    out = tag_confidence(text, None)
    assert "500" in out
    # 无来源的硬数字必须被标记待核/推算
    assert "待核" in out or "推算" in out


def test_tag_secondhand_number_gets_secondhand_mark():
    text = "据GGII行业媒体报道，出货量增长40%。"
    out = tag_confidence(text, ["据GGII行业媒体报道"])
    assert "40" in out
    assert "二手" in out


def test_tag_text_without_numbers_unchanged():
    text = "这是一段没有任何数字的描述性文本。"
    out = tag_confidence(text, ["财报"])
    assert out == text


def test_tag_idempotent_does_not_double_mark():
    text = "据财报营收152.8万。"
    once = tag_confidence(text, ["财报"])
    twice = tag_confidence(once, ["财报"])
    # 已带章的数字不应被重复加章
    assert twice.count("[一手") == once.count("[一手")


def test_tag_multiple_numbers_all_marked():
    text = "据财报营收152.8万，净利润23万。"
    out = tag_confidence(text, ["财报"])
    assert out.count("[一手") >= 2


def test_tag_percentage_number_marked():
    text = "据财报毛利率达32%。"
    out = tag_confidence(text, ["财报"])
    assert "32" in out and "一手" in out


# ── 日期锚不应被当成业务数字打章（反误报）─────────────────────────────────
def test_tag_year_anchor_not_marked():
    text = "据公司2025年财报，营收152.8万元。"
    out = tag_confidence(text, ["公司2025年财报"])
    # 业务数字打章
    assert "152.8万元[一手" in out
    # 年份不应被切碎或打章
    assert "2025年" in out
    assert "202[" not in out


def test_tag_full_date_not_marked():
    text = "2025年3月15日发布，营收500万。"
    out = tag_confidence(text, ["财报"])
    assert "2025年" in out and "3月" in out and "15日" in out
    assert "500万[一手" in out
    # 日期数字没有章
    assert "3月[" not in out and "15日[" not in out
