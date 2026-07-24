"""Offline source routing tests for approved MCP tools."""

from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from threading import Event, Thread
from time import monotonic

import pytest

from app.jinyiwei.mcp.client import McpClientError, McpToolResult
from app.jinyiwei.mcp.contracts import (
    McpAccessPolicy,
    McpServerConfig,
    McpSourceKind,
    McpToolApproval,
    McpToolMapping,
    McpTransport,
    ToolEffect,
)
from app.jinyiwei.mcp.mapping import DeterministicMcpMapper
from app.jinyiwei.mcp.registry import McpRegistry, approval_fingerprint
from app.jinyiwei.models import (
    DataGapRequest,
    DataScope,
    EvidenceQuality,
    FactCategory,
    FreshnessRequirement,
    RequiredFact,
    SourceAttemptStatus,
    SourceType,
)
from app.jinyiwei.sources.base import SourceQuery
from app.jinyiwei.sources.mcp import McpSource

NOW = datetime(2026, 7, 22, 7, 1, tzinfo=UTC)


def _registry(
    *,
    server_update: dict[str, object] | None = None,
    approval_update: dict[str, object] | None = None,
    mapping_update: dict[str, object] | None = None,
) -> McpRegistry:
    server = McpServerConfig(
        server_id="westock",
        display_name="WeStock",
        endpoint_url="https://stockbuddy.qq.com/mcp",
        transport=McpTransport.STREAMABLE_HTTP,
        source_kind=McpSourceKind.PROFESSIONAL_DATA,
        access_policy=McpAccessPolicy.ANONYMOUS_PUBLIC,
        enabled=True,
        approval_version="v1",
        timeout_seconds=5,
        max_response_bytes=100_000,
        rate_limit_per_minute=30,
        cache_ttl_seconds=30,
    )
    discovered = {
        "name": "data_quote",
        "inputSchema": {
            "type": "object",
            "properties": {"code": {"type": "string"}},
            "required": ["code"],
            "additionalProperties": False,
        },
    }
    mapping = McpToolMapping(
        argument_paths={"code": "subject"},
        value_path="data.price",
        as_of_path="data.as_of",
        publisher_path="data.publisher",
        source_url_path="data.url",
        unit_path="data.unit",
        subject_path="data.code",
        quality_ceiling=EvidenceQuality.AUTHORITATIVE,
    )
    if mapping_update:
        mapping = McpToolMapping.model_validate(
            {**mapping.model_dump(mode="json"), **mapping_update}
        )
    if server_update:
        server = McpServerConfig.model_validate(
            {**server.model_dump(mode="json"), **server_update}
        )
    approval = McpToolApproval(
        server_id="westock",
        tool_name="data_quote",
        enabled=True,
        effect=ToolEffect.READ_ONLY,
        fact_categories=(FactCategory.MARKET_QUOTE,),
        market_metrics=("LAST_PRICE",),
        data_scopes=(DataScope.EXTERNAL_PUBLIC,),
        jurisdictions=("CN",),
        approval_version="v1",
        approved_discovered_tool=discovered,
        approved_fingerprint=approval_fingerprint(server, discovered, mapping),
        mapping=mapping,
    )
    if approval_update:
        approval = McpToolApproval.model_validate(
            {
                **approval.model_dump(mode="json"),
                **approval_update,
                "approved_fingerprint": approval_fingerprint(
                    server, discovered, mapping
                ),
            }
        )
    return McpRegistry((server,), (approval,))


def _query(
    *fact_keys: str,
    scope: tuple[SourceType, ...] | None = None,
    question: str = "查询",
    facts: tuple[RequiredFact, ...] | None = None,
) -> SourceQuery:
    default_facts = (
        RequiredFact(
            key="quote",
            description="比亚迪股价",
            category=FactCategory.MARKET_QUOTE,
            data_scope=DataScope.EXTERNAL_PUBLIC,
            subject="sz002594",
            jurisdiction="CN",
            expected_unit="CNY",
            expected_shape="number",
            market_metric="LAST_PRICE",
        ),
        RequiredFact(
            key="news",
            description="比亚迪最新新闻",
            category=FactCategory.NEWS_EVENT,
            data_scope=DataScope.EXTERNAL_PUBLIC,
            subject="比亚迪",
            jurisdiction="CN",
            expected_shape="array",
        ),
    )
    required_facts = default_facts if facts is None else facts
    request = DataGapRequest(
        request_id="req-1",
        requesting_agent="户部度支司",
        question=question,
        required_facts=required_facts,
        decision_context="决策",
        freshness=FreshnessRequirement(max_age_seconds=60),
        timeout_seconds=30,
        source_scope=scope or (SourceType.SHIGUAN, SourceType.MCP),
    )
    return SourceQuery(
        request=request,
        unresolved_fact_keys=fact_keys,
        max_items=3,
        deadline_at=(NOW + timedelta(seconds=30)).isoformat().replace("+00:00", "Z"),
    )


def _latest_market_query(now: datetime) -> SourceQuery:
    query = _query("quote")
    return query.model_copy(
        update={
            "request": query.request.model_copy(
                update={
                    "freshness": FreshnessRequirement(max_age_seconds=300),
                }
            ),
            "deadline_at": (now + timedelta(seconds=30))
            .isoformat()
            .replace("+00:00", "Z"),
        }
    )


def _two_quote_registry() -> McpRegistry:
    base = _registry()
    server = base.servers[0]
    approval = base.approvals[0]
    servers = tuple(
        server.model_copy(
            update={
                "server_id": server_id,
                "endpoint_url": f"https://{server_id}.example.test/mcp",
            }
        )
        for server_id in ("a-stock", "b-stock")
    )
    approvals = tuple(
        approval.model_copy(
            update={
                "server_id": server.server_id,
                "approved_fingerprint": approval_fingerprint(
                    server,
                    approval.approved_discovered_tool,
                    approval.mapping,
                ),
            }
        )
        for server in servers
    )
    return McpRegistry(servers, approvals)


class _Client:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str, dict[str, object]]] = []
        self.discoveries: list[str] = []

    def discover(self, server: McpServerConfig) -> tuple[object, ...]:
        self.discoveries.append(server.server_id)
        return ()

    def call(
        self,
        server: McpServerConfig,
        approval: McpToolApproval,
        arguments: dict[str, object],
    ) -> McpToolResult:
        self.calls.append((server.server_id, approval.tool_name, arguments))
        return McpToolResult(
            server_id=server.server_id,
            tool_name=approval.tool_name,
            payload={
                "data": {
                    "price": 321.5,
                    "as_of": "2026-07-22T07:00:00Z",
                    "publisher": "Tencent WeStock",
                    "url": "https://stockapp.finance.qq.com/stock/sz002594",
                    "unit": "CNY",
                    "code": "sz002594",
                }
            },
        )


