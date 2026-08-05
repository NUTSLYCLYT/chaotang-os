from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs, urlsplit

import pytest

from app.jinyiwei.models import (
    DataGapRequest,
    EvidenceQuality,
    FactCategory,
    FreshnessRequirement,
    RequiredFact,
    SourceAttemptStatus,
    SourceType,
)
from app.jinyiwei.network import PinnedHTTPSResponse
from app.jinyiwei.source_registry import (
    PublicAccessPolicy,
    PublicApiConnector,
    PublicApiRecord,
    PublicApiRegistry,
    build_default_public_api_registry,
)
from app.jinyiwei.sources import (
    PublicApiSource,
    PublicWebSource,
    SearchDiscovery,
    SearchProviderUnavailableError,
    SourceQuery,
    WikimediaSearchProvider,
)

NOW = datetime(2026, 7, 20, 12, 0, tzinfo=UTC)


def _request(*scope: SourceType) -> DataGapRequest:
    return DataGapRequest(
        request_id="req-public",
        requesting_agent="户部",
        question="是否补充数据？",
        required_facts=(
            RequiredFact(
                key="population",
                description="北京市常住人口",
                category="ENTITY_REFERENCE",
                data_scope="EXTERNAL_PUBLIC",
                subject="北京市",
                jurisdiction="CN",
                expected_unit="人",
            ),
            RequiredFact(
                key="area",
                description="北京市行政面积",
                category="ENTITY_REFERENCE",
                data_scope="EXTERNAL_PUBLIC",
                subject="北京市",
                jurisdiction="CN",
                expected_unit="平方公里",
            ),
        ),
        decision_context="SECRET decree and operational context",
        freshness=FreshnessRequirement(max_age_seconds=3600),
        timeout_seconds=30,
        source_scope=scope,
    )


def _query(*scope: SourceType, **changes: object) -> SourceQuery:
    values: dict[str, object] = {
        "request": _request(*scope),
        "unresolved_fact_keys": ("population", "area"),
        "max_items": 2,
        "deadline_at": (datetime.now(UTC) + timedelta(minutes=1)).isoformat(),
    }
    values.update(changes)
    return SourceQuery(**values)


class FakeClient:
    def __init__(self, responses: list[PinnedHTTPSResponse | Exception]) -> None:
        self.responses = list(responses)
        self.calls: list[tuple[str, dict[str, object]]] = []

    def fetch(self, url: str, **kwargs: object) -> PinnedHTTPSResponse:
        self.calls.append((url, kwargs))
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


def _response(
    url: str,
    body: bytes,
    *,
    status: int = 200,
    content_type: str = "application/json",
    headers: dict[str, str] | None = None,
) -> PinnedHTTPSResponse:
    values = {"content-type": content_type}
    values.update(headers or {})
    return PinnedHTTPSResponse(final_url=url, status=status, headers=values, body=body)


def _discovery_provider(url: str):
    def provider(_query: SourceQuery) -> SearchDiscovery:
        return SearchDiscovery(
            coverage_label="WIKIMEDIA_ONLY",
            urls=(url,),
            allowed_origins=("https://zh.wikipedia.org",),
        )

    return provider


