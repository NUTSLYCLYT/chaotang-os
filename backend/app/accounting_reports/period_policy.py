from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import date
from enum import StrEnum
from pathlib import Path

from .models import (
    ReportIntent,
    ReportIntentKind,
    ReportPeriod,
)
from .sources import AccountingSourceError, load_ledger_rows

LedgerLoader = Callable[[Path, ReportPeriod], object]


class PeriodResolutionStatus(StrEnum):
    RESOLVED = "RESOLVED"
    NEEDS_INPUT = "NEEDS_INPUT"
    NOT_REQUESTED = "NOT_REQUESTED"


@dataclass(frozen=True, slots=True)
class AccountingPeriodResolution:
    status: PeriodResolutionStatus
    period: ReportPeriod | None
    used_default: bool
    reason: str | None = None
    dataset: object | None = None
    source_fingerprint: str | None = None


def resolve_accounting_report_period(
    intent: ReportIntent,
    *,
    reference_date: date,
    source_dir: Path,
    loader: LedgerLoader = load_ledger_rows,
) -> AccountingPeriodResolution:
    if intent.kind is ReportIntentKind.NOT_REQUESTED:
        return AccountingPeriodResolution(
            PeriodResolutionStatus.NOT_REQUESTED,
            None,
            False,
            None,
        )
    if intent.kind is ReportIntentKind.INVALID_PERIOD:
        return AccountingPeriodResolution(
            PeriodResolutionStatus.NEEDS_INPUT,
            None,
            False,
            "invalid_period",
        )
    used_default = intent.kind is ReportIntentKind.MISSING_PERIOD
    period = (
        ReportPeriod(reference_date.year - 1, reference_date.year - 1)
        if used_default
        else intent.period
    )
    if period is None:
        raise ValueError("requested accounting period must be retained")
    try:
        dataset = loader(source_dir, period)
    except AccountingSourceError:
        dataset = None
    if dataset is None or (isinstance(dataset, Sequence) and not dataset):
        return AccountingPeriodResolution(
            PeriodResolutionStatus.NEEDS_INPUT,
            period,
            used_default,
            (
                "previous_complete_year_unavailable"
                if used_default
                else "requested_period_unavailable"
            ),
        )
    subject_identity = getattr(dataset, "subject_identity", None)
    if (
        not isinstance(subject_identity, str)
        or not subject_identity.strip()
        or subject_identity != subject_identity.strip()
    ):
        return AccountingPeriodResolution(
            PeriodResolutionStatus.NEEDS_INPUT,
            period,
            used_default,
            "subject_identity_unresolved",
        )
    manifest = getattr(dataset, "manifest", None)
    source_fingerprint = getattr(manifest, "fingerprint", None)
    return AccountingPeriodResolution(
        PeriodResolutionStatus.RESOLVED,
        period,
        used_default,
        None,
        dataset,
        source_fingerprint,
    )