def _resolution_registry() -> McpRegistry:
    base = _registry()
    server = base.servers[0]
    quote = base.approvals[0]
    resolution = {
        "tool_name": "data_search",
        "argument_paths": {"query": "subject"},
        "success_path": "structuredContent.ok",
        "candidates_path": "structuredContent.data",
        "candidate_subject_path": "code",
        "candidate_name_path": "name",
        "candidate_type_path": "type",
        "required_types_by_market": {"CN": ["GP-A"]},
        "target_argument": "code",
        "subject_pattern": r"(?:sh|sz)[0-9]{6}",
        "subject_max_length": 8,
        "markets_by_jurisdiction": {"CN": "CN"},
        "units_by_market": {"CN": "CNY"},
        "jurisdiction_subject_patterns": {"CN": r"(?:sh|sz)[0-9]{6}"},
        "exchange_subject_patterns": {
            "SSE": r"sh[0-9]{6}",
            "SZSE": r"sz[0-9]{6}",
        },
    }
    mapping = McpToolMapping.model_validate(
        {
            **quote.mapping.model_dump(mode="json"),
            "argument_paths": {},
            "entity_resolution": resolution,
        }
    )
    quote = quote.model_copy(
        update={
            "mapping": mapping,
            "approved_fingerprint": approval_fingerprint(
                server,
                quote.approved_discovered_tool,
                mapping,
            ),
        }
    )
    search_tool = {
        "name": "data_search",
        "inputSchema": {
            "type": "object",
            "properties": {"query": {"type": "string"}},
            "required": ["query"],
            "additionalProperties": False,
        },
    }
    resolver = McpToolApproval(
        server_id=server.server_id,
        tool_name="data_search",
        enabled=True,
        resolver_only=True,
        effect=ToolEffect.READ_ONLY,
        fact_categories=(FactCategory.ENTITY_REFERENCE,),
        data_scopes=(DataScope.EXTERNAL_PUBLIC,),
        jurisdictions=("CN",),
        approval_version="v1",
        approved_discovered_tool=search_tool,
        approved_fingerprint=approval_fingerprint(server, search_tool, None),
    )
    return McpRegistry((server,), (resolver, quote))


def _contract_approvals(
    server: McpServerConfig,
    *,
    suffix: str,
    priority: int,
) -> tuple[McpToolApproval, McpToolApproval]:
    base_quote = _registry().approvals[0]
    resolver_name = f"data_search_{suffix}"
    data_name = f"data_quote_{suffix}"
    resolution = {
        "tool_name": resolver_name,
        "argument_paths": {"query": "subject"},
        "success_path": "structuredContent.ok",
        "candidates_path": "structuredContent.data",
        "candidate_subject_path": "code",
        "candidate_name_path": "name",
        "candidate_type_path": "type",
        "required_types_by_market": {"CN": ["GP-A"]},
        "target_argument": "code",
        "subject_pattern": r"(?:sh|sz)[0-9]{6}",
        "subject_max_length": 8,
        "markets_by_jurisdiction": {"CN": "CN"},
        "units_by_market": {"CN": "CNY"},
        "jurisdiction_subject_patterns": {"CN": r"(?:sh|sz)[0-9]{6}"},
        "exchange_subject_patterns": {
            "SSE": r"sh[0-9]{6}",
            "SZSE": r"sz[0-9]{6}",
        },
    }
    mapping = McpToolMapping.model_validate(
        {
            **base_quote.mapping.model_dump(mode="json"),
            "argument_paths": {},
            "entity_resolution": resolution,
        }
    )
    data_tool = {
        **base_quote.approved_discovered_tool,
        "name": data_name,
    }
    quote = base_quote.model_copy(
        update={
            "server_id": server.server_id,
            "tool_name": data_name,
            "priority": priority,
            "approved_discovered_tool": data_tool,
            "mapping": mapping,
            "approved_fingerprint": approval_fingerprint(
                server,
                data_tool,
                mapping,
            ),
        }
    )
    search_tool = {
        "name": resolver_name,
        "inputSchema": {
            "type": "object",
            "properties": {"query": {"type": "string"}},
            "required": ["query"],
            "additionalProperties": False,
        },
    }
    resolver = McpToolApproval(
        server_id=server.server_id,
        tool_name=resolver_name,
        enabled=True,
        resolver_only=True,
        effect=ToolEffect.READ_ONLY,
        fact_categories=(FactCategory.ENTITY_REFERENCE,),
        data_scopes=(DataScope.EXTERNAL_PUBLIC,),
        jurisdictions=("CN",),
        approval_version="v1",
        approved_discovered_tool=search_tool,
        approved_fingerprint=approval_fingerprint(server, search_tool, None),
        priority=priority,
    )
    return resolver, quote


def _direct_approval(
    server: McpServerConfig,
    *,
    tool_name: str = "data_direct",
    priority: int = 1,
) -> McpToolApproval:
    base = _registry().approvals[0]
    discovered = {**base.approved_discovered_tool, "name": tool_name}
    return base.model_copy(
        update={
            "server_id": server.server_id,
            "tool_name": tool_name,
            "priority": priority,
            "approved_discovered_tool": discovered,
            "approved_fingerprint": approval_fingerprint(
                server,
                discovered,
                base.mapping,
            ),
        }
    )


def _multi_contract_registry(
    *,
    include_direct: bool = False,
) -> McpRegistry:
    server = _registry().servers[0]
    first = _contract_approvals(server, suffix="a", priority=10)
    second = _contract_approvals(server, suffix="b", priority=20)
    approvals = (
        *((_direct_approval(server),) if include_direct else ()),
        *first,
        *second,
    )
    return McpRegistry((server,), approvals)


def _ineligible_bse_registry(reason: str) -> McpRegistry:
    base = _resolution_registry()
    server = base.servers[0]
    resolver = base.approval("westock", "data_search")
    quote = base.approval("westock", "data_quote")
    assert quote.mapping is not None
    assert quote.mapping.entity_resolution is not None
    resolution = quote.mapping.entity_resolution.model_dump(mode="json")
    resolution.update(
        {
            "subject_pattern": r"(?:sh|sz|bj)[0-9]{6}",
            "jurisdiction_subject_patterns": {
                "CN": r"(?:sh|sz|bj)[0-9]{6}"
            },
            "exchange_subject_patterns": {
                **resolution["exchange_subject_patterns"],
                "BSE": r"bj[0-9]{6}",
            },
        }
    )
    mapping = McpToolMapping.model_validate(
        {
            **quote.mapping.model_dump(mode="json"),
            "entity_resolution": resolution,
        }
    )
    quote = quote.model_copy(update={"mapping": mapping})
    if reason == "non_read_only":
        quote = quote.model_copy(update={"effect": "WRITE"})
    elif reason == "disabled_server":
        server = server.model_copy(update={"enabled": False})
    elif reason == "metric_mismatch":
        quote = quote.model_copy(
            update={"market_metrics": ("INTRADAY_SERIES",)}
        )
    else:
        raise AssertionError(reason)
    return McpRegistry((server,), (resolver, quote))


