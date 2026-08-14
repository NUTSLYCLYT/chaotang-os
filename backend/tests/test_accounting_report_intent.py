from dataclasses import FrozenInstanceError
from decimal import Decimal

import pytest

from app.accounting_reports import models as report_models
from app.accounting_reports.intent import detect_accounting_report_intent
from app.accounting_reports.models import (
    AccountingRequestKind,
    NormalizedLedgerRow,
    ReportIntent,
    ReportPeriod,
    SourceRef,
)
from tests.run_accounting_synthetic_acceptance import ACCOUNTING_DECREE


def test_exact_local_2025_analysis_is_controlled_accounting_analysis() -> None:
    intent = detect_accounting_report_intent(
        "我想用本地数据分析出2025年的财务数据分析一下"
    )

    assert intent.request_kind is AccountingRequestKind.ACCOUNTING_ANALYSIS
    assert intent.kind is report_models.ReportIntentKind.EXPLICIT_PERIOD
    assert intent.period == ReportPeriod(2025, 2025)


def test_synthetic_acceptance_default_decree_is_explicit_report() -> None:
    intent = detect_accounting_report_intent(ACCOUNTING_DECREE)

    assert intent.request_kind is AccountingRequestKind.ACCOUNTING_REPORT
    assert intent.kind is report_models.ReportIntentKind.EXPLICIT_PERIOD
    assert intent.period == ReportPeriod(2025, 2025)


@pytest.mark.parametrize(
    "text",
    [
        "分析2025年金融市场",
        "分析今年费用为何上升",
        "分析本地销售数据",
        "分析2025年财务数据",
    ],
)
def test_analysis_requires_local_finance_and_analysis_signals(text: str) -> None:
    intent = detect_accounting_report_intent(text)

    assert intent.request_kind is AccountingRequestKind.NOT_REQUESTED
    assert intent.requested is False


def test_explicit_report_delivery_takes_precedence_over_analysis() -> None:
    intent = detect_accounting_report_intent(
        "请用本地财务数据分析2025年情况并生成可下载Excel报表"
    )

    assert intent.request_kind is AccountingRequestKind.ACCOUNTING_REPORT
    assert intent.period == ReportPeriod(2025, 2025)


@pytest.mark.parametrize(
    "text",
    [
        "请根据本地财务数据提供2025年报表",
        "请根据本地财务数据交付2025年报告",
        "请分析本地财务数据并提供2025年报表",
        "请分析本地财务数据并交付2025年财务报告",
    ],
)
def test_controlled_report_actions_take_precedence_over_analysis(text: str) -> None:
    intent = detect_accounting_report_intent(text)

    assert intent.request_kind is AccountingRequestKind.ACCOUNTING_REPORT
    assert intent.kind is report_models.ReportIntentKind.EXPLICIT_PERIOD
    assert intent.period == ReportPeriod(2025, 2025)


@pytest.mark.parametrize(
    "text",
    [
        "请提供2025年市场情况",
        "请交付2025年年度工作报告",
        "把2025年财务报告给我看看",
        "2025年财务报告存在一些问题",
    ],
)
def test_report_nouns_without_controlled_finance_action_are_not_requests(
    text: str,
) -> None:
    assert (
        detect_accounting_report_intent(text).request_kind
        is AccountingRequestKind.NOT_REQUESTED
    )


@pytest.mark.parametrize(
    ("text", "expected_period"),
    [
        (
            "请户部会计司根据财务数据生成2020年至2025年管理层综合财务报告",
            (2020, 2025),
        ),
        ("生成2020至2025年财务报表", (2020, 2025)),
        ("请会计司生成2024年财务Excel", (2024, 2024)),
        ("请根据财务科目生成2023-2025报表", (2023, 2025)),
        ("请下载2025年现金流表格", (2025, 2025)),
    ],
)
def test_explicit_accounting_report_request_is_detected(
    text: str,
    expected_period: tuple[int, int],
) -> None:
    intent = detect_accounting_report_intent(text)

    assert intent.kind is report_models.ReportIntentKind.EXPLICIT_PERIOD
    assert intent.requested is True
    assert intent.period is not None
    assert (intent.period.start_year, intent.period.end_year) == expected_period


