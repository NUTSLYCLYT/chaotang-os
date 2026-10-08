"""Deterministic, offline news snapshot normalization for Jinyiwei."""

from __future__ import annotations

import hashlib
import json
import re
from datetime import UTC, datetime
from typing import Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, StrictStr

from app.jinyiwei.feed_registry import FeedRegistry
from app.jinyiwei.read_models import (
    NewsArticleRead,
    NewsEventRead,
    NewsRejectionRead,
    NewsSnapshotPreviewRead,
)

NEWS_PREVIEW_RULES_VERSION = "news-preview-v1"
_HASH_RE = re.compile(r"^[0-9a-f]{64}$")


class NewsSnapshotEntryInput(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    source_id: StrictStr
    url: StrictStr
    title: StrictStr
    published_at: StrictStr
    updated_at: StrictStr | None = None
    author: StrictStr | None = None
    publisher: StrictStr
    summary: StrictStr | None = None
    content: StrictStr
    content_hash: StrictStr


class NewsSnapshotPreviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    snapshot_id: StrictStr
    entries: tuple[NewsSnapshotEntryInput, ...] = Field(max_length=200)


def _text(value: str) -> str:
    return " ".join(value.split())


def _timestamp(value: str) -> datetime | None:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return None
    return parsed.astimezone(UTC)


def _digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _canonical_request(request: NewsSnapshotPreviewRequest) -> str:
    return json.dumps(
        request.model_dump(mode="json"),
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def _safe_url(source, candidate: str) -> bool:
    parsed = urlsplit(candidate)
    return (
        parsed.scheme == "https"
        and not parsed.username
        and not parsed.password
        and not parsed.fragment
        and source.owns_url(candidate)
    )


def normalize_news_snapshot(
    request: NewsSnapshotPreviewRequest,
    *,
    registry: FeedRegistry,
    now: datetime,
) -> NewsSnapshotPreviewRead:
    """Normalize a caller-provided snapshot without network access or persistence."""

    if not request.snapshot_id.strip():
        raise ValueError("snapshot_id must not be blank")
    if now.tzinfo is None:
        raise ValueError("now must be timezone-aware")

    accepted: list[NewsArticleRead] = []
    rejected: list[NewsRejectionRead] = []
    seen_article_ids: set[str] = set()
    source_fingerprints: dict[str, str] = {}

    for ordinal, entry in enumerate(request.entries):
        reason: str | None = None
        source = None
        try:
            source = registry.get(entry.source_id)
        except KeyError:
            reason = "SOURCE_NOT_REGISTERED"
        if reason is None and not _safe_url(source, entry.url):
            reason = "URL_NOT_ALLOWED"
        if reason is None and source.publisher != _text(entry.publisher):
            reason = "PUBLISHER_MISMATCH"
        published = _timestamp(entry.published_at)
        if reason is None and published is None:
            reason = "PUBLISHED_AT_INVALID"
        updated = _timestamp(entry.updated_at) if entry.updated_at is not None else None
        if reason is None and entry.updated_at is not None and updated is None:
            reason = "UPDATED_AT_INVALID"
        title = _text(entry.title)
        content = entry.content.strip()
        if reason is None and not title:
            reason = "TITLE_EMPTY"
        if reason is None and not content:
            reason = "CONTENT_EMPTY"
        if reason is None and not _HASH_RE.fullmatch(entry.content_hash):
            reason = "CONTENT_HASH_INVALID"
        if reason is None and _digest(content) != entry.content_hash:
            reason = "CONTENT_HASH_MISMATCH"

        article_id = _digest(
            "\0".join((entry.source_id, entry.url, entry.content_hash))
        )
        if reason is None and article_id in seen_article_ids:
            reason = "DUPLICATE_ARTICLE"

        if reason is not None:
            rejected.append(
                NewsRejectionRead(
                    ordinal=ordinal,
                    source_id=entry.source_id,
                    url=entry.url,
                    reason=reason,
                )
            )
            continue

        assert source is not None and published is not None
        seen_article_ids.add(article_id)
        source_fingerprints[source.source_id] = source.fingerprint
        accepted.append(
            NewsArticleRead(
                article_id=article_id,
                source_id=source.source_id,
                source_fingerprint=source.fingerprint,
                title=title,
                url=entry.url,
                published_at=published.isoformat().replace("+00:00", "Z"),
                updated_at=(updated.isoformat().replace("+00:00", "Z") if updated else None),
                author=_text(entry.author) if entry.author else None,
                publisher=source.publisher,
                summary=_text(entry.summary) if entry.summary else None,
                content_hash=entry.content_hash,
            )
        )

    clusters: dict[str, list[NewsArticleRead]] = {}
    for article in accepted:
        published = _timestamp(article.published_at)
        assert published is not None
        normalized_title = re.sub(r"[^\w\u4e00-\u9fff]+", " ", article.title.casefold())
        cluster_key = f"{_text(normalized_title)}\0{published.date().isoformat()}"
        clusters.setdefault(_digest(cluster_key), []).append(article)

    events: list[NewsEventRead] = []
    for cluster_id, articles in sorted(clusters.items()):
        ordered = tuple(sorted(articles, key=lambda article: article.article_id))
        hashes = {article.content_hash for article in ordered}
        sources = {article.source_id for article in ordered}
        state: Literal["SINGLE_SOURCE", "MULTI_SOURCE", "CONFLICTED"]
        if len(hashes) > 1 and len(ordered) > 1:
            state = "CONFLICTED"
        elif len(sources) > 1:
            state = "MULTI_SOURCE"
        else:
            state = "SINGLE_SOURCE"
        events.append(
            NewsEventRead(
                event_id=cluster_id,
                title=ordered[0].title,
                article_ids=tuple(article.article_id for article in ordered),
                source_ids=tuple(sorted(sources)),
                first_published_at=min(article.published_at for article in ordered),
                last_published_at=max(article.published_at for article in ordered),
                state=state,
                evidence_state="UNVERIFIED",
                do_not_infer=True,
            )
        )

    replay_fingerprint = _digest(
        "\0".join((NEWS_PREVIEW_RULES_VERSION, _canonical_request(request)))
    )
    return NewsSnapshotPreviewRead(
        snapshot_id=request.snapshot_id,
        rules_version=NEWS_PREVIEW_RULES_VERSION,
        replay_fingerprint=replay_fingerprint,
        source_fingerprints=tuple(
            f"{source_id}:{fingerprint}"
            for source_id, fingerprint in sorted(source_fingerprints.items())
        ),
        articles=tuple(sorted(accepted, key=lambda article: article.article_id)),
        events=tuple(events),
        rejected=tuple(rejected),
        generated_at=now.astimezone(UTC).isoformat().replace("+00:00", "Z"),
        do_not_infer="新闻快照只完成来源和内容规范化；标题不等于事实，必须经过证据核验。",
    )
