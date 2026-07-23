"""Deterministic, code-owned verification of collected evidence."""

from __future__ import annotations

import json
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from types import MappingProxyType
from urllib.parse import urlsplit

from app.jinyiwei.models import (
    DataGapRequest,
    EvidenceConflict,
    EvidenceItem,
    EvidenceQuality,
    EvidenceStance,
    SourceType,
)

_SOURCE_PRIORITY = {
    SourceType.SHIGUAN: 0,
    SourceType.MCP: 1,
    SourceType.PUBLIC_API: 2,
    SourceType.PUBLIC_WEB: 3,
}
_CREDIBLE = frozenset({EvidenceQuality.PRIMARY, EvidenceQuality.AUTHORITATIVE})


@dataclass(frozen=True, slots=True)
class VerificationResult:
    """Immutable deterministic partition produced without model judgement."""

    evidence_by_fact: Mapping[str, tuple[EvidenceItem, ...]]
    resolved_facts: tuple[str, ...]
    unresolved_facts: tuple[str, ...]
    conflicts: tuple[EvidenceConflict, ...]
    do_not_infer: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class ArchiveResolution:
    """Partition archive candidates without promoting stale history to facts."""

    current: tuple[EvidenceItem, ...]
    historical: tuple[EvidenceItem, ...]
    unresolved_fact_keys: tuple[str, ...]


class DeterministicVerifier:
    """Small callable wrapper for dependency injection into coordinators."""

    def verify(
        self,
        request: DataGapRequest,
        evidence: Iterable[EvidenceItem],
        *,
        now: datetime,
    ) -> VerificationResult:
        return verify_evidence(request, evidence, now=now)

    def __call__(
        self,
        request: DataGapRequest,
        evidence: Iterable[EvidenceItem],
        *,
        now: datetime,
    ) -> VerificationResult:
        return self.verify(request, evidence, now=now)


def verify_evidence(
    request: DataGapRequest,
    evidence: Iterable[EvidenceItem],
    *,
    now: datetime,
) -> VerificationResult:
    """Group and resolve evidence using only fixed, observable rules."""

    current = _aware_utc(now)
    fact_order = tuple(fact.key for fact in request.required_facts)
    grouped: dict[str, list[EvidenceItem]] = {key: [] for key in fact_order}
    for item in evidence:
        if item.fact_key in grouped:
            grouped[item.fact_key].append(item)

    frozen_groups: dict[str, tuple[EvidenceItem, ...]] = {}
    resolved: list[str] = []
    unresolved: list[str] = []
    conflicts: list[EvidenceConflict] = []
    do_not_infer: list[str] = []
    for fact_key in fact_order:
        ordered = tuple(sorted(grouped[fact_key], key=_evidence_sort_key))
        frozen_groups[fact_key] = ordered
        fresh_credible = tuple(
            item
            for item in ordered
            if item.quality in _CREDIBLE and _is_fresh(item, request, current)
        )
        fact_conflict = _find_conflict(fact_key, fresh_credible)
        if fact_conflict is not None:
            conflicts.append(fact_conflict)
            unresolved.append(fact_key)
            do_not_infer.append(
                f"{fact_key}: credible evidence conflicts; do not infer"
            )
            continue
        if _is_resolved(fresh_credible):
            resolved.append(fact_key)
        else:
            unresolved.append(fact_key)
            do_not_infer.append(
                f"{fact_key}: insufficient fresh independent credible evidence; "
                "do not infer"
            )

    return VerificationResult(
        evidence_by_fact=MappingProxyType(frozen_groups),
        resolved_facts=tuple(resolved),
        unresolved_facts=tuple(unresolved),
        conflicts=tuple(conflicts),
        do_not_infer=tuple(do_not_infer),
    )