def _connector(**changes: object) -> PublicApiConnector:
    def parse_records(body: bytes) -> tuple[PublicApiRecord, ...]:
        payload = json.loads(body)
        if not isinstance(payload, dict) or set(payload) != {"records"}:
            raise ValueError("invalid records envelope")
        records = payload["records"]
        if not isinstance(records, list):
            raise ValueError("invalid records list")
        if any(
            not isinstance(item, dict) or set(item) != {"title", "text", "as_of"}
            for item in records
        ):
            raise ValueError("invalid record")
        return tuple(
            PublicApiRecord(
                **item,
                coverage="GLOBAL",
                license_note="Free public example data.",
            )
            for item in records
        )

    values: dict[str, object] = {
        "name": "population-api",
        "origin": "https://api.example.org",
        "path": "/v1/facts",
        "allowed_query_keys": frozenset({"fact", "limit"}),
        "publisher": "Example Statistics Office",
        "quality_ceiling": EvidenceQuality.AUTHORITATIVE,
        "categories": frozenset({FactCategory.ENTITY_REFERENCE}),
        "jurisdictions": "GLOBAL",
        "coverage": "GLOBAL",
        "access_policy": PublicAccessPolicy.FREE_PUBLIC_NO_CREDENTIALS,
        "free_public_access_basis": "No-login free public endpoint permitted by the publisher.",
        "license_note": "Free public example data.",
        "freshness_semantics": (
            "Daily published statistic; freshness is determined by published_at."
        ),
        "redistribution_restrictions": "May be redistributed with attribution.",
        "query_builder": lambda facts, limit: {
            "fact": ",".join(fact.key for fact in facts),
            "limit": str(limit),
        },
        "response_parser": parse_records,
    }
    values.update(changes)
    return PublicApiConnector(**values)


def _fact(
    key: str,
    category: FactCategory,
    jurisdiction: str | None,
) -> RequiredFact:
    return RequiredFact(
        key=key,
        description=f"{key} description",
        category=category,
        data_scope="EXTERNAL_PUBLIC",
        subject=f"{key} subject",
        jurisdiction=jurisdiction,
        market_metric=(
            "LAST_PRICE" if category is FactCategory.MARKET_QUOTE else None
        ),
    )


def test_registry_excludes_entity_connector_for_market_quote() -> None:
    entity_connector = _connector()
    registry = PublicApiRegistry((entity_connector,))

    assert registry.connectors_for((_fact("quote", FactCategory.MARKET_QUOTE, "CN"),)) == ()


def test_public_api_source_does_not_claim_category_mismatch_as_attempted() -> None:
    request = _request(SourceType.PUBLIC_API).model_copy(
        update={"required_facts": (_fact("quote", FactCategory.MARKET_QUOTE, "CN"),)}
    )
    client = FakeClient([])

    result = PublicApiSource(
        registry=PublicApiRegistry((_connector(),)), client=client, now=lambda: NOW
    ).fetch(
        _query(
            SourceType.PUBLIC_API,
            request=request,
            unresolved_fact_keys=("quote",),
        )
    )

    assert result.attempt.facts_attempted == ()
    assert client.calls == []


def test_registry_keeps_global_connector_for_any_jurisdiction() -> None:
    global_news = _connector(
        name="global-news",
        categories=frozenset({FactCategory.NEWS_EVENT}),
        jurisdictions="GLOBAL",
    )
    registry = PublicApiRegistry((global_news,))

    assert registry.connectors_for((_fact("news", FactCategory.NEWS_EVENT, "BR"),)) == (
        global_news,
    )


def test_public_api_source_sends_each_connector_only_its_matched_facts() -> None:
    calls: list[tuple[str, tuple[str, ...]]] = []

    def connector_for(category: FactCategory, name: str) -> PublicApiConnector:
        def build_query(facts: tuple[RequiredFact, ...], limit: int) -> dict[str, str]:
            calls.append((name, tuple(fact.key for fact in facts)))
            return {"fact": facts[0].key, "limit": str(limit)}

        return _connector(
            name=name,
            path=f"/v1/{name}",
            categories=frozenset({category}),
            jurisdictions="GLOBAL",
            query_builder=build_query,
        )

    entity = connector_for(FactCategory.ENTITY_REFERENCE, "entity")
    news = connector_for(FactCategory.NEWS_EVENT, "news")
    request = _request(SourceType.PUBLIC_API).model_copy(
        update={
            "required_facts": (
                _fact("entity", FactCategory.ENTITY_REFERENCE, "CN"),
                _fact("news", FactCategory.NEWS_EVENT, "BR"),
            )
        }
    )
    query = _query(
        SourceType.PUBLIC_API,
        request=request,
        unresolved_fact_keys=("entity", "news"),
    )
    source = PublicApiSource(
        registry=PublicApiRegistry((entity, news)),
        client=FakeClient(
            [
                _response(
                    "https://api.example.org/v1/entity?fact=entity&limit=2",
                    b'{"records":[]}',
                ),
                _response("https://api.example.org/v1/news?fact=news&limit=2", b'{"records":[]}'),
            ]
        ),
        now=lambda: NOW,
    )

    result = source.fetch(query)

    assert result.attempt.status is SourceAttemptStatus.SUCCEEDED
    assert calls == [("entity", ("entity",)), ("news", ("news",))]


