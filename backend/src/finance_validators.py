"""户部 · 确定性财务校验层（deterministic / NO LLM）

落地 docs/financial_swarm_design.md §三「确定性计算引擎」清单。
铁律一:**确定性包住 LLM**——加总/比率/勾稽/账龄/数字回链全走代码,
LLM 只做抽取与判断,绝不做算术,更不许编数字。

每个函数纯函数、可单测、对问题"标出来"而非静默通过。
配合 src/step_assertions.py 当硬闸用(见 P2)。

不依赖任何重型库,只用标准库 + Decimal,确保可独立运行与单测。
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation

# 勾稽绝对容差(元):报表四舍五入到元,允许 1 元误差
TIE_TOL = Decimal("1.00")
# 数字回链相对容差:容报告级四舍五入(万/亿换算)
NUM_REL_TOL = Decimal("0.02")
UNVERIFIED_SOURCE_LABELS = {
    "internal_user_input",
    "system_generated",
    "agent_inference",
    "unknown",
    "",
}
VERIFIED_SOURCE_LABELS = {
    "internal_uploaded_file",
    "manual_confirmed",
    "historical_archive",
    "web_research",
}


@dataclass
class FinCheck:
    """一个确定性校验的结果(可序列化、可喂 step_assertions)。"""

    name: str
    passed: bool
    detail: str
    severity: str = "hard_fail"  # hard_fail / warn
    gaps: list[str] = field(default_factory=list)


def _D(v) -> Decimal | None:
    try:
        return Decimal(str(v).replace(",", "").replace("元", "").strip())
    except (InvalidOperation, AttributeError, ValueError):
        return None


def _money(facts: dict, *keys: str) -> Decimal:
    total = Decimal("0")
    for key in keys:
        value = _D(facts.get(key))
        if value is not None:
            total += value
    return total


# ─── ① 会计恒等式 / 三表勾稽 (tie_out) ──────────────────────────


def accounting_identity(assets, liabilities, equity) -> FinCheck:
    """资产总计 == 负债合计 + 所有者权益合计。地基不过 → 不算(GIGO 门)。"""
    A, L, E = _D(assets), _D(liabilities), _D(equity)
    if None in (A, L, E):
        return FinCheck(
            "会计恒等式",
            False,
            f"科目缺失:资产={A} 负债={L} 权益={E}",
            gaps=["资产/负债/权益未全部提取到"],
        )
    diff = (A - (L + E)).copy_abs()
    ok = diff <= TIE_TOL
    return FinCheck(
        "会计恒等式",
        ok,
        f"资产{A:,} {'=' if ok else '≠'} 负债{L:,}+权益{E:,}"
        + ("" if ok else f"(差 {diff:,})"),
        gaps=[] if ok else [f"资产负债表不平,差额 {diff:,} 元"],
    )


def tie_out(bs: dict, pl: dict, prev_bs: dict | None = None) -> list[FinCheck]:
    """三表勾稽:① 资产=负债+权益;② 若给上期,净利润应≈未分配利润变动。"""
    checks = [
        accounting_identity(
            bs.get("资产总计"), bs.get("负债合计"), bs.get("所有者权益")
        )
    ]
    net = _D(pl.get("净利润"))
    re_now = _D(bs.get("未分配利润"))
    re_prev = _D(prev_bs.get("未分配利润")) if prev_bs else None
    if net is not None and re_now is not None and re_prev is not None:
        delta = re_now - re_prev
        diff = (delta - net).copy_abs()
        ok = diff <= TIE_TOL.max(net.copy_abs() * NUM_REL_TOL)
        checks.append(
            FinCheck(
                "利润↔未分配利润勾稽",
                ok,
                f"未分配利润变动 {delta:,} vs 净利润 {net:,}"
                + ("" if ok else f"(差 {diff:,},可能有分红/调整)"),
                severity="warn",
                gaps=[] if ok else ["净利→未分配利润勾稽不上,需查分红/前期调整"],
            )
        )
    return checks


# ─── ③ 比率 (ratios) ────────────────────────────────────────


def ratios(pl: dict, bs: dict) -> dict[str, Decimal | None]:
    """偿债/盈利比率。返回 None 表示数据不足,不臆造。"""
    rev, cost, net = (
        _D(pl.get("营业收入")),
        _D(pl.get("营业成本")),
        _D(pl.get("净利润")),
    )
    A, L = _D(bs.get("资产总计")), _D(bs.get("负债合计"))

    def rate(num, den):
        return (
            (num / den * 100).quantize(Decimal("0.1"))
            if (num is not None and den)
            else None
        )

    return {
        "毛利率%": (
            rate(rev - cost, rev) if (rev is not None and cost is not None) else None
        ),
        "净利率%": rate(net, rev),
        "资产负债率%": rate(L, A),
    }


# ─── sanity_guards:硬约束(算出来的数本身不合逻辑就拦) ───────────


def sanity_guards(r: dict[str, Decimal | None]) -> list[FinCheck]:
    """硬约束:净利率>毛利率=非法;资产负债率>100%=资不抵债(warn)。"""
    out: list[FinCheck] = []
    gm, nm, dr = r.get("毛利率%"), r.get("净利率%"), r.get("资产负债率%")
    if gm is not None and nm is not None and nm > gm:
        out.append(
            FinCheck(
                "净利率≤毛利率",
                False,
                f"净利率 {nm}% > 毛利率 {gm}% —— 算术非法,数据有错",
                gaps=["净利率高于毛利率,提取或计算出错"],
            )
        )
    if dr is not None and dr > 100:
        out.append(
            FinCheck(
                "资产负债率",
                False,
                f"资产负债率 {dr}% > 100% —— 资不抵债(净资产为负)",
                severity="warn",
                gaps=[f"资不抵债:资产负债率 {dr}%"],
            )
        )
    return out


# ─── liquidation:清算价(下行,非对称风险) ──────────────────────


def liquidation(bs: dict, recover: dict | None = None) -> FinCheck:
    """粗算清算价 = Σ(可变现资产×折现率) - 负债合计。无形资产破产场景近零。

    recover: 各资产可变现率,如 {'货币资金':1.0,'应收账款':0.5,'存货':0.4}。
    """
    rec = recover or {
        "货币资金": Decimal("1.0"),
        "应收账款": Decimal("0.5"),
        "存货": Decimal("0.4"),
    }
    realizable = Decimal("0")
    used = []
    for k, r in rec.items():
        v = _D(bs.get(k))
        if v is not None:
            realizable += v * r
            used.append(f"{k}×{r}")
    L = _D(bs.get("负债合计"))
    if L is None:
        return FinCheck(
            "清算价", False, "缺负债合计,无法算清算价", gaps=["负债合计缺失"]
        )
    liq = realizable - L
    return FinCheck(
        "清算价(下行锚)",
        liq >= 0,
        f"可变现≈{realizable:,}({'+'.join(used)}) - 负债{L:,} = 清算价 {liq:,}",
        severity="warn",
        gaps=[] if liq >= 0 else [f"清算价为负 {liq:,}:破产清算下债权人都未必收得回"],
    )


# ─── ④ 数字回链校验(从 ~/hubu/number_verifier 移植,LLM 输出戴嘴套) ─

_NUM = re.compile(r"(\d[\d,]*(?:\.\d+)?)\s*(亿|万元|万|元|%|％)?")


def _allowed_values(facts) -> set[Decimal]:
    out: set[Decimal] = set()

    def add(d: Decimal):
        # facts 常带负号(亏损/负债/负权益:净利-146万、权益-494万),LLM 多写正数量级("亏损146万")
        # → 同时收正负两版,否则符号一翻相对容差直接爆(494 vs -494 相对差=2.0),真数字被误判幻觉。
        for base in {d, abs(d)}:
            for v in {base, base / 10000, base / 100000000, base * 10000}:
                out.add(v)
                try:
                    out.add(v.quantize(Decimal("1")))
                    out.add(v.quantize(Decimal("0.1")))
                except InvalidOperation:
                    pass

    def walk(o):
        if isinstance(o, dict):
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)
        elif isinstance(o, bool):
            pass  # bool 是 int 子类,str(True)→Decimal 会炸,且非财务数字
        elif isinstance(o, (int, float)):
            add(Decimal(str(o)))
        elif isinstance(o, str):
            for m in re.findall(r"-?\d+(?:\.\d+)?", o.replace(",", "")):
                d = _D(m)
                if d is not None:
                    add(d)

    walk(facts)
    return out


def _matches(cand: Decimal, allowed: set[Decimal]) -> bool:
    for variant in {cand, cand * 10000, cand / 10000, cand.quantize(Decimal("1"))}:
        for a in allowed:
            if a == 0:
                if variant == 0:
                    return True
                continue
            if abs((variant - a) / a) <= NUM_REL_TOL:
                return True
    return False


def verify_numbers(text: str, facts) -> FinCheck:
    """LLM 财务输出里每个财务数字必须能回链到已验证事实,否则判幻觉、整段作废。

    不是请 LLM"别编"(道德说教无效);是结构上拿走它说谎的可能(查不到就拒)。
    """
    allowed = _allowed_values(facts)
    offenders: list[str] = []
    for raw, unit in _NUM.findall(text):
        d = _D(raw)
        if d is None:
            continue
        if unit in ("", None):
            if 1900 <= d <= 2100:  # 年份
                continue
            if d == d.to_integral_value() and d < 1000:  # 裸小整数(序号)
                continue
        cand = (
            d * 10000
            if unit in ("万", "万元")
            else d * 100000000 if unit == "亿" else d
        )
        if not _matches(cand, allowed) and not _matches(d, allowed):
            offenders.append(f"{raw}{unit or ''}")
    ok = not offenders
    return FinCheck(
        "数字回链",
        ok,
        (
            "全部数字可溯源"
            if ok
            else f"发现 {len(offenders)} 个无来源数字(疑幻觉):{offenders}"
        ),
        gaps=offenders,
    )


# ─── ⑥ 应收账龄 + 控制数闸(从 ~/hubu/ar_aging 移植) ───────────


def ar_aging(items: list[dict], control_total, ref_date) -> dict:
    """应收明细 → 控制数闸 + 账龄分桶 + 催款优先级。

    items: [{'客户','应收金额','已回款','开票日'(date|None)}]
    control_total: 审计应收账款(锚点);ref_date: 基准日(datetime.date)。
    """
    rows = []
    for it in items:
        owed = (_D(it.get("应收金额")) or Decimal("0")) - (
            _D(it.get("已回款")) or Decimal("0")
        )
        if owed <= 0:
            continue
        d = it.get("开票日")
        days = (ref_date - d).days if d else None
        rows.append(
            {
                "客户": it.get("客户", "?"),
                "欠": owed,
                "天": days,
                "单号": it.get("单号", ""),
                "备注": it.get("备注", ""),
            }
        )

    total = sum((r["欠"] for r in rows), Decimal("0"))
    ctrl = _D(control_total) or Decimal("0")
    diff = (total - ctrl).copy_abs()
    gate_ok = ctrl == 0 or (diff / ctrl) <= NUM_REL_TOL

    buckets = {
        "0-30": Decimal("0"),
        "31-90": Decimal("0"),
        "91-180": Decimal("0"),
        "180+": Decimal("0"),
        "无日期": Decimal("0"),
    }
    for r in rows:
        d = r["天"]
        k = (
            "无日期"
            if d is None
            else (
                "0-30"
                if d <= 30
                else "31-90" if d <= 90 else "91-180" if d <= 180 else "180+"
            )
        )
        buckets[k] += r["欠"]

    priority = sorted(
        rows, key=lambda r: r["欠"] * Decimal(max(r["天"] or 0, 1)), reverse=True
    )
    return {
        "control_gate": FinCheck(
            "应收控制数闸",
            gate_ok,
            f"明细未回合计 {total:,} vs 审计应收 {ctrl:,}"
            + ("" if gate_ok else f"(差 {diff:,},漏记债权!查不全=催不回的现金)"),
            gaps=[] if gate_ok else [f"应收明细不全,差 {diff:,} 元"],
        ),
        "total_unpaid": total,
        "aging": {k: v for k, v in buckets.items() if v > 0},
        "overdue_90plus": buckets["91-180"] + buckets["180+"],
        "priority": priority,
    }


# ─── ⑦ 企业投资事实包 + 确定性测算(HBI-02) ─────────────────────


def investment_source_gate(
    facts: dict, numeric_fields: list[str] | None = None
) -> FinCheck:
    """企业投资数据源闸。

    真实数据可以进蜂群,但必须带 sourceLabel。未验证来源不阻止分析草稿,
    但必须把裁决状态降为“待补证”,避免口述数字被包装成可裁决事实。
    """
    sources = facts.get("sources") or {}
    fields = numeric_fields or [
        key
        for key, value in facts.items()
        if key != "sources"
        and not isinstance(value, (dict, list, bool))
        and _D(value) is not None
    ]

    gaps: list[str] = []
    unverified: list[str] = []
    for field_name in fields:
        source = sources.get(field_name) or {}
        label = source.get("sourceLabel") if isinstance(source, dict) else str(source)
        if label in VERIFIED_SOURCE_LABELS:
            continue
        if label in UNVERIFIED_SOURCE_LABELS:
            unverified.append(f"{field_name}:{label or 'missing'}")
        else:
            gaps.append(f"{field_name}:未知sourceLabel={label}")

    ok = not gaps and not unverified
    detail = (
        "投资事实包来源均已验证"
        if ok
        else f"待补证来源 {len(gaps) + len(unverified)} 项"
    )
    return FinCheck(
        "企业投资sourceLabel闸",
        ok,
        detail,
        severity="warn",
        gaps=gaps + unverified,
    )


def investment_metrics(facts: dict) -> dict[str, Decimal | None]:
    """企业经营投资确定性测算。

    支持设备/项目投资与融资估值两类常见口径。所有输出只由输入事实计算,
    不接 LLM,不编默认值。
    """
    initial = _D(facts.get("initial_investment"))
    project_years = _D(facts.get("project_years")) or Decimal("1")
    annual_net = _D(facts.get("annual_net_cash_flow"))
    if annual_net is None:
        annual_net = _money(facts, "annual_revenue_delta", "annual_savings") - _money(
            facts,
            "annual_cost_delta",
            "annual_maintenance_cost",
            "annual_financing_cost",
            "annual_tax_cost",
        )

    cumulative = annual_net * project_years if annual_net is not None else None
    roi = None
    payback_months = None
    if initial is not None and initial > 0 and cumulative is not None:
        roi = (cumulative / initial * 100).quantize(Decimal("0.1"))
    if (
        initial is not None
        and initial > 0
        and annual_net is not None
        and annual_net > 0
    ):
        payback_months = (initial / annual_net * 12).quantize(Decimal("0.1"))

    investment_amount = _D(facts.get("investment_amount"))
    pre_money = _D(facts.get("pre_money_valuation"))
    post_money = None
    ownership = None
    if investment_amount is not None and pre_money is not None:
        post_money = pre_money + investment_amount
        if post_money > 0:
            ownership = (investment_amount / post_money * 100).quantize(Decimal("0.1"))

    return {
        "initial_investment": initial,
        "annual_net_cash_flow": annual_net,
        "project_years": project_years,
        "cumulative_net_benefit": cumulative,
        "roi_percent": roi,
        "payback_months": payback_months,
        "investment_amount": investment_amount,
        "pre_money_valuation": pre_money,
        "post_money_valuation": post_money,
        "ownership_percent": ownership,
    }


def investment_decision_gate(facts: dict) -> dict:
    """给户部投资备忘录使用的最小可裁决状态。

    返回 ready/needs_evidence/invalid 三态:
    - ready: 来源已验证且关键投资测算可复算;
    - needs_evidence: 可以生成草稿,但必须退回补证;
    - invalid: 投入或现金流口径本身不可用。
    """
    metrics = investment_metrics(facts)
    required = ["initial_investment", "annual_net_cash_flow"]
    source_gate = investment_source_gate(facts, required)
    checks = [source_gate]

    gaps: list[str] = []
    initial = metrics["initial_investment"]
    annual_net = metrics["annual_net_cash_flow"]
    if initial is None or initial <= 0:
        gaps.append("缺 initial_investment 或初始投入<=0")
    if annual_net is None:
        gaps.append("缺 annual_net_cash_flow,且无法由收入/节省/成本项推导")
    elif annual_net <= 0:
        gaps.append("年度净现金流<=0,静态回收期不可成立")

    structure_ok = not gaps
    checks.append(
        FinCheck(
            "企业投资测算结构闸",
            structure_ok,
            "投资测算可复算" if structure_ok else "投资测算不可裁决",
            gaps=gaps,
        )
    )

    if not structure_ok:
        status = "invalid"
    elif not source_gate.passed:
        status = "needs_evidence"
    else:
        status = "ready"

    return {
        "status": status,
        "metrics": metrics,
        "checks": checks,
        "required_action": {
            "ready": "可进入老板裁决,但仍需风险门判断",
            "needs_evidence": "退回补证,不得把口述数字包装成已验证事实",
            "invalid": "暂缓,先补齐投入与净现金流口径",
        }[status],
    }


# ─── ⑧ 金融资产投研事实包 + K线/组合风险闸(HBI-03) ─────────────

PROHIBITED_TRADE_ACTIONS = (
    "买入",
    "卖出",
    "加仓",
    "减仓",
    "清仓",
    "满仓",
    "梭哈",
    "抄底",
    "止盈",
    "止损",
)
ASSET_QUOTE_SOURCE_LABELS = VERIFIED_SOURCE_LABELS | {
    "market_data_provider",
    "broker_statement",
}


def tax_source_gate(facts: dict, numeric_fields: list[str] | None = None) -> FinCheck:
    """税务司数据源闸:税额/税率/税负数字必须带 sourceLabel(纳税申报表/税局指引/审计报表),
    口述税数不得包装成可裁决事实——与投资源闸同款'每数可溯源'判定,只换名。"""
    base = investment_source_gate(facts, numeric_fields)
    return FinCheck(
        "税务sourceLabel闸",
        base.passed,
        "税务事实来源均已验证" if base.passed else base.detail,
        severity="warn",
        gaps=base.gaps,
    )


def tax_burden_metrics(facts: dict) -> dict[str, Decimal | None]:
    """确定性税负测算:综合税负率 = 各税额合计 ÷ 营收。缺项返 None,不臆造。"""
    revenue = _money(facts, "revenue", "营收", "营业收入")
    vat = _money(facts, "vat", "增值税")
    income_tax = _money(facts, "income_tax", "所得税")
    surtax = _money(facts, "surtax", "附加税")
    total_tax = vat + income_tax + surtax
    has_tax = bool(vat or income_tax or surtax)
    burden = (total_tax / revenue) if (revenue and revenue != 0 and has_tax) else None
    return {
        "税额合计": total_tax if has_tax else None,
        "综合税负率": burden,
    }


def no_trade_recommendation_gate(text: str) -> FinCheck:
    """金融资产奏折边界闸:允许分析,禁止把系统输出变成交易指令。"""
    hits = [word for word in PROHIBITED_TRADE_ACTIONS if word in text]
    return FinCheck(
        "证券交易建议边界闸",
        not hits,
        "未发现直接交易指令" if not hits else f"发现交易指令词:{hits}",
        severity="hard_fail",
        gaps=hits,
    )


def price_series_gate(series: list[dict]) -> FinCheck:
    """K线 OHLCV 数据形状闸。

    第一版只校验输入是否像可信行情序列,不判断走势,不生成买卖信号。
    每根 K 线至少需要 date/open/high/low/close/sourceLabel。
    """
    gaps: list[str] = []
    if not series:
        return FinCheck(
            "K线数据形状闸", False, "缺少K线数据", gaps=["price_series_empty"]
        )

    for idx, row in enumerate(series):
        missing = [
            k
            for k in ("date", "open", "high", "low", "close", "sourceLabel")
            if row.get(k) in (None, "")
        ]
        if missing:
            gaps.append(f"row[{idx}]缺字段:{','.join(missing)}")
            continue
        o, h, l, c = (
            _D(row.get("open")),
            _D(row.get("high")),
            _D(row.get("low")),
            _D(row.get("close")),
        )
        if None in (o, h, l, c):
            gaps.append(f"row[{idx}]OHLC非数字")
            continue
        if h < max(o, c, l) or l > min(o, c, h):
            gaps.append(f"row[{idx}]OHLC不自洽")
        volume = (
            _D(row.get("volume"))
            if row.get("volume") not in (None, "")
            else Decimal("0")
        )
        if volume is not None and volume < 0:
            gaps.append(f"row[{idx}]volume<0")
        if row.get("sourceLabel") not in ASSET_QUOTE_SOURCE_LABELS:
            gaps.append(f"row[{idx}]sourceLabel未验证:{row.get('sourceLabel')}")

    return FinCheck(
        "K线数据形状闸",
        not gaps,
        (
            f"K线 {len(series)} 条可用于展示"
            if not gaps
            else f"K线数据存在 {len(gaps)} 个问题"
        ),
        severity="warn",
        gaps=gaps,
    )


def portfolio_risk_snapshot(
    positions: list[dict], quotes: dict[str, dict] | None = None
) -> dict:
    """只读持仓组合快照。

    positions: [{'symbol','assetType','quantity','costBasis','industry','sourceLabel'}]
    quotes: {'600000.SH': {'last': 10.5, 'sourceLabel': 'market_data_provider'}}

    输出用于资管投研司看板:总市值、现金外持仓占比、单票集中度、行业暴露、风险闸。
    """
    quotes = quotes or {}
    rows: list[dict] = []
    gaps: list[str] = []
    total_value = Decimal("0")
    cost_value = Decimal("0")

    for idx, pos in enumerate(positions):
        symbol = str(pos.get("symbol") or "").strip()
        qty = _D(pos.get("quantity"))
        cost = _D(pos.get("costBasis"))
        label = pos.get("sourceLabel")
        quote = quotes.get(symbol) or {}
        last = _D(quote.get("last")) if quote else _D(pos.get("lastPrice"))
        quote_label = quote.get("sourceLabel") or pos.get("quoteSourceLabel")

        if not symbol:
            gaps.append(f"position[{idx}]缺symbol")
        if qty is None or qty < 0:
            gaps.append(f"{symbol or idx}:quantity缺失或小于0")
            qty = Decimal("0")
        if cost is None or cost < 0:
            gaps.append(f"{symbol or idx}:costBasis缺失或小于0")
            cost = Decimal("0")
        if last is None or last < 0:
            gaps.append(f"{symbol or idx}:lastPrice缺失或小于0")
            last = Decimal("0")
        if label not in VERIFIED_SOURCE_LABELS and label != "broker_statement":
            gaps.append(f"{symbol or idx}:持仓sourceLabel未验证:{label}")
        if quote_label not in ASSET_QUOTE_SOURCE_LABELS:
            gaps.append(f"{symbol or idx}:行情sourceLabel未验证:{quote_label}")

        market_value = qty * last
        cost_amount = qty * cost
        total_value += market_value
        cost_value += cost_amount
        rows.append(
            {
                "symbol": symbol,
                "assetType": pos.get("assetType", "UNKNOWN"),
                "industry": pos.get("industry", "UNKNOWN"),
                "quantity": qty,
                "costBasis": cost,
                "lastPrice": last,
                "marketValue": market_value,
                "costAmount": cost_amount,
                "unrealizedPnL": market_value - cost_amount,
            }
        )

    industry_exposure: dict[str, Decimal] = {}
    for row in rows:
        industry = str(row["industry"])
        industry_exposure[industry] = (
            industry_exposure.get(industry, Decimal("0")) + row["marketValue"]
        )

    concentration = Decimal("0")
    top_symbol = ""
    for row in rows:
        weight = (
            (row["marketValue"] / total_value * 100).quantize(Decimal("0.1"))
            if total_value
            else Decimal("0")
        )
        row["weightPercent"] = weight
        if weight > concentration:
            concentration = weight
            top_symbol = row["symbol"]

    checks = [
        FinCheck(
            "持仓事实包闸",
            not gaps,
            (
                "持仓和行情来源可追溯"
                if not gaps
                else f"持仓/行情存在 {len(gaps)} 个来源或数值问题"
            ),
            severity="warn",
            gaps=gaps,
        )
    ]
    if concentration > 35:
        checks.append(
            FinCheck(
                "单一资产集中度",
                False,
                f"{top_symbol} 占组合 {concentration}%,超过35%预警线",
                severity="warn",
                gaps=[f"单一资产集中度过高:{top_symbol} {concentration}%"],
            )
        )
    else:
        checks.append(
            FinCheck("单一资产集中度", True, f"最高单一资产占比 {concentration}%")
        )

    return {
        "total_market_value": total_value,
        "total_cost": cost_value,
        "unrealized_pnl": total_value - cost_value,
        "positions": rows,
        "industry_exposure": industry_exposure,
        "top_concentration_percent": concentration,
        "checks": checks,
        "status": "ready" if all(c.passed for c in checks) else "needs_review",
    }


def valuation_source_gate(
    facts: dict, required_fields: list[str] | None = None
) -> FinCheck:
    """价值投资指标来源闸。

    PE/PB/PS/ROE/现金流等都可以展示,但不能无来源进入投资奏折。
    """
    required = required_fields or [
        "revenue_growth",
        "net_income_growth",
        "roe",
        "debt_to_assets",
        "pe",
        "pb",
        "operating_cash_flow",
    ]
    return investment_source_gate(facts, required)
