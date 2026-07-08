"""户部财务报表与审计异常预览 contract。

本模块只做确定性预览: 三表草稿 -> 审计异常 -> 老板摘要 -> 融资/贷款材料草稿。
它不写数据库、不提交申报、不连接银行/税务/外部系统。
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from hashlib import sha1
from typing import Any


REQUIRED_TOP_LEVEL_KEYS = ("caseId", "title", "period", "trialBalance", "cashFlow", "sources")
VERIFIED_SOURCE_LABELS = {"internal_uploaded_file", "manual_confirmed", "historical_archive", "web_research"}
REQUIRED_SOURCE_PATHS = (
    "trialBalance.revenue",
    "trialBalance.costOfRevenue",
    "trialBalance.cash",
    "trialBalance.bank",
    "trialBalance.accountsReceivable",
    "trialBalance.accountsPayable",
    "trialBalance.shortTermDebt",
)

REPORTING_BUTTON_LABELS = {
    "archive_preview": "存入史馆草稿",
    "return_for_audit_review": "交审计复核",
    "return_for_evidence": "退回补证",
    "prepare_financing_materials": "交融资准备",
    "save_draft": "保存草稿",
}

REPORTING_REQUIRED_FACT_PACK_SECTIONS = [
    "trialBalance: 收入、成本、费用、现金、银行、应收、存货、固定资产、应付、借款、资本、期初留存收益",
    "cashFlow: 期初现金、现金收入、现金支出、资本开支、借款流入、还款流出",
    "sources: 关键科目的来源标签和凭证引用",
    "auditInputs: 发票、付款、合同、预算行，用于审计异常检查",
]

REPORTING_JINYIWEI_CHECKLIST = [
    "采集试算平衡表或总账导出，至少覆盖 revenue/costOfRevenue/cash/bank/accountsReceivable/accountsPayable/shortTermDebt",
    "采集银行流水或现金流汇总，覆盖 beginningCash/cashReceipts/cashPayments/capex/debtProceeds/debtRepayments",
    "采集关键科目的来源标签与凭证引用，缺 sourceLabel 的科目不得按已核实事实展示",
    "采集发票、付款、合同、预算行，用于重复付款、合同/发票关联和预算打穿检查",
    "标注期间、币种、经办人、附件名或 URL；无法核验的内容只允许进入补证清单",
]


def _decimal(value: Any) -> Decimal:
    try:
        return Decimal(str(value).replace(",", "").replace("元", "").strip())
    except (InvalidOperation, AttributeError, ValueError):
        return Decimal("0")


def _money(value: Any) -> str:
    return str(_decimal(value).quantize(Decimal("0.01")))


def _pct(numerator: Decimal, denominator: Decimal) -> str | None:
    if denominator == 0:
        return None
    return str((numerator / denominator).quantize(Decimal("0.0001")))


def _require_case_shape(case: dict) -> None:
    missing = [key for key in REQUIRED_TOP_LEVEL_KEYS if key not in case]
    if missing:
        raise ValueError(f"财务报表预览事实包缺少字段: {', '.join(missing)}")
    for section in ("trialBalance", "cashFlow", "sources"):
        if not isinstance(case.get(section), dict):
            raise ValueError(f"财务报表预览事实包字段必须是 object: {section}")


def _source_meta(case: dict, path: str) -> dict:
    source = (case.get("sources") or {}).get(path)
    return source if isinstance(source, dict) else {}


def _source_label(case: dict, path: str) -> str:
    return str(_source_meta(case, path).get("sourceLabel") or "unknown")


def _source_label_summary(case: dict) -> dict:
    labels: dict[str, int] = {}
    for source in (case.get("sources") or {}).values():
        if not isinstance(source, dict):
            continue
        label = str(source.get("sourceLabel") or "unknown")
        labels[label] = labels.get(label, 0) + 1
    return labels


def _income_statement(tb: dict) -> dict:
    revenue = _decimal(tb.get("revenue"))
    cost = _decimal(tb.get("costOfRevenue"))
    sales_expense = _decimal(tb.get("salesExpense"))
    admin_expense = _decimal(tb.get("adminExpense"))
    rd_expense = _decimal(tb.get("rdExpense"))
    interest = _decimal(tb.get("interestExpense"))
    tax = _decimal(tb.get("taxExpense"))
    gross_profit = revenue - cost
    operating_expense = sales_expense + admin_expense + rd_expense
    operating_income = gross_profit - operating_expense
    income_before_tax = operating_income - interest
    net_income = income_before_tax - tax
    return {
        "revenue": _money(revenue),
        "costOfRevenue": _money(cost),
        "grossProfit": _money(gross_profit),
        "operatingExpense": _money(operating_expense),
        "operatingIncome": _money(operating_income),
        "interestExpense": _money(interest),
        "incomeBeforeTax": _money(income_before_tax),
        "taxExpense": _money(tax),
        "netIncome": _money(net_income),
        "grossMarginPct": _pct(gross_profit, revenue),
        "netMarginPct": _pct(net_income, revenue),
    }


def _balance_sheet(tb: dict, net_income: Decimal) -> dict:
    cash = _decimal(tb.get("cash"))
    bank = _decimal(tb.get("bank"))
    ar = _decimal(tb.get("accountsReceivable"))
    inventory = _decimal(tb.get("inventory"))
    fixed_assets = _decimal(tb.get("fixedAssets"))
    ap = _decimal(tb.get("accountsPayable"))
    short_debt = _decimal(tb.get("shortTermDebt"))
    long_debt = _decimal(tb.get("longTermDebt"))
    capital = _decimal(tb.get("paidInCapital"))
    retained_opening = _decimal(tb.get("retainedEarningsOpening"))

    current_assets = cash + bank + ar + inventory
    non_current_assets = fixed_assets
    total_assets = current_assets + non_current_assets
    current_liabilities = ap + short_debt
    non_current_liabilities = long_debt
    total_liabilities = current_liabilities + non_current_liabilities
    equity = capital + retained_opening + net_income
    balance_delta = total_assets - total_liabilities - equity
    return {
        "currentAssets": _money(current_assets),
        "nonCurrentAssets": _money(non_current_assets),
        "totalAssets": _money(total_assets),
        "currentLiabilities": _money(current_liabilities),
        "nonCurrentLiabilities": _money(non_current_liabilities),
        "totalLiabilities": _money(total_liabilities),
        "equity": _money(equity),
        "balanceCheckDelta": _money(balance_delta),
        "currentRatio": _pct(current_assets, current_liabilities),
        "debtToAssetRatio": _pct(total_liabilities, total_assets),
    }


def _cash_flow_statement(cash_flow: dict) -> dict:
    beginning = _decimal(cash_flow.get("beginningCash"))
    receipts = _decimal(cash_flow.get("cashReceipts"))
    payments = _decimal(cash_flow.get("cashPayments"))
    capex = _decimal(cash_flow.get("capex"))
    debt_proceeds = _decimal(cash_flow.get("debtProceeds"))
    debt_repayments = _decimal(cash_flow.get("debtRepayments"))
    operating = receipts - payments
    investing = -capex
    financing = debt_proceeds - debt_repayments
    ending = beginning + operating + investing + financing
    return {
        "beginningCash": _money(beginning),
        "operatingCashFlow": _money(operating),
        "investingCashFlow": _money(investing),
        "financingCashFlow": _money(financing),
        "endingCash": _money(ending),
    }


def _finding(finding_id: str, severity: str, title: str, detail: str, action: str, paths: list[str] | None = None) -> dict:
    return {
        "id": finding_id,
        "severity": severity,
        "title": title,
        "detail": detail,
        "requiredAction": action,
        "paths": paths or [],
    }


def _audit_source_labels(case: dict) -> list[dict]:
    findings: list[dict] = []
    gaps: list[str] = []
    for path in REQUIRED_SOURCE_PATHS:
        label = _source_label(case, path)
        if label not in VERIFIED_SOURCE_LABELS:
            gaps.append(f"{path}:sourceLabel={label}")
    if gaps:
        findings.append(
            _finding(
                "source_label_gap",
                "high",
                "核心财务数字来源不足",
                f"发现 {len(gaps)} 个核心数字缺少可信 sourceLabel。",
                "return_for_evidence",
                gaps,
            )
        )
    return findings


def _audit_balance_sheet(balance_sheet: dict) -> list[dict]:
    delta = _decimal(balance_sheet.get("balanceCheckDelta"))
    if abs(delta) <= Decimal("1.00"):
        return []
    return [
        _finding(
            "balance_sheet_not_balanced",
            "critical",
            "资产负债表不平",
            f"资产 - 负债 - 权益差额为 {delta}。",
            "return_for_correction",
            ["balanceSheet.balanceCheckDelta"],
        )
    ]


def _audit_margin(case: dict, income_statement: dict) -> list[dict]:
    prior = ((case.get("comparatives") or {}).get("priorPeriod") or {})
    prior_revenue = _decimal(prior.get("revenue"))
    prior_net_income = _decimal(prior.get("netIncome"))
    current_margin = _decimal(income_statement.get("netMarginPct"))
    prior_margin = (prior_net_income / prior_revenue) if prior_revenue else None
    if prior_margin is None:
        return []
    drop = prior_margin - current_margin
    if drop <= Decimal("0.0500"):
        return []
    return [
        _finding(
            "margin_drop",
            "medium",
            "净利率明显下滑",
            f"本期净利率 {current_margin}, 上期净利率 {prior_margin.quantize(Decimal('0.0001'))}。",
            "return_for_council_review",
            ["incomeStatement.netMarginPct", "comparatives.priorPeriod.netIncome"],
        )
    ]


def _audit_payment_controls(case: dict) -> list[dict]:
    audit = case.get("auditInputs") or {}
    payments = audit.get("payments") or []
    budget_lines = audit.get("budgetLines") or []
    findings: list[dict] = []
    seen: set[tuple[str, str, str]] = set()
    for payment in payments:
        invoice_id = str(payment.get("invoiceId") or "")
        contract_id = str(payment.get("contractId") or "")
        amount = _money(payment.get("amount"))
        if not invoice_id or not contract_id:
            findings.append(
                _finding(
                    "payment_missing_invoice_or_contract",
                    "high",
                    "付款缺少发票或合同关联",
                    f"付款 {payment.get('id') or '-'} 缺少 invoiceId/contractId。",
                    "return_for_evidence",
                    [f"auditInputs.payments.{payment.get('id') or 'unknown'}"],
                )
            )
        key = (invoice_id, contract_id, amount)
        if key in seen:
            findings.append(
                _finding(
                    "duplicate_payment_risk",
                    "high",
                    "疑似重复付款",
                    f"同一合同/发票/金额出现重复付款: contract={contract_id}, invoice={invoice_id}, amount={amount}。",
                    "return_for_correction",
                    ["auditInputs.payments"],
                )
            )
        seen.add(key)

    total_payments = sum((_decimal(item.get("amount")) for item in payments), Decimal("0"))
    for line in budget_lines:
        amount = _decimal(line.get("amount"))
        used = _decimal(line.get("used"))
        if amount > 0 and used + total_payments > amount:
            findings.append(
                _finding(
                    "budget_overrun_risk",
                    "high",
                    "预算可能被本轮付款打穿",
                    f"预算 {line.get('id') or '-'} 额度 {amount}, 已用 {used}, 本轮付款 {total_payments}。",
                    "confirm_with_risk_gate",
                    [f"auditInputs.budgetLines.{line.get('id') or 'unknown'}"],
                )
            )
    return findings


def _audit_debt_and_cash(balance_sheet: dict, cash_flow: dict) -> list[dict]:
    ending_cash = _decimal(cash_flow.get("endingCash"))
    current_liabilities = _decimal(balance_sheet.get("currentLiabilities"))
    if current_liabilities <= 0:
        return []
    if ending_cash / current_liabilities >= Decimal("0.20"):
        return []
    return [
        _finding(
            "cash_liquidity_watch",
            "medium",
            "短期偿付压力需关注",
            f"期末现金 {ending_cash}, 流动负债 {current_liabilities}。",
            "return_for_council_review",
            ["cashFlow.endingCash", "balanceSheet.currentLiabilities"],
        )
    ]


def _risk_level(findings: list[dict]) -> str:
    severities = {item["severity"] for item in findings}
    if "critical" in severities:
        return "blocked"
    if "high" in severities:
        return "high"
    if "medium" in severities:
        return "medium"
    return "low"


def _boss_brief(findings: list[dict], income_statement: dict, balance_sheet: dict) -> dict:
    risk_level = _risk_level(findings)
    verdict = "healthy" if risk_level == "low" else "blocked" if risk_level == "blocked" else "watch"
    key_risks = [f"{item['severity']}:{item['title']}" for item in findings[:5]]
    next_actions = [
        "生成财务报表预览, 交老板阅读。",
        "外部报送、审计签字、贷款申报前必须人工复核。",
    ]
    if findings:
        next_actions.insert(0, "先处理审计异常, 不要直接对外报送。")
    return {
        "verdict": verdict,
        "riskLevel": risk_level,
        "oneSentence": f"本期净利润 {income_statement['netIncome']}, 资产负债率 {balance_sheet['debtToAssetRatio']}。",
        "keyRisks": key_risks,
        "nextActions": next_actions,
    }


def _financing_materials(tb: dict, income_statement: dict, balance_sheet: dict) -> dict:
    monthly_opex = _decimal(income_statement.get("operatingExpense"))
    cash_like = _decimal(tb.get("cash")) + _decimal(tb.get("bank"))
    funding_need = max(Decimal("0"), monthly_opex * Decimal("3") - cash_like)
    return {
        "fundingNeed": _money(funding_need),
        "suggestedUseOfFunds": ["补充营运资金", "覆盖应收账款回款周期", "保留关键项目现金缓冲"],
        "repaymentSource": ["经营现金流", "应收账款回款", "利润留存"],
        "riskNotes": [
            "融资材料为草稿, 不构成贷款承诺。",
            f"资产负债率预览值: {balance_sheet['debtToAssetRatio']}",
        ],
    }


def _loan_application_draft(case: dict, financing_materials: dict) -> dict:
    return {
        "borrowerSummary": f"{case.get('title')} / 期间 {case.get('period')}",
        "requestedAmount": financing_materials["fundingNeed"],
        "purpose": "经营周转与项目现金缓冲",
        "repaymentSource": financing_materials["repaymentSource"],
        "collateralNeeded": "待人工确认抵押/担保条件",
        "requiredDocuments": [
            "营业执照",
            "近 12 个月银行流水",
            "近 2 年财务报表",
            "主要合同与发票",
            "纳税记录",
            "应收账款明细",
        ],
        "manualReviewRequired": True,
    }


def _archive_id(case_id: str) -> str:
    digest = sha1(f"hubu-reporting:{case_id}".encode("utf-8")).hexdigest()[:12]
    return f"hubu_reporting_archive_draft_{digest}"


def _decision_receipt_id(case_id: str, action: str) -> str:
    digest = sha1(f"hubu-reporting-decision:{case_id}:{action}".encode("utf-8")).hexdigest()[:12]
    return f"hubu_reporting_decision_preview_{digest}"


def _evidence_chain(case: dict) -> list[dict]:
    chain: list[dict] = []
    for path, source in (case.get("sources") or {}).items():
        if not isinstance(source, dict):
            continue
        chain.append(
            {
                "path": path,
                "sourceLabel": source.get("sourceLabel") or "unknown",
                "ref": source.get("ref"),
            }
        )
    return chain


def build_reporting_formatted_memorial(preview: dict) -> dict:
    """Render Hubu reporting preview as a ShangShuFang memorial.

    The financial statements remain structured under ``statements``. This text
    layer is for boss-facing memorial display and does not create new facts.
    """
    statements = preview.get("statements") or {}
    income = statements.get("incomeStatement") or {}
    balance = statements.get("balanceSheet") or {}
    cash_flow = statements.get("cashFlowStatement") or {}
    boss = preview.get("bossBrief") or {}
    findings = preview.get("auditFindings") or []
    archive = preview.get("archiveDraft") or {}
    actions = preview.get("decisionActions") or {}
    evidence = archive.get("evidenceChain") or []

    verdict = {
        "healthy": "可入史馆草稿",
        "watch": "需复核后再裁",
        "blocked": "暂不可归档",
    }.get(str(boss.get("verdict")), str(boss.get("verdict") or "需复核"))
    risks = [f"{item.get('severity')}:{item.get('title')}" for item in findings] or ["未见审计异常"]
    evidence_lines = [
        f"- {item.get('path')}: {item.get('sourceLabel')} / {item.get('ref')}"
        for item in evidence
    ]
    statement_lines = [
        (
            "利润表："
            f"收入 {income.get('revenue')}，毛利 {income.get('grossProfit')}，"
            f"净利润 {income.get('netIncome')}，净利率 {income.get('netMarginPct')}。"
        ),
        (
            "资产负债表："
            f"总资产 {balance.get('totalAssets')}，总负债 {balance.get('totalLiabilities')}，"
            f"权益 {balance.get('equity')}，平衡差额 {balance.get('balanceCheckDelta')}。"
        ),
        (
            "现金流量表："
            f"经营现金流 {cash_flow.get('operatingCashFlow')}，"
            f"投资现金流 {cash_flow.get('investingCashFlow')}，"
            f"筹资现金流 {cash_flow.get('financingCashFlow')}，"
            f"期末现金 {cash_flow.get('endingCash')}。"
        ),
    ]
    sections = {
        "圣裁": f"{verdict}。{boss.get('oneSentence', '')}",
        "分奏": (
            "会计司奏：已据试算平衡表和现金流事实包生成三表草稿。\n"
            "审计司奏：已检查来源、平衡关系、重复付款、合同/发票关联、预算和偿付压力。\n"
            "户部奏：本报告只作预览草稿，外部报送、审计签字、贷款申报前必须人工复核。"
        ),
        "证据": "\n".join(evidence_lines) or "暂无可核验证据；不得包装成已核实财务事实。",
        "风险": "\n".join(f"- {risk}" for risk in risks),
        "后令": (
            f"首选动作：{actions.get('primaryAction')}；"
            f"允许动作：{', '.join(actions.get('allowedActions') or [])}。"
        ),
        "质门": (
            f"previewOnly={preview.get('previewOnly')}；"
            f"executionAllowed={preview.get('executionAllowed')}；"
            f"sideEffects={preview.get('sideEffects')}；"
            f"archiveEligible={archive.get('archiveEligible')}。"
        ),
        "来源": (
            f"caseId={preview.get('caseId')}；period={preview.get('reportingPeriod')}；"
            f"archiveId={archive.get('archiveId')}；sourceDepartment=hubu。"
        ),
        "财务报表": "\n".join(statement_lines),
    }
    order = ["圣裁", "分奏", "财务报表", "证据", "风险", "后令", "质门", "来源"]
    return {
        "section_order": order,
        "sections": sections,
        "text": "\n\n".join(f"【{name}】\n{sections.get(name, '')}" for name in order),
    }


def build_reporting_evidence_gap_memorial(command: str, mode: str = "order") -> dict:
    """Render the ShangShuFang response when no reporting fact pack exists."""
    is_secret = mode == "secret"
    sections = {
        "圣裁": (
            "密旨预研：暂不可生成真实财务报表。"
            if is_secret
            else "需补证：暂不可生成真实财务报表。"
        ),
        "分奏": (
            "锦衣卫奏：未见可核验财务事实包，已列采集清单。\n"
            "户部奏：没有试算平衡表、现金流和来源标签前，不生成利润表、资产负债表、现金流量表。\n"
            "工部奏：如本案涉及 PACK 蜂群建设，需补齐 BOM、交付、人力和售后成本后再核预算。\n"
            "钦天监奏：当前只能判断为证据准备阶段，不宜进入正式估值或归档。"
        ),
        "财务报表": "暂无可核验三表；不得用模型推断替代财务事实。",
        "证据": "\n".join(f"- {item}" for item in REPORTING_JINYIWEI_CHECKLIST),
        "风险": (
            "- 缺试算平衡表会导致利润表不可核验\n"
            "- 缺现金流事实会导致现金流量表不可核验\n"
            "- 缺来源标签会导致史馆归档和融资材料不可用"
        ),
        "后令": "先交锦衣卫补证；补齐事实包后再请户部生成三表预览。",
        "质门": "previewOnly=true；executionAllowed=false；sideEffects=none；archiveEligible=false。",
        "来源": f"mode={mode}；sourceDepartment=hubu；command={command[:120]}",
    }
    order = ["圣裁", "分奏", "财务报表", "证据", "风险", "后令", "质门", "来源"]
    return {
        "section_order": order,
        "sections": sections,
        "text": "\n\n".join(f"【{name}】\n{sections.get(name, '')}" for name in order),
    }


def build_shangshufang_finance_reporting_loop(command: str, mode: str = "order", fact_pack: dict | None = None) -> dict:
    """Single ShangShuFang entry for public edict and secret edict reporting.

    This keeps the execution boundary explicit: with a verified fact pack, Hu Bu
    renders the statements; without one, Jin Yi Wei only receives a collection
    checklist. No facts are invented.
    """
    normalized_mode = "secret" if mode == "secret" else "order"
    if fact_pack:
        preview = build_hubu_finance_reporting_preview(fact_pack)
        return {
            "schemaVersion": "ShangShuFangFinanceReportingLoopV1",
            "mode": normalized_mode,
            "command": command,
            "stage": "report_ready",
            "done": True,
            "sourceLabel": "MIXED",
            "departments": [
                {"id": "jinyiwei", "label": "锦衣卫", "role": "核对来源标签与凭证引用"},
                {"id": "hubu", "label": "户部", "role": "生成财务报表预览与预算/现金流判断"},
                {"id": "gongbu", "label": "工部", "role": "如涉及 PACK 建设，复核交付和成本输入"},
                {"id": "qintianjian", "label": "钦天监", "role": "判断风险窗口与优先级"},
            ],
            "requiredFactPackSections": REPORTING_REQUIRED_FACT_PACK_SECTIONS,
            "collectionChecklist": [],
            "preview": preview,
            "formattedMemorial": preview["formattedMemorial"],
            "nextAction": "人工复核后可保存为史馆草稿。" if preview["archiveDraft"]["archiveEligible"] else "先处理审计异常或补证。",
        }

    memorial = build_reporting_evidence_gap_memorial(command, normalized_mode)
    return {
        "schemaVersion": "ShangShuFangFinanceReportingLoopV1",
        "mode": normalized_mode,
        "command": command,
        "stage": "awaiting_jinyiwei_evidence",
        "done": False,
        "sourceLabel": "FALLBACK",
        "departments": [
            {"id": "jinyiwei", "label": "锦衣卫", "role": "采集财务事实包、来源标签和凭证引用"},
            {"id": "hubu", "label": "户部", "role": "待事实包齐备后生成三表预览"},
            {"id": "gongbu", "label": "工部", "role": "PACK 相关成本、交付、BOM 和资源测算补证"},
            {"id": "qintianjian", "label": "钦天监", "role": "证据齐备后判断优先级和风险窗口"},
        ],
        "requiredFactPackSections": REPORTING_REQUIRED_FACT_PACK_SECTIONS,
        "collectionChecklist": REPORTING_JINYIWEI_CHECKLIST,
        "preview": None,
        "formattedMemorial": memorial,
        "nextAction": "请锦衣卫先按清单补齐财务事实包。",
    }


def reporting_decision_actions_for(preview: dict) -> dict:
    """把财务报表预览结论转换成老板按钮契约。"""
    risk_level = str((preview.get("bossBrief") or {}).get("riskLevel") or "medium")
    findings = preview.get("auditFindings") or []
    has_source_gap = any(item.get("id") == "source_label_gap" for item in findings)
    if risk_level == "blocked":
        primary = "return_for_audit_review"
        allowed = ["return_for_audit_review", "return_for_evidence", "save_draft"]
        blocked = ["archive_preview", "prepare_financing_materials"]
        owner = "audit"
    elif has_source_gap or risk_level == "high":
        primary = "return_for_evidence"
        allowed = ["return_for_evidence", "return_for_audit_review", "save_draft"]
        blocked = ["archive_preview", "prepare_financing_materials"]
        owner = "accounting_or_audit"
    else:
        primary = "archive_preview"
        allowed = ["archive_preview", "prepare_financing_materials", "save_draft"]
        blocked = []
        owner = "boss"

    return {
        "primaryAction": primary,
        "allowedActions": allowed,
        "blockedActions": blocked,
        "requiresSecondConfirmation": False,
        "archiveEligible": bool((preview.get("archiveDraft") or {}).get("archiveEligible")),
        "ownerHint": owner,
        "buttonLabels": {action: REPORTING_BUTTON_LABELS[action] for action in allowed},
    }


def build_hubu_finance_reporting_preview(case: dict) -> dict:
    """生成财务报表、审计异常、融资/贷款材料草稿。

    返回值显式声明 previewOnly/executionAllowed/sideEffects, 防止被误解为真实报送或贷款申请。
    """
    _require_case_shape(case)

    tb = case["trialBalance"]
    income_statement = _income_statement(tb)
    balance_sheet = _balance_sheet(tb, _decimal(income_statement["netIncome"]))
    cash_flow = _cash_flow_statement(case["cashFlow"])
    audit_findings = [
        *_audit_source_labels(case),
        *_audit_balance_sheet(balance_sheet),
        *_audit_margin(case, income_statement),
        *_audit_payment_controls(case),
        *_audit_debt_and_cash(balance_sheet, cash_flow),
    ]
    boss_brief = _boss_brief(audit_findings, income_statement, balance_sheet)
    financing_materials = _financing_materials(tb, income_statement, balance_sheet)
    loan_draft = _loan_application_draft(case, financing_materials)

    archive_eligible = not any(item["severity"] in {"critical", "high"} for item in audit_findings)
    preview = {
        "previewOnly": True,
        "executionAllowed": False,
        "sideEffects": "none",
        "officeChain": ["accounting", "audit", "reporting", "financing_materials", "archive_draft"],
        "caseId": str(case["caseId"]),
        "title": str(case["title"]),
        "reportingPeriod": str(case["period"]),
        "currency": str(case.get("currency") or "CNY"),
        "sourceLabelSummary": _source_label_summary(case),
        "statements": {
            "incomeStatement": income_statement,
            "balanceSheet": balance_sheet,
            "cashFlowStatement": cash_flow,
        },
        "auditFindings": audit_findings,
        "bossBrief": boss_brief,
        "financingMaterials": financing_materials,
        "loanApplicationDraft": loan_draft,
        "archiveDraft": {
            "archiveMode": "draft_only",
            "archiveId": _archive_id(str(case["caseId"])),
            "archiveEligible": archive_eligible,
            "archiveBlockedReasons": [
                item["title"] for item in audit_findings if item["severity"] in {"critical", "high"}
            ],
            "sourceDepartment": "hubu",
            "agentCode": "hu_bu",
            "decisionStatus": "reporting_preview",
            "riskLevel": boss_brief["riskLevel"],
            "evidenceChain": _evidence_chain(case),
            "auditTrail": [
                {"office": "accounting", "status": "preview_generated"},
                {"office": "audit", "status": "findings_detected" if audit_findings else "clean"},
                {"office": "reporting", "status": "draft_only"},
            ],
            "relatedPastCases": case.get("relatedPastCases") or [],
        },
    }
    preview["decisionActions"] = reporting_decision_actions_for(preview)
    preview["formattedMemorial"] = build_reporting_formatted_memorial(preview)
    return preview


def _reporting_next_state_for_action(action: str) -> str:
    return {
        "archive_preview": "archive_draft_ready",
        "prepare_financing_materials": "financing_materials_ready_for_manual_review",
        "return_for_audit_review": "returned_for_audit_review",
        "return_for_evidence": "returned_for_evidence",
        "save_draft": "saved_as_draft",
    }.get(action, "pending")


def build_hubu_finance_reporting_decision_preview(case: dict, decision_input: dict) -> dict:
    """校验老板对财务报表预览的动作并生成裁决收据草稿。

    这里只校验动作是否允许, 不写史馆、不提交融资、不连接银行/税务。
    """
    if not isinstance(decision_input, dict):
        raise ValueError("decisionInput 必须是 object")
    action = str(decision_input.get("action") or "").strip()
    if not action:
        raise ValueError("decisionInput.action 不能为空")
    decided_by = str(decision_input.get("decidedBy") or "").strip()
    if not decided_by:
        raise ValueError("decisionInput.decidedBy 不能为空")

    preview = build_hubu_finance_reporting_preview(case)
    actions = preview["decisionActions"]
    allowed = actions.get("allowedActions") or []
    if action not in allowed:
        raise ValueError(f"当前财务报表结论不允许执行动作: {action}")

    reason = str(decision_input.get("reason") or "").strip()
    return {
        "previewOnly": True,
        "executionAllowed": False,
        "sideEffects": "none",
        "caseId": preview["caseId"],
        "decisionReceipt": {
            "receiptId": _decision_receipt_id(preview["caseId"], action),
            "action": action,
            "actionLabel": REPORTING_BUTTON_LABELS.get(action, action),
            "accepted": True,
            "decidedBy": decided_by,
            "reason": reason,
            "requiresSecondConfirmation": False,
            "confirmedRiskGates": [],
            "nextState": _reporting_next_state_for_action(action),
        },
        "bossBrief": preview["bossBrief"],
        "decisionActions": actions,
        "archiveDraft": preview["archiveDraft"],
        "financingMaterials": preview["financingMaterials"],
        "loanApplicationDraft": preview["loanApplicationDraft"],
    }
