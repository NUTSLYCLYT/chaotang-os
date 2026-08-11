from __future__ import annotations

import json
import os
import struct
import subprocess
import sys
from decimal import Decimal
from pathlib import Path

import pytest
import xlrd
from openpyxl import Workbook

from app.accounting_reports.models import (
    FinancialStatementRow,
    NormalizedLedgerRow,
    ReportPeriod,
    SourceRef,
)
from app.accounting_reports.source_adapters import (
    _reject_biff_formulas,
    inspect_accounting_source_dimensions,
    load_accounting_dataset,
    load_balance_ledger,
    load_financial_statements,
)
from app.accounting_reports.source_manifest import (
    BALANCE_LEDGER_V1,
    FINANCIAL_STATEMENTS_V1,
    AccountingSourceFile,
    SourceRole,
    build_accounting_source_manifest,
)
from app.accounting_reports.sources import AccountingSourceError

BALANCE_ROW_7 = [
    None,
    "科目类别",
    "科目编码",
    "科目名称",
    "期初余额",
    None,
    "本期发生",
    None,
    "期末余额",
    None,
]
BALANCE_ROW_8 = [None, None, None, None, "借方", "贷方", "借方", "贷方", "借方", "贷方"]


def _compound_biff_workbook(record: bytes, *, with_vba_storage: bool = False) -> bytes:
    """Build a minimal CFB file containing one real BIFF8 Workbook stream."""
    free = 0xFFFFFFFF
    end = 0xFFFFFFFE
    fat_sector = 0xFFFFFFFD
    no_stream = 0xFFFFFFFF
    header = bytearray(512)
    header[:8] = bytes.fromhex("d0cf11e0a1b11ae1")
    struct.pack_into("<HHHH", header, 24, 0x003E, 3, 0xFFFE, 9)
    struct.pack_into("<H", header, 32, 6)
    struct.pack_into("<IIIIIIIII", header, 40, 0, 1, 0, 0, 4096, end, 0, end, 0)
    struct.pack_into("<I", header, 76, 9)
    for offset in range(80, 512, 4):
        struct.pack_into("<I", header, offset, free)

    def directory_entry(
        name: str,
        entry_type: int,
        child: int,
        start: int,
        size: int,
        *,
        right: int = no_stream,
    ) -> bytes:
        entry = bytearray(128)
        encoded = (name + "\0").encode("utf-16le")
        entry[: len(encoded)] = encoded
        struct.pack_into(
            "<HBBIII",
            entry,
            64,
            len(encoded),
            entry_type,
            1,
            no_stream,
            right,
            child,
        )
        struct.pack_into("<IQ", entry, 116, start, size)
        return bytes(entry)

    directory = bytearray(512)
    directory[:128] = directory_entry("Root Entry", 5, 1, end, 0)
    directory[128:256] = directory_entry(
        "Workbook", 2, no_stream, 1, 4096, right=2 if with_vba_storage else no_stream
    )
    if with_vba_storage:
        directory[256:384] = directory_entry("VBA", 1, no_stream, end, 0)
    bof = struct.pack(
        "<HHHHHHII",
        0x0809,
        16,
        0x0600,
        0x0005,
        0x0DBB,
        0x07CC,
        0x00000041,
        0x00000006,
    )
    eof = struct.pack("<HH", 0x000A, 0)
    workbook_stream = (bof + record + eof).ljust(4096, b"\0")
    fat = [end, 2, 3, 4, 5, 6, 7, 8, end, fat_sector] + [free] * 118
    return bytes(header + directory + workbook_stream + struct.pack("<128I", *fat))


def _biff_formula_record() -> bytes:
    payload = (
        struct.pack("<HHH", 1, 2, 0)
        + struct.pack("<d", 2.0)
        + struct.pack("<HIH", 0, 0, 3)
        + bytes((0x1E, 1, 0))
    )
    return struct.pack("<HH", 0x0006, len(payload)) + payload


def _biff_number_record() -> bytes:
    payload = struct.pack("<HHHd", 1, 2, 0, 2.0)
    return struct.pack("<HH", 0x0203, len(payload)) + payload


def _biff_external_record(record_id: int) -> bytes:
    return struct.pack("<HHH", record_id, 2, 0)


def _bound_sheet_formula_records() -> bytes:
    name = b"Sheet1"
    bounds_payload_size = 8 + len(name)
    sheet_offset = 20 + 4 + bounds_payload_size + 4
    bounds_payload = struct.pack("<IBBB", sheet_offset, 0, 0, len(name)) + b"\0" + name
    bounds = struct.pack("<HH", 0x0085, len(bounds_payload)) + bounds_payload
    eof = struct.pack("<HH", 0x000A, 0)
    sheet_bof = struct.pack(
        "<HHHHHHII", 0x0809, 16, 0x0600, 0x0010, 0x0DBB, 0x07CC, 0x41, 0x06
    )
    return bounds + eof + sheet_bof + _biff_formula_record()


