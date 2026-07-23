"""史馆-first source adapter using only public recall and archive APIs."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime

from app.jinyiwei.models import (
    EvidenceItem,
    EvidenceQuality,
    RequiredFact,
    SourceAttempt,
    SourceAttemptStatus,
    SourceType,
)
from app.jinyiwei.sources.base import SourceDocument, SourceQuery, SourceResult
from app.shiguan.models import Archive
from app.shiguan.recall import RecallContext, RecallMatch, find_similar_archives
from app.shiguan.storage import get_archive

RecallCallable = Callable[..., RecallContext]
ArchiveLoader = Callable[[str], Archive]
Clock = Callable[[], datetime]

_SOURCE_NAME = "shiguan"
_PUBLISHER = "史馆"
_UNAVAILABLE = "shiguan_unavailable"
_ADOPTED_CONFLICT = "shiguan_adopted_evidence_conflict"


class _AdoptedEvidenceConflictError(RuntimeError):
    pass


def _default_recall(
    *, matter_type: str | None, department: str | None, limit: int
) -> RecallContext:
    try:
        matches = find_similar_archives(
            matter_type=matter_type, department=department, limit=limit
        )
        return RecallContext(available=True, entries=tuple(matches))
    except Exception:  # noqa: BLE001 - this boundary must fail closed
        return RecallContext(available=False, reason=_UNAVAILABLE)


def _iso(value: datetime) -> str:
    if value.utcoffset() is None:
        value = value.replace(tzinfo=UTC)
    return value.isoformat().replace("+00:00", "Z")


def _parse(value: str) -> datetime:
    return datetime.fromisoformat(value[:-1] + "+00:00" if value.endswith("Z") else value)


def _clock_value(clock: Clock) -> datetime:
    value = clock()
    return value if value.utcoffset() is not None else value.replace(tzinfo=UTC)


def _deadline_reached(query: SourceQuery, current: datetime) -> bool:
    return current >= _parse(query.deadline_at)


def _attempt(
    query: SourceQuery,
    status: SourceAttemptStatus,
    started_at: str,
    completed_at: str,
    error: str | None = None,
) -> SourceAttempt:
    return SourceAttempt(
        source_type=SourceType.SHIGUAN,
        source_name=_SOURCE_NAME,
        status=status,
        started_at=started_at,
        completed_at=completed_at,
        error=error,
        facts_attempted=query.unresolved_fact_keys,
    )


def _metadata(match: RecallMatch, archive: Archive) -> dict[str, object]:
    return {
        "archive_id": archive.id,
        "created_at": archive.created_at,
        "reply_time": archive.reply_time,
        "match_reason": match.match_reason,
        "review_status": match.review_status.status if match.review_status else None,
        "reviewed_at": match.review_status.reviewed_at if match.review_status else None,
        "review_note": match.review_status.note if match.review_status else None,
        "evidence_labels": tuple(match.evidence_labels),
        "lessons_learned": match.lessons_learned,
        "pitfalls": match.pitfalls,
    }


def _adopted_snapshot_documents(
    match: RecallMatch,
    archive: Archive,
    *,
    retrieved_at: str,
    fact_slots: dict[str, RequiredFact],
) -> tuple[SourceDocument, ...]:
    """Restore immutable adopted evidence without claiming a new external fetch."""

    documents: list[SourceDocument] = []
    for reference in archive.evidence_references:
        snapshot = reference.snapshot
        fact = fact_slots.get(snapshot.fact_key)
        if (
            fact is None
            or snapshot.category != fact.category
            or snapshot.data_scope != fact.data_scope
            or snapshot.subject != fact.subject
            or snapshot.jurisdiction != fact.jurisdiction
        ):
            continue
        adopted = EvidenceItem.model_validate(
            snapshot.model_dump(
                mode="python",
                exclude={"category", "data_scope", "subject", "jurisdiction"},
            )
        )
        identifier = hashlib.sha256(reference.evidence_id.encode()).hexdigest()[:20]
        metadata = _metadata(match, archive)
        metadata.update(
            {
                "adopted_evidence_id": reference.evidence_id,
                "original_source_type": snapshot.source_type,
                "original_source_url": snapshot.source_url,
                "original_publisher": snapshot.publisher,
                "original_quality": snapshot.quality,
                "original_access_url": snapshot.access_url,
                "original_access_metadata": snapshot.access_metadata,
            }
        )
        documents.append(
            SourceDocument(
                source_type=SourceType.SHIGUAN,
                source_name=_SOURCE_NAME,
                source_url=f"internal://shiguan/evidence/{identifier}",
                publisher=_PUBLISHER,
                title=f"{archive.title}（采用证据）",
                retrieved_at=retrieved_at,
                as_of=snapshot.as_of,
                published_at=snapshot.published_at,
                coverage=snapshot.coverage,
                license_note=snapshot.license_note,
                text=snapshot.excerpt,
                quality_ceiling=EvidenceQuality(snapshot.quality),
                metadata=metadata,
                locked_fact_key=fact.key,
                locked_fact_category=fact.category,
                locked_subject=fact.subject,
                adopted_evidence=adopted,
            )
        )
    return tuple(documents)


def _adopted_identity(item: EvidenceItem) -> str:
    payload = item.model_dump(
        mode="json",
        exclude={"retrieved_at", "access_url", "access_metadata"},
    )
    return json.dumps(
        payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True
    )


@dataclass(frozen=True)
class ShiguanSource:
    """Return bounded historical candidates without treating them as live facts."""

    recall: RecallCallable = _default_recall
    load_archive: ArchiveLoader = get_archive
    now: Clock = lambda: datetime.now(UTC)

    def fetch(self, query: SourceQuery) -> SourceResult:
        started = _clock_value(self.now)
        started_at = _iso(started)
        if not query.department and not query.matter_type:
            return SourceResult(
                documents=(),
                attempt=_attempt(
                    query,
                    SourceAttemptStatus.SKIPPED,
                    started_at,
                    _iso(_clock_value(self.now)),
                    "query_context_missing",
                ),
            )
        before_recall = _clock_value(self.now)
        if _deadline_reached(query, before_recall):
            return SourceResult(
                documents=(),
                attempt=_attempt(
                    query,
                    SourceAttemptStatus.BLOCKED,
                    started_at,
                    _iso(before_recall),
                    "deadline_exceeded",
                ),
            )

        try:
            recalled = self.recall(
                matter_type=query.matter_type,
                department=query.department,
                limit=query.max_items,
            )
            after_recall = _clock_value(self.now)
            if _deadline_reached(query, after_recall):
                return SourceResult(
                    documents=(),
                    attempt=_attempt(
                        query,
                        SourceAttemptStatus.BLOCKED,
                        started_at,
                        _iso(after_recall),
                        "deadline_exceeded",
                    ),
                )
            if not recalled.available:
                raise RuntimeError(_UNAVAILABLE)

            documents: list[SourceDocument] = []
            seen: set[str] = set()
            adopted_identities: dict[str, str] = {}
            loaded_archives = 0
            for match in recalled.entries:
                if match.archive_id in seen:
                    continue
                if loaded_archives >= query.max_items:
                    break
                seen.add(match.archive_id)
                loaded_archives += 1
                before_load = _clock_value(self.now)
                if _deadline_reached(query, before_load):
                    return SourceResult(
                        documents=(),
                        attempt=_attempt(
                            query,
                            SourceAttemptStatus.BLOCKED,
                            started_at,
                            _iso(before_load),
                            "deadline_exceeded",
                        ),
                    )
                archive = self.load_archive(match.archive_id)
                after_load = _clock_value(self.now)
                if _deadline_reached(query, after_load):
                    return SourceResult(
                        documents=(),
                        attempt=_attempt(
                            query,
                            SourceAttemptStatus.BLOCKED,
                            started_at,
                            _iso(after_load),
                            "deadline_exceeded",
                        ),
                    )
                restored = _adopted_snapshot_documents(
                    match,
                    archive,
                    retrieved_at=_iso(after_load),
                    fact_slots={
                        fact.key: fact
                        for fact in query.request.required_facts
                        if fact.key in query.unresolved_fact_keys
                    },
                )
                if restored:
                    for document in restored:
                        adopted = document.adopted_evidence
                        if adopted is None:
                            raise RuntimeError(_UNAVAILABLE)
                        identity = _adopted_identity(adopted)
                        prior = adopted_identities.get(adopted.evidence_id)
                        if prior is not None:
                            if prior != identity:
                                raise _AdoptedEvidenceConflictError(_ADOPTED_CONFLICT)
                            continue
                        adopted_identities[adopted.evidence_id] = identity
                        if len(documents) < query.max_items:
                            documents.append(document)
                else:
                    as_of = archive.reply_time or archive.created_at
                    if len(documents) < query.max_items:
                        documents.append(
                            SourceDocument(
                                source_type=SourceType.SHIGUAN,
                                source_name=_SOURCE_NAME,
                                source_url=f"internal://shiguan/archives/{archive.id}",
                                publisher=_PUBLISHER,
                                title=archive.title,
                                retrieved_at=_iso(after_load),
                                as_of=as_of,
                                text=(
                                    "历史结论（不代表当前实时状态）："
                                    f"{match.historical_conclusion}"
                                ),
                                quality_ceiling=EvidenceQuality.SECONDARY,
                                metadata=_metadata(match, archive),
                            )
                        )
        except _AdoptedEvidenceConflictError:
            return SourceResult(
                documents=(),
                attempt=_attempt(
                    query,
                    SourceAttemptStatus.FAILED,
                    started_at,
                    _iso(_clock_value(self.now)),
                    _ADOPTED_CONFLICT,
                ),
            )
        except Exception:  # noqa: BLE001 - sanitize and fail closed at source boundary
            return SourceResult(
                documents=(),
                attempt=_attempt(
                    query,
                    SourceAttemptStatus.FAILED,
                    started_at,
                    _iso(_clock_value(self.now)),
                    _UNAVAILABLE,
                ),
            )

        before_success = _clock_value(self.now)
        if _deadline_reached(query, before_success):
            return SourceResult(
                documents=(),
                attempt=_attempt(
                    query,
                    SourceAttemptStatus.BLOCKED,
                    started_at,
                    _iso(before_success),
                    "deadline_exceeded",
                ),
            )
        return SourceResult(
            documents=tuple(documents),
            attempt=_attempt(
                query,
                SourceAttemptStatus.SUCCEEDED,
                started_at,
                _iso(before_success),
            ),
        )
