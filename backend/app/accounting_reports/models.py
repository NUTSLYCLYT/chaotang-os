from __future__ import annotations

import json
import re
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from pathlib import Path, PurePosixPath, PureWindowsPath
from types import MappingProxyType

from app.work_products import WorkProductStatus

MIN_REPORT_YEAR = 2000
MAX_REPORT_YEAR = 2100
_CANONICAL_SOURCE_REF = re.compile(
    r"^(?P<digest>[0-9a-fA-F]{64}):(?P<sheet>[^:]+):(?P<row>[1-9][0-9]*)$"
)
_SHA256_HEX = re.compile(r"^[0-9a-fA-F]{64}$")
_URL_WITH_SCHEME = re.compile(r"^[A-Za-z][A-Za-z0-9+.-]*://")


def _validate_year(year: int, field_name: str) -> None:
    if isinstance(year, bool) or not isinstance(year, int):
        raise TypeError(f"{field_name} must be an integer")
    if not MIN_REPORT_YEAR <= year <= MAX_REPORT_YEAR:
        raise ValueError(
            f"{field_name} must be between {MIN_REPORT_YEAR} and {MAX_REPORT_YEAR}"
        )


def _require_nonblank(value: str, field_name: str) -> None:
    if not isinstance(value, str):
        raise TypeError(f"{field_name} must be a string")
    if not value.strip():
        raise ValueError(f"{field_name} must not be blank")


def _require_controlled_opaque_ref(value: str, field_name: str) -> None:
    _require_nonblank(value, field_name)
    posix_ref = PurePosixPath(value)
    windows_ref = PureWindowsPath(value)
    has_traversal = ".." in posix_ref.parts or ".." in windows_ref.parts
    has_path_root = (
        posix_ref.is_absolute()
        or windows_ref.is_absolute()
        or bool(windows_ref.drive)
        or bool(windows_ref.root)
    )
    is_file_uri = value.casefold().startswith("file:")
    if (
        has_path_root
        or has_traversal
        or is_file_uri
        or _URL_WITH_SCHEME.match(value)
    ):
        raise ValueError(f"{field_name} must be a controlled opaque reference")


@dataclass(frozen=True, slots=True)
class ReportPeriod:
    start_year: int
    end_year: int

    def __post_init__(self) -> None:
        _validate_year(self.start_year, "start_year")
        _validate_year(self.end_year, "end_year")
        if self.start_year > self.end_year:
            raise ValueError("report period must not be reversed")


@dataclass(frozen=True, slots=True, repr=False)
class CellProbe:
    row: int
    column: int
    value_type: str
    value: object

    def __repr__(self) -> str:
        return (
            f"CellProbe(row={self.row}, column={self.column}, "
            f"value_type={self.value_type!r}, <redacted>)"
        )


@dataclass(frozen=True, slots=True, repr=False)
class CellRegion:
    start_row: int
    end_row: int
    start_column: int
    end_column: int
    header_depth: int
    cells: tuple[CellProbe, ...] = ()
    formula_cells: tuple[tuple[int, int, str], ...] = ()

    def __repr__(self) -> str:
        return "CellRegion(<redacted>)"


@dataclass(frozen=True, slots=True, repr=False)
class SheetProbe:
    name: str
    row_count: int
    column_count: int
    regions: tuple[CellRegion, ...]
    merged_ranges: tuple[str, ...] = ()
    rejected_rows: tuple[int, ...] = ()

    def __repr__(self) -> str:
        return (
            f"SheetProbe(row_count={self.row_count}, "
            f"column_count={self.column_count}, <redacted>)"
        )


@dataclass(frozen=True, slots=True, repr=False)
class WorkbookProbe:
    sha256: str
    years: tuple[int, ...]
    sheets: tuple[SheetProbe, ...]

    def __repr__(self) -> str:
        return f"WorkbookProbe(years={self.years!r}, sheet_count={len(self.sheets)}, <redacted>)"


class ReportIntentKind(StrEnum):
    NOT_REQUESTED = "NOT_REQUESTED"
    EXPLICIT_PERIOD = "EXPLICIT_PERIOD"
    MISSING_PERIOD = "MISSING_PERIOD"
    INVALID_PERIOD = "INVALID_PERIOD"


class AccountingRequestKind(StrEnum):
    NOT_REQUESTED = "NOT_REQUESTED"
    ACCOUNTING_REPORT = "ACCOUNTING_REPORT"
    ACCOUNTING_ANALYSIS = "ACCOUNTING_ANALYSIS"