class _ResolutionClient(_Client):
    def __init__(
        self,
        *,
        full_name_empty: bool = False,
        code_and_full_name_empty: bool = False,
        ambiguous: bool = False,
        always_empty: bool = False,
    ) -> None:
        super().__init__()
        self._full_name_empty = full_name_empty
        self._code_and_full_name_empty = code_and_full_name_empty
        self._ambiguous = ambiguous
        self._always_empty = always_empty

    def call(
        self,
        server: McpServerConfig,
        approval: McpToolApproval,
        arguments: dict[str, object],
    ) -> McpToolResult:
        if approval.tool_name != "data_search":
            return super().call(server, approval, arguments)
        self.calls.append((server.server_id, approval.tool_name, arguments))
        query = arguments["query"]
        if self._always_empty:
            candidates = []
        elif self._ambiguous:
            candidates = [
                {"name": "同名科技", "code": "sh600001", "type": "GP-A"},
                {"name": "同名科技", "code": "sz000001", "type": "GP-A"},
            ]
        elif (
            self._full_name_empty and query == "比亚迪股份有限公司"
        ) or (
            self._code_and_full_name_empty
            and query in {"002594.SZ", "比亚迪股份有限公司"}
        ):
            candidates = []
        else:
            candidates = [
                {"name": "比亚迪", "code": "sz002594", "type": "GP-A"},
            ]
        return McpToolResult(
            server_id=server.server_id,
            tool_name=approval.tool_name,
            payload={"structuredContent": {"ok": True, "data": candidates}},
        )


def _resolution_source(client: _Client) -> McpSource:
    return McpSource(
        registry=_resolution_registry(),
        client=client,
        mapper=DeterministicMcpMapper(),
        now=lambda: NOW,
    )


def _market_fact(
    *,
    key: str = "quote",
    subject: str = "比亚迪",
    description: str = "比亚迪最新股价",
    jurisdiction: str | None = "CN",
) -> RequiredFact:
    return RequiredFact(
        key=key,
        description=description,
        category=FactCategory.MARKET_QUOTE,
        data_scope=DataScope.EXTERNAL_PUBLIC,
        subject=subject,
        jurisdiction=jurisdiction,
        expected_unit="CNY",
        expected_shape="number",
        market_metric="LAST_PRICE",
    )


def test_explicit_code_in_question_resolves_without_full_name_equality() -> None:
    client = _ResolutionClient()
    fact = _market_fact(subject="比亚迪股份有限公司")

    result = _resolution_source(client).fetch(
        _query(
            fact.key,
            question="查询比亚迪股份有限公司 002594.SZ 最新股价",
            facts=(fact,),
        )
    )

    assert result.attempt.status is SourceAttemptStatus.SUCCEEDED
    assert client.calls == [
        ("westock", "data_search", {"query": "002594.SZ"}),
        ("westock", "data_quote", {"code": "sz002594"}),
    ]


def test_name_with_parenthesized_code_falls_back_to_controlled_short_alias() -> None:
    client = _ResolutionClient(code_and_full_name_empty=True)
    fact = _market_fact(
        subject="比亚迪股份有限公司（002594.SZ）",
        description="比亚迪 A 股最新价格",
    )

    result = _resolution_source(client).fetch(
        _query(fact.key, question="查询比亚迪 A 股价格", facts=(fact,))
    )

    assert result.attempt.status is SourceAttemptStatus.SUCCEEDED
    assert client.calls == [
        ("westock", "data_search", {"query": "002594.SZ"}),
        ("westock", "data_search", {"query": "比亚迪股份有限公司"}),
        ("westock", "data_search", {"query": "比亚迪"}),
        ("westock", "data_quote", {"code": "sz002594"}),
    ]


def test_full_legal_name_falls_back_once_to_short_name() -> None:
    client = _ResolutionClient(full_name_empty=True)
    fact = _market_fact(subject="比亚迪股份有限公司")

    result = _resolution_source(client).fetch(
        _query(fact.key, question="查询比亚迪股票价格", facts=(fact,))
    )

    assert result.attempt.status is SourceAttemptStatus.SUCCEEDED
    assert client.calls == [
        ("westock", "data_search", {"query": "比亚迪股份有限公司"}),
        ("westock", "data_search", {"query": "比亚迪"}),
        ("westock", "data_quote", {"code": "sz002594"}),
    ]


def test_multiple_quote_facts_share_one_resolution() -> None:
    client = _ResolutionClient()
    price = _market_fact()
    volume = _market_fact(key="volume", description="比亚迪成交量")

    result = _resolution_source(client).fetch(
        _query(
            price.key,
            volume.key,
            question="查询比亚迪价格和成交量",
            facts=(price, volume),
        )
    )

    assert result.attempt.status is SourceAttemptStatus.SUCCEEDED
    assert sum(name == "data_search" for _, name, _ in client.calls) == 1
    assert sum(
        audit.tool_name == "data_search" for audit in result.attempt.call_audits
    ) == 1


def test_ambiguous_candidates_fail_closed() -> None:
    client = _ResolutionClient(ambiguous=True)
    fact = _market_fact(subject="同名科技")

    result = _resolution_source(client).fetch(
        _query(fact.key, question="查询同名科技", facts=(fact,))
    )

    assert result.attempt.status is SourceAttemptStatus.FAILED
    assert result.attempt.error == "instrument_ambiguous"
    assert all(name != "data_quote" for _, name, _ in client.calls)


def test_not_found_candidates_fail_closed_without_data_call() -> None:
    client = _ResolutionClient(always_empty=True)
    fact = _market_fact(subject="不存在股份有限公司")

    result = _resolution_source(client).fetch(
        _query(fact.key, question="查询不存在公司", facts=(fact,))
    )

    assert result.attempt.status is SourceAttemptStatus.FAILED
    assert result.attempt.error == "instrument_not_found"
    assert client.calls == [
        ("westock", "data_search", {"query": "不存在股份有限公司"}),
        ("westock", "data_search", {"query": "不存在"}),
    ]


def test_resolved_instrument_without_valid_quote_returns_quote_unavailable() -> None:
    class EmptyQuoteClient(_ResolutionClient):
        def call(
            self,
            server: McpServerConfig,
            approval: McpToolApproval,
            arguments: dict[str, object],
        ) -> McpToolResult:
            if approval.tool_name == "data_quote":
                self.calls.append((server.server_id, approval.tool_name, arguments))
                return McpToolResult(
                    server.server_id,
                    approval.tool_name,
                    {"data": {"provider_payload": "must-not-leak"}},
                )
            return super().call(server, approval, arguments)

    result = _resolution_source(EmptyQuoteClient()).fetch(
        _query("quote", facts=(_market_fact(),))
    )

    assert result.attempt.error == "quote_unavailable"
    assert result.documents == ()
    assert "provider_payload" not in result.attempt.model_dump_json()
    assert "must-not-leak" not in result.attempt.model_dump_json()