@pytest.mark.parametrize(
    ("text", "expected_kind", "expected_requested"),
    [
        ("读取系统内既有财务数据并生成可下载财务报表", "MISSING_PERIOD", True),
        ("整理本月户部事项并回奏", "NOT_REQUESTED", False),
        ("生成 2025-2024 年财务报表", "INVALID_PERIOD", True),
        ("请分析今年费用为何上升", "NOT_REQUESTED", False),
        ("", "NOT_REQUESTED", False),
        ("   ", "NOT_REQUESTED", False),
        ("请生成2025年管理报告", "NOT_REQUESTED", False),
        ("请分析2025年财务数据", "NOT_REQUESTED", False),
        ("请根据财务数据生成1999年报表", "INVALID_PERIOD", True),
        ("请根据财务数据生成2025年和2026年报表", "INVALID_PERIOD", True),
    ],
)
def test_accounting_report_request_classifies_missing_invalid_and_non_requests(
    text: str,
    expected_kind: str,
    expected_requested: bool,
) -> None:
    intent = detect_accounting_report_intent(text)

    assert intent.kind.name == expected_kind
    assert intent.requested is expected_requested
    assert intent.period is None


@pytest.mark.parametrize(
    ("text", "expected_kind", "expected_period"),
    [
        ("请根据财务数据生成2025年报表", "EXPLICIT_PERIOD", (2025, 2025)),
        ("请根据财务数据生成2024-2025年报表", "EXPLICIT_PERIOD", (2024, 2025)),
        ("请根据财务数据生成上一完整年度报表", "MISSING_PERIOD", None),
        ("请根据财务数据生成上一年度报表", "MISSING_PERIOD", None),
        ("请根据财务数据生成去年报表", "MISSING_PERIOD", None),
        ("请根据财务数据生成二〇二五年报表", "INVALID_PERIOD", None),
        ("请根据财务数据生成25年报表", "INVALID_PERIOD", None),
        ("请根据财务数据生成2024/2025年报表", "INVALID_PERIOD", None),
        ("请根据财务数据生成2025-1-1报表", "INVALID_PERIOD", None),
        ("请根据财务数据生成2025.01.01报表", "INVALID_PERIOD", None),
        ("请根据财务数据生成2025/1/1报表", "INVALID_PERIOD", None),
        ("请根据财务数据生成2025年1月1日报表", "INVALID_PERIOD", None),
        ("请根据财务数据生成去年及上一年度报表", "INVALID_PERIOD", None),
        ("请根据财务数据生成去年和去年报表", "INVALID_PERIOD", None),
        ("请根据财务数据生成2023、2024、2025年报表", "INVALID_PERIOD", None),
        ("请根据财务数据生成2025-2024年报表", "INVALID_PERIOD", None),
        ("请根据财务数据，生成 EXCEL 报表！", "MISSING_PERIOD", None),
    ],
)
def test_period_expression_boundaries_are_classified(
    text: str,
    expected_kind: str,
    expected_period: tuple[int, int] | None,
) -> None:
    intent = detect_accounting_report_intent(text)

    assert intent.kind.name == expected_kind
    assert intent.requested is (expected_kind != "NOT_REQUESTED")
    if expected_period is None:
        assert intent.period is None
    else:
        assert intent.period is not None
        assert (intent.period.start_year, intent.period.end_year) == expected_period


