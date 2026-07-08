"""Hubu finance CSV template loader.

This module converts the checked-in Hubu finance CSV templates, or exported
files with the same headers, into the structured fact pack consumed by
``build_hubu_finance_intake_preview``. It only reads the provided directory and
never writes files, scans user drives, changes books, pays money, or calls
external services.
"""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Any


SECTION_FILES = {
    "bankStatements": "bank_statements.csv",
    "contracts": "contracts.csv",
    "invoices": "invoices.csv",
    "paymentRequests": "payment_requests.csv",
    "receivables": "receivables.csv",
    "payables": "payables.csv",
    "budgets": "budgets.csv",
}

NUMERIC_FIELDS = {
    "amount",
    "balanceAfter",
    "used",
    "daysOutstanding",
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
    "beginningCash",
    "cashReceipts",
    "cashPayments",
    "capex",
    "debtProceeds",
    "debtRepayments",
}


def _clean(value: Any) -> str:
    return str(value or "").strip()


def _coerce(field: str, value: Any) -> Any:
    text = _clean(value)
    if field in NUMERIC_FIELDS and text != "":
        return text
    return text


def _read_rows(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8-sig") as handle:
        return [
            {str(key): _coerce(str(key), value) for key, value in row.items() if key is not None}
            for row in csv.DictReader(handle)
            if any(_clean(value) for value in row.values())
        ]


def _with_source(row: dict) -> dict:
    source_label = row.pop("sourceLabel", "")
    source_ref = row.pop("sourceRef", "")
    if source_label or source_ref:
        row["source"] = {"sourceLabel": source_label or "unknown", "ref": source_ref}
    return row


def _trial_balance(import_dir: Path) -> dict:
    rows = _read_rows(import_dir / "trial_balance.csv")
    if not rows:
        return {}
    return {key: value for key, value in rows[0].items() if value != ""}


def _cash_flow(import_dir: Path) -> dict:
    rows = _read_rows(import_dir / "cash_flow.csv")
    if not rows:
        return {}
    return {key: value for key, value in rows[0].items() if value != ""}


def _trial_balance_sources(import_dir: Path) -> dict:
    sources: dict[str, dict] = {}
    for row in _read_rows(import_dir / "trial_balance_sources.csv"):
        path = _clean(row.get("path"))
        if not path:
            continue
        sources[path] = {"sourceLabel": _clean(row.get("sourceLabel")) or "unknown", "ref": _clean(row.get("sourceRef"))}
    return sources


def build_hubu_finance_fact_pack_from_csv(
    import_dir: str | Path,
    *,
    case_id: str,
    title: str,
    period: str,
) -> dict:
    """Build an intake fact pack from CSV files with Hubu finance template headers."""
    root = Path(import_dir)
    data_sources: dict[str, Any] = {}
    for section, filename in SECTION_FILES.items():
        data_sources[section] = [_with_source(dict(row)) for row in _read_rows(root / filename)]

    trial_balance = _trial_balance(root)
    if trial_balance:
        data_sources["trialBalance"] = trial_balance
    cash_flow = _cash_flow(root)
    if cash_flow:
        data_sources["cashFlow"] = cash_flow
    trial_balance_sources = _trial_balance_sources(root)
    if trial_balance_sources:
        data_sources["trialBalanceSources"] = trial_balance_sources

    return {
        "caseId": case_id,
        "title": title,
        "period": period,
        "dataSources": data_sources,
    }
