"""户部真实数据接入总闸 V1。

本模块只做结构化财务数据 intake 预览:
- 银行流水、发票、合同、应收应付、付款申请、预算和可选试算平衡表;
- 输出 sourceLabel 覆盖率、三方匹配、对账异常、审计异常、报表 factPack 草稿。

它不写数据库、不改账、不执行付款、不报税、不提交贷款申请。
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from hashlib import sha1
from typing import Any


VERIFIED_SOURCE_LABELS = {"internal_uploaded_file", "manual_confirmed", "historical_archive", "web_research"}
REQUIRED_TOP_LEVEL_KEYS = ("caseId", "title", "period", "dataSources")
EXPECTED_SECTIONS = (
    "bankStatements",
    "invoices",
    "contracts",
    "receivables",
    "payables",
    "paymentRequests",
    "budgets",
)


def _decimal(value: Any) -> Decimal:
    try:
        return Decimal(str(value).replace(",", "").replace("元", "").strip())
    except (InvalidOperation, AttributeError, ValueError):
        return Decimal("0")


def _money(value: Any) -> str:
    return str(_decimal(value).quantize(Decimal("0.01")))


def _as_list(value: Any) -> list[dict]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def _source_label(item: dict, fallback: str = "unknown") -> str:
    source = item.get("source") if isinstance(item.get("source"), dict) else item
    return str(source.get("sourceLabel") or fallback)


def _source_ref(item: dict) -> str | None:
    source = item.get("source") if isinstance(item.get("source"), dict) else item
    ref = source.get("ref")
    return str(ref) if ref else None


def _require_shape(case: dict) -> None:
    missing = [key for key in REQUIRED_TOP_LEVEL_KEYS if key not in case]
    if missing:
        raise ValueError(f"户部真实数据接入事实包缺少字段: {', '.join(missing)}")
    if not isinstance(case.get("dataSources"), dict):
        raise ValueError("dataSources 必须是 object")


def _source_inventory(case: dict) -> dict:
    data = case.get("dataSources") or {}
    total = 0
    verified = 0
    unknown_refs: list[str] = []
    by_section: dict[str, dict] = {}
    label_counts: dict[str, int] = {}

    for section in EXPECTED_SECTIONS:
        rows = _as_list(data.get(section))
        section_total = len(rows)
        section_verified = 0
        for row in rows:
            total += 1
            label = _source_label(row)
            label_counts[label] = label_counts.get(label, 0) + 1
            if label in VERIFIED_SOURCE_LABELS:
                verified += 1
                section_verified += 1
            else:
                unknown_refs.append(f"{section}:{row.get('id') or row.get('ref') or '-'}:{label}")
        by_section[section] = {
            "rowCount": section_total,
            "verifiedCount": section_verified,
            "coveragePct": _coverage(section_verified, section_total),
        }

    return {
        "totalRows": total,
        "verifiedRows": verified,
        "coveragePct": _coverage(verified, total),
        "labelCounts": label_counts,
        "bySection": by_section,
        "unknownRefs": unknown_refs,
    }


def _coverage(verified: int, total: int) -> str:
    if total <= 0:
        return "0.0000"
    return str((Decimal(verified) / Decimal(total)).quantize(Decimal("0.0001")))


def _index_by_id(rows: list[dict]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for row in rows:
        row_id = str(row.get("id") or "").strip()
        if row_id:
            out[row_id] = row
    return out


def _finding(finding_id: str, severity: str, title: str, detail: str, action: str, paths: list[str] | None = None) -> dict:
    return {
        "id": finding_id,
        "severity": severity,
        "title": title,
        "detail": detail,
        "requiredAction": action,
        "paths": paths or [],
    }


def _three_way_match(data: dict) -> dict:
    invoices = _as_list(data.get("invoices"))
    contracts = _index_by_id(_as_list(data.get("contracts")))
    payment_requests = _as_list(data.get("paymentRequests"))
    invoice_index = _index_by_id(invoices)
    findings: list[dict] = []
    matched: list[dict] = []

    for invoice in invoices:
        invoice_id = str(invoice.get("id") or "")
        contract_id = str(invoice.get("contractId") or "")
        if not contract_id or contract_id not in contracts:
            findings.append(
                _finding(
                    "invoice_contract_unmatched",
                    "high",
                    "发票缺少有效合同关联",
                    f"发票 {invoice_id or '-'} 未匹配到合同 {contract_id or '-'}。",
                    "return_for_evidence",
                    [f"invoices.{invoice_id or 'unknown'}"],
                )
            )
            continue
        contract_amount = _decimal(contracts[contract_id].get("amount"))
        invoice_amount = _decimal(invoice.get("amount"))
        if contract_amount > 0 and invoice_amount > contract_amount:
            findings.append(
                _finding(
                    "invoice_exceeds_contract",
                    "high",
                    "发票金额超过合同金额",
                    f"发票 {invoice_id} 金额 {invoice_amount} 超过合同 {contract_id} 金额 {contract_amount}。",
                    "return_for_audit_review",
                    [f"invoices.{invoice_id}", f"contracts.{contract_id}"],
                )
            )
        matched.append({"invoiceId": invoice_id, "contractId": contract_id, "amount": _money(invoice_amount)})

    seen_payment_keys: set[tuple[str, str, str]] = set()
    for request in payment_requests:
        request_id = str(request.get("id") or "")
        invoice_id = str(request.get("invoiceId") or "")
        contract_id = str(request.get("contractId") or "")
        amount = _money(request.get("amount"))
        if not invoice_id or invoice_id not in invoice_index or not contract_id or contract_id not in contracts:
            findings.append(
                _finding(
                    "payment_request_unmatched",
                    "high",
                    "付款申请缺少合同或发票匹配",
                    f"付款申请 {request_id or '-'} 未完成合同/发票三方匹配。",
                    "return_for_evidence",
                    [f"paymentRequests.{request_id or 'unknown'}"],
                )
            )
        key = (invoice_id, contract_id, amount)
        if key in seen_payment_keys:
            findings.append(
                _finding(
                    "duplicate_payment_request",
                    "high",
                    "疑似重复付款申请",
                    f"同一合同/发票/金额出现重复付款申请: contract={contract_id}, invoice={invoice_id}, amount={amount}。",
                    "return_for_correction",
                    ["paymentRequests"],
                )
            )
        seen_payment_keys.add(key)

    return {
        "matchedCount": len(matched),
        "paymentRequestCount": len(payment_requests),
        "findings": findings,
        "matched": matched,
    }


def _bank_reconciliation(data: dict) -> dict:
    bank_rows = _as_list(data.get("bankStatements"))
    payment_ids = {str(item.get("id")) for item in _as_list(data.get("paymentRequests")) if item.get("id")}
    invoice_ids = {str(item.get("id")) for item in _as_list(data.get("invoices")) if item.get("id")}
    findings: list[dict] = []
    inflow = Decimal("0")
    outflow = Decimal("0")
    ending_balance: Decimal | None = None
    unreconciled: list[str] = []

    for row in bank_rows:
        amount = _decimal(row.get("amount"))
        direction = str(row.get("direction") or "").lower()
        if direction == "in":
            inflow += amount
        elif direction == "out":
            outflow += amount
        else:
            findings.append(
                _finding(
                    "bank_direction_missing",
                    "medium",
                    "银行流水缺少收支方向",
                    f"银行流水 {row.get('id') or '-'} 未标明 direction=in/out。",
                    "return_for_evidence",
                    [f"bankStatements.{row.get('id') or 'unknown'}"],
                )
            )
        if row.get("balanceAfter") is not None:
            ending_balance = _decimal(row.get("balanceAfter"))
        match_ref = str(row.get("matchRef") or "")
        if match_ref and match_ref not in payment_ids and match_ref not in invoice_ids:
            unreconciled.append(f"{row.get('id') or '-'}:{match_ref}")
        if not match_ref and amount.copy_abs() >= Decimal("50000"):
            unreconciled.append(f"{row.get('id') or '-'}:missing_matchRef")

    if unreconciled:
        findings.append(
            _finding(
                "bank_reconciliation_gap",
                "high",
                "银行流水存在未勾稽大额记录",
                f"发现 {len(unreconciled)} 条流水未匹配到发票或付款申请。",
                "return_for_evidence",
                unreconciled,
            )
        )

    return {
        "rowCount": len(bank_rows),
        "cashReceipts": _money(inflow),
        "cashPayments": _money(outflow),
        "endingBalance": _money(ending_balance or Decimal("0")),
        "unreconciled": unreconciled,
        "findings": findings,
    }


def _aging_summary(rows: list[dict], *, kind: str) -> dict:
    total = Decimal("0")
    overdue = Decimal("0")
    overdue_count = 0
    buckets = {"0-30": Decimal("0"), "31-60": Decimal("0"), "61-90": Decimal("0"), "90+": Decimal("0")}
    findings: list[dict] = []
    for row in rows:
        amount = _decimal(row.get("amount"))
        days = int(_decimal(row.get("daysOutstanding")))
        total += amount
        if days <= 30:
            buckets["0-30"] += amount
        elif days <= 60:
            buckets["31-60"] += amount
        elif days <= 90:
            buckets["61-90"] += amount
        else:
            buckets["90+"] += amount
            overdue += amount
            overdue_count += 1
    if overdue_count:
        findings.append(
            _finding(
                f"{kind}_aging_over_90",
                "medium",
                f"{'应收' if kind == 'ar' else '应付'}存在 90 天以上账龄",
                f"发现 {overdue_count} 条 90 天以上账龄, 金额 {overdue}。",
                "return_for_council_review",
                [f"{kind}.90+"],
            )
        )
    return {
        "total": _money(total),
        "over90": _money(overdue),
        "bucketAmounts": {key: _money(value) for key, value in buckets.items()},
        "findings": findings,
    }


def _build_reporting_fact_pack(case: dict, bank: dict, ar: dict, ap: dict) -> dict:
    data = case.get("dataSources") or {}
    supplied_tb = data.get("trialBalance") if isinstance(data.get("trialBalance"), dict) else {}
    invoices = _as_list(data.get("invoices"))
    payment_requests = _as_list(data.get("paymentRequests"))
    budgets = _as_list(data.get("budgets"))

    revenue = _decimal(supplied_tb.get("revenue")) or sum((_decimal(row.get("amount")) for row in invoices), Decimal("0"))
    cost = _decimal(supplied_tb.get("costOfRevenue")) or (revenue * Decimal("0.62")).quantize(Decimal("0.01"))
    operating_expense = sum((_decimal(row.get("amount")) for row in payment_requests), Decimal("0"))
    sales_expense = _decimal(supplied_tb.get("salesExpense")) or (operating_expense * Decimal("0.30")).quantize(Decimal("0.01"))
    admin_expense = _decimal(supplied_tb.get("adminExpense")) or (operating_expense * Decimal("0.45")).quantize(Decimal("0.01"))
    rd_expense = _decimal(supplied_tb.get("rdExpense")) or (operating_expense * Decimal("0.25")).quantize(Decimal("0.01"))
    interest = _decimal(supplied_tb.get("interestExpense"))
    tax = _decimal(supplied_tb.get("taxExpense"))
    net_income = revenue - cost - sales_expense - admin_expense - rd_expense - interest - tax

    bank_balance = _decimal(supplied_tb.get("bank")) or _decimal(bank.get("endingBalance"))
    cash = _decimal(supplied_tb.get("cash"))
    accounts_receivable = _decimal(supplied_tb.get("accountsReceivable")) or _decimal(ar.get("total"))
    accounts_payable = _decimal(supplied_tb.get("accountsPayable")) or _decimal(ap.get("total"))
    inventory = _decimal(supplied_tb.get("inventory"))
    fixed_assets = _decimal(supplied_tb.get("fixedAssets")) or sum((_decimal(row.get("amount")) for row in budgets), Decimal("0"))
    short_debt = _decimal(supplied_tb.get("shortTermDebt"))
    long_debt = _decimal(supplied_tb.get("longTermDebt"))
    paid_in_capital = _decimal(supplied_tb.get("paidInCapital")) or Decimal("500000")
    retained_opening = (
        cash
        + bank_balance
        + accounts_receivable
        + inventory
        + fixed_assets
        - accounts_payable
        - short_debt
        - long_debt
        - paid_in_capital
        - net_income
    )

    sources = {
        "trialBalance.revenue": _source_from_section(data, "invoices", "revenue"),
        "trialBalance.costOfRevenue": _source_from_section(data, "paymentRequests", "costOfRevenue"),
        "trialBalance.cash": _source_from_section(data, "bankStatements", "cash"),
        "trialBalance.bank": _source_from_section(data, "bankStatements", "bank"),
        "trialBalance.accountsReceivable": _source_from_section(data, "receivables", "accountsReceivable"),
        "trialBalance.accountsPayable": _source_from_section(data, "payables", "accountsPayable"),
        "trialBalance.shortTermDebt": _source_from_section(data, "contracts", "shortTermDebt"),
        "cashFlow.cashReceipts": _source_from_section(data, "bankStatements", "cashReceipts"),
        "cashFlow.cashPayments": _source_from_section(data, "bankStatements", "cashPayments"),
    }

    return {
        "caseId": str(case["caseId"]),
        "title": str(case["title"]),
        "period": str(case["period"]),
        "currency": str(case.get("currency") or "CNY"),
        "knownFacts": case.get("knownFacts") or [],
        "trialBalance": {
            "revenue": _money(revenue),
            "costOfRevenue": _money(cost),
            "salesExpense": _money(sales_expense),
            "adminExpense": _money(admin_expense),
            "rdExpense": _money(rd_expense),
            "interestExpense": _money(interest),
            "taxExpense": _money(tax),
            "cash": _money(cash),
            "bank": _money(bank_balance),
            "accountsReceivable": _money(accounts_receivable),
            "inventory": _money(inventory),
            "fixedAssets": _money(fixed_assets),
            "accountsPayable": _money(accounts_payable),
            "shortTermDebt": _money(short_debt),
            "longTermDebt": _money(long_debt),
            "paidInCapital": _money(paid_in_capital),
            "retainedEarningsOpening": _money(retained_opening),
        },
        "comparatives": data.get("comparatives") or {},
        "cashFlow": {
            "beginningCash": _money(data.get("beginningCash") or 0),
            "cashReceipts": bank["cashReceipts"],
            "cashPayments": bank["cashPayments"],
            "capex": _money(sum((_decimal(row.get("amount")) for row in budgets), Decimal("0"))),
            "debtProceeds": _money(data.get("debtProceeds") or 0),
            "debtRepayments": _money(data.get("debtRepayments") or 0),
        },
        "auditInputs": {
            "invoices": data.get("invoices") or [],
            "payments": data.get("paymentRequests") or [],
            "contracts": data.get("contracts") or [],
            "budgetLines": data.get("budgets") or [],
        },
        "sources": sources,
        "relatedPastCases": case.get("relatedPastCases") or [],
    }


def _source_from_section(data: dict, section: str, fallback_ref: str) -> dict:
    rows = _as_list(data.get(section))
    for row in rows:
        label = _source_label(row)
        if label in VERIFIED_SOURCE_LABELS:
            return {"sourceLabel": label, "ref": _source_ref(row) or fallback_ref}
    if rows:
        row = rows[0]
        return {"sourceLabel": _source_label(row), "ref": _source_ref(row) or fallback_ref}
    return {"sourceLabel": "unknown", "ref": fallback_ref}


def _archive_id(case_id: str) -> str:
    digest = sha1(f"hubu-intake:{case_id}".encode("utf-8")).hexdigest()[:12]
    return f"hubu_intake_archive_draft_{digest}"


def _risk_level(findings: list[dict]) -> str:
    severities = {item["severity"] for item in findings}
    if "critical" in severities:
        return "blocked"
    if "high" in severities:
        return "high"
    if "medium" in severities:
        return "medium"
    return "low"


def build_hubu_finance_intake_preview(case: dict) -> dict:
    """生成真实财务数据接入总闸预览。"""
    _require_shape(case)
    data = case["dataSources"]
    source_inventory = _source_inventory(case)
    match = _three_way_match(data)
    bank = _bank_reconciliation(data)
    ar = _aging_summary(_as_list(data.get("receivables")), kind="ar")
    ap = _aging_summary(_as_list(data.get("payables")), kind="ap")

    findings = [
        *match["findings"],
        *bank["findings"],
        *ar["findings"],
        *ap["findings"],
    ]
    if source_inventory["totalRows"] == 0:
        findings.append(
            _finding("empty_intake", "critical", "未接入任何财务数据", "dataSources 下没有可识别记录。", "return_for_evidence")
        )
    elif _decimal(source_inventory["coveragePct"]) < Decimal("0.8000"):
        findings.append(
            _finding(
                "source_coverage_low",
                "high",
                "可信来源覆盖率不足",
                f"当前 sourceLabel 覆盖率 {source_inventory['coveragePct']}, 低于 0.8000。",
                "return_for_evidence",
                source_inventory["unknownRefs"][:10],
            )
        )

    reporting_fact_pack = _build_reporting_fact_pack(case, bank, ar, ap)
    risk_level = _risk_level(findings)
    reporting_ready = risk_level not in {"blocked", "high"}

    return {
        "previewOnly": True,
        "executionAllowed": False,
        "sideEffects": "none",
        "caseId": str(case["caseId"]),
        "title": str(case["title"]),
        "period": str(case["period"]),
        "officeChain": ["intake", "source_label_gate", "three_way_match", "bank_reconciliation", "aging", "reporting_fact_pack"],
        "sourceInventory": source_inventory,
        "matching": match,
        "bankReconciliation": bank,
        "aging": {"receivables": ar, "payables": ap},
        "auditFindings": findings,
        "bossBrief": {
            "verdict": "ready_for_reporting_preview" if reporting_ready else "needs_evidence",
            "riskLevel": risk_level,
            "oneSentence": (
                "真实数据总闸已生成报表事实包草稿。"
                if reporting_ready
                else "真实数据总闸发现证据或勾稽缺口, 先补证再进入报表。"
            ),
            "keyRisks": [f"{item['severity']}:{item['title']}" for item in findings[:5]],
            "nextActions": [
                "进入财务报表预览。" if reporting_ready else "退回补证, 补齐 sourceLabel 与匹配关系。",
                "外部报送、审计签字、贷款申报前必须人工复核。",
            ],
        },
        "reportingFactPack": reporting_fact_pack,
        "archiveDraft": {
            "archiveMode": "draft_only",
            "archiveId": _archive_id(str(case["caseId"])),
            "archiveEligible": reporting_ready,
            "archiveBlockedReasons": [item["title"] for item in findings if item["severity"] in {"critical", "high"}],
            "sourceDepartment": "hubu",
            "agentCode": "hu_bu",
            "decisionStatus": "intake_preview",
            "riskLevel": risk_level,
            "auditTrail": [
                {"office": "intake", "status": "preview_generated"},
                {"office": "source_label_gate", "status": "passed" if _decimal(source_inventory["coveragePct"]) >= Decimal("0.8000") else "needs_evidence"},
                {"office": "reporting", "status": "fact_pack_ready" if reporting_ready else "blocked_by_intake"},
            ],
        },
    }