def test_news_documents_are_newest_first_within_same_quality() -> None:
    def parse_news(_body: bytes) -> tuple[PublicApiRecord, ...]:
        return (
            PublicApiRecord(
                title="earlier",
                text="earlier event",
                coverage="GLOBAL",
                license_note="Free public example data.",
                published_at="2026-07-22T09:00:00Z",
            ),
            PublicApiRecord(
                title="later",
                text="later event",
                coverage="GLOBAL",
                license_note="Free public example data.",
                published_at="2026-07-22T10:00:00Z",
            ),
        )

    connector = _connector(
        name="news",
        categories=frozenset({FactCategory.NEWS_EVENT}),
        jurisdictions="GLOBAL",
        response_parser=parse_news,
    )
    request = _request(SourceType.PUBLIC_API).model_copy(
        update={"required_facts": (_fact("news", FactCategory.NEWS_EVENT, "BR"),)}
    )
    query = _query(
        SourceType.PUBLIC_API,
        request=request,
        unresolved_fact_keys=("news",),
    )
    source = PublicApiSource(
        registry=PublicApiRegistry((connector,)),
        client=FakeClient(
            [
                _response(
                    "https://api.example.org/v1/facts?fact=news&limit=2",
                    b"{}",
                )
            ]
        ),
        now=lambda: NOW,
    )

    documents = source.fetch(query).documents

    assert [item.as_of for item in documents] == [
        "2026-07-22T10:00:00Z",
        "2026-07-22T09:00:00Z",
    ]


def test_public_api_connector_requires_explicit_coverage_and_license_note() -> None:
    connector = _connector(
        coverage="GLOBAL",
        license_note="Free public Wikidata-compatible example data.",
    )

    assert connector.coverage == "GLOBAL"
    assert connector.license_note == "Free public Wikidata-compatible example data."
    with pytest.raises(ValueError, match="coverage"):
        _connector(coverage=())
    with pytest.raises(ValueError, match="license_note"):
        _connector(license_note="   ")


def test_public_api_connector_requires_structured_free_public_access_policy() -> None:
    with pytest.raises(ValueError, match="access_policy"):
        _connector(access_policy=None)
    with pytest.raises(ValueError, match="access_policy"):
        _connector(access_policy="CREDENTIALS_REQUIRED")


@pytest.mark.parametrize("access_basis", ("API-key required", "login is not required", "unpaid"))
def test_public_api_connector_uses_policy_not_access_basis_prose(access_basis: str) -> None:
    connector = _connector(free_public_access_basis=access_basis)
    assert connector.access_policy is PublicAccessPolicy.FREE_PUBLIC_NO_CREDENTIALS
    assert connector.free_public_access_basis == access_basis


def test_public_api_connector_rejects_blank_access_basis() -> None:
    with pytest.raises(ValueError, match="free_public_access_basis"):
        _connector(free_public_access_basis="   ")


@pytest.mark.parametrize("field_name", ("freshness_semantics", "redistribution_restrictions"))
def test_public_api_connector_requires_audit_semantics(field_name: str) -> None:
    with pytest.raises(ValueError, match=field_name):
        _connector(**{field_name: "   "})


def test_public_api_connector_rejects_empty_fact_categories() -> None:
    with pytest.raises(ValueError, match="categories"):
        _connector(categories=frozenset())