@pytest.mark.parametrize(
    "text",
    [
        "请根据财务数据生成上半年报表",
        "请根据财务数据生成下半年报表",
        "请根据财务数据生成第一季度报表",
        "请根据财务数据生成第二季度报表",
        "请根据财务数据生成一季度报表",
        "请根据财务数据生成四季度报表",
        "请根据财务数据生成年初报表",
        "请根据财务数据生成年中报表",
        "请根据财务数据生成年末报表",
        "请根据财务数据生成年底报表",
        "请根据财务数据生成去年年底报表",
    ],
)
def test_unsupported_chinese_period_tokens_are_invalid(text: str) -> None:
    intent = detect_accounting_report_intent(text)

    assert intent.kind is report_models.ReportIntentKind.INVALID_PERIOD
    assert intent.requested is True
    assert intent.period is None


@pytest.mark.parametrize(
    "text",
    [
        "请根据财务数据生成去年底报表",
        "请根据财务数据生成去年全年报表",
        "请根据财务数据生成去年初报表",
        "请根据财务数据生成去年末报表",
        "请根据财务数据生成去年上半年报表",
        "请根据财务数据生成去年第一季度报表",
        "请根据财务数据生成去年同期报表",
    ],
)
def test_approved_relative_period_with_specific_modifier_is_invalid(
    text: str,
) -> None:
    intent = detect_accounting_report_intent(text)

    assert intent.kind is report_models.ReportIntentKind.INVALID_PERIOD
    assert intent.requested is True
    assert intent.period is None


def test_bare_approved_relative_period_is_not_confused_by_non_period_word() -> None:
    intent = detect_accounting_report_intent(
        "请根据去年底稿中的财务数据生成财务报表"
    )

    assert intent.kind is report_models.ReportIntentKind.MISSING_PERIOD
    assert intent.requested is True
    assert intent.period is None


def test_report_intent_kind_controls_period_and_requested_state() -> None:
    period = ReportPeriod(2025, 2025)

    explicit = ReportIntent(report_models.ReportIntentKind.EXPLICIT_PERIOD, period)
    assert explicit.requested is True
    assert explicit.period is period

    for kind in (
        report_models.ReportIntentKind.NOT_REQUESTED,
        report_models.ReportIntentKind.MISSING_PERIOD,
        report_models.ReportIntentKind.INVALID_PERIOD,
    ):
        intent = ReportIntent(kind, None)
        assert intent.requested is (kind is not report_models.ReportIntentKind.NOT_REQUESTED)

    with pytest.raises(ValueError, match="EXPLICIT_PERIOD"):
        ReportIntent(report_models.ReportIntentKind.EXPLICIT_PERIOD, None)
    with pytest.raises(ValueError, match="EXPLICIT_PERIOD"):
        ReportIntent(report_models.ReportIntentKind.MISSING_PERIOD, period)


def test_report_period_is_frozen_and_rejects_invalid_ranges() -> None:
    period = ReportPeriod(2020, 2025)

    with pytest.raises(FrozenInstanceError):
        period.start_year = 2021  # type: ignore[misc]
    with pytest.raises(ValueError, match="2000"):
        ReportPeriod(1999, 2025)
    with pytest.raises(ValueError, match="reversed"):
        ReportPeriod(2025, 2020)


def test_normalized_rows_require_identity_source_and_finite_decimals() -> None:
    source = SourceRef(
        file_name="ledger.xlsx",
        sheet_name="余额表",
        row_number=2,
        file_sha256="a" * 64,
    )
    values = {
        "year": 2025,
        "category": "asset",
        "account_code": "1001",
        "account_name": "库存现金",
        "opening_debit": Decimal("1"),
        "opening_credit": Decimal("0"),
        "movement_debit": Decimal("2"),
        "movement_credit": Decimal("0"),
        "closing_debit": Decimal("3"),
        "closing_credit": Decimal("0"),
        "source": source,
    }

    row = NormalizedLedgerRow(**values)
    assert row.source is source

    with pytest.raises(ValueError, match="account_code"):
        NormalizedLedgerRow(**(values | {"account_code": " "}))
    with pytest.raises(ValueError, match="finite"):
        NormalizedLedgerRow(**(values | {"closing_debit": Decimal("NaN")}))
    with pytest.raises(ValueError, match="file_name"):
        SourceRef("", "余额表", 2, "a" * 64)