def test_real_biff_formula_record_is_rejected_before_xlrd_parsing() -> None:
    with pytest.raises(AccountingSourceError, match="^source_schema_invalid$"):
        _reject_biff_formulas(_compound_biff_workbook(_biff_formula_record()))


def test_real_biff_constant_record_remains_allowed() -> None:
    _reject_biff_formulas(_compound_biff_workbook(_biff_number_record()))


def test_real_ole_vba_storage_is_rejected() -> None:
    from app.accounting_reports.source_adapters import _reject_ole_macros

    with pytest.raises(AccountingSourceError, match="^source_schema_invalid$"):
        _reject_ole_macros(
            _compound_biff_workbook(_biff_number_record(), with_vba_storage=True)
        )


def test_biff_formula_positions_preserve_formula_source_coordinates() -> None:
    from app.accounting_reports.source_adapters import _biff_formula_positions

    assert _biff_formula_positions(_compound_biff_workbook(_bound_sheet_formula_records())) == (
        ("Sheet1", 2, 3, "biff:1e0100"),
    )


def test_xls_probe_marks_cached_formula_value_as_formula_source(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.accounting_reports import source_adapters

    source = _compound_biff_workbook(_bound_sheet_formula_records())

    class CellStub:
        ctype = xlrd.XL_CELL_NUMBER
        value = 2.0

    class SheetStub:
        name = "Sheet1"
        nrows = 2
        ncols = 3
        merged_cells = ()

        def cell(self, _row: int, _column: int) -> CellStub:
            return CellStub()

    class WorkbookStub:
        def sheets(self):
            return (SheetStub(),)

        def release_resources(self) -> None:
            pass

    monkeypatch.setattr(source_adapters, "_open_xls", lambda *_args, **_kwargs: WorkbookStub())

    sheets = source_adapters._read_xls_probe_sheets(source)

    assert sheets[0][2][1][2] == "formula"
    assert sheets[0][1][1][2] == "biff:1e0100"
    assert sheets[0][1][1][2] != 2.0


@pytest.mark.parametrize("record_id", [0x01AE, 0x0017, 0x0023])
def test_xls_probe_rejects_biff_external_reference_records_before_xlrd(
    record_id: int, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.accounting_reports import source_adapters

    source = _compound_biff_workbook(_biff_external_record(record_id))
    monkeypatch.setattr(
        source_adapters,
        "_open_xls",
        lambda *_args, **_kwargs: pytest.fail("external BIFF must fail before xlrd"),
    )

    with pytest.raises(AccountingSourceError, match="^source_schema_invalid$"):
        source_adapters._read_xls_probe_sheets(source)


def test_xls_probe_preserves_xlrd_types_and_merged_cells(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.accounting_reports import source_adapters

    ctypes = (
        xlrd.XL_CELL_EMPTY,
        xlrd.XL_CELL_TEXT,
        xlrd.XL_CELL_NUMBER,
        xlrd.XL_CELL_DATE,
        xlrd.XL_CELL_BOOLEAN,
        xlrd.XL_CELL_ERROR,
        xlrd.XL_CELL_BLANK,
    )

    class CellStub:
        def __init__(self, ctype: int, value: object) -> None:
            self.ctype = ctype
            self.value = value

    class SheetStub:
        name = "Typed"
        nrows = 1
        ncols = len(ctypes)
        merged_cells = ((0, 1, 0, 2),)

        def cell(self, row: int, column: int) -> CellStub:
            return CellStub(ctypes[column], column)

    class WorkbookStub:
        nsheets = 1

        def sheets(self):
            return (SheetStub(),)

        def release_resources(self) -> None:
            pass

    monkeypatch.setattr(source_adapters, "_biff_formula_positions", lambda _source: ())
    monkeypatch.setattr(
        source_adapters, "_reject_biff_external_references", lambda _source: None
    )
    monkeypatch.setattr(source_adapters, "_open_xls", lambda *_args, **_kwargs: WorkbookStub())

    sheet = source_adapters._read_xls_probe_sheets(b"fixture")[0]

    assert sheet[2][0] == ("empty", "string", "number", "date", "boolean", "error", "blank")
    assert sheet[3] == ((1, 1, 1, 2),)


@pytest.mark.parametrize(
    "evidence",
    [
        (
            ("Typed", 1, 1, "biff:1e0100"),
            ("Typed", 1, 1, "biff:1e0200"),
        ),
        (("Typed", 99, 1, "biff:1e0100"),),
        (("Missing", 1, 1, "biff:1e0100"),),
    ],
)
def test_xls_probe_requires_every_formula_evidence_key_exactly_once(
    evidence: tuple[tuple[str, int, int, str], ...],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.accounting_reports import source_adapters

    class CellStub:
        ctype = xlrd.XL_CELL_NUMBER
        value = 1.0

    class SheetStub:
        name = "Typed"
        nrows = 1
        ncols = 1
        merged_cells = ()

        def cell(self, _row: int, _column: int) -> CellStub:
            return CellStub()

    class WorkbookStub:
        def sheets(self):
            return (SheetStub(),)

        def release_resources(self) -> None:
            pass

    monkeypatch.setattr(source_adapters, "_reject_biff_external_references", lambda _source: None)
    monkeypatch.setattr(source_adapters, "_biff_formula_positions", lambda _source: evidence)
    monkeypatch.setattr(source_adapters, "_open_xls", lambda *_args, **_kwargs: WorkbookStub())

    with pytest.raises(AccountingSourceError, match="^source_schema_invalid$"):
        source_adapters._read_xls_probe_sheets(b"fixture")


def test_xls_probe_rejects_duplicate_sheet_names(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.accounting_reports import source_adapters

    class SheetStub:
        name = "Duplicate"
        nrows = 0
        ncols = 0
        merged_cells = ()

    class WorkbookStub:
        def sheets(self):
            return (SheetStub(), SheetStub())

        def release_resources(self) -> None:
            pass

    monkeypatch.setattr(source_adapters, "_reject_biff_external_references", lambda _source: None)
    monkeypatch.setattr(source_adapters, "_biff_formula_positions", lambda _source: ())
    monkeypatch.setattr(source_adapters, "_open_xls", lambda *_args, **_kwargs: WorkbookStub())

    with pytest.raises(AccountingSourceError, match="^source_schema_invalid$"):
        source_adapters._read_xls_probe_sheets(b"fixture")


@pytest.mark.parametrize("failure_stage", ["cell", "merged"])
def test_xls_probe_sanitizes_parser_and_metadata_exceptions(
    failure_stage: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.accounting_reports import source_adapters

    class SheetStub:
        name = "Sheet1"
        nrows = 1
        ncols = 1

        @property
        def merged_cells(self):
            if failure_stage == "merged":
                raise RuntimeError("SECRET merged path/data")
            return ()

        def cell(self, _row: int, _column: int):
            if failure_stage == "cell":
                raise RuntimeError("SECRET cell path/data")
            return type("Cell", (), {"ctype": xlrd.XL_CELL_NUMBER, "value": 1.0})()

    class WorkbookStub:
        released = False

        def sheets(self):
            return (SheetStub(),)

        def release_resources(self) -> None:
            self.released = True

    workbook = WorkbookStub()
    monkeypatch.setattr(source_adapters, "_reject_biff_external_references", lambda _source: None)
    monkeypatch.setattr(source_adapters, "_biff_formula_positions", lambda _source: ())
    monkeypatch.setattr(source_adapters, "_open_xls", lambda *_args, **_kwargs: workbook)

    with pytest.raises(AccountingSourceError) as caught:
        source_adapters._read_xls_probe_sheets(b"fixture")

    rendered = f"{caught.value} {caught.value!r}"
    assert str(caught.value) == "source_schema_invalid"
    assert "SECRET" not in rendered
    assert workbook.released is True


@pytest.mark.parametrize(
    ("failure_stage", "release_fails"),
    [
        ("nsheets", False),
        ("sheets", False),
        ("release", True),
        ("cell_and_release", True),
    ],
)
def test_xls_probe_protects_opened_workbook_lifecycle(
    failure_stage: str,
    release_fails: bool,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.accounting_reports import source_adapters

    class CellStub:
        ctype = xlrd.XL_CELL_NUMBER
        value = 1.0

    class SheetStub:
        name = "Sheet1"
        nrows = 1
        ncols = 1
        merged_cells = ()

        def cell(self, _row: int, _column: int) -> CellStub:
            if failure_stage == "cell_and_release":
                raise RuntimeError("SECRET cell")
            return CellStub()

    class WorkbookStub:
        release_attempted = False

        @property
        def nsheets(self):
            if failure_stage == "nsheets":
                raise RuntimeError("SECRET nsheets")
            return 1

        def sheets(self):
            if failure_stage == "sheets":
                raise RuntimeError("SECRET sheets")
            return (SheetStub(),)

        def release_resources(self) -> None:
            self.release_attempted = True
            if release_fails:
                raise RuntimeError("SECRET release")

    workbook = WorkbookStub()
    monkeypatch.setattr(source_adapters, "_reject_ole_macros", lambda _source: None)
    monkeypatch.setattr(source_adapters, "_reject_biff_external_references", lambda _source: None)
    monkeypatch.setattr(source_adapters, "_biff_formula_positions", lambda _source: ())
    monkeypatch.setattr(
        source_adapters.xlrd,
        "open_workbook",
        lambda **_kwargs: workbook,
    )

    if failure_stage == "release":
        result = source_adapters._read_xls_probe_sheets(b"fixture")
        assert result[0][0] == "Sheet1"
    else:
        with pytest.raises(AccountingSourceError) as caught:
            source_adapters._read_xls_probe_sheets(b"fixture")
        rendered = f"{caught.value} {caught.value!r}"
        assert str(caught.value) == "source_schema_invalid"
        assert "SECRET" not in rendered
    assert workbook.release_attempted is True


@pytest.mark.parametrize("changing_dimension", ["nrows", "ncols"])
def test_xls_probe_revalidates_snapshot_dimensions_before_cells(
    changing_dimension: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.accounting_reports import source_adapters

    class DynamicSheet:
        name = "Sheet1"
        dimension_reads = {"nrows": 0, "ncols": 0}
        cell_called = False
        merged_cells = ()

        @property
        def nrows(self) -> int:
            self.dimension_reads["nrows"] += 1
            if changing_dimension == "nrows" and self.dimension_reads["nrows"] > 1:
                return source_adapters.MAX_PROBE_XLS_ROWS + 1
            return 1

        @property
        def ncols(self) -> int:
            self.dimension_reads["ncols"] += 1
            if changing_dimension == "ncols" and self.dimension_reads["ncols"] > 1:
                return source_adapters.MAX_PROBE_XLS_COLUMNS + 1
            return 1

        def cell(self, _row: int, _column: int):
            self.cell_called = True
            pytest.fail("changed XLS dimensions must be rejected before cell materialization")

    class WorkbookStub:
        nsheets = 1
        release_attempted = False

        def __init__(self) -> None:
            self.sheet = DynamicSheet()

        def sheets(self):
            return (self.sheet,)

        def release_resources(self) -> None:
            self.release_attempted = True
            raise RuntimeError("SECRET release")

    workbook = WorkbookStub()
    monkeypatch.setattr(source_adapters, "_reject_ole_macros", lambda _source: None)
    monkeypatch.setattr(source_adapters, "_reject_biff_external_references", lambda _source: None)
    monkeypatch.setattr(source_adapters, "_biff_formula_positions", lambda _source: ())
    monkeypatch.setattr(source_adapters.xlrd, "open_workbook", lambda **_kwargs: workbook)

    with pytest.raises(AccountingSourceError) as caught:
        source_adapters._read_xls_probe_sheets(b"fixture")

    rendered = f"{caught.value} {caught.value!r}"
    assert str(caught.value) == "source_schema_invalid"
    assert "SECRET" not in rendered
    assert workbook.sheet.cell_called is False
    assert workbook.release_attempted is True


def test_xls_probe_rejects_later_sheet_growth_before_cells(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.accounting_reports import source_adapters

    class SheetStub:
        nrows = 1
        ncols = 1
        merged_cells = ()
        cell_called = False

        def __init__(self, name: str) -> None:
            self.name = name

        def cell(self, _row: int, _column: int):
            self.cell_called = True
            pytest.fail("grown XLS sheet collection must be rejected before cells")

    class WorkbookStub:
        nsheets = 1
        sheets_calls = 0
        release_attempted = False

        def __init__(self) -> None:
            self.sheet = SheetStub("Sheet1")

        def sheets(self):
            self.sheets_calls += 1
            if self.sheets_calls == 1:
                return (self.sheet,)
            return tuple(
                SheetStub(f"Sheet{index}")
                for index in range(source_adapters.MAX_PROBE_XLS_SHEETS + 1)
            )

        def release_resources(self) -> None:
            self.release_attempted = True
            raise RuntimeError("SECRET release")

    workbook = WorkbookStub()
    monkeypatch.setattr(source_adapters, "_reject_ole_macros", lambda _source: None)
    monkeypatch.setattr(source_adapters, "_reject_biff_external_references", lambda _source: None)
    monkeypatch.setattr(source_adapters, "_biff_formula_positions", lambda _source: ())
    monkeypatch.setattr(source_adapters.xlrd, "open_workbook", lambda **_kwargs: workbook)

    with pytest.raises(AccountingSourceError) as caught:
        source_adapters._read_xls_probe_sheets(b"fixture")

    rendered = f"{caught.value} {caught.value!r}"
    assert str(caught.value) == "source_schema_invalid"
    assert "SECRET" not in rendered
    assert workbook.sheet.cell_called is False
    assert workbook.release_attempted is True


@pytest.mark.parametrize("merge_hazard", ["dynamic", "too_many", "out_of_bounds"])
def test_xls_probe_freezes_and_validates_merges_before_cells(
    merge_hazard: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.accounting_reports import source_adapters

    class SheetStub:
        name = "Sheet1"
        nrows = 1
        ncols = 1
        cell_called = False

        @property
        def merged_cells(self):
            if merge_hazard == "dynamic":
                raise RuntimeError("SECRET merge access")
            if merge_hazard == "too_many":
                return ((0, 1, 0, 1),) * (
                    source_adapters.MAX_MERGED_RANGES_PER_SHEET + 1
                )
            return ((0, 2, 0, 1),)

        def cell(self, _row: int, _column: int):
            self.cell_called = True
            pytest.fail("invalid XLS merges must be rejected before cells")

    class WorkbookStub:
        nsheets = 1
        release_attempted = False

        def __init__(self) -> None:
            self.sheet = SheetStub()

        def sheets(self):
            return (self.sheet,)

        def release_resources(self) -> None:
            self.release_attempted = True
            raise RuntimeError("SECRET release")

    workbook = WorkbookStub()
    monkeypatch.setattr(source_adapters, "_reject_ole_macros", lambda _source: None)
    monkeypatch.setattr(source_adapters, "_reject_biff_external_references", lambda _source: None)
    monkeypatch.setattr(source_adapters, "_biff_formula_positions", lambda _source: ())
    monkeypatch.setattr(source_adapters.xlrd, "open_workbook", lambda **_kwargs: workbook)

    with pytest.raises(AccountingSourceError) as caught:
        source_adapters._read_xls_probe_sheets(b"fixture")

    rendered = f"{caught.value} {caught.value!r}"
    assert str(caught.value) == "source_schema_invalid"
    assert "SECRET" not in rendered
    assert workbook.sheet.cell_called is False
    assert workbook.release_attempted is True


def test_xls_declared_dimensions_are_rejected_before_cell_iteration(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.accounting_reports import source_adapters

    class OversizedSheet:
        name = "Sheet1"
        nrows = source_adapters.MAX_PROBE_XLS_ROWS + 1
        ncols = 1

        def cell_value(self, _row: int, _column: int) -> object:
            pytest.fail("oversized xls cells must not be iterated")

    class WorkbookStub:
        nsheets = 1

        def sheets(self):
            return (OversizedSheet(),)

        def release_resources(self) -> None:
            pass

    monkeypatch.setattr(source_adapters.xlrd, "open_workbook", lambda **_kwargs: WorkbookStub())
    monkeypatch.setattr(source_adapters, "_reject_ole_macros", lambda _source: None)

    with pytest.raises(AccountingSourceError, match="^source_schema_invalid$"):
        source_adapters._read_xls_sheets(b"fixture", reject_formulas=False)


def _write_balance(path: Path, *, row7=None, row8=None, data=None) -> None:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "余额表"
    for _ in range(6):
        sheet.append([])
    sheet.append(BALANCE_ROW_7 if row7 is None else row7)
    sheet.append(BALANCE_ROW_8 if row8 is None else row8)
    sheet.append(
        [None, "资产", "1001", "测试科目", 1, 0, 2, 0, 3, 0]
        if data is None
        else data
    )
    workbook.save(path)
    workbook.close()


def _source(path: Path, role: SourceRole, schema_id: str) -> AccountingSourceFile:
    return AccountingSourceFile(
        year=2025,
        role=role,
        schema_id=schema_id,
        basename=path.name,
        sha256="a" * 64,
        path=path.resolve(),
    )


def test_balance_adapter_maps_real_ten_column_header_explicitly(
    tmp_path: Path,
) -> None:
    path = tmp_path / "2025年发生额及余额表.xlsx"
    _write_balance(path)

    rows = load_balance_ledger(_source(path, SourceRole.BALANCE_LEDGER, BALANCE_LEDGER_V1))

    assert len(rows) == 1
    row = rows[0]
    assert (row.year, row.category, row.account_code, row.account_name) == (
        2025,
        "资产",
        "1001",
        "测试科目",
    )
    assert (
        row.opening_debit,
        row.opening_credit,
        row.movement_debit,
        row.movement_credit,
        row.closing_debit,
        row.closing_credit,
    ) == tuple(map(Decimal, (1, 0, 2, 0, 3, 0)))
    assert row.source.row_number == 9


@pytest.mark.parametrize(
    ("row7", "row8", "data"),
    [
        (BALANCE_ROW_7[:6] + ["错误"] + BALANCE_ROW_7[7:], None, None),
        (None, BALANCE_ROW_8[:5] + [None] + BALANCE_ROW_8[6:], None),
        (BALANCE_ROW_7 + ["额外"], None, None),
        (None, None, [None, "资产", "1001", "测试科目", "=1", 0, 2, 0, 3, 0]),
        (None, None, [None, "资产", "1001", "测试科目", "NaN", 0, 2, 0, 3, 0]),
        (None, None, [None, "", "1001", "测试科目", 1, 0, 2, 0, 3, 0]),
    ],
)
def test_balance_adapter_rejects_schema_ambiguity(
    tmp_path: Path, row7, row8, data
) -> None:
    path = tmp_path / "2025年发生额及余额表.xlsx"
    _write_balance(path, row7=row7, row8=row8, data=data)

    with pytest.raises(AccountingSourceError, match="^source_schema_invalid"):
        load_balance_ledger(_source(path, SourceRole.BALANCE_LEDGER, BALANCE_LEDGER_V1))


ASSET_HEADER = (
    "资产",
    "行次",
    "期末余额",
    "年初余额",
    "负债和所有者权益",
    "行次",
    "期末余额",
    "年初余额",
)
FLOW_HEADER = ("项目", "行次", "本年累计金额", "本月金额")


def _statement_sheets(*, duplicate_header: bool = False, extra_header=False):
    asset_header = ASSET_HEADER + (("额外",) if extra_header else ())
    prefix = [(None,) for _ in range(2)]
    return (
        (
            "资产负债表",
            tuple(prefix)
            + (asset_header,)
            + ((asset_header,) if duplicate_header else ())
            + (("资产项目", "1", 3, 2, "权益项目", "2", 3, 2),),
        ),
        ("利润表", tuple(prefix) + (FLOW_HEADER, ("利润项目", "1", 3, 2))),
        ("现金流量表", tuple(prefix) + (FLOW_HEADER, ("现金项目", "1", 3, 2))),
    )


def test_statement_adapter_requires_three_exact_sheets_and_headers(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    path = tmp_path / "subject202512财务报表.xls"
    path.write_bytes(b"fixture")
    from app.accounting_reports import source_adapters

    monkeypatch.setattr(source_adapters, "_read_xls_sheets", lambda _path: _statement_sheets())

    rows = load_financial_statements(
        _source(path, SourceRole.FINANCIAL_STATEMENTS, FINANCIAL_STATEMENTS_V1)
    )

    assert len(rows) == 4
    assert {row.sheet_name for row in rows} == {"资产负债表", "利润表", "现金流量表"}
    assert all(row.year == 2025 for row in rows)
    assert "资产项目" not in repr(rows)
    assert "current_amount" not in repr(rows)
    assert "item_name" not in repr(rows)


def test_statement_adapter_accepts_only_layout_whitespace_in_header_labels(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    path = tmp_path / "subject202512财务报表.xls"
    path.write_bytes(b"fixture")
    sheets = list(_statement_sheets())
    spaced = []
    for name, rows in sheets:
        observed_first_header = {
            "资产负债表": "资    产",
            "利润表": "项  目",
            "现金流量表": "项       目",
        }[name]
        header = tuple(
            observed_first_header if index == 0 else value
            for index, value in enumerate(rows[2])
        )
        spaced.append((name, rows[:2] + (header,) + rows[3:]))
    from app.accounting_reports import source_adapters

    monkeypatch.setattr(source_adapters, "_read_xls_sheets", lambda _path: tuple(spaced))

    assert len(
        load_financial_statements(
            _source(path, SourceRole.FINANCIAL_STATEMENTS, FINANCIAL_STATEMENTS_V1)
        )
    ) == 4


def test_statement_adapter_rejects_unobserved_inserted_header_whitespace(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    path = tmp_path / "subject202512财务报表.xls"
    path.write_bytes(b"fixture")
    sheets = list(_statement_sheets())
    name, rows = sheets[0]
    sheets[0] = (name, rows[:2] + (("资  产",) + rows[2][1:],) + rows[3:])
    from app.accounting_reports import source_adapters

    monkeypatch.setattr(source_adapters, "_read_xls_sheets", lambda _path: tuple(sheets))

    with pytest.raises(AccountingSourceError, match="^source_schema_invalid"):
        load_financial_statements(
            _source(path, SourceRole.FINANCIAL_STATEMENTS, FINANCIAL_STATEMENTS_V1)
        )


@pytest.mark.parametrize(
    "partial_row",
    [
        ("分组标题", None, None, None),
        ("分组标题", "1", None, None),
        (None, None, 1, None),
    ],
)
def test_statement_adapter_rejects_every_partially_identified_row(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    partial_row: tuple[object, object, object, object],
) -> None:
    path = tmp_path / "subject202512财务报表.xls"
    path.write_bytes(b"fixture")
    sheets = []
    for name, rows in _statement_sheets():
        width = len(rows[2])
        structure = partial_row + (None,) * (width - len(partial_row))
        sheets.append((name, rows[:3] + (structure,) + rows[3:]))
    from app.accounting_reports import source_adapters

    monkeypatch.setattr(source_adapters, "_read_xls_sheets", lambda _path: tuple(sheets))

    with pytest.raises(AccountingSourceError, match="^source_schema_invalid"):
        load_financial_statements(
            _source(path, SourceRole.FINANCIAL_STATEMENTS, FINANCIAL_STATEMENTS_V1)
        )


@pytest.mark.parametrize("sheet_name", ["资产负债表", "利润表", "现金流量表"])
@pytest.mark.parametrize("trailing_value", ["unexpected", "=1"])
def test_statement_adapter_rejects_nonempty_trailing_data_columns(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    sheet_name: str,
    trailing_value: str,
) -> None:
    path = tmp_path / "subject202512财务报表.xls"
    path.write_bytes(b"fixture")
    sheets = []
    for name, rows in _statement_sheets():
        data_row = rows[-1] + ((trailing_value,) if name == sheet_name else ())
        sheets.append((name, rows[:-1] + (data_row,)))
    from app.accounting_reports import source_adapters

    monkeypatch.setattr(source_adapters, "_read_xls_sheets", lambda _path: tuple(sheets))

    with pytest.raises(AccountingSourceError, match="^source_schema_invalid"):
        load_financial_statements(
            _source(path, SourceRole.FINANCIAL_STATEMENTS, FINANCIAL_STATEMENTS_V1)
        )


def test_statement_adapter_allows_empty_trailing_data_columns(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    path = tmp_path / "subject202512财务报表.xls"
    path.write_bytes(b"fixture")
    sheets = tuple(
        (name, rows[:-1] + (rows[-1] + (None, ""),))
        for name, rows in _statement_sheets()
    )
    from app.accounting_reports import source_adapters

    monkeypatch.setattr(source_adapters, "_read_xls_sheets", lambda _path: sheets)

    assert len(
        load_financial_statements(
            _source(path, SourceRole.FINANCIAL_STATEMENTS, FINANCIAL_STATEMENTS_V1)
        )
    ) == 4


def test_dimension_inspector_returns_counts_without_rows(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    balance = tmp_path / "2025年发生额及余额表.xlsx"
    statements = tmp_path / "subject202512财务报表.xls"
    _write_balance(balance)
    statements.write_bytes(b"fixture")
    from app.accounting_reports import source_adapters

    monkeypatch.setattr(source_adapters, "_read_xls_sheets", lambda _path: _statement_sheets())

    assert inspect_accounting_source_dimensions(
        _source(balance, SourceRole.BALANCE_LEDGER, BALANCE_LEDGER_V1)
    ) == (1, 9)
    assert inspect_accounting_source_dimensions(
        _source(statements, SourceRole.FINANCIAL_STATEMENTS, FINANCIAL_STATEMENTS_V1)
    ) == (3, 12)


@pytest.mark.parametrize(
    "case",
    ["missing", "duplicate_sheet", "duplicate_header", "extra", "formula", "nonfinite"],
)
def test_statement_adapter_fails_closed_on_ambiguous_layout(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, case: str
) -> None:
    path = tmp_path / "subject202512财务报表.xls"
    path.write_bytes(b"fixture")
    sheets = list(
        _statement_sheets(
            duplicate_header=case == "duplicate_header", extra_header=case == "extra"
        )
    )
    if case == "missing":
        sheets.pop()
    elif case == "duplicate_sheet":
        sheets.append(sheets[-1])
    elif case in {"formula", "nonfinite"}:
        name, rows = sheets[1]
        bad = "=1" if case == "formula" else "Infinity"
        sheets[1] = (name, rows[:-1] + (("利润项目", "1", bad, 2),))
    from app.accounting_reports import source_adapters

    monkeypatch.setattr(source_adapters, "_read_xls_sheets", lambda _path: tuple(sheets))

    with pytest.raises(AccountingSourceError, match="^source_schema_invalid"):
        load_financial_statements(
            _source(path, SourceRole.FINANCIAL_STATEMENTS, FINANCIAL_STATEMENTS_V1)
        )


def test_dataset_joins_selected_roles_and_requires_ledger_rows(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    balance = tmp_path / "2025年发生额及余额表.xlsx"
    statements = tmp_path / "subject202512财务报表.xls"
    _write_balance(balance)
    statements.write_bytes(b"fixture")
    manifest = build_accounting_source_manifest(tmp_path, ReportPeriod(2025, 2025))
    from app.accounting_reports import source_adapters

    monkeypatch.setattr(source_adapters, "_read_xls_sheets", lambda _path: _statement_sheets())

    dataset = load_accounting_dataset(manifest)

    assert len(dataset.ledger_rows) == 1
    assert len(dataset.statement_rows) == 4
    assert dataset.manifest is manifest
    assert dataset.subject_identity is None
    assert "测试科目" not in repr(dataset)
    assert "opening_debit" not in repr(dataset)


def test_manifest_hash_and_parsing_use_the_same_approved_bytes(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    balance = tmp_path / "2025年发生额及余额表.xlsx"
    statements = tmp_path / "subject202512财务报表.xls"
    _write_balance(balance)
    statements.write_bytes(b"approved-statement-bytes")
    approved_balance_bytes = balance.read_bytes()
    manifest = build_accounting_source_manifest(
        tmp_path, ReportPeriod(2025, 2025)
    )
    balance.write_bytes(b"changed-after-manifest")
    statements.write_bytes(b"changed-after-manifest")
    from app.accounting_reports import source_adapters

    monkeypatch.setattr(
        source_adapters,
        "_read_xls_sheets",
        lambda source: _statement_sheets()
        if source == b"approved-statement-bytes"
        else pytest.fail("statement adapter reopened the selected path"),
    )

    dataset = load_accounting_dataset(manifest)

    balance_item = next(
        item for item in manifest.files if item.role is SourceRole.BALANCE_LEDGER
    )
    assert balance_item.sha256 == __import__("hashlib").sha256(
        approved_balance_bytes
    ).hexdigest()
    assert len(dataset.ledger_rows) == 1
    assert len(dataset.statement_rows) == 4


def test_metadata_runner_source_guard() -> None:
    runner = Path(__file__).with_name("run_accounting_local_metadata_acceptance.py")
    source = runner.read_text(encoding="utf-8")
    forbidden = (
        "print(row",
        "model_prompt",
        "opening_debit",
        "opening_credit",
        "movement_debit",
        "movement_credit",
        "closing_debit",
        "closing_credit",
        "account_name",
        "account_code",
        "CHAOTANG_ACCOUNTING_SOURCE_DIR=",
    )
    assert not any(token in source for token in forbidden)


def test_public_errors_and_rows_redact_sensitive_values(tmp_path: Path) -> None:
    sensitive_basename = "sensitive-entity-2025.xlsx"
    sensitive_label = "sensitive-account-label"
    sensitive_amount = "987654321.12"
    sensitive_path = str(tmp_path / sensitive_basename)
    error = AccountingSourceError("source_schema_invalid", sensitive_path)
    source = SourceRef(
        file_name=sensitive_path,
        sheet_name=sensitive_label,
        row_number=9,
        file_sha256="a" * 64,
    )
    ledger = NormalizedLedgerRow(
        year=2025,
        category=sensitive_label,
        account_code=sensitive_label,
        account_name=sensitive_label,
        opening_debit=Decimal(sensitive_amount),
        opening_credit=Decimal("0"),
        movement_debit=Decimal("0"),
        movement_credit=Decimal("0"),
        closing_debit=Decimal("0"),
        closing_credit=Decimal("0"),
        source=source,
    )
    statement = FinancialStatementRow(
        year=2025,
        sheet_name=sensitive_label,
        row_number=9,
        section="main",
        item_name=sensitive_label,
        line_number="1",
        current_amount=Decimal(sensitive_amount),
        comparison_amount=Decimal("0"),
        source=source,
    )

    rendered = " ".join(
        (str(error), repr(error), repr(source), repr(ledger), repr(statement))
    )
    assert str(error) == "source_schema_invalid"
    assert repr(source) == "SourceRef(<redacted>)"
    assert repr(ledger) == "NormalizedLedgerRow(year=2025, <redacted>)"
    assert repr(statement) == "FinancialStatementRow(year=2025, <redacted>)"
    for forbidden in (
        sensitive_basename,
        sensitive_label,
        sensitive_amount,
        sensitive_path,
    ):
        assert forbidden not in rendered
    with pytest.raises(ValueError, match="current_amount must be finite"):
        FinancialStatementRow(
            year=2025,
            sheet_name="safe-sheet",
            row_number=1,
            section="main",
            item_name="safe-item",
            line_number="1",
            current_amount=Decimal("NaN"),
            comparison_amount=Decimal("0"),
            source=source,
        )


def _run_metadata_runner(source_dir: Path) -> subprocess.CompletedProcess[str]:
    runner = Path(__file__).with_name("run_accounting_local_metadata_acceptance.py")
    environ = os.environ.copy()
    environ["CHAOTANG_ACCOUNTING_SOURCE_DIR"] = str(source_dir)
    return subprocess.run(
        [sys.executable, str(runner)],
        cwd=runner.parents[2],
        env=environ,
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=30,
        check=False,
    )


@pytest.mark.parametrize("failure_stage", ["override", "manifest", "dimensions"])
def test_metadata_runner_sanitizes_every_source_failure_stage(
    tmp_path: Path, failure_stage: str
) -> None:
    sensitive_marker = "sensitive-entity-marker"
    if failure_stage == "override":
        source_dir = tmp_path / sensitive_marker / "missing"
    else:
        source_dir = tmp_path / sensitive_marker
        source_dir.mkdir()
        if failure_stage == "dimensions":
            (source_dir / "2025年发生额及余额表.xlsx").write_bytes(b"invalid")
            (source_dir / "sensitive-entity-marker202512财务报表.xls").write_bytes(
                b"invalid"
            )

    completed = _run_metadata_runner(source_dir)

    assert completed.returncode == 0
    assert completed.stderr == ""
    evidence = json.loads(completed.stdout)
    assert evidence["status"] == "NEEDS_INPUT"
    assert evidence["requested_years"] == [2025]
    rendered = completed.stdout + completed.stderr
    assert sensitive_marker not in rendered
    assert str(tmp_path) not in rendered
    assert "Traceback" not in rendered
