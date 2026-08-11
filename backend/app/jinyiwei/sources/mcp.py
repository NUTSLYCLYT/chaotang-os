"""Generic evidence source for administrator-approved read-only MCP tools."""

from __future__ import annotations

import hashlib
import inspect
import json
import unicodedata
from collections import deque
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from threading import Lock
from time import monotonic
from typing import Protocol

from app.jinyiwei.freshness import is_evidence_fresh
from app.jinyiwei.instruments import (
    AShareExchange,
    InstrumentHint,
    InstrumentResolution,
    InstrumentResolutionStatus,
    extract_instrument_hints,
    has_out_of_scope_market_hint,
    instrument_name_queries,
    instrument_ref_metadata,
    resolve_a_share,
)
from app.jinyiwei.mcp.client import McpClientError, McpToolResult
from app.jinyiwei.mcp.contracts import (
    McpServerConfig,
    McpToolApproval,
    ToolEffect,
)
from app.jinyiwei.mcp.mapping import DeterministicMcpMapper, McpMappingError
from app.jinyiwei.mcp.registry import McpRegistry
from app.jinyiwei.models import (
    FactCategory,
    McpCallAudit,
    RequiredFact,
    SourceAttempt,
    SourceAttemptStatus,
    SourceType,
)
from app.jinyiwei.sources.base import SourceDocument, SourceQuery, SourceResult


class _McpClient(Protocol):
    def discover(
        self,
        server: McpServerConfig,
        *,
        timeout_seconds: float | None = None,
    ) -> tuple[object, ...]: ...

    def call(
        self,
        server: McpServerConfig,
        approval: McpToolApproval,
        arguments: Mapping[str, object],
        *,
        timeout_seconds: float | None = None,
    ) -> McpToolResult: ...


def _accepts_timeout(method: object) -> bool:
    """Keep legacy in-process adapters usable while enforcing budgets in HTTP."""
    parameters = inspect.signature(method).parameters.values()
    return any(parameter.name == "timeout_seconds" for parameter in parameters)


def _discover_with_timeout(
    client: _McpClient,
    server: McpServerConfig,
    timeout_seconds: float,
) -> tuple[object, ...]:
    if _accepts_timeout(client.discover):
        return client.discover(server, timeout_seconds=timeout_seconds)
    return client.discover(server)


def _call_with_timeout(
    client: _McpClient,
    server: McpServerConfig,
    approval: McpToolApproval,
    arguments: Mapping[str, object],
    timeout_seconds: float,
) -> McpToolResult:
    if _accepts_timeout(client.call):
        return client.call(
            server,
            approval,
            arguments,
            timeout_seconds=timeout_seconds,
        )
    return client.call(server, approval, arguments)


@dataclass(frozen=True, slots=True)
class _CachedCall:
    result: McpToolResult
    expires_at: datetime
    response_bytes: int
    response_hash: str


class _DeadlineExceeded(Exception):
    pass


