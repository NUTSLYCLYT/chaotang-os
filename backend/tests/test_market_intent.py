import pytest

from app.agents.market_intent import (
    is_mainland_last_price_intent,
    is_market_quote_intent,
    normalize_market_quote_route,
    prioritize_market_quote_bureaus,
    requested_market_metrics,
)
from app.jinyiwei.models import MarketMetric


def test_stock_price_intent_normalizes_to_single_household_ministry() -> None:
    assert normalize_market_quote_route(
        decree_text="帮我看看比亚迪的股票价格",
        route_type="multi",
        rationale="模型误判",
        departments=("吏部", "工部"),
    ) == (
        "single",
        "证券行情查询由户部办理",
        ("户部",),
    )


@pytest.mark.parametrize(
    "text",
    ["调整产品价格", "安排人员投资培训", "查看公司新闻", "评估年度预算"],
)
def test_non_market_text_does_not_match(text: str) -> None:
    assert not is_market_quote_intent(text)


def test_non_market_route_is_unchanged() -> None:
    assert normalize_market_quote_route(
        decree_text="调整产品价格",
        route_type="multi",
        rationale="需要联合办理",
        departments=("户部", "工部"),
    ) == (
        "multi",
        "需要联合办理",
        ("户部", "工部"),
    )


def test_market_bureau_policy_puts_investment_first_without_duplicates() -> None:
    assert prioritize_market_quote_bureaus(
        department="户部",
        decree_text="查询 BYD stock price",
        bureaus=("预算司", "投资司"),
    ) == ("投资司", "预算司")


def test_non_household_market_bureaus_are_unchanged() -> None:
    assert prioritize_market_quote_bureaus(
        department="工部",
        decree_text="查询 BYD stock price",
        bureaus=("营缮清吏司", "都水清吏司"),
    ) == ("营缮清吏司", "都水清吏司")


def test_non_market_household_bureaus_are_unchanged() -> None:
    assert prioritize_market_quote_bureaus(
        department="户部",
        decree_text="评估年度预算",
        bureaus=("预算司", "投资司"),
    ) == ("预算司", "投资司")


def test_price_only_decree_requests_only_last_price() -> None:
    assert requested_market_metrics("帮我看看比亚迪的股票价格") == (
        MarketMetric.LAST_PRICE,
    )


@pytest.mark.parametrize(
    "text",
    (
        "比亚迪股票多少钱",
        "比亚迪股票值多少钱",
        "比亚迪股票现在多少",
    ),
)
def test_natural_price_question_requests_only_last_price(text: str) -> None:
    assert requested_market_metrics(text) == (MarketMetric.LAST_PRICE,)


def test_price_and_volume_request_keeps_both_metrics() -> None:
    assert requested_market_metrics("查一下比亚迪股价和成交量") == (
        MarketMetric.LAST_PRICE,
        MarketMetric.VOLUME,
    )


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("查询比亚迪股票涨幅", (MarketMetric.CHANGE_PERCENT,)),
        ("查看比亚迪股票分时走势", (MarketMetric.INTRADAY_SERIES,)),
        ("查询比亚迪股票市盈率", (MarketMetric.PE_RATIO,)),
        ("查询比亚迪股票市净率", (MarketMetric.PB_RATIO,)),
        ("查询比亚迪股票市值", (MarketMetric.MARKET_CAP,)),
        ("查询比亚迪股票30日走势", (MarketMetric.PRICE_TREND_30D,)),
    ],
)
def test_market_decree_requests_only_explicit_metric(
    text: str, expected: tuple[MarketMetric, ...]
) -> None:
    assert requested_market_metrics(text) == expected


def test_non_market_text_has_no_market_metric_scope() -> None:
    assert requested_market_metrics("介绍比亚迪公司历史") == ()


@pytest.mark.parametrize("text", ["open stock price", "shape stock price"])
def test_short_pe_token_does_not_match_inside_another_word(text: str) -> None:
    assert requested_market_metrics(text) == (MarketMetric.LAST_PRICE,)


@pytest.mark.parametrize("text", ["livestock price", "sticker price"])
def test_security_terms_do_not_match_inside_another_word(text: str) -> None:
    assert not is_market_quote_intent(text)
    assert requested_market_metrics(text) == ()


def test_normal_english_market_tokens_still_match() -> None:
    assert requested_market_metrics("BYD stock PE ratio") == (
        MarketMetric.PE_RATIO,
    )
    assert requested_market_metrics("BYD stock price") == (
        MarketMetric.LAST_PRICE,
    )


@pytest.mark.parametrize(
    "text",
    (
        "帮我看看比亚迪的股票价格",
        "贵州茅台的股价是多少",
        "查询 600519.SH 股票价格",
    ),
)
def test_mainland_last_price_slice_is_supported(text: str) -> None:
    assert is_mainland_last_price_intent(text)


@pytest.mark.parametrize(
    "text",
    (
        "评估年度预算",
        "查询比亚迪股价和成交量",
        "查询 1211.HK 股票价格",
        "查询港股价格",
        "查询 900901 股票价格",
    ),
)
def test_non_price_or_out_of_scope_market_slice_is_not_supported(text: str) -> None:
    assert not is_mainland_last_price_intent(text)
