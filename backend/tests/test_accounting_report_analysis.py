from __future__ import annotations

from dataclasses import replace
from decimal import Decimal

from app.accounting_reports.analysis import (
    MATERIAL_MOVEMENT_THRESHOLD,
    analyze_ledger,
    safe_growth,
)
from app.accounting_reports.models import NormalizedLedgerRow, ReportPeriod, SourceRef


def test_analyze_ledger_is_exported_from_accounting_reports_package() -> None:
    from app.accounting_reports import analyze_ledger as exported

    assert exported is analyze_ledger


def _row(
    year: int,
    category: str,
    code: str,
    *,
    opening_debit: str = "0",
    opening_credit: str = "0",
    movement_debit: str = "0",
    movement_credit: str = "0",
    closing_debit: str = "0",
    closing_credit: str = "0",
) -> NormalizedLedgerRow:
    return NormalizedLedgerRow(
        year=year,
        category=category,
        account_code=code,
        account_name=f"account-{code}",
        opening_debit=Decimal(opening_debit),
        opening_credit=Decimal(opening_credit),
        movement_debit=Decimal(movement_debit),
        movement_credit=Decimal(movement_credit),
        closing_debit=Decimal(closing_debit),
        closing_credit=Decimal(closing_credit),
        source=SourceRef(
            file_name=f"ledger-{year}.xlsx",
            sheet_name="Trial Balance",
            row_number=int(code[-1]) + 1,
            file_sha256=str(year) * 16,
        ),
    )


def _balanced_rows() -> tuple[NormalizedLedgerRow, ...]:
    return (
        _row(
            2024,
            "asset",
            "1001",
            movement_debit="1200",
            closing_debit="1000",
        ),
        _row(
            2024,
            "liability",
            "2001",
            movement_credit="400",
            closing_credit="400",
        ),
        _row(
            2024,
            "equity",
            "3001",
            movement_credit="600",
            closing_credit="600",
        ),
        _row(
            2024,
            "revenue",
            "4001",
            movement_credit="500",
            closing_credit="500",
        ),
        _row(
            2024,
            "cost",
            "5001",
            movement_debit="200",
            closing_debit="200",
        ),
        _row(
            2024,
            "expense",
            "6001",
            movement_debit="100",
            closing_debit="100",
        ),
        _row(
            2025,
            "asset",
            "1001",
            opening_debit="1000",
            movement_debit="440",
            closing_debit="1200",
        ),
        _row(
            2025,
            "liability",
            "2001",
            opening_credit="400",
            movement_credit="100",
            closing_credit="500",
        ),
        _row(
            2025,
            "equity",
            "3001",
            opening_credit="600",
            movement_credit="100",
            closing_credit="700",
        ),
        _row(
            2025,
            "revenue",
            "4001",
            opening_credit="500",
            movement_credit="600",
            closing_credit="1100",
        ),
        _row(
            2025,
            "cost",
            "5001",
            opening_debit="200",
            movement_debit="240",
            closing_debit="440",
        ),
        _row(
            2025,
            "expense",
            "6001",
            opening_debit="100",
            movement_debit="120",
            closing_debit="220",
        ),
    )


def test_analyze_ledger_calculates_exact_metrics_and_required_checks() -> None:
    summary = analyze_ledger(_balanced_rows(), ReportPeriod(2024, 2025))

    assert summary.metrics_by_year[2025] == {
        "assets": Decimal("1200"),
        "liabilities": Decimal("500"),
        "equity": Decimal("700"),
        "revenue": Decimal("600"),
        "cost": Decimal("240"),
        "expense": Decimal("120"),
        "profit": Decimal("240"),
        "profit_yoy_amount": Decimal("40"),
        "profit_yoy_rate": Decimal("0.2"),
    }
    assert MATERIAL_MOVEMENT_THRESHOLD == Decimal("0.20")
    assert summary.overall_status == "PASS"
    assert {check.name for check in summary.checks} == {
        "coverage",
        "mapping",
        "balance_sheet_equation",
        "opening_continuity",
        "movement_balance",
        "account_directions",
    }
    assert all(check.status == "PASS" for check in summary.checks)


