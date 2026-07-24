import pytest

from app.jinyiwei.instruments import (
    AShareExchange,
    InstrumentCandidate,
    InstrumentHint,
    InstrumentRef,
    InstrumentResolutionStatus,
    extract_instrument_hints,
    has_out_of_scope_market_hint,
    instrument_name_queries,
    resolve_a_share,
)


def test_extracts_equivalent_szse_identifiers() -> None:
    for text in ("002594.SZ", "SZSE:002594", "sz002594"):
        assert extract_instrument_hints(text) == (
            InstrumentHint(exchange=AShareExchange.SZSE, ticker="002594"),
        )


def test_extracts_sse_and_bse_identifiers_without_prefix_guessing() -> None:
    assert extract_instrument_hints("600519.SH") == (
        InstrumentHint(exchange=AShareExchange.SSE, ticker="600519"),
    )
    assert extract_instrument_hints("BSE:430047") == (
        InstrumentHint(exchange=AShareExchange.BSE, ticker="430047"),
    )
    assert extract_instrument_hints("代码 002594") == (
        InstrumentHint(exchange=None, ticker="002594"),
    )


def test_extracts_all_supported_sse_prefixes() -> None:
    for text in ("SH600519", "SHSE:600519", "SSE:600519"):
        assert extract_instrument_hints(text) == (
            InstrumentHint(exchange=AShareExchange.SSE, ticker="600519"),
        )


def test_detects_explicit_non_mainland_market_identifiers() -> None:
    assert has_out_of_scope_market_hint("1211.HK")
    assert has_out_of_scope_market_hint("hk01211")
    assert has_out_of_scope_market_hint("NASDAQ:AAPL")
    assert has_out_of_scope_market_hint("AAPL.US")
    assert not has_out_of_scope_market_hint("002594.SZ")


@pytest.mark.parametrize(
    "text",
    (
        "Learn more at about.us",
        "Please contact.us about the request",
        "句子以.us结尾",
    ),
)
def test_prose_ending_in_dot_us_is_not_a_market_hint(text: str) -> None:
    assert not has_out_of_scope_market_hint(text)


@pytest.mark.parametrize(
    "text",
    (
        "查询比亚迪港股",
        "查询比亚迪美股",
        "比亚迪B股",
        "200002.SZ",
        "900901.SH",
    ),
)
def test_detects_natural_language_and_b_share_out_of_scope_hints(
    text: str,
) -> None:
    assert has_out_of_scope_market_hint(text)


@pytest.mark.parametrize(
    "text",
    (
        "青岛港股份有限公司",
        "完美股份有限公司",
        "比亚迪今日股价",
        "贵州茅台近日股价",
    ),
)
def test_short_market_words_do_not_match_inside_mainland_names_or_price_phrases(
    text: str,
) -> None:
    assert not has_out_of_scope_market_hint(text)


@pytest.mark.parametrize(
    "text",
    ("比亚迪港股价格", "阿里巴巴美股行情", "丰田汽车日股走势"),
)
def test_short_market_words_still_match_explicit_market_phrases(text: str) -> None:
    assert has_out_of_scope_market_hint(text)


@pytest.mark.parametrize(
    "text",
    (
        "查询今日股票价格",
        "分析近日股票走势",
        "青岛港股东大会",
    ),
)
def test_embedded_short_market_tokens_need_positive_market_context(
    text: str,
) -> None:
    assert not has_out_of_scope_market_hint(text)


@pytest.mark.parametrize(
    "text",
    (
        "查询港股",
        "看看美股",
        "日股行情",
        "比亚迪港股价格",
        "（港股）",
    ),
)
def test_short_market_tokens_match_auditable_positive_context(text: str) -> None:
    assert has_out_of_scope_market_hint(text)


def test_name_queries_are_original_plus_one_controlled_alias() -> None:
    assert instrument_name_queries(" 比亚迪股份有限公司 ") == (
        "比亚迪股份有限公司",
        "比亚迪",
    )
    assert instrument_name_queries("贵州茅台") == ("贵州茅台",)
    assert instrument_name_queries("股份有限公司") == ("股份有限公司",)


