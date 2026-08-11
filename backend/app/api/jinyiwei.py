"""Read-only HTTP surface for the Jinyiwei evidence audit desk."""

from __future__ import annotations

from fastapi import APIRouter, FastAPI, Path, Query
from fastapi.responses import JSONResponse

from app.api.auth import CurrentUser
from app.jinyiwei import storage
from app.jinyiwei.models import EvidencePackStatus
from app.jinyiwei.read_models import InvestigationDetail, InvestigationPage, InvestigationSummary

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
