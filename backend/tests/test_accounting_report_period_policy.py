from __future__ import annotations

from datetime import date
from decimal import Decimal
from inspect import Parameter, signature
from pathlib import Path
from types import SimpleNamespace

import pytest

from app import accounting_reports
from app.accounting_reports.models import (
    AccountingRequestKind,
    NormalizedLedgerRow,
    ReportIntent,
    ReportIntentKind,
    ReportPeriod,
    SourceRef,
)
from app.accounting_reports.period_policy import PeriodResolutionStatus
from app.accounting_reports.sources import AccountingSourceError


def _synthetic_row(year: int) -> NormalizedLedgerRow:
    return NormalizedLedgerRow(
        year=year,
        category="资产",
        account_code="1001",
        account_name="库存现金",
        opening_debit=Decimal("0"),
        opening_credit=Decimal("0"),
        movement_debit=Decimal("1"),
        movement_credit=Decimal("1"),
        closing_debit=Decimal("0"),
        closing_credit=Decimal("0"),
        source=SourceRef(
            file_name=f"{year}-synthetic.xlsx",
            sheet_name="余额表",
            row_number=2,
            file_sha256="a" * 64,
        ),
    )


def _policy_interfaces():
    return (
        accounting_reports.AccountingPeriodResolution,
        accounting_reports.PeriodResolutionStatus,
        accounting_reports.resolve_accounting_report_period,
    )


def test_exact_public_policy_name_has_no_legacy_alias() -> None:
    assert callable(accounting_reports.resolve_accounting_report_period)
    assert not hasattr(accounting_reports, "resolve_accounting_period")


def test_resolution_reason_defaults_to_none_for_three_argument_construction() -> None:
    result = accounting_reports.AccountingPeriodResolution(
        accounting_reports.PeriodResolutionStatus.RESOLVED,
        ReportPeriod(2025, 2025),
        True,
    )

    assert result.reason is None


def test_source_dir_is_an_explicit_required_policy_dependency() -> None:
    source_dir = signature(
        accounting_reports.resolve_accounting_report_period
    ).parameters["source_dir"]

    assert source_dir.default is Parameter.empty


def test_missing_period_uses_exactly_previous_complete_year_once(tmp_path: Path) -> None:
    resolution_type, status_type, resolve = _policy_interfaces()
    calls: list[tuple[Path, ReportPeriod]] = []
    dataset = SimpleNamespace(
        manifest=SimpleNamespace(fingerprint="a" * 64),
        ledger_rows=(_synthetic_row(2025),),
        statement_rows=(),
        subject_identity="synthetic-entity-2025",
    )

    def fake_loader(source_dir: Path, period: ReportPeriod):
        calls.append((source_dir, period))
        return dataset

    result = resolve(
        ReportIntent(ReportIntentKind.MISSING_PERIOD, None),
        reference_date=date(2026, 8, 5),
        source_dir=tmp_path,
        loader=fake_loader,
    )

    assert result == resolution_type(
        status=status_type.RESOLVED,
        period=ReportPeriod(2025, 2025),
        used_default=True,
        reason=None,
        dataset=dataset,
        source_fingerprint="a" * 64,
    )
    assert not hasattr(status_type, "READY")
    assert calls == [(tmp_path, ReportPeriod(2025, 2025))]


@pytest.mark.parametrize("failure", ["error", "empty"])
def test_missing_previous_year_needs_input_without_fallback(
    tmp_path: Path,
    failure: str,
) -> None:
    resolution_type, status_type, resolve = _policy_interfaces()
    calls: list[tuple[Path, ReportPeriod]] = []

    def fake_loader(source_dir: Path, period: ReportPeriod):
        calls.append((source_dir, period))
        if failure == "error":
            raise AccountingSourceError("source_missing")
        return ()

    result = resolve(
        ReportIntent(ReportIntentKind.MISSING_PERIOD, None),
        reference_date=date(2026, 8, 5),
        source_dir=tmp_path,
        loader=fake_loader,
    )

    assert result == resolution_type(
        status=status_type.NEEDS_INPUT,
        period=ReportPeriod(2025, 2025),
        used_default=True,
        reason="previous_complete_year_unavailable",
    )
    assert calls == [(tmp_path, ReportPeriod(2025, 2025))]


@pytest.mark.parametrize(
    ("intent", "expected_status", "expected_period", "expected_reason"),
    [
        (
            ReportIntent(ReportIntentKind.INVALID_PERIOD, None),
            "NEEDS_INPUT",
            None,
            "invalid_period",
        ),
        (
            ReportIntent(ReportIntentKind.NOT_REQUESTED, None),
            "NOT_REQUESTED",
            None,
            None,
        ),
    ],
)
def test_non_requested_and_invalid_intents_never_preflight_sources(
    tmp_path: Path,
    intent: ReportIntent,
    expected_status: str,
    expected_period: ReportPeriod | None,
    expected_reason: str | None,
) -> None:
    resolution_type, status_type, resolve = _policy_interfaces()
    calls: list[tuple[Path, ReportPeriod]] = []

    def fake_loader(source_dir: Path, period: ReportPeriod):
        calls.append((source_dir, period))
        raise AssertionError("loader must not be called")

    result = resolve(
        intent,
        reference_date=date(2026, 8, 5),
        source_dir=tmp_path,
        loader=fake_loader,
    )

    assert result == resolution_type(
        status=getattr(status_type, expected_status),
        period=expected_period,
        used_default=False,
        reason=expected_reason,
    )
    assert calls == []


