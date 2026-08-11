from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path

import pytest
import yaml

from app.jinyiwei.coordinator import InvestigationCoordinator
from app.jinyiwei.extractor import StructuredEvidenceExtractor
from app.jinyiwei.mcp.client import McpClientError, McpToolResult
from app.jinyiwei.mcp.mapping import DeterministicMcpMapper
from app.jinyiwei.mcp.registry import McpRegistry
from app.jinyiwei.models import (
    DataGapRequest,
    DataScope,
    EvidenceItem,
    EvidenceQuality,
    EvidenceStance,
    FactCategory,
    FreshnessRequirement,
    RequiredFact,
    SourceAttempt,
    SourceAttemptStatus,
    SourceType,
)
from app.jinyiwei.sources.base import SourceDocument, SourceQuery, SourceResult
from app.jinyiwei.sources.mcp import McpSource
from app.jinyiwei.storage import list_investigations

BACKEND = Path(__file__).parents[1]
FIXTURES = Path(__file__).parent / "fixtures" / "mcp"
NOW = datetime(2026, 7, 23, 2, 0, 30, tzinfo=UTC)
OWNER_USER_ID = "westock-test-owner"


def _json_fixture(name: str) -> dict[str, object]:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def _quote_fixture_for(
    code: str, *, name: str, market_type: str
) -> dict[str, object]:
    quote = _json_fixture("westock_quote_byd.json")["result"]
    record = quote["structuredContent"]["data"]["sz002594"]
    record.update(code=code, symbol=code, name=name, market_type=market_type)
    quote["structuredContent"]["data"] = {code: record}
    return quote


def _enabled_registry() -> McpRegistry:
    payload = yaml.safe_load(
        (BACKEND / "config" / "jinyiwei_mcp.yaml").read_text(encoding="utf-8")
    )
    payload["servers"][0]["enabled"] = True
    for tool in payload["tools"]:
        tool["enabled"] = True
    return McpRegistry.from_mapping(payload)


def _quote_only_registry() -> McpRegistry:
    payload = yaml.safe_load(
        (BACKEND / "config" / "jinyiwei_mcp.yaml").read_text(encoding="utf-8")
    )
    payload["tools"] = [
        tool for tool in payload["tools"] if tool["tool_name"] != "data_minute"
    ]
    return McpRegistry.from_mapping(payload)


def _minute_fixture_for(code: str) -> dict[str, object]:
    minute = _json_fixture("westock_minute_byd.json")["result"]
    record = minute["structuredContent"]["data"].pop("sz002594")
    minute["structuredContent"]["data"][code] = record
    return minute


def _request(
    *,
    jurisdiction: str | None = "CN",
    subject: str = "比亚迪",
    max_age_seconds: int = 60,
    market_metric: str = "INTRADAY_SERIES",
) -> DataGapRequest:
    return DataGapRequest(
        request_id="req-byd",
        requesting_agent="户部度支司",
        question="看看比亚迪股票价格",
        required_facts=(
            RequiredFact(
                key="current_quote",
                description="比亚迪股票当前价格",
                category=FactCategory.MARKET_QUOTE,
                data_scope=DataScope.EXTERNAL_PUBLIC,
                subject=subject,
                jurisdiction=jurisdiction,
                expected_unit="CNY" if jurisdiction == "CN" else None,
                expected_shape="number",
                market_metric=market_metric,
            ),
        ),
        decision_context="回答用户查询",
        freshness=FreshnessRequirement(max_age_seconds=max_age_seconds),
        timeout_seconds=10,
        source_scope=(SourceType.SHIGUAN, SourceType.MCP),
    )


