"""Explicit, redacted smoke probe for approved read-only MCP tools."""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections.abc import Callable, Mapping, Sequence
from datetime import UTC, datetime
from pathlib import Path
from typing import Protocol, TextIO

from app.jinyiwei.mcp.client import McpClient, McpToolResult
from app.jinyiwei.mcp.contracts import ToolEffect
from app.jinyiwei.mcp.credentials import (
    EnvCredentialProvider,
    OAuthCredentialStoreProtocol,
    StoredOAuthCredentialProvider,
)
from app.jinyiwei.mcp.mapping import DeterministicMcpMapper
from app.jinyiwei.mcp.oauth.store import OAuthCredentialStore
from app.jinyiwei.mcp.registry import McpRegistry, McpRegistryError, load_default_registry
from app.jinyiwei.models import DataScope, FactCategory, MarketMetric, RequiredFact
from app.jinyiwei.network import (
    EXTERNAL_NETWORK_FLAG,
    EXTERNAL_NETWORK_TRUTHY_VALUES,
)

_ALLOWED_TOOLS = frozenset({"data_search", "data_quote", "data_minute"})


class _InvalidArguments(ValueError):
    pass


class _RedactedArgumentParser(argparse.ArgumentParser):
    def error(self, message: str) -> None:
        del message
        raise _InvalidArguments("invalid_arguments")


class _CredentialProvider(Protocol):
    def headers_for(self, server: object) -> Mapping[str, str]: ...


class _SmokeClient(Protocol):
    def discover(self, server: object) -> tuple[object, ...]: ...

    def call(
        self,
        server: object,
        approval: object,
        arguments: Mapping[str, object],
    ) -> McpToolResult: ...


def _parser() -> argparse.ArgumentParser:
    parser = _RedactedArgumentParser(
        prog="python -m app.jinyiwei.mcp.smoke",
        description="Run an explicitly enabled, read-only MCP smoke probe.",
        add_help=False,
    )
    parser.add_argument("--server", required=True)
    parser.add_argument("--tool", required=True)
    parser.add_argument("--query", required=True)
    parser.add_argument("--jurisdiction", choices=("CN", "HK"), default="CN")
    parser.add_argument(
        "--credential-source",
        choices=("env", "local"),
        default="env",
    )
    return parser


def _network_enabled(environ: Mapping[str, str]) -> bool:
    return (
        environ.get(EXTERNAL_NETWORK_FLAG, "").strip().casefold()
        in EXTERNAL_NETWORK_TRUTHY_VALUES
    )


def _response_bytes(result: McpToolResult) -> int:
    return len(
        json.dumps(
            result.to_dict()["payload"],
            ensure_ascii=False,
            allow_nan=False,
            separators=(",", ":"),
            sort_keys=True,
        ).encode("utf-8")
    )


def _emit(
    stream: TextIO,
    *,
    server: str,
    tool: str,
    status: str,
    security_code: str | None = None,
    market_time: str | None = None,
    response_bytes: int = 0,
) -> None:
    payload = {
        "server": server,
        "tool": tool,
        "security_code": security_code,
        "market_time": market_time,
        "status": status,
        "response_bytes": response_bytes,
    }
    stream.write(
        json.dumps(
            payload,
            ensure_ascii=False,
            allow_nan=False,
            separators=(",", ":"),
        )
        + "\n"
    )


def _quote_fact(
    query: str,
    jurisdiction: str,
    tool_name: str,
) -> RequiredFact:
    metric = {
        "data_quote": MarketMetric.LAST_PRICE,
        "data_minute": MarketMetric.INTRADAY_SERIES,
    }[tool_name]
    return RequiredFact(
        key="smoke_market_quote",
        description="显式只读 MCP 行情冒烟",
        category=FactCategory.MARKET_QUOTE,
        data_scope=DataScope.EXTERNAL_PUBLIC,
        subject=query,
        jurisdiction=jurisdiction,
        expected_unit="CNY" if jurisdiction == "CN" else "HKD",
        expected_shape="number",
        market_metric=metric,
    )