def test_bse_without_approved_provider_capability_is_skipped() -> None:
    client = _ResolutionClient()
    fact = _market_fact(subject="BSE:430047")

    result = _resolution_source(client).fetch(
        _query(fact.key, question="查询 BSE:430047", facts=(fact,))
    )

    assert result.attempt.error == "provider_capability_missing"
    assert client.calls == []
    assert client.discoveries == []


def test_explicit_hk_identifier_is_out_of_scope_without_mcp_calls() -> None:
    client = _ResolutionClient()
    fact = _market_fact(subject="腾讯控股 0700.HK")

    result = _resolution_source(client).fetch(
        _query(fact.key, question="查询腾讯控股 0700.HK", facts=(fact,))
    )

    assert result.attempt.error == "market_out_of_scope"
    assert client.calls == []
    assert client.discoveries == []


@pytest.mark.parametrize(
    ("jurisdiction", "subject"),
    (
        ("HK", "比亚迪"),
        ("US", "比亚迪"),
        ("CN", "比亚迪港股"),
        ("CN", "比亚迪美股"),
        ("CN", "比亚迪B股"),
        ("CN", "200002.SZ"),
        ("CN", "900901.SH"),
    ),
)
def test_explicit_out_of_scope_market_never_falls_back_to_mainland_same_name(
    jurisdiction: str,
    subject: str,
) -> None:
    client = _ResolutionClient()
    fact = _market_fact(subject=subject, jurisdiction=jurisdiction)

    result = _resolution_source(client).fetch(
        _query(fact.key, question=f"查询 {subject} 最新价格", facts=(fact,))
    )

    assert result.attempt.error == "market_out_of_scope"
    assert result.documents == ()
    assert client.calls == []
    assert client.discoveries == []


@pytest.mark.parametrize(
    "phrase",
    (
        "香港上市",
        "港交所",
        "美国股票",
        "纳斯达克",
        "日股",
        "日本股票",
    ),
)
@pytest.mark.parametrize("location", ("fact", "question"))
def test_controlled_overseas_phrase_fails_before_any_mcp_io(
    phrase: str,
    location: str,
) -> None:
    client = _ResolutionClient()
    subject = f"比亚迪 {phrase}" if location == "fact" else "002594.SZ"
    question = f"查询比亚迪 {phrase} 最新价格" if location == "question" else "查询价格"
    fact = _market_fact(subject=subject)

    result = _resolution_source(client).fetch(
        _query(fact.key, question=question, facts=(fact,))
    )

    assert result.attempt.error == "market_out_of_scope"
    assert result.documents == ()
    assert client.discoveries == []
    assert client.calls == []


@pytest.mark.parametrize(
    ("subject", "question"),
    (
        ("青岛港股份有限公司", "查询青岛港股份有限公司价格"),
        ("完美股份有限公司", "查询完美股份有限公司价格"),
        ("比亚迪", "查询比亚迪今日股价"),
        ("贵州茅台", "查询贵州茅台近日股价"),
    ),
)
def test_mainland_names_and_price_phrases_reach_mcp_instead_of_market_gate(
    subject: str,
    question: str,
) -> None:
    client = _ResolutionClient()
    fact = _market_fact(subject=subject)

    result = _resolution_source(client).fetch(
        _query(fact.key, question=question, facts=(fact,))
    )

    assert result.attempt.error != "market_out_of_scope"
    assert client.discoveries
    assert client.calls


@pytest.mark.parametrize(
    "question",
    (
        "查询比亚迪今日股票价格",
        "查询贵州茅台近日股票走势",
        "查询青岛港股东大会公告",
    ),
)
def test_embedded_market_token_phrases_reach_mcp(question: str) -> None:
    client = _ResolutionClient()
    fact = _market_fact(subject="比亚迪")

    result = _resolution_source(client).fetch(
        _query(fact.key, question=question, facts=(fact,))
    )

    assert result.attempt.error != "market_out_of_scope"
    assert client.discoveries
    assert client.calls


@pytest.mark.parametrize(
    "question",
    ("查询港股价格", "看看美股行情", "分析日股走势"),
)
def test_positive_short_market_context_still_fails_before_mcp_io(
    question: str,
) -> None:
    client = _ResolutionClient()
    fact = _market_fact(subject="比亚迪")

    result = _resolution_source(client).fetch(
        _query(fact.key, question=question, facts=(fact,))
    )

    assert result.attempt.error == "market_out_of_scope"
    assert client.discoveries == []
    assert client.calls == []


@pytest.mark.parametrize(
    ("subject", "expected_error"),
    (
        ("腾讯控股 0700.HK", "market_out_of_scope"),
        ("BSE:430047", "provider_capability_missing"),
    ),
)
def test_market_gate_runs_even_without_matching_approval(
    subject: str,
    expected_error: str,
) -> None:
    client = _Client()
    fact = _market_fact(subject=subject)
    source = McpSource(
        registry=_registry(
            approval_update={
                "enabled": False,
            }
        ),
        client=client,
        mapper=DeterministicMcpMapper(),
        now=lambda: NOW,
    )

    result = source.fetch(_query(fact.key, facts=(fact,)))

    assert result.attempt.error == expected_error
    assert client.calls == []
    assert client.discoveries == []


@pytest.mark.parametrize(
    "reason",
    ("non_read_only", "disabled_server", "metric_mismatch"),
)
def test_ineligible_bse_pattern_does_not_supply_capability(
    reason: str,
) -> None:
    client = _Client()
    fact = _market_fact(subject="BSE:430047")
    source = McpSource(
        registry=_ineligible_bse_registry(reason),
        client=client,
        mapper=DeterministicMcpMapper(),
        now=lambda: NOW,
    )

    result = source.fetch(_query(fact.key, facts=(fact,)))

    assert result.attempt.error == "provider_capability_missing"
    assert client.calls == []
    assert client.discoveries == []


def test_resolution_cache_isolated_by_entity_resolution_contract() -> None:
    class ContractClient(_Client):
        def call(
            self,
            server: McpServerConfig,
            approval: McpToolApproval,
            arguments: dict[str, object],
        ) -> McpToolResult:
            self.calls.append((server.server_id, approval.tool_name, arguments))
            if approval.tool_name == "data_search_a":
                candidates = [
                    {"name": "比亚迪", "code": "sz002594", "type": "GP-A"}
                ]
            elif approval.tool_name == "data_search_b":
                candidates = [
                    {"name": "比亚迪", "code": "sh600001", "type": "GP-A"}
                ]
            elif approval.tool_name == "data_quote_a":
                raise McpClientError("transport_failed")
            else:
                code = arguments["code"]
                return McpToolResult(
                    server.server_id,
                    approval.tool_name,
                    {
                        "data": {
                            "price": 321.5,
                            "as_of": "2026-07-22T07:00:00Z",
                            "publisher": "Tencent WeStock",
                            "url": f"https://stockapp.finance.qq.com/stock/{code}",
                            "unit": "CNY",
                            "code": code,
                        }
                    },
                )
            return McpToolResult(
                server.server_id,
                approval.tool_name,
                {"structuredContent": {"ok": True, "data": candidates}},
            )

    client = ContractClient()
    fact = _market_fact()
    result = McpSource(
        registry=_multi_contract_registry(),
        client=client,
        mapper=DeterministicMcpMapper(),
        now=lambda: NOW,
    ).fetch(_query(fact.key, facts=(fact,)))

    assert result.attempt.status is SourceAttemptStatus.SUCCEEDED
    assert client.calls == [
        ("westock", "data_search_a", {"query": "比亚迪"}),
        ("westock", "data_quote_a", {"code": "sz002594"}),
        ("westock", "data_search_b", {"query": "比亚迪"}),
        ("westock", "data_quote_b", {"code": "sh600001"}),
    ]