def test_public_api_connector_rejects_missing_fixed_parser() -> None:
    with pytest.raises(ValueError, match="response_parser"):
        _connector(response_parser=None)


def test_public_api_record_accepts_only_timezone_aware_published_at() -> None:
    record = PublicApiRecord(
        title="Population",
        text="Published total",
        coverage=("CN",),
        license_note="Free public example data.",
        published_at="2026-07-20T12:00:00Z",
    )

    assert record.published_at == "2026-07-20T12:00:00Z"
    assert record.coverage == ("CN",)
    assert record.license_note == "Free public example data."
    with pytest.raises(ValueError, match="timezone"):
        PublicApiRecord(
            title="Population",
            text="Published total",
            coverage=("CN",),
            license_note="Free public example data.",
            published_at="2026-07-20T12:00:00",
        )


def test_public_api_registry_is_immutable_and_locks_origin_path_and_query() -> None:
    connector = _connector()
    registry = PublicApiRegistry((connector,))

    assert registry.names == ("population-api",)
    assert connector.build_url(_request(SourceType.PUBLIC_API).required_facts, 2) == (
        "https://api.example.org/v1/facts?fact=population%2Carea&limit=2"
    )
    with pytest.raises(TypeError):
        registry.connectors["other"] = connector
    with pytest.raises(ValueError, match="duplicate"):
        PublicApiRegistry((connector, connector))
    with pytest.raises(ValueError, match="query"):
        _connector(query_builder=lambda _facts, _limit: {"url": "https://evil.test"}).build_url(
            _request(SourceType.PUBLIC_API).required_facts, 1
        )
    with pytest.raises(ValueError, match="path"):
        _connector(path="/v1/facts?next=/arbitrary")


def test_default_public_api_registry_uses_bounded_private_wikidata_search() -> None:
    registry = build_default_public_api_registry()
    connector = registry.get("wikidata_entity_search")
    facts = _request(SourceType.PUBLIC_API).required_facts
    url = connector.build_url(facts, 99)
    parsed = urlsplit(url)

    assert parsed.scheme == "https"
    assert parsed.netloc == "www.wikidata.org"
    assert parsed.path == "/w/api.php"
    assert parse_qs(parsed.query) == {
        "action": ["wbsearchentities"],
        "search": ["北京市"],
        "language": ["zh"],
        "format": ["json"],
        "limit": ["10"],
    }
    assert "SECRET" not in url
    body = json.dumps(
        {
            "search": [
                {"id": "Q956", "label": "北京", "description": "中华人民共和国首都"},
                {"id": "Q2", "label": "", "description": "unusable"},
                {"id": "not-an-entity", "label": "坏项", "description": "unusable"},
            ]
        }
    ).encode()
    client = FakeClient([_response(connector.build_url(facts, 2), body)])
    result = PublicApiSource(
        registry=registry,
        client=client,
        now=lambda: NOW,
    ).fetch(_query(SourceType.PUBLIC_API))

    assert len(result.documents) == 1
    assert result.documents[0].title == "北京 (Q956)"
    assert result.documents[0].text == "北京 — 中华人民共和国首都"
    assert result.documents[0].publisher == "Wikidata"
    assert result.documents[0].quality_ceiling is EvidenceQuality.SECONDARY
    assert result.documents[0].as_of == "2026-07-20T12:00:00Z"
    assert client.calls[0][1]["headers"] == {
        "Accept": "application/json",
        "User-Agent": "chaotang-os/1.0",
    }


def test_wikidata_search_uses_english_for_ascii_entity_subject() -> None:
    connector = build_default_public_api_registry().get("wikidata_entity_search")
    fact = RequiredFact(
        key="entity_reference:identity",
        description="核查 OpenAI 的公开实体身份",
        category=FactCategory.ENTITY_REFERENCE,
        data_scope="EXTERNAL_PUBLIC",
        subject="OpenAI",
        jurisdiction="US",
        expected_shape="string",
    )

    parsed = urlsplit(connector.build_url((fact,), 1))

    assert parse_qs(parsed.query)["search"] == ["OpenAI"]
    assert parse_qs(parsed.query)["language"] == ["en"]


