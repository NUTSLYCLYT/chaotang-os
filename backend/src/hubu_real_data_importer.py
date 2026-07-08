"""Safe local importer for Hubu real finance source files.

This module turns explicitly selected local Excel exports into the existing
Hubu finance CSV import format. It never scans user drives recursively, writes
databases, changes accounting books, executes payments, files taxes, or calls
external services.
"""

from __future__ import annotations

import csv
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_TEMPLATE_DIR = ROOT / "templates" / "hubu_finance_import"
LOCAL_DATA_DIR = ROOT / "local_data"

TRIAL_BALANCE_FIELDS = [
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
]

EMPTY_HEADERS = {
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
    "budgets.csv": ["id", "amount", "used", "department", "project", "sourceLabel", "sourceRef"],
    "cash_flow.csv": ["beginningCash", "cashReceipts", "cashPayments", "capex", "debtProceeds", "debtRepayments"],
    "contracts.csv": ["id", "counterparty", "amount", "startDate", "endDate", "sourceLabel", "sourceRef"],
    "invoices.csv": ["id", "contractId", "counterparty", "amount", "issueDate", "dueDate", "sourceLabel", "sourceRef"],
    "payables.csv": ["id", "counterparty", "amount", "daysOutstanding", "sourceLabel", "sourceRef"],
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
    "trial_balance.csv": TRIAL_BALANCE_FIELDS,
    "trial_balance_sources.csv": ["path", "sourceLabel", "sourceRef"],
}


@dataclass(frozen=True)
class ImportResult:
    output_dir: Path
    trial_balance_fields: int
    contract_rows: int
    source_files: list[Path]

    def as_dict(self) -> dict:
        return {
            "outputDir": str(self.output_dir),
            "trialBalanceFields": self.trial_balance_fields,
            "contractRows": self.contract_rows,
            "sourceFiles": [str(path) for path in self.source_files],
            "sideEffects": "local_csv_files_only",
            "executionAllowed": False,
        }


def _load_workbook(path: Path):
    try:
        from openpyxl import load_workbook
    except ImportError as exc:  # pragma: no cover - exercised only in misconfigured envs
        raise RuntimeError("openpyxl is required to read Excel finance exports") from exc

    return load_workbook(path, read_only=True, data_only=True)


def _num(value: Any) -> float:
    if value in (None, ""):
        return 0.0
    try:
        return float(str(value).replace(",", "").replace("元", "").strip())
    except (TypeError, ValueError):
        return 0.0


def _fmt(value: float) -> str:
    return f"{value:.2f}"


