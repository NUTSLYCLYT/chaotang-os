"""Bounded, query-only MCP Streamable HTTP client."""

from __future__ import annotations

import json
import math
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from time import monotonic
from types import MappingProxyType
from typing import Any, Protocol
from urllib.parse import urlsplit

import jsonschema
from pydantic import ValidationError

from app.jinyiwei.mcp.contracts import (
    DiscoveredTool,
    McpServerConfig,
    McpToolApproval,
    ToolEffect,
)
from app.jinyiwei.mcp.credentials import (
    CredentialProvider,
    McpCredentialError,
    SensitiveHeaders,
)
from app.jinyiwei.mcp.registry import McpRegistry, McpRegistryError, approval_fingerprint
from app.jinyiwei.network import (
    NetworkAccessDisabledError,
    PinnedHTTPSClient,
    PinnedHTTPSResponse,
)


class McpClientError(ValueError):
    """Stable MCP failure that never includes remote or credential content."""


_CREDENTIAL_OPERATIONAL_ERROR_CODES = frozenset(
    {"credential_unavailable", "credential_source_invalid"}
)
_SAFE_CLIENT_ERROR_CODES = frozenset(
    {
        "approval_not_registered",
        "credential_source_invalid",
        "credential_unavailable",
        "discovery_required",
        "external_network_disabled",
        "fact_unavailable",
        "invalid_initialize_response",
        "invalid_notification_response",
        "invalid_request_payload",
        "invalid_response_media_type",
        "invalid_rpc_response",
        "invalid_session_identifier",
        "invalid_sse_response",
        "invalid_tool_arguments",
        "invalid_tools_response",
        "partial_tools_response",
        "remote_protocol_failed",
        "remote_rpc_error",
        "server_disabled",
        "server_not_registered",
        "session_identifier_changed",
        "source_auth_expired",
        "source_authorization_failed",
        "source_rate_limited",
        "source_schema_changed",
        "tool_call_failed",
        "tool_not_approved",
        "transport_failed",
        "transport_timeout",
    }
)


def _effective_timeout(
    server: McpServerConfig,
    requested: float | None,
) -> float:
    if requested is None:
        return float(server.timeout_seconds)
    if (
        isinstance(requested, bool)
        or not isinstance(requested, int | float)
        or not math.isfinite(requested)
        or requested <= 0
    ):
        raise McpClientError("transport_timeout")
    return min(float(server.timeout_seconds), float(requested))


class McpTransport(Protocol):
    def request(
        self,
        method: str,
        url: str,
        *,
        headers: Mapping[str, str],
        json_body: bytes,
        **options: object,
    ) -> PinnedHTTPSResponse: ...


@dataclass(frozen=True, slots=True)
class McpToolResult:
    """Immutable successful MCP tool result; payload is omitted from repr."""

    server_id: str
    tool_name: str
    payload: Mapping[str, Any] = field(repr=False)

    def __post_init__(self) -> None:
        if not isinstance(self.server_id, str) or not isinstance(self.tool_name, str):
            raise TypeError("invalid_tool_result")
        if not isinstance(self.payload, Mapping):
            raise TypeError("invalid_tool_result")
        object.__setattr__(self, "payload", _freeze_mapping(self.payload))

    def __copy__(self) -> McpToolResult:
        return self

    def __deepcopy__(self, memo: dict[int, object] | None = None) -> McpToolResult:
        del memo
        return self

    def to_dict(self) -> dict[str, Any]:
        return {
            "server_id": self.server_id,
            "tool_name": self.tool_name,
            "payload": _thaw_json(self.payload),
        }


@dataclass(slots=True, repr=False)
class _Session:
    identifier: str | None = field(repr=False)
    next_request_id: int
    tools: dict[str, DiscoveredTool]

    def __repr__(self) -> str:
        return (
            f"_Session(next_request_id={self.next_request_id!r}, "
            f"tool_names={tuple(sorted(self.tools))!r}, values=<redacted>)"
        )