def test_public_api_source_skips_empty_registry_explicitly() -> None:
    client = FakeClient([])
    result = PublicApiSource(registry=PublicApiRegistry(()), client=client, now=lambda: NOW).fetch(
        _query(SourceType.PUBLIC_API)
    )

    assert result.documents == ()
    assert result.attempt.status is SourceAttemptStatus.SKIPPED
    assert result.attempt.error == "public_api_not_configured"
    assert client.calls == []


def test_public_api_source_honors_scope_budget_deadline_and_redirect_lock() -> None:
    endpoint = "https://api.example.org/v1/facts?fact=population%2Carea&limit=1"
    body = json.dumps(
        {
            "records": [
                {"title": "人口", "text": "常住人口为 100 人", "as_of": "2026-01-01T00:00:00Z"},
                {"title": "面积", "text": "面积为 20 平方公里", "as_of": "2026-01-01T00:00:00Z"},
            ]
        }
    ).encode()
    client = FakeClient([_response(endpoint, body)])
    source = PublicApiSource(
        registry=PublicApiRegistry((_connector(),)), client=client, now=lambda: NOW
    )

    skipped = source.fetch(_query(SourceType.PUBLIC_WEB, max_items=1))
    assert skipped.attempt.status is SourceAttemptStatus.SKIPPED
    assert client.calls == []

    result = source.fetch(_query(SourceType.PUBLIC_API, max_items=1))
    assert len(result.documents) == 1
    assert result.documents[0].source_url == endpoint
    assert result.documents[0].quality_ceiling is EvidenceQuality.AUTHORITATIVE

    expired = source.fetch(_query(SourceType.PUBLIC_API, deadline_at="2026-07-20T11:59:59Z"))
    assert expired.documents == ()
    assert expired.attempt.status is SourceAttemptStatus.BLOCKED

    escaped = PublicApiSource(
        registry=PublicApiRegistry((_connector(),)),
        client=FakeClient([_response("https://evil.test/v1/facts", body)]),
        now=lambda: NOW,
    ).fetch(_query(SourceType.PUBLIC_API, max_items=1))
    assert escaped.documents == ()
    assert escaped.attempt.status is SourceAttemptStatus.FAILED
    assert escaped.attempt.error == "public_api_unavailable"


@pytest.mark.parametrize(
    "final_url",
    [
        "https://api.example.org/v1/facts?fact=changed&limit=1",
        "https://api.example.org/v1/facts?fact=population%2Carea",
        "https://api.example.org/v1/facts?fact=population%2Carea&limit=1&limit=1",
        "https://api.example.org/v1/facts?fact=population%2Carea&limit=1&fact=extra",
    ],
)
def test_public_api_source_requires_exact_built_query_multiset(final_url: str) -> None:
    body = b'{"records":[]}'
    result = PublicApiSource(
        registry=PublicApiRegistry((_connector(),)),
        client=FakeClient([_response(final_url, body)]),
        now=lambda: NOW,
    ).fetch(_query(SourceType.PUBLIC_API, max_items=1))

    assert result.documents == ()
    assert result.attempt.status is SourceAttemptStatus.FAILED
    assert result.attempt.error == "public_api_unavailable"


def test_public_api_source_discards_partial_candidates_when_later_call_fails() -> None:
    first = _connector(name="first")
    second = _connector(name="second", path="/v1/other")
    body = b'{"records":[{"title":"x","text":"literal","as_of":"2026-01-01T00:00:00Z"}]}'
    client = FakeClient(
        [
            _response("https://api.example.org/v1/facts?fact=population%2Carea&limit=2", body),
            RuntimeError("credential=secret\ntrace"),
        ]
    )
    result = PublicApiSource(
        registry=PublicApiRegistry((first, second)), client=client, now=lambda: NOW
    ).fetch(_query(SourceType.PUBLIC_API))

    assert result.documents == ()
    assert result.attempt.status is SourceAttemptStatus.FAILED
    assert result.attempt.error == "public_api_unavailable"


