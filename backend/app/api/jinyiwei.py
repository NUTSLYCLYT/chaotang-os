"""Read-only HTTP surface for the Jinyiwei evidence audit desk."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, FastAPI, Path, Query
from fastapi.responses import JSONResponse

from app.api.auth import CurrentUser
from app.jinyiwei.feed_registry import build_default_feed_registry
from app.jinyiwei.news import NewsSnapshotPreviewRequest, normalize_news_snapshot
from app.jinyiwei import storage
from app.jinyiwei.models import (
    EvidencePackStatus,
    InvestigationEvent,
    LongTaskRecord,
    ReplayArtifact,
    ReplayDiff,
)
from app.jinyiwei.read_models import (
    InvestigationDetail,
    InvestigationPage,
    InvestigationSummary,
    ReplayTimelineRead,
    InvestigationTrustRead,
    ApprovedFeedRegistryRead,
    ApprovedFeedSourceRead,
    EvidenceCoveragePoint,
    EvidenceCoverageReference,
    EvidenceCoverageRead,
    NewsSnapshotPreviewRead,
)
from app.jinyiwei.trust import assess_evidence

router = APIRouter(prefix="/api/v1/jinyiwei", tags=["jinyiwei"])


@router.get("/summary", response_model=InvestigationSummary)
def summary(current_user: CurrentUser) -> InvestigationSummary:
    return storage.get_investigation_summary(owner_user_id=current_user.id)


@router.get("/investigations", response_model=InvestigationPage)
def investigations(
    current_user: CurrentUser,
    status: EvidencePackStatus | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> InvestigationPage:
    return storage.list_investigations(
        owner_user_id=current_user.id,
        status=status,
        limit=limit,
        offset=offset,
    )


@router.get("/investigations/{investigation_id}", response_model=InvestigationDetail)
def investigation_detail(
    current_user: CurrentUser,
    investigation_id: str = Path(min_length=1, max_length=128),
) -> InvestigationDetail:
    if not investigation_id.strip():
        from fastapi import HTTPException

        raise HTTPException(status_code=422, detail="invalid investigation id")
    return storage.get_investigation_detail(
        investigation_id,
        owner_user_id=current_user.id,
    )


@router.get(
    "/investigations/{investigation_id}/events", response_model=tuple[InvestigationEvent, ...]
)
def investigation_events(
    current_user: CurrentUser,
    investigation_id: str = Path(min_length=1, max_length=128),
) -> tuple[InvestigationEvent, ...]:
    # Visibility is checked through the canonical detail relation before the ledger is returned.
    storage.get_investigation_detail(investigation_id, owner_user_id=current_user.id)
    return storage.list_investigation_events(investigation_id)


@router.get("/investigations/{investigation_id}/replay-timeline", response_model=ReplayTimelineRead)
def replay_timeline(
    current_user: CurrentUser,
    investigation_id: str = Path(min_length=1, max_length=128),
    replay_id: str | None = Query(default=None, min_length=1, max_length=128),
) -> ReplayTimelineRead:
    """Return the immutable event trail beside an optional replay result and diff."""
    storage.get_investigation_detail(investigation_id, owner_user_id=current_user.id)
    replay = (
        storage.get_replay_artifact(replay_id, owner_user_id=current_user.id)
        if replay_id is not None
        else None
    )
    diff = (
        storage.get_replay_diff(replay_id, owner_user_id=current_user.id)
        if replay_id is not None
        else None
    )
    return ReplayTimelineRead(
        events=storage.list_investigation_events(investigation_id),
        replay=replay,
        diff=diff,
    )


@router.get("/investigations/{investigation_id}/trust", response_model=InvestigationTrustRead)
def investigation_trust(
    current_user: CurrentUser,
    investigation_id: str = Path(min_length=1, max_length=128),
) -> InvestigationTrustRead:
    detail = storage.get_investigation_detail(investigation_id, owner_user_id=current_user.id)
    now = datetime.now(timezone.utc)
    assessments = {
        fact_key: assess_evidence(items, now=now)
        for fact_key, items in detail.evidence_by_fact.items()
    }
    return InvestigationTrustRead(
        assessments=assessments,
        generated_at=now.isoformat().replace("+00:00", "Z"),
    )


@router.get("/coverage", response_model=EvidenceCoverageRead)
def evidence_coverage(current_user: CurrentUser) -> EvidenceCoverageRead:
    """Return an owner-scoped, area-only projection of existing evidence."""
    now = datetime.now(timezone.utc)
    page = storage.list_investigations(owner_user_id=current_user.id, limit=100, offset=0)
    # Keep each investigation/fact as a separate reference. A region may aggregate
    # several references, but it must never manufacture one trust score by mixing
    # unrelated facts together.
    buckets: dict[str, dict[tuple[str, str], dict[str, object]]] = {}
    for item in page.items:
        detail = storage.get_investigation_detail(
            item.investigation_id,
            owner_user_id=current_user.id,
        )
        categories = {fact.key: fact.category.value for fact in detail.request.required_facts}
        conflicts_by_fact: dict[str, list[tuple[str, ...]]] = {}
        for conflict in detail.conflicts:
            conflicts_by_fact.setdefault(conflict.fact_key, []).append(
                tuple(conflict.evidence_ids)
            )
        for fact_key, evidence_items in detail.evidence_by_fact.items():
            for evidence in evidence_items:
                for region in evidence.coverage or ():
                    region_bucket = buckets.setdefault(region, {})
                    reference = region_bucket.setdefault(
                        (item.investigation_id, fact_key),
                        {
                            "items": {},
                            "event_type": categories[fact_key],
                            "conflicts": tuple(conflicts_by_fact.get(fact_key, ())),
                        },
                    )
                    items = reference["items"]
                    assert isinstance(items, dict)
                    items[evidence.evidence_id] = evidence

    points = []
    severity = {
        "VERIFIED": 0,
        "PROBABLE": 1,
        "MIXED": 2,
        "STALE": 3,
        "CONFLICTED": 4,
        "UNAVAILABLE": 5,
    }
    for region, references_by_key in buckets.items():
        references = []
        all_items = {}
        conflict_count = 0
        for (investigation_id, fact_key), reference in sorted(references_by_key.items()):
            raw_items = reference["items"]
            assert isinstance(raw_items, dict)
            items = tuple(raw_items.values())
            assessment = assess_evidence(
                items,
                now=now,
            )
            references.append(
                EvidenceCoverageReference(
                    investigation_id=investigation_id,
                    fact_key=fact_key,
                    event_type=reference["event_type"],
                    evidence=tuple(sorted(items, key=lambda evidence: evidence.evidence_id)),
                    assessment=assessment,
                )
            )
            all_items.update(raw_items)
            conflicts = reference["conflicts"]
            assert isinstance(conflicts, tuple)
            conflict_count += sum(
                1 for conflict_ids in conflicts if set(conflict_ids).intersection(raw_items)
            )

        assessments = [reference.assessment for reference in references]
        worst = max(assessments, key=lambda value: severity[value.evidence_state.value])
        points.append(
            EvidenceCoveragePoint(
                region=region,
                evidence_count=len(all_items),
                investigation_ids=tuple(sorted({key[0] for key in references_by_key})),
                evidence_ids=tuple(sorted(all_items)),
                event_types=tuple(sorted({reference.event_type for reference in references})),
                trust_state=worst.evidence_state,
                confidence_lower=min(reference.assessment.confidence_lower for reference in references),
                confidence_upper=max(reference.assessment.confidence_upper for reference in references),
                latest_as_of=max(item.as_of for item in all_items.values()),
                conflict_count=conflict_count,
                references=tuple(references),
            )
        )
    return EvidenceCoverageRead(
        points=tuple(sorted(points, key=lambda point: point.region)),
        generated_at=now.isoformat().replace("+00:00", "Z"),
        scanned_investigations=len(page.items),
        total_investigations=page.total,
        truncated=page.total > len(page.items),
    )


@router.get("/feeds", response_model=ApprovedFeedRegistryRead)
def approved_feeds(current_user: CurrentUser) -> ApprovedFeedRegistryRead:
    """Expose the approved feed registry without enabling feed retrieval."""
    del current_user
    now = datetime.now(timezone.utc)
    registry = build_default_feed_registry()
    sources = tuple(
        ApprovedFeedSourceRead(
            source_id=source.source_id,
            url=source.url,
            publisher=source.publisher,
            format=source.format,
            license_note=source.license_note,
            robots_policy=source.robots_policy,
            rate_limit_per_minute=source.rate_limit_per_minute,
            allowed_redirect_hosts=source.allowed_redirect_hosts,
            fingerprint=source.fingerprint,
        )
        for source in sorted(registry.sources.values(), key=lambda value: value.source_id)
    )
    return ApprovedFeedRegistryRead(
        sources=sources,
        generated_at=now.isoformat().replace("+00:00", "Z"),
    )


@router.post("/news/preview", response_model=NewsSnapshotPreviewRead)
def news_snapshot_preview(
    current_user: CurrentUser,
    request: NewsSnapshotPreviewRequest,
) -> NewsSnapshotPreviewRead:
    """Normalize a supplied feed snapshot without fetching or persisting it."""
    del current_user
    return normalize_news_snapshot(
        request,
        registry=build_default_feed_registry(),
        now=datetime.now(timezone.utc),
    )


@router.post("/investigations/{investigation_id}/replay", response_model=ReplayArtifact)
def replay_investigation(
    current_user: CurrentUser,
    investigation_id: str = Path(min_length=1, max_length=128),
) -> ReplayArtifact:
    """Create a replay artifact without mutating the original evidence pack."""
    return storage.create_replay_artifact(
        investigation_id,
        owner_user_id=current_user.id,
    )


@router.get("/replays/{replay_id}", response_model=ReplayArtifact)
def replay_detail(
    current_user: CurrentUser,
    replay_id: str = Path(min_length=1, max_length=128),
) -> ReplayArtifact:
    return storage.get_replay_artifact(replay_id, owner_user_id=current_user.id)


@router.get("/replays/{replay_id}/diff", response_model=ReplayDiff)
def replay_diff(
    current_user: CurrentUser,
    replay_id: str = Path(min_length=1, max_length=128),
) -> ReplayDiff:
    return storage.get_replay_diff(replay_id, owner_user_id=current_user.id)


@router.get("/long-tasks/{task_id}", response_model=LongTaskRecord)
def long_task_detail(
    current_user: CurrentUser,
    task_id: str = Path(min_length=1, max_length=128),
) -> LongTaskRecord:
    return storage.get_long_task(task_id, owner_user_id=current_user.id)


def register_jinyiwei_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(storage.InvestigationNotFoundError)
    async def _not_found(_request, _exc: storage.InvestigationNotFoundError) -> JSONResponse:
        return JSONResponse(
            status_code=404,
            content={
                "status": "error",
                "reason": "investigation_not_found",
                "message": "调查记录不存在",
            },
        )

    @app.exception_handler(storage.JinyiweiStorageError)
    async def _storage_unavailable(_request, _exc: storage.JinyiweiStorageError) -> JSONResponse:
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "reason": "storage_unavailable",
                "message": "锦衣卫档案暂时不可用",
            },
        )