def test_not_found_continues_to_different_resolution_contract() -> None:
    class ContractFallbackClient(_Client):
        def call(
            self,
            server: McpServerConfig,
            approval: McpToolApproval,
            arguments: dict[str, object],
        ) -> McpToolResult:
            self.calls.append((server.server_id, approval.tool_name, arguments))
            if approval.tool_name == "data_search_a":
                candidates = []
            elif approval.tool_name == "data_search_b":
                candidates = [
                    {"name": "比亚迪", "code": "sz002594", "type": "GP-A"}
                ]
            else:
                return McpToolResult(
                    server.server_id,
                    approval.tool_name,
                    {
                        "data": {
                            "price": 321.5,
                            "as_of": "2026-07-22T07:00:00Z",
                            "publisher": "Tencent WeStock",
                            "url": (
                                "https://stockapp.finance.qq.com/stock/"
                                "sz002594"
                            ),
                            "unit": "CNY",
                            "code": "sz002594",
                        }
                    },
                )
            return McpToolResult(
                server.server_id,
                approval.tool_name,
                {"structuredContent": {"ok": True, "data": candidates}},
            )

    client = ContractFallbackClient()
    fact = _market_fact()

    result = McpSource(
        registry=_multi_contract_registry(),
        client=client,
        mapper=DeterministicMcpMapper(),
        now=lambda: NOW,
    ).fetch(_query(fact.key, facts=(fact,)))

    assert result.attempt.status is SourceAttemptStatus.SUCCEEDED
    assert [name for _, name, _ in client.calls] == [
        "data_search_a",
        "data_search_b",
        "data_quote_b",
    ]


def test_fact_local_code_ignores_different_question_code() -> None:
    client = _ResolutionClient()
    fact = _market_fact(
        subject="比亚迪 002594.SZ",
        description="比亚迪最新股价",
    )

    result = _resolution_source(client).fetch(
        _query(
            fact.key,
            question="比较 600519.SH 与目标证券",
            facts=(fact,),
        )
    )

    assert result.attempt.status is SourceAttemptStatus.SUCCEEDED
    assert client.calls[0] == (
        "westock",
        "data_search",
        {"query": "002594.SZ"},
    )


def test_conflicting_fact_codes_fail_before_mcp_io() -> None:
    client = _ResolutionClient()
    fact = _market_fact(subject="002594.SZ 与 600519.SH")

    result = _resolution_source(client).fetch(
        _query(fact.key, question="比较两只股票", facts=(fact,))
    )

    assert result.attempt.error == "instrument_ambiguous"
    assert client.calls == []
    assert client.discoveries == []


def test_bare_and_explicit_hint_for_same_ticker_are_merged() -> None:
    client = _ResolutionClient()
    fact = _market_fact(subject="002594 与 002594.SZ")

    result = _resolution_source(client).fetch(
        _query(fact.key, facts=(fact,))
    )

    assert result.attempt.status is SourceAttemptStatus.SUCCEEDED
    assert client.calls[0] == (
        "westock",
        "data_search",
        {"query": "002594.SZ"},
    )


def test_same_ticker_on_conflicting_explicit_exchanges_is_ambiguous() -> None:
    client = _ResolutionClient()
    fact = _market_fact(subject="002594.SZ 与 002594.SH")

    result = _resolution_source(client).fetch(
        _query(fact.key, facts=(fact,))
    )

    assert result.attempt.error == "instrument_ambiguous"
    assert client.calls == []
    assert client.discoveries == []


@pytest.mark.parametrize(
    ("subject", "expected_error"),
    (
        ("腾讯控股 0700.HK", "market_out_of_scope"),
        ("BSE:430047", "provider_capability_missing"),
    ),
)
def test_market_gate_precedes_mixed_nonresolver_approval(
    subject: str,
    expected_error: str,
) -> None:
    client = _Client()
    fact = _market_fact(subject=subject)
    source = McpSource(
        registry=_multi_contract_registry(include_direct=True),
        client=client,
        mapper=DeterministicMcpMapper(),
        now=lambda: NOW,
    )

    result = source.fetch(_query(fact.key, facts=(fact,)))

    assert result.attempt.error == expected_error
    assert client.calls == []
    assert client.discoveries == []


@pytest.mark.parametrize("resolver_priority", (1, 20))
def test_instrument_not_found_outranks_client_error_regardless_of_order(
    resolver_priority: int,
) -> None:
    class CompetingFailureClient(_Client):
        def call(
            self,
            server: McpServerConfig,
            approval: McpToolApproval,
            arguments: dict[str, object],
        ) -> McpToolResult:
            self.calls.append((server.server_id, approval.tool_name, arguments))
            if approval.tool_name == "data_search_a":
                return McpToolResult(
                    server.server_id,
                    approval.tool_name,
                    {"structuredContent": {"ok": True, "data": []}},
                )
            raise McpClientError("transport_failed")

    server = _registry().servers[0]
    resolver, quote = _contract_approvals(
        server,
        suffix="a",
        priority=resolver_priority,
    )
    registry = McpRegistry(
        (server,),
        (
            resolver,
            quote,
            _direct_approval(
                server,
                priority=20 if resolver_priority == 1 else 1,
            ),
        ),
    )
    client = CompetingFailureClient()
    fact = _market_fact()

    result = McpSource(
        registry=registry,
        client=client,
        mapper=DeterministicMcpMapper(),
        now=lambda: NOW,
    ).fetch(_query(fact.key, facts=(fact,)))

    assert result.attempt.error == "instrument_not_found"


def test_ambiguous_resolution_is_terminal_before_later_approval() -> None:
    client = _ResolutionClient(ambiguous=True)
    server = _registry().servers[0]
    direct = _direct_approval(server, priority=20)
    resolved_registry = _resolution_registry()
    quote = resolved_registry.approval("westock", "data_quote").model_copy(
        update={"priority": 1}
    )
    resolver = resolved_registry.approval("westock", "data_search")
    source = McpSource(
        registry=McpRegistry((server,), (resolver, quote, direct)),
        client=client,
        mapper=DeterministicMcpMapper(),
        now=lambda: NOW,
    )
    fact = _market_fact(subject="同名科技")

    result = source.fetch(_query(fact.key, facts=(fact,)))

    assert result.attempt.error == "instrument_ambiguous"
    assert all(name != "data_direct" for _, name, _ in client.calls)


