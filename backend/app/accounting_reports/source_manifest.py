from __future__ import annotations

import hashlib
import json
import os
import re
import stat
from collections.abc import Mapping
from dataclasses import dataclass, field
from enum import StrEnum
from pathlib import Path
from typing import Final

from .config import APPROVED_ACCOUNTING_SOURCE_DIR
from .models import ReportPeriod
from .sources import AccountingSourceError

BALANCE_LEDGER_V1: Final = "BALANCE_LEDGER_V1"
FINANCIAL_STATEMENTS_V1: Final = "FINANCIAL_STATEMENTS_V1"
_SOURCE_ENV: Final = "CHAOTANG_ACCOUNTING_SOURCE_DIR"
_BALANCE_NAME: Final = re.compile(r"^(?P<year>20\d{2})年发生额及余额表\.xlsx$")
_STATEMENT_NAME: Final = re.compile(r"^.+(?P<year>20\d{2})(?:年|12)财务报表\.xls$")
_YEAR_TOKEN: Final = re.compile(r"20\d{2}")
_REPARSE_ATTRIBUTE: Final = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)
MAX_PROBE_FILE_BYTES: Final = 16 * 1024 * 1024
MAX_PROBE_FILES: Final = 32


class SourceRole(StrEnum):
    BALANCE_LEDGER = "balance_ledger"
    FINANCIAL_STATEMENTS = "financial_statements"


@dataclass(frozen=True, slots=True, repr=False)
class AccountingSourceFile:
    year: int
    role: SourceRole
    schema_id: str
    basename: str
    sha256: str
    path: Path = field(repr=False, compare=False)
    content: bytes | None = field(default=None, repr=False, compare=False)

    def __post_init__(self) -> None:
        if not isinstance(self.role, SourceRole):
            raise TypeError("role must be a SourceRole")
        if self.schema_id not in {BALANCE_LEDGER_V1, FINANCIAL_STATEMENTS_V1}:
            raise ValueError("unsupported schema_id")
        if not self.basename or Path(self.basename).name != self.basename:
            raise ValueError("basename must be a safe file name")
        if not re.fullmatch(r"[0-9a-f]{64}", self.sha256):
            raise ValueError("sha256 must be lowercase hexadecimal")
        if not self.path.is_absolute():
            raise ValueError("path must be absolute")
        if self.content is not None and not isinstance(self.content, bytes):
            raise TypeError("content must be bytes")

    def __repr__(self) -> str:
        return (
            "AccountingSourceFile("
            f"year={self.year}, role={self.role.value!r}, schema_id={self.schema_id!r}, "
            "<redacted>)"
        )


@dataclass(frozen=True, slots=True, repr=False)
class AccountingSourceManifest:
    period: ReportPeriod
    files: tuple[AccountingSourceFile, ...]
    fingerprint: str

    def __post_init__(self) -> None:
        if not isinstance(self.period, ReportPeriod):
            raise TypeError("period must be a ReportPeriod")
        if not isinstance(self.files, tuple):
            raise TypeError("files must be a tuple")
        if not re.fullmatch(r"[0-9a-f]{64}", self.fingerprint):
            raise ValueError("fingerprint must be lowercase hexadecimal")

    def __repr__(self) -> str:
        return (
            "AccountingSourceManifest("
            f"period={self.period!r}, file_count={len(self.files)}, <redacted>)"
        )


def _is_reparse(path: Path) -> bool:
    try:
        metadata = path.lstat()
    except OSError:
        return True
    return path.is_symlink() or bool(
        getattr(metadata, "st_file_attributes", 0) & _REPARSE_ATTRIBUTE
    )


def _resolve_directory(path: Path) -> Path:
    if not path.is_absolute() or _is_reparse(path):
        raise AccountingSourceError("source_path_invalid")
    try:
        resolved = path.resolve(strict=True)
    except OSError:
        raise AccountingSourceError("source_path_invalid") from None
    if not resolved.is_dir() or _is_reparse(resolved):
        raise AccountingSourceError("source_path_invalid")
    return resolved


def resolve_accounting_source_dir(
    environ: Mapping[str, str] = os.environ,
) -> Path:
    if _SOURCE_ENV in environ:
        configured = environ[_SOURCE_ENV]
        if not isinstance(configured, str) or not configured.strip():
            raise AccountingSourceError("source_path_invalid")
        return _resolve_directory(Path(configured))
    return _resolve_directory(APPROVED_ACCOUNTING_SOURCE_DIR)


def resolve_accounting_source_dir_at(source_dir: Path) -> Path:
    """Resolve an application-approved source root supplied by trusted code."""
    return _resolve_directory(source_dir)


@dataclass(frozen=True, slots=True, repr=False)
class FrozenWorkbook:
    path: Path = field(repr=False)
    content: bytes = field(repr=False)
    sha256: str

    def __repr__(self) -> str:
        return "FrozenWorkbook(<redacted>)"


def freeze_candidate_workbooks(root: Path) -> tuple[FrozenWorkbook, ...]:
    root = _resolve_directory(root)
    try:
        entries = tuple(sorted(root.iterdir(), key=lambda item: item.name.casefold()))
    except OSError:
        raise AccountingSourceError("source_path_invalid") from None
    candidates = [item for item in entries if item.suffix.casefold() in {".xlsx", ".xls"}]
    if len(candidates) > MAX_PROBE_FILES:
        raise AccountingSourceError("source_schema_invalid")
    frozen: list[FrozenWorkbook] = []
    for candidate in candidates:
        resolved = _resolve_selected_file(candidate, root)
        try:
            expected = resolved.lstat()
        except OSError:
            raise AccountingSourceError("source_schema_invalid") from None
        if expected.st_size > MAX_PROBE_FILE_BYTES:
            raise AccountingSourceError("source_schema_invalid")
        content = _read_selected_bytes(resolved, root, expected)
        if len(content) > MAX_PROBE_FILE_BYTES:
            raise AccountingSourceError("source_schema_invalid")
        frozen.append(FrozenWorkbook(resolved, content, hashlib.sha256(content).hexdigest()))
    return tuple(frozen)