def test_public_api_source_rejects_malformed_json_and_crossed_deadline() -> None:
    endpoint = "https://api.example.org/v1/facts?fact=population%2Carea&limit=2"
    malformed = PublicApiSource(
        registry=PublicApiRegistry((_connector(),)),
        client=FakeClient([_response(endpoint, b'{"records":{}}')]),
        now=lambda: NOW,
    ).fetch(_query(SourceType.PUBLIC_API))
    assert malformed.documents == ()
    assert malformed.attempt.status is SourceAttemptStatus.FAILED
    assert malformed.attempt.error == "public_api_unavailable"

    current = [NOW]

    class DeadlineClient(FakeClient):
        def fetch(self, url: str, **kwargs: object) -> PinnedHTTPSResponse:
            response = super().fetch(url, **kwargs)
            current[0] = current[0] + timedelta(minutes=2)
            return response

    crossed = PublicApiSource(
        registry=PublicApiRegistry((_connector(),)),
        client=DeadlineClient([_response(endpoint, b'{"records":[]}')]),
        now=lambda: current[0],
    ).fetch(
        _query(
            SourceType.PUBLIC_API,
            deadline_at=(NOW + timedelta(minutes=1)).isoformat(),
        )
    )
    assert crossed.documents == ()
    assert crossed.attempt.status is SourceAttemptStatus.BLOCKED
    assert crossed.attempt.error == "deadline_exceeded"


def test_wikimedia_provider_sends_only_fact_descriptions_and_canonicalizes_urls() -> None:
    body = json.dumps({"query": {"search": [{"title": "北京 人口"}, {"title": "A/B"}]}}).encode()
    client = FakeClient([_response("https://zh.wikipedia.org/w/api.php", body)])
    provider = WikimediaSearchProvider(client=client)

    discovery = provider.search(_query(SourceType.PUBLIC_WEB))

    requested = urlsplit(client.calls[0][0])
    query = parse_qs(requested.query)
    assert requested.scheme == "https"
    assert requested.netloc == "zh.wikipedia.org"
    assert requested.path == "/w/api.php"
    assert query["action"] == ["query"]
    assert query["list"] == ["search"]
    assert query["format"] == ["json"]
    assert query["utf8"] == ["1"]
    assert query["srlimit"] == ["2"]
    assert query["srsearch"] == ["北京市常住人口 北京市行政面积"]
    assert "SECRET" not in client.calls[0][0]
    assert discovery.coverage_label == "WIKIMEDIA_ONLY"
    assert discovery.urls == (
        "https://zh.wikipedia.org/wiki/%E5%8C%97%E4%BA%AC_%E4%BA%BA%E5%8F%A3",
        "https://zh.wikipedia.org/wiki/A%2FB",
    )
    assert discovery.allowed_origins == ("https://zh.wikipedia.org",)


@pytest.mark.parametrize(
    "payload",
    [b"not-json", b"{}", b'{"query":{"search":{}}}', b'{"query":{"search":[{}]}}'],
)
def test_wikimedia_provider_fails_closed_on_malformed_json(payload: bytes) -> None:
    provider = WikimediaSearchProvider(
        client=FakeClient([_response("https://zh.wikipedia.org/w/api.php", payload)])
    )
    with pytest.raises(SearchProviderUnavailableError, match="wikimedia_search_unavailable"):
        provider.search(_query(SourceType.PUBLIC_WEB))