def run_smoke(
    argv: Sequence[str] | None = None,
    *,
    registry: McpRegistry | None = None,
    client: _SmokeClient | None = None,
    credential_provider: _CredentialProvider | None = None,
    credential_store: OAuthCredentialStoreProtocol | None = None,
    network_enabled: bool | None = None,
    environ: Mapping[str, str] | None = None,
    stdout: TextIO | None = None,
    stderr: TextIO | None = None,
    now: Callable[[], datetime] | None = None,
) -> int:
    """Run one bounded probe and expose only fixed, non-sensitive metadata."""

    output = sys.stdout if stdout is None else stdout
    errors = sys.stderr if stderr is None else stderr
    try:
        args = _parser().parse_args(argv)
    except _InvalidArguments:
        _emit(
            errors,
            server="invalid",
            tool="invalid",
            status="invalid_arguments",
        )
        return 2
    server_id = args.server
    tool_name = args.tool
    process_environ = os.environ if environ is None else environ
    try:
        selected_registry = load_default_registry() if registry is None else registry
        server = selected_registry.server(server_id)
    except McpRegistryError:
        selected_registry = None
        server = None
    safe_server_id = server_id if server is not None else "invalid"
    safe_tool_name = tool_name if tool_name in _ALLOWED_TOOLS else "invalid"

    if tool_name not in _ALLOWED_TOOLS:
        _emit(
            errors,
            server=safe_server_id,
            tool="invalid",
            status="tool_not_allowed",
        )
        return 2

    if selected_registry is None or server is None:
        _emit(
            errors,
            server="invalid",
            tool=tool_name,
            status="server_not_registered",
        )
        return 2
    if not server.enabled:
        _emit(errors, server=server_id, tool=tool_name, status="server_disabled")
        return 2
    try:
        approval = selected_registry.approval(server_id, tool_name)
    except McpRegistryError:
        _emit(errors, server=server_id, tool=tool_name, status="tool_not_registered")
        return 2
    if not approval.enabled:
        _emit(errors, server=server_id, tool=tool_name, status="tool_disabled")
        return 2
    fact = None
    if tool_name != "data_search":
        fact = _quote_fact(args.query, args.jurisdiction, tool_name)
        if not approval.matches_fact(fact):
            _emit(
                errors,
                server=server_id,
                tool=tool_name,
                status="tool_not_allowed",
            )
            return 2
    resolver = None
    if tool_name != "data_search":
        resolution = approval.mapping.entity_resolution if approval.mapping else None
        if resolution is None or resolution.tool_name != "data_search":
            _emit(
                errors,
                server=server_id,
                tool=tool_name,
                status="tool_not_allowed",
            )
            return 2
        try:
            resolver = selected_registry.approval(server_id, "data_search")
        except McpRegistryError:
            resolver = None
        if (
            resolver is None
            or not resolver.enabled
            or resolver.effect is not ToolEffect.READ_ONLY
        ):
            _emit(
                errors,
                server=server_id,
                tool=tool_name,
                status="tool_not_allowed",
            )
            return 2

    enabled = (
        _network_enabled(process_environ)
        if network_enabled is None
        else network_enabled
    )
    if not enabled:
        _emit(
            errors,
            server=safe_server_id,
            tool=safe_tool_name,
            status="external_network_disabled",
        )
        return 2

    if credential_provider is not None:
        credentials = credential_provider
    elif args.credential_source == "env":
        credentials = EnvCredentialProvider(environ=process_environ)
    else:
        selected_store = credential_store or OAuthCredentialStore(
            Path(__file__).resolve().parents[3] / "data" / "credentials"
        )
        credentials = StoredOAuthCredentialProvider(
            store=selected_store,
            approved_endpoints={},
        )
    try:
        credentials.headers_for(server)
    except Exception:
        _emit(
            errors,
            server=server_id,
            tool=tool_name,
            status="credential_unavailable",
        )
        return 2

    selected_client = (
        McpClient(
            credentials=credentials,
            registry=selected_registry,
        )
        if client is None
        else client
    )
    mapper = DeterministicMcpMapper()
    try:
        selected_client.discover(server)
        if tool_name == "data_search":
            result = selected_client.call(
                server,
                approval,
                {"query": args.query},
            )
            _emit(
                output,
                server=server_id,
                tool=tool_name,
                status="ok",
                response_bytes=_response_bytes(result),
            )
            return 0

        assert fact is not None
        assert resolver is not None
        search_result = selected_client.call(
            server,
            resolver,
            mapper.resolution_arguments_for(approval, fact),
        )
        resolved = mapper.resolve_subject(approval, fact, search_result)
        result = selected_client.call(
            server,
            approval,
            mapper.arguments_for(
                approval,
                fact,
                resolved_subject=resolved.subject,
            ),
        )
        document = mapper.map(
            approval,
            fact,
            result,
            datetime.now(UTC) if now is None else now(),
            resolved_subject=resolved.subject,
            approved_unit=resolved.unit,
        )
    except Exception:
        _emit(errors, server=server_id, tool=tool_name, status="source_unavailable")
        return 1

    _emit(
        output,
        server=server_id,
        tool=tool_name,
        security_code=resolved.subject,
        market_time=document.as_of,
        status="ok",
        response_bytes=_response_bytes(search_result) + _response_bytes(result),
    )
    return 0


def main() -> int:
    return run_smoke()


if __name__ == "__main__":
    raise SystemExit(main())
