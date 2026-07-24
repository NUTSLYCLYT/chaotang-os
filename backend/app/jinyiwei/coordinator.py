"""Synchronous orchestration for bounded Jinyiwei investigations."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Protocol

from app.jinyiwei.errors import JinyiweiError
from app.jinyiwei.freshness import is_evidence_fresh
from app.jinyiwei.models import (
    CacheMetadata,
    DataGapRequest,
    EvidenceItem,
    EvidencePack,
    EvidencePackStatus,
    InvestigationPlan,
    SourceAttempt,
    SourceAttemptStatus,
    SourceType,
)
from app.jinyiwei.sources.base import EvidenceExtractor, EvidenceSource, SourceQuery
from app.jinyiwei.storage import (
    lookup_cached_pack,
    put_cache_entry,
    store_data_gap_request,
    store_evidence_pack,
)
from app.jinyiwei.verification import (
    VerificationResult,
    resolve_archive_evidence,
    verify_evidence,
)

_SOURCE_ORDER = (
    SourceType.SHIGUAN,
    SourceType.MCP,
    SourceType.PUBLIC_API,
    SourceType.PUBLIC_WEB,
)

_PERSISTED_SOURCE_ERROR_CODES = frozenset(
    {
        "deadline_exceeded",
        "auth_expired",
        "auth_required",
        "fact_conflicted",
        "fact_unavailable",
        "instrument_ambiguous",
        "instrument_not_found",
        "market_out_of_scope",
        "mcp_mapping_failed",
        "mcp_not_configured",
        "mcp_unavailable",
        "provider_capability_missing",
        "quote_unavailable",
        "public_api_not_configured",
        "public_api_unavailable",
        "public_web_unavailable",
        "query_context_missing",
        "response_invalid",
        "schema_changed",
        "shiguan_adopted_evidence_conflict",
        "shiguan_unavailable",
        "source_out_of_scope",
        "source_unavailable",
        "source_rate_limited",
        "stale_evidence_only",
        "timeout",
        "wikimedia_search_unavailable",
    }
)


class ExtractionBudget(Protocol):
    """A decree-scoped counter claimed immediately before extraction."""

    def claim(self) -> bool: ...


class InvestigationUnavailableError(JinyiweiError):
    """The investigation could not be safely persisted and returned."""


class InvestigationCoordinator:
    """Coordinate fixed-priority sources against one absolute deadline."""

    def __init__(
        self,
        *,
        shiguan: EvidenceSource,
        public_api: EvidenceSource,
        public_web: EvidenceSource,
        mcp: EvidenceSource | None = None,
        extractor: EvidenceExtractor,
        clock: Callable[[], datetime],
        id_factory: Callable[[], str],
        db_path: Path | None = None,
    ) -> None:
        self._sources = {
            SourceType.SHIGUAN: shiguan,
            SourceType.PUBLIC_API: public_api,
            SourceType.PUBLIC_WEB: public_web,
        }
        if mcp is not None:
            self._sources[SourceType.MCP] = mcp
        self._extractor = extractor
        self._clock = clock
        self._id_factory = id_factory
        self._db_path = db_path

    def investigate(
        self,
        request: DataGapRequest,
        *,
        department: str,
        matter_type: str,
        extraction_budget: ExtractionBudget | None = None,
    ) -> EvidencePack:
        started = _utc(self._clock())
        cache_key = _cache_key(request, self._sources.get(SourceType.MCP))
        try:
            store_data_gap_request(request, db_path=self._db_path)
        except Exception as exc:
            raise InvestigationUnavailableError(
                "investigation_persistence_unavailable"
            ) from exc

        source_scope = tuple(
            source for source in _SOURCE_ORDER if source in request.source_scope
        )
        plan = InvestigationPlan(
            fact_keys=tuple(fact.key for fact in request.required_facts),
            source_scope=source_scope,
        )
        deadline = started + timedelta(seconds=request.timeout_seconds)
        deadline_at = _iso(deadline)
        attempts: list[SourceAttempt] = []
        accepted: list[EvidenceItem] = []
        accepted_by_id: dict[str, EvidenceItem] = {}
        historical: list[EvidenceItem] = []
        historical_by_id: dict[str, EvidenceItem] = {}
        stale_facts: set[str] = set()
        stale_facts_by_attempt: dict[int, set[str]] = {}
        verification = verify_evidence(request, accepted, now=started)
        cache_checked = False

        if SourceType.SHIGUAN not in source_scope:
            cached = self._lookup_cache(cache_key, started)
            cache_checked = True
            if cached is not None:
                return cached

        for source_type in source_scope:
            unresolved = verification.unresolved_facts
            if not unresolved:
                break
            before_source = _utc(self._clock())
            if before_source >= deadline:
                attempts.append(
                    _blocked_attempt(source_type, unresolved, before_source)
                )
                break
            query = SourceQuery(
                request=request,
                unresolved_fact_keys=unresolved,
                department=department,
                matter_type=matter_type,
                max_items=3,
                deadline_at=deadline_at,
            )
            source = self._sources.get(source_type)
            if source is None:
                attempts.append(
                    _failed_attempt(
                        source_type,
                        unresolved,
                        before_source,
                        before_source,
                        "mcp_not_configured"
                        if source_type is SourceType.MCP
                        else "source_unavailable",
                    )
                )
                continue
            try:
                result = source.fetch(query)
            except Exception:
                failed_at = _utc(self._clock())
                if failed_at >= deadline:
                    attempts.append(
                        _blocked_attempt(
                            source_type,
                            unresolved,
                            failed_at,
                            started_at=before_source,
                        )
                    )
                    break
                attempts.append(
                    _failed_attempt(
                        source_type, unresolved, before_source, failed_at,
                        "source_unavailable",
                    )
                )
                verification = verify_evidence(request, accepted, now=failed_at)
                continue

            after_source = _utc(self._clock())
            if after_source >= deadline:
                attempts.append(
                    _blocked_attempt(
                        source_type, unresolved, after_source, started_at=before_source,
                        source_name=result.attempt.source_name,
                    )
                )
                break

            # Sources determine the matching subset from their approved category
            # routing.  Do not turn an empty or partial match into a claim that the
            # source attempted every unresolved fact.
            attempt = _sanitize_source_attempt(result.attempt)
            if (
                attempt.status is SourceAttemptStatus.BLOCKED
                and attempt.error == "deadline_exceeded"
            ):
                attempts.append(attempt)
                break
            if attempt.status is not SourceAttemptStatus.SUCCEEDED or not result.documents:
                attempts.append(attempt)
                verification = verify_evidence(request, accepted, now=after_source)
                if source_type is SourceType.SHIGUAN and not cache_checked:
                    cached = self._lookup_cache(cache_key, after_source)
                    cache_checked = True
                    if cached is not None:
                        return cached
                continue
            if not attempt.facts_attempted:
                attempts.append(attempt)
                verification = verify_evidence(request, accepted, now=after_source)
                if source_type is SourceType.SHIGUAN and not cache_checked:
                    cached = self._lookup_cache(cache_key, after_source)
                    cache_checked = True
                    if cached is not None:
                        return cached
                continue

            before_extraction = _utc(self._clock())
            if before_extraction >= deadline:
                attempts.append(
                    _blocked_attempt(
                        source_type, unresolved, before_extraction,
                        started_at=before_source,
                        source_name=attempt.source_name,
                    )
                )
                break
            if extraction_budget is not None and not extraction_budget.claim():
                attempts.append(
                    _blocked_attempt(
                        source_type,
                        unresolved,
                        before_extraction,
                        started_at=before_source,
                        source_name=attempt.source_name,
                        error="extractor_budget_exhausted",
                    )
                )
                break
            try:
                candidates = self._extractor.extract(query, result.documents)
            except Exception:
                failed_at = _utc(self._clock())
                if failed_at >= deadline:
                    attempts.append(
                        _blocked_attempt(
                            source_type,
                            unresolved,
                            failed_at,
                            started_at=before_source,
                            source_name=attempt.source_name,
                        )
                    )
                    break
                attempts.append(
                    _failed_attempt(
                        source_type, unresolved, before_source, failed_at,
                        "extraction_failed",
                        source_name=attempt.source_name,
                    )
                )
                verification = verify_evidence(request, accepted, now=failed_at)
                continue

            after_extraction = _utc(self._clock())
            if after_extraction >= deadline:
                attempts.append(
                    _blocked_attempt(
                        source_type, unresolved, after_extraction,
                        started_at=before_source,
                        source_name=attempt.source_name,
                    )
                )
                break
            batch_by_id: dict[str, EvidenceItem] = {}
            duplicate_conflict = False
            for candidate in candidates:
                if (
                    candidate.fact_key not in unresolved
                    or candidate.fact_key not in attempt.facts_attempted
                ):
                    continue
                batch_item = batch_by_id.get(candidate.evidence_id)
                prior_item = accepted_by_id.get(candidate.evidence_id)
                prior_historical = historical_by_id.get(candidate.evidence_id)
                if (
                    (batch_item is not None and batch_item != candidate)
                    or (prior_item is not None and prior_item != candidate)
                    or (
                        prior_historical is not None
                        and prior_historical != candidate
                    )
                ):
                    duplicate_conflict = True
                    break
                batch_by_id[candidate.evidence_id] = candidate
            if duplicate_conflict:
                attempts.append(
                    _failed_attempt(
                        source_type, unresolved, before_source, after_extraction,
                        "duplicate_evidence_id_conflict",
                        source_name=attempt.source_name,
                    )
                )
            else:
                attempt_stale_facts: set[str] = set()
                if source_type is SourceType.SHIGUAN:
                    archive_resolution = resolve_archive_evidence(
                        request,
                        batch_by_id.values(),
                        now=after_extraction,
                    )
                    current_candidates = archive_resolution.current
                    for candidate in archive_resolution.historical:
                        stale_facts.add(candidate.fact_key)
                        attempt_stale_facts.add(candidate.fact_key)
                        if candidate.evidence_id not in historical_by_id:
                            historical_by_id[candidate.evidence_id] = candidate
                            historical.append(candidate)
                else:
                    current_candidates = tuple(
                        candidate
                        for candidate in batch_by_id.values()
                        if is_evidence_fresh(
                            as_of=candidate.as_of,
                            retrieved_at=candidate.retrieved_at,
                            request=request,
                            fact_key=candidate.fact_key,
                            source_type=candidate.source_type,
                            now=after_extraction,
                        )
                    )
                    attempt_stale_facts.update(
                        candidate.fact_key
                        for candidate in batch_by_id.values()
                        if candidate not in current_candidates
                    )
                    stale_facts.update(attempt_stale_facts)
                for candidate in current_candidates:
                    if candidate.evidence_id not in accepted_by_id:
                        accepted_by_id[candidate.evidence_id] = candidate
                        accepted.append(candidate)
                attempt_index = len(attempts)
                attempts.append(attempt)
                if attempt_stale_facts:
                    stale_facts_by_attempt[attempt_index] = (
                        attempt_stale_facts
                    )
            verification = verify_evidence(request, accepted, now=after_extraction)
            if (
                source_type is SourceType.SHIGUAN
                and verification.unresolved_facts
                and not cache_checked
            ):
                cached = self._lookup_cache(cache_key, after_extraction)
                cache_checked = True
                if cached is not None:
                    return cached

        completed = _utc(self._clock())
        verification = verify_evidence(request, accepted, now=completed)
        only_stale_facts = stale_facts.intersection(
            verification.unresolved_facts
        )
        if only_stale_facts:
            attempts = [
                attempt.model_copy(update={"error": "stale_evidence_only"})
                if (
                    attempt.status is SourceAttemptStatus.SUCCEEDED
                    and attempt.error is None
                    and only_stale_facts.intersection(
                        stale_facts_by_attempt.get(index, set())
                    )
                )
                else attempt
                for index, attempt in enumerate(attempts)
            ]
        status = _final_status(
            verification,
            accepted,
            attempts,
            has_historical_evidence=bool(historical),
        )
        cacheable = status is EvidencePackStatus.RESOLVED
        expires = completed + timedelta(seconds=_cache_ttl(request))
        cache = CacheMetadata(
            hit=False,
            cache_key=cache_key if cacheable else None,
            cached_at=_iso(completed) if cacheable else None,
            expires_at=_iso(expires) if cacheable else None,
        )
        investigation_id = self._id_factory()
        pack_id = self._id_factory()
        pack = EvidencePack(
            pack_id=pack_id,
            investigation_id=investigation_id,
            status=status,
            request=request,
            investigation_plan=plan,
            evidence_by_fact=verification.evidence_by_fact,
            historical_evidence_by_fact=_group_by_requested_fact(
                request, historical
            ),
            resolved_facts=verification.resolved_facts,
            unresolved_facts=verification.unresolved_facts,
            conflicts=verification.conflicts,
            source_attempts=tuple(attempts),
            investigation_started_at=_iso(started),
            investigation_completed_at=_iso(completed),
            cache=cache,
            do_not_infer=_stable_limitations(verification, stale_facts),
        )
        try:
            store_evidence_pack(pack, db_path=self._db_path)
            if cacheable:
                put_cache_entry(
                    cache_key,
                    pack.pack_id,
                    cached_at=completed,
                    expires_at=expires,
                    db_path=self._db_path,
                )
        except Exception as exc:
            raise InvestigationUnavailableError(
                "investigation_persistence_unavailable"
            ) from exc
        return pack

    def _lookup_cache(
        self, cache_key: str, now: datetime
    ) -> EvidencePack | None:
        try:
            return lookup_cached_pack(
                cache_key, now=now, db_path=self._db_path
            )
        except Exception as exc:
            raise InvestigationUnavailableError(
                "investigation_persistence_unavailable"
            ) from exc


def _cache_key(request: DataGapRequest, mcp_source: EvidenceSource | None) -> str:
    request_fingerprint = request.request_fingerprint
    if SourceType.MCP not in request.source_scope:
        return request_fingerprint
    configuration_fingerprint = "mcp_not_configured"
    fingerprint = getattr(mcp_source, "source_configuration_fingerprint", None)
    if callable(fingerprint):
        candidate = fingerprint()
        if not isinstance(candidate, str) or not candidate:
            raise ValueError("invalid_source_configuration_fingerprint")
        configuration_fingerprint = candidate
    payload = json.dumps(
        {
            "request_fingerprint": request_fingerprint,
            "source_configuration_fingerprint": configuration_fingerprint,
        },
        ensure_ascii=True,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def _utc(value: datetime) -> datetime:
    if value.utcoffset() is None:
        raise ValueError("clock must return timezone-aware datetimes")
    return value.astimezone(UTC)


def _iso(value: datetime) -> str:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def _source_name(source_type: SourceType) -> str:
    return source_type.value.casefold()


def _sanitize_source_attempt(attempt: SourceAttempt) -> SourceAttempt:
    """Allow only fixed source error codes across the persistence boundary."""
    if attempt.error is None or attempt.error in _PERSISTED_SOURCE_ERROR_CODES:
        return attempt
    return attempt.model_copy(update={"error": "source_unavailable"})


def _blocked_attempt(
    source_type: SourceType,
    facts: tuple[str, ...],
    completed_at: datetime,
    *,
    started_at: datetime | None = None,
    source_name: str | None = None,
    error: str = "deadline_exceeded",
) -> SourceAttempt:
    start = started_at or completed_at
    return SourceAttempt(
        source_type=source_type,
        source_name=source_name or _source_name(source_type),
        status=SourceAttemptStatus.BLOCKED,
        started_at=_iso(start),
        completed_at=_iso(completed_at),
        error=error,
        facts_attempted=facts,
    )


def _failed_attempt(
    source_type: SourceType,
    facts: tuple[str, ...],
    started_at: datetime,
    completed_at: datetime,
    error: str,
    *,
    source_name: str | None = None,
) -> SourceAttempt:
    return SourceAttempt(
        source_type=source_type,
        source_name=source_name or _source_name(source_type),
        status=SourceAttemptStatus.FAILED,
        started_at=_iso(started_at),
        completed_at=_iso(max(started_at, completed_at)),
        error=error,
        facts_attempted=facts,
    )


def _final_status(
    verification: VerificationResult,
    evidence: list[EvidenceItem],
    attempts: list[SourceAttempt],
    *,
    has_historical_evidence: bool = False,
) -> EvidencePackStatus:
    if not verification.unresolved_facts and not verification.conflicts:
        return EvidencePackStatus.RESOLVED
    if evidence or has_historical_evidence:
        return EvidencePackStatus.PARTIAL
    if attempts and attempts[-1].status is SourceAttemptStatus.BLOCKED:
        return EvidencePackStatus.BLOCKED
    return EvidencePackStatus.UNAVAILABLE


def _cache_ttl(request: DataGapRequest) -> int:
    requested = request.freshness.max_age_seconds
    return min(requested, 3600) if requested is not None else 3600


def _group_by_requested_fact(
    request: DataGapRequest,
    evidence: list[EvidenceItem],
) -> dict[str, tuple[EvidenceItem, ...]]:
    return {
        fact.key: tuple(item for item in evidence if item.fact_key == fact.key)
        for fact in request.required_facts
    }


def _stable_limitations(
    verification: VerificationResult, stale_facts: set[str]
) -> tuple[str, ...]:
    conflicted = {conflict.fact_key for conflict in verification.conflicts}
    return tuple(
        (
            f"fact_conflicted:{fact_key}"
            if fact_key in conflicted
            else f"fact_stale:{fact_key}"
            if fact_key in stale_facts
            else f"fact_unavailable:{fact_key}"
        )
        for fact_key in verification.unresolved_facts
    )


__all__ = ["InvestigationCoordinator", "InvestigationUnavailableError"]
