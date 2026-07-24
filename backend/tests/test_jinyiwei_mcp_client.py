"""Offline Streamable HTTP MCP client protocol and safety tests."""

from __future__ import annotations

import copy
import json
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import pytest

from app.jinyiwei.mcp.client import McpClient, McpClientError, McpToolResult
from app.jinyiwei.mcp.contracts import (
    McpAccessPolicy,
    McpServerConfig,
    McpSourceKind,
    McpToolApproval,
    McpTransport,
    ToolEffect,
)
from app.jinyiwei.mcp.credentials import McpCredentialError, SensitiveHeaders
from app.jinyiwei.mcp.mapping import DeterministicMcpMapper
from app.jinyiwei.mcp.registry import (
    McpRegistry,
    approval_fingerprint,
    load_default_registry,
)
from app.jinyiwei.models import DataScope, FactCategory, RequiredFact
from app.jinyiwei.network import NetworkAccessDisabledError, PinnedHTTPSResponse

TOOL = {
    "name": "data_quote",
    "description": "read quote",
    "inputSchema": {
        "type": "object",
        "properties": {"code": {"type": "string"}},
        "required": ["code"],
        "additionalProperties": False,
    },
}


def server() -> McpServerConfig:
    return McpServerConfig(
        server_id="fixture",
        display_name="Fixture",
        endpoint_url="https://example.com/mcp",
        transport=McpTransport.STREAMABLE_HTTP,
        source_kind=McpSourceKind.PROFESSIONAL_DATA,
        access_policy=McpAccessPolicy.SERVICE_AUTHENTICATED_FREE,
        credential_ref="env://MCP_SECRET",
        enabled=True,
        approval_version="v1",
        timeout_seconds=7,
        max_response_bytes=2048,
        rate_limit_per_minute=30,
        allow_redirects=False,
        cache_ttl_seconds=0,
    )


def approval() -> McpToolApproval:
    current_server = server()
    return McpToolApproval(
        server_id="fixture",
        tool_name="data_quote",
        enabled=True,
        effect=ToolEffect.READ_ONLY,
        fact_categories=(FactCategory.MARKET_QUOTE,),
        market_metrics=("LAST_PRICE",),
        data_scopes=(DataScope.EXTERNAL_PUBLIC,),
        jurisdictions=("CN",),
        approval_version="v1",
        approved_discovered_tool=TOOL,
        approved_fingerprint=approval_fingerprint(current_server, TOOL),
    )


@dataclass(frozen=True)
class RecordedRequest:
    method: str
    url: str
    headers: SensitiveHeaders
    json_body: bytes

    def __repr__(self) -> str:
        return (
            f"RecordedRequest(method={self.method!r}, url={self.url!r}, headers={self.headers!r})"
        )


class FakeCredentials:
    def headers_for(self, _server: McpServerConfig) -> SensitiveHeaders:
        return SensitiveHeaders({"authorization": "Bearer secret-token"})


class FailingCredentialProvider:
    def __init__(self, code: str) -> None:
        self.code = code

    def headers_for(self, _server: McpServerConfig) -> SensitiveHeaders:
        raise McpCredentialError(self.code)


class FakeTransport:
    def __init__(self, responses: list[PinnedHTTPSResponse]) -> None:
        self.responses = responses
        self.requests: list[RecordedRequest] = []
        self.options: list[dict[str, object]] = []

    def request(
        self,
        method: str,
        url: str,
        *,
        headers: Mapping[str, str],
        json_body: bytes,
        **options: object,
    ) -> PinnedHTTPSResponse:
        sensitive = headers if isinstance(headers, SensitiveHeaders) else SensitiveHeaders(headers)
        self.requests.append(RecordedRequest(method, url, sensitive, json_body))
        self.options.append(options)
        return self.responses.pop(0)


def client_for(
    transport: FakeTransport,
    *,
    credentials: object | None = None,
    approvals: tuple[McpToolApproval, ...] | None = None,
    monotonic_clock=None,
) -> McpClient:
    registry = McpRegistry((server(),), approvals if approvals is not None else (approval(),))
    return McpClient(
        transport=transport,
        credentials=credentials or FakeCredentials(),
        registry=registry,
        monotonic_clock=monotonic_clock,
    )