class McpClient:
    """Initialize MCP sessions and invoke only an already-approved read tool."""

    def __init__(
        self,
        *,
        transport: McpTransport | None = None,
        credentials: CredentialProvider,
        registry: McpRegistry,
        monotonic_clock: Callable[[], float] | None = None,
    ) -> None:
        self._transport = transport or PinnedHTTPSClient()
        self._credentials = credentials
        self._registry = registry
        self._monotonic = monotonic_clock or monotonic
        self._sessions: dict[str, _Session] = {}

    def __repr__(self) -> str:
        return f"McpClient(active_servers={tuple(sorted(self._sessions))!r})"

    def discover(
        self,
        server: McpServerConfig,
        *,
        timeout_seconds: float | None = None,
    ) -> tuple[DiscoveredTool, ...]:
        if not server.enabled:
            raise McpClientError("server_disabled")
        try:
            registered_server = self._registry.server(server.server_id)
        except McpRegistryError:
            raise McpClientError("server_not_registered") from None
        if registered_server != server or not registered_server.enabled:
            raise McpClientError("server_not_registered")
        discovery_deadline = self._monotonic() + _effective_timeout(
            server, timeout_seconds
        )
        session = _Session(identifier=None, next_request_id=1, tools={})
        initialize_id = self._take_id(session)
        initialize = self._post_rpc(
            server,
            session,
            {
                "jsonrpc": "2.0",
                "id": initialize_id,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2025-03-26",
                    "capabilities": {},
                    "clientInfo": {"name": "chaotang-jinyiwei", "version": "1"},
                },
            },
            expected_id=initialize_id,
            timeout_seconds=self._remaining_discovery_timeout(
                server, discovery_deadline
            ),
        )
        if not _valid_initialize_result(initialize):
            raise McpClientError("invalid_initialize_response")

        self._post_notification(
            server,
            session,
            {
                "jsonrpc": "2.0",
                "method": "notifications/initialized",
                "params": {},
            },
            timeout_seconds=self._remaining_discovery_timeout(
                server, discovery_deadline
            ),
        )
        list_id = self._take_id(session)
        listed = self._post_rpc(
            server,
            session,
            {"jsonrpc": "2.0", "id": list_id, "method": "tools/list", "params": {}},
            expected_id=list_id,
            timeout_seconds=self._remaining_discovery_timeout(
                server, discovery_deadline
            ),
        )
        if not isinstance(listed, Mapping) or set(listed) - {"tools", "nextCursor"}:
            raise McpClientError("invalid_tools_response")
        if "nextCursor" in listed:
            raise McpClientError("partial_tools_response")
        raw_tools = listed.get("tools")
        if not isinstance(raw_tools, list):
            raise McpClientError("invalid_tools_response")
        try:
            tools = tuple(DiscoveredTool.model_validate(item) for item in raw_tools)
        except (ValidationError, TypeError):
            raise McpClientError("invalid_tools_response") from None
        if len({tool.name for tool in tools}) != len(tools):
            raise McpClientError("invalid_tools_response")
        try:
            self._registry.verify_discovery(server.server_id, tools)
        except McpRegistryError:
            raise McpClientError("source_schema_changed") from None
        session.tools = {tool.name: tool for tool in tools}
        self._sessions[server.server_id] = session
        return tools

    def call(
        self,
        server: McpServerConfig,
        approval: McpToolApproval,
        arguments: Mapping[str, Any],
        *,
        timeout_seconds: float | None = None,
    ) -> McpToolResult:
        session = self._sessions.get(server.server_id)
        if session is None:
            raise McpClientError("discovery_required")
        if not server.enabled:
            raise McpClientError("tool_not_approved")
        try:
            registered_server = self._registry.server(server.server_id)
            registered_approval = self._registry.approval(approval.server_id, approval.tool_name)
        except McpRegistryError:
            raise McpClientError("approval_not_registered") from None
        if registered_server != server or registered_approval != approval:
            raise McpClientError("approval_not_registered")
        if (
            approval.server_id != server.server_id
            or not approval.enabled
            or approval.effect is not ToolEffect.READ_ONLY
            or approval.approval_version != server.approval_version
        ):
            raise McpClientError("tool_not_approved")
        discovered = session.tools.get(approval.tool_name)
        if (
            discovered is None
            or not approval.accepts_discovered_tool(discovered)
            or approval_fingerprint(server, discovered, approval.mapping)
            != approval.approved_fingerprint
        ):
            raise McpClientError("source_schema_changed")
        try:
            jsonschema.Draft202012Validator(
                approval.approved_discovered_tool["inputSchema"]
            ).validate(dict(arguments))
        except (jsonschema.SchemaError, jsonschema.ValidationError, TypeError, KeyError):
            raise McpClientError("invalid_tool_arguments") from None

        request_id = self._take_id(session)
        result = self._post_rpc(
            server,
            session,
            {
                "jsonrpc": "2.0",
                "id": request_id,
                "method": "tools/call",
                "params": {"name": approval.tool_name, "arguments": dict(arguments)},
            },
            expected_id=request_id,
            timeout_seconds=timeout_seconds,
        )
        if not isinstance(result, Mapping) or result.get("isError") is True:
            raise McpClientError("tool_call_failed")
        return McpToolResult(
            server_id=server.server_id,
            tool_name=approval.tool_name,
            payload=_normalize_tool_result(result),
        )

    @staticmethod
    def _take_id(session: _Session) -> int:
        identifier = session.next_request_id
        session.next_request_id += 1
        return identifier

    def _remaining_discovery_timeout(
        self,
        server: McpServerConfig,
        deadline: float,
    ) -> float:
        remaining = deadline - self._monotonic()
        if remaining <= 0:
            raise McpClientError("transport_timeout")
        return min(float(server.timeout_seconds), remaining)

    def _post_notification(
        self,
        server: McpServerConfig,
        session: _Session,
        payload: Mapping[str, Any],
        *,
        timeout_seconds: float | None = None,
    ) -> None:
        response = self._post(
            server,
            session,
            payload,
            timeout_seconds=timeout_seconds,
        )
        if response.status == 401:
            raise McpClientError(_authorization_error(server))
        if response.status == 429:
            raise McpClientError("source_rate_limited")
        if response.status in {408, 504}:
            raise McpClientError("transport_timeout")
        if response.status not in {200, 202, 204}:
            raise McpClientError("remote_protocol_failed")
        if response.body:
            raise McpClientError("invalid_notification_response")

    def _post_rpc(
        self,
        server: McpServerConfig,
        session: _Session,
        payload: Mapping[str, Any],
        *,
        expected_id: int,
        timeout_seconds: float | None = None,
    ) -> Any:
        response = self._post(
            server,
            session,
            payload,
            timeout_seconds=timeout_seconds,
        )
        if response.status == 401:
            raise McpClientError(_authorization_error(server))
        if response.status == 429:
            raise McpClientError("source_rate_limited")
        if response.status in {408, 504}:
            raise McpClientError("transport_timeout")
        if response.status < 200 or response.status >= 300:
            raise McpClientError("remote_protocol_failed")
        parsed = self._decode_payload(response)
        if (
            not isinstance(parsed, Mapping)
            or parsed.get("jsonrpc") != "2.0"
            or type(parsed.get("id")) is not int
            or parsed.get("id") != expected_id
        ):
            raise McpClientError("invalid_rpc_response")
        has_result = "result" in parsed
        has_error = "error" in parsed
        if has_result == has_error:
            raise McpClientError("invalid_rpc_response")
        if has_error:
            if set(parsed) != {"jsonrpc", "id", "error"}:
                raise McpClientError("invalid_rpc_response")
            raise McpClientError("remote_rpc_error")
        if set(parsed) != {"jsonrpc", "id", "result"}:
            raise McpClientError("invalid_rpc_response")
        return parsed["result"]

    def _post(
        self,
        server: McpServerConfig,
        session: _Session,
        payload: Mapping[str, Any],
        *,
        timeout_seconds: float | None = None,
    ) -> PinnedHTTPSResponse:
        credential_error: str | None = None
        try:
            base_headers = dict(self._credentials.headers_for(server))
        except McpCredentialError as exc:
            code = str(exc)
            credential_error = (
                code
                if code in _CREDENTIAL_OPERATIONAL_ERROR_CODES
                else "fact_unavailable"
            )
        except Exception:
            credential_error = "fact_unavailable"
        if credential_error is not None:
            raise McpClientError(credential_error)
        base_headers.update(
            {
                "accept": "application/json, text/event-stream",
                "mcp-protocol-version": "2025-03-26",
            }
        )
        if session.identifier is not None:
            base_headers["mcp-session-id"] = session.identifier
        headers = SensitiveHeaders(base_headers)
        try:
            body = json.dumps(
                payload,
                ensure_ascii=False,
                allow_nan=False,
                separators=(",", ":"),
            ).encode("utf-8")
        except (TypeError, ValueError):
            raise McpClientError("invalid_request_payload") from None
        parsed_endpoint = urlsplit(server.endpoint_url)
        allowed_ports = () if parsed_endpoint.port in {None, 443} else (parsed_endpoint.port,)
        response: PinnedHTTPSResponse | None = None
        transport_error: str | None = None
        effective_timeout = _effective_timeout(server, timeout_seconds)
        try:
            response = self._transport.request(
                "POST",
                server.endpoint_url,
                headers=headers,
                json_body=body,
                allowed_ports=allowed_ports,
                total_timeout=effective_timeout,
                connect_timeout=min(3.0, effective_timeout),
                read_timeout=min(5.0, effective_timeout),
                max_bytes=server.max_response_bytes,
                redirect_validator=(
                    _same_origin_redirect if server.allow_redirects else _reject_redirect
                ),
                private_network_cidrs=server.private_network_cidrs,
                allow_sensitive_headers=True,
            )
        except McpClientError as exc:
            code = str(exc)
            transport_error = (
                code if code in _SAFE_CLIENT_ERROR_CODES else "fact_unavailable"
            )
        except NetworkAccessDisabledError:
            transport_error = "external_network_disabled"
        except TimeoutError:
            transport_error = "transport_timeout"
        except Exception:
            transport_error = "transport_failed"
        if transport_error is not None:
            raise McpClientError(transport_error)
        if response is None:
            raise McpClientError("transport_failed")
        received_session = response.headers.get("mcp-session-id")
        if received_session is not None:
            if not _valid_session_id(received_session):
                raise McpClientError("invalid_session_identifier")
            if session.identifier is not None and session.identifier != received_session:
                raise McpClientError("session_identifier_changed")
            session.identifier = received_session
        return response

    @staticmethod
    def _decode_payload(response: PinnedHTTPSResponse) -> object:
        media_type = response.headers.get("content-type", "").split(";", 1)[0].strip().casefold()
        if media_type == "application/json":
            try:
                return _strict_json_loads(response.body.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError, ValueError):
                raise McpClientError("invalid_rpc_response") from None
        if media_type == "text/event-stream":
            return _decode_single_sse_event(response.body)
        raise McpClientError("invalid_response_media_type")


