"""Deterministic Hubu cash-flow runway memorial preview.

This module turns a finance evidence pack (cash/bank balances, monthly cash
flows, receivables/payables aging, upcoming inflows/outflows) into a
boss-reviewable cash-runway memorial: how many months of cash are left, where
money is stuck, what is owed, a next-month cash forecast, and a one-line verdict.

It is preview-only: it never moves money, books payments, signs anything, or
treats unverified data as verified amounts.

Contract aligned with hubu_travel_budget_memorial.py (frozen dataclasses,
English snake_case, shared source-merge/coverage, English verdict enum,
preview_only / side_effects / human_review_required / next_actions).
All arithmetic is deterministic (zero LLM token).

Self-audit fixes (see 现金跑道-自审待办-REVIEW.md):
- C1: payables were a dead field -> now surfaced in money_stuck + overdue risk
      + net quick position. (note: AgedItem.days_outstanding is AGE, not days
      until due; so payables drive the "what I owe" view, NOT the next-month
      forecast, which still uses dated upcoming_outflows.)
- C2: under rough precision, verdict is judged on the runway LOWER bound, not
      the midpoint, to avoid optimistic bias.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable, Optional, Sequence

SOURCE_LABEL_PRIORITY = {
    "internal_uploaded_file": 4,
    "manual_confirmed": 3,
    "historical_archive": 2,
    "web_research": 1,
    "unknown": 0,
}

SAFE_FLOOR_MONTHS = 3.0
WATCH_MONTHS = 12.0
COVERAGE_HUMAN_REVIEW = 60.0
PAYABLE_OVERDUE_DAYS = 60   # 应付拖欠阈值(影响供应商信用/断供)


# ──────────────────────────── Inputs (A-class private data) ────────────────────────────
@dataclass(frozen=True)
class SourcedAmount:
    amount: float
    source_label: str = "unknown"
    source_ref: str = ""


@dataclass(frozen=True)
class AgedItem:
    """Receivable/payable with AGING (days_outstanding = how long outstanding)."""

    id: str
    amount: float
    days_outstanding: int
    source_label: str = "unknown"
    counterparty: str = ""


@dataclass(frozen=True)
class DueItem:
    """Money expected to come in / go out, with days UNTIL due."""

    id: str
    amount: float
    due_in_days: int
    source_label: str = "unknown"


@dataclass(frozen=True)
class MonthlyFlow:
    """One historical month of operating cash flow.

    cash_payments already includes all cash outflows that month (payroll, tax,
    rent, etc.); do NOT double-count fixed costs on top of it.
    """

    period: str
    cash_receipts: float
    cash_payments: float


@dataclass(frozen=True)
class FinanceEvidencePack:
    task_id: str
    title: str = ""
    cash: SourcedAmount = field(default_factory=lambda: SourcedAmount(0.0, "unknown"))
    bank: SourcedAmount = field(default_factory=lambda: SourcedAmount(0.0, "unknown"))
    monthly_flows: Sequence[MonthlyFlow] = ()
    receivables: Sequence[AgedItem] = ()
    payables: Sequence[AgedItem] = ()
    inventory: Optional[SourcedAmount] = None
    upcoming_inflows: Sequence[DueItem] = ()
    upcoming_outflows: Sequence[DueItem] = ()
    monthly_payroll: Optional[SourcedAmount] = None
    monthly_tax: Optional[SourcedAmount] = None
    monthly_loan_repayment: Optional[SourcedAmount] = None
    currency: str = "CNY"
    period: str = ""


# ──────────────────────────── Output (seven-section memorial) ────────────────────────────
@dataclass(frozen=True)
class CashRunwayMemorial:
    task_id: str
    verdict: str                       # "healthy" | "watch" | "critical" | "needs_evidence"
    headline: str
    currency: str
    cash_on_hand: float
    runway_months: Optional[float]
    runway_low: Optional[float]
    runway_high: Optional[float]
    runway_precision: str              # "measured" | "rough" | "none" | "no_pressure"
    money_stuck: dict
    next_month_forecast: dict
    perspectives: list
    missing_evidence: list
    risks: list
    human_review_required: bool
    source_label: str
    source_coverage_pct: float
    preview_only: bool = True
    side_effects: str = "none"
    next_actions: list = field(default_factory=list)


# ──────────────────────────── Shared helpers ────────────────────────────
def _merge_source_labels(labels: Iterable[str]) -> str:
    worst = "internal_uploaded_file"
    worst_rank = SOURCE_LABEL_PRIORITY["internal_uploaded_file"]
    seen = False
    for label in labels:
        seen = True
        rank = SOURCE_LABEL_PRIORITY.get(label, 0)
        if rank < worst_rank:
            worst_rank = rank
            worst = label if label in SOURCE_LABEL_PRIORITY else "unknown"
    return worst if seen else "unknown"


def _coverage_pct(labels: Sequence[str]) -> float:
    if not labels:
        return 0.0
    trusted = sum(
        1 for l in labels
        if SOURCE_LABEL_PRIORITY.get(l, 0) >= SOURCE_LABEL_PRIORITY["historical_archive"]
    )
    return round(trusted / len(labels) * 100.0, 2)


def _round(x: float) -> float:
    return round(x, 2)


# ──────────────────────────── Core ────────────────────────────
def build_cashflow_runway_memorial(pack: FinanceEvidencePack) -> CashRunwayMemorial:
    cur = pack.currency
    missing: list[str] = []
    risks: list[str] = []
    labels: list[str] = []

    # ① liquid cash on hand
    cash_on_hand = _round(pack.cash.amount + pack.bank.amount)
    labels += [pack.cash.source_label, pack.bank.source_label]
    has_balance = bool(pack.cash.source_label != "unknown" or pack.bank.source_label != "unknown"
                       or pack.cash.amount or pack.bank.amount)

    # ② average monthly net cash outflow
    runway_months: Optional[float] = None
    runway_low: Optional[float] = None
    runway_high: Optional[float] = None
    precision = "none"
    avg_net_outflow: Optional[float] = None

    if pack.monthly_flows:
        nets = [mf.cash_payments - mf.cash_receipts for mf in pack.monthly_flows]
        avg_net_outflow = _round(sum(nets) / len(nets))
        precision = "measured" if len(pack.monthly_flows) >= 3 else "rough"
        labels += ["internal_uploaded_file"] * len(pack.monthly_flows)
        if len(pack.monthly_flows) < 3:
            missing.append("现金流量表月份不足（<3 月）：月均为粗估，跑道按区间给出")
    else:
        missing.append("现金流量表（验真必备）→ 利润含金量未验证")
        fixed = sum(x.amount for x in
                    (pack.monthly_payroll, pack.monthly_tax, pack.monthly_loan_repayment) if x)
        if fixed > 0:
            avg_net_outflow = _round(fixed)
            precision = "rough"
            risks.append("跑道为粗估：未含原料/水电/差旅等经营性现金支出，实际可能更短")
        else:
            missing.append("月度经营支出（工资/税/还款）：无法估算跑道")

    if avg_net_outflow is not None:
        if avg_net_outflow <= 0:
            precision = "no_pressure"
        elif cash_on_hand <= 0:
            runway_months = 0.0
        else:
            base = cash_on_hand / avg_net_outflow
            if precision == "rough":
                spread = 0.3
                runway_low = round(base * (1 - spread), 1)
                runway_high = round(base * (1 + spread), 1)
                runway_months = round(base, 1)
            else:
                runway_months = round(base, 1)

    if pack.monthly_payroll is None:
        missing.append("工资/社保表 → 人力现金支出未计入，跑道可能偏乐观")
    if pack.monthly_tax is None:
        missing.append("纳税计划 → 税务现金支出未计入")

    # ③ where money is stuck (assets) + what is owed (payables, C1 fix)
    ar_total = _round(sum(r.amount for r in pack.receivables))
    ar_overdue = [r for r in pack.receivables if r.days_outstanding >= 90]
    ar_overdue_total = _round(sum(r.amount for r in ar_overdue))
    inv_total = _round(pack.inventory.amount) if pack.inventory else 0.0
    # C1: payables now activated
    ap_total = _round(sum(p.amount for p in pack.payables))
    ap_overdue = [p for p in pack.payables if p.days_outstanding >= PAYABLE_OVERDUE_DAYS]
    ap_overdue_total = _round(sum(p.amount for p in ap_overdue))
    money_stuck = {
        "liquid_cash": cash_on_hand,
        "receivables_total": ar_total,
        "receivables_overdue_90d": ar_overdue_total,
        "inventory": inv_total,
        "payables_total": ap_total,
        "payables_overdue_60d": ap_overdue_total,
        # 净速动头寸:能动的现金 + 要收的应收 - 要还的应付(刨掉欠款后真实可调度)
        "net_quick_position": _round(cash_on_hand + ar_total - ap_total),
        "book_assets_view": _round(cash_on_hand + ar_total + inv_total),
    }
    for r in ar_overdue:
        risks.append(f"应收 {r.counterparty or r.id} {r.amount:.0f} 已逾期 {r.days_outstanding} 天，回款存疑")
    for p in ap_overdue:
        risks.append(f"应付 {p.counterparty or p.id} {p.amount:.0f} 已拖欠 {p.days_outstanding} 天，供应商信用/断供风险")
    labels += [r.source_label for r in pack.receivables]
    labels += [p.source_label for p in pack.payables]
    if pack.inventory:
        labels.append(pack.inventory.source_label)
    if not pack.receivables:
        missing.append("应收账龄表 → 无法评估回款风险")
    if not pack.payables:
        missing.append("应付账龄表 → 无法评估欠款与断供风险")

    # ④ next-month cash forecast (uses dated upcoming items, NOT aged payables)
    inflow = _round(sum(i.amount for i in pack.upcoming_inflows if i.due_in_days <= 31))
    out_items = _round(sum(o.amount for o in pack.upcoming_outflows if o.due_in_days <= 31))
    periodic = sum(x.amount for x in
                   (pack.monthly_payroll, pack.monthly_tax, pack.monthly_loan_repayment) if x)
    outflow = _round(out_items + periodic)
    net = _round(inflow - outflow)
    forecast = {
        "expected_inflow": inflow,
        "expected_outflow": outflow,
        "net": net,
        "ending_cash_estimate": _round(cash_on_hand + net),
    }
    if not pack.upcoming_inflows and not pack.upcoming_outflows:
        forecast["available"] = False
        missing.append("下月到期发票/付款计划 → 下月现金预报不可用")
    else:
        forecast["available"] = True
        if cash_on_hand + net < 0:
            risks.append(f"下月预计现金转负（估末现金 {cash_on_hand + net:.0f}），存在断流风险")
        elif net < 0:
            risks.append(f"下月现金净流出 {abs(net):.0f}，需关注")

    # ⑤ verdict — C2 fix: under rough precision, judge on the LOWER bound
    eff = runway_months
    if precision == "rough" and runway_low is not None:
        eff = runway_low
    if not has_balance and avg_net_outflow is None:
        verdict = "needs_evidence"
    elif cash_on_hand < 0:
        verdict = "critical"
    elif precision == "no_pressure":
        verdict = "healthy"
    elif avg_net_outflow is None:
        verdict = "needs_evidence"
    elif eff is not None and eff < SAFE_FLOOR_MONTHS:
        verdict = "critical"
    elif eff is not None and eff < WATCH_MONTHS:
        verdict = "watch"
    else:
        verdict = "healthy"

    # ⑥ headline
    headline = _headline(verdict, runway_months, runway_low, runway_high, precision,
                         ar_overdue_total, ap_overdue_total, net, forecast.get("available", False), cur)

    # ⑦ perspectives / source / quality / next actions
    perspectives = [
        {"role": "现金跑道", "summary": _runway_phrase(precision, runway_months, runway_low, runway_high)},
        {"role": "钱卡在哪",
         "summary": f"可动现金 {cash_on_hand:.0f}，应收 {ar_total:.0f}（逾期 {ar_overdue_total:.0f}），库存 {inv_total:.0f}"},
        {"role": "我欠多少",
         "summary": f"应付 {ap_total:.0f}（拖欠 {ap_overdue_total:.0f}），净速动头寸 {money_stuck['net_quick_position']:.0f}"},
        {"role": "下月预报",
         "summary": ("缺到期发票/付款计划，下月预报不可用" if not forecast.get("available")
                     else f"预计净{'流入' if net >= 0 else '流出'} {abs(net):.0f}，估末现金 {forecast['ending_cash_estimate']:.0f}")},
    ]
    merged_source = _merge_source_labels(labels)
    coverage = _coverage_pct(labels)
    human_review = (verdict in ("critical", "needs_evidence")
                    or merged_source in ("web_research", "unknown")
                    or coverage < COVERAGE_HUMAN_REVIEW)
    next_actions = _next_actions(verdict, ar_overdue, ap_overdue, forecast, net)

    return CashRunwayMemorial(
        task_id=pack.task_id, verdict=verdict, headline=headline, currency=cur,
        cash_on_hand=cash_on_hand, runway_months=runway_months,
        runway_low=runway_low, runway_high=runway_high, runway_precision=precision,
        money_stuck=money_stuck, next_month_forecast=forecast, perspectives=perspectives,
        missing_evidence=missing, risks=risks, human_review_required=human_review,
        source_label=merged_source, source_coverage_pct=coverage,
        preview_only=True, side_effects="none", next_actions=next_actions,
    )


# ──────────────────────────── Narrative helpers (deterministic) ────────────────────────────
def _runway_phrase(precision: str, m: Optional[float], lo: Optional[float], hi: Optional[float]) -> str:
    if precision == "no_pressure":
        return "经营净现金流入，暂无烧钱跑道压力"
    if precision == "none" or m is None:
        return "缺现金流数据，无法估算跑道"
    if precision == "rough" and lo is not None:
        return f"现金约可支撑 {lo}–{hi} 个月（粗估，数据较少区间偏宽，按下界保守看待）"
    return f"现金约可支撑 {m} 个月"


_VERDICT_CN = {"healthy": "健康", "watch": "关注", "critical": "危急", "needs_evidence": "数据不足"}


def _headline(verdict, m, lo, hi, precision, ar_overdue, ap_overdue, net, forecast_ok, cur) -> str:
    parts = [f"现金{_VERDICT_CN.get(verdict, verdict)}。", _runway_phrase(precision, m, lo, hi) + "。"]
    if ar_overdue > 0:
        parts.append(f"有 {ar_overdue:.0f} {cur} 应收逾期90天以上，建议本周催收。")
    if ap_overdue > 0:
        parts.append(f"有 {ap_overdue:.0f} {cur} 应付拖欠，注意供应商关系与断供风险。")
    if forecast_ok and net < 0:
        parts.append(f"下月预计净流出 {abs(net):.0f}，留意现金安排。")
    return " ".join(parts)


def _next_actions(verdict, ar_overdue, ap_overdue, forecast, net) -> list:
    if verdict == "needs_evidence":
        return ["补齐现金流量表与现金/银行余额后重试"]
    if verdict == "critical":
        return ["立即盘点：催收逾期应收 + 压缩非必要支出 + 暂缓扩张/大额投入"]
    actions: list = []
    if ar_overdue:
        actions.append(f"本周催收逾期应收（共 {len(ar_overdue)} 笔），改善现金回流")
    if ap_overdue:
        actions.append(f"安排拖欠应付（共 {len(ap_overdue)} 笔），稳住供应商")
    if forecast.get("available") and net < 0:
        actions.append("为下月现金缺口提前安排：加快回款或调整付款节奏")
    if not actions:
        actions.append("现金健康，可按计划推进；建议补现金流量表让跑道更准")
    return actions
