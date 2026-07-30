from __future__ import annotations

import json
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from types import MappingProxyType

MIN_REPORT_YEAR = 2000
MAX_REPORT_YEAR = 2100


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


@dataclass(frozen=True, slots=True)
class ReportPeriod:
    start_year: int
    end_year: int

    def __post_init__(self) -> None:
        _validate_year(self.start_year, "start_year")
        _validate_year(self.end_year, "end_year")
        if self.start_year > self.end_year:
            raise ValueError("report period must not be reversed")


@dataclass(frozen=True, slots=True)
class ReportIntent:
    requested: bool
    period: ReportPeriod | None

    def __post_init__(self) -> None:
        if not isinstance(self.requested, bool):
            raise TypeError("requested must be a boolean")
        if self.requested != (self.period is not None):
            raise ValueError("requested and period must describe the same intent")


@dataclass(frozen=True, slots=True)
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


@dataclass(frozen=True, slots=True)
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


@dataclass(frozen=True, slots=True)
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


@dataclass(frozen=True, slots=True)
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


@dataclass(frozen=True, slots=True)
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
