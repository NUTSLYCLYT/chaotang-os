import re
from collections.abc import Sequence

from app.jinyiwei.instruments import has_out_of_scope_market_hint
from app.jinyiwei.models import MarketMetric

_SECURITY_TERMS = ("股票", "股价", "证券", "行情", "stock", "share", "ticker")
_QUOTE_TERMS = (
    "价格",
    "股价",
    "现价",
    "报价",
    "成交量",
    "涨跌幅",
    "涨幅",
    "跌幅",
    "分时",
    "走势",
    "市盈率",
    "市净率",
    "市值",
    "多少",
    "quote",
    "price",
    "volume",
    "change percent",
    "intraday",
    "pe ratio",
    "pb ratio",
    "market cap",
)
_METRIC_TERMS: tuple[tuple[MarketMetric, tuple[str, ...]], ...] = (
    (MarketMetric.LAST_PRICE, ("价格", "股价", "现价", "报价", "price", "quote")),
    (MarketMetric.VOLUME, ("成交量", "volume")),
    (
        MarketMetric.CHANGE_PERCENT,
        ("涨跌幅", "涨幅", "跌幅", "change percent"),
    ),
    (MarketMetric.INTRADAY_SERIES, ("分时", "日内走势", "intraday")),
    (MarketMetric.PE_RATIO, ("市盈率", "pe ratio", "pe")),
    (MarketMetric.PB_RATIO, ("市净率", "pb ratio", "pb")),
    (MarketMetric.MARKET_CAP, ("市值", "market cap")),
    (
        MarketMetric.PRICE_TREND_30D,
        ("30日走势", "一个月走势", "月度走势"),
    ),
)


def is_market_quote_intent(text: str) -> bool:
    normalized = text.casefold()
    return any(_contains_term(normalized, term) for term in _SECURITY_TERMS) and any(
        _contains_term(normalized, term) for term in _QUOTE_TERMS
    )


def requested_market_metrics(decree_text: str) -> tuple[MarketMetric, ...]:
    """Return only market metrics explicitly named by a quote decree."""

    if not is_market_quote_intent(decree_text):
        return ()
    normalized = decree_text.casefold()
    explicit = tuple(
        metric
        for metric, terms in _METRIC_TERMS
        if any(_contains_term(normalized, term) for term in terms)
    )
    if explicit:
        return explicit
    if "多少钱" in normalized or "多少" in normalized:
        return (MarketMetric.LAST_PRICE,)
    return ()


def is_mainland_last_price_intent(text: str) -> bool:
    return (
        requested_market_metrics(text) == (MarketMetric.LAST_PRICE,)
        and not has_out_of_scope_market_hint(text)
    )


def _contains_term(normalized_text: str, term: str) -> bool:
    if not term.isascii():
        return term in normalized_text
    return (
        re.search(
            rf"(?<![a-z0-9_]){re.escape(term)}(?![a-z0-9_])",
            normalized_text,
        )
        is not None
    )


def normalize_market_quote_route(
    *,
    decree_text: str,
    route_type: str,
    rationale: str,
    departments: Sequence[str],
) -> tuple[str, str, tuple[str, ...]]:
    if not is_market_quote_intent(decree_text):
        return route_type, rationale, tuple(departments)
    return "single", "证券行情查询由户部办理", ("户部",)


def prioritize_market_quote_bureaus(
    *,
    department: str,
    decree_text: str,
    bureaus: Sequence[str],
) -> tuple[str, ...]:
    selected = tuple(bureaus)
    if department != "户部" or not is_market_quote_intent(decree_text):
        return selected
    return ("投资司", *(bureau for bureau in selected if bureau != "投资司"))
