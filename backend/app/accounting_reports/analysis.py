from __future__ import annotations

import hashlib
from collections import defaultdict
from collections.abc import Iterable, Mapping
from decimal import Decimal
from types import MappingProxyType
from typing import Final

from .models import (
    AccountingReportSummary,
    NormalizedLedgerRow,
    ReportCheck,
    ReportPeriod,
)

MATERIAL_MOVEMENT_THRESHOLD: Final = Decimal("0.20")

ACCOUNT_FAMILY_BY_CATEGORY: Final[Mapping[str, str]] = MappingProxyType(
    {
        "asset": "assets",
        "assets": "assets",
        "资产": "assets",
        "liability": "liabilities",
        "liabilities": "liabilities",
        "负债": "liabilities",
        "equity": "equity",
        "所有者权益": "equity",
        "revenue": "revenue",
        "income": "revenue",
        "收入": "revenue",
        "cost": "cost",
        "成本": "cost",
        "expense": "expense",
        "expenses": "expense",
        "费用": "expense",
    }
)

_DEBIT_FAMILIES: Final = frozenset({"assets", "cost", "expense"})
_CREDIT_FAMILIES: Final = frozenset({"liabilities", "equity", "revenue"})
_METRIC_NAMES: Final = (
    "assets",
    "liabilities",
    "equity",
    "revenue",
    "cost",
    "expense",
)
_DERIVED_METRIC_NAMES: Final = (
    "profit",
    "profit_yoy_amount",
    "profit_yoy_rate",
)
_ALL_METRIC_NAMES: Final = _METRIC_NAMES + _DERIVED_METRIC_NAMES


def signed_closing(row: NormalizedLedgerRow) -> Decimal:
    return row.closing_debit - row.closing_credit


def signed_opening(row: NormalizedLedgerRow) -> Decimal:
    return row.opening_debit - row.opening_credit


def safe_growth(current: Decimal, prior: Decimal) -> Decimal | None:
    if prior == 0:
        return None
    return (current - prior) / abs(prior)


def source_id_for_row(row: NormalizedLedgerRow) -> str:
    identity = (
        f"{row.source.file_sha256}\0{row.source.sheet_name}\0"
        f"{row.source.row_number}"
    )
    return f"src_{hashlib.sha256(identity.encode()).hexdigest()[:20]}"


def _family(row: NormalizedLedgerRow) -> str | None:
    return ACCOUNT_FAMILY_BY_CATEGORY.get(row.category.strip().lower())


def _oriented_amount(row: NormalizedLedgerRow, family: str) -> Decimal:
    if family in {"assets", "liabilities", "equity"}:
        amount = signed_closing(row)
    else:
        amount = row.movement_debit - row.movement_credit
    return amount if family in _DEBIT_FAMILIES else -amount


def _check(name: str, failures: Iterable[str]) -> ReportCheck:
    failed = tuple(failures)
    failure_count = str(len(failed))
    if failed:
        return ReportCheck(
            name,
            "FAIL",
            f"{len(failed)} exception(s)",
            actual=failure_count,
            expected="0",
            difference=failure_count,
        )
    return ReportCheck(
        name,
        "PASS",
        "no exceptions",
        actual="0",
        expected="0",
        difference="0",
    )


