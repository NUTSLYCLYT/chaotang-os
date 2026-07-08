"""户部真实引擎调度(adapt_hubu)——诚实行为回归。

#1(2026-07-06):把已建好的确定性现金跑道引擎接进上书房下旨会审链。
铁律:有结构化财务数据才走确定性门,free-text 无数据必须诚实退回 None(绝不编数=C6禁假PASS)。
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.real_department_engines import _extract_finance_pack, adapt_hubu  # noqa: E402


def test_freetext_finance_falls_back_none():
    """纯自由文本财务下旨(无结构化数据、非报价)→ 诚实退回 None,不凭空构造事实包。"""
    r = adapt_hubu("评估某储能项目500万投资的现金流回收周期与财务风险")
    assert r is None


def test_cashflow_pack_runs_deterministic_engine():
    """下旨携带结构化现金流事实包 → 确定性现金跑道引擎出 court_doc(带 items)。"""
    body = {
        "task_id": "t1",
        "title": "现金跑道",
        "cash": {"amount": 1200000, "source_label": "kingdee"},
        "bank": {"amount": 800000, "source_label": "kingdee"},
        "monthly_flows": [
            {"period": "2026-01", "cash_receipts": 500000, "cash_payments": 650000},
            {"period": "2026-02", "cash_receipts": 480000, "cash_payments": 600000},
        ],
    }
    doc = adapt_hubu("请评估本月现金跑道。数据:" + json.dumps(body, ensure_ascii=False))
    assert isinstance(doc, dict)
    assert doc.get("items"), "确定性引擎应产出带 items 的 court_doc"
    assert doc.get("light") in ("green", "yellow", "red", "black")


def test_extract_finance_pack_rejects_nonfinance_json():
    """{..} 里没有 cash/bank/monthly_flows 财务字段 → 不当财务包,返 None。"""
    assert _extract_finance_pack('随便一段话 {"foo": 1, "bar": 2} 结束') is None
    assert _extract_finance_pack("完全没有大括号的一段话") is None


def test_canonical_cashflow_store(tmp_path, monkeypatch):
    """#2:现金流类 free-text 下旨在公司已导入真实数据时走确定性门;无店/非现金流则退回。"""
    pack = {
        "task_id": "c",
        "title": "公司现金跑道",
        "cash": {"amount": 1200000, "source_label": "kingdee"},
        "bank": {"amount": 800000, "source_label": "kingdee"},
        "monthly_flows": [
            {"period": "2026-01", "cash_receipts": 500000, "cash_payments": 650000},
        ],
    }
    store = tmp_path / "cashflow_pack.json"
    store.write_text(json.dumps(pack, ensure_ascii=False), encoding="utf-8")

    # 无店:现金流下旨 → 诚实退回
    monkeypatch.delenv("HUBU_CASHFLOW_PACK", raising=False)
    assert adapt_hubu("评估本月现金跑道与资金缺口") is None

    # 有店:现金流下旨 → 用公司真数据走确定性门
    monkeypatch.setenv("HUBU_CASHFLOW_PACK", str(store))
    doc = adapt_hubu("评估本月现金跑道与资金缺口")
    assert isinstance(doc, dict) and doc.get("items")

    # 有店但非现金流下旨 → 不读店,退回(避免把公司现金流硬套到无关任务)
    assert adapt_hubu("帮我招个财务经理") is None


def test_payment_dispatch_runs_3si_chain():
    """B:付款审批下旨携带结构化 payment case → 会计/出纳/预算三门确定性 court_doc;
    无 case / 非付款下旨 → 诚实退回 None。"""
    fixture = (
        Path(__file__).resolve().parent / "fixtures" / "hubu_payment_fact_pack.json"
    )
    case = json.loads(fixture.read_text(encoding="utf-8"))
    doc = adapt_hubu("请审批这笔付款。case:" + json.dumps(case, ensure_ascii=False))
    assert isinstance(doc, dict)
    assert doc.get("source_label") == "LIVE_ENGINE"
    assert doc.get("items"), "三司门应产出 items"
    titles = " ".join(i.get("title", "") for i in doc["items"])
    assert "会计司" in titles and "出纳司" in titles and "预算司" in titles

    assert adapt_hubu("审批一笔付款") is None  # 付款下旨无 case → 退回
    assert adapt_hubu("帮我分析市场竞争") is None  # 非付款 → 不触发