@pytest.mark.parametrize(
    ("subjects", "expected_searches"),
    (
        (("比亚迪股份有限公司", "比亚迪"), 1),
        (("比亚迪", "比亚迪股份有限公司"), 2),
    ),
)
def test_legal_name_variants_share_alias_resolution(
    subjects: tuple[str, str],
    expected_searches: int,
) -> None:
    client = _ResolutionClient()
    first = _market_fact(key="first", subject=subjects[0])
    second = _market_fact(key="second", subject=subjects[1])

    result = _resolution_source(client).fetch(
        _query(first.key, second.key, facts=(first, second))
    )

    assert result.attempt.status is SourceAttemptStatus.SUCCEEDED
    assert (
        sum(name == "data_search" for _, name, _ in client.calls)
        == expected_searches
    )
    assert sum(
        audit.tool_name == "data_search" for audit in result.attempt.call_audits
    ) == expected_searches


def test_unseen_legal_name_sharing_alias_must_verify_identity() -> None:
    class CollidingLegalNameClient(_ResolutionClient):
        def call(
            self,
            server: McpServerConfig,
            approval: McpToolApproval,
            arguments: dict[str, object],
        ) -> McpToolResult:
            if (
                approval.tool_name == "data_search"
                and arguments["query"] == "比亚迪有限公司"
            ):
                self.calls.append(
                    (server.server_id, approval.tool_name, arguments)
                )
                return McpToolResult(
                    server.server_id,
                    approval.tool_name,
                    {
                        "structuredContent": {
                            "ok": True,
                            "data": [
                                {
                                    "name": "比亚迪",
                                    "code": "sh600001",
                                    "type": "GP-A",
                                }
                            ],
                        }
                    },
                )
            return super().call(server, approval, arguments)

    client = CollidingLegalNameClient()
    first = _market_fact(key="first", subject="比亚迪股份有限公司")
    second = _market_fact(key="second", subject="比亚迪有限公司")

    result = _resolution_source(client).fetch(
        _query(first.key, second.key, facts=(first, second))
    )

    assert result.attempt.error == "instrument_ambiguous"
    assert [
        arguments["query"]
        for _, name, arguments in client.calls
        if name == "data_search"
    ] == ["比亚迪股份有限公司", "比亚迪有限公司"]
    assert sum(name == "data_quote" for _, name, _ in client.calls) == 1
    resolution_audits = tuple(
        audit
        for audit in result.attempt.call_audits
        if audit.tool_name == "data_search"
    )
    assert resolution_audits[-1].mapping_outcome == "mapping_failed"
    assert resolution_audits[-1].error == "instrument_ambiguous"


@pytest.mark.parametrize(
    "subjects",
    (
        ("002594.SZ", "002594"),
        ("002594", "002594.SZ"),
    ),
)
def test_equivalent_hint_variants_share_resolution(
    subjects: tuple[str, str],
) -> None:
    client = _ResolutionClient()
    first = _market_fact(key="first", subject=subjects[0])
    second = _market_fact(key="second", subject=subjects[1])

    result = _resolution_source(client).fetch(
        _query(first.key, second.key, facts=(first, second))
    )

    assert result.attempt.status is SourceAttemptStatus.SUCCEEDED
    assert sum(name == "data_search" for _, name, _ in client.calls) == 1
    assert sum(
        audit.tool_name == "data_search" for audit in result.attempt.call_audits
    ) == 1


@pytest.mark.parametrize("first_search_empty", (False, True))
def test_deadline_after_first_search_blocks_alias_and_data_calls(
    first_search_empty: bool,
) -> None:
    current = [NOW]

    class DeadlineClient(_ResolutionClient):
        def call(
            self,
            server: McpServerConfig,
            approval: McpToolApproval,
            arguments: dict[str, object],
        ) -> McpToolResult:
            result = super().call(server, approval, arguments)
            if approval.tool_name == "data_search":
                current[0] = NOW + timedelta(seconds=31)
            return result

    client = DeadlineClient(full_name_empty=first_search_empty)
    fact = _market_fact(subject="比亚迪股份有限公司")
    source = McpSource(
        registry=_resolution_registry(),
        client=client,
        mapper=DeterministicMcpMapper(),
        now=lambda: current[0],
    )

    result = source.fetch(_query(fact.key, facts=(fact,)))

    assert result.attempt.status is SourceAttemptStatus.BLOCKED
    assert result.attempt.error == "deadline_exceeded"
    assert client.calls == [
        (
            "westock",
            "data_search",
            {"query": "比亚迪股份有限公司"},
        )
    ]
    assert len(result.attempt.call_audits) == 1
    assert "比亚迪股份有限公司" not in (
        result.attempt.call_audits[0].model_dump_json()
    )


def test_remaining_deadline_is_passed_to_discovery_resolver_and_data_calls() -> None:
    current = [NOW]

    class TimeoutRecordingClient(_ResolutionClient):
        def __init__(self) -> None:
            super().__init__()
            self.timeouts: list[tuple[str, float | None]] = []

        def discover(
            self,
            server: McpServerConfig,
            *,
            timeout_seconds: float | None = None,
        ) -> tuple[object, ...]:
            self.timeouts.append(("discover", timeout_seconds))
            return super().discover(server)

        def call(
            self,
            server: McpServerConfig,
            approval: McpToolApproval,
            arguments: dict[str, object],
            *,
            timeout_seconds: float | None = None,
        ) -> McpToolResult:
            self.timeouts.append((approval.tool_name, timeout_seconds))
            return super().call(server, approval, arguments)

    client = TimeoutRecordingClient()
    fact = _market_fact()
    query = _query(fact.key, facts=(fact,)).model_copy(
        update={
            "deadline_at": (NOW + timedelta(seconds=2.5))
            .isoformat()
            .replace("+00:00", "Z")
        }
    )

    result = McpSource(
        registry=_resolution_registry(),
        client=client,
        mapper=DeterministicMcpMapper(),
        now=lambda: current[0],
    ).fetch(query)

    assert result.attempt.status is SourceAttemptStatus.SUCCEEDED
    assert [name for name, _timeout in client.timeouts] == [
        "discover",
        "data_search",
        "data_quote",
    ]
    assert all(
        timeout is not None and 0 < timeout <= 2.5
        for _name, timeout in client.timeouts
    )


def test_deadline_after_data_call_retains_completed_call_audits() -> None:
    current = [NOW]

    class DataDeadlineClient(_ResolutionClient):
        def call(
            self,
            server: McpServerConfig,
            approval: McpToolApproval,
            arguments: dict[str, object],
        ) -> McpToolResult:
            result = super().call(server, approval, arguments)
            if approval.tool_name == "data_quote":
                current[0] = NOW + timedelta(seconds=31)
            return result

    client = DataDeadlineClient()
    fact = _market_fact()
    source = McpSource(
        registry=_resolution_registry(),
        client=client,
        mapper=DeterministicMcpMapper(),
        now=lambda: current[0],
    )

    result = source.fetch(_query(fact.key, facts=(fact,)))

    assert result.attempt.status is SourceAttemptStatus.BLOCKED
    assert result.attempt.error == "deadline_exceeded"
    assert [name for _, name, _ in client.calls] == [
        "data_search",
        "data_quote",
    ]
    assert [audit.tool_name for audit in result.attempt.call_audits] == [
        "data_search",
        "data_quote",
    ]
    assert all(
        audit.arguments_hash
        and "比亚迪" not in audit.model_dump_json()
        for audit in result.attempt.call_audits
    )