def resolve_archive_evidence(
    request: DataGapRequest,
    evidence: Iterable[EvidenceItem],
    *,
    now: datetime,
) -> ArchiveResolution:
    """Split archive candidates into current evidence and stale background."""

    current_time = _aware_utc(now)
    requested = {fact.key for fact in request.required_facts}
    ordered = tuple(
        sorted(
            (
                item
                for item in evidence
                if item.source_type is SourceType.SHIGUAN
                and item.fact_key in requested
            ),
            key=_evidence_sort_key,
        )
    )
    current = tuple(
        item for item in ordered if _is_fresh(item, request, current_time)
    )
    historical = tuple(
        item
        for item in ordered
        if _parse_time(item.as_of) <= current_time
        and not _is_fresh(item, request, current_time)
    )
    verification = verify_evidence(request, current, now=current_time)
    return ArchiveResolution(
        current=current,
        historical=historical,
        unresolved_fact_keys=verification.unresolved_facts,
    )


def _aware_utc(value: datetime) -> datetime:
    if value.utcoffset() is None:
        raise ValueError("now must be timezone-aware")
    return value.astimezone(UTC)


def _parse_time(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.utcoffset() is None:
        raise ValueError("evidence timestamp must be timezone-aware")
    return parsed.astimezone(UTC)


def _is_fresh(
    item: EvidenceItem, request: DataGapRequest, now: datetime
) -> bool:
    as_of = _parse_time(item.as_of)
    if as_of > now:
        return False
    freshness = request.freshness
    if (
        freshness.max_age_seconds is not None
        and as_of < now - timedelta(seconds=freshness.max_age_seconds)
    ):
        return False
    if freshness.not_before is not None and as_of < _parse_time(
        freshness.not_before
    ):
        return False
    return True


def _canonical_value(item: EvidenceItem) -> str:
    return json.dumps(
        {
            "unit": item.unit,
            "value": item.model_dump(mode="json")["value"],
        },
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def _origin(item: EvidenceItem) -> str:
    parsed = urlsplit(item.source_url)
    return f"{parsed.scheme.casefold()}://{parsed.netloc.casefold()}"


def _evidence_sort_key(item: EvidenceItem) -> tuple[object, ...]:
    return (
        _SOURCE_PRIORITY[item.source_type],
        item.source_url,
        item.publisher.casefold(),
        item.evidence_id,
    )


def _find_conflict(
    fact_key: str, credible: tuple[EvidenceItem, ...]
) -> EvidenceConflict | None:
    conflict_ids: set[str] = set()
    for index, left in enumerate(credible):
        for right in credible[index + 1 :]:
            stance_conflict = left.stance is not right.stance
            value_conflict = (
                left.stance is EvidenceStance.SUPPORTS
                and right.stance is EvidenceStance.SUPPORTS
                and _canonical_value(left) != _canonical_value(right)
            )
            if stance_conflict or value_conflict:
                conflict_ids.update((left.evidence_id, right.evidence_id))
    if not conflict_ids:
        return None
    ordered_ids = tuple(
        item.evidence_id for item in credible if item.evidence_id in conflict_ids
    )
    return EvidenceConflict(
        fact_key=fact_key,
        evidence_ids=ordered_ids,
        summary="fresh credible evidence disagrees",
    )


def _is_resolved(credible: tuple[EvidenceItem, ...]) -> bool:
    supports = tuple(
        item for item in credible if item.stance is EvidenceStance.SUPPORTS
    )
    if any(item.quality is EvidenceQuality.PRIMARY for item in supports):
        return True
    authoritative = tuple(
        item for item in supports if item.quality is EvidenceQuality.AUTHORITATIVE
    )
    for index, left in enumerate(authoritative):
        for right in authoritative[index + 1 :]:
            if (
                _canonical_value(left) == _canonical_value(right)
                and left.publisher.casefold() != right.publisher.casefold()
                and _origin(left) != _origin(right)
            ):
                return True
    return False


__all__ = [
    "ArchiveResolution",
    "DeterministicVerifier",
    "VerificationResult",
    "resolve_archive_evidence",
    "verify_evidence",
]
