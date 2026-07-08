"""销售成交飞轮 — 干净燃料回归尺子（确定性,不调 LLM）。

大神天才设计(Bezos/Hassabis):会复利的是真实成交价锚点,不是过去的 LLM run。本测试锁住:
召回命中真实成交→注入价锚(会复利)·无匹配空源 fail-closed 不编锚点·飞轮命中数可见(看得见转)。
"""

from __future__ import annotations

from src import sales_memory as sm


def test_loads_real_outcomes():
    rows = sm._load_outcomes()
    assert len(rows) > 0, "knowledge/real_sales_outcomes.jsonl 应有真实成交燃料"
    # 结构正确
    assert all("company" in r and "amount_cny" in r for r in rows)


def test_recall_hits_known_company():
    # 取库里一个真实公司名放进任务 → 应召回它的成交且 hit>0
    rows = sm._load_outcomes()
    company = rows[0]["company"]
    text, hit = sm.recall_real_deals(f"为{company}做一个储能市场方案", top_k=5)
    assert hit > 0
    assert "真实历史成交" in text
    assert "¥" in text  # 带真实金额锚点


def test_no_match_is_fail_closed_not_fabricated():
    # 无任何匹配公司 → 必须返回空(不编造锚点),这是 Bezos 空源 fail-closed 要求
    text, hit = sm.recall_real_deals("一个完全不存在的虚构客户 ZZZ_NOTACOMPANY_999", top_k=5)
    assert hit == 0
    assert text == ""


def test_flywheel_health_visible():
    # 看得见转:health 能区分"有燃料"与"空转"
    h = sm.flywheel_health()
    assert h["deals"] > 0
    assert h["status"] == "有燃料"


def test_idempotent_dedup():
    # 燃料干净:同 (company,year,amount) 不重复计数
    rows = sm._load_outcomes()
    keys = [(r["company"], r["year"], r["amount_cny"]) for r in rows]
    assert len(keys) == len(set(keys)), "成交记忆必须按 (company,year,amount) 幂等去重"


if __name__ == "__main__":
    import pytest

    raise SystemExit(pytest.main([__file__, "-q"]))