class _FixtureClient:
    def __init__(
        self,
        registry: McpRegistry,
        *,
        search_payload: dict[str, object] | None = None,
        quote_payload: dict[str, object] | None = None,
        minute_payload: dict[str, object] | None = None,
        failure: str | None = None,
    ) -> None:
        self.registry = registry
        self.search_payload = search_payload or _json_fixture(
            "westock_search_byd.json"
        )["result"]
        self.quote_payload = quote_payload or _json_fixture(
            "westock_quote_byd.json"
        )["result"]
        self.minute_payload = minute_payload or _json_fixture(
            "westock_minute_byd.json"
        )["result"]
        self.failure = failure
        self.calls: list[tuple[str, dict[str, object]]] = []

    def discover(self, server):
        tools = tuple(_json_fixture("westock_tools_list.json")["result"]["tools"])
        self.registry.verify_discovery(server.server_id, tools)
        return tools

    def call(self, server, approval, arguments):
        if self.failure is not None:
            raise McpClientError(self.failure)
        normalized = dict(arguments)
        self.calls.append((approval.tool_name, normalized))
        payload = {
            "data_search": self.search_payload,
            "data_quote": self.quote_payload,
            "data_minute": self.minute_payload,
        }[approval.tool_name]
        return McpToolResult(server.server_id, approval.tool_name, payload)


def _fetch(
    *,
    jurisdiction: str | None = "CN",
    subject: str = "比亚迪",
    max_age_seconds: int = 60,
    market_metric: str = "INTRADAY_SERIES",
    client: _FixtureClient | None = None,
):
    registry = client.registry if client is not None else _enabled_registry()
    selected_client = client or _FixtureClient(registry)
    source = McpSource(
        registry=registry,
        client=selected_client,
        mapper=DeterministicMcpMapper(),
        now=lambda: NOW,
    )
    request = _request(
        jurisdiction=jurisdiction,
        subject=subject,
        max_age_seconds=max_age_seconds,
        market_metric=market_metric,
    )
    query = SourceQuery(
        request=request,
        unresolved_fact_keys=("current_quote",),
        max_items=3,
        deadline_at="2026-07-23T02:00:40Z",
    )
    return request, selected_client, source.fetch(query)


def test_repository_westock_config_enables_only_approved_query_tools() -> None:
    payload = yaml.safe_load(
        (BACKEND / "config" / "jinyiwei_mcp.yaml").read_text(encoding="utf-8")
    )

    assert payload["servers"][0]["enabled"] is True
    assert payload["servers"][0]["endpoint_url"] == (
        "https://stockbuddy.qq.com/cgi/cgi-bin/openai/mcp/mcp"
    )
    assert all(tool["enabled"] is True for tool in payload["tools"])
    assert {tool["tool_name"] for tool in payload["tools"]} == {
        "data_search",
        "data_quote",
        "data_minute",
    }
    serialized = json.dumps(payload, ensure_ascii=False).casefold()
    assert all(
        marker not in serialized
        for marker in (
            "access_token",
            "refresh_token",
            "bearer ",
            "cookie",
            "account_id",
            "user_id",
            "通达信",
        )
    )


def test_byd_quote_uses_search_then_quote_and_returns_cited_evidence() -> None:
    request, client, result = _fetch()

    assert client.calls == [
        ("data_search", {"query": "比亚迪"}),
        ("data_minute", {"code": "sz002594"}),
    ]
    assert result.attempt.status is SourceAttemptStatus.SUCCEEDED
    items = StructuredEvidenceExtractor(model=lambda _prompt: pytest.fail()).extract(
        SourceQuery(
            request=request,
            unresolved_fact_keys=("current_quote",),
            max_items=3,
            deadline_at="2026-07-23T02:00:40Z",
        ),
        result.documents,
    )
    item = items[0]
    assert item.value == 321.5
    assert item.unit == "CNY"
    assert item.source_type is SourceType.MCP
    assert item.publisher == "腾讯自选股"
    assert item.access_metadata["resolved_subject"] == "sz002594"
    assert item.access_metadata["a_share_identity"] == {
        "canonical_name": "比亚迪",
        "exchange": "SZSE",
        "ticker": "002594",
        "instrument_type": "A_SHARE",
        "currency": "CNY",
    }
    assert item.access_metadata["market_metric"] == "INTRADAY_SERIES"
    assert item.as_of == "2026-07-23T02:00:00Z"
    assert item.access_metadata["as_of_precision"] == "minute"


