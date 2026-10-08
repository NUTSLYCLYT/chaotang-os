"""Authenticated, side-effect-free P0 API for Bingbu Revenue OS."""

from __future__ import annotations

from fastapi import APIRouter, FastAPI, Path, Query
from fastapi.responses import JSONResponse

from app.api.auth import CurrentUser
from app.bingbu.models import (
    ActionDraftRequest,
    CrmSyncCommitRequest,
    CrmSyncRequest,
    Health,
    ImportRequest,
    OpportunityStage,
    WarRoomRequest,
)
from app.bingbu.service import (
    BingbuConflictError,
    BingbuCrmUnavailable,
    BingbuInputError,
    BingbuNotFoundError,
    get_bingbu_service,
)

router = APIRouter(prefix="/api/v1/bingbu", tags=["bingbu"])


@router.get("/overview")
def overview(current_user: CurrentUser):
    return get_bingbu_service().overview(current_user.id)


@router.get("/opportunities")
def opportunities(
    current_user: CurrentUser,
    stage: OpportunityStage | None = Query(default=None),  # noqa: B008
    health: Health | None = Query(default=None),  # noqa: B008
    limit: int = Query(default=50, ge=1, le=100),  # noqa: B008
):
    values = get_bingbu_service().list_opportunities(
        current_user.id,
        stage=stage,
        health=health.value if health else None,
        limit=limit,
    )
    return {"items": values[:limit], "next_cursor": None}


@router.get("/opportunities/{opportunity_id}")
def opportunity_detail(
    current_user: CurrentUser,
    opportunity_id: str = Path(min_length=1, max_length=128),
):
    return get_bingbu_service().get_opportunity(current_user.id, opportunity_id)


@router.get("/opportunities/{opportunity_id}/timeline")
def opportunity_timeline(
    current_user: CurrentUser,
    opportunity_id: str = Path(min_length=1, max_length=128),
):
    return {"items": get_bingbu_service().get_timeline(current_user.id, opportunity_id)}


@router.get("/decision-packets/{packet_id}")
def decision_packet(current_user: CurrentUser, packet_id: str = Path(min_length=1, max_length=128)):
    return get_bingbu_service().get_packet(current_user.id, packet_id)


@router.get("/imports/{import_id}")
def import_detail(current_user: CurrentUser, import_id: str = Path(min_length=1, max_length=128)):
    return get_bingbu_service().get_import(current_user.id, import_id)


@router.post("/imports/preview")
def import_preview(payload: ImportRequest, current_user: CurrentUser):
    return get_bingbu_service().preview_import(current_user.id, payload)


@router.post("/imports/commit")
def import_commit(payload: ImportRequest, current_user: CurrentUser):
    return get_bingbu_service().commit_import(current_user.id, payload)


@router.post("/crm/sync/preview")
def crm_sync_preview(payload: CrmSyncRequest, current_user: CurrentUser):
    return get_bingbu_service().preview_crm_sync(current_user.id, payload)


@router.post("/crm/sync/commit")
def crm_sync_commit(payload: CrmSyncCommitRequest, current_user: CurrentUser):
    return get_bingbu_service().commit_crm_sync(current_user.id, payload)


@router.post("/war-rooms")
def war_room(payload: WarRoomRequest, current_user: CurrentUser):
    packet, draft = get_bingbu_service().create_war_room(current_user.id, payload.opportunity_id)
    return {"decision_packet": packet, "action_draft": draft}


@router.post("/action-drafts")
def action_draft(payload: ActionDraftRequest, current_user: CurrentUser):
    return get_bingbu_service().create_action_draft(current_user.id, payload)


@router.post("/action-drafts/{draft_id}/approve")
def approve_action_draft(
    current_user: CurrentUser,
    draft_id: str = Path(min_length=1, max_length=128),
):
    return get_bingbu_service().approve_action_draft(current_user.id, draft_id)


@router.post("/action-drafts/{draft_id}/reject")
def reject_action_draft(
    current_user: CurrentUser,
    draft_id: str = Path(min_length=1, max_length=128),
):
    return get_bingbu_service().reject_action_draft(current_user.id, draft_id)


def register_bingbu_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(BingbuNotFoundError)
    async def _not_found(_request, _exc: BingbuNotFoundError) -> JSONResponse:
        return JSONResponse(
            status_code=404,
            content={"code": "BINGBU_NOT_FOUND", "message": "销售对象不存在"},
        )

    @app.exception_handler(BingbuConflictError)
    async def _conflict(_request, _exc: BingbuConflictError) -> JSONResponse:
        return JSONResponse(
            status_code=409,
            content={"code": "BINGBU_CONFLICT", "message": "销售事实冲突"},
        )

    @app.exception_handler(BingbuInputError)
    async def _invalid(_request, _exc: BingbuInputError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={"code": "BINGBU_INVALID", "message": "请求或销售事实无效"},
        )

    @app.exception_handler(BingbuCrmUnavailable)
    async def _crm_unavailable(_request, _exc: BingbuCrmUnavailable) -> JSONResponse:
        return JSONResponse(
            status_code=503,
            content={"code": "BINGBU_CRM_UNAVAILABLE", "message": "CRM 事实源不可用"},
        )


__all__ = ["register_bingbu_exception_handlers", "router"]
