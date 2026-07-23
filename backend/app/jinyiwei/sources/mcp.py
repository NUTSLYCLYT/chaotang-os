"""Generic evidence source for administrator-approved read-only MCP tools."""

from __future__ import annotations

import hashlib
import json
from collections import deque
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from threading import Lock
from typing import Protocol

from app.jinyiwei.mcp.client import McpClientError, McpToolResult
from app.jinyiwei.mcp.contracts import McpServerConfig, McpToolApproval
from app.jinyiwei.mcp.mapping import DeterministicMcpMapper, McpMappingError
from app.jinyiwei.mcp.registry import McpRegistry
from app.jinyiwei.models import McpCallAudit, SourceAttempt, SourceAttemptStatus, SourceType
from app.jinyiwei.sources.base import SourceDocument, SourceQuery, SourceResult


class _McpClient(Protocol):
    def discover(self, server: McpServerConfig) -> tuple[object, ...]: ...

    def call(
        self,
        server: McpServerConfig,
        approval: McpToolApproval,
        arguments: Mapping[str, object],
    ) -> McpToolResult: ...


@dataclass(frozen=True, slots=True)
class _CachedCall:
    result: McpToolResult
    expires_at: datetime
    response_bytes: int
    response_hash: str


_CLIENT_ERROR_CODES = {
    "source_authorization_failed": "auth_required",
    "source_auth_expired": "auth_expired",
    "source_rate_limited": "source_rate_limited",
    "transport_timeout": "timeout",
    "transport_failed": "fact_unavailable",
    "source_schema_changed": "schema_changed",
    "invalid_initialize_response": "response_invalid",
    "invalid_tools_response": "response_invalid",
    "partial_tools_response": "response_invalid",
    "invalid_notification_response": "response_invalid",
    "invalid_rpc_response": "response_invalid",
    "invalid_response_media_type": "response_invalid",
    "invalid_sse_response": "response_invalid",
    "tool_call_failed": "fact_unavailable",
    "remote_protocol_failed": "fact_unavailable",
    "remote_rpc_error": "fact_unavailable",
}