def test_byd_without_jurisdiction_defaults_to_mainland_a_share() -> None:
    registry = _enabled_registry()
    search = _json_fixture("westock_search_byd.json")["result"]
    search["structuredContent"]["data"][1]["name"] = "比亚迪"
    client = _FixtureClient(registry, search_payload=search)
    _request_value, client, result = _fetch(jurisdiction=None, client=client)

    assert client.calls == [
        ("data_search", {"query": "比亚迪"}),
        ("data_minute", {"code": "sz002594"}),
    ]
    assert result.attempt.status is SourceAttemptStatus.SUCCEEDED
    assert result.documents[0].metadata["unit"] == "CNY"


@pytest.mark.parametrize(
    "instrument_id",
    (
        'sz002594","other":"x',
        "sz 002594",
        "sz002594\u0000",
        "sz002594\u202e",
        "x" * 65,
        '{"code":"sz002594"}',
        {"code": "sz002594"},
        ["sz002594"],
    ),
)
def test_untrusted_instrument_identifier_never_reaches_quote(
    instrument_id: object,
) -> None:
    registry = _enabled_registry()
    search = _json_fixture("westock_search_byd.json")["result"]
    search["structuredContent"]["data"] = [
        {
            "name": "比亚迪",
            "type": "GP-A",
            "code": instrument_id,
        }
    ]
    client = _FixtureClient(registry, search_payload=search)

    _request_value, _client, result = _fetch(
        client=client,
        market_metric="LAST_PRICE",
    )

    assert [name for name, _arguments in client.calls] == ["data_search"]
    assert result.documents == ()
    assert result.attempt.error == "instrument_not_found"


def test_duplicate_rows_for_same_instrument_are_deduplicated() -> None:
    registry = _enabled_registry()
    search = _json_fixture("westock_search_byd.json")["result"]
    search["structuredContent"]["data"] = [
        search["structuredContent"]["data"][0],
        search["structuredContent"]["data"][0],
    ]
    client = _FixtureClient(registry, search_payload=search)

    _request_value, _client, result = _fetch(client=client)

    assert [name for name, _arguments in client.calls] == [
        "data_search",
        "data_minute",
    ]
    assert result.attempt.status is SourceAttemptStatus.SUCCEEDED


def test_distinct_matching_instruments_are_ambiguous() -> None:
    registry = _enabled_registry()
    search = _json_fixture("westock_search_byd.json")["result"]
    first = search["structuredContent"]["data"][0]
    search["structuredContent"]["data"] = [
        first,
        {**first, "code": "sh600001"},
    ]
    client = _FixtureClient(registry, search_payload=search)

    _request_value, _client, result = _fetch(client=client)

    assert [name for name, _arguments in client.calls] == ["data_search"]
    assert result.attempt.error == "instrument_ambiguous"


def test_nfkc_equivalent_name_is_matched_before_market_disambiguation() -> None:
    registry = _enabled_registry()
    search = _json_fixture("westock_search_byd.json")["result"]
    search["structuredContent"]["data"][0]["name"] = "ＢＹＤ"
    request = _request().model_copy(
        update={
            "required_facts": (
                _request().required_facts[0].model_copy(update={"subject": "BYD"}),
            )
        }
    )
    client = _FixtureClient(registry, search_payload=search)
    source = McpSource(
        registry=registry,
        client=client,
        mapper=DeterministicMcpMapper(),
        now=lambda: NOW,
    )

    result = source.fetch(
        SourceQuery(
            request=request,
            unresolved_fact_keys=("current_quote",),
            max_items=3,
            deadline_at="2026-07-23T02:00:40Z",
        )
    )

    assert [name for name, _arguments in client.calls] == [
        "data_search",
        "data_minute",
    ]
    assert result.attempt.status is SourceAttemptStatus.SUCCEEDED


