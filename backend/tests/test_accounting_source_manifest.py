from __future__ import annotations

from pathlib import Path

import pytest
from openpyxl import Workbook

from app.accounting_reports.models import ReportPeriod
from app.accounting_reports.source_manifest import (
    SourceRole,
    build_accounting_source_manifest,
    freeze_candidate_workbooks,
    resolve_accounting_source_dir,
)
from app.accounting_reports.sources import AccountingSourceError


def test_freeze_candidate_workbooks_accepts_noncanonical_filename_and_freezes_bytes(
    tmp_path: Path,
) -> None:
    candidate = tmp_path / "arbitrary-name.xlsx"
    _write_balance(candidate)

    frozen = freeze_candidate_workbooks(tmp_path)
    approved = frozen[0].content
    candidate.write_bytes(b"changed")

    assert approved != candidate.read_bytes()
    assert len(frozen[0].sha256) == 64


def test_freeze_candidate_workbooks_uses_bounded_read_and_rejects_growth(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.accounting_reports import source_manifest

    candidate = tmp_path / "growing.xlsx"
    candidate.write_bytes(b"small")
    original_open = Path.open

    class GrowingReader:
        def __init__(self, wrapped) -> None:
            self.wrapped = wrapped

        def __enter__(self):
            self.wrapped.__enter__()
            return self

        def __exit__(self, *args):
            return self.wrapped.__exit__(*args)

        def fileno(self):
            return self.wrapped.fileno()

        def read(self, size: int) -> bytes:
            assert size == source_manifest.MAX_PROBE_FILE_BYTES + 1
            return b"x" * size

    def controlled_open(path: Path, *args, **kwargs):
        wrapped = original_open(path, *args, **kwargs)
        return GrowingReader(wrapped) if path == candidate.resolve() else wrapped

    monkeypatch.setattr(Path, "open", controlled_open)

    with pytest.raises(AccountingSourceError, match="^source_schema_invalid$"):
        freeze_candidate_workbooks(tmp_path)


def _write_balance(path: Path) -> None:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "余额表"
    for _ in range(6):
        sheet.append([])
    sheet.append(
        [None, "科目类别", "科目编码", "科目名称", "期初余额", None, "本期发生", None, "期末余额"]
    )
    sheet.append([None, None, None, None, "借方", "贷方", "借方", "贷方", "借方", "贷方"])
    sheet.append([None, "资产", "1001", "测试科目", 1, 0, 1, 0, 2, 0])
    workbook.save(path)
    workbook.close()


def _write_selected_pair(root: Path, year: int = 2025) -> None:
    _write_balance(root / f"{year}年发生额及余额表.xlsx")
    (root / f"subject{year}12财务报表.xls").write_bytes(b"selected")


def test_manifest_selects_requested_year_before_validating_other_names(
    tmp_path: Path,
) -> None:
    _write_selected_pair(tmp_path)
    (tmp_path / "subject202212财务报表.xls").write_bytes(b"irrelevant")
    (tmp_path / "unrelated.txt").write_text("irrelevant", encoding="utf-8")

    manifest = build_accounting_source_manifest(tmp_path, ReportPeriod(2025, 2025))

    assert {(item.year, item.role) for item in manifest.files} == {
        (2025, SourceRole.BALANCE_LEDGER),
        (2025, SourceRole.FINANCIAL_STATEMENTS),
    }
    assert len(manifest.fingerprint) == 64
    assert all(item.path.is_absolute() for item in manifest.files)


@pytest.mark.parametrize("missing_role", list(SourceRole))
def test_manifest_requires_one_file_for_each_role(
    tmp_path: Path, missing_role: SourceRole
) -> None:
    _write_selected_pair(tmp_path)
    selected = next(
        path
        for path in tmp_path.iterdir()
        if ("余额表" in path.name) == (missing_role is SourceRole.BALANCE_LEDGER)
    )
    selected.unlink()

    with pytest.raises(AccountingSourceError, match="^source_missing$"):
        build_accounting_source_manifest(tmp_path, ReportPeriod(2025, 2025))


def test_manifest_rejects_duplicate_selected_role(tmp_path: Path) -> None:
    _write_selected_pair(tmp_path)
    (tmp_path / "other202512财务报表.xls").write_bytes(b"duplicate")

    with pytest.raises(AccountingSourceError, match="^source_period_conflict$"):
        build_accounting_source_manifest(tmp_path, ReportPeriod(2025, 2025))


def test_manifest_rejects_ambiguous_year_in_selected_suffix(tmp_path: Path) -> None:
    _write_balance(tmp_path / "2025年发生额及余额表.xlsx")
    (tmp_path / "subject2024202512财务报表.xls").write_bytes(b"ambiguous")

    with pytest.raises(AccountingSourceError, match="^source_schema_invalid$"):
        build_accounting_source_manifest(tmp_path, ReportPeriod(2025, 2025))


def test_manifest_rejects_symlink_selected_file(tmp_path: Path) -> None:
    approved = tmp_path / "approved"
    outside = tmp_path / "outside"
    approved.mkdir()
    outside.mkdir()
    _write_balance(approved / "2025年发生额及余额表.xlsx")
    target = outside / "subject202512财务报表.xls"
    target.write_bytes(b"outside")
    link = approved / target.name
    try:
        link.symlink_to(target)
    except OSError:
        pytest.skip("symlink creation is unavailable")

    with pytest.raises(AccountingSourceError, match="^source_path_invalid$"):
        build_accounting_source_manifest(approved, ReportPeriod(2025, 2025))


def test_source_dir_override_is_absolute_existing_and_non_reparse(
    tmp_path: Path,
) -> None:
    assert resolve_accounting_source_dir(
        {"CHAOTANG_ACCOUNTING_SOURCE_DIR": str(tmp_path)}
    ) == tmp_path.resolve()

    for invalid in ("relative", str(tmp_path / "missing")):
        with pytest.raises(AccountingSourceError, match="^source_path_invalid$"):
            resolve_accounting_source_dir(
                {"CHAOTANG_ACCOUNTING_SOURCE_DIR": invalid}
            )


def test_source_dir_invalid_override_never_falls_back(tmp_path: Path) -> None:
    with pytest.raises(AccountingSourceError, match="^source_path_invalid$"):
        resolve_accounting_source_dir(
            {"CHAOTANG_ACCOUNTING_SOURCE_DIR": str(tmp_path / "missing")}
        )


def test_source_dir_override_deterministically_rejects_reparse_marker(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.accounting_reports import source_manifest

    monkeypatch.setattr(source_manifest, "_is_reparse", lambda _path: True)

    with pytest.raises(AccountingSourceError, match="^source_path_invalid$"):
        resolve_accounting_source_dir(
            {"CHAOTANG_ACCOUNTING_SOURCE_DIR": str(tmp_path)}
        )


def test_manifest_deterministically_rejects_selected_reparse_file(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _write_selected_pair(tmp_path)
    from app.accounting_reports import source_manifest

    def selected_file_is_reparse(path: Path) -> bool:
        return path.is_file() and path.suffix.lower() in {".xlsx", ".xls"}

    monkeypatch.setattr(source_manifest, "_is_reparse", selected_file_is_reparse)

    with pytest.raises(AccountingSourceError, match="^source_path_invalid$"):
        build_accounting_source_manifest(tmp_path, ReportPeriod(2025, 2025))


@pytest.mark.parametrize("phase", ["before_open", "after_read"])
@pytest.mark.parametrize("mutation", ["replace", "delete", "reparse"])
def test_manifest_rejects_selected_file_replacement_during_controlled_read(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    phase: str,
    mutation: str,
) -> None:
    _write_selected_pair(tmp_path)
    from app.accounting_reports import source_manifest

    mutated = False
    marked_reparse = False
    original_is_reparse = source_manifest._is_reparse

    def mutate_once(path: Path) -> None:
        nonlocal mutated, marked_reparse
        if mutated or path.suffix.lower() != ".xlsx":
            return
        mutated = True
        if mutation == "replace":
            original = path.read_bytes()
            path.unlink()
            path.write_bytes(original)
        elif mutation == "delete":
            path.unlink()
        else:
            marked_reparse = True

    def controlled_reparse(path: Path) -> bool:
        return marked_reparse and path.suffix.lower() == ".xlsx" or original_is_reparse(path)

    hook = (
        "_before_selected_open"
        if phase == "before_open"
        else "_before_selected_postcheck"
    )
    monkeypatch.setattr(source_manifest, hook, mutate_once)
    monkeypatch.setattr(source_manifest, "_is_reparse", controlled_reparse)

    with pytest.raises(AccountingSourceError, match="^source_schema_invalid$"):
        build_accounting_source_manifest(tmp_path, ReportPeriod(2025, 2025))
