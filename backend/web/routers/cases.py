"""案例归档端点 — /api/cases/*"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from src.case_archive import (
    approve_case,
    list_approved,
    list_pending,
    reject_case,
)

from web.deps import get_current_user
from web.schemas.auth import CurrentUser
from web.schemas.cases import CaseActionResponse, CaseRejectRequest, ReceiptRequest

router = APIRouter(prefix="/api/cases", tags=["cases"])


@router.get("/pending")
def api_cases_pending(
    _: CurrentUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    return list_pending()


@router.get("/approved")
def api_cases_approved(
    _: CurrentUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    return list_approved()


@router.post("/{filename}/approve", response_model=CaseActionResponse)
def api_case_approve(
    filename: str,
    _: CurrentUser = Depends(get_current_user),
) -> CaseActionResponse:
    return CaseActionResponse(ok=bool(approve_case(filename)))


@router.post("/{filename}/reject", response_model=CaseActionResponse)
def api_case_reject(
    filename: str,
    body: CaseRejectRequest | None = None,
    _: CurrentUser = Depends(get_current_user),
) -> CaseActionResponse:
    reason = body.reason if body else ""
    return CaseActionResponse(ok=bool(reject_case(filename, reason)))


# ── 30天成果回执(第5步·史馆飞轮):引用过的旧案催收"后来成了没" ──────


@router.get("/receipts/pending")
def api_receipts_pending(
    days: int = 30,
    _: CurrentUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """催收清单:被丞相引用超 days 天且没有回执的旧案(按当前租户)。"""
    from src.shiguan_outcome import pending_receipts

    return pending_receipts(days=days)


@router.post("/receipts")
def api_record_receipt(
    body: ReceiptRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    """人回执落账:recorded_by 取登录身份(留名纪律,不许匿名回执)。"""
    from fastapi import HTTPException

    from src.shiguan_outcome import record_outcome

    try:
        return record_outcome(
            body.source,
            body.outcome,
            recorded_by=user.username or "",
            note=body.note,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
