"""Read-only HTTP surface for the Jinyiwei evidence audit desk."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, FastAPI, Path, Query
from fastapi.responses import JSONResponse

from app.api.auth import CurrentUser
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
