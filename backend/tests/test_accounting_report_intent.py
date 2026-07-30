from dataclasses import FrozenInstanceError
from decimal import Decimal

import pytest

from app.accounting_reports.intent import detect_accounting_report_intent
from app.accounting_reports.models import (
    NormalizedLedgerRow,
    ReportPeriod,
    SourceRef,
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

    assert intent.requested is True
    assert intent.period is not None
    assert (intent.period.start_year, intent.period.end_year) == expected_period


@pytest.mark.parametrize(
    "text",
    [
        "请分析今年费用为何上升",
        "",
        "   ",
        "请生成2025年管理报告",
        "请分析2025年财务数据",
        "请根据财务数据生成2025年至2020年报表",
        "请根据财务数据生成1999年报表",
        "请根据财务数据生成2025年和2026年报表",
    ],
)
def test_non_explicit_or_invalid_request_is_rejected(text: str) -> None:
    intent = detect_accounting_report_intent(text)

    assert intent.requested is False
    assert intent.period is None


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
