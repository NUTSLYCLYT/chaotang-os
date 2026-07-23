"""Offline source routing tests for approved MCP tools."""

from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from threading import Event, Thread
from time import monotonic

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


def _query(*fact_keys: str, scope: tuple[SourceType, ...] | None = None) -> SourceQuery:
    facts = (
        RequiredFact(
            key="quote",
            description="比亚迪股价",
            category=FactCategory.MARKET_QUOTE,
            data_scope=DataScope.EXTERNAL_PUBLIC,
            subject="sz002594",
            jurisdiction="CN",
            expected_unit="CNY",
            expected_shape="number",
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
    request = DataGapRequest(
        request_id="req-1",
        requesting_agent="户部度支司",
        question="查询",
        required_facts=facts,
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
            approval_update={"fact_categories": (FactCategory.NEWS_EVENT,)}
        ),
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
