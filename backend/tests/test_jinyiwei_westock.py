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

BACKEND = Path(__file__).parents[1]
FIXTURES = Path(__file__).parent / "fixtures" / "mcp"
NOW = datetime(2026, 7, 23, 2, 0, 30, tzinfo=UTC)


def _json_fixture(name: str) -> dict[str, object]:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def _enabled_registry() -> McpRegistry:
    payload = yaml.safe_load(
        (BACKEND / "config" / "jinyiwei_mcp.yaml").read_text(encoding="utf-8")
    )
    payload["servers"][0]["enabled"] = True
    for tool in payload["tools"]:
        tool["enabled"] = True
    return McpRegistry.from_mapping(payload)


def _request(*, jurisdiction: str | None = "CN") -> DataGapRequest:
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
                subject="比亚迪",
                jurisdiction=jurisdiction,
                expected_unit="CNY" if jurisdiction == "CN" else None,
                expected_shape="number",
            ),
        ),
        decision_context="回答用户查询",
        freshness=FreshnessRequirement(max_age_seconds=60),
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
        failure: str | None = None,
    ) -> None:
        self.registry = registry
        self.search_payload = search_payload or _json_fixture(
            "westock_search_byd.json"
        )["result"]
        self.quote_payload = quote_payload or _json_fixture(
            "westock_quote_byd.json"
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
        payload = (
            self.search_payload
            if approval.tool_name == "data_search"
            else self.quote_payload
        )
        return McpToolResult(server.server_id, approval.tool_name, payload)


def _fetch(
    *,
    jurisdiction: str | None = "CN",
    client: _FixtureClient | None = None,
):
    registry = _enabled_registry()
    selected_client = client or _FixtureClient(registry)
    source = McpSource(
        registry=registry,
        client=selected_client,
        mapper=DeterministicMcpMapper(),
        now=lambda: NOW,
    )
    request = _request(jurisdiction=jurisdiction)
    query = SourceQuery(
        request=request,
        unresolved_fact_keys=("current_quote",),
        max_items=3,
        deadline_at="2026-07-23T02:00:40Z",
    )
    return request, selected_client, source.fetch(query)


def test_repository_westock_config_is_disabled_and_approves_only_query_tools() -> None:
    payload = yaml.safe_load(
        (BACKEND / "config" / "jinyiwei_mcp.yaml").read_text(encoding="utf-8")
    )

    assert payload["servers"][0]["enabled"] is False
    assert payload["servers"][0]["endpoint_url"] == (
        "https://stockbuddy.qq.com/cgi/cgi-bin/openai/mcp/mcp"
    )
    assert all(tool["enabled"] is False for tool in payload["tools"])
    assert {tool["tool_name"] for tool in payload["tools"]} == {
        "data_search",
        "data_quote",
    }
    serialized = json.dumps(payload, ensure_ascii=False).casefold()
    assert all(
        marker not in serialized
        for marker in ("token", "cookie", "account_id", "user_id", "通达信")
    )


def test_byd_quote_uses_search_then_quote_and_returns_cited_evidence() -> None:
    request, client, result = _fetch()

    assert client.calls == [
        ("data_search", {"query": "比亚迪"}),
        ("data_quote", {"code": "sz002594"}),
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
    assert item.access_metadata["instrument_id"] == "sz002594"
    assert item.as_of == "2026-07-23T02:00:00Z"


def test_byd_without_jurisdiction_does_not_default_to_a_or_h_share() -> None:
    _request_value, client, result = _fetch(jurisdiction=None)

    assert client.calls == [("data_search", {"query": "比亚迪"})]
    assert result.documents == ()
    assert result.attempt.status is SourceAttemptStatus.FAILED
    assert result.attempt.error == "fact_conflicted"


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
    search["structuredContent"]["matches"] = [
        {
            "name": "比亚迪",
            "security_type": "EQUITY",
            "jurisdiction": "CN",
            "market": "CN",
            "instrument_id": instrument_id,
        }
    ]
    client = _FixtureClient(registry, search_payload=search)

    _request_value, _client, result = _fetch(client=client)

    assert [name for name, _arguments in client.calls] == ["data_search"]
    assert result.documents == ()
    assert result.attempt.error == "mcp_mapping_failed"


def test_duplicate_matching_instrument_rows_are_conflicted() -> None:
    registry = _enabled_registry()
    search = _json_fixture("westock_search_byd.json")["result"]
    search["structuredContent"]["matches"] = [
        search["structuredContent"]["matches"][0],
        search["structuredContent"]["matches"][0],
    ]
    client = _FixtureClient(registry, search_payload=search)

    _request_value, _client, result = _fetch(client=client)

    assert [name for name, _arguments in client.calls] == ["data_search"]
    assert result.attempt.error == "fact_conflicted"


def test_nfkc_equivalent_name_is_matched_before_market_disambiguation() -> None:
    registry = _enabled_registry()
    search = _json_fixture("westock_search_byd.json")["result"]
    search["structuredContent"]["matches"][0]["name"] = "ＢＹＤ"
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
        "data_quote",
    ]
    assert result.attempt.status is SourceAttemptStatus.SUCCEEDED


def test_h_share_identifier_is_valid_when_hk_market_is_explicit() -> None:
    registry = _enabled_registry()
    quote = _json_fixture("westock_quote_byd.json")["result"]
    quote["structuredContent"]["quote"].update(
        instrument_id="hk01211",
        currency="HKD",
    )
    quote["structuredContent"]["source_url"] = (
        "https://stockapp.finance.qq.com/stock/hk01211"
    )
    client = _FixtureClient(registry, quote_payload=quote)

    _request_value, _client, result = _fetch(jurisdiction="HK", client=client)

    assert client.calls == [
        ("data_search", {"query": "比亚迪"}),
        ("data_quote", {"code": "hk01211"}),
    ]
    assert result.attempt.status is SourceAttemptStatus.SUCCEEDED
    assert result.documents[0].metadata["currency"] == "HKD"


@pytest.mark.parametrize(
    ("jurisdiction", "instrument_id", "currency"),
    (
        ("HK", "hk01211", "CNY"),
        ("CN", "sz002594", "HKD"),
    ),
)
def test_market_approved_currency_is_required_without_fact_unit_hint(
    jurisdiction: str,
    instrument_id: str,
    currency: str,
) -> None:
    registry = _enabled_registry()
    quote = _json_fixture("westock_quote_byd.json")["result"]
    quote["structuredContent"]["quote"].update(
        instrument_id=instrument_id,
        currency=currency,
    )
    quote["structuredContent"]["source_url"] = (
        f"https://stockapp.finance.qq.com/stock/{instrument_id}"
    )
    request = _request(jurisdiction=jurisdiction).model_copy(
        update={
            "required_facts": (
                _request(jurisdiction=jurisdiction)
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

    assert result.documents == ()
    assert result.attempt.error == "mcp_mapping_failed"


@pytest.mark.parametrize(
    ("field", "value"),
    (
        ("name", "比亚\u202e迪"),
        ("name", "比亚\u200b迪"),
        ("security_type", "EQU\u2066ITY"),
        ("market", "C\u0000N"),
        ("jurisdiction", "C\u0085N"),
    ),
)
def test_raw_candidate_controls_are_rejected_before_normalization(
    field: str,
    value: str,
) -> None:
    registry = _enabled_registry()
    search = _json_fixture("westock_search_byd.json")["result"]
    search["structuredContent"]["matches"] = [
        {
            **search["structuredContent"]["matches"][0],
            field: value,
        }
    ]
    client = _FixtureClient(registry, search_payload=search)

    _request_value, _client, result = _fetch(client=client)

    assert [name for name, _arguments in client.calls] == ["data_search"]
    assert result.documents == ()
    assert result.attempt.error == "mcp_mapping_failed"


@pytest.mark.parametrize(
    "mutate",
    (
        lambda payload: payload["structuredContent"]["quote"].update(price=0),
        lambda payload: payload["structuredContent"]["quote"].update(price=-1),
        lambda payload: payload["structuredContent"].update(publisher="Attacker"),
        lambda payload: payload["structuredContent"].update(
            source_url="https://evil.example/phish"
        ),
        lambda payload: payload["structuredContent"].update(
            source_url=(
                "https://stockapp.finance.qq.com/stock/sz002594?redirect=evil"
            )
        ),
        lambda payload: payload["structuredContent"].update(
            source_url="https://user@stockapp.finance.qq.com/stock/sz002594"
        ),
        lambda payload: payload["structuredContent"].update(
            source_url="https://stockapp.finance.qq.com/phish/sz002594"
        ),
        lambda payload: payload["structuredContent"]["quote"].update(currency="USD"),
        lambda payload: payload["structuredContent"]["quote"].update(
            as_of="2026-07-23T02:01:00Z"
        ),
    ),
)
def test_quote_value_and_provenance_are_approval_bound(mutate) -> None:
    registry = _enabled_registry()
    quote = _json_fixture("westock_quote_byd.json")["result"]
    mutate(quote)
    client = _FixtureClient(registry, quote_payload=quote)

    _request_value, _client, result = _fetch(client=client)

    assert result.documents == ()
    assert result.attempt.error == "mcp_mapping_failed"


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


def test_stale_westock_quote_is_not_returned_as_current_evidence() -> None:
    registry = _enabled_registry()
    stale = _json_fixture("westock_quote_byd.json")["result"]
    stale["structuredContent"]["quote"]["as_of"] = "2026-07-23T01:00:00Z"
    request, _client, result = _fetch(
        client=_FixtureClient(registry, quote_payload=stale)
    )

    items = StructuredEvidenceExtractor(model=lambda _prompt: pytest.fail()).extract(
        SourceQuery(
            request=request,
            unresolved_fact_keys=("current_quote",),
            max_items=3,
            deadline_at="2026-07-23T02:00:40Z",
        ),
        result.documents,
    )
    assert items[0].as_of == "2026-07-23T01:00:00Z"


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
):
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
        db_path=tmp_path / "jinyiwei.sqlite3",
    )
    return coordinator.investigate(
        _request(), department="户部", matter_type="股票查询"
    )


def test_archive_miss_reaches_westock_and_resolves_current_quote(
    tmp_path: Path,
) -> None:
    registry = _enabled_registry()
    client = _FixtureClient(registry)

    pack = _coordinator_pack(tmp_path, client)

    assert pack.resolved_facts == ("current_quote",)
    assert pack.unresolved_facts == ()
    assert pack.evidence_by_fact["current_quote"][0].publisher == "腾讯自选股"
    assert [name for name, _arguments in client.calls] == [
        "data_search",
        "data_quote",
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


def test_stale_archive_is_background_and_westock_refreshes_quote(
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
    assert pack.evidence_by_fact["current_quote"][0].source_type is SourceType.MCP
    assert (
        pack.historical_evidence_by_fact["current_quote"][0].source_type
        is SourceType.SHIGUAN
    )
    assert [name for name, _arguments in client.calls] == [
        "data_search",
        "data_quote",
    ]


def test_stale_westock_quote_remains_unresolved(tmp_path: Path) -> None:
    registry = _enabled_registry()
    stale = _json_fixture("westock_quote_byd.json")["result"]
    stale["structuredContent"]["quote"]["as_of"] = "2026-07-23T01:00:00Z"
    client = _FixtureClient(registry, quote_payload=stale)

    pack = _coordinator_pack(tmp_path, client)

    assert pack.resolved_facts == ()
    assert pack.unresolved_facts == ("current_quote",)
    assert pack.evidence_by_fact["current_quote"] == ()
    assert "fact_stale:current_quote" in pack.do_not_infer


def test_sanitized_protocol_fixtures_have_no_identity_or_secret_material() -> None:
    initialize = _json_fixture("westock_initialize.json")
    tools = _json_fixture("westock_tools_list.json")
    samples = (
        initialize,
        tools,
        _json_fixture("westock_search_byd.json"),
        _json_fixture("westock_quote_byd.json"),
    )

    assert initialize["result"]["protocolVersion"] == "2025-03-26"
    assert [item["name"] for item in tools["result"]["tools"]] == [
        "data_search",
        "data_quote",
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
    assert "deferred to Task 9" in normalized_provenance
    assert "2026-07-23" in provenance
    assert "data_search" in provenance and "data_quote" in provenance
