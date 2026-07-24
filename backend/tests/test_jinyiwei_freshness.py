"""Shared freshness policy tests."""

from datetime import UTC, datetime

import pytest

from app.jinyiwei.freshness import is_evidence_fresh
from app.jinyiwei.models import (
    DataGapRequest,
    DataScope,
    FactCategory,
    FreshnessRequirement,
    RequiredFact,
    SourceType,
)

NOW = datetime(2026, 7, 23, 14, 56, tzinfo=UTC)


def _request(
    *,
    category: FactCategory = FactCategory.MARKET_QUOTE,
    max_age_seconds: int = 300,
    not_before: str | None = None,
) -> DataGapRequest:
    return DataGapRequest(
        request_id="freshness-policy",
        requesting_agent="hubu",
        question="fact needed",
        required_facts=(
            RequiredFact(
                key="byd_stock_price",
                description="BYD stock price",
                category=category,
                data_scope=DataScope.EXTERNAL_PUBLIC,
                subject="sz002594",
                market_metric=(
                    "LAST_PRICE"
                    if category is FactCategory.MARKET_QUOTE
                    else None
                ),
            ),
        ),
        decision_context="decision",
        freshness=FreshnessRequirement(
            max_age_seconds=max_age_seconds,
            not_before=not_before,
        ),
        timeout_seconds=30,
        source_scope=(
            SourceType.SHIGUAN,
            SourceType.MCP,
            SourceType.PUBLIC_API,
        ),
    )


@pytest.mark.parametrize("source_type", (SourceType.MCP, SourceType.PUBLIC_API))
def test_freshly_retrieved_market_close_is_latest_available_after_close(
    source_type: SourceType,
) -> None:
    assert is_evidence_fresh(
        as_of="2026-07-23T07:00:00Z",
        retrieved_at="2026-07-23T14:55:00Z",
        request=_request(),
        fact_key="byd_stock_price",
        source_type=source_type,
        now=NOW,
    )


def test_old_retrieval_never_becomes_fresh_because_market_is_closed() -> None:
    assert not is_evidence_fresh(
        as_of="2026-07-23T07:00:00Z",
        retrieved_at="2026-07-23T14:40:00Z",
        request=_request(),
        fact_key="byd_stock_price",
        source_type=SourceType.MCP,
        now=NOW,
    )


def test_shiguan_market_snapshot_keeps_strict_as_of_freshness() -> None:
    assert not is_evidence_fresh(
        as_of="2026-07-23T07:00:00Z",
        retrieved_at="2026-07-23T14:55:00Z",
        request=_request(),
        fact_key="byd_stock_price",
        source_type=SourceType.SHIGUAN,
        now=NOW,
    )


def test_non_market_fact_keeps_strict_as_of_freshness() -> None:
    assert not is_evidence_fresh(
        as_of="2026-07-23T07:00:00Z",
        retrieved_at="2026-07-23T14:55:00Z",
        request=_request(category=FactCategory.NEWS_EVENT),
        fact_key="byd_stock_price",
        source_type=SourceType.PUBLIC_API,
        now=NOW,
    )


@pytest.mark.parametrize(
    ("as_of", "retrieved_at"),
    (
        ("2026-07-23T14:57:00Z", "2026-07-23T14:55:00Z"),
        ("2026-07-23T07:00:00Z", "2026-07-23T14:57:00Z"),
    ),
)
def test_future_market_timestamp_is_rejected(
    as_of: str,
    retrieved_at: str,
) -> None:
    assert not is_evidence_fresh(
        as_of=as_of,
        retrieved_at=retrieved_at,
        request=_request(),
        fact_key="byd_stock_price",
        source_type=SourceType.MCP,
        now=NOW,
    )


def test_market_observation_older_than_hard_cap_is_rejected() -> None:
    assert not is_evidence_fresh(
        as_of="2026-07-09T14:55:59Z",
        retrieved_at="2026-07-23T14:55:00Z",
        request=_request(),
        fact_key="byd_stock_price",
        source_type=SourceType.MCP,
        now=NOW,
    )


def test_market_observation_before_not_before_is_rejected() -> None:
    assert not is_evidence_fresh(
        as_of="2026-07-23T07:00:00Z",
        retrieved_at="2026-07-23T14:55:00Z",
        request=_request(not_before="2026-07-23T08:00:00Z"),
        fact_key="byd_stock_price",
        source_type=SourceType.MCP,
        now=NOW,
    )
