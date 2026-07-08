"""户部确定性校验层 · golden 测试

固化两类回归:
  1) 数字回链:"9500万幻觉"必须被抓;合法引用/年份/序号不能误伤。
  2) 会计恒等式:拿本司真审计报表验证解析器+恒等式门全绿。

跑:pytest tests/test_finance_validators.py -v
真财报缺失时,涉及真数据的用例自动跳过(CI 友好)。
"""

from __future__ import annotations

import os
from datetime import date
from decimal import Decimal

import pytest

from src.finance_validators import (
    accounting_identity,
    ar_aging,
    investment_decision_gate,
    investment_metrics,
    investment_source_gate,
    no_trade_recommendation_gate,
    portfolio_risk_snapshot,
    price_series_gate,
    ratios,
    sanity_guards,
    valuation_source_gate,
    verify_numbers,
)

# 已验证事实(取自真审计报表,经恒等式自验):本司真实量级
FACTS = {
    "2025": {
        "营业收入": 1528329.54,
        "营业成本": 948133.87,
        "净利润": -1536500.30,
        "货币资金": 308283.17,
        "应收账款": 1375440.50,
        "毛利率": 38.0,
        "资产负债率": 173.3,
    },
}

REAL_DIR = "/mnt/c/Users/Administrator/Desktop/天正专利评估 6.3/近三年审计报告和财务报表"
REAL_2025 = os.path.join(REAL_DIR, "本司202512财务报表.xls")


# ─── 数字回链 ────────────────────────────────────────────────


def test_legit_numbers_pass():
    txt = "2025年营业收入1,528,329.54元(约152.8万),毛利率38.0%,净亏153.7万元。"
    assert verify_numbers(txt, FACTS).passed


def test_hallucinated_9500w_rejected():
    r = verify_numbers("公司营业收入9500万元,营销费用增速42.9%。", FACTS)
    assert not r.passed
    assert any("9500" in g for g in r.gaps)


def test_year_and_ordinal_ignored():
    r = verify_numbers("2025年存在3个主要风险;营业收入1528329.54元。", FACTS)
    assert r.passed, f"年份/序号被误伤: {r.gaps}"


def test_made_up_ratio_rejected():
    assert not verify_numbers("公司净利率高达25%,经营良好。", FACTS).passed


# ─── 会计恒等式 / sanity ─────────────────────────────────────


def test_accounting_identity_balanced():
    # 2025 真值:资产6738682.82 = 负债11680479.99 + 权益-4941797.17
    assert accounting_identity(6738682.82, 11680479.99, -4941797.17).passed


def test_accounting_identity_unbalanced_caught():
    assert not accounting_identity(6738682.82, 11680479.99, -3000000).passed


def test_sanity_net_gt_gross_illegal():
    # 净利率 > 毛利率 = 非法
    checks = sanity_guards({"毛利率%": 38.0, "净利率%": 50.0, "资产负债率%": 173.3})
    assert any(not c.passed and "净利率" in c.name for c in checks)


def test_sanity_insolvent_warns():
    checks = sanity_guards({"毛利率%": 38.0, "净利率%": -100.5, "资产负债率%": 173.3})
    assert any("资产负债率" in c.name for c in checks)


# ─── 应收账龄控制数闸 ────────────────────────────────────────


def test_ar_gate_fails_when_incomplete():
    # 明细只录 10 万,但审计应收 137.5 万 → 闸必须拒(漏记债权)
    items = [{"客户": "甲", "应收金额": 100000, "已回款": 0, "开票日": date(2025, 1, 1)}]
    res = ar_aging(items, control_total=1375440.50, ref_date=date(2026, 6, 4))
    assert not res["control_gate"].passed


def test_ar_gate_passes_and_ages():
    items = [
        {"客户": "甲", "应收金额": 1000000, "已回款": 0, "开票日": date(2025, 1, 1)},
        {"客户": "乙", "应收金额": 375440.50, "已回款": 0, "开票日": date(2026, 5, 1)},
    ]
    res = ar_aging(items, control_total=1375440.50, ref_date=date(2026, 6, 4))
    assert res["control_gate"].passed
    assert res["overdue_90plus"] > 0  # 甲 2025-01 已逾期
    assert res["priority"][0]["客户"] == "甲"  # 金额×账龄最大


# ─── 企业投资事实包 / sourceLabel / 确定性测算 ────────────────


def test_enterprise_investment_metrics_from_verified_fact_pack():
    facts = {
        "initial_investment": 1200000,
        "annual_revenue_delta": 900000,
        "annual_cost_delta": 520000,
        "annual_savings": 80000,
        "project_years": 3,
        "sources": {
            "initial_investment": {"sourceLabel": "internal_uploaded_file", "ref": "equipment_quote.pdf"},
            "annual_net_cash_flow": {"sourceLabel": "manual_confirmed", "ref": "boss_review_20260621"},
        },
    }

    metrics = investment_metrics(facts)

    assert metrics["annual_net_cash_flow"] == 460000
    assert metrics["cumulative_net_benefit"] == 1380000
    assert metrics["roi_percent"] == 115
    assert metrics["payback_months"] == Decimal("31.3")

    gate = investment_decision_gate(facts)
    assert gate["status"] == "ready"
    assert all(check.passed for check in gate["checks"])