def test_explicit_h_share_identifier_is_out_of_scope_without_calls() -> None:
    registry = _enabled_registry()
    quote = _quote_fixture_for("hk01211", name="比亚迪股份", market_type="31")
    client = _FixtureClient(
        registry,
        quote_payload=quote,
        minute_payload=_minute_fixture_for("hk01211"),
    )

    _request_value, _client, result = _fetch(
        jurisdiction="HK",
        subject="01211.HK",
        client=client,
    )

    assert client.calls == []
    assert result.attempt.status is SourceAttemptStatus.FAILED
    assert result.attempt.error == "market_out_of_scope"


@pytest.mark.parametrize(
    ("jurisdiction", "subject", "instrument_id", "expected_unit"),
    (
        ("HK", "01211.HK", "hk01211", None),
        ("CN", "比亚迪", "sz002594", "CNY"),
    ),
)
def test_market_approved_unit_is_used_without_remote_unit_or_fact_hint(
    jurisdiction: str,
    subject: str,
    instrument_id: str,
    expected_unit: str | None,
) -> None:
    registry = _enabled_registry()
    quote = _quote_fixture_for(
        instrument_id,
        name=subject,
        market_type="31" if jurisdiction == "HK" else "51",
    )
    request = _request(
        jurisdiction=jurisdiction,
        subject=subject,
        market_metric="LAST_PRICE",
    ).model_copy(
        update={
            "required_facts": (
                _request(
                    jurisdiction=jurisdiction,
                    subject=subject,
                    market_metric="LAST_PRICE",
                )
                .required_facts[0]
                .model_copy(update={"expected_unit": None}),
            )
        }
    )
    client = _FixtureClient(registry, quote_payload=quote)
    source = McpSource(
        registry=registry,
        client=client,
        mapper=DeterministicMcpMapper(),
        now=lambda: NOW,
    )

    result = source.fetch(
        SourceQuery(
            request=request,
            unresolved_fact_keys=("current_quote",),
            max_items=3,
            deadline_at="2026-07-23T02:00:40Z",
        )
    )

    if jurisdiction == "HK":
        assert client.calls == []
        assert result.attempt.status is SourceAttemptStatus.FAILED
        assert result.attempt.error == "market_out_of_scope"
    else:
        assert result.attempt.status is SourceAttemptStatus.SUCCEEDED
        assert result.documents[0].metadata["unit"] == expected_unit


@pytest.mark.parametrize(
    ("field", "value"),
    (
        ("name", "比亚\u202e迪"),
        ("name", "比亚\u200b迪"),
        ("type", "GP\u2066-A"),
        ("code", "sz\u0000002594"),
        ("code", "sz\u0085002594"),
    ),
)
def test_raw_candidate_controls_are_rejected_before_normalization(
    field: str,
    value: str,
) -> None:
    registry = _enabled_registry()
    search = _json_fixture("westock_search_byd.json")["result"]
    search["structuredContent"]["data"] = [
        {
            **search["structuredContent"]["data"][0],
            field: value,
        }
    ]
    client = _FixtureClient(registry, search_payload=search)

    _request_value, _client, result = _fetch(
        client=client,
        market_metric="LAST_PRICE",
    )

    assert [name for name, _arguments in client.calls] == ["data_search"]
    assert result.documents == ()
    assert result.attempt.error == "instrument_not_found"


@pytest.mark.parametrize(
    "mutate",
    (
        lambda payload: payload["structuredContent"]["data"]["sz002594"].update(
            price=0
        ),
        lambda payload: payload["structuredContent"]["data"]["sz002594"].update(
            price=-1
        ),
        lambda payload: payload["structuredContent"].update(ok=False),
        lambda payload: payload["structuredContent"]["data"]["sz002594"].update(
            code="hk01211"
        ),
        lambda payload: payload["structuredContent"].update(data={}),
        lambda payload: payload["structuredContent"]["data"]["sz002594"].pop(
            "price"
        ),
    ),
)
def test_quote_value_and_provenance_are_approval_bound(mutate) -> None:
    registry = _quote_only_registry()
    quote = _json_fixture("westock_quote_byd.json")["result"]
    mutate(quote)
    client = _FixtureClient(registry, quote_payload=quote)

    _request_value, _client, result = _fetch(
        client=client,
        market_metric="LAST_PRICE",
    )

    assert result.documents == ()
    assert result.attempt.error == "quote_unavailable"