class McpSource:
    """Route unresolved facts through approved tools.

    Rate windows and call-result caches are deliberately process-local. Deployments
    with multiple worker processes therefore enforce an independent configured
    budget per worker; a shared distributed limit requires a separate product
    decision and storage boundary.
    """

    def __init__(
        self,
        *,
        registry: McpRegistry,
        client: _McpClient,
        mapper: DeterministicMcpMapper,
        now: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self._registry = registry
        self._client = client
        self._mapper = mapper
        self._now = now
        self._state_lock = Lock()
        self._rate_windows: dict[tuple[str, str], deque[datetime]] = {}
        self._call_cache: dict[str, _CachedCall] = {}

    def source_configuration_fingerprint(self) -> str:
        """Return the registry's credential-free cache configuration identity."""

        return self._registry.source_configuration_fingerprint()

    def fetch(self, query: SourceQuery) -> SourceResult:
        started = self._now()
        if SourceType.MCP not in query.request.source_scope:
            return self._result(
                (), SourceAttemptStatus.SKIPPED, started, (), "source_out_of_scope"
            )
        if self._expired(query):
            return self._result(
                (), SourceAttemptStatus.BLOCKED, started, (), "deadline_exceeded"
            )
        requested = {fact.key: fact for fact in query.request.required_facts}
        facts = tuple(requested[key] for key in query.unresolved_fact_keys)
        candidates = {
            fact.key: self._registry.tools_for((fact,)) for fact in facts
        }
        if not any(candidates.values()):
            return self._result(
                (), SourceAttemptStatus.SKIPPED, started, (), "mcp_not_configured"
            )

        attempted: list[str] = []
        documents: list[SourceDocument] = []
        discovered_servers: set[str] = set()
        had_failure = False
        had_mapping_failure = False
        had_conflict = False
        error_codes: list[str] = []
        call_audits: list[McpCallAudit] = []
        for fact in facts:
            if len(documents) >= query.max_items:
                break
            for approval in candidates[fact.key]:
                arguments: Mapping[str, object] | None = None
                if self._expired(query):
                    return self._result(
                        (),
                        SourceAttemptStatus.BLOCKED,
                        started,
                        tuple(attempted),
                        "deadline_exceeded",
                    )
                server = self._registry.server(approval.server_id)
                if fact.key not in attempted:
                    attempted.append(fact.key)
                try:
                    if server.server_id not in discovered_servers:
                        self._client.discover(server)
                        discovered_servers.add(server.server_id)
                    resolved_subject = None
                    approved_unit = None
                    mapping = approval.mapping
                    resolution = (
                        None if mapping is None else mapping.entity_resolution
                    )
                    if resolution is not None:
                        resolver = self._registry.approval(
                            approval.server_id, resolution.tool_name
                        )
                        resolution_arguments = (
                            self._mapper.resolution_arguments_for(approval, fact)
                        )
                        resolution_result, resolution_audit = self._call_tool(
                            server,
                            resolver,
                            resolution_arguments,
                            fact_freshness_seconds=query.request.freshness.max_age_seconds,
                        )
                        call_audits.append(resolution_audit)
                        resolved_entity = self._mapper.resolve_subject(
                            approval, fact, resolution_result
                        )
                        call_audits[-1] = call_audits[-1].model_copy(
                            update={"mapping_outcome": "resolved"}
                        )
                        resolved_subject = resolved_entity.subject
                        approved_unit = resolved_entity.unit
                    arguments = self._mapper.arguments_for(
                        approval,
                        fact,
                        resolved_subject=resolved_subject,
                    )
                    result, call_audit = self._call_tool(
                        server,
                        approval,
                        arguments,
                        fact_freshness_seconds=query.request.freshness.max_age_seconds,
                    )
                    call_audits.append(call_audit)
                    if self._expired(query):
                        return self._result(
                            (),
                            SourceAttemptStatus.BLOCKED,
                            started,
                            tuple(attempted),
                            "deadline_exceeded",
                        )
                    document = self._mapper.map(
                        approval,
                        fact,
                        result,
                        self._now(),
                        resolved_subject=resolved_subject,
                        approved_unit=approved_unit,
                    )
                    call_audits[-1] = call_audits[-1].model_copy(
                        update={"mapping_outcome": "mapped"}
                    )
                except McpMappingError as exc:
                    had_failure = True
                    had_mapping_failure = True
                    had_conflict = had_conflict or str(exc) == "fact_conflicted"
                    if call_audits and call_audits[-1].mapping_outcome == "received":
                        call_audits[-1] = call_audits[-1].model_copy(
                            update={
                                "mapping_outcome": "mapping_failed",
                                "error": (
                                    "fact_conflicted"
                                    if str(exc) == "fact_conflicted"
                                    else "mcp_mapping_failed"
                                ),
                            }
                        )
                    continue
                except McpClientError as exc:
                    had_failure = True
                    error_code = _classify_client_error(str(exc))
                    error_codes.append(error_code)
                    if str(exc) == "source_rate_limited":
                        assert arguments is not None
                        call_audits.append(
                            self._limited_audit(server, approval, arguments)
                        )
                    elif isinstance(
                        getattr(exc, "call_audit", None), McpCallAudit
                    ):
                        call_audits.append(exc.call_audit)
                    elif arguments is not None:
                        arguments_hash, _ = _call_identity(
                            server, approval, arguments
                        )
                        call_audits.append(
                            McpCallAudit(
                                server_id=server.server_id,
                                tool_name=approval.tool_name,
                                approval_version=approval.approval_version,
                                duration_ms=0,
                                arguments_hash=arguments_hash,
                                mapping_outcome="client_failed",
                                error=error_code,
                            )
                        )
                    continue
                except Exception:
                    had_failure = True
                    error_codes.append("fact_unavailable")
                    continue
                documents.append(document)
                break

        if documents:
            return self._result(
                tuple(documents),
                SourceAttemptStatus.SUCCEEDED,
                started,
                tuple(attempted),
                None,
                tuple(call_audits),
            )
        return self._result(
            (),
            SourceAttemptStatus.FAILED if had_failure else SourceAttemptStatus.SKIPPED,
            started,
            tuple(attempted),
            (
                error_codes[-1]
                if error_codes
                else "fact_conflicted"
                if had_conflict
                else "mcp_mapping_failed"
                if had_mapping_failure
                else "mcp_unavailable"
                if had_failure
                else "mcp_not_configured"
            ),
            tuple(call_audits),
        )

    def _call_tool(
        self,
        server: McpServerConfig,
        approval: McpToolApproval,
        arguments: Mapping[str, object],
        *,
        fact_freshness_seconds: int | None,
    ) -> tuple[McpToolResult, McpCallAudit]:
        arguments_hash, cache_key = _call_identity(server, approval, arguments)
        now = self._aware_now()
        with self._state_lock:
            cached = self._call_cache.get(cache_key)
            if cached is not None and cached.expires_at > now:
                return cached.result, McpCallAudit(
                    server_id=server.server_id,
                    tool_name=approval.tool_name,
                    approval_version=approval.approval_version,
                    duration_ms=0,
                    arguments_hash=arguments_hash,
                    response_bytes=cached.response_bytes,
                    response_hash=cached.response_hash,
                    mapping_outcome="received",
                    cache_hit=True,
                )
            if cached is not None:
                self._call_cache.pop(cache_key, None)
            window_key = (server.server_id, approval.tool_name)
            window = self._rate_windows.setdefault(window_key, deque())
            cutoff = now - timedelta(minutes=1)
            while window and window[0] <= cutoff:
                window.popleft()
            if len(window) >= server.rate_limit_per_minute:
                raise McpClientError("source_rate_limited")
            # Reservation happens before I/O and is intentionally retained on failure.
            window.append(now)

        started = now
        try:
            result = self._client.call(server, approval, arguments)
        except McpClientError as exc:
            completed = self._aware_now()
            error_code = _classify_client_error(str(exc))
            exc.call_audit = McpCallAudit(
                server_id=server.server_id,
                tool_name=approval.tool_name,
                approval_version=approval.approval_version,
                duration_ms=max(
                    0, int((completed - started).total_seconds() * 1000)
                ),
                arguments_hash=arguments_hash,
                mapping_outcome="client_failed",
                error=error_code,
            )
            raise
        completed = self._aware_now()
        response = _canonical_json(result.to_dict()["payload"])
        response_hash = hashlib.sha256(response).hexdigest()
        response_bytes = len(response)
        ttl = server.cache_ttl_seconds
        if fact_freshness_seconds is not None:
            ttl = min(ttl, fact_freshness_seconds)
        if ttl > 0:
            with self._state_lock:
                self._call_cache[cache_key] = _CachedCall(
                    result=result,
                    expires_at=completed + timedelta(seconds=ttl),
                    response_bytes=response_bytes,
                    response_hash=response_hash,
                )
        return result, McpCallAudit(
            server_id=server.server_id,
            tool_name=approval.tool_name,
            approval_version=approval.approval_version,
            duration_ms=max(0, int((completed - started).total_seconds() * 1000)),
            arguments_hash=arguments_hash,
            response_bytes=response_bytes,
            response_hash=response_hash,
            mapping_outcome="received",
        )

    def _limited_audit(
        self,
        server: McpServerConfig,
        approval: McpToolApproval,
        arguments: Mapping[str, object],
    ) -> McpCallAudit:
        arguments_hash, _ = _call_identity(server, approval, arguments)
        return McpCallAudit(
            server_id=server.server_id,
            tool_name=approval.tool_name,
            approval_version=approval.approval_version,
            duration_ms=0,
            arguments_hash=arguments_hash,
            mapping_outcome="rate_limited",
            error="source_rate_limited",
        )

    def _aware_now(self) -> datetime:
        value = self._now()
        if value.utcoffset() is None:
            raise ValueError("clock_must_be_timezone_aware")
        return value.astimezone(UTC)

    def _expired(self, query: SourceQuery) -> bool:
        return self._now() >= _parse_time(query.deadline_at)

    def _result(
        self,
        documents: tuple[SourceDocument, ...],
        status: SourceAttemptStatus,
        started: datetime,
        facts_attempted: tuple[str, ...],
        error: str | None,
        call_audits: tuple[McpCallAudit, ...] = (),
    ) -> SourceResult:
        return SourceResult(
            documents=documents,
            attempt=SourceAttempt(
                source_type=SourceType.MCP,
                source_name="approved_mcp",
                status=status,
                started_at=_format_time(started),
                completed_at=_format_time(self._now()),
                error=error,
                facts_attempted=facts_attempted,
                call_audits=call_audits,
            ),
        )


def _classify_client_error(code: str) -> str:
    return _CLIENT_ERROR_CODES.get(code, "fact_unavailable")


def _canonical_json(value: object) -> bytes:
    try:
        return json.dumps(
            value,
            allow_nan=False,
            ensure_ascii=True,
            separators=(",", ":"),
            sort_keys=True,
        ).encode("utf-8")
    except (TypeError, ValueError):
        raise McpClientError("response_invalid") from None


def _call_identity(
    server: McpServerConfig,
    approval: McpToolApproval,
    arguments: Mapping[str, object],
) -> tuple[str, str]:
    arguments_payload = _canonical_json(dict(arguments))
    arguments_hash = hashlib.sha256(arguments_payload).hexdigest()
    mapping = (
        None
        if approval.mapping is None
        else approval.mapping.model_dump(mode="json")
    )
    key_payload = _canonical_json(
        {
            "server_id": server.server_id,
            "tool_name": approval.tool_name,
            "approval_version": approval.approval_version,
            "mapping": mapping,
            "arguments": json.loads(arguments_payload),
        }
    )
    return arguments_hash, hashlib.sha256(key_payload).hexdigest()


def _parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value[:-1] + "+00:00" if value.endswith("Z") else value)


def _format_time(value: datetime) -> str:
    if value.utcoffset() is None:
        raise McpMappingError("invalid_retrieval_timestamp")
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


__all__ = ["McpSource"]