def response(
    payload: object, *, status: int = 200, headers: Mapping[str, str] | None = None
) -> PinnedHTTPSResponse:
    return PinnedHTTPSResponse(
        final_url="https://example.com/mcp",
        status=status,
        headers=headers or {"content-type": "application/json"},
        body=json.dumps(payload).encode(),
    )


def rpc(identifier: int, result: object) -> PinnedHTTPSResponse:
    return response({"jsonrpc": "2.0", "id": identifier, "result": result})


def discovery_responses(*, tools: list[object] | None = None) -> list[PinnedHTTPSResponse]:
    return [
        PinnedHTTPSResponse(
            final_url="https://example.com/mcp",
            status=200,
            headers={"content-type": "application/json", "mcp-session-id": "session-secret"},
            body=json.dumps(
                {
                    "jsonrpc": "2.0",
                    "id": 1,
                    "result": {
                        "protocolVersion": "2025-03-26",
                        "capabilities": {},
                        "serverInfo": {"name": "fixture", "version": "1"},
                    },
                }
            ).encode(),
        ),
        PinnedHTTPSResponse(
            "https://example.com/mcp", 202, {"content-type": "application/json"}, b""
        ),
        rpc(2, {"tools": tools if tools is not None else [TOOL]}),
    ]


def test_discovery_and_call_apply_explicit_effective_timeout() -> None:
    transport = FakeTransport(
        [
            *discovery_responses(),
            rpc(3, {"content": [], "structuredContent": {"ok": True}}),
        ]
    )
    client = client_for(transport)

    client.discover(server(), timeout_seconds=2.5)
    client.call(
        server(),
        approval(),
        {"code": "sz002594"},
        timeout_seconds=1.25,
    )

    discovery_timeouts = [
        options["total_timeout"] for options in transport.options[:3]
    ]
    assert all(0 < timeout <= 2.5 for timeout in discovery_timeouts)
    assert discovery_timeouts == sorted(discovery_timeouts, reverse=True)
    assert transport.options[3]["total_timeout"] == 1.25
    assert all(
        options["connect_timeout"] <= options["total_timeout"]
        and options["read_timeout"] <= options["total_timeout"]
        for options in transport.options
    )


def test_discovery_recomputes_one_absolute_monotonic_deadline() -> None:
    ticks = iter((100.0, 100.0, 101.0, 103.0))
    transport = FakeTransport(discovery_responses())
    client = client_for(transport, monotonic_clock=lambda: next(ticks))

    client.discover(server(), timeout_seconds=5.0)

    assert [options["total_timeout"] for options in transport.options] == [
        5.0,
        4.0,
        2.0,
    ]


def test_discovery_deadline_exhaustion_prevents_next_transport() -> None:
    ticks = iter((100.0, 100.0, 106.0))
    transport = FakeTransport(discovery_responses())
    client = client_for(transport, monotonic_clock=lambda: next(ticks))

    with pytest.raises(McpClientError, match="^transport_timeout$"):
        client.discover(server(), timeout_seconds=5.0)

    assert len(transport.requests) == 1


@pytest.mark.parametrize(
    "code",
    ("credential_unavailable", "credential_source_invalid"),
)
def test_discovery_wraps_credential_failure_as_stable_client_error(code: str) -> None:
    client = client_for(
        FakeTransport([]),
        credentials=FailingCredentialProvider(code),
    )

    with pytest.raises(McpClientError, match=f"^{code}$"):
        client.discover(server())


def test_discovery_sanitizes_unapproved_credential_failure_reason() -> None:
    client = client_for(
        FakeTransport([]),
        credentials=FailingCredentialProvider("Bearer secret-token"),
    )

    with pytest.raises(McpClientError, match="^fact_unavailable$") as exc:
        client.discover(server())

    assert "secret-token" not in str(exc.value)
    assert exc.value.__cause__ is None
    assert exc.value.__context__ is None