def test_remote_extra_provenance_cannot_override_approved_literals() -> None:
    registry = _enabled_registry()
    quote = _json_fixture("westock_quote_byd.json")["result"]
    quote["structuredContent"].update(
        publisher="Attacker",
        source_url="https://evil.example/phish",
        currency="USD",
    )

    _request_value, _client, result = _fetch(
        client=_FixtureClient(registry, quote_payload=quote),
        market_metric="LAST_PRICE",
    )

    assert result.attempt.status is SourceAttemptStatus.SUCCEEDED
    assert result.documents[0].publisher == "腾讯自选股"
    assert result.documents[0].source_url == (
        "https://stockbuddy.qq.com/cgi/cgi-bin/openai/mcp/mcp"
    )
    assert result.documents[0].metadata["unit"] == "CNY"


@pytest.mark.parametrize(
    "failure", ("source_authorization_failed", "source_unavailable")
)
def test_westock_failure_is_fail_closed(failure: str) -> None:
    registry = _enabled_registry()
    client = _FixtureClient(registry, failure=failure)

    _request_value, _client, result = _fetch(client=client)

    assert result.documents == ()
    assert result.attempt.status is SourceAttemptStatus.FAILED
    assert result.attempt.error == (
        "auth_required"
        if failure == "source_authorization_failed"
        else "fact_unavailable"
    )


def test_date_precision_preserves_source_day_instead_of_retrieval_time() -> None:
    registry = _quote_only_registry()
    stale = _json_fixture("westock_quote_byd.json")["result"]
    stale["structuredContent"]["data"]["sz002594"]["time"] = "2026-07-22"
    _request_value, _client, result = _fetch(
        client=_FixtureClient(registry, quote_payload=stale),
        market_metric="LAST_PRICE",
    )

    assert result.attempt.status is SourceAttemptStatus.SUCCEEDED
    assert result.documents[0].as_of == "2026-07-21T16:00:00Z"
    assert result.documents[0].metadata["as_of_precision"] == "date"


def test_freshly_retrieved_prior_minute_is_latest_available_without_fallback() -> None:
    registry = _enabled_registry()
    stale_minute = _json_fixture("westock_minute_byd.json")["result"]
    stale_minute["structuredContent"]["data"]["sz002594"]["data"]["date"] = (
        "20260722"
    )
    client = _FixtureClient(registry, minute_payload=stale_minute)

    _request_value, _client, result = _fetch(
        client=client,
        max_age_seconds=43_200,
    )

    assert [name for name, _arguments in client.calls] == [
        "data_search",
        "data_minute",
    ]
    assert result.documents[0].source_name == "mcp:westock:data_minute"
    assert result.documents[0].as_of == "2026-07-22T02:00:00Z"


def test_malformed_minute_does_not_fallback_to_last_price_tool() -> None:
    registry = _enabled_registry()
    malformed_minute = _json_fixture("westock_minute_byd.json")["result"]
    malformed_minute["structuredContent"]["data"]["sz002594"]["data"]["data"] = [
        "1000 not-a-price 20 320.80"
    ]
    client = _FixtureClient(registry, minute_payload=malformed_minute)

    _request_value, _client, result = _fetch(
        client=client,
        max_age_seconds=43_200,
    )

    assert [name for name, _arguments in client.calls] == [
        "data_search",
        "data_minute",
    ]
    assert result.documents == ()
    assert result.attempt.error == "quote_unavailable"


