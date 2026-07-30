from __future__ import annotations

from decimal import Decimal
from pathlib import Path

import pytest
from openpyxl import Workbook

from app.accounting_reports.models import ReportPeriod
from app.accounting_reports.sources import AccountingSourceError, load_ledger_rows

HEADERS = [
    "科目类别",
    "科目编码",
    "科目名称",
    "期初借方",
    "期初贷方",
    "本期借方",
    "本期贷方",
    "期末借方",
    "期末贷方",
]


def _write_xlsx(path: Path, rows: list[list[object]]) -> None:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "余额表"
    sheet.append(HEADERS)
    for row in rows:
        sheet.append(row)
    workbook.save(path)
    workbook.close()


def test_xlsx_rows_preserve_codes_normalize_amounts_and_retain_source(
    tmp_path: Path,
) -> None:
    source = tmp_path / "2024-余额表.xlsx"
    _write_xlsx(
        source,
        [["资产", "1001.01", "库存现金", None, "", "12.50", 12.5, 25, "0"]],
    )

    rows = load_ledger_rows(tmp_path, ReportPeriod(2024, 2024))

    assert len(rows) == 1
    row = rows[0]
    assert row.account_code == "1001.01"
    assert row.opening_debit == row.opening_credit == Decimal("0")
    assert row.movement_debit == row.movement_credit == Decimal("12.5")
    assert row.closing_debit == Decimal("25")
    assert row.source.file_name == source.name
    assert row.source.sheet_name == "余额表"
    assert row.source.row_number == 2
    assert len(row.source.file_sha256) == 64


def test_xls_adapter_normalizes_the_same_rows_as_xlsx(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    xlsx_dir = tmp_path / "xlsx"
    xls_dir = tmp_path / "xls"
    xlsx_dir.mkdir()
    xls_dir.mkdir()
    _write_xlsx(
        xlsx_dir / "2024-余额表.xlsx",
        [["资产", "1001.01", "库存现金", "", 0, "12.50", 12.5, 25, None]],
    )
    legacy_path = xls_dir / "2024-财务报表.xls"
    legacy_path.write_bytes(b"synthetic legacy workbook")

    from app.accounting_reports import sources

    monkeypatch.setattr(
        sources,
        "_read_xls_sheets",
        lambda path: (
            (
                "余额表",
                [
                    HEADERS,
                    ["资产", "1001.01", "库存现金", "", 0, "12.50", 12.5, 25, None],
                ],
            ),
        ),
    )

    xlsx_row = load_ledger_rows(xlsx_dir, ReportPeriod(2024, 2024))[0]
    xls_row = load_ledger_rows(xls_dir, ReportPeriod(2024, 2024))[0]

    assert (
        xls_row.year,
        xls_row.category,
        xls_row.account_code,
        xls_row.account_name,
        xls_row.opening_debit,
        xls_row.opening_credit,
        xls_row.movement_debit,
        xls_row.movement_credit,
        xls_row.closing_debit,
        xls_row.closing_credit,
    ) == (
        xlsx_row.year,
        xlsx_row.category,
        xlsx_row.account_code,
        xlsx_row.account_name,
        xlsx_row.opening_debit,
        xlsx_row.opening_credit,
        xlsx_row.movement_debit,
        xlsx_row.movement_credit,
        xlsx_row.closing_debit,
        xlsx_row.closing_credit,
    )


@pytest.mark.parametrize(
    ("setup", "code"),
    [
        ("missing", "source_missing"),
        ("unsupported", "source_format_unsupported"),
        ("bad_schema", "source_schema_invalid"),
        ("duplicate", "source_period_conflict"),
        ("wrong_period", "source_period_conflict"),
    ],
)
def test_invalid_sources_fail_closed(
    tmp_path: Path,
    setup: str,
    code: str,
) -> None:
    if setup == "unsupported":
        (tmp_path / "2024-ledger.csv").write_text("not approved", encoding="utf-8")
    elif setup == "bad_schema":
        _write_xlsx(tmp_path / "2024-余额表.xlsx", [["资产"]])
    elif setup == "duplicate":
        _write_xlsx(tmp_path / "2024-a.xlsx", [])
        _write_xlsx(tmp_path / "2024-b.xlsx", [])
    elif setup == "wrong_period":
        _write_xlsx(tmp_path / "2023-余额表.xlsx", [])

    with pytest.raises(AccountingSourceError) as raised:
        load_ledger_rows(tmp_path, ReportPeriod(2024, 2024))

    assert raised.value.code == code
    assert str(raised.value).split(":")[0] == code


def test_candidate_outside_approved_root_is_rejected(tmp_path: Path) -> None:
    approved = tmp_path / "approved"
    outside = tmp_path / "outside"
    approved.mkdir()
    outside.mkdir()
    target = outside / "2024-余额表.xlsx"
    _write_xlsx(
        target,
        [["资产", "1001", "库存现金", 0, 0, 0, 0, 0, 0]],
    )

    from app.accounting_reports import sources

    with pytest.raises(AccountingSourceError) as raised:
        sources._load_candidate((target, 2024), approved.resolve())

    assert raised.value.code == "source_path_invalid"


@pytest.mark.parametrize("failure_location", ["sheets", "rows"])
def test_reader_iteration_error_is_sanitized(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    failure_location: str,
) -> None:
    source = tmp_path / "2024-财务报表.xls"
    source.write_bytes(b"synthetic legacy workbook")
    secret = str(tmp_path / "private" / "raw-value")

    from app.accounting_reports import sources

    def failing_rows():
        yield HEADERS
        raise RuntimeError(secret)

    def failing_reader(path: Path):
        if failure_location == "rows":
            yield "余额表", failing_rows()
        else:
            yield "余额表", iter([HEADERS])
            raise RuntimeError(secret)

    monkeypatch.setattr(sources, "_read_xls_sheets", failing_reader)

    with pytest.raises(AccountingSourceError) as raised:
        load_ledger_rows(tmp_path, ReportPeriod(2024, 2024))

    assert raised.value.code == "source_schema_invalid"
    assert str(raised.value) == f"source_schema_invalid: {source.name}"
    assert secret not in str(raised.value)


def test_directory_enumeration_error_is_sanitized(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    secret = str(tmp_path / "private")

    def failing_iterdir(path: Path):
        raise OSError(secret)

    monkeypatch.setattr(Path, "iterdir", failing_iterdir)

    with pytest.raises(AccountingSourceError) as raised:
        load_ledger_rows(tmp_path, ReportPeriod(2024, 2024))

    assert raised.value.code == "source_path_invalid"
    assert str(raised.value) == f"source_path_invalid: {tmp_path.name}"
    assert secret not in str(raised.value)


def test_public_loader_rejects_symlink_escape(tmp_path: Path) -> None:
    approved = tmp_path / "approved"
    outside = tmp_path / "outside"
    approved.mkdir()
    outside.mkdir()
    target = outside / "2024-余额表.xlsx"
    _write_xlsx(
        target,
        [["资产", "1001", "库存现金", 0, 0, 0, 0, 0, 0]],
    )
    link = approved / target.name
    try:
        link.symlink_to(target)
    except OSError:
        pytest.skip("symlink creation is unavailable on this platform")

    with pytest.raises(AccountingSourceError) as raised:
        load_ledger_rows(approved, ReportPeriod(2024, 2024))

    assert raised.value.code == "source_path_invalid"
    assert str(raised.value) == f"source_path_invalid: {link.name}"
