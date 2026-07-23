from __future__ import annotations

import io
import json
from collections.abc import Mapping
from copy import deepcopy
from datetime import UTC, datetime

import pytest

from app.jinyiwei.mcp.client import McpToolResult
from app.jinyiwei.mcp.contracts import (
    DiscoveredTool,
    McpServerConfig,
    McpToolMapping,
)
from app.jinyiwei.mcp.oauth.models import OAuthCredential
from app.jinyiwei.mcp.registry import (
    McpRegistry,
    approval_fingerprint,
    load_default_registry,
)
from app.jinyiwei.mcp.smoke import run_smoke


def _enabled_registry() -> McpRegistry:
    registry = load_default_registry()
    payload = {
        "servers": [
            server.model_dump(mode="json") | {"enabled": True}
            for server in registry.servers
        ],
        "tools": [
            approval.model_dump(mode="json") | {"enabled": True}
            for approval in registry.approvals
        ],
    }
    return McpRegistry.from_mapping(payload)


def _disabled_registry() -> McpRegistry:
    registry = load_default_registry()
    payload = {
        "servers": [
            server.model_dump(mode="json") | {"enabled": False}
            for server in registry.servers
        ],
        "tools": [
            approval.model_dump(mode="json") | {"enabled": False}
            for approval in registry.approvals
        ],
    }
    return McpRegistry.from_mapping(payload)


class _CredentialProvider:
    def __init__(self, *, available: bool = True) -> None:
        self.available = available
        self.calls: list[str] = []

    def headers_for(self, server) -> Mapping[str, str]:
        self.calls.append(server.server_id)
        if not self.available:
            raise ValueError("secret-body-must-not-leak")
        return {"authorization": "Bearer secret-token"}


class _FixtureClient:
    def __init__(self, *, fail: bool = False) -> None:
        self.fail = fail
        self.calls: list[tuple[str, dict[str, object]]] = []
        self.discoveries: list[str] = []

    def discover(self, server):
        self.discoveries.append(server.server_id)
        if self.fail:
            raise ValueError("remote-price-321.5 token=secret account=private")
        return ()

    def call(self, server, approval, arguments):
        self.calls.append((approval.tool_name, dict(arguments)))
        if approval.tool_name == "data_search":
            return McpToolResult(
                server.server_id,
                approval.tool_name,
                {
                    "structuredContent": {
                        "ok": True,
                        "data": [
                            {
                                "name": "比亚迪",
                                "type": "GP-A",
                                "code": "sz002594",
                            }
                        ],
                        "price": 321.5,
                        "token": "secret-token",
                    }
                },
            )
        if approval.tool_name == "data_minute":
            return McpToolResult(
                server.server_id,
                approval.tool_name,
                {
                    "structuredContent": {
                        "ok": True,
                        "data": {
                            "sz002594": {
                                "data": {
                                    "data": [
                                        "0959 320.10 10 320.10",
                                        "1000 321.50 20 320.80",
                                    ],
                                    "date": "20260723",
                                }
                            }
                        },
                    }
                },
            )
        return McpToolResult(
            server.server_id,
            approval.tool_name,
            {
                "structuredContent": {
                    "ok": True,
                    "data": {
                        "sz002594": {
                            "code": "sz002594",
                            "market_type": "51",
                            "price": 321.5,
                            "time": "2026-07-23",
                        }
                    },
                    "response_body": "private-body",
                    "authorization": "Bearer secret-token",
                    "account": "private-account",
                }
            },
        )


def _invoke(
    *args: str,
    registry: McpRegistry | None = None,
    client: _FixtureClient | None = None,
    credential_provider: _CredentialProvider | None = None,
    network_enabled: bool = True,
) -> tuple[int, str, str, _FixtureClient, _CredentialProvider]:
    stdout = io.StringIO()
    stderr = io.StringIO()
    selected_client = client or _FixtureClient()
    selected_credentials = credential_provider or _CredentialProvider()
    status = run_smoke(
        list(args),
        registry=registry or _enabled_registry(),
        client=selected_client,
        credential_provider=selected_credentials,
        network_enabled=network_enabled,
        stdout=stdout,
        stderr=stderr,
        now=lambda: datetime(2026, 7, 23, 2, 0, tzinfo=UTC),
    )
    return (
        status,
        stdout.getvalue(),
        stderr.getvalue(),
        selected_client,
        selected_credentials,
    )


def test_smoke_refuses_without_explicit_external_network_flag() -> None:
    status, stdout, stderr, client, credentials = _invoke(
        "--server",
        "westock",
        "--tool",
        "data_quote",
        "--query",
        "比亚迪",
        network_enabled=False,
    )

    assert status == 2
    assert stdout == ""
    assert json.loads(stderr) == {
        "server": "westock",
        "tool": "data_quote",
        "security_code": None,
        "market_time": None,
        "status": "external_network_disabled",
        "response_bytes": 0,
    }
    assert client.calls == []
    assert credentials.calls == []


