from __future__ import annotations

import re

from .models import (
    AccountingRequestKind,
    ReportIntent,
    ReportIntentKind,
    ReportPeriod,
)

_DOMAIN_SIGNALS = ("财务", "会计", "科目", "资产负债", "利润", "现金流")
_DELIVERABLE_PATTERN = re.compile(
    r"(?:生成|下载|提供|交付)[^。！？\n]{0,60}"
    r"(?:财务报告|管理报告|报表|报告|表格|excel)"
)
_LOCAL_DATA_SIGNALS = ("本地", "系统内", "既有", "现有")
_ANALYSIS_SIGNALS = ("分析", "研判")
_YEAR_RANGE = re.compile(r"(?P<start>\d{4})\s*(?:年至|至|-)\s*(?P<end>\d{4})年?")
_YEAR = re.compile(r"(?<!\d)(\d{4})年?(?!\d)")
_RELATIVE_PERIODS = ("上一完整年度", "上一年度", "去年")
_RELATIVE_PERIOD_WITH_MODIFIER = re.compile(
    r"(?:上一完整年度|上一年度|去年)"
    r"(?:"
    r"全年|同期|年(?:初|中|末|底)|(?:上|下)半年"
    r"|(?:第?[一二三四]|[1-4])\s*季度"
    r"|(?:初|中|末|底)(?=\s*(?:的\s*)?"
    r"(?:财务|会计|科目|资产负债|利润|现金流|报表|报告|表格|excel|[，。！？、]|$))"
    r")"
)
_UNSUPPORTED_PERIOD = re.compile(
    r"(?:"
    r"[〇零一二三四五六七八九十两]{2,}年"
    r"|(?<!\d)\d{2}年(?!\d)"
    r"|(?<!\d)\d{4}\s*[-./]\s*\d{1,2}\s*[-./]\s*\d{1,2}(?!\d)"
    r"|\d{2,4}\s*/\s*\d{2,4}"
    r"|\d{4}\s*年\s*\d{1,2}\s*月(?:\s*\d{1,2}\s*日)?"
    r"|(?:今年|本年(?:度)?|明年|下一年度|本月|上月|下月)"
    r"|(?:上|下)半年"
    r"|(?:第?[一二三四]|[1-4])\s*季度"
    r"|年(?:初|中|末|底)"
    r")"
)
_PERIOD_LIKE = re.compile(r"(?:\d{4}|\d{1,2}\s*[年月日]|年度)")


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
        return ReportIntent(ReportIntentKind.NOT_REQUESTED, None)

    normalized = decree_text.strip().lower()
    has_domain = any(signal in normalized for signal in _DOMAIN_SIGNALS)
    has_deliverable = bool(_DELIVERABLE_PATTERN.search(normalized))
    request_kind = AccountingRequestKind.NOT_REQUESTED
    if has_domain and has_deliverable:
        request_kind = AccountingRequestKind.ACCOUNTING_REPORT
    elif (
        has_domain
        and "数据" in normalized
        and any(signal in normalized for signal in _LOCAL_DATA_SIGNALS)
        and any(signal in normalized for signal in _ANALYSIS_SIGNALS)
    ):
        request_kind = AccountingRequestKind.ACCOUNTING_ANALYSIS
    if request_kind is AccountingRequestKind.NOT_REQUESTED:
        return ReportIntent(ReportIntentKind.NOT_REQUESTED, None)

    relative_periods = [
        period for period in _RELATIVE_PERIODS if period in normalized
    ]
    if relative_periods:
        relative_occurrences = sum(
            normalized.count(period) for period in _RELATIVE_PERIODS
        )
        if relative_occurrences != 1 or _RELATIVE_PERIOD_WITH_MODIFIER.search(
            normalized
        ):
            return ReportIntent(ReportIntentKind.INVALID_PERIOD, None, request_kind)
        without_relative = normalized
        for relative_period in relative_periods:
            without_relative = without_relative.replace(relative_period, "")
        if _UNSUPPORTED_PERIOD.search(without_relative) or _PERIOD_LIKE.search(
            without_relative
        ):
            return ReportIntent(ReportIntentKind.INVALID_PERIOD, None, request_kind)
        return ReportIntent(ReportIntentKind.MISSING_PERIOD, None, request_kind)

    if _UNSUPPORTED_PERIOD.search(normalized):
        return ReportIntent(ReportIntentKind.INVALID_PERIOD, None, request_kind)

    period = _extract_period(normalized)
    if period is not None:
        return ReportIntent(ReportIntentKind.EXPLICIT_PERIOD, period, request_kind)
    if _PERIOD_LIKE.search(normalized):
        return ReportIntent(ReportIntentKind.INVALID_PERIOD, None, request_kind)
    return ReportIntent(ReportIntentKind.MISSING_PERIOD, None, request_kind)