@dataclass(frozen=True, slots=True)
class ReportIntent:
    kind: ReportIntentKind
    period: ReportPeriod | None
    request_kind: AccountingRequestKind = AccountingRequestKind.ACCOUNTING_REPORT

    def __post_init__(self) -> None:
        if not isinstance(self.kind, ReportIntentKind):
            raise TypeError("kind must be a ReportIntentKind")
        has_explicit_period = self.kind is ReportIntentKind.EXPLICIT_PERIOD
        if has_explicit_period != (self.period is not None):
            raise ValueError("only EXPLICIT_PERIOD intent must carry a period")
        if self.kind is ReportIntentKind.NOT_REQUESTED:
            object.__setattr__(
                self, "request_kind", AccountingRequestKind.NOT_REQUESTED
            )
        elif self.request_kind is AccountingRequestKind.NOT_REQUESTED:
            raise ValueError("requested intent must carry an accounting request kind")

    @property
    def requested(self) -> bool:
        return self.kind is not ReportIntentKind.NOT_REQUESTED


@dataclass(frozen=True, slots=True, repr=False)
class SourceRef:
    file_name: str
    sheet_name: str
    row_number: int
    file_sha256: str

    def __post_init__(self) -> None:
        _require_nonblank(self.file_name, "file_name")
        _require_nonblank(self.sheet_name, "sheet_name")
        _require_nonblank(self.file_sha256, "file_sha256")
        if isinstance(self.row_number, bool) or not isinstance(self.row_number, int):
            raise TypeError("row_number must be an integer")
        if self.row_number < 1:
            raise ValueError("row_number must be positive")

    def __repr__(self) -> str:
        return "SourceRef(<redacted>)"


@dataclass(frozen=True, slots=True, repr=False)
class NormalizedLedgerRow:
    year: int
    category: str
    account_code: str
    account_name: str
    opening_debit: Decimal
    opening_credit: Decimal
    movement_debit: Decimal
    movement_credit: Decimal
    closing_debit: Decimal
    closing_credit: Decimal
    source: SourceRef

    def __post_init__(self) -> None:
        _validate_year(self.year, "year")
        for field_name in ("category", "account_code", "account_name"):
            _require_nonblank(getattr(self, field_name), field_name)
        for field_name in (
            "opening_debit",
            "opening_credit",
            "movement_debit",
            "movement_credit",
            "closing_debit",
            "closing_credit",
        ):
            value = getattr(self, field_name)
            if not isinstance(value, Decimal):
                raise TypeError(f"{field_name} must be a Decimal")
            if not value.is_finite():
                raise ValueError(f"{field_name} must be finite")
        if not isinstance(self.source, SourceRef):
            raise TypeError("source must be a SourceRef")

    def __repr__(self) -> str:
        return f"NormalizedLedgerRow(year={self.year}, <redacted>)"


@dataclass(frozen=True, slots=True, repr=False)
class FinancialStatementRow:
    year: int
    sheet_name: str
    row_number: int
    section: str
    item_name: str
    line_number: str
    current_amount: Decimal
    comparison_amount: Decimal
    source: SourceRef

    def __post_init__(self) -> None:
        _validate_year(self.year, "year")
        for field_name in ("sheet_name", "section", "item_name", "line_number"):
            _require_nonblank(getattr(self, field_name), field_name)
        if isinstance(self.row_number, bool) or not isinstance(self.row_number, int):
            raise TypeError("row_number must be an integer")
        if self.row_number < 1:
            raise ValueError("row_number must be positive")
        for field_name in ("current_amount", "comparison_amount"):
            value = getattr(self, field_name)
            if not isinstance(value, Decimal):
                raise TypeError(f"{field_name} must be a Decimal")
            if not value.is_finite():
                raise ValueError(f"{field_name} must be finite")
        if not isinstance(self.source, SourceRef):
            raise TypeError("source must be a SourceRef")

    def __repr__(self) -> str:
        return f"FinancialStatementRow(year={self.year}, <redacted>)"


@dataclass(frozen=True, slots=True, repr=False)
class ReportCheck:
    name: str
    status: str
    detail: str
    actual: str = ""
    expected: str = ""
    difference: str = ""

    def __post_init__(self) -> None:
        _require_nonblank(self.name, "name")
        if self.status not in {"PASS", "FAIL"}:
            raise ValueError("status must be PASS or FAIL")
        _require_nonblank(self.detail, "detail")
        default_actual = "0" if self.status == "PASS" else "1"
        for field_name, default in (
            ("actual", default_actual),
            ("expected", "0"),
            ("difference", default_actual),
        ):
            value = getattr(self, field_name)
            if not isinstance(value, str):
                raise TypeError(f"{field_name} must be a string")
            if not value.strip():
                object.__setattr__(self, field_name, default)

    def __repr__(self) -> str:
        return f"ReportCheck(status={self.status!r}, <redacted>)"