def test_public_web_obeys_robots_strips_active_html_and_preserves_times() -> None:
    page_url = "https://zh.wikipedia.org/wiki/Test"
    provider = _discovery_provider(page_url)
    html = (
        "<html><head><title>  Test title  </title><style>secret-css</style></head>"
        "<body><script>ignore-instruction()</script><h1>Readable</h1><p>"
        + "x" * 25000
        + "</p></body></html>"
    ).encode()
    client = FakeClient(
        [
            _response(
                "https://zh.wikipedia.org/robots.txt",
                b"User-agent: *\nAllow: /wiki/",
                content_type="text/plain",
            ),
            _response(
                page_url,
                html,
                content_type="text/html",
                headers={"last-modified": "Wed, 01 Jul 2026 10:00:00 GMT"},
            ),
        ]
    )
    result = PublicWebSource(client=client, search_provider=provider, now=lambda: NOW).fetch(
        _query(SourceType.PUBLIC_WEB, max_items=1)
    )

    assert result.attempt.status is SourceAttemptStatus.SUCCEEDED
    assert len(result.documents) == 1
    document = result.documents[0]
    assert document.title == "Test title"
    assert "Readable" in document.text
    assert "ignore-instruction" not in document.text
    assert "secret-css" not in document.text
    assert len(document.text) <= 20_000
    assert document.retrieved_at == "2026-07-20T12:00:00Z"
    assert document.as_of == "2026-07-01T10:00:00Z"
    assert document.source_type is SourceType.PUBLIC_WEB
    assert document.quality_ceiling is EvidenceQuality.SECONDARY


@pytest.mark.parametrize(
    ("robots", "final_url"),
    [
        (b"User-agent: *\nDisallow: /wiki/", "https://zh.wikipedia.org/wiki/Test"),
        (b"not a robots policy", "https://zh.wikipedia.org/wiki/Test"),
        (b"User-agent: *\nAllow: /wiki/", "https://evil.test/wiki/Test"),
    ],
)
def test_public_web_fails_closed_for_robots_or_redirect_escape(
    robots: bytes, final_url: str
) -> None:
    page_url = "https://zh.wikipedia.org/wiki/Test"
    provider = _discovery_provider(page_url)
    client = FakeClient(
        [
            _response("https://zh.wikipedia.org/robots.txt", robots, content_type="text/plain"),
            _response(final_url, b"<p>text</p>", content_type="text/html"),
        ]
    )
    result = PublicWebSource(client=client, search_provider=provider, now=lambda: NOW).fetch(
        _query(SourceType.PUBLIC_WEB, max_items=1)
    )

    assert result.documents == ()
    assert result.attempt.status is SourceAttemptStatus.FAILED
    assert result.attempt.error == "public_web_unavailable"


def test_public_web_reports_provider_unavailability_without_fetching_pages() -> None:
    client = FakeClient([])

    def unavailable(_query: SourceQuery) -> SearchDiscovery:
        raise SearchProviderUnavailableError("private details\nsecret")

    result = PublicWebSource(client=client, search_provider=unavailable, now=lambda: NOW).fetch(
        _query(SourceType.PUBLIC_WEB)
    )

    assert result.documents == ()
    assert result.attempt.status is SourceAttemptStatus.FAILED
    assert result.attempt.error == "wikimedia_search_unavailable"
    assert client.calls == []


@pytest.mark.parametrize(
    "category",
    [
        FactCategory.MARKET_QUOTE,
        FactCategory.NEWS_EVENT,
        FactCategory.REGULATORY_FILING,
        FactCategory.PUBLIC_STATISTIC,
    ],
)
def test_wikimedia_does_not_claim_non_reference_categories(
    category: FactCategory,
) -> None:
    client = FakeClient([])
    request = _request(SourceType.PUBLIC_WEB).model_copy(
        update={
            "required_facts": (
                RequiredFact(
                    key="unsupported",
                    description="unsupported",
                    category=category,
                    data_scope="EXTERNAL_PUBLIC",
                    subject="subject",
                    jurisdiction="CN",
                    market_metric=(
                        "LAST_PRICE"
                        if category is FactCategory.MARKET_QUOTE
                        else None
                    ),
                ),
            )
        }
    )
    query = _query(SourceType.PUBLIC_WEB).model_copy(
        update={"request": request, "unresolved_fact_keys": ("unsupported",)}
    )

    result = PublicWebSource(client=client, now=lambda: NOW).fetch(query)

    assert result.documents == ()
    assert result.attempt.status is SourceAttemptStatus.SKIPPED
    assert result.attempt.facts_attempted == ()
    assert client.calls == []