_CLIENT_ERROR_CODES = {
    "credential_unavailable": "credential_unavailable",
    "credential_source_invalid": "credential_source_invalid",
    "external_network_disabled": "external_network_disabled",
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


class McpRateLimitState:
    """Thread-safe, process-local reservations keyed by server and tool."""

    def __init__(self, *, clock: Callable[[], float] = monotonic) -> None:
        self._clock = clock
        self._lock = Lock()
        self._windows: dict[tuple[str, str], deque[float]] = {}

    def reserve(
        self,
        *,
        server_id: str,
        tool_name: str,
        rate_limit_per_minute: int,
    ) -> None:
        """Atomically prune, enforce, and reserve one call before I/O."""

        with self._lock:
            now = self._clock()
            window = self._windows.setdefault((server_id, tool_name), deque())
            cutoff = now - 60.0
            while window and window[0] <= cutoff:
                window.popleft()
            if len(window) >= rate_limit_per_minute:
                raise McpClientError("source_rate_limited")
            window.append(now)


class McpSource:
    """Route unresolved facts through approved tools.

    Injected rate-limit state can be shared across sources in one process. Call-result
    caches remain source-local. A plain source gets fresh rate-limit state so custom
    sources remain isolated.
    """

    def __init__(
        self,
        *,
        registry: McpRegistry,
        client: _McpClient,
        mapper: DeterministicMcpMapper,
        now: Callable[[], datetime] = lambda: datetime.now(UTC),
        rate_limit_state: McpRateLimitState | None = None,
    ) -> None:
        self._registry = registry
        self._client = client
        self._mapper = mapper
        self._now = now
        self._rate_limit_state = rate_limit_state or McpRateLimitState()
        self._cache_lock = Lock()
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
        instrument_inputs: dict[
            str,
            tuple[tuple[InstrumentHint, ...], tuple[str, ...]],
        ] = {}
        for fact in facts:
            try:
                hints, names = _instrument_inputs(query, fact)
            except McpMappingError as exc:
                return self._result(
                    (),
                    SourceAttemptStatus.FAILED,
                    started,
                    (fact.key,),
                    str(exc),
                )
            instrument_inputs[fact.key] = (hints, names)
            if (
                fact.category is FactCategory.MARKET_QUOTE
                and any(
                    hint.exchange is AShareExchange.BSE for hint in hints
                )
                and not any(
                    approval.enabled
                    and approval.effect is ToolEffect.READ_ONLY
                    and self._registry.server(
                        approval.server_id
                    ).enabled
                    and approval.matches_fact(fact)
                    and FactCategory.MARKET_QUOTE
                    in approval.fact_categories
                    and _approval_supports_exchange(
                        approval,
                        AShareExchange.BSE,
                    )
                    for approval in self._registry.approvals
                )
            ):
                return self._result(
                    (),
                    SourceAttemptStatus.FAILED,
                    started,
                    (fact.key,),
                    "provider_capability_missing",
                )
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
        fresh_document_count = 0
        stale_document_count = 0
        resolution_cache: dict[
            tuple[
                tuple[str, str],
                tuple[str, ...],
                tuple[InstrumentHint, ...],
            ],
            InstrumentResolution,
        ] = {}
        resolution_lookup: dict[
            tuple[tuple[str, str], str],
            InstrumentResolution,
        ] = {}
        for fact in facts:
            if len(documents) >= query.max_items:
                break
            fact_candidates = candidates[fact.key]
            hints, names = instrument_inputs[fact.key]
            if (
                fact.category is FactCategory.MARKET_QUOTE
                and any(
                    hint.exchange is AShareExchange.BSE for hint in hints
                )
            ):
                fact_candidates = tuple(
                    approval
                    for approval in fact_candidates
                    if _approval_supports_exchange(
                        approval,
                        AShareExchange.BSE,
                    )
                )
                if not fact_candidates:
                    if fact.key not in attempted:
                        attempted.append(fact.key)
                    return self._result(
                        (),
                        SourceAttemptStatus.FAILED,
                        started,
                        tuple(attempted),
                        "provider_capability_missing",
                        tuple(call_audits),
                    )
            best_stale_document: SourceDocument | None = None
            for approval in fact_candidates:
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
                    resolved_subject = None
                    resolved_instrument = None
                    approved_unit = None
                    mapping = approval.mapping
                    resolution = (
                        None if mapping is None else mapping.entity_resolution
                    )
                    if resolution is not None:
                        resolver = self._registry.approval(
                            approval.server_id, resolution.tool_name
                        )
                        namespace = (
                            server.server_id,
                            _resolution_contract_hash(approval),
                        )
                        cache_key = (namespace, names, hints)
                        resolved = _lookup_resolution(
                            resolution_lookup,
                            namespace=namespace,
                            hints=hints,
                            names=names,
                        )
                        alias_expected = (
                            None
                            if hints or resolved is not None
                            else _lookup_alias_resolution(
                                resolution_lookup,
                                namespace=namespace,
                                names=names,
                            )
                        )
                        if (
                            alias_expected is not None
                            and alias_expected.status
                            is InstrumentResolutionStatus.AMBIGUOUS
                        ):
                            resolved = alias_expected
                        if resolved is None:
                            resolved = resolution_cache.get(cache_key)
                        if resolved is None:
                            if server.server_id not in discovered_servers:
                                _discover_with_timeout(
                                    self._client,
                                    server,
                                    self._remaining_timeout(
                                        query,
                                        server,
                                    ),
                                )
                                discovered_servers.add(server.server_id)
                            resolved = self._resolve_instrument(
                                query=query,
                                fact=fact,
                                server=server,
                                approval=approval,
                                resolver=resolver,
                                call_audits=call_audits,
                                hints=hints,
                                names=names,
                                original_name_only=(
                                    alias_expected is not None
                                ),
                            )
                            if (
                                alias_expected is not None
                                and resolved.status
                                is InstrumentResolutionStatus.RESOLVED
                                and not _same_resolution(
                                    alias_expected,
                                    resolved,
                                )
                            ):
                                resolved = InstrumentResolution(
                                    InstrumentResolutionStatus.AMBIGUOUS
                                )
                                if (
                                    call_audits
                                    and call_audits[-1].tool_name
                                    == resolver.tool_name
                                ):
                                    call_audits[-1] = call_audits[
                                        -1
                                    ].model_copy(
                                        update={
                                            "mapping_outcome": (
                                                "mapping_failed"
                                            ),
                                            "error": (
                                                "instrument_ambiguous"
                                            ),
                                        }
                                    )
                            resolution_cache[cache_key] = resolved
                            if (
                                resolved.status
                                is InstrumentResolutionStatus.RESOLVED
                            ):
                                _remember_resolution(
                                    resolution_lookup,
                                    namespace=namespace,
                                    hints=hints,
                                    names=names,
                                    resolved=resolved,
                                )
                        if (
                            resolved.status
                            is InstrumentResolutionStatus.AMBIGUOUS
                        ):
                            raise McpMappingError("instrument_ambiguous")
                        if (
                            resolved.status
                            is InstrumentResolutionStatus.NOT_FOUND
                        ):
                            raise McpMappingError("instrument_not_found")
                        assert resolved.instrument is not None
                        assert resolved.provider_subject is not None
                        resolved_subject = resolved.provider_subject
                        resolved_instrument = resolved.instrument
                        approved_unit = resolved.instrument.currency
                        arguments = self._mapper.arguments_for_instrument(
                            approval,
                            fact,
                            resolved,
                        )
                    else:
                        if server.server_id not in discovered_servers:
                            _discover_with_timeout(
                                self._client,
                                server,
                                self._remaining_timeout(
                                    query,
                                    server,
                                ),
                            )
                            discovered_servers.add(server.server_id)
                        arguments = self._mapper.arguments_for(approval, fact)
                    if self._expired(query):
                        raise _DeadlineExceeded
                    result, call_audit = self._call_tool(
                        server,
                        approval,
                        arguments,
                        fact_freshness_seconds=query.request.freshness.max_age_seconds,
                        timeout_seconds=self._remaining_timeout(query, server),
                    )
                    call_audits.append(call_audit)
                    if self._expired(query):
                        return self._result(
                            (),
                            SourceAttemptStatus.BLOCKED,
                            started,
                            tuple(attempted),
                            "deadline_exceeded",
                            tuple(call_audits),
                        )
                    document = self._mapper.map(
                        approval,
                        fact,
                        result,
                        self._now(),
                        resolved_subject=resolved_subject,
                        approved_unit=approved_unit,
                    )
                    if resolved_instrument is not None:
                        document = document.model_copy(
                            update={
                                "metadata": {
                                    **dict(document.metadata),
                                    "a_share_identity": instrument_ref_metadata(
                                        resolved_instrument
                                    ),
                                    "market_metric": (
                                        None
                                        if fact.market_metric is None
                                        else fact.market_metric.value
                                    ),
                                }
                            }
                        )
                    call_audits[-1] = call_audits[-1].model_copy(
                        update={"mapping_outcome": "mapped"}
                    )
                except _DeadlineExceeded:
                    return self._result(
                        (),
                        SourceAttemptStatus.BLOCKED,
                        started,
                        tuple(attempted),
                        "deadline_exceeded",
                        tuple(call_audits),
                    )
                except McpMappingError as exc:
                    had_failure = True
                    had_mapping_failure = True
                    mapping_error = str(exc)
                    safe_mapping_error = (
                        "quote_unavailable"
                        if (
                            resolved_subject is not None
                            and fact.category is FactCategory.MARKET_QUOTE
                        )
                        else mapping_error
                    )
                    had_conflict = had_conflict or mapping_error == "fact_conflicted"
                    if safe_mapping_error in {
                        "instrument_ambiguous",
                        "instrument_not_found",
                        "market_out_of_scope",
                        "provider_capability_missing",
                        "quote_unavailable",
                    }:
                        error_codes.append(safe_mapping_error)
                    if call_audits and call_audits[-1].mapping_outcome == "received":
                        call_audits[-1] = call_audits[-1].model_copy(
                            update={
                                "mapping_outcome": "mapping_failed",
                                "error": (
                                    "fact_conflicted"
                                    if mapping_error == "fact_conflicted"
                                    else safe_mapping_error
                                    if safe_mapping_error in {
                                        "instrument_ambiguous",
                                        "instrument_not_found",
                                        "market_out_of_scope",
                                        "provider_capability_missing",
                                        "quote_unavailable",
                                    }
                                    else "mcp_mapping_failed"
                                ),
                            }
                        )
                    if mapping_error in {
                        "instrument_ambiguous",
                        "market_out_of_scope",
                    }:
                        return self._result(
                            (),
                            SourceAttemptStatus.FAILED,
                            started,
                            tuple(attempted),
                            mapping_error,
                            tuple(call_audits),
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
                if is_evidence_fresh(
                    as_of=document.as_of,
                    retrieved_at=document.retrieved_at,
                    request=query.request,
                    fact_key=fact.key,
                    source_type=document.source_type,
                    now=self._aware_now(),
                ):
                    documents.append(document)
                    fresh_document_count += 1
                    best_stale_document = None
                    break
                if (
                    best_stale_document is None
                    or _document_as_of(document) > _document_as_of(best_stale_document)
                ):
                    best_stale_document = document
            if best_stale_document is not None:
                documents.append(best_stale_document)
                stale_document_count += 1

        if documents:
            return self._result(
                tuple(documents),
                SourceAttemptStatus.SUCCEEDED,
                started,
                tuple(attempted),
                (
                    "stale_evidence_only"
                    if stale_document_count and not fresh_document_count
                    else None
                ),
                tuple(call_audits),
            )
        return self._result(
            (),
            SourceAttemptStatus.FAILED if had_failure else SourceAttemptStatus.SKIPPED,
            started,
            tuple(attempted),
            _preferred_error(
                error_codes,
                had_conflict=had_conflict,
                had_mapping_failure=had_mapping_failure,
                had_failure=had_failure,
            ),
            tuple(call_audits),
        )

    def _resolve_instrument(
        self,
        *,
        query: SourceQuery,
        fact: RequiredFact,
        server: McpServerConfig,
        approval: McpToolApproval,
        resolver: McpToolApproval,
        call_audits: list[McpCallAudit],
        hints: tuple[InstrumentHint, ...],
        names: tuple[str, ...],
        original_name_only: bool,
    ) -> InstrumentResolution:
        searches = (
            (names[0],)
            if original_name_only
            else tuple(
                dict.fromkeys(
                    [
                        (
                            f"{hint.ticker}.{_exchange_suffix(hint.exchange)}"
                            if hint.exchange is not None
                            else hint.ticker
                        )
                        for hint in hints
                    ]
                    + list(names)
                )
            )
        )
        for search in searches:
            if self._expired(query):
                raise _DeadlineExceeded
            result, audit = self._call_tool(
                server,
                resolver,
                {"query": search},
                fact_freshness_seconds=query.request.freshness.max_age_seconds,
                timeout_seconds=self._remaining_timeout(query, server),
            )
            call_audits.append(audit)
            try:
                candidates = self._mapper.instrument_candidates(approval, result)
            except McpMappingError as exc:
                if str(exc) == "entity_not_resolved":
                    continue
                raise
            resolved = resolve_a_share(
                candidates,
                hints=hints,
                accepted_names=names,
            )
            if resolved.status is not InstrumentResolutionStatus.NOT_FOUND:
                if resolved.status is InstrumentResolutionStatus.RESOLVED:
                    call_audits[-1] = call_audits[-1].model_copy(
                        update={"mapping_outcome": "resolved"}
                    )
                return resolved
        return InstrumentResolution(InstrumentResolutionStatus.NOT_FOUND)

    def _call_tool(
        self,
        server: McpServerConfig,
        approval: McpToolApproval,
        arguments: Mapping[str, object],
        *,
        fact_freshness_seconds: int | None,
        timeout_seconds: float,
    ) -> tuple[McpToolResult, McpCallAudit]:
        arguments_hash, cache_key = _call_identity(server, approval, arguments)
        now = self._aware_now()
        with self._cache_lock:
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
        # Reservation happens before I/O and is intentionally retained on failure.
        self._rate_limit_state.reserve(
            server_id=server.server_id,
            tool_name=approval.tool_name,
            rate_limit_per_minute=server.rate_limit_per_minute,
        )

        started = now
        try:
            result = _call_with_timeout(
                self._client,
                server,
                approval,
                arguments,
                timeout_seconds,
            )
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
            with self._cache_lock:
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

    def _remaining_timeout(
        self,
        query: SourceQuery,
        server: McpServerConfig,
    ) -> float:
        remaining = (
            _parse_time(query.deadline_at) - self._aware_now()
        ).total_seconds()
        if remaining <= 0:
            raise _DeadlineExceeded
        return min(float(server.timeout_seconds), remaining)

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


def _document_as_of(document: SourceDocument) -> datetime:
    return _parse_time(document.as_of).astimezone(UTC)


def _instrument_inputs(
    query: SourceQuery,
    fact: RequiredFact,
) -> tuple[tuple[InstrumentHint, ...], tuple[str, ...]]:
    names = instrument_name_queries(fact.subject)
    if fact.category is not FactCategory.MARKET_QUOTE:
        return (), names
    if fact.jurisdiction is not None and fact.jurisdiction != "CN":
        raise McpMappingError("market_out_of_scope")
    local_texts = (fact.subject, fact.description)
    if has_out_of_scope_market_hint(*local_texts):
        raise McpMappingError("market_out_of_scope")
    if has_out_of_scope_market_hint(query.request.question):
        raise McpMappingError("market_out_of_scope")
    local_hints = extract_instrument_hints(*local_texts)
    if local_hints:
        return _one_logical_instrument(local_hints), names
    return (
        _one_logical_instrument(
            extract_instrument_hints(query.request.question)
        ),
        names,
    )


def _one_logical_instrument(
    hints: tuple[InstrumentHint, ...],
) -> tuple[InstrumentHint, ...]:
    if not hints:
        return ()
    tickers = {hint.ticker for hint in hints}
    exchanges = {
        hint.exchange for hint in hints if hint.exchange is not None
    }
    if len(tickers) != 1 or len(exchanges) > 1:
        raise McpMappingError("instrument_ambiguous")
    ticker = next(iter(tickers))
    exchange = next(iter(exchanges)) if exchanges else None
    return (InstrumentHint(exchange=exchange, ticker=ticker),)


def _approval_supports_exchange(
    approval: McpToolApproval,
    exchange: AShareExchange,
) -> bool:
    mapping = approval.mapping
    resolution = None if mapping is None else mapping.entity_resolution
    return (
        resolution is not None
        and exchange in resolution.exchange_subject_patterns
    )


def _resolution_contract_hash(approval: McpToolApproval) -> str:
    mapping = approval.mapping
    resolution = None if mapping is None else mapping.entity_resolution
    if resolution is None:
        raise McpMappingError("entity_resolution_not_approved")
    return hashlib.sha256(
        _canonical_json(resolution.model_dump(mode="json"))
    ).hexdigest()


def _lookup_resolution(
    cache: dict[
        tuple[tuple[str, str], str],
        InstrumentResolution,
    ],
    *,
    namespace: tuple[str, str],
    hints: tuple[InstrumentHint, ...],
    names: tuple[str, ...],
) -> InstrumentResolution | None:
    tokens = (
        _hint_tokens(hints, lookup=True)
        if hints
        else (_name_token(names[0]),)
    )
    matches = tuple(
        cache[(namespace, token)]
        for token in tokens
        if (namespace, token) in cache
    )
    if not matches:
        return None
    first = matches[0]
    if (
        first.status is InstrumentResolutionStatus.AMBIGUOUS
        or any(not _same_resolution(first, item) for item in matches[1:])
    ):
        return InstrumentResolution(InstrumentResolutionStatus.AMBIGUOUS)
    return first


def _lookup_alias_resolution(
    cache: dict[
        tuple[tuple[str, str], str],
        InstrumentResolution,
    ],
    *,
    namespace: tuple[str, str],
    names: tuple[str, ...],
) -> InstrumentResolution | None:
    if len(names) < 2:
        return None
    matches = tuple(
        cache[(namespace, _name_token(name))]
        for name in names[1:]
        if (namespace, _name_token(name)) in cache
    )
    if not matches:
        return None
    first = matches[0]
    if (
        first.status is InstrumentResolutionStatus.AMBIGUOUS
        or any(not _same_resolution(first, item) for item in matches[1:])
    ):
        return InstrumentResolution(InstrumentResolutionStatus.AMBIGUOUS)
    return first


def _remember_resolution(
    cache: dict[
        tuple[tuple[str, str], str],
        InstrumentResolution,
    ],
    *,
    namespace: tuple[str, str],
    hints: tuple[InstrumentHint, ...],
    names: tuple[str, ...],
    resolved: InstrumentResolution,
) -> None:
    assert resolved.instrument is not None
    tokens = set(_hint_tokens(hints, lookup=False))
    tokens.update(_name_token(name) for name in names)
    tokens.add(_name_token(resolved.instrument.canonical_name))
    final_hint = InstrumentHint(
        exchange=resolved.instrument.exchange,
        ticker=resolved.instrument.ticker,
    )
    tokens.update(_hint_tokens((final_hint,), lookup=False))
    for token in tokens:
        key = (namespace, token)
        existing = cache.get(key)
        if existing is None or _same_resolution(existing, resolved):
            cache[key] = resolved
        else:
            cache[key] = InstrumentResolution(
                InstrumentResolutionStatus.AMBIGUOUS
            )


def _hint_tokens(
    hints: tuple[InstrumentHint, ...],
    *,
    lookup: bool,
) -> tuple[str, ...]:
    tokens: list[str] = []
    for hint in hints:
        if hint.exchange is None:
            tokens.append(f"ticker:{hint.ticker}")
        else:
            tokens.append(
                f"instrument:{hint.exchange.value}:{hint.ticker}"
            )
            if not lookup:
                tokens.append(f"ticker:{hint.ticker}")
    return tuple(dict.fromkeys(tokens))


def _name_token(value: str) -> str:
    normalized = " ".join(
        unicodedata.normalize("NFKC", value).split()
    ).casefold()
    return f"name:{normalized}"


def _same_resolution(
    left: InstrumentResolution,
    right: InstrumentResolution,
) -> bool:
    if (
        left.status is not InstrumentResolutionStatus.RESOLVED
        or right.status is not InstrumentResolutionStatus.RESOLVED
        or left.instrument is None
        or right.instrument is None
    ):
        return left == right
    return (
        left.instrument.exchange,
        left.instrument.ticker,
        left.provider_subject,
    ) == (
        right.instrument.exchange,
        right.instrument.ticker,
        right.provider_subject,
    )


def _preferred_error(
    error_codes: list[str],
    *,
    had_conflict: bool,
    had_mapping_failure: bool,
    had_failure: bool,
) -> str:
    priorities = (
        "instrument_not_found",
        "provider_capability_missing",
        "quote_unavailable",
        "fact_conflicted",
        "mcp_mapping_failed",
        "credential_unavailable",
        "credential_source_invalid",
        "external_network_disabled",
        "auth_required",
        "auth_expired",
        "source_rate_limited",
        "timeout",
        "schema_changed",
        "response_invalid",
        "fact_unavailable",
    )
    available = set(error_codes)
    if had_conflict:
        available.add("fact_conflicted")
    if had_mapping_failure:
        available.add("mcp_mapping_failed")
    if had_failure:
        available.add("mcp_unavailable")
    available.add("mcp_not_configured")
    return next(
        code for code in (*priorities, "mcp_unavailable", "mcp_not_configured")
        if code in available
    )


def _exchange_suffix(exchange: AShareExchange) -> str:
    return {
        AShareExchange.SSE: "SH",
        AShareExchange.SZSE: "SZ",
        AShareExchange.BSE: "BJ",
    }[exchange]


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