def _decode_single_sse_event(body: bytes) -> object:
    try:
        text = body.decode("utf-8").replace("\r\n", "\n")
    except UnicodeDecodeError:
        raise McpClientError("invalid_sse_response") from None
    if not text.endswith("\n\n"):
        raise McpClientError("invalid_sse_response")
    events = [block for block in text.split("\n\n") if block]
    if len(events) != 1:
        raise McpClientError("invalid_sse_response")
    data_lines = [
        line[5:].lstrip(" ") for line in events[0].split("\n") if line.startswith("data:")
    ]
    if not data_lines:
        raise McpClientError("invalid_sse_response")
    try:
        return _strict_json_loads("\n".join(data_lines))
    except (json.JSONDecodeError, ValueError):
        raise McpClientError("invalid_sse_response") from None


def _valid_session_id(value: str) -> bool:
    return 0 < len(value) <= 1024 and all(0x21 <= ord(character) <= 0x7E for character in value)


def _reject_redirect(_current: str, _candidate: str) -> bool:
    return False


def _same_origin_redirect(current: str, candidate: str) -> bool:
    left = urlsplit(current)
    right = urlsplit(candidate)
    return (left.scheme, left.hostname, left.port or 443) == (
        right.scheme,
        right.hostname,
        right.port or 443,
    )