def test_discovery_sanitizes_unexpected_credential_provider_failure() -> None:
    class UnexpectedCredentialFailure:
        def headers_for(self, _server: McpServerConfig) -> SensitiveHeaders:
            raise RuntimeError("credential provider contains secret-token")

    client = client_for(
        FakeTransport([]),
        credentials=UnexpectedCredentialFailure(),
    )

    with pytest.raises(McpClientError, match="^fact_unavailable$") as exc:
        client.discover(server())

    assert "secret-token" not in str(exc.value)
    assert exc.value.__cause__ is None
    assert exc.value.__context__ is None


def test_discovery_preserves_external_network_disabled() -> None:
    class DisabledNetworkTransport(FakeTransport):
        def request(
            self,
            method: str,
            url: str,
            *,
            headers: Mapping[str, str],
            json_body: bytes,
            **options: object,
        ) -> PinnedHTTPSResponse:
            del method, url, headers, json_body, options
            raise NetworkAccessDisabledError("network flag contains secret-token")

    client = client_for(DisabledNetworkTransport([]))

    with pytest.raises(McpClientError, match="^external_network_disabled$") as exc:
        client.discover(server())

    assert "secret-token" not in str(exc.value)
    assert exc.value.__cause__ is None
    assert exc.value.__context__ is None


def test_discovery_sanitizes_unexpected_transport_failure() -> None:
    class UnexpectedTransportFailure(FakeTransport):
        def request(
            self,
            method: str,
            url: str,
            *,
            headers: Mapping[str, str],
            json_body: bytes,
            **options: object,
        ) -> PinnedHTTPSResponse:
            del method, url, headers, json_body, options
            raise RuntimeError("transport contains secret-token")

    client = client_for(UnexpectedTransportFailure([]))

    with pytest.raises(McpClientError, match="^transport_failed$") as exc:
        client.discover(server())

    assert "secret-token" not in str(exc.value)
    assert exc.value.__cause__ is None
    assert exc.value.__context__ is None


def test_discovery_sanitizes_unknown_transport_client_error() -> None:
    class UnknownClientErrorTransport(FakeTransport):
        def request(
            self,
            method: str,
            url: str,
            *,
            headers: Mapping[str, str],
            json_body: bytes,
            **options: object,
        ) -> PinnedHTTPSResponse:
            del method, url, headers, json_body, options
            raise McpClientError("transport contains secret-token")

    client = client_for(UnknownClientErrorTransport([]))

    with pytest.raises(McpClientError, match="^fact_unavailable$") as exc:
        client.discover(server())

    assert "secret-token" not in str(exc.value)
    assert "secret-token" not in repr(exc.value)
    assert exc.value.__cause__ is None
    assert exc.value.__context__ is None


def test_discover_initializes_then_lists_tools_with_redacted_session_and_token() -> None:
    transport = FakeTransport(discovery_responses())
    client = client_for(transport)
    discovered = client.discover(server())

    assert [tool.name for tool in discovered] == ["data_quote"]
    assert [json.loads(item.json_body).get("method") for item in transport.requests] == [
        "initialize",
        "notifications/initialized",
        "tools/list",
    ]
    assert transport.requests[0].method == "POST"
    assert transport.requests[0].headers["authorization"] == "Bearer secret-token"
    assert transport.requests[1].headers["mcp-session-id"] == "session-secret"
    assert "secret-token" not in repr(transport.requests)
    assert "session-secret" not in repr(transport.requests)
    assert "session-secret" not in repr(client._sessions)


def test_call_requires_prior_matching_discovery_and_valid_arguments() -> None:
    transport = FakeTransport(
        discovery_responses() + [rpc(3, {"content": [{"type": "text", "text": "42"}]})]
    )
    client = client_for(transport)
    with pytest.raises(McpClientError, match="discovery_required"):
        client.call(server(), approval(), {"code": "SZ002594"})
    client.discover(server())
    with pytest.raises(McpClientError, match="invalid_tool_arguments"):
        client.call(server(), approval(), {})

    result = client.call(server(), approval(), {"code": "SZ002594"})
    assert result.payload["content"][0]["text"] == "42"
    assert json.loads(transport.requests[-1].json_body)["params"] == {
        "name": "data_quote",
        "arguments": {"code": "SZ002594"},
    }


