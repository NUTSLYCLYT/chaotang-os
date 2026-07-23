"""Wikimedia-only discovery and fail-closed public page retrieval."""

from __future__ import annotations

import json
import urllib.robotparser
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from typing import Protocol, runtime_checkable
from urllib.parse import quote, urlencode, urlsplit

from app.jinyiwei.errors import SourceUnavailableError
from app.jinyiwei.models import (
    DataScope,
    EvidenceQuality,
    FactCategory,
    SourceAttempt,
    SourceAttemptStatus,
    SourceType,
)
from app.jinyiwei.network import PinnedHTTPSResponse
from app.jinyiwei.sources.base import SourceDocument, SourceQuery, SourceResult

WIKIMEDIA_COVERAGE = "WIKIMEDIA_ONLY"
MEDIAWIKI_ENDPOINT = "https://zh.wikipedia.org/w/api.php"
MAX_READABLE_TEXT = 20_000
MAX_TITLE = 200
_USER_AGENT = "chaotang-jinyiwei/1.0"


class SearchProviderUnavailableError(SourceUnavailableError):
    """A sanitized search-provider availability failure."""


@dataclass(frozen=True, slots=True)
class SearchDiscovery:
    coverage_label: str
    urls: tuple[str, ...]
    allowed_origins: tuple[str, ...]

    def __post_init__(self) -> None:
        if self.coverage_label != WIKIMEDIA_COVERAGE:
            raise ValueError("search coverage must be WIKIMEDIA_ONLY")
        if len(self.urls) != len(set(self.urls)):
            raise ValueError("discovered URLs must be unique")
        if not self.allowed_origins or len(self.allowed_origins) != len(
            set(self.allowed_origins)
        ):
            raise ValueError("allowed origins must be nonempty and unique")


@runtime_checkable
class SearchProvider(Protocol):
    coverage_label: str

    def search(self, query: SourceQuery) -> SearchDiscovery: ...


class _Client(Protocol):
    def fetch(self, url: str, **kwargs: object) -> PinnedHTTPSResponse: ...


class WikimediaSearchProvider:
    """Official MediaWiki Action API search, deliberately not general web search."""

    coverage_label = WIKIMEDIA_COVERAGE

    def __init__(self, *, client: _Client) -> None:
        self._client = client

    def search(self, query: SourceQuery) -> SearchDiscovery:
        requested = {fact.key: fact for fact in query.request.required_facts}
        descriptions = [requested[key].description for key in query.unresolved_fact_keys]
        parameters = (
            ("action", "query"),
            ("list", "search"),
            ("format", "json"),
            ("utf8", "1"),
            ("srlimit", str(min(query.max_items, 10))),
            ("srsearch", " ".join(descriptions)),
        )
        url = f"{MEDIAWIKI_ENDPOINT}?{urlencode(parameters)}"
        try:
            response = self._client.fetch(
                url,
                headers={"Accept": "application/json", "User-Agent": _USER_AGENT},
                total_timeout=_remaining_seconds(query),
                redirect_validator=_reject_redirect,
            )
            final = urlsplit(response.final_url)
            media_type = response.headers.get("content-type", "").split(";", 1)[0]
            if (
                response.status != 200
                or media_type.casefold() != "application/json"
                or final.scheme != "https"
                or final.netloc.casefold() != "zh.wikipedia.org"
                or final.path != "/w/api.php"
            ):
                raise ValueError("MediaWiki response rejected")
            payload = json.loads(response.body)
            if not isinstance(payload, dict) or not isinstance(payload.get("query"), dict):
                raise ValueError("MediaWiki envelope rejected")
            search = payload["query"].get("search")
            if not isinstance(search, list):
                raise ValueError("MediaWiki search result rejected")
            urls: list[str] = []
            for item in search:
                if not isinstance(item, dict) or set(item) < {"title"}:
                    raise ValueError("MediaWiki search item rejected")
                title = item.get("title")
                if not isinstance(title, str) or not " ".join(title.split()):
                    raise ValueError("MediaWiki title rejected")
                canonical_title = "_".join(title.split())
                page_url = f"https://zh.wikipedia.org/wiki/{quote(canonical_title, safe='')}"
                if page_url not in urls:
                    urls.append(page_url)
                if len(urls) >= query.max_items:
                    break
        except Exception as exc:
            raise SearchProviderUnavailableError("wikimedia_search_unavailable") from exc
        return SearchDiscovery(
            coverage_label=WIKIMEDIA_COVERAGE,
            urls=tuple(urls),
            allowed_origins=("https://zh.wikipedia.org",),
        )


