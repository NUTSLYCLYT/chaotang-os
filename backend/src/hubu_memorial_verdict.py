"""src/hubu_memorial_verdict.py — 户部奏报引擎(收编现金流模块 + 全院装配器)。

收编 src/hubu_cashflow_runway_memorial.py(确定性现金流跑道计算)→ 接成全院 court_doc(memorial,
算盘印)。户部与工部同属"确定性接地":数字按住来源,跑道靠重算;needs_evidence → 禁假 PASS 降级。

薄包装:计算在 hubu_cashflow_runway_memorial,装配在 court_doc_builder,本模块只做 verdict→灯 映射。
"""
from __future__ import annotations

from typing import Any

from src import court_doc_builder as cdb
from src.hubu_cashflow_runway_memorial import (
    AgedItem,
    CashRunwayMemorial,
    DueItem,
    FinanceEvidencePack,
    MonthlyFlow,
    SourcedAmount,
    build_cashflow_runway_memorial,
)

# docs/dept_design/hubu.md §三:财务分支判官(ben-graham/deming)+顾问(drucker/
# taleb-perspective/dalio-perspective/howard-marks-perspective/duan-yongping)。
# 此前 cashflow_to_court_doc 没传,provenance.advisors 一直是空的。deterministic_gated
# 已经独立保证禁假 PASS,这里补的是透明度(设计上该谁看),不是修门禁本身。
_FINANCE_ADVISORS = [
    "ben-graham", "deming", "drucker", "taleb-perspective",
    "dalio-perspective", "howard-marks-perspective", "duan-yongping",
]

# 户部奏报口吻
_MEMORIAL_HEADLINE = {
    "green": "现金安全 —— 跑道充足",
    "yellow": "需盯 —— 跑道偏紧 {n} 处",
    "red": "告急 —— 现金跑道不足",
    "black": "高危 —— 资金链断裂风险",
}

# 现金流 verdict → court_doc 灯;needs_evidence 不映射灯(走禁假 PASS 降级)
_VERDICT_LIGHT = {"healthy": "green", "watch": "yellow", "critical": "red"}


def _memorial_to_items(m: CashRunwayMemorial) -> list[dict]:
    items: list[dict] = []
    if m.verdict == "needs_evidence":
        items.append({"level": "red", "title": "现金证据不足(needs_evidence)",
                      "fix": "补银行流水/账期数据再核", "evidence_ref": "hubu_cashflow"})
        return items
    runway = m.runway_low if m.runway_low is not None else m.runway_months
    level = _VERDICT_LIGHT.get(m.verdict, "yellow")
    items.append({
        "level": level,
        "title": f"现金跑道 {runway} 个月({m.runway_precision})· 在手 {m.cash_on_hand}{m.currency}",
        "impact": f"跑道 {m.runway_low}–{m.runway_high} 月" if m.runway_low is not None else None,
        "evidence_ref": "hubu_cashflow",
    })
    for r in (m.risks or [])[:3]:
        items.append({"level": "yellow", "title": str(r), "evidence_ref": "hubu_cashflow"})
    return items


def cashflow_to_court_doc(memorial: CashRunwayMemorial, *, archive: bool = True) -> dict:
    """现金流跑道 verdict → 户部奏报 court_doc(确定性接地;needs_evidence→禁假 PASS)。

    注:与既有 src/hubu_memorial.build_hubu_memorial(会计/预算/出纳门)是不同能力,此处专做现金跑道。
    """
    grounded = memorial.verdict != "needs_evidence"
    return cdb.build_court_doc(
        "hubu",
        items=_memorial_to_items(memorial),
        question=memorial.headline,
        shielded=f"为你算清:现金跑道 {memorial.runway_low}–{memorial.runway_high} 月",
        advisors=_FINANCE_ADVISORS,
        deterministic_gated=grounded,
        archive=archive,
        headline_map=_MEMORIAL_HEADLINE,
        pending_note="需补现金证据",
        source_label="MIXED",
    )


def run_cashflow_court_doc(pack: FinanceEvidencePack, *, archive: bool = True) -> dict:
    """端到端:跑现金流确定性计算 → 装配户部奏报 court_doc。"""
    return cashflow_to_court_doc(build_cashflow_runway_memorial(pack), archive=archive)


# ── JSON body → FinanceEvidencePack(修顶尖高手会审那次挖出的洞:这个引擎以前零真实入口)──
def _amount(raw: dict | None) -> SourcedAmount | None:
    if not raw:
        return None
    return SourcedAmount(amount=float(raw["amount"]), source_label=str(raw.get("source_label", "unknown")),
                         source_ref=str(raw.get("source_ref", "")))


def pack_from_body(body: dict[str, Any]) -> FinanceEvidencePack:
    """预览端点收到的 JSON → FinanceEvidencePack(强类型,字段缺失/类型错直接抛,不静默吞)。"""
    cash = _amount(body.get("cash")) or SourcedAmount(0.0, "unknown")
    bank = _amount(body.get("bank")) or SourcedAmount(0.0, "unknown")
    monthly_flows = [
        MonthlyFlow(period=str(f["period"]), cash_receipts=float(f["cash_receipts"]),
                    cash_payments=float(f["cash_payments"]))
        for f in (body.get("monthly_flows") or [])
    ]
    receivables = [
        AgedItem(id=str(a["id"]), amount=float(a["amount"]), days_outstanding=int(a["days_outstanding"]),
                 source_label=str(a.get("source_label", "unknown")), counterparty=str(a.get("counterparty", "")))
        for a in (body.get("receivables") or [])
    ]
    payables = [
        AgedItem(id=str(a["id"]), amount=float(a["amount"]), days_outstanding=int(a["days_outstanding"]),
                 source_label=str(a.get("source_label", "unknown")), counterparty=str(a.get("counterparty", "")))
        for a in (body.get("payables") or [])
    ]
    upcoming_inflows = [
        DueItem(id=str(d["id"]), amount=float(d["amount"]), due_in_days=int(d["due_in_days"]),
                source_label=str(d.get("source_label", "unknown")))
        for d in (body.get("upcoming_inflows") or [])
    ]
    upcoming_outflows = [
        DueItem(id=str(d["id"]), amount=float(d["amount"]), due_in_days=int(d["due_in_days"]),
                source_label=str(d.get("source_label", "unknown")))
        for d in (body.get("upcoming_outflows") or [])
    ]
    return FinanceEvidencePack(
        task_id=str(body.get("task_id", "")), title=str(body.get("title", "")),
        cash=cash, bank=bank, monthly_flows=monthly_flows,
        receivables=receivables, payables=payables,
        inventory=_amount(body.get("inventory")),
        upcoming_inflows=upcoming_inflows, upcoming_outflows=upcoming_outflows,
        monthly_payroll=_amount(body.get("monthly_payroll")),
        monthly_tax=_amount(body.get("monthly_tax")),
        monthly_loan_repayment=_amount(body.get("monthly_loan_repayment")),
        currency=str(body.get("currency", "CNY")), period=str(body.get("period", "")),
    )


def preview_cashflow_court_doc(body: dict[str, Any]) -> dict:
    """预览端点入口:body(JSON) → 现金跑道 court_doc,不落库不归档(archive=False)。"""
    return run_cashflow_court_doc(pack_from_body(body), archive=False)