@dataclass(frozen=True, slots=True, repr=False)
class AccountingReportSummary:
    period: ReportPeriod
    metrics_by_year: Mapping[int, Mapping[str, Decimal | None]]
    exceptions: tuple[str, ...]
    checks: tuple[ReportCheck, ...]
    source_ids: tuple[str, ...]

    def __post_init__(self) -> None:
        frozen_metrics = {
            year: MappingProxyType(dict(metrics))
            for year, metrics in self.metrics_by_year.items()
        }
        object.__setattr__(self, "metrics_by_year", MappingProxyType(frozen_metrics))

    def __repr__(self) -> str:
        return (
            "AccountingReportSummary("
            f"period={self.period!r}, year_count={len(self.metrics_by_year)}, "
            f"exception_count={len(self.exceptions)}, check_count={len(self.checks)}, "
            "<redacted>)"
        )

    @property
    def overall_status(self) -> str:
        return "PASS" if all(check.status == "PASS" for check in self.checks) else "FAIL"

    def to_model_payload(self) -> dict[str, object]:
        return {
            "period": {
                "start_year": self.period.start_year,
                "end_year": self.period.end_year,
            },
            "metrics": [
                {"year": year, **dict(metrics)}
                for year, metrics in sorted(self.metrics_by_year.items())
            ],
            "exceptions": list(self.exceptions),
            "checks": [
                {
                    "name": check.name,
                    "status": check.status,
                    "detail": check.detail,
                }
                for check in self.checks
            ],
            "source_ids": list(self.source_ids),
        }

    def to_model_prompt(self) -> str:
        prompt = json.dumps(
            self.to_model_payload(),
            ensure_ascii=False,
            separators=(",", ":"),
            default=str,
        )
        if len(prompt) <= 4000:
            return prompt
        bounded = {
            "period": {
                "start_year": self.period.start_year,
                "end_year": self.period.end_year,
            },
            "overall_status": self.overall_status,
            "exception_count": len(self.exceptions),
            "check_count": len(self.checks),
            "source_count": len(self.source_ids),
        }
        return json.dumps(bounded, ensure_ascii=False, separators=(",", ":"))


@dataclass(frozen=True, slots=True)
class CurrencyConversionReceipt:
    """Explicit offline evidence for one adopted currency conversion."""

    from_currency: str
    to_currency: str
    rate: Decimal
    period: ReportPeriod
    source_ref: str
    source_digest: str
    adopted: bool

    def __post_init__(self) -> None:
        for field_name in (
            "from_currency",
            "to_currency",
            "source_digest",
        ):
            _require_nonblank(getattr(self, field_name), field_name)
        _require_controlled_opaque_ref(self.source_ref, "source_ref")
        if self.from_currency.strip().casefold() == self.to_currency.strip().casefold():
            raise ValueError("currency conversion must change currency")
        if not isinstance(self.rate, Decimal):
            raise TypeError("rate must be a Decimal")
        if not self.rate.is_finite() or self.rate <= 0:
            raise ValueError("rate must be positive and finite")
        if not isinstance(self.period, ReportPeriod):
            raise TypeError("period must be a ReportPeriod")
        if _SHA256_HEX.fullmatch(self.source_digest) is None:
            raise ValueError("source_digest must be a 64-character SHA-256 hex digest")
        if not isinstance(self.adopted, bool):
            raise TypeError("adopted must be a bool")


@dataclass(frozen=True, slots=True)
class AccountingSourceReceipt:
    """Deterministic adoption metadata for one normalized ledger source."""

    source_ref: str
    source_digest: str
    source_label: str | None
    adopted: bool
    period: ReportPeriod
    currency: str
    source_human_confirmed: bool = False
    logical_source_id: str | None = None
    conversion_receipt: CurrencyConversionReceipt | None = None

    def __post_init__(self) -> None:
        _require_nonblank(self.source_ref, "source_ref")
        _require_nonblank(self.source_digest, "source_digest")
        if self.source_label is not None:
            _require_nonblank(self.source_label, "source_label")
        if not isinstance(self.adopted, bool):
            raise TypeError("adopted must be a bool")
        if not isinstance(self.period, ReportPeriod):
            raise TypeError("period must be a ReportPeriod")
        _require_nonblank(self.currency, "currency")
        if not isinstance(self.source_human_confirmed, bool):
            raise TypeError("source_human_confirmed must be a bool")
        if self.logical_source_id is None:
            canonical = _CANONICAL_SOURCE_REF.fullmatch(self.source_ref)
            default_logical_id = (
                f"{canonical.group('sheet')}:{canonical.group('row')}"
                if canonical is not None
                else self.source_ref
            )
            object.__setattr__(self, "logical_source_id", default_logical_id)
        else:
            _require_nonblank(self.logical_source_id, "logical_source_id")
        if self.conversion_receipt is not None and not isinstance(
            self.conversion_receipt, CurrencyConversionReceipt
        ):
            raise TypeError(
                "conversion_receipt must be a CurrencyConversionReceipt"
            )