def _authorization_error(server: McpServerConfig) -> str:
    return "source_auth_expired" if server.credential_ref else "source_authorization_failed"


def _valid_initialize_result(value: object) -> bool:
    if not isinstance(value, Mapping):
        return False
    if set(value) - {"protocolVersion", "capabilities", "serverInfo", "instructions"}:
        return False
    server_info = value.get("serverInfo")
    if not isinstance(server_info, Mapping) or set(server_info) - {"name", "version"}:
        return False
    return (
        value.get("protocolVersion") == "2025-03-26"
        and isinstance(value.get("capabilities"), Mapping)
        and isinstance(server_info.get("name"), str)
        and bool(server_info.get("name"))
        and isinstance(server_info.get("version"), str)
        and bool(server_info.get("version"))
        and ("instructions" not in value or isinstance(value.get("instructions"), str))
    )


def _freeze_json(value: Any) -> Any:
    if isinstance(value, Mapping):
        if any(type(key) is not str for key in value):
            raise TypeError("invalid_tool_result")
        return MappingProxyType({key: _freeze_json(item) for key, item in value.items()})
    if isinstance(value, (list, tuple)):
        return tuple(_freeze_json(item) for item in value)
    if value is None or type(value) in {bool, str}:
        return value
    if type(value) is int:
        if not _MIN_JSON_INTEGER <= value <= _MAX_JSON_INTEGER:
            raise ValueError("invalid_tool_result")
        return value
    if type(value) is float:
        if not math.isfinite(value):
            raise ValueError("invalid_tool_result")
        return value
    raise TypeError("invalid_tool_result")