def test_call_exposes_single_text_json_object_as_structured_content() -> None:
    transport = FakeTransport(
        discovery_responses()
        + [
            rpc(
                3,
                {
                    "content": [
                        {
                            "type": "text",
                            "text": '{"ok":true,"data":{"code":"SZ002594"}}',
                        }
                    ]
                },
            )
        ]
    )
    client = client_for(transport)
    client.discover(server())

    result = client.call(server(), approval(), {"code": "SZ002594"})

    assert result.payload["structuredContent"]["data"]["code"] == "SZ002594"
    assert result.payload["content"][0]["text"] == (
        '{"ok":true,"data":{"code":"SZ002594"}}'
    )


@pytest.mark.parametrize(
    "text",
    (
        "ordinary text",
        "[]",
        '{"value":1,"value":2}',
        '{"value":NaN}',
        '{"value":9223372036854775808}',
    ),
)
def test_call_does_not_promote_non_strict_text_json_objects(text: str) -> None:
    transport = FakeTransport(
        discovery_responses()
        + [rpc(3, {"content": [{"type": "text", "text": text}]})]
    )
    client = client_for(transport)
    client.discover(server())

    result = client.call(server(), approval(), {"code": "SZ002594"})

    assert "structuredContent" not in result.payload


def test_call_preserves_server_structured_content() -> None:
    transport = FakeTransport(
        discovery_responses()
        + [
            rpc(
                3,
                {
                    "content": [{"type": "text", "text": '{"source":"text"}'}],
                    "structuredContent": {"source": "server"},
                },
            )
        ]
    )
    client = client_for(transport)
    client.discover(server())

    result = client.call(server(), approval(), {"code": "SZ002594"})

    assert result.payload["structuredContent"]["source"] == "server"


def test_text_only_westock_results_normalize_then_map_end_to_end() -> None:
    fixtures = Path(__file__).parent / "fixtures" / "mcp"
    tools = json.loads(
        (fixtures / "westock_tools_list.json").read_text(encoding="utf-8")
    )["result"]["tools"]
    search = json.loads(
        (fixtures / "westock_search_byd.json").read_text(encoding="utf-8")
    )["result"]
    quote = json.loads(
        (fixtures / "westock_quote_byd.json").read_text(encoding="utf-8")
    )["result"]
    transport = FakeTransport(
        discovery_responses(tools=tools)
        + [
            rpc(3, {"content": search["content"]}),
            rpc(4, {"content": quote["content"]}),
        ]
    )
    registry = load_default_registry()
    westock = registry.server("westock")
    search_approval = registry.approval("westock", "data_search")
    quote_approval = registry.approval("westock", "data_quote")
    client = McpClient(
        transport=transport,
        credentials=FakeCredentials(),
        registry=registry,
    )
    mapper = DeterministicMcpMapper()
    fact = RequiredFact(
        key="quote",
        description="比亚迪当前行情",
        category=FactCategory.MARKET_QUOTE,
        data_scope=DataScope.EXTERNAL_PUBLIC,
        subject="比亚迪",
        jurisdiction="CN",
        expected_unit="CNY",
        expected_shape="number",
        market_metric="LAST_PRICE",
    )

    client.discover(westock)
    search_result = client.call(
        westock,
        search_approval,
        mapper.resolution_arguments_for(quote_approval, fact),
    )
    resolved = mapper.resolve_subject(quote_approval, fact, search_result)
    quote_result = client.call(
        westock,
        quote_approval,
        mapper.arguments_for(
            quote_approval,
            fact,
            resolved_subject=resolved.subject,
        ),
    )
    document = mapper.map(
        quote_approval,
        fact,
        quote_result,
        datetime(2026, 7, 23, 2, 0, tzinfo=UTC),
        resolved_subject=resolved.subject,
        approved_unit=resolved.unit,
    )

    assert resolved.subject == "sz002594"
    assert document.metadata["instrument_id"] == "sz002594"
    assert document.metadata["as_of_precision"] == "date"
    assert document.as_of == "2026-07-22T16:00:00Z"


