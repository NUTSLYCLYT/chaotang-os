from __future__ import annotations

import hashlib
from datetime import datetime, timezone

from app.jinyiwei.feed_registry import FeedFormat, FeedRegistry, FeedSource
from app.jinyiwei.news import NewsSnapshotPreviewRequest, normalize_news_snapshot


def _registry() -> FeedRegistry:
    return FeedRegistry(
        (
            FeedSource(
                source_id="example-news",
                url="https://news.example.test/feed.xml",
                publisher="Example News",
                format=FeedFormat.RSS,
                license_note="Public feed license",
                robots_policy="respect",
                rate_limit_per_minute=6,
            ),
        )
    )


def _entry(*, title: str = "Market update", content: str = "A source report.", url: str = "https://news.example.test/a", content_hash: str | None = None) -> dict[str, str]:
    return {
        "source_id": "example-news",
        "url": url,
        "title": title,
        "published_at": "2026-10-08T01:00:00Z",
        "updated_at": None,
        "author": "Reporter",
        "publisher": "Example News",
        "summary": "A short summary.",
        "content": content,
        "content_hash": content_hash or hashlib.sha256(content.encode()).hexdigest(),
    }


def test_news_preview_is_deterministic_and_clusters_conflicting_articles() -> None:
    first = _entry()
    second = _entry(content="A different report.", url="https://news.example.test/b")
    request = NewsSnapshotPreviewRequest(snapshot_id="snapshot-1", entries=(first, second))
    now = datetime(2026, 10, 8, 2, tzinfo=timezone.utc)

    left = normalize_news_snapshot(request, registry=_registry(), now=now)
    right = normalize_news_snapshot(request, registry=_registry(), now=now)

    assert left.model_dump(mode="json") == right.model_dump(mode="json")
    assert len(left.articles) == 2
    assert len(left.events) == 1
    assert left.events[0].state == "CONFLICTED"
    assert left.events[0].do_not_infer is True
    assert left.rejected == ()


def test_news_preview_rejects_unregistered_unsafe_and_hash_mismatch_entries() -> None:
    unknown = _entry()
    unknown["source_id"] = "unknown"
    unsafe = _entry(url="http://news.example.test/a")
    mismatch = _entry(content_hash="0" * 64)
    request = NewsSnapshotPreviewRequest(
        snapshot_id="snapshot-2",
        entries=(unknown, unsafe, mismatch),
    )

    preview = normalize_news_snapshot(
        request,
        registry=_registry(),
        now=datetime(2026, 10, 8, 2, tzinfo=timezone.utc),
    )

    assert preview.articles == ()
    assert [item.reason for item in preview.rejected] == [
        "SOURCE_NOT_REGISTERED",
        "URL_NOT_ALLOWED",
        "CONTENT_HASH_MISMATCH",
    ]


def test_news_preview_deduplicates_same_source_content() -> None:
    entry = _entry()
    duplicate = {**entry}
    request = NewsSnapshotPreviewRequest(snapshot_id="snapshot-3", entries=(entry, duplicate))

    preview = normalize_news_snapshot(
        request,
        registry=_registry(),
        now=datetime(2026, 10, 8, 2, tzinfo=timezone.utc),
    )

    assert len(preview.articles) == 1
    assert [item.reason for item in preview.rejected] == ["DUPLICATE_ARTICLE"]