def test_enterprise_investment_user_input_requires_evidence_before_decision():
    facts = {
        "initial_investment": 800000,
        "annual_net_cash_flow": 260000,
        "sources": {
            "initial_investment": {"sourceLabel": "internal_user_input"},
            "annual_net_cash_flow": {"sourceLabel": "unknown"},
        },
    }

    source_gate = investment_source_gate(facts, ["initial_investment", "annual_net_cash_flow"])
    decision = investment_decision_gate(facts)

    assert not source_gate.passed
    assert decision["status"] == "needs_evidence"
    assert "退回补证" in decision["required_action"]


def test_enterprise_investment_negative_cashflow_is_invalid():
    decision = investment_decision_gate(
        {
            "initial_investment": 500000,
            "annual_revenue_delta": 100000,
            "annual_cost_delta": 180000,
            "sources": {
                "initial_investment": {"sourceLabel": "manual_confirmed"},
                "annual_net_cash_flow": {"sourceLabel": "manual_confirmed"},
            },
        }
    )

    assert decision["status"] == "invalid"
    assert decision["metrics"]["payback_months"] is None
    assert any("年度净现金流<=0" in gap for check in decision["checks"] for gap in check.gaps)


def test_enterprise_investment_financing_valuation_metrics():
    metrics = investment_metrics({"investment_amount": 2000000, "pre_money_valuation": 8000000})

    assert metrics["post_money_valuation"] == 10000000
    assert metrics["ownership_percent"] == 20


# ─── 金融资产投研事实包 / K线 / 组合风险 ───────────────────────


def test_price_series_gate_accepts_verified_ohlcv_for_chart_display():
    series = [
        {
            "date": "2026-06-19",
            "open": 10,
            "high": 10.8,
            "low": 9.9,
            "close": 10.5,
            "volume": 1200000,
            "sourceLabel": "market_data_provider",
        },
        {
            "date": "2026-06-22",
            "open": 10.5,
            "high": 11.1,
            "low": 10.3,
            "close": 10.9,
            "volume": 1400000,
            "sourceLabel": "market_data_provider",
        },
    ]

    assert price_series_gate(series).passed


def test_price_series_gate_rejects_bad_ohlc_or_unverified_source():
    gate = price_series_gate(
        [
            {
                "date": "2026-06-22",
                "open": 10,
                "high": 9.8,
                "low": 10.1,
                "close": 10.5,
                "volume": -1,
                "sourceLabel": "unknown",
            }
        ]
    )

    assert not gate.passed
    assert any("OHLC" in gap for gap in gate.gaps)
    assert any("sourceLabel" in gap for gap in gate.gaps)


def test_portfolio_risk_snapshot_flags_single_asset_concentration():
    snapshot = portfolio_risk_snapshot(
        [
            {
                "symbol": "MSFT",
                "assetType": "STOCK",
                "quantity": 100,
                "costBasis": 300,
                "industry": "software",
                "sourceLabel": "broker_statement",
            },
            {
                "symbol": "CASH",
                "assetType": "CASH",
                "quantity": 1,
                "costBasis": 5000,
                "lastPrice": 5000,
                "industry": "cash",
                "sourceLabel": "manual_confirmed",
                "quoteSourceLabel": "manual_confirmed",
            },
        ],
        {"MSFT": {"last": 420, "sourceLabel": "market_data_provider"}},
    )

    assert snapshot["total_market_value"] == 47000
    assert snapshot["unrealized_pnl"] == 12000
    assert snapshot["status"] == "needs_review"
    assert any(check.name == "单一资产集中度" and not check.passed for check in snapshot["checks"])


def test_valuation_source_gate_blocks_unsourced_value_investing_metrics():
    gate = valuation_source_gate(
        {
            "revenue_growth": 20,
            "net_income_growth": 15,
            "roe": 12,
            "debt_to_assets": 40,
            "pe": 18,
            "pb": 2.1,
            "operating_cash_flow": 1000000,
            "sources": {"pe": {"sourceLabel": "unknown"}},
        }
    )

    assert not gate.passed
    assert any("revenue_growth" in gap for gap in gate.gaps)
    assert any("pe:unknown" in gap for gap in gate.gaps)


def test_no_trade_recommendation_gate_blocks_direct_order_words():
    ok = no_trade_recommendation_gate("当前进入观察名单,需要补齐估值和现金流证据。")
    bad = no_trade_recommendation_gate("建议明天开盘买入并加仓。")

    assert ok.passed
    assert not bad.passed
    assert "买入" in bad.gaps
    assert "加仓" in bad.gaps


# ─── 真财报:解析器 + 恒等式(真数据缺失则跳过) ─────────────────


@pytest.mark.skipif(not os.path.exists(REAL_2025), reason="真审计报表不在本机")
def test_parse_real_statements_and_tie_out():
    from src.finance_data_parser import parse_statements

    ps = parse_statements(REAL_2025, "2025")
    d = ps.plain()
    # 关键科目都抽到了
    for k in ("资产总计", "负债合计", "所有者权益", "营业收入", "货币资金", "应收账款"):
        assert d.get(k) is not None, f"未抽到 {k};warnings={ps.warnings}"
    # 恒等式过
    assert accounting_identity(d["资产总计"], d["负债合计"], d["所有者权益"]).passed
    # 解析值与已知真值一致(货币资金 30.8万、应收 137.5万)
    assert abs(d["货币资金"] - 308283.17) < 1
    assert abs(d["应收账款"] - 1375440.50) < 1


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