def test_name_queries_remove_one_explicit_ticker_before_legal_aliasing() -> None:
    assert instrument_name_queries("比亚迪股份有限公司（002594.SZ）") == (
        "比亚迪股份有限公司",
        "比亚迪",
    )


def _candidate(
    name: str,
    exchange: AShareExchange,
    ticker: str,
    subject: str,
) -> InstrumentCandidate:
    return InstrumentCandidate(
        instrument=InstrumentRef(
            canonical_name=name,
            exchange=exchange,
            ticker=ticker,
        ),
        provider_subject=subject,
    )


def test_explicit_exchange_and_ticker_win_over_name_variation() -> None:
    result = resolve_a_share(
        (
            _candidate("比亚迪", AShareExchange.SZSE, "002594", "sz002594"),
            _candidate("另一公司", AShareExchange.SSE, "002594", "sh002594"),
        ),
        hints=(InstrumentHint(AShareExchange.SZSE, "002594"),),
        accepted_names=("比亚迪股份有限公司", "比亚迪"),
    )
    assert result.status is InstrumentResolutionStatus.RESOLVED
    assert result.instrument == InstrumentRef(
        canonical_name="比亚迪",
        exchange=AShareExchange.SZSE,
        ticker="002594",
    )
    assert result.provider_subject == "sz002594"


def test_name_alias_can_resolve_only_one_a_share_candidate() -> None:
    result = resolve_a_share(
        (_candidate("比亚迪", AShareExchange.SZSE, "002594", "sz002594"),),
        hints=(),
        accepted_names=("比亚迪股份有限公司", "比亚迪"),
    )
    assert result.status is InstrumentResolutionStatus.RESOLVED


def test_multiple_matching_candidates_are_ambiguous() -> None:
    result = resolve_a_share(
        (
            _candidate("同名科技", AShareExchange.SSE, "600001", "sh600001"),
            _candidate("同名科技", AShareExchange.SZSE, "000001", "sz000001"),
        ),
        hints=(),
        accepted_names=("同名科技",),
    )
    assert result.status is InstrumentResolutionStatus.AMBIGUOUS
    assert result.instrument is None


@pytest.mark.parametrize(
    ("instrument_type", "currency"),
    (
        ("FUND", "CNY"),
        ("B_SHARE", "CNY"),
        ("A_SHARE", "HKD"),
    ),
)
def test_instrument_ref_rejects_non_a_share_or_non_cny(
    instrument_type: str,
    currency: str,
) -> None:
    with pytest.raises(ValueError):
        InstrumentRef(
            canonical_name="非法标的",
            exchange=AShareExchange.SSE,
            ticker="600000",
            instrument_type=instrument_type,
            currency=currency,
        )


@pytest.mark.parametrize(
    ("exchange", "ticker"),
    (
        (AShareExchange.SSE, "900901"),
        (AShareExchange.SZSE, "200002"),
    ),
)
def test_instrument_ref_rejects_recognizable_b_share_tickers(
    exchange: AShareExchange,
    ticker: str,
) -> None:
    with pytest.raises(ValueError):
        InstrumentRef(
            canonical_name="B股标的",
            exchange=exchange,
            ticker=ticker,
        )


@pytest.mark.parametrize(
    ("canonical_name", "ticker"),
    (
        ("", "600000"),
        ("   ", "600000"),
        ("合法名称", "60000"),
        ("合法名称", "6000000"),
        ("合法名称", "６０００００"),
        ("合法名称", "ABC000"),
    ),
)
def test_instrument_ref_rejects_blank_name_or_noncanonical_ticker(
    canonical_name: str,
    ticker: str,
) -> None:
    with pytest.raises(ValueError):
        InstrumentRef(
            canonical_name=canonical_name,
            exchange=AShareExchange.SSE,
            ticker=ticker,
        )


@pytest.mark.parametrize(
    "text",
    (
        "900901.SH",
        "SH900901",
        "代码 900901",
        "200002.SZ",
        "SZ200002",
        "代码 200002",
    ),
)
def test_recognizable_b_share_identifiers_are_not_a_share_hints(
    text: str,
) -> None:
    assert extract_instrument_hints(text) == ()