def test_text_only_minute_result_normalizes_to_market_minute_end_to_end() -> None:
    fixtures = Path(__file__).parent / "fixtures" / "mcp"
    tools = json.loads(
        (fixtures / "westock_tools_list.json").read_text(encoding="utf-8")
    )["result"]["tools"]
    search = json.loads(
        (fixtures / "westock_search_byd.json").read_text(encoding="utf-8")
    )["result"]
    minute = json.loads(
        (fixtures / "westock_minute_byd.json").read_text(encoding="utf-8")
    )["result"]
    transport = FakeTransport(
        discovery_responses(tools=tools)
        + [
            rpc(3, {"content": search["content"]}),
            rpc(4, {"content": minute["content"]}),
        ]
    )
    registry = load_default_registry()
    westock = registry.server("westock")
    search_approval = registry.approval("westock", "data_search")
    minute_approval = registry.approval("westock", "data_minute")
    client = McpClient(
        transport=transport,
        credentials=FakeCredentials(),
        registry=registry,
    )
    mapper = DeterministicMcpMapper()
    fact = RequiredFact(
        key="quote",
        description="比亚迪当前行情",
        category=FactCategory.MARKET_QUOTE,
        data_scope=DataScope.EXTERNAL_PUBLIC,
        subject="比亚迪",
        jurisdiction="CN",
        expected_unit="CNY",
        expected_shape="number",
        market_metric="LAST_PRICE",
    )

    client.discover(westock)
    search_result = client.call(
        westock,
        search_approval,
        mapper.resolution_arguments_for(minute_approval, fact),
    )
    resolved = mapper.resolve_subject(minute_approval, fact, search_result)
    minute_result = client.call(
        westock,
        minute_approval,
        mapper.arguments_for(
            minute_approval,
            fact,
            resolved_subject=resolved.subject,
        ),
    )
    document = mapper.map(
        minute_approval,
        fact,
        minute_result,
        datetime(2026, 7, 23, 2, 0, 30, tzinfo=UTC),
        resolved_subject=resolved.subject,
        approved_unit=resolved.unit,
    )

    assert document.metadata["value"] == 321.5
    assert document.metadata["as_of_precision"] == "minute"
    assert document.as_of == "2026-07-23T02:00:00Z"


def test_call_does_not_promote_excessively_nested_text_json() -> None:
    nested = '{"value":' * 65 + "null" + "}" * 65
    transport = FakeTransport(
        discovery_responses()
        + [rpc(3, {"content": [{"type": "text", "text": nested}]})]
    )
    client = client_for(transport)
    client.discover(server())

    result = client.call(server(), approval(), {"code": "SZ002594"})

    assert "structuredContent" not in result.payload


def test_call_rejects_a_server_disabled_after_discovery() -> None:
    transport = FakeTransport(discovery_responses())
    client = client_for(transport)
    current_server = server()
    client.discover(current_server)

    disabled = McpServerConfig.model_validate(
        {**current_server.model_dump(mode="python"), "enabled": False}
    )
    with pytest.raises(McpClientError, match="tool_not_approved"):
        client.call(disabled, approval(), {"code": "SZ002594"})


def test_schema_drift_blocks_call() -> None:
    changed = {**TOOL, "description": "changed"}
    client = client_for(FakeTransport(discovery_responses(tools=[changed])))
    with pytest.raises(McpClientError, match="source_schema_changed"):
        client.discover(server())


def test_initialize_requires_negotiated_protocol_shape() -> None:
    bad = rpc(
        1,
        {
            "protocolVersion": "unexpected-version",
            "capabilities": {},
            "serverInfo": {"name": "fixture", "version": "1"},
        },
    )
    client = client_for(FakeTransport([bad]))
    with pytest.raises(McpClientError, match="invalid_initialize_response"):
        client.discover(server())


