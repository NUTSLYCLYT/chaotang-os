from __future__ import annotations

import re
import unicodedata
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from enum import StrEnum


class AShareExchange(StrEnum):
    SSE = "SSE"
    SZSE = "SZSE"
    BSE = "BSE"


class InstrumentResolutionStatus(StrEnum):
    RESOLVED = "RESOLVED"
    AMBIGUOUS = "AMBIGUOUS"
    NOT_FOUND = "NOT_FOUND"


def _is_recognizable_b_share_ticker(ticker: str) -> bool:
    return ticker.startswith(("900", "200"))


@dataclass(frozen=True, slots=True)
class InstrumentHint:
    exchange: AShareExchange | None
    ticker: str


@dataclass(frozen=True, slots=True)
class InstrumentRef:
    canonical_name: str
    exchange: AShareExchange
    ticker: str
    instrument_type: str = "A_SHARE"
    currency: str = "CNY"

    def __post_init__(self) -> None:
        if not _name(self.canonical_name):
            raise ValueError("canonical_name must not be blank")
        if re.fullmatch(r"[0-9]{6}", self.ticker, flags=re.ASCII) is None:
            raise ValueError("ticker must be exactly six ASCII digits")
        if self.instrument_type != "A_SHARE":
            raise ValueError("instrument_type must be A_SHARE")
        if self.currency != "CNY":
            raise ValueError("currency must be CNY")
        if _is_recognizable_b_share_ticker(self.ticker):
            raise ValueError("recognizable B-share ticker is not an A-share")


@dataclass(frozen=True, slots=True)
class InstrumentCandidate:
    instrument: InstrumentRef
    provider_subject: str
    aliases: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class InstrumentResolution:
    status: InstrumentResolutionStatus
    instrument: InstrumentRef | None = None
    provider_subject: str | None = None


def instrument_ref_metadata(instrument: InstrumentRef) -> dict[str, str]:
    return {
        "canonical_name": instrument.canonical_name,
        "exchange": instrument.exchange.value,
        "ticker": instrument.ticker,
        "instrument_type": instrument.instrument_type,
        "currency": instrument.currency,
    }


def instrument_ref_from_metadata(value: object) -> InstrumentRef | None:
    if not isinstance(value, Mapping) or set(value) != {
        "canonical_name",
        "exchange",
        "ticker",
        "instrument_type",
        "currency",
    }:
        return None
    try:
        return InstrumentRef(
            canonical_name=value["canonical_name"],
            exchange=AShareExchange(value["exchange"]),
            ticker=value["ticker"],
            instrument_type=value["instrument_type"],
            currency=value["currency"],
        )
    except (TypeError, ValueError):
        return None


_EXPLICIT_PATTERNS = (
    (
        re.compile(
            r"(?<![A-Z0-9])(?:SH(?:SE)?|SSE):?([0-9]{6})(?![0-9])",
            re.I,
        ),
        AShareExchange.SSE,
    ),
    (
        re.compile(r"(?<![A-Z0-9])SZ(?:SE)?:?([0-9]{6})(?![0-9])", re.I),
        AShareExchange.SZSE,
    ),
    (
        re.compile(r"(?<![A-Z0-9])B(?:J|SE):?([0-9]{6})(?![0-9])", re.I),
        AShareExchange.BSE,
    ),
    (
        re.compile(r"(?<![0-9])([0-9]{6})\.SH(?![A-Z])", re.I),
        AShareExchange.SSE,
    ),
    (
        re.compile(r"(?<![0-9])([0-9]{6})\.SZ(?![A-Z])", re.I),
        AShareExchange.SZSE,
    ),
    (
        re.compile(r"(?<![0-9])([0-9]{6})\.BJ(?![A-Z])", re.I),
        AShareExchange.BSE,
    ),
)
_BARE_TICKER = re.compile(r"(?<![0-9])([0-9]{6})(?![0-9])")
_OUT_OF_SCOPE_MARKET = re.compile(
    r"(?i)(?:\bHK[0-9]{5}\b|\b[0-9]{4,5}\.HK\b|"
    r"\b(?:NASDAQ|NYSE|AMEX|LSE|TSE|JPX):[A-Z0-9.]+\b|"
    r"香港上市|港交所|美国股票|纳斯达克|日本股票|"
    r"B\s*股|(?<![0-9])(?:200|900)[0-9]{3}(?![0-9]))"
)
_PROVIDER_NEUTRAL_US_TICKER = re.compile(
    r"(?<![A-Z0-9])(?:[A-Z]{1,6}|[A-Z]{1,5}\.[A-Z])\.US(?![A-Z0-9])"
)
_SHORT_MARKET_WITH_SUFFIX = re.compile(
    r"(?:港股|美股|日股)(?:市场|行情|价格|走势|上市|代码|标的)"
)
_SHORT_MARKET_AFTER_REQUEST = re.compile(
    r"(?:查询|查看|看看|了解|分析|关注|搜索|检索|研究|投资|买入|想看|帮我看看)"
    r"[^，。！？!?\n]{0,32}?(?:港股|美股|日股)"
    r"(?![\w\u4e00-\u9fff])"
)
_SHORT_MARKET_STANDALONE = re.compile(
    r"(?<![\w\u4e00-\u9fff])(?:港股|美股|日股)(?![\w\u4e00-\u9fff])"
)
_LEGAL_SUFFIXES = ("股份有限公司", "集团有限公司", "有限责任公司", "有限公司")