def test_mcp_source_receives_only_archive_unresolved_facts() -> None:
    client = _Client()
    source = McpSource(
        registry=_registry(), client=client, mapper=DeterministicMcpMapper(), now=lambda: NOW
    )

    result = source.fetch(_query("quote"))

    assert client.calls == [("westock", "data_quote", {"code": "sz002594"})]
    assert result.attempt.facts_attempted == ("quote",)
    assert result.attempt.status is SourceAttemptStatus.SUCCEEDED
    assert len(result.documents) == 1


def test_mcp_source_stops_after_freshly_retrieved_latest_market_close() -> None:
    now = datetime(2026, 7, 23, 14, 56, tzinfo=UTC)
    client = _Client()
    source = McpSource(
        registry=_two_quote_registry(),
        client=client,
        mapper=DeterministicMcpMapper(),
        now=lambda: now,
    )

    result = source.fetch(_latest_market_query(now))

    assert len(client.calls) == 1
    assert result.documents[0].as_of == "2026-07-22T07:00:00Z"
    assert result.documents[0].retrieved_at == "2026-07-23T14:56:00Z"


def test_mcp_source_does_not_treat_old_retrieval_as_current_market_quote() -> None:
    now = datetime(2026, 7, 23, 14, 56, tzinfo=UTC)

    class OldRetrievalMapper(DeterministicMcpMapper):
        def map(self, *args: object, **kwargs: object) -> object:
            document = super().map(*args, **kwargs)
            return document.model_copy(
                update={"retrieved_at": "2026-07-23T14:40:00Z"}
            )

    client = _Client()
    source = McpSource(
        registry=_two_quote_registry(),
        client=client,
        mapper=OldRetrievalMapper(),
        now=lambda: now,
    )

    source.fetch(_latest_market_query(now))

    assert len(client.calls) == 2


def test_mcp_source_reports_when_only_stale_evidence_exists() -> None:
    now = datetime(2026, 7, 23, 14, 56, tzinfo=UTC)

    class OldRetrievalMapper(DeterministicMcpMapper):
        def map(self, *args: object, **kwargs: object) -> object:
            document = super().map(*args, **kwargs)
            return document.model_copy(
                update={"retrieved_at": "2026-07-23T14:40:00Z"}
            )

    result = McpSource(
        registry=_registry(),
        client=_Client(),
        mapper=OldRetrievalMapper(),
        now=lambda: now,
    ).fetch(_latest_market_query(now))

    assert result.attempt.status is SourceAttemptStatus.SUCCEEDED
    assert result.attempt.error == "stale_evidence_only"
    assert len(result.documents) == 1


def test_mcp_source_configuration_fingerprint_is_stable_for_identical_config() -> None:
    first = McpSource(
        registry=_registry(),
        client=_Client(),
        mapper=DeterministicMcpMapper(),
    )
    second = McpSource(
        registry=_registry(),
        client=_Client(),
        mapper=DeterministicMcpMapper(),
    )

    assert first.source_configuration_fingerprint() == (
        second.source_configuration_fingerprint()
    )


def test_mcp_source_configuration_fingerprint_tracks_cache_relevant_config() -> None:
    baseline = McpSource(
        registry=_registry(),
        client=_Client(),
        mapper=DeterministicMcpMapper(),
    ).source_configuration_fingerprint()
    variants: tuple[Callable[[], McpRegistry], ...] = (
        lambda: _registry(server_update={"enabled": False}),
        lambda: _registry(
            server_update={"endpoint_url": "https://other.example.test/mcp"}
        ),
        lambda: _registry(server_update={"approval_version": "v2"}),
        lambda: _registry(approval_update={"enabled": False}),
        lambda: _registry(approval_update={"approval_version": "v2"}),
        lambda: _registry(
            approval_update={
                "fact_categories": (FactCategory.NEWS_EVENT,),
                "market_metrics": (),
            }
        ),
        lambda: _registry(approval_update={"market_metrics": ("INTRADAY_SERIES",)}),
        lambda: _registry(
            approval_update={"data_scopes": (DataScope.HYBRID,)}
        ),
        lambda: _registry(
            approval_update={"jurisdictions": ("CN", "US")}
        ),
        lambda: _registry(mapping_update={"argument_paths": {"ticker": "subject"}}),
        lambda: _registry(mapping_update={"value_path": "data.open"}),
        lambda: _registry(mapping_update={"value_exclusive_min": 0}),
        lambda: _registry(mapping_update={"publisher_allowlist": ("Approved",)}),
        lambda: _registry(mapping_update={"unit_allowlist": ("CNY",)}),
        lambda: _registry(
            mapping_update={"source_url_origins": ("https://example.test",)}
        ),
        lambda: _registry(
            mapping_update={"source_url_path_pattern": r"/quote/[a-z0-9]+"}
        ),
    )

    assert all(
        McpSource(
            registry=variant(),
            client=_Client(),
            mapper=DeterministicMcpMapper(),
        ).source_configuration_fingerprint()
        != baseline
        for variant in variants
    )


def test_mcp_source_configuration_fingerprint_tracks_private_network_cidrs() -> None:
    common = {
        "endpoint_url": "https://10.20.30.40/mcp",
        "source_kind": McpSourceKind.INTERNAL_SYSTEM,
        "access_policy": McpAccessPolicy.INTERNAL_SERVICE_AUTHENTICATED,
        "credential_ref": "env://MCP_SECRET",
        "private_network_approved": True,
    }
    first = McpSource(
        registry=_registry(
            server_update={**common, "private_network_cidrs": ("10.20.30.0/24",)}
        ),
        client=_Client(),
        mapper=DeterministicMcpMapper(),
    )
    second = McpSource(
        registry=_registry(
            server_update={**common, "private_network_cidrs": ("10.20.31.0/24",)}
        ),
        client=_Client(),
        mapper=DeterministicMcpMapper(),
    )

    assert (
        first.source_configuration_fingerprint()
        != second.source_configuration_fingerprint()
    )


def test_mcp_source_configuration_fingerprint_excludes_credential_reference() -> None:
    common = {
        "source_kind": McpSourceKind.PROFESSIONAL_DATA,
        "access_policy": McpAccessPolicy.SERVICE_AUTHENTICATED_FREE,
    }
    first = McpSource(
        registry=_registry(
            server_update={**common, "credential_ref": "env://MCP_SECRET"}
        ),
        client=_Client(),
        mapper=DeterministicMcpMapper(),
    )
    second = McpSource(
        registry=_registry(
            server_update={**common, "credential_ref": "env://OTHER_SECRET"}
        ),
        client=_Client(),
        mapper=DeterministicMcpMapper(),
    )

    assert (
        first.source_configuration_fingerprint()
        == second.source_configuration_fingerprint()
    )


