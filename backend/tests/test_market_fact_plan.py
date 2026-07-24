from __future__ import annotations

import pytest

from app.agents.fact_plans import FactPlanDisposition
from app.agents.market_fact_plan import (
    compile_mainland_last_price_plan,
    extract_mainland_market_entity,
)
from app.jinyiwei.models import (
    DataGapDraft,
    DataScope,
    FactCategory,
    FreshnessRequirement,
    MarketMetric,
    RequiredFact,
    SourceType,
)


def test_byd_price_decree_compiles_one_canonical_fact() -> None:
    result = compile_mainland_last_price_plan(
        decree_text="帮我看看比亚迪的股票价格",
        node_id="bureau:户部:投资司",
    )

    assert result.disposition is FactPlanDisposition.PLANNED
    assert result.reason is None
    assert result.source_scope == (SourceType.SHIGUAN, SourceType.MCP)
    assert result.draft == DataGapDraft(
        requesting_agent="bureau:户部:投资司",
        question="帮我看看比亚迪的股票价格",
        required_facts=(
            RequiredFact(
                key="market_quote:last_price",
                description="查询比亚迪在中国大陆证券市场的最新可得价格",
                category=FactCategory.MARKET_QUOTE,
                data_scope=DataScope.EXTERNAL_PUBLIC,
                subject="比亚迪",
                jurisdiction="CN",
                expected_unit="CNY",
                expected_shape="number",
                market_metric=MarketMetric.LAST_PRICE,
            ),
        ),
        decision_context="回答明确证券行情查询",
        freshness=FreshnessRequirement(max_age_seconds=3600),
    )


@pytest.mark.parametrize(
    ("decree_text", "subject"),
    (
        ("贵州茅台的股价是多少", "贵州茅台"),
        ("查询 600519.SH 股票价格", "600519.SH"),
    ),
)
def test_name_or_explicit_ticker_compiles_the_same_canonical_shape(
    decree_text: str,
    subject: str,
) -> None:
    result = compile_mainland_last_price_plan(
        decree_text=decree_text,
        node_id="bureau:户部:投资司",
    )

    assert result.disposition is FactPlanDisposition.PLANNED
    assert result.draft is not None
    assert result.draft.required_facts[0] == RequiredFact(
        key="market_quote:last_price",
        description=f"查询{subject}在中国大陆证券市场的最新可得价格",
        category=FactCategory.MARKET_QUOTE,
        data_scope=DataScope.EXTERNAL_PUBLIC,
        subject=subject,
        jurisdiction="CN",
        expected_unit="CNY",
        expected_shape="number",
        market_metric=MarketMetric.LAST_PRICE,
    )


def test_non_market_decree_is_not_applicable() -> None:
    result = compile_mainland_last_price_plan(
        decree_text="评估年度预算",
        node_id="bureau:户部:投资司",
    )

    assert result.disposition is FactPlanDisposition.NOT_APPLICABLE
    assert result.draft is None
    assert result.source_scope == ()
    assert result.reason is None


@pytest.mark.parametrize(
    "decree_text",
    (
        "查询 1211.HK 股票价格",
        "查询 AAPL.US 股票价格",
        "查询港股价格",
        "查询 900901 股票价格",
    ),
)
def test_explicit_out_of_scope_market_is_rejected(decree_text: str) -> None:
    result = compile_mainland_last_price_plan(
        decree_text=decree_text,
        node_id="bureau:户部:投资司",
    )

    assert result.disposition is FactPlanDisposition.REJECTED
    assert result.draft is None
    assert result.source_scope == ()
    assert result.reason == "market_out_of_scope"


@pytest.mark.parametrize("extracted", ("", "   "))
def test_empty_extracted_entity_is_rejected(extracted: str) -> None:
    result = compile_mainland_last_price_plan(
        decree_text="请问这只股票价格",
        node_id="bureau:户部:投资司",
        entity_extractor=lambda _: extracted,
    )

    assert result.disposition is FactPlanDisposition.REJECTED
    assert result.draft is None
    assert result.source_scope == ()
    assert result.reason == "entity_ambiguous"


def test_ambiguous_decree_with_no_extracted_entity_is_rejected() -> None:
    result = compile_mainland_last_price_plan(
        decree_text="请查询相关证券行情价格",
        node_id="bureau:户部:投资司",
        entity_extractor=lambda _: None,
    )

    assert result.disposition is FactPlanDisposition.REJECTED
    assert result.draft is None
    assert result.source_scope == ()
    assert result.reason == "entity_ambiguous"


def test_invalid_canonical_draft_is_rejected_with_stable_reason() -> None:
    result = compile_mainland_last_price_plan(
        decree_text="查询贵州茅台股票价格",
        node_id=" ",
    )

    assert result.disposition is FactPlanDisposition.REJECTED
    assert result.draft is None
    assert result.source_scope == ()
    assert result.reason == "data_plan_invalid"


def test_narrow_entity_extractor_corrects_one_invalid_format_without_echo() -> None:
    calls: list[list[dict[str, str]]] = []
    responses = iter(
        (
            "invalid-private-output",
            '{"entity_type":"name","value":"比亚迪"}',
        )
    )

    def model(messages):
        calls.append(messages)
        return next(responses)

    assert (
        extract_mainland_market_entity(
            "关于比亚迪这只证券，现价是多少",
            model,
        )
        == "比亚迪"
    )
    assert len(calls) == 2
    assert "invalid-private-output" not in str(calls[1])
    assert "entity_type" in calls[0][0]["content"]


@pytest.mark.parametrize(
    "response",
    (
        '{"entity_type":"name","value":" "}',
        '{"entity_type":"name","value":"帮我查询股票价格"}',
        '{"entity_type":"ticker","value":"600519.SH 000001.SZ"}',
        '{"entity_type":"ticker","value":"1211.HK"}',
        '{"entity_type":"name","value":"AAPL.US"}',
    ),
)
def test_narrow_entity_extractor_rejects_unsafe_values_without_retry(response) -> None:
    calls = 0

    def model(_messages):
        nonlocal calls
        calls += 1
        return response

    assert extract_mainland_market_entity("请查证券现价", model) is None
    assert calls == 1


def test_narrow_entity_extractor_does_not_retry_transport_failure() -> None:
    calls = 0

    def model(_messages):
        nonlocal calls
        calls += 1
        raise RuntimeError("private transport detail")

    assert extract_mainland_market_entity("请查证券现价", model) is None
    assert calls == 1


@pytest.mark.parametrize(
    "decree_text",
    ("帮我看看比亚迪的股票价格", "查询 600519.SH 股票价格"),
)
def test_rule_resolved_entities_never_call_fallback_extractor(decree_text) -> None:
    result = compile_mainland_last_price_plan(
        decree_text=decree_text,
        node_id="bureau:户部:投资司",
        entity_extractor=lambda _text: pytest.fail("extractor must not run"),
    )

    assert result.disposition is FactPlanDisposition.PLANNED