def _text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _write_csv(path: Path, fieldnames: list[str], rows: list[dict]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def _is_account_code(value: Any) -> bool:
    text = str(value or "").strip()
    return text.isdigit() and len(text) == 4


def _load_trial_balance_accounts(balance_sheet_path: Path) -> dict[str, dict[str, float]]:
    if not balance_sheet_path.is_file():
        raise FileNotFoundError(f"balance_sheet_path does not exist: {balance_sheet_path}")

    workbook = _load_workbook(balance_sheet_path)
    try:
        worksheet = workbook.active
        accounts: dict[str, dict[str, float]] = {}
        for row in worksheet.iter_rows(values_only=True):
            if len(row) < 10 or not _is_account_code(row[2]):
                continue
            code = str(row[2]).strip()
            accounts[code] = {
                "opening_debit": _num(row[4]),
                "opening_credit": _num(row[5]),
                "debit": _num(row[6]),
                "credit": _num(row[7]),
                "ending_debit": _num(row[8]),
                "ending_credit": _num(row[9]),
            }
        return accounts
    finally:
        workbook.close()


def _account_value(accounts: dict[str, dict[str, float]], code: str, field: str) -> float:
    return accounts.get(code, {}).get(field, 0.0)


def build_trial_balance_from_account_export(balance_sheet_path: str | Path) -> dict[str, float]:
    """Build the Hubu trial-balance aggregate from a Chinese account balance export."""
    source = Path(balance_sheet_path)
    accounts = _load_trial_balance_accounts(source)
    fixed_assets_net = max(
        _account_value(accounts, "1601", "ending_debit") - _account_value(accounts, "1602", "ending_credit"),
        0.0,
    )
    return {
        "revenue": _account_value(accounts, "5001", "credit") + _account_value(accounts, "5301", "credit"),
        "costOfRevenue": _account_value(accounts, "5401", "debit"),
        "salesExpense": _account_value(accounts, "5601", "debit"),
        "adminExpense": _account_value(accounts, "5602", "debit"),
        "rdExpense": 0.0,
        "interestExpense": _account_value(accounts, "5603", "debit"),
        "taxExpense": _account_value(accounts, "5403", "debit"),
        "cash": _account_value(accounts, "1001", "ending_debit"),
        "bank": _account_value(accounts, "1002", "ending_debit"),
        "accountsReceivable": _account_value(accounts, "1122", "ending_debit"),
        "inventory": _account_value(accounts, "1403", "ending_debit") + _account_value(accounts, "1405", "ending_debit"),
        "fixedAssets": fixed_assets_net,
        "accountsPayable": _account_value(accounts, "2202", "ending_credit"),
        "shortTermDebt": _account_value(accounts, "2001", "ending_credit"),
        "longTermDebt": 0.0,
        "paidInCapital": _account_value(accounts, "3001", "ending_credit")
        + _account_value(accounts, "3002", "ending_credit"),
        "retainedEarningsOpening": _account_value(accounts, "3104", "opening_debit")
        - _account_value(accounts, "3104", "opening_credit"),
    }


def build_cash_flow_proxy_from_account_export(balance_sheet_path: str | Path) -> dict[str, float]:
    """Build a conservative cash-flow proxy from cash/bank and debt movement rows."""
    accounts = _load_trial_balance_accounts(Path(balance_sheet_path))
    return {
        "beginningCash": _account_value(accounts, "1001", "opening_debit")
        + _account_value(accounts, "1002", "opening_debit"),
        "cashReceipts": _account_value(accounts, "1001", "debit") + _account_value(accounts, "1002", "debit"),
        "cashPayments": _account_value(accounts, "1001", "credit") + _account_value(accounts, "1002", "credit"),
        "capex": 0.0,
        "debtProceeds": _account_value(accounts, "2001", "credit"),
        "debtRepayments": _account_value(accounts, "2001", "debit"),
    }


def _header_index(row: tuple[Any, ...], label: str) -> int | None:
    for index, value in enumerate(row):
        if str(value or "").strip() == label:
            return index
    return None


def extract_purchase_contract_rows(procurement_ledger_path: str | Path, *, limit: int = 80) -> list[dict]:
    """Extract contract rows from an explicitly selected purchase ledger workbook."""
    source = Path(procurement_ledger_path)
    if not source.is_file():
        raise FileNotFoundError(f"procurement_ledger_path does not exist: {source}")

    workbook = _load_workbook(source)
    try:
        worksheet = workbook["采购合同台账"] if "采购合同台账" in workbook.sheetnames else workbook.active
        header: dict[str, int] | None = None
        rows: list[dict] = []
        for row in worksheet.iter_rows(values_only=True):
            if header is None:
                contract_index = _header_index(row, "合同编号")
                counterparty_index = _header_index(row, "供应商名称")
                amount_index = _header_index(row, "合同金额")
                if contract_index is None or counterparty_index is None or amount_index is None:
                    continue
                header = {
                    "contract": contract_index,
                    "counterparty": counterparty_index,
                    "amount": amount_index,
                }
                continue

            contract_id = _text(row[header["contract"]] if header["contract"] < len(row) else "")
            counterparty = _text(row[header["counterparty"]] if header["counterparty"] < len(row) else "")
            amount = _num(row[header["amount"]] if header["amount"] < len(row) else None)
            if not contract_id or not counterparty or amount <= 0:
                continue
            rows.append(
                {
                    "id": contract_id,
                    "counterparty": counterparty,
                    "amount": _fmt(amount),
                    "startDate": "",
                    "endDate": "",
                    "sourceLabel": "internal_uploaded_file",
                    "sourceRef": str(source),
                }
            )
            if len(rows) >= limit:
                break
        return rows
    finally:
        workbook.close()


def _ensure_safe_output_dir(output_dir: Path) -> None:
    resolved = output_dir.resolve()
    root = ROOT.resolve()
    local_data = LOCAL_DATA_DIR.resolve()
    if resolved == root or root in resolved.parents and not (resolved == local_data or local_data in resolved.parents):
        raise ValueError(f"output_dir inside repo must be under local_data/: {output_dir}")


def build_hubu_real_data_import_workspace(
    *,
    balance_sheet_path: str | Path,
    output_dir: str | Path,
    procurement_ledger_path: str | Path | None = None,
    template_dir: str | Path = DEFAULT_TEMPLATE_DIR,
    force: bool = False,
    contract_limit: int = 80,
) -> ImportResult:
    """Create local Hubu finance CSVs from explicitly selected real source files."""
    source_balance = Path(balance_sheet_path)
    target = Path(output_dir)
    template_root = Path(template_dir)
    _ensure_safe_output_dir(target)

    if not template_root.is_dir():
        raise ValueError(f"template_dir does not exist or is not a directory: {template_root}")
    if target.exists() and any(target.iterdir()) and not force:
        raise FileExistsError(f"output_dir already exists and is not empty: {target}")

    target.mkdir(parents=True, exist_ok=True)
    for src in sorted(template_root.glob("*.csv")):
        shutil.copy2(src, target / src.name)

    trial_balance = build_trial_balance_from_account_export(source_balance)
    cash_flow = build_cash_flow_proxy_from_account_export(source_balance)
    _write_csv(
        target / "trial_balance.csv",
        TRIAL_BALANCE_FIELDS,
        [{key: _fmt(trial_balance[key]) for key in TRIAL_BALANCE_FIELDS}],
    )
    _write_csv(
        target / "trial_balance_sources.csv",
        EMPTY_HEADERS["trial_balance_sources.csv"],
        [
            {
                "path": f"trialBalance.{key}",
                "sourceLabel": "internal_uploaded_file",
                "sourceRef": str(source_balance),
            }
            for key in TRIAL_BALANCE_FIELDS
        ],
    )
    _write_csv(
        target / "receivables.csv",
        EMPTY_HEADERS["receivables.csv"],
        [
            {
                "id": "ar-aggregate",
                "counterparty": "aggregate_accounts_receivable",
                "amount": _fmt(trial_balance["accountsReceivable"]),
                "daysOutstanding": "",
                "sourceLabel": "internal_uploaded_file",
                "sourceRef": str(source_balance),
            }
        ],
    )
    _write_csv(
        target / "payables.csv",
        EMPTY_HEADERS["payables.csv"],
        [
            {
                "id": "ap-aggregate",
                "counterparty": "aggregate_accounts_payable",
                "amount": _fmt(trial_balance["accountsPayable"]),
                "daysOutstanding": "",
                "sourceLabel": "internal_uploaded_file",
                "sourceRef": str(source_balance),
            }
        ],
    )
    _write_csv(
        target / "cash_flow.csv",
        EMPTY_HEADERS["cash_flow.csv"],
        [{key: _fmt(cash_flow[key]) for key in EMPTY_HEADERS["cash_flow.csv"]}],
    )

    source_files = [source_balance]
    contract_rows: list[dict] = []
    if procurement_ledger_path:
        procurement_source = Path(procurement_ledger_path)
        source_files.append(procurement_source)
        contract_rows = extract_purchase_contract_rows(procurement_source, limit=contract_limit)
    _write_csv(target / "contracts.csv", EMPTY_HEADERS["contracts.csv"], contract_rows)

    for filename in ("bank_statements.csv", "budgets.csv", "invoices.csv", "payment_requests.csv"):
        _write_csv(target / filename, EMPTY_HEADERS[filename], [])

    return ImportResult(
        output_dir=target,
        trial_balance_fields=len(TRIAL_BALANCE_FIELDS),
        contract_rows=len(contract_rows),
        source_files=source_files,
    )