@pytest.mark.parametrize(
    ("used_default", "request_kind"),
    [
        (False, AccountingRequestKind.ACCOUNTING_ANALYSIS),
        (True, AccountingRequestKind.ACCOUNTING_ANALYSIS),
        (False, AccountingRequestKind.ACCOUNTING_REPORT),
        (True, AccountingRequestKind.ACCOUNTING_REPORT),
    ],
)
def test_requested_period_preflights_once_and_retains_dataset(
    tmp_path: Path,
    used_default: bool,
    request_kind: AccountingRequestKind,
) -> None:
    period = ReportPeriod(2025, 2025)
    intent = ReportIntent(
        ReportIntentKind.MISSING_PERIOD if used_default else ReportIntentKind.EXPLICIT_PERIOD,
        None if used_default else period,
        request_kind,
    )
    dataset = SimpleNamespace(
        manifest=SimpleNamespace(fingerprint="a" * 64),
        subject_identity="synthetic-entity-2025",
    )
    calls: list[tuple[Path, ReportPeriod]] = []

    def preflight(source_dir: Path, requested_period: ReportPeriod):
        calls.append((source_dir, requested_period))
        return dataset

    result = accounting_reports.resolve_accounting_report_period(
        intent,
        reference_date=date(2026, 8, 5),
        source_dir=tmp_path,
        loader=preflight,
    )

    assert result.status is PeriodResolutionStatus.RESOLVED
    assert result.period == period
    assert result.dataset is dataset
    assert result.source_fingerprint == "a" * 64
    assert calls == [(tmp_path, period)]


@pytest.mark.parametrize("subject_identity", [None, "", "   ", ("entity-a", "entity-b")])
def test_schema_valid_dataset_without_one_explicit_subject_needs_input(
    tmp_path: Path,
    subject_identity: object,
) -> None:
    dataset = SimpleNamespace(
        manifest=SimpleNamespace(
            fingerprint="b" * 64,
            files=(SimpleNamespace(basename="guessed-entity-2025.xlsx"),),
        ),
        ledger_rows=(_synthetic_row(2025),),
        statement_rows=(),
        subject_identity=subject_identity,
    )

    result = accounting_reports.resolve_accounting_report_period(
        ReportIntent(
            ReportIntentKind.EXPLICIT_PERIOD,
            ReportPeriod(2025, 2025),
            AccountingRequestKind.ACCOUNTING_ANALYSIS,
        ),
        reference_date=date(2026, 8, 5),
        source_dir=tmp_path,
        loader=lambda _source_dir, _period: dataset,
    )

    assert result.status is PeriodResolutionStatus.NEEDS_INPUT
    assert result.period == ReportPeriod(2025, 2025)
    assert result.reason == "subject_identity_unresolved"
    assert result.dataset is None
    assert result.source_fingerprint is None


def test_explicit_source_error_is_deterministic_needs_input(tmp_path: Path) -> None:
    calls = 0

    def unavailable(_source_dir: Path, _period: ReportPeriod):
        nonlocal calls
        calls += 1
        raise AccountingSourceError("source_schema_invalid")

    result = accounting_reports.resolve_accounting_report_period(
        ReportIntent(
            ReportIntentKind.EXPLICIT_PERIOD,
            ReportPeriod(2025, 2025),
            AccountingRequestKind.ACCOUNTING_ANALYSIS,
        ),
        reference_date=date(2026, 8, 5),
        source_dir=tmp_path,
        loader=unavailable,
    )

    assert result.status is PeriodResolutionStatus.NEEDS_INPUT
    assert result.period == ReportPeriod(2025, 2025)
    assert result.reason == "requested_period_unavailable"
    assert calls == 1


def test_explicit_report_source_error_is_deterministic_needs_input(
    tmp_path: Path,
) -> None:
    calls = 0

    def unavailable(_source_dir: Path, _period: ReportPeriod):
        nonlocal calls
        calls += 1
        raise AccountingSourceError("source_schema_invalid")

    result = accounting_reports.resolve_accounting_report_period(
        ReportIntent(
            ReportIntentKind.EXPLICIT_PERIOD,
            ReportPeriod(2025, 2025),
            AccountingRequestKind.ACCOUNTING_REPORT,
        ),
        reference_date=date(2026, 8, 5),
        source_dir=tmp_path,
        loader=unavailable,
    )

    assert result.status is PeriodResolutionStatus.NEEDS_INPUT
    assert result.reason == "requested_period_unavailable"
    assert calls == 1


def test_unexpected_preflight_error_is_not_converted(tmp_path: Path) -> None:
    with pytest.raises(RuntimeError, match="programming defect"):
        accounting_reports.resolve_accounting_report_period(
            ReportIntent(
                ReportIntentKind.EXPLICIT_PERIOD,
                ReportPeriod(2025, 2025),
                AccountingRequestKind.ACCOUNTING_ANALYSIS,
            ),
            reference_date=date(2026, 8, 5),
            source_dir=tmp_path,
            loader=lambda _source_dir, _period: (_ for _ in ()).throw(
                RuntimeError("programming defect")
            ),
        )
