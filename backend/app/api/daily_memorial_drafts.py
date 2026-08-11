
"""Authenticated review API for daily memorial drafts."""

from __future__ import annotations

import re
from datetime import UTC, datetime

from fastapi import APIRouter, FastAPI
from fastapi.responses import JSONResponse

from app.api.auth import CurrentUser
from app.daily_memorial_drafts import storage
from app.daily_memorial_drafts.models import (
    ConfirmDailyMemorialRequest,
    ConfirmDailyMemorialResponse,
    DailyMemorialLatestResponse,
)
from app.shiguan.errors import ShiguanStorageError

_SAFE_DRAFT_ID = re.compile(r"^[0-9a-f]{32}$")
router = APIRouter(prefix="/api/v1/daily-memorial-drafts")


@router.get("/latest", response_model=DailyMemorialLatestResponse | None)
def latest(current_user: CurrentUser) -> DailyMemorialLatestResponse | None:
    try:
        return storage.get_latest_run(current_user.id)
    except ShiguanStorageError as exc:
        raise storage.DailyMemorialStorageError("每日奏报存储暂时不可用") from exc


@router.post("/{draft_id}/confirm", response_model=ConfirmDailyMemorialResponse)
def confirm(
    draft_id: str,
    payload: ConfirmDailyMemorialRequest,
    current_user: CurrentUser,
) -> ConfirmDailyMemorialResponse:
    if _SAFE_DRAFT_ID.fullmatch(draft_id) is None:
        raise storage.DailyMemorialNotFoundError("每日奏报待审稿不存在")
    try:
        return storage.confirm_draft(
            draft_id,
            payload,
            owner_user_id=current_user.id,
            now=datetime.now(UTC),
        )
    except ShiguanStorageError as exc:
        raise storage.DailyMemorialStorageError("每日奏报存储暂时不可用") from exc


def register_daily_memorial_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(storage.DailyMemorialNotFoundError)
    async def _not_found(_request, _exc) -> JSONResponse:
        return JSONResponse(
            status_code=404,
            content={
                "status": "error",
                "reason": "draft_not_found",
                "message": "每日奏报待审稿不存在",
            },
        )
    @app.exception_handler(storage.DailyMemorialConflictError)
    async def _conflict(_request, _exc) -> JSONResponse:
        return JSONResponse(
            status_code=409,
            content={
                "status": "error",
                "reason": "draft_conflict",
                "message": "每日奏报待审稿状态已变更",
            },
        )

    @app.exception_handler(storage.DailyMemorialStorageError)
    async def _storage(_request, _exc) -> JSONResponse:
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "reason": "storage_unavailable",
                "message": "每日奏报存储暂时不可用",
            },
        )