def test_mcp_source_does_not_call_tools_without_approved_capability() -> None:
    client = _Client()
    source = McpSource(
        registry=_registry(), client=client, mapper=DeterministicMcpMapper(), now=lambda: NOW
    )

    result = source.fetch(_query("news"))

    assert client.calls == []
    assert result.documents == ()
    assert result.attempt.facts_attempted == ()


def test_mcp_source_honors_scope_and_deadline_before_discovery() -> None:
    client = _Client()
    source = McpSource(
        registry=_registry(), client=client, mapper=DeterministicMcpMapper(), now=lambda: NOW
    )
    out_of_scope = source.fetch(_query("quote", scope=(SourceType.SHIGUAN,)))
    expired_query = _query("quote").model_copy(
        update={"deadline_at": "2026-07-22T07:00:00Z"}
    )
    expired = source.fetch(expired_query)

    assert out_of_scope.attempt.status is SourceAttemptStatus.SKIPPED
    assert expired.attempt.status is SourceAttemptStatus.BLOCKED
    assert client.discoveries == []


def test_mcp_source_normalizes_transport_and_mapping_failures() -> None:
    class TransportFailure(_Client):
        def call(self, *args: object, **kwargs: object) -> McpToolResult:
            raise McpClientError("source_authorization_failed")

    transport = McpSource(
        registry=_registry(),
        client=TransportFailure(),
        mapper=DeterministicMcpMapper(),
        now=lambda: NOW,
    ).fetch(_query("quote"))

    class InvalidMapping(_Client):
        def call(self, *args: object, **kwargs: object) -> McpToolResult:
            result = super().call(*args, **kwargs)
            payload = result.to_dict()["payload"]
            payload["data"]["unit"] = "USD"
            return McpToolResult(result.server_id, result.tool_name, payload)

    mapping = McpSource(
        registry=_registry(),
        client=InvalidMapping(),
        mapper=DeterministicMcpMapper(),
        now=lambda: NOW,
    ).fetch(_query("quote"))

    assert transport.attempt.error == "auth_required"
    assert mapping.attempt.error == "mcp_mapping_failed"


@pytest.mark.parametrize(
    "code",
    (
        "credential_unavailable",
        "credential_source_invalid",
        "external_network_disabled",
    ),
)
def test_mcp_source_preserves_safe_operational_failure_reason(code: str) -> None:
    class OperationalFailure(_Client):
        def discover(self, _server: McpServerConfig) -> tuple[object, ...]:
            raise McpClientError(code)

    result = McpSource(
        registry=_registry(),
        client=OperationalFailure(),
        mapper=DeterministicMcpMapper(),
        now=lambda: NOW,
    ).fetch(_query("quote"))

    assert result.attempt.error == code
    assert result.documents == ()


def test_mcp_source_keeps_unknown_client_failure_unavailable() -> None:
    class UnknownFailure(_Client):
        def discover(self, _server: McpServerConfig) -> tuple[object, ...]:
            raise McpClientError("secret-token")

    result = McpSource(
        registry=_registry(),
        client=UnknownFailure(),
        mapper=DeterministicMcpMapper(),
        now=lambda: NOW,
    ).fetch(_query("quote"))

    assert result.attempt.error == "fact_unavailable"
    assert "secret-token" not in result.attempt.model_dump_json()


def test_mcp_source_cache_ttl_uses_minimum_of_server_and_fact_freshness() -> None:
    current = [NOW]
    client = _Client()
    source = McpSource(
        registry=_registry(server_update={"cache_ttl_seconds": 30}),
        client=client,
        mapper=DeterministicMcpMapper(),
        now=lambda: current[0],
    )
    first = source.fetch(_query("quote"))
    current[0] += timedelta(seconds=29)
    hit = source.fetch(
        _query("quote").model_copy(
            update={
                "deadline_at": (current[0] + timedelta(seconds=30))
                .isoformat()
                .replace("+00:00", "Z")
            }
        )
    )
    current[0] += timedelta(seconds=2)
    stale = source.fetch(
        _query("quote").model_copy(
            update={
                "deadline_at": (current[0] + timedelta(seconds=30))
                .isoformat()
                .replace("+00:00", "Z")
            }
        )
    )

    assert len(client.calls) == 2
    assert first.attempt.call_audits[0].cache_hit is False
    assert hit.attempt.call_audits[0].cache_hit is True
    assert stale.attempt.call_audits[0].cache_hit is False


def test_mcp_source_rate_limit_is_atomic_per_server_and_tool() -> None:
    current = [NOW]
    release = Event()

    class ConcurrentClient(_Client):
        def call(
            self,
            server: McpServerConfig,
            approval: McpToolApproval,
            arguments: dict[str, object],
        ) -> McpToolResult:
            result = super().call(server, approval, arguments)
            release.wait(timeout=2)
            return result

    client = ConcurrentClient()
    source = McpSource(
        registry=_registry(
            server_update={"rate_limit_per_minute": 2, "cache_ttl_seconds": 0}
        ),
        client=client,
        mapper=DeterministicMcpMapper(),
        now=lambda: current[0],
    )
    results: list[object] = []
    threads = [
        Thread(target=lambda: results.append(source.fetch(_query("quote"))))
        for _ in range(3)
    ]
    for thread in threads:
        thread.start()
    deadline = monotonic() + 2
    while len(client.calls) < 2 and monotonic() < deadline:
        pass
    release.set()
    for thread in threads:
        thread.join()

    assert len(client.calls) == 2
    assert sum(
        result.attempt.error == "source_rate_limited" for result in results
    ) == 1


def test_mcp_source_counts_failed_calls_and_preserves_safe_call_audit() -> None:
    class FailureClient(_Client):
        def call(self, *args: object, **kwargs: object) -> McpToolResult:
            self.calls.append(("westock", "data_quote", {"code": "sz002594"}))
            raise McpClientError("transport_timeout")

    client = FailureClient()
    source = McpSource(
        registry=_registry(
            server_update={"rate_limit_per_minute": 1, "cache_ttl_seconds": 0}
        ),
        client=client,
        mapper=DeterministicMcpMapper(),
        now=lambda: NOW,
    )

    failed = source.fetch(_query("quote"))
    limited = source.fetch(_query("quote"))
    audit = failed.attempt.call_audits[0]

    assert failed.attempt.error == "timeout"
    assert limited.attempt.error == "source_rate_limited"
    assert len(client.calls) == 1
    assert audit.server_id == "westock"
    assert audit.tool_name == "data_quote"
    assert audit.approval_version == "v1"
    assert len(audit.arguments_hash) == 64
    assert audit.response_bytes is None
    assert audit.response_hash is None
    assert "sz002594" not in audit.model_dump_json()
