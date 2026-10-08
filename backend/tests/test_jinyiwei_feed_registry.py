import pytest

from app.jinyiwei.feed_registry import (
    FeedFormat,
    FeedRegistry,
    FeedSource,
    build_default_feed_registry,
)


def _source() -> FeedSource:
    return FeedSource(
        source_id="example-news",
        url="https://news.example.com/rss.xml",
        publisher="Example News",
        format=FeedFormat.RSS,
        license_note="Publisher permits RSS linking.",
        robots_policy="robots.txt required",
        rate_limit_per_minute=10,
    )


def test_registry_is_default_deny_and_resolves_only_registered_host() -> None:
    source = _source()
    registry = FeedRegistry((source,))
    assert registry.resolve_url("https://news.example.com/rss.xml?x=1") is source
    with pytest.raises(ValueError, match="not registered"):
        registry.resolve_url("https://other.example.com/rss.xml")
    assert build_default_feed_registry().sources == {}


@pytest.mark.parametrize(
    "url",
    ["http://news.example.com/rss.xml", "https://localhost/rss.xml", "https://127.0.0.1/rss.xml"],
)
def test_feed_source_rejects_unsafe_urls(url: str) -> None:
    with pytest.raises(ValueError):
        FeedSource(
            source_id="unsafe",
            url=url,
            publisher="Example",
            format=FeedFormat.ATOM,
            license_note="licensed",
            robots_policy="required",
            rate_limit_per_minute=1,
        )