def test_zero_denominator_growth_is_none() -> None:
    assert safe_growth(Decimal("10"), Decimal("0")) is None


def test_empty_rows_fail_coverage_without_zero_value_false_green() -> None:
    summary = analyze_ledger((), ReportPeriod(2024, 2025))

    coverage = next(check for check in summary.checks if check.name == "coverage")
    assert coverage.status == "FAIL"
    assert summary.overall_status == "FAIL"
    assert all(
        value is None
        for year_metrics in summary.metrics_by_year.values()
        for value in year_metrics.values()
    )


def test_missing_middle_year_fails_coverage_and_has_none_metrics() -> None:
    rows = tuple(
        replace(row, year=2026, source=replace(row.source, file_name="ledger-2026.xlsx"))
        if row.year == 2025
        else row
        for row in _balanced_rows()
    )

    summary = analyze_ledger(rows, ReportPeriod(2024, 2026))

    coverage = next(check for check in summary.checks if check.name == "coverage")
    assert coverage.status == "FAIL"
    assert all(value is None for value in summary.metrics_by_year[2025].values())


def test_unmapped_positive_account_fails_mapping_completeness() -> None:
    rows = (
        _row(2024, "unknown", "9001", closing_debit="10"),
    )

    summary = analyze_ledger(rows, ReportPeriod(2024, 2024))

    mapping = next(check for check in summary.checks if check.name == "mapping")
    assert mapping.status == "FAIL"
    assert summary.overall_status == "FAIL"


def test_out_of_period_row_is_rejected_by_coverage_without_key_error() -> None:
    rows = _balanced_rows() + (
        _row(2026, "asset", "1001", closing_debit="1"),
    )

    summary = analyze_ledger(rows, ReportPeriod(2024, 2025))

    coverage = next(check for check in summary.checks if check.name == "coverage")
    assert coverage.status == "FAIL"
    assert any(item.startswith("period_mismatch:2026:") for item in summary.exceptions)


def test_first_year_yoy_schema_is_explicitly_none() -> None:
    summary = analyze_ledger(_balanced_rows(), ReportPeriod(2024, 2025))

    assert summary.metrics_by_year[2024]["profit_yoy_amount"] is None
    assert summary.metrics_by_year[2024]["profit_yoy_rate"] is None


def test_opening_continuity_fails_when_current_account_has_no_prior_row() -> None:
    rows = tuple(
        replace(row, account_code="1002")
        if row.year == 2025 and row.account_code == "1001"
        else row
        for row in _balanced_rows()
    )

    summary = analyze_ledger(rows, ReportPeriod(2024, 2025))

    continuity = next(
        check for check in summary.checks if check.name == "opening_continuity"
    )
    assert continuity.status == "FAIL"


def test_anomalies_unknown_mapping_and_failures_are_named() -> None:
    rows = _balanced_rows() + (
        _row(
            2025,
            "unknown",
            "9001",
            opening_debit="-1",
            movement_debit="-1",
            closing_debit="-2",
        ),
    )

    summary = analyze_ledger(rows, ReportPeriod(2024, 2025))

    assert summary.overall_status == "FAIL"
    assert any(item.startswith("unmapped_account:") for item in summary.exceptions)
    assert any(item.startswith("negative_amount:") for item in summary.exceptions)
    assert any(check.status == "FAIL" for check in summary.checks)


def test_model_payload_is_bounded_and_uses_only_safe_source_ids() -> None:
    summary = analyze_ledger(_balanced_rows(), ReportPeriod(2024, 2025))

    payload = summary.to_model_payload()

    assert set(payload) == {"period", "metrics", "exceptions", "checks", "source_ids"}
    assert payload["period"] == {"start_year": 2024, "end_year": 2025}
    rendered = repr(payload)
    for forbidden in (
        "raw_rows",
        "account-",
        "Trial Balance",
        "ledger-2024.xlsx",
        "ledger-2025.xlsx",
    ):
        assert forbidden not in rendered
    assert payload["source_ids"] == sorted(payload["source_ids"])
    assert all(source_id.startswith("src_") for source_id in payload["source_ids"])