class _NoDataSource:
    def fetch(self, query: SourceQuery) -> SourceResult:
        return SourceResult(
            documents=(),
            attempt=SourceAttempt(
                source_type=SourceType.SHIGUAN,
                source_name="fixture_archive",
                status=SourceAttemptStatus.SKIPPED,
                started_at="2026-07-23T02:00:30Z",
                completed_at="2026-07-23T02:00:30Z",
                error="source_unavailable",
                facts_attempted=query.unresolved_fact_keys,
            ),
        )


class _FreshArchiveSource:
    def __init__(self, as_of: str = "2026-07-23T02:00:00Z") -> None:
        self.as_of = as_of

    def fetch(self, query: SourceQuery) -> SourceResult:
        return SourceResult(
            documents=(
                SourceDocument(
                    source_type=SourceType.SHIGUAN,
                    source_name="fixture_archive",
                    source_url="internal://shiguan/byd-quote",
                    publisher="史馆",
                    title="比亚迪股票当前价格",
                    retrieved_at="2026-07-23T02:00:30Z",
                    as_of=self.as_of,
                    text="已归档的业务系统行情快照",
                    quality_ceiling=EvidenceQuality.PRIMARY,
                    metadata={"fact_key": "current_quote"},
                ),
            ),
            attempt=SourceAttempt(
                source_type=SourceType.SHIGUAN,
                source_name="fixture_archive",
                status=SourceAttemptStatus.SUCCEEDED,
                started_at="2026-07-23T02:00:30Z",
                completed_at="2026-07-23T02:00:30Z",
                facts_attempted=query.unresolved_fact_keys,
            ),
        )


class _HybridExtractor:
    def __init__(self) -> None:
        self._mcp = StructuredEvidenceExtractor(model=lambda _prompt: pytest.fail())

    def extract(self, query: SourceQuery, documents):
        if documents and documents[0].source_type is SourceType.SHIGUAN:
            return (
                EvidenceItem(
                    evidence_id="archive-byd-quote",
                    fact_key="current_quote",
                    value=320.0,
                    unit="CNY",
                    as_of=documents[0].as_of,
                    retrieved_at="2026-07-23T02:00:30Z",
                    source_url="internal://shiguan/byd-quote",
                    publisher="史馆",
                    source_type=SourceType.SHIGUAN,
                    quality=EvidenceQuality.PRIMARY,
                    stance=EvidenceStance.SUPPORTS,
                    excerpt="已归档的业务系统行情快照",
                    content_hash=hashlib.sha256(b"archive-byd-quote").hexdigest(),
                    confidence=0.9,
                ),
            )
        return self._mcp.extract(query, documents)


def _coordinator_pack(
    tmp_path: Path,
    client: _FixtureClient,
    *,
    shiguan=None,
    market_metric: str = "INTRADAY_SERIES",
):
    db_path = tmp_path / "jinyiwei.sqlite3"
    registry = client.registry
    mcp = McpSource(
        registry=registry,
        client=client,
        mapper=DeterministicMcpMapper(),
        now=lambda: NOW,
    )
    coordinator = InvestigationCoordinator(
        shiguan=shiguan or _NoDataSource(),
        mcp=mcp,
        public_api=_NoDataSource(),
        public_web=_NoDataSource(),
        extractor=_HybridExtractor(),
        clock=lambda: NOW,
        id_factory=iter(("investigation-byd", "pack-byd")).__next__,
        db_path=db_path,
    )
    pack = coordinator.investigate(
        _request(market_metric=market_metric),
        department="户部",
        matter_type="股票查询",
        owner_user_id=OWNER_USER_ID,
    )
    assert list_investigations(owner_user_id=OWNER_USER_ID, db_path=db_path).total == 1
    assert list_investigations(owner_user_id="other-owner", db_path=db_path).total == 0
    return pack