def test_smoke_refuses_repository_disabled_server_before_credentials() -> None:
    credentials = _CredentialProvider()
    status, stdout, stderr, client, _credentials = _invoke(
        "--server",
        "westock",
        "--tool",
        "data_quote",
        "--query",
        "比亚迪",
        registry=_disabled_registry(),
        credential_provider=credentials,
    )

    assert status == 2
    assert stdout == ""
    assert json.loads(stderr)["status"] == "server_disabled"
    assert client.calls == []
    assert credentials.calls == []


def test_disabled_server_check_precedes_network_and_local_store_access() -> None:
    class Store:
        def load(self, _server_id: str) -> OAuthCredential:
            pytest.fail("disabled server must not read DPAPI store")

        def save(self, _server_id: str, _credential: OAuthCredential) -> None:
            pytest.fail("disabled server must not write DPAPI store")

    stdout = io.StringIO()
    stderr = io.StringIO()
    client = _FixtureClient()

    status = run_smoke(
        [
            "--server",
            "westock",
            "--tool",
            "data_search",
            "--query",
            "比亚迪",
            "--credential-source",
            "local",
        ],
        registry=_disabled_registry(),
        client=client,
        credential_store=Store(),
        network_enabled=False,
        stdout=stdout,
        stderr=stderr,
    )

    assert status == 2
    assert stdout.getvalue() == ""
    assert json.loads(stderr.getvalue())["status"] == "server_disabled"
    assert client.discoveries == []
    assert client.calls == []


@pytest.mark.parametrize("source", (None, "env"))
def test_smoke_credential_source_defaults_to_env(source: str | None) -> None:
    argv = [
        "--server",
        "westock",
        "--tool",
        "data_search",
        "--query",
        "比亚迪",
    ]
    if source is not None:
        argv.extend(("--credential-source", source))
    stdout = io.StringIO()
    stderr = io.StringIO()

    status = run_smoke(
        argv,
        registry=_enabled_registry(),
        client=_FixtureClient(),
        environ={"WESTOCK_MCP_CREDENTIAL": "environment-bearer"},
        network_enabled=True,
        stdout=stdout,
        stderr=stderr,
    )

    assert status == 0
    assert json.loads(stdout.getvalue())["status"] == "ok"
    assert stderr.getvalue() == ""


def test_smoke_local_source_uses_stored_oauth_provider() -> None:
    class Store:
        def __init__(self) -> None:
            self.loads: list[str] = []

        def load(self, server_id: str) -> OAuthCredential:
            self.loads.append(server_id)
            return OAuthCredential(
                access_token="stored-access",
                refresh_token="stored-refresh",
                expires_at=9_999_999_999,
                client_id="public-client",
                token_endpoint="https://stockbuddy.qq.com/token",
            )

        def save(self, _server_id: str, _credential: OAuthCredential) -> None:
            pytest.fail("fresh credential must not be saved")

    store = Store()
    stdout = io.StringIO()
    stderr = io.StringIO()

    status = run_smoke(
        [
            "--server",
            "westock",
            "--tool",
            "data_search",
            "--query",
            "比亚迪",
            "--credential-source",
            "local",
        ],
        registry=_enabled_registry(),
        client=_FixtureClient(),
        credential_store=store,
        environ={},
        network_enabled=True,
        stdout=stdout,
        stderr=stderr,
    )

    assert status == 0
    assert json.loads(stdout.getvalue())["status"] == "ok"
    assert stderr.getvalue() == ""
    assert store.loads == ["westock"]


@pytest.mark.parametrize(
    ("server", "tool", "expected"),
    (
        ("unknown", "data_quote", "server_not_registered"),
        ("westock", "portfolio", "tool_not_allowed"),
    ),
)
def test_smoke_accepts_only_registered_server_and_fixed_query_tools(
    server: str,
    tool: str,
    expected: str,
) -> None:
    status, stdout, stderr, client, credentials = _invoke(
        "--server",
        server,
        "--tool",
        tool,
        "--query",
        "比亚迪",
    )

    assert status == 2
    assert stdout == ""
    assert json.loads(stderr)["status"] == expected
    assert client.calls == []
    assert credentials.calls == []


def test_smoke_requires_credential_before_discovery() -> None:
    credentials = _CredentialProvider(available=False)
    status, stdout, stderr, client, _credentials = _invoke(
        "--server",
        "westock",
        "--tool",
        "data_quote",
        "--query",
        "比亚迪",
        credential_provider=credentials,
    )

    assert status == 2
    assert stdout == ""
    assert json.loads(stderr)["status"] == "credential_unavailable"
    assert client.calls == []
    assert credentials.calls == ["westock"]
    assert "secret-body" not in stderr