def _resolve_selected_file(path: Path, root: Path) -> Path:
    if _is_reparse(path):
        raise AccountingSourceError("source_path_invalid")
    try:
        resolved = path.resolve(strict=True)
        resolved.relative_to(root)
    except (OSError, ValueError):
        raise AccountingSourceError("source_path_invalid") from None
    if not resolved.is_file() or _is_reparse(resolved):
        raise AccountingSourceError("source_path_invalid")
    return resolved


def _before_selected_open(_path: Path) -> None:
    """Test seam immediately before the controlled open; production is a no-op."""


def _before_selected_postcheck(_path: Path) -> None:
    """Test seam after handle read and before the final path identity check."""


def _file_identity(metadata: os.stat_result) -> tuple[int, int, int, int, int]:
    return (
        metadata.st_dev,
        metadata.st_ino,
        metadata.st_mode,
        metadata.st_size,
        metadata.st_mtime_ns,
    )


def _read_selected_bytes(
    path: Path,
    root: Path,
    expected: os.stat_result,
) -> bytes:
    try:
        _before_selected_open(path)
        before_path = path.lstat()
        if _is_reparse(path) or _file_identity(before_path) != _file_identity(expected):
            raise AccountingSourceError("source_schema_invalid")
        with path.open("rb") as source:
            before_handle = os.fstat(source.fileno())
            if _file_identity(before_handle) != _file_identity(expected):
                raise AccountingSourceError("source_schema_invalid")
            content = source.read(MAX_PROBE_FILE_BYTES + 1)
            after_handle = os.fstat(source.fileno())
            if _file_identity(after_handle) != _file_identity(before_handle):
                raise AccountingSourceError("source_schema_invalid")
            if len(content) > MAX_PROBE_FILE_BYTES:
                raise AccountingSourceError("source_schema_invalid")
        _before_selected_postcheck(path)
        after_path = path.lstat()
        resolved_after = path.resolve(strict=True)
        resolved_after.relative_to(root)
        if (
            _is_reparse(path)
            or not resolved_after.is_file()
            or _file_identity(after_path) != _file_identity(before_handle)
        ):
            raise AccountingSourceError("source_schema_invalid")
        return content
    except AccountingSourceError:
        raise
    except ValueError:
        raise AccountingSourceError("source_schema_invalid") from None
    except OSError:
        raise AccountingSourceError("source_schema_invalid") from None


def _selected_candidates(
    root: Path,
    year: int,
) -> dict[SourceRole, list[tuple[Path, str]]]:
    selected: dict[SourceRole, list[tuple[Path, str]]] = {
        SourceRole.BALANCE_LEDGER: [],
        SourceRole.FINANCIAL_STATEMENTS: [],
    }
    try:
        entries = tuple(root.iterdir())
    except OSError:
        raise AccountingSourceError("source_path_invalid") from None
    for entry in entries:
        balance_match = _BALANCE_NAME.fullmatch(entry.name)
        statement_match = _STATEMENT_NAME.fullmatch(entry.name)
        match = balance_match or statement_match
        if match is None or int(match.group("year")) != year:
            continue
        if len(_YEAR_TOKEN.findall(entry.name)) != 1:
            raise AccountingSourceError("source_schema_invalid")
        if balance_match:
            selected[SourceRole.BALANCE_LEDGER].append((entry, BALANCE_LEDGER_V1))
        else:
            selected[SourceRole.FINANCIAL_STATEMENTS].append(
                (entry, FINANCIAL_STATEMENTS_V1)
            )
    return selected


def build_accounting_source_manifest(
    source_dir: Path,
    period: ReportPeriod,
) -> AccountingSourceManifest:
    root = _resolve_directory(source_dir)
    files: list[AccountingSourceFile] = []
    for year in range(period.start_year, period.end_year + 1):
        selected = _selected_candidates(root, year)
        for role in SourceRole:
            candidates = selected[role]
            if not candidates:
                raise AccountingSourceError("source_missing")
            if len(candidates) != 1:
                raise AccountingSourceError("source_period_conflict")
            candidate, schema_id = candidates[0]
            resolved = _resolve_selected_file(candidate, root)
            try:
                expected = resolved.lstat()
            except OSError:
                raise AccountingSourceError("source_schema_invalid") from None
            content = _read_selected_bytes(resolved, root, expected)
            files.append(
                AccountingSourceFile(
                    year=year,
                    role=role,
                    schema_id=schema_id,
                    basename=candidate.name,
                    sha256=hashlib.sha256(content).hexdigest(),
                    path=resolved,
                    content=content,
                )
            )
    files_tuple = tuple(sorted(files, key=lambda item: (item.year, item.role.value)))
    canonical = {
        "period": [period.start_year, period.end_year],
        "files": [
            {
                "year": item.year,
                "role": item.role.value,
                "schema_id": item.schema_id,
                "basename": item.basename,
                "sha256": item.sha256,
            }
            for item in files_tuple
        ],
    }
    fingerprint = hashlib.sha256(
        json.dumps(canonical, ensure_ascii=False, separators=(",", ":")).encode()
    ).hexdigest()
    return AccountingSourceManifest(period, files_tuple, fingerprint)