def test_session_identifier_must_not_change_mid_session() -> None:
    responses = discovery_responses()
    responses[1] = PinnedHTTPSResponse(
        "https://example.com/mcp",
        202,
        {"mcp-session-id": "different-session"},
        b"",
    )
    client = client_for(FakeTransport(responses))
    with pytest.raises(McpClientError, match="session_identifier_changed"):
        client.discover(server())


@pytest.mark.parametrize(
    ("bad_response", "error"),
    [
        (response({}, status=401), "source_auth_expired"),
        (response({}, status=429), "source_rate_limited"),
        (response({}, status=504), "transport_timeout"),
        (response({"jsonrpc": "2.0", "id": 99, "result": {}}), "invalid_rpc_response"),
        (
            response({"jsonrpc": "2.0", "id": 1, "error": {"code": -1, "message": "secret-token"}}),
            "remote_rpc_error",
        ),
    ],
)
def test_initialize_failures_are_closed_and_sanitized(
    bad_response: PinnedHTTPSResponse, error: str
) -> None:
    client = client_for(FakeTransport([bad_response]))
    with pytest.raises(McpClientError, match=error) as exc:
        client.discover(server())
    assert "secret-token" not in str(exc.value)


def test_sse_accepts_only_complete_data_json_event() -> None:
    initialize = PinnedHTTPSResponse(
        "https://example.com/mcp",
        200,
        {"content-type": "text/event-stream", "mcp-session-id": "s"},
        (
            b"event: message\n"
            b'data: {"jsonrpc":"2.0","id":1,"result":'
            b'{"protocolVersion":"2025-03-26","capabilities":{},'
            b'"serverInfo":{"name":"x","version":"1"}}}\n\n'
        ),
    )
    transport = FakeTransport(
        [
            initialize,
            PinnedHTTPSResponse(
                "https://example.com/mcp", 202, {"content-type": "application/json"}, b""
            ),
            rpc(2, {"tools": [TOOL]}),
        ]
    )
    assert client_for(transport).discover(server())[0].name == "data_quote"

    incomplete = PinnedHTTPSResponse(
        "https://example.com/mcp",
        200,
        {"content-type": "text/event-stream"},
        b'data: {"jsonrpc":"2.0","id":1,"result":{}}\n',
    )
    with pytest.raises(McpClientError, match="invalid_sse_response"):
        client_for(FakeTransport([incomplete])).discover(server())


def test_sse_rejects_overflowing_float_with_stable_error() -> None:
    overflow = PinnedHTTPSResponse(
        "https://example.com/mcp",
        200,
        {"content-type": "text/event-stream"},
        (
            b'data: {"jsonrpc":"2.0","id":1,"result":'
            b'{"protocolVersion":"2025-03-26","capabilities":{},'
            b'"serverInfo":{"name":"x","version":"1"},"overflow":1e10000}}\n\n'
        ),
    )
    with pytest.raises(McpClientError, match="invalid_sse_response"):
        client_for(FakeTransport([overflow])).discover(server())


def test_disabled_discovery_rejects_before_credentials_or_transport() -> None:
    class CountingCredentials(FakeCredentials):
        calls = 0

        def headers_for(self, target: McpServerConfig) -> SensitiveHeaders:
            self.calls += 1
            return super().headers_for(target)

    credentials = CountingCredentials()
    transport = FakeTransport([])
    disabled = McpServerConfig.model_validate(
        {**server().model_dump(mode="python"), "enabled": False}
    )
    with pytest.raises(McpClientError, match="server_disabled"):
        client_for(transport, credentials=credentials).discover(disabled)
    assert credentials.calls == 0
    assert transport.requests == []


def test_structurally_valid_but_unregistered_approval_cannot_call() -> None:
    transport = FakeTransport(discovery_responses())
    client = client_for(transport, approvals=())
    client.discover(server())
    with pytest.raises(McpClientError, match="approval_not_registered"):
        client.call(server(), approval(), {"code": "SZ002594"})
    assert len(transport.requests) == 3