@dataclass(frozen=True, slots=True)
class AccountingReportNumber:
    """A deterministic analysis number proposed for the final report."""

    name: str
    amount: Decimal | str | None
    fact_id: str | None
    source_ref: str | None
    rule_id: str | None
    model_generated: bool = False

    def __post_init__(self) -> None:
        _require_nonblank(self.name, "name")
        for field_name in ("fact_id", "source_ref", "rule_id"):
            value = getattr(self, field_name)
            if value is not None:
                _require_nonblank(value, field_name)
        if not isinstance(self.model_generated, bool):
            raise TypeError("model_generated must be a bool")


@dataclass(frozen=True, slots=True)
class ReportAnalysis:
    """Numbers and narrative emitted by the deterministic analysis boundary."""

    numbers: tuple[AccountingReportNumber, ...]
    model_text: str = ""

    def __post_init__(self) -> None:
        if not isinstance(self.numbers, tuple) or not all(
            isinstance(number, AccountingReportNumber) for number in self.numbers
        ):
            raise TypeError("numbers must be AccountingReportNumber instances")
        if not isinstance(self.model_text, str):
            raise TypeError("model_text must be a string")


@dataclass(frozen=True, slots=True)
class AccountingFact:
    fact_id: str
    name: str
    amount: Decimal
    source_ref: str
    source_digest: str
    rule_id: str
    source_human_confirmed: bool
    conversion_receipt: CurrencyConversionReceipt | None = None


@dataclass(frozen=True, slots=True)
class AccountingEvaluation:
    task_id: str
    period: ReportPeriod
    work_status: WorkProductStatus
    reason_codes: tuple[str, ...]
    facts: tuple[AccountingFact, ...]
    fact_pack_digest: str
    source_digests: tuple[str, ...]
    accounting_rules_version: str
    renderer_version: str
    declared_outputs: tuple[str, ...]
    attempted_actions: tuple[str, ...]


@dataclass(frozen=True, slots=True, repr=False)
class AccountingWorkbookDisclosure:
    """Sanitized deterministic mapping and validation disclosure for a workbook."""

    decree_id: str
    snapshot_fingerprint: str
    publication_readiness: str
    mapping_candidates: tuple[str, ...]
    selected_reasons: tuple[str, ...]
    confidence_band: str
    validation_receipts: tuple[str, ...]
    source_regions: tuple[str, ...]
    limitations: tuple[str, ...]
    content_hash: str

    def __post_init__(self) -> None:
        if self.publication_readiness not in {
            "verified", "disclosed", "inferred_draft"
        }:
            raise ValueError("publication_readiness_invalid")
        if self.confidence_band not in {"high", "medium", "low"}:
            raise ValueError("confidence_band_invalid")
        if _SHA256_HEX.fullmatch(self.snapshot_fingerprint) is None:
            raise ValueError("snapshot_fingerprint_invalid")
        if _SHA256_HEX.fullmatch(self.content_hash) is None:
            raise ValueError("content_hash_invalid")
        _require_nonblank(self.decree_id, "decree_id")
        for field_name in (
            "mapping_candidates", "selected_reasons", "validation_receipts",
            "source_regions", "limitations",
        ):
            values = getattr(self, field_name)
            if not isinstance(values, tuple) or any(
                not isinstance(value, str) or not value.strip() for value in values
            ):
                raise ValueError(f"{field_name}_invalid")

    def __repr__(self) -> str:
        return "AccountingWorkbookDisclosure(<redacted>)"


@dataclass(frozen=True, slots=True, repr=False)
class PendingReportArtifact:
    artifact_id: str
    owner_user_id: str
    run_id: str
    report_type: str
    period: ReportPeriod
    source_sha256: str
    file_sha256: str
    display_name: str
    file_path: Path

    def __repr__(self) -> str:
        return f"PendingReportArtifact(period={self.period!r}, <redacted>)"


@dataclass(frozen=True, slots=True, repr=False)
class PublishedReportArtifact:
    artifact_id: str
    owner_user_id: str
    run_id: str
    reply_id: str
    report_type: str
    period: ReportPeriod
    source_sha256: str
    file_sha256: str
    display_name: str
    file_path: Path
    generated_at: datetime

    def __repr__(self) -> str:
        return f"PublishedReportArtifact(period={self.period!r}, <redacted>)"