def test_quote_smoke_uses_search_then_quote_and_emits_only_sanitized_metadata() -> None:
    status, stdout, stderr, client, credentials = _invoke(
        "--server",
        "westock",
        "--tool",
        "data_quote",
        "--query",
        "比亚迪",
    )

    assert status == 0
    assert stderr == ""
    assert client.calls == [
        ("data_search", {"query": "比亚迪"}),
        ("data_quote", {"code": "sz002594"}),
    ]
    assert credentials.calls == ["westock"]
    assert json.loads(stdout) == {
        "server": "westock",
        "tool": "data_quote",
        "security_code": "sz002594",
            "market_time": "2026-07-22T16:00:00Z",
        "status": "ok",
            "response_bytes": 355,
    }
    serialized = (stdout + stderr).casefold()
    for forbidden in (
        "321.5",
        "price",
        "private-body",
        "secret-token",
        "authorization",
        "private-account",
        "account",
        "比亚迪",
    ):
        assert forbidden.casefold() not in serialized


def test_minute_smoke_uses_search_then_minute_and_emits_market_time() -> None:
    status, stdout, stderr, client, credentials = _invoke(
        "--server",
        "westock",
        "--tool",
        "data_minute",
        "--query",
        "比亚迪",
    )

    assert status == 0
    assert stderr == ""
    assert client.calls == [
        ("data_search", {"query": "比亚迪"}),
        ("data_minute", {"code": "sz002594"}),
    ]
    emitted = json.loads(stdout)
    assert emitted == {
        "server": "westock",
        "tool": "data_minute",
        "security_code": "sz002594",
        "market_time": "2026-07-23T02:00:00Z",
        "status": "ok",
        "response_bytes": emitted["response_bytes"],
    }
    assert emitted["response_bytes"] > 0
    assert credentials.calls == ["westock"]


def test_remote_failure_is_redacted_from_stderr() -> None:
    status, stdout, stderr, _client, _credentials = _invoke(
        "--server",
        "westock",
        "--tool",
        "data_search",
        "--query",
        "比亚迪",
        client=_FixtureClient(fail=True),
    )

    assert status == 1
    assert stdout == ""
    assert json.loads(stderr)["status"] == "source_unavailable"
    assert "321.5" not in stderr
    assert "secret" not in stderr
    assert "private" not in stderr


@pytest.mark.parametrize(
    "arguments",
    (
        ["--query", "private-query", "--unexpected", "secret-value"],
        ["--help"],
    ),
)
def test_invalid_cli_arguments_use_fixed_redacted_error(
    arguments: list[str],
) -> None:
    stdout = io.StringIO()
    stderr = io.StringIO()

    status = run_smoke(
        arguments,
        network_enabled=True,
        stdout=stdout,
        stderr=stderr,
    )

    assert status == 2
    assert stdout.getvalue() == ""
    assert json.loads(stderr.getvalue()) == {
        "server": "invalid",
        "tool": "invalid",
        "security_code": None,
        "market_time": None,
        "status": "invalid_arguments",
        "response_bytes": 0,
    }
    assert "private-query" not in stderr.getvalue()
    assert "secret-value" not in stderr.getvalue()


@pytest.mark.parametrize(
    ("server", "tool"),
    (
        ("secret-token", "data_quote"),
        ("westock", "Bearer-secret-token"),
    ),
)
def test_unregistered_server_or_tool_value_is_not_echoed(
    server: str,
    tool: str,
) -> None:
    status, stdout, stderr, _client, _credentials = _invoke(
        "--server",
        server,
        "--tool",
        tool,
        "--query",
        "比亚迪",
    )

    assert status == 2
    assert stdout == ""
    assert "secret" not in stderr.casefold()
    assert "bearer" not in stderr.casefold()


def test_quote_refuses_non_data_search_resolver_before_any_client_call() -> None:
    baseline = _enabled_registry()
    payload = {
        "servers": [
            server.model_dump(mode="json")
            for server in baseline.servers
        ],
        "tools": [
            approval.model_dump(mode="json")
            for approval in baseline.approvals
        ],
    }
    resolver = deepcopy(
        next(tool for tool in payload["tools"] if tool["tool_name"] == "data_search")
    )
    resolver["tool_name"] = "portfolio"
    resolver["approved_discovered_tool"]["name"] = "portfolio"
    server = McpServerConfig.model_validate(payload["servers"][0])
    resolver["approved_fingerprint"] = approval_fingerprint(
        server,
        DiscoveredTool.model_validate(resolver["approved_discovered_tool"]),
    )
    payload["tools"].append(resolver)

    quote = next(
        tool for tool in payload["tools"] if tool["tool_name"] == "data_quote"
    )
    quote["mapping"]["entity_resolution"]["tool_name"] = "portfolio"
    quote["approved_fingerprint"] = approval_fingerprint(
        server,
        DiscoveredTool.model_validate(quote["approved_discovered_tool"]),
        McpToolMapping.model_validate(quote["mapping"]),
    )
    registry = McpRegistry.from_mapping(payload)
    client = _FixtureClient()

    status, stdout, stderr, _client, _credentials = _invoke(
        "--server",
        "westock",
        "--tool",
        "data_quote",
        "--query",
        "比亚迪",
        registry=registry,
        client=client,
    )

    assert status == 2
    assert stdout == ""
    assert json.loads(stderr)["status"] == "tool_not_allowed"
    assert client.discoveries == []
    assert client.calls == []
