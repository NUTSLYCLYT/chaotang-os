from __future__ import annotations

import csv
from pathlib import Path


TEMPLATE_DIR = Path(__file__).resolve().parents[1] / "templates" / "hubu_finance_import"

EXPECTED_HEADERS = {
    "bank_statements.csv": [
        "id",
        "date",
        "direction",
        "amount",
        "counterparty",
        "matchRef",
        "balanceAfter",
        "sourceLabel",
        "sourceRef",
    ],
    "contracts.csv": ["id", "counterparty", "amount", "startDate", "endDate", "sourceLabel", "sourceRef"],
    "invoices.csv": ["id", "contractId", "counterparty", "amount", "issueDate", "dueDate", "sourceLabel", "sourceRef"],
    "payment_requests.csv": [
        "id",
        "payee",
        "contractId",
        "invoiceId",
        "amount",
        "purpose",
        "sourceLabel",
        "sourceRef",
    ],
    "receivables.csv": ["id", "counterparty", "amount", "daysOutstanding", "sourceLabel", "sourceRef"],
    "payables.csv": ["id", "counterparty", "amount", "daysOutstanding", "sourceLabel", "sourceRef"],
    "budgets.csv": ["id", "amount", "used", "department", "project", "sourceLabel", "sourceRef"],
    "trial_balance.csv": [
        "revenue",
        "costOfRevenue",
        "salesExpense",
        "adminExpense",
        "rdExpense",
        "interestExpense",
        "taxExpense",
        "cash",
        "bank",
        "accountsReceivable",
        "inventory",
        "fixedAssets",
        "accountsPayable",
        "shortTermDebt",
        "longTermDebt",
        "paidInCapital",
        "retainedEarningsOpening",
    ],
    "trial_balance_sources.csv": ["path", "sourceLabel", "sourceRef"],
    "cash_flow.csv": ["beginningCash", "cashReceipts", "cashPayments", "capex", "debtProceeds", "debtRepayments"],
}


def _read_header(name: str) -> list[str]:
    with (TEMPLATE_DIR / name).open(newline="", encoding="utf-8") as handle:
        reader = csv.reader(handle)
        return next(reader)


def test_hubu_finance_import_templates_exist_with_locked_headers():
    for name, expected in EXPECTED_HEADERS.items():
        path = TEMPLATE_DIR / name
        assert path.exists(), f"missing template: {name}"
        assert _read_header(name) == expected


def test_hubu_finance_import_templates_include_example_rows_and_source_labels():
    for name in EXPECTED_HEADERS:
        with (TEMPLATE_DIR / name).open(newline="", encoding="utf-8") as handle:
            rows = list(csv.DictReader(handle))
        assert rows, f"template should include one example row: {name}"
        if name not in {"trial_balance.csv", "cash_flow.csv"}:
            assert "sourceLabel" in rows[0], f"missing sourceLabel column: {name}"
            assert "sourceRef" in rows[0], f"missing sourceRef column: {name}"