def analyze_ledger(
    rows: tuple[NormalizedLedgerRow, ...],
    period: ReportPeriod,
) -> AccountingReportSummary:
    metrics: dict[int, dict[str, Decimal | None]] = {
        year: {name: None for name in _ALL_METRIC_NAMES}
        for year in range(period.start_year, period.end_year + 1)
    }
    exceptions: list[str] = []
    direction_failures: list[str] = []
    mapping_failures: list[str] = []
    source_ids = {source_id_for_row(row) for row in rows}
    expected_years = set(metrics)
    present_years = {row.year for row in rows if row.year in expected_years}
    outside_years = {row.year for row in rows if row.year not in expected_years}
    coverage_failures = [
        *(f"missing:{year}" for year in sorted(expected_years - present_years)),
        *(f"outside:{year}" for year in sorted(outside_years)),
    ]
    for year in present_years:
        metrics[year].update({name: Decimal("0") for name in _METRIC_NAMES})

    for row in rows:
        source_id = source_id_for_row(row)
        if row.year not in expected_years:
            exceptions.append(f"period_mismatch:{row.year}:{source_id}")
            continue
        family = _family(row)
        if family is None:
            item = f"unmapped_account:{row.year}:{source_id}"
            exceptions.append(item)
            mapping_failures.append(item)
        else:
            current_amount = metrics[row.year][family]
            assert isinstance(current_amount, Decimal)
            metrics[row.year][family] = current_amount + _oriented_amount(row, family)
            if _oriented_amount(row, family) < 0:
                item = f"direction_anomaly:{family}:{row.year}:{source_id}"
                exceptions.append(item)
                direction_failures.append(item)
        amounts = (
            row.opening_debit,
            row.opening_credit,
            row.movement_debit,
            row.movement_credit,
            row.closing_debit,
            row.closing_credit,
        )
        if any(amount < 0 for amount in amounts):
            item = f"negative_amount:{row.year}:{source_id}"
            exceptions.append(item)
            direction_failures.append(item)

    years = sorted(present_years)
    for index, year in enumerate(years):
        year_metrics = metrics[year]
        revenue = year_metrics["revenue"]
        cost = year_metrics["cost"]
        expense = year_metrics["expense"]
        assert isinstance(revenue, Decimal)
        assert isinstance(cost, Decimal)
        assert isinstance(expense, Decimal)
        year_metrics["profit"] = revenue - cost - expense
        if index and years[index - 1] == year - 1:
            prior_profit = metrics[year - 1]["profit"]
            current_profit = year_metrics["profit"]
            assert isinstance(prior_profit, Decimal)
            assert isinstance(current_profit, Decimal)
            amount = current_profit - prior_profit
            rate = safe_growth(current_profit, prior_profit)
            year_metrics["profit_yoy_amount"] = amount
            year_metrics["profit_yoy_rate"] = rate
            if rate is not None and abs(rate) >= MATERIAL_MOVEMENT_THRESHOLD:
                exceptions.append(f"material_movement:profit:{year}")

    balance_failures = [
        str(year)
        for year in years
        if metrics[year]["assets"]
        != metrics[year]["liabilities"] + metrics[year]["equity"]
    ]

    rows_by_year_and_account: dict[
        tuple[int, str, str], list[NormalizedLedgerRow]
    ] = defaultdict(list)
    for row in rows:
        rows_by_year_and_account[(row.year, row.category, row.account_code)].append(
            row
        )
    continuity_failures: list[str] = []
    for year in years:
        prior_year = year - 1
        if prior_year not in present_years:
            continue
        accounts = {
            (category, code)
            for row_year, category, code in rows_by_year_and_account
            if row_year in {prior_year, year}
        }
        for category, code in accounts:
            current_rows = rows_by_year_and_account.get((year, category, code), ())
            prior_rows = rows_by_year_and_account.get(
                (prior_year, category, code), ()
            )
            if sum(map(signed_opening, current_rows), Decimal("0")) != sum(
                map(signed_closing, prior_rows), Decimal("0")
            ):
                continuity_failures.append(str(year))

    movement_failures = [
        str(year)
        for year in years
        if sum(
            (row.movement_debit for row in rows if row.year == year), Decimal("0")
        )
        != sum(
            (row.movement_credit for row in rows if row.year == year), Decimal("0")
        )
    ]

    checks = (
        _check("coverage", coverage_failures),
        _check("mapping", mapping_failures),
        _check("balance_sheet_equation", balance_failures),
        _check("opening_continuity", continuity_failures),
        _check("movement_balance", movement_failures),
        _check("account_directions", direction_failures),
    )
    return AccountingReportSummary(
        period=period,
        metrics_by_year=metrics,
        exceptions=tuple(sorted(set(exceptions))),
        checks=checks,
        source_ids=tuple(sorted(source_ids)),
    )
