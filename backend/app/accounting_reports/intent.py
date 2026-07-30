from __future__ import annotations

import re

from .models import ReportIntent, ReportPeriod

_DOMAIN_SIGNALS = ("财务", "会计", "科目", "资产负债", "利润", "现金流")
_DELIVERABLE_SIGNALS = ("财务报告", "管理报告", "excel")
_DELIVERABLE_PATTERN = re.compile(r"(?:生成|下载)[^。！？\n]{0,40}(?:报表|表格)")
_YEAR_RANGE = re.compile(r"(?P<start>\d{4})\s*(?:年至|至|-)\s*(?P<end>\d{4})年?")
_YEAR = re.compile(r"(?<!\d)(\d{4})年?(?!\d)")


def _extract_period(text: str) -> ReportPeriod | None:
    years = [int(year) for year in _YEAR.findall(text)]
    ranges = list(_YEAR_RANGE.finditer(text))
    if len(ranges) == 1 and len(years) == 2:
        match = ranges[0]
        start_year = int(match.group("start"))
        end_year = int(match.group("end"))
    elif not ranges and len(years) == 1:
        start_year = end_year = years[0]
    else:
        return None

    try:
        return ReportPeriod(start_year, end_year)
    except (TypeError, ValueError):
        return None


def detect_accounting_report_intent(decree_text: str) -> ReportIntent:
    if not isinstance(decree_text, str) or not decree_text.strip():
        return ReportIntent(requested=False, period=None)

    normalized = decree_text.strip().lower()
    has_domain = any(signal in normalized for signal in _DOMAIN_SIGNALS)
    has_deliverable = any(
        signal in normalized for signal in _DELIVERABLE_SIGNALS
    ) or bool(_DELIVERABLE_PATTERN.search(normalized))
    if not has_domain or not has_deliverable:
        return ReportIntent(requested=False, period=None)

    period = _extract_period(normalized)
    if period is None:
        return ReportIntent(requested=False, period=None)
    return ReportIntent(requested=True, period=period)
