"""Shared freshness policy for source candidates and adopted evidence."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.jinyiwei.models import DataGapRequest, FactCategory, SourceType

_LATEST_MARKET_SOURCES = frozenset({SourceType.MCP, SourceType.PUBLIC_API})
_MARKET_OBSERVATION_HARD_CAP = timedelta(days=14)


def is_evidence_fresh(
    *,
    as_of: str,
    retrieved_at: str,
    request: DataGapRequest,
    fact_key: str,
    source_type: SourceType,
    now: datetime,
) -> bool:
    """Return whether evidence satisfies the request's freshness contract."""

    current = _aware_utc(now)
    observed = _parse_time(as_of)
    retrieved = _parse_time(retrieved_at)
    if current is None or observed is None or retrieved is None:
        return False
    if observed > current or retrieved > current:
        return False

    freshness = request.freshness
    if freshness.not_before is not None:
        not_before = _parse_time(freshness.not_before)
        if not_before is None or observed < not_before:
            return False

    category = next(
        (fact.category for fact in request.required_facts if fact.key == fact_key),
        None,
    )
    latest_market_quote = (
        category is FactCategory.MARKET_QUOTE
        and source_type in _LATEST_MARKET_SOURCES
    )
    if latest_market_quote and observed < current - _MARKET_OBSERVATION_HARD_CAP:
        return False

    freshness_time = retrieved if latest_market_quote else observed
    return (
        freshness.max_age_seconds is None
        or freshness_time
        >= current - timedelta(seconds=freshness.max_age_seconds)
    )


def _aware_utc(value: datetime) -> datetime | None:
    if value.utcoffset() is None:
        return None
    return value.astimezone(UTC)


def _parse_time(value: str) -> datetime | None:
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    return _aware_utc(parsed)


__all__ = ["is_evidence_fresh"]