class PublicWebSource:
    """Discover Wikimedia pages, enforce robots, then parse bounded readable text."""

    def __init__(
        self,
        *,
        client: _Client,
        search_provider: SearchProvider | Callable[[SourceQuery], SearchDiscovery] | None = None,
        now: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self._client = client
        self._search_provider = search_provider or WikimediaSearchProvider(client=client)
        self._now = now

    def fetch(self, query: SourceQuery) -> SourceResult:
        started = self._now()
        requested = {fact.key: fact for fact in query.request.required_facts}
        facts = tuple(
            key
            for key in query.unresolved_fact_keys
            if requested[key].category is FactCategory.ENTITY_REFERENCE
            and requested[key].data_scope in {DataScope.EXTERNAL_PUBLIC, DataScope.HYBRID}
            and requested[key].jurisdiction is not None
        )
        if SourceType.PUBLIC_WEB not in query.request.source_scope:
            return self._result(
                (), SourceAttemptStatus.SKIPPED, started, facts, "source_out_of_scope"
            )
        if not facts:
            return self._result(
                (), SourceAttemptStatus.SKIPPED, started, (), "source_out_of_scope"
            )
        if self._expired(query):
            return self._result(
                (), SourceAttemptStatus.BLOCKED, started, facts, "deadline_exceeded"
            )
        try:
            restricted_query = query.model_copy(update={"unresolved_fact_keys": facts})
            discovery = self._search(restricted_query)
        except SearchProviderUnavailableError:
            return self._result(
                (),
                SourceAttemptStatus.FAILED,
                started,
                facts,
                "wikimedia_search_unavailable",
            )
        except Exception:
            return self._result(
                (),
                SourceAttemptStatus.FAILED,
                started,
                facts,
                "wikimedia_search_unavailable",
            )

        documents: list[SourceDocument] = []
        try:
            origins = _validate_discovery(discovery)
            for url in discovery.urls[: query.max_items]:
                if self._expired(query):
                    return self._result(
                        (), SourceAttemptStatus.BLOCKED, started, facts, "deadline_exceeded"
                    )
                parsed = urlsplit(url)
                origin = f"{parsed.scheme}://{parsed.netloc.casefold()}"
                if origin not in origins or not parsed.path.startswith("/wiki/"):
                    raise ValueError("discovered page rejected")
                robots_url = f"{origin}/robots.txt"
                robots = self._client.fetch(
                    robots_url,
                    headers={"Accept": "text/plain", "User-Agent": _USER_AGENT},
                    total_timeout=_remaining_seconds(query, self._now()),
                    redirect_validator=_reject_redirect,
                )
                if self._expired(query):
                    return self._result(
                        (), SourceAttemptStatus.BLOCKED, started, facts, "deadline_exceeded"
                    )
                _require_robots_permission(robots, robots_url, url)
                page = self._client.fetch(
                    url,
                    headers={"Accept": "text/html", "User-Agent": _USER_AGENT},
                    total_timeout=_remaining_seconds(query, self._now()),
                    redirect_validator=_reject_redirect,
                )
                if self._expired(query):
                    return self._result(
                        (), SourceAttemptStatus.BLOCKED, started, facts, "deadline_exceeded"
                    )
                final = urlsplit(page.final_url)
                final_origin = f"{final.scheme}://{final.netloc.casefold()}"
                media_type = page.headers.get("content-type", "").split(";", 1)[0]
                if (
                    page.status != 200
                    or media_type.casefold() != "text/html"
                    or final_origin not in origins
                    or not final.path.startswith("/wiki/")
                ):
                    raise ValueError("Wikimedia page response rejected")
                parser = _ReadableHTMLParser()
                parser.feed(page.body.decode("utf-8", errors="strict"))
                parser.close()
                title, text = parser.result()
                retrieved = self._now()
                documents.append(
                    SourceDocument(
                        source_type=SourceType.PUBLIC_WEB,
                        source_name="wikimedia",
                        source_url=page.final_url,
                        publisher=(
                            "Wikipedia contributors"
                            if final.netloc.casefold().endswith("wikipedia.org")
                            else "Wikimedia contributors"
                        ),
                        title=title,
                        retrieved_at=_format_time(retrieved),
                        as_of=_last_modified(page.headers.get("last-modified"), retrieved),
                        text=text,
                        quality_ceiling=EvidenceQuality.SECONDARY,
                        metadata={"coverage": WIKIMEDIA_COVERAGE},
                    )
                )
        except Exception:
            return self._result(
                (), SourceAttemptStatus.FAILED, started, facts, "public_web_unavailable"
            )
        return self._result(
            tuple(documents), SourceAttemptStatus.SUCCEEDED, started, facts, None
        )

    def _search(self, query: SourceQuery) -> SearchDiscovery:
        provider = self._search_provider
        if hasattr(provider, "search"):
            return provider.search(query)  # type: ignore[union-attr]
        return provider(query)  # type: ignore[operator]

    def _expired(self, query: SourceQuery) -> bool:
        return self._now() >= _parse_time(query.deadline_at)

    def _result(
        self,
        documents: tuple[SourceDocument, ...],
        status: SourceAttemptStatus,
        started: datetime,
        facts: tuple[str, ...],
        error: str | None,
    ) -> SourceResult:
        return SourceResult(
            documents=documents,
            attempt=SourceAttempt(
                source_type=SourceType.PUBLIC_WEB,
                source_name="wikimedia",
                status=status,
                started_at=_format_time(started),
                completed_at=_format_time(self._now()),
                error=error,
                facts_attempted=facts,
            ),
        )


class _ReadableHTMLParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._suppressed = 0
        self._in_title = False
        self._title: list[str] = []
        self._text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        del attrs
        if tag.casefold() in {"script", "style", "noscript", "template"}:
            self._suppressed += 1
        elif tag.casefold() == "title" and self._suppressed == 0:
            self._in_title = True

    def handle_endtag(self, tag: str) -> None:
        if tag.casefold() in {"script", "style", "noscript", "template"}:
            self._suppressed = max(0, self._suppressed - 1)
        elif tag.casefold() == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._suppressed:
            return
        if self._in_title:
            self._title.append(data)
        else:
            self._text.append(data)

    def result(self) -> tuple[str, str]:
        title = " ".join("".join(self._title).split())[:MAX_TITLE]
        text = " ".join(" ".join(self._text).split())[:MAX_READABLE_TEXT]
        if not title or not text:
            raise ValueError("page contains no bounded readable content")
        return title, text


def _validate_discovery(discovery: SearchDiscovery) -> frozenset[str]:
    if discovery.coverage_label != WIKIMEDIA_COVERAGE:
        raise ValueError("search coverage rejected")
    origins: set[str] = set()
    for origin in discovery.allowed_origins:
        parsed = urlsplit(origin)
        host = parsed.netloc.casefold()
        if (
            parsed.scheme != "https"
            or not host
            or parsed.path not in {"", "/"}
            or parsed.query
            or parsed.fragment
            or not (host.endswith(".wikipedia.org") or host.endswith(".wikimedia.org"))
        ):
            raise ValueError("non-Wikimedia origin rejected")
        origins.add(f"https://{host}")
    return frozenset(origins)


def _require_robots_permission(
    response: PinnedHTTPSResponse, expected_url: str, page_url: str
) -> None:
    media_type = response.headers.get("content-type", "").split(";", 1)[0]
    if (
        response.status != 200
        or response.final_url != expected_url
        or media_type.casefold() != "text/plain"
    ):
        raise ValueError("robots policy unavailable")
    text = response.body.decode("utf-8", errors="strict")
    lines = [line.strip().casefold() for line in text.splitlines()]
    if not any(line.startswith("user-agent:") for line in lines) or not any(
        line.startswith(("allow:", "disallow:")) for line in lines
    ):
        raise ValueError("robots policy unreadable")
    parser = urllib.robotparser.RobotFileParser()
    parser.set_url(expected_url)
    parser.parse(text.splitlines())
    if not parser.can_fetch(_USER_AGENT, page_url):
        raise ValueError("robots policy disallows page")


def _remaining_seconds(query: SourceQuery, now: datetime | None = None) -> float:
    current = now or datetime.now(UTC)
    seconds = (_parse_time(query.deadline_at) - current).total_seconds()
    if seconds <= 0:
        raise TimeoutError("deadline exceeded")
    return min(float(query.request.timeout_seconds), seconds)


def _reject_redirect(_current_url: str, _candidate_url: str) -> bool:
    return False


def _last_modified(value: str | None, fallback: datetime) -> str:
    if value:
        try:
            parsed = parsedate_to_datetime(value)
            if parsed.utcoffset() is not None:
                return _format_time(parsed)
        except (TypeError, ValueError, OverflowError):
            pass
    return _format_time(fallback)


def _parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value[:-1] + "+00:00" if value.endswith("Z") else value)


def _format_time(value: datetime) -> str:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")