def test_archive_miss_reaches_fresh_westock_minute_quote(
    tmp_path: Path,
) -> None:
    registry = _enabled_registry()
    client = _FixtureClient(registry)

    pack = _coordinator_pack(tmp_path, client)

    assert pack.resolved_facts == ("current_quote",)
    assert pack.unresolved_facts == ()
    assert (
        pack.evidence_by_fact["current_quote"][0].source_type
        is SourceType.MCP
    )
    assert "fact_stale:current_quote" not in pack.do_not_infer
    assert [name for name, _arguments in client.calls] == [
        "data_search",
        "data_minute",
    ]


def test_fresh_archive_short_circuits_westock(tmp_path: Path) -> None:
    registry = _enabled_registry()
    client = _FixtureClient(registry)

    pack = _coordinator_pack(
        tmp_path,
        client,
        shiguan=_FreshArchiveSource(),
    )

    assert pack.resolved_facts == ("current_quote",)
    assert pack.evidence_by_fact["current_quote"][0].source_type is SourceType.SHIGUAN
    assert client.calls == []


def test_stale_archive_is_replaced_by_fresh_minute_quote(
    tmp_path: Path,
) -> None:
    registry = _enabled_registry()
    client = _FixtureClient(registry)

    pack = _coordinator_pack(
        tmp_path,
        client,
        shiguan=_FreshArchiveSource("2026-07-23T01:00:00Z"),
    )

    assert pack.resolved_facts == ("current_quote",)
    assert pack.unresolved_facts == ()
    assert (
        pack.evidence_by_fact["current_quote"][0].source_type
        is SourceType.MCP
    )
    assert (
        pack.historical_evidence_by_fact["current_quote"][0].source_type
        is SourceType.SHIGUAN
    )
    assert [name for name, _arguments in client.calls] == [
        "data_search",
        "data_minute",
    ]
    assert "fact_stale:current_quote" not in pack.do_not_infer


def test_freshly_retrieved_prior_westock_quote_resolves_as_latest_available(
    tmp_path: Path,
) -> None:
    registry = _quote_only_registry()
    stale = _json_fixture("westock_quote_byd.json")["result"]
    stale["structuredContent"]["data"]["sz002594"]["time"] = "2026-07-22"
    client = _FixtureClient(registry, quote_payload=stale)

    pack = _coordinator_pack(tmp_path, client, market_metric="LAST_PRICE")

    assert pack.resolved_facts == ("current_quote",)
    assert pack.unresolved_facts == ()
    assert pack.evidence_by_fact["current_quote"][0].as_of == (
        "2026-07-21T16:00:00Z"
    )
    assert "fact_stale:current_quote" not in pack.do_not_infer


def test_sanitized_protocol_fixtures_have_no_identity_or_secret_material() -> None:
    initialize = _json_fixture("westock_initialize.json")
    tools = _json_fixture("westock_tools_list.json")
    samples = (
        initialize,
        tools,
        _json_fixture("westock_search_byd.json"),
        _json_fixture("westock_quote_byd.json"),
        _json_fixture("westock_minute_byd.json"),
    )

    assert initialize["result"]["protocolVersion"] == "2025-03-26"
    assert [item["name"] for item in tools["result"]["tools"]] == [
        "data_search",
        "data_quote",
        "data_minute",
    ]
    serialized = json.dumps(samples, ensure_ascii=False).casefold()
    assert all(
        marker not in serialized
        for marker in (
            "access_token",
            "refresh_token",
            "authorization",
            "cookie",
            "account_id",
            "user_id",
        )
    )
    provenance = (FIXTURES / "README.md").read_text(encoding="utf-8")
    normalized_provenance = " ".join(provenance.split())
    assert "synthetic, sanitized JSON-RPC contract samples" in normalized_provenance
    assert "not verbatim Tencent WeStock responses" in normalized_provenance
    assert "connector-westock-mcp/SKILL.md" in normalized_provenance
    assert "bounded authenticated read-only structure observation" in (
        normalized_provenance
    )
    assert "raw authenticated responses were not saved or committed" in (
        normalized_provenance
    )
    assert "2026-07-23" in provenance
    assert "data_search" in provenance and "data_quote" in provenance