def _name(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", value).split())


def extract_instrument_hints(*texts: str) -> tuple[InstrumentHint, ...]:
    found: list[InstrumentHint] = []
    occupied: set[tuple[str, int, int]] = set()
    for raw in texts:
        text = unicodedata.normalize("NFKC", raw).upper()
        for pattern, exchange in _EXPLICIT_PATTERNS:
            for match in pattern.finditer(text):
                ticker = match.group(1)
                occupied.add((text, match.start(1), match.end(1)))
                if _is_recognizable_b_share_ticker(ticker):
                    continue
                hint = InstrumentHint(exchange=exchange, ticker=ticker)
                if hint not in found:
                    found.append(hint)
        for match in _BARE_TICKER.finditer(text):
            if (text, match.start(1), match.end(1)) in occupied:
                continue
            ticker = match.group(1)
            if _is_recognizable_b_share_ticker(ticker):
                continue
            hint = InstrumentHint(exchange=None, ticker=ticker)
            if hint not in found:
                found.append(hint)
    return tuple(found)


def has_out_of_scope_market_hint(*texts: str) -> bool:
    for text in texts:
        normalized = unicodedata.normalize("NFKC", text)
        if _PROVIDER_NEUTRAL_US_TICKER.search(normalized) is not None:
            return True
        if _OUT_OF_SCOPE_MARKET.search(normalized) is not None:
            return True
        if any(
            pattern.search(normalized) is not None
            for pattern in (
                _SHORT_MARKET_WITH_SUFFIX,
                _SHORT_MARKET_AFTER_REQUEST,
                _SHORT_MARKET_STANDALONE,
            )
        ):
            return True
    return False


def instrument_name_queries(subject: str) -> tuple[str, ...]:
    original = _name(subject)
    if not original:
        return ()
    annotation = re.search(r"\s*\(([^()]*)\)\s*$", original)
    if (
        annotation is not None
        and extract_instrument_hints(annotation.group(1))
    ):
        original = original[: annotation.start()].strip()
        if not original:
            return ()
    values = [original]
    for suffix in _LEGAL_SUFFIXES:
        if original.endswith(suffix):
            alias = original[: -len(suffix)].strip()
            if alias:
                values.append(alias)
            break
    return tuple(values)


def matches_a_share_identity(
    instrument: InstrumentRef,
    *texts: str,
) -> bool:
    if has_out_of_scope_market_hint(*texts):
        return False
    hints = extract_instrument_hints(*texts)
    if hints:
        return any(
            hint.ticker == instrument.ticker
            and (
                hint.exchange is None
                or hint.exchange is instrument.exchange
            )
            for hint in hints
        )
    requested_names = {
        _identity(name)
        for text in texts
        for name in instrument_name_queries(text)
    }
    canonical_names = {
        _identity(name)
        for name in instrument_name_queries(instrument.canonical_name)
    }
    requested_names.discard("")
    canonical_names.discard("")
    return bool(requested_names & canonical_names)


def _identity(value: str) -> str:
    return re.sub(r"[\s·・•._\-（）()]+", "", _name(value)).casefold()


def resolve_a_share(
    candidates: Iterable[InstrumentCandidate],
    *,
    hints: tuple[InstrumentHint, ...],
    accepted_names: tuple[str, ...],
) -> InstrumentResolution:
    values = tuple(candidates)
    if hints:
        explicit = tuple(
            candidate
            for candidate in values
            if any(
                candidate.instrument.ticker == hint.ticker
                and (
                    hint.exchange is None
                    or candidate.instrument.exchange is hint.exchange
                )
                for hint in hints
            )
        )
        matches = explicit
    else:
        names = {_identity(value) for value in accepted_names if _identity(value)}
        matches = tuple(
            candidate
            for candidate in values
            if _identity(candidate.instrument.canonical_name) in names
            or any(_identity(alias) in names for alias in candidate.aliases)
        )
    unique = {
        (
            candidate.instrument.exchange,
            candidate.instrument.ticker,
        ): candidate
        for candidate in matches
    }
    if not unique:
        return InstrumentResolution(InstrumentResolutionStatus.NOT_FOUND)
    if len(unique) != 1:
        return InstrumentResolution(InstrumentResolutionStatus.AMBIGUOUS)
    selected = next(iter(unique.values()))
    return InstrumentResolution(
        InstrumentResolutionStatus.RESOLVED,
        selected.instrument,
        selected.provider_subject,
    )