def _freeze_mapping(value: Mapping[str, Any]) -> Mapping[str, Any]:
    frozen = _freeze_json(value)
    assert isinstance(frozen, Mapping)
    return frozen


def _thaw_json(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {key: _thaw_json(item) for key, item in value.items()}
    if isinstance(value, tuple):
        return [_thaw_json(item) for item in value]
    return value


def _normalize_tool_result(result: Mapping[str, Any]) -> Mapping[str, Any]:
    if "structuredContent" in result:
        return result
    content = result.get("content")
    if (
        not isinstance(content, list)
        or len(content) != 1
        or not isinstance(content[0], Mapping)
        or content[0].get("type") != "text"
        or not isinstance(content[0].get("text"), str)
    ):
        return result
    try:
        parsed = _strict_json_loads(content[0]["text"])
    except (json.JSONDecodeError, RecursionError, ValueError):
        return result
    if not isinstance(parsed, Mapping) or not _json_depth_within_limit(parsed):
        return result
    return {**result, "structuredContent": parsed}


def _json_depth_within_limit(value: object, *, maximum: int = 64) -> bool:
    pending: list[tuple[object, int]] = [(value, 1)]
    while pending:
        current, depth = pending.pop()
        if depth > maximum:
            return False
        if isinstance(current, Mapping):
            pending.extend((item, depth + 1) for item in current.values())
        elif isinstance(current, list | tuple):
            pending.extend((item, depth + 1) for item in current)
    return True


def _strict_json_loads(value: str) -> object:
    def object_from_pairs(pairs: list[tuple[str, object]]) -> dict[str, object]:
        result: dict[str, object] = {}
        for key, item in pairs:
            if key in result:
                raise ValueError("duplicate_json_key")
            result[key] = item
        return result

    def reject_constant(_value: str) -> object:
        raise ValueError("non_finite_json_number")

    def parse_float(raw: str) -> float:
        parsed = float(raw)
        if not math.isfinite(parsed):
            raise ValueError("non_finite_json_number")
        return parsed

    def parse_int(raw: str) -> int:
        parsed = int(raw)
        if not _MIN_JSON_INTEGER <= parsed <= _MAX_JSON_INTEGER:
            raise ValueError("integer_out_of_range")
        return parsed

    return json.loads(
        value,
        object_pairs_hook=object_from_pairs,
        parse_constant=reject_constant,
        parse_float=parse_float,
        parse_int=parse_int,
    )


_MIN_JSON_INTEGER = -(2**63)
_MAX_JSON_INTEGER = 2**63 - 1