def test_public_web_sanitizes_all_ordinary_provider_failures_only() -> None:
    class BrokenProvider:
        coverage_label = "WIKIMEDIA_ONLY"

        def search(self, _query: SourceQuery) -> SearchDiscovery:
            raise RuntimeError("provider secret\ntrace")

    def broken_callable(_query: SourceQuery) -> SearchDiscovery:
        raise ValueError("callable secret\ntrace")

    for provider in (BrokenProvider(), broken_callable):
        result = PublicWebSource(
            client=FakeClient([]), search_provider=provider, now=lambda: NOW
        ).fetch(_query(SourceType.PUBLIC_WEB))
        assert result.documents == ()
        assert result.attempt.status is SourceAttemptStatus.FAILED
        assert result.attempt.error == "wikimedia_search_unavailable"

    def interrupted(_query: SourceQuery) -> SearchDiscovery:
        raise KeyboardInterrupt

    with pytest.raises(KeyboardInterrupt):
        PublicWebSource(client=FakeClient([]), search_provider=interrupted, now=lambda: NOW).fetch(
            _query(SourceType.PUBLIC_WEB)
        )


def test_public_web_rejects_missing_robots_and_arbitrary_discovered_path() -> None:
    page_url = "https://zh.wikipedia.org/wiki/Test"
    provider = _discovery_provider(page_url)
    missing = PublicWebSource(
        client=FakeClient([RuntimeError("network details\nsecret")]),
        search_provider=provider,
        now=lambda: NOW,
    ).fetch(_query(SourceType.PUBLIC_WEB))
    assert missing.documents == ()
    assert missing.attempt.error == "public_web_unavailable"

    arbitrary_provider = _discovery_provider("https://zh.wikipedia.org/w/index.php?title=Test")
    client = FakeClient([])
    arbitrary = PublicWebSource(
        client=client, search_provider=arbitrary_provider, now=lambda: NOW
    ).fetch(_query(SourceType.PUBLIC_WEB))
    assert arbitrary.documents == ()
    assert arbitrary.attempt.error == "public_web_unavailable"
    assert client.calls == []


def test_public_web_rejects_redirect_before_following_page() -> None:
    page_url = "https://zh.wikipedia.org/wiki/Test"

    class RedirectingClient(FakeClient):
        def __init__(self) -> None:
            super().__init__(
                [
                    _response(
                        "https://zh.wikipedia.org/robots.txt",
                        b"User-agent: *\nAllow: /wiki/",
                        content_type="text/plain",
                    )
                ]
            )
            self.followed = False

        def fetch(self, url: str, **kwargs: object) -> PinnedHTTPSResponse:
            if url.endswith("/robots.txt"):
                return super().fetch(url, **kwargs)
            self.calls.append((url, kwargs))
            validator = kwargs.get("redirect_validator")
            assert callable(validator)
            if validator(url, "https://zh.wikipedia.org/wiki/Redirected") is False:
                raise RuntimeError("redirect rejected before follow")
            self.followed = True
            return _response(
                "https://zh.wikipedia.org/wiki/Redirected",
                b"<title>x</title><p>followed</p>",
                content_type="text/html",
            )

    client = RedirectingClient()
    result = PublicWebSource(
        client=client,
        search_provider=_discovery_provider(page_url),
        now=lambda: NOW,
    ).fetch(_query(SourceType.PUBLIC_WEB, max_items=1))

    assert result.documents == ()
    assert result.attempt.status is SourceAttemptStatus.FAILED
    assert client.followed is False
    assert len(client.calls) == 2
    assert callable(client.calls[0][1].get("redirect_validator"))