@pytest.mark.parametrize(
    "body",
    [
        b'{"jsonrpc":"2.0","id":true,"result":{}}',
        b'{"jsonrpc":"2.0","id":1.0,"result":{}}',
        b'{"jsonrpc":"2.0","id":1,"id":1,"result":{}}',
        b'{"jsonrpc":"2.0","id":1,"result":{"value":NaN}}',
        b'{"jsonrpc":"2.0","id":1,"result":{"value":1e10000}}',
        b'{"jsonrpc":"2.0","id":1,"result":{"value":-1e10000}}',
        b'[{"jsonrpc":"2.0","id":1,"result":{}}]',
        b'{"jsonrpc":"2.0","id":1,"result":{},"error":{"code":-1}}',
    ],
)
def test_json_rpc_rejects_ambiguous_or_nonstandard_payloads(body: bytes) -> None:
    bad = PinnedHTTPSResponse(
        "https://example.com/mcp", 200, {"content-type": "application/json"}, body
    )
    with pytest.raises(McpClientError, match="invalid_rpc_response"):
        client_for(FakeTransport([bad])).discover(server())


def test_initialized_notification_rejects_any_response_body() -> None:
    responses = discovery_responses()
    responses[1] = response({"jsonrpc": "2.0", "id": 7, "result": {}})
    with pytest.raises(McpClientError, match="invalid_notification_response"):
        client_for(FakeTransport(responses)).discover(server())


def test_tools_list_rejects_unfollowed_pagination() -> None:
    responses = discovery_responses()
    responses[2] = rpc(2, {"tools": [TOOL], "nextCursor": "more"})
    with pytest.raises(McpClientError, match="partial_tools_response"):
        client_for(FakeTransport(responses)).discover(server())


def test_tool_result_is_deeply_immutable_and_dump_is_detached() -> None:
    transport = FakeTransport(
        discovery_responses() + [rpc(3, {"content": [{"type": "text", "text": "42"}]})]
    )
    client = client_for(transport)
    client.discover(server())
    result = client.call(server(), approval(), {"code": "SZ002594"})

    with pytest.raises(TypeError):
        result.payload["new"] = "value"  # type: ignore[index]
    with pytest.raises(TypeError):
        result.payload["content"][0]["text"] = "changed"  # type: ignore[index]
    assert copy.deepcopy(result) is result
    dumped = result.to_dict()
    dumped["payload"]["content"][0]["text"] = "changed"
    assert result.payload["content"][0]["text"] == "42"


def test_tool_result_constructor_detaches_caller_owned_payload() -> None:
    source = {"content": [{"text": "before"}]}
    result = McpToolResult(server_id="fixture", tool_name="read", payload=source)
    source["content"][0]["text"] = "after"

    assert result.payload["content"][0]["text"] == "before"


def test_tool_result_freezes_tuple_containers_and_dump_is_detached() -> None:
    source = ({"items": [1, {"ok": True}]}, None)
    result = McpToolResult(server_id="fixture", tool_name="read", payload={"value": source})

    assert result.payload["value"][0]["items"][1]["ok"] is True
    with pytest.raises(TypeError):
        result.payload["value"][0]["items"][1]["ok"] = False  # type: ignore[index]
    dumped = result.to_dict()
    assert isinstance(dumped["payload"]["value"], list)
    dumped["payload"]["value"][0]["items"][1]["ok"] = False
    assert result.payload["value"][0]["items"][1]["ok"] is True


@pytest.mark.parametrize(
    "invalid",
    [
        b"bytes",
        bytearray(b"bytes"),
        {"set"},
        object(),
        float("nan"),
        float("inf"),
        float("-inf"),
        2**100,
        {1: "non-string-key"},
    ],
)
def test_tool_result_rejects_non_json_or_unbounded_values(invalid: object) -> None:
    with pytest.raises((TypeError, ValueError), match="invalid_tool_result"):
        McpToolResult(server_id="fixture", tool_name="read", payload={"value": invalid})
